import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from './ui/Button';
import { Save, ArrowLeft, Plus, Clock, MessageSquare, GitBranch, Zap, StopCircle, Loader2, Play, MessageCircle, Code, UserCheck, Tag, Mic, Workflow as WorkflowIcon } from 'lucide-react';
import { getTemplates, runWorkflow, aiGenerateWorkflow, getWorkflows } from '../api';

// --- Custom Node Components ---

const NodeWrapper = ({ children, selected, title, icon: Icon, colorClass }) => (
  <div className={`shadow-md rounded-md bg-white border-2 min-w-[200px] ${selected ? 'border-blue-500' : 'border-slate-200'}`}>
    <div className={`flex items-center px-3 py-2 border-b border-slate-100 ${colorClass} text-white rounded-t-[4px]`}>
      <Icon size={16} className="mr-2" />
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

const TriggerNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Trigger" icon={Zap} colorClass="bg-purple-600">
      <div className="text-xs text-slate-600">{data.label || 'Start Workflow'}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const TemplateNode = ({ data, selected }) => {
  const buttons = data.buttons || [];
  
  return (
    <NodeWrapper selected={selected} title="Send Template" icon={MessageSquare} colorClass="bg-green-600">
      <div className="text-xs text-slate-600 mb-2">Template: <b>{data.template || 'Select...'}</b></div>
      
      {/* Template Content Preview */}
      {data.content && (
        <div className="w-[250px] text-[10px] text-slate-500 bg-slate-50 p-2 rounded mb-2 border border-slate-100 whitespace-pre-wrap break-words">
          {data.content}
        </div>
      )}
      
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      
      {/* If template has buttons, render a handle for each button */}
      {buttons.length > 0 ? (
        <div className="space-y-2 mt-2">
          {buttons.map((btnText, idx) => (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[10px] text-slate-500 mr-2 bg-slate-100 px-1 rounded">{btnText}</span>
              <Handle 
                type="source" 
                position={Position.Right} 
                id={`button-${idx}`}
                className="w-3 h-3 bg-blue-400 !right-[-6px]" 
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Default single output if no buttons */
        <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400" />
      )}
    </NodeWrapper>
  );
};

const DelayNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Delay" icon={Clock} colorClass="bg-orange-500">
      <div className="text-xs text-slate-600">Wait: <b>{data.duration || 0} {data.unit || 'minutes'}</b></div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ConditionNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Condition" icon={GitBranch} colorClass="bg-blue-600">
      <div className="text-xs text-slate-600 mb-2">{data.condition || 'Configure condition'}</div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
        <span>YES</span>
        <span>NO</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="w-3 h-3 bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="w-3 h-3 bg-red-500" />
    </NodeWrapper>
  );
};

const SendMessageNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Send Message" icon={MessageCircle} colorClass="bg-teal-500">
      <div className="text-xs text-slate-600 mb-2 truncate max-w-[180px]">{data.message || 'Enter message...'}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const CustomCodeNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Custom Code" icon={Code} colorClass="bg-gray-800">
      <div className="text-xs text-slate-600 mb-2 font-mono truncate max-w-[180px]">{data.code || '// Enter code...'}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ActionNode = ({ data, selected }) => {
  const isAssign = data.actionType === 'assign_agent';
  const isTag = data.actionType === 'add_tag' || data.actionType === 'remove_tag';
  const isVar = data.actionType === 'set_variable';
  const isWorkflow = data.actionType === 'start_workflow';
  
  return (
    <NodeWrapper
      selected={selected}
      title="Action"
      icon={isAssign ? UserCheck : isWorkflow ? WorkflowIcon : isTag ? Tag : Plus}
      colorClass="bg-indigo-600"
    >
      <div className="text-xs text-slate-600 font-medium mb-1">
        {data.actionType === 'assign_agent'
          ? 'Assign Agent'
          : data.actionType === 'add_tag'
          ? 'Add Tag'
          : data.actionType === 'remove_tag'
          ? 'Remove Tag'
          : data.actionType === 'set_variable'
          ? 'Set Variable'
          : data.actionType === 'start_workflow'
          ? 'Start Workflow'
          : 'Action'}
      </div>
      <div className="text-xs text-slate-500 truncate max-w-[180px]">
        {isVar
          ? `${data.variableName || 'Key'} = ${data.variableValue || 'Val'}`
          : isWorkflow
          ? data.targetWorkflowName || 'Select workflow...'
          : data.actionValue || 'Configure...'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const EndNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="End" icon={StopCircle} colorClass="bg-slate-600">
      <div className="text-xs text-slate-600">End Workflow</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  send_template: TemplateNode,
  delay: DelayNode,
  condition: ConditionNode,
  send_message: SendMessageNode,
  custom_code: CustomCodeNode,
  action: ActionNode,
  end: EndNode,
};

// --- Helper Functions ---

let nodeIdCounter = 0;
const getId = () => {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
};

const extractTemplatePlaceholders = (bodyText) => {
  if (!bodyText) return [];
  const vars = [];
  const regex = /{{([a-zA-Z0-9_]+)}}/g;
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
};

const buildTemplateComponentsPayload = (tmpl, variables) => {
  if (!tmpl || !tmpl.bodyText) return [];
  const keys = extractTemplatePlaceholders(tmpl.bodyText);
  if (keys.length === 0) return [];
  const bodyParams = keys.map((k) => {
    const value = (variables && variables[k]) || '';
    const param = {
      type: 'text',
      text: value,
    };
    if (tmpl.parameterFormat === 'NAMED') {
      param.parameter_name = k;
    }
    return param;
  });
  return [
    {
      type: 'body',
      parameters: bodyParams,
    },
  ];
};

// --- Main Component ---

export default function WorkflowBuilder({ onBack, onSave, initialWorkflow }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow?.steps?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.steps?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [viewMode, setViewMode] = useState('canvas');
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [branchTarget, setBranchTarget] = useState(null);
  
  // Test/Run State
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runPhoneNumber, setRunPhoneNumber] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceContext, setVoiceContext] = useState(null);
  const [voiceGraph, setVoiceGraph] = useState(null);
  const [voicePreview, setVoicePreview] = useState([]);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  React.useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTemplates();
        if (res && res.data) {
          const mapped = res.data
            .filter((t) => t.status === 'APPROVED')
            .map((t) => {
              const bodyComp = t.components && t.components.find((c) => c.type === 'BODY');
              const buttonsComp = t.components && t.components.find((c) => c.type === 'BUTTONS');
              const examples = {};
              if (bodyComp && bodyComp.example) {
                if (t.parameter_format === 'NAMED' && bodyComp.example.body_text_named_params) {
                  bodyComp.example.body_text_named_params.forEach((p) => {
                    examples[p.param_name] = p.example;
                  });
                } else if (bodyComp.example.body_text && Array.isArray(bodyComp.example.body_text[0])) {
                  bodyComp.example.body_text[0].forEach((ex, i) => {
                    examples[(i + 1).toString()] = ex;
                  });
                }
              }
              return {
                id: t.id,
                name: t.name,
                language: t.language,
                status: t.status,
                category: t.category,
                bodyText: bodyComp ? bodyComp.text : '',
                buttons: buttonsComp ? buttonsComp.buttons : [],
                parameterFormat: t.parameter_format || 'POSITIONAL',
                examples,
              };
            });
          setTemplates(mapped);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  React.useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      try {
        const res = await getWorkflows();
        if (Array.isArray(res)) {
          const filtered =
            initialWorkflow && initialWorkflow.id
              ? res.filter((w) => w.id !== initialWorkflow.id)
              : res;
          setAvailableWorkflows(filtered);
        } else {
          setAvailableWorkflows([]);
        }
      } catch (err) {
        console.error('Failed to load workflows:', err);
        setAvailableWorkflows([]);
      } finally {
        setLoadingWorkflows(false);
      }
    };
    fetchWorkflows();
  }, [initialWorkflow]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const syncGraphFromList = useCallback(() => {
    setNodes((nds) => {
      const sorted = [...nds].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });

      const messageTypes = ['send_template', 'send_message'];

      const newNodes = [];

      for (let i = 0; i < sorted.length; i++) {
        const node = sorted[i];
        newNodes.push(node);

        if (messageTypes.includes(node.type) && !(node.data && node.data.branchConditionId)) {
          const data = node.data || {};
          const scheduleType = data.scheduleType || 'immediate';
          const delayValue = data.delayValue ?? null;

          if (scheduleType === 'delay' && delayValue && delayValue > 0) {
            const prevNode = i > 0 ? sorted[i - 1] : null;
            if (!prevNode) continue;

            const delayId = `delay_${node.id}`;
            let delayNode = sorted.find((n) => n.id === delayId);

            if (!delayNode) {
              const baseY =
                prevNode.position && typeof prevNode.position.y === 'number'
                  ? prevNode.position.y
                  : 0;
              delayNode = {
                id: delayId,
                type: 'delay',
                position: {
                  x:
                    prevNode.position && typeof prevNode.position.x === 'number'
                      ? prevNode.position.x
                      : 0,
                  y: baseY + 60,
                },
                data: {
                  label: 'Delay',
                  duration: data.delayValue,
                  unit: data.delayUnit || 'minutes',
                },
              };
            } else {
              delayNode = {
                ...delayNode,
                data: {
                  ...(delayNode.data || {}),
                  duration: data.delayValue,
                  unit: data.delayUnit || delayNode.data?.unit || 'minutes',
                },
              };
            }

            newNodes.push(delayNode);
          }
        }
      }

      const finalNodes = newNodes.filter((n) => {
        if (n.type !== 'delay') return true;
        if (!n.id.startsWith('delay_')) return true;
        const targetId = n.id.replace('delay_', '');
        const targetNode = newNodes.find((nn) => nn.id === targetId);
        const data = targetNode?.data || {};
        return data.scheduleType === 'delay' && data.delayValue && data.delayValue > 0;
      });

      const linear = [...finalNodes].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });

      const positionedMap = {};
      linear.forEach((node, index) => {
        const x =
          node.position && typeof node.position.x === 'number'
            ? node.position.x
            : 0;
        positionedMap[node.id] = {
          x,
          y: index * 140,
        };
      });

      const positionedNodes = finalNodes.map((node) => {
        const pos = positionedMap[node.id];
        if (!pos) return node;
        return {
          ...node,
          position: pos,
        };
      });

      const byId = {};
      positionedNodes.forEach((n) => {
        byId[n.id] = n;
      });

      const topLevel = positionedNodes.filter((n) => !(n.data && n.data.branchConditionId));

      const nextEdges = [];

      for (let i = 0; i < topLevel.length - 1; i++) {
        const source = topLevel[i];
        const target = topLevel[i + 1];
        if (source.type === 'end') continue;
        if (source.type === 'condition') continue;
        nextEdges.push({
          id: `e_${source.id}_${target.id}`,
          source: source.id,
          target: target.id,
        });
      }

      const branchMap = {};
      positionedNodes.forEach((n) => {
        const data = n.data || {};
        const condId = data.branchConditionId;
        const side = data.branchSide;
        if (condId && (side === 'yes' || side === 'no')) {
          if (!branchMap[condId]) branchMap[condId] = { yes: [], no: [] };
          branchMap[condId][side].push(n);
        }
      });

      Object.keys(branchMap).forEach((condId) => {
        const condNode = byId[condId];
        if (!condNode) return;
        const branches = branchMap[condId];
        ['yes', 'no'].forEach((side) => {
          const children = branches[side]
            .slice()
            .sort((a, b) => {
              const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
              const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
              return ay - by;
            });
          if (children.length === 0) return;
          const first = children[0];
          nextEdges.push({
            id: `e_${condId}_${side}_${first.id}`,
            source: condId,
            sourceHandle: side,
            target: first.id,
          });
          for (let i = 0; i < children.length - 1; i++) {
            const s = children[i];
            const t = children[i + 1];
            nextEdges.push({
              id: `e_${s.id}_${t.id}`,
              source: s.id,
              target: t.id,
            });
          }
        });
      });

      const uniqueEdges = [];
      const seenEdgeKey = new Set();

      nextEdges.forEach((edge) => {
        const srcNode = byId[edge.source];
        const srcType = srcNode && srcNode.type;
        const isCondition = srcType === 'condition';
        const isTemplateWithButtons =
          srcType === 'send_template' &&
          srcNode &&
          Array.isArray(srcNode.data?.buttons) &&
          srcNode.data.buttons.length > 0;

        const key = `${edge.source}-${edge.sourceHandle || ''}`;

        if (isCondition || isTemplateWithButtons) {
          uniqueEdges.push(edge);
        } else {
          if (seenEdgeKey.has(key)) {
            return;
          }
          seenEdgeKey.add(key);
          uniqueEdges.push(edge);
        }
      });

      setEdges(uniqueEdges);
      return positionedNodes;
    });
  }, [setNodes, setEdges]);

  const handleListItemDragStart = (event, nodeId) => {
    setDraggingNodeId(nodeId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleListItemDragOver = (event) => {
    event.preventDefault();
  };

  const handleListItemDrop = (event, targetNodeId) => {
    event.preventDefault();
    if (!draggingNodeId || draggingNodeId === targetNodeId) return;
    setNodes((nds) => {
      const ordered = [...nds].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });
      const fromIndex = ordered.findIndex((n) => n.id === draggingNodeId);
      const toIndex = ordered.findIndex((n) => n.id === targetNodeId);
      if (fromIndex === -1 || toIndex === -1) return nds;
      const updated = [...ordered];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((node, index) => {
        const x = node.position && typeof node.position.x === 'number' ? node.position.x : 0;
        return {
          ...node,
          position: {
            x,
            y: index * 120,
          },
        };
      });
      return reordered;
    });
    syncGraphFromList();
    setDraggingNodeId(null);
  };

  const handleListItemDragEnd = () => {
    setDraggingNodeId(null);
  };

  const handleAddNodeFromPalette = useCallback(
    (type) => {
      let createdNode = null;
      setNodes((nds) => {
        const yValues = nds.map((n) =>
          n.position && typeof n.position.y === 'number' ? n.position.y : 0
        );
        const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
        let position = {
          x: 0,
          y: yValues.length > 0 ? maxY + 120 : 0,
        };

        let data = { label: `${type} node` };

        if (
          viewMode === 'list' &&
          branchTarget &&
          (type === 'send_template' || type === 'send_message')
        ) {
          const condNode = nds.find((n) => n.id === branchTarget.conditionId);
          if (condNode && condNode.position) {
            position = {
              x: condNode.position.x,
              y: condNode.position.y + 140,
            };
          }
          data = {
            ...data,
            branchConditionId: branchTarget.conditionId,
            branchSide: branchTarget.side,
          };
        }

        createdNode = {
          id: getId(),
          type,
          position,
          data,
        };
        const newNodes = [...nds, createdNode];
        return newNodes;
      });
      if (createdNode) {
        setSelectedNode(createdNode);
      }
      syncGraphFromList();
    },
    [setNodes, syncGraphFromList, viewMode, branchTarget]
  );

  const updateNodeData = (key, value) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const newData = { ...node.data, [key]: value };
          // Optimistic update for selected node
          setSelectedNode({ ...node, data: newData }); 
          return { ...node, data: newData };
        }
        return node;
      })
    );
  };

  const updateNodeFields = (nodeId, changes) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...changes,
            },
          };
        }
        return node;
      })
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((node) =>
        node
          ? {
              ...node,
              data: {
                ...node.data,
                ...changes,
              },
            }
          : node
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(changes, 'scheduleType') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayValue') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayUnit')
    ) {
      syncGraphFromList();
    }
  };

  const handleSave = () => {
    // Convert Graph to JSON format required
    // { workflow_id, trigger, nodes: [...] }
    
    // Find trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const triggerType = triggerNode?.data?.triggerType || 'new_lead';

    const formattedNodes = nodes.map(node => {
      const nodeDef = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      };
      
      // Find connections
      if (node.type === 'condition') {
        const yesEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'yes');
        const noEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'no');
        if (yesEdge) nodeDef.yes = yesEdge.target;
        if (noEdge) nodeDef.no = noEdge.target;
      } else if (node.type === 'send_template' && node.data.buttons && node.data.buttons.length > 0) {
        nodeDef.routes = {};
        node.data.buttons.forEach((btn, idx) => {
           const edge = edges.find(e => e.source === node.id && e.sourceHandle === `button-${idx}`);
           if (edge) {
              nodeDef.routes[btn] = edge.target;
           }
        });
      } else {
        const edge = edges.find(e => e.source === node.id);
        if (edge) nodeDef.next = edge.target;
      }
      
      return nodeDef;
    });

    const workflowJson = {
      workflow_id: initialWorkflow?.id || `wf_${Date.now()}`,
      trigger: triggerType,
      nodes: formattedNodes,
      edges: edges
    };

    console.log('Saved Workflow JSON:', workflowJson);
    if (onSave) onSave(workflowJson);
    return workflowJson; // Return for immediate use if needed
  };

  const handleManualSave = async () => {
    try {
      handleSave();
      alert('Workflow saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save workflow.');
    }
  };

  const handleRun = async () => {
    if (!runPhoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setIsRunning(true);
    try {
      // Auto-save before running to ensure backend has latest version
      if (onSave) {
          // We need to wait for save to complete if it was async, but onSave is likely just passing data up.
          // Ideally we should call API to save here if not already saved.
          // But `onSave` in App.jsx calls updateWorkflow.
          // Let's assume user should save first or we trigger save.
          // To be safe, we'll just proceed assuming the user saved or we are running the *persisted* version.
          // Actually, if we just edited, the backend is stale.
          // We should force a save.
          const json = handleSave();
          // Wait a bit for propagation if needed, or better, change onSave to be async and await it.
          // But onSave in App.jsx is async.
          // Let's await it if it returns a promise.
          await onSave(json); 
      }
      
      // Now run
      const res = await runWorkflow(initialWorkflow.id, runPhoneNumber);
      if (res.error) throw new Error(res.error);
      
      alert('Workflow execution started! Check console for details.');
      console.log('Run logs:', res.log);
      setIsRunModalOpen(false);
    } catch (err) {
      console.error('Failed to run workflow:', err);
      alert('Failed to run workflow: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStartRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. You can type your request instead.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (event) => {
        setVoiceError(event.error || 'Voice capture error');
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
      setVoiceError('');
    } catch (err) {
      setVoiceError('Unable to start voice capture. You can type your request instead.');
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleGenerateFromVoice = async () => {
    if (!voiceText.trim()) {
      setVoiceError('Please speak or type what you want the workflow to do.');
      return;
    }
    if (voiceGraph && voicePreview.length > 0) {
      const graph = voiceGraph;
      const ctx = voiceContext;
      if (ctx && ctx.mode === 'branch' && ctx.conditionId && ctx.side) {
        const conditionId = ctx.conditionId;
        const side = ctx.side;
        const steps = (graph.nodes || []).filter(
          (n) => n.type === 'send_template' || n.type === 'send_message'
        );
        if (!steps.length) {
          setVoiceError('Could not understand any steps from your description.');
          return;
        }
        setNodes((nds) => {
          const condNode = nds.find((n) => n.id === conditionId);
          const baseX =
            condNode && condNode.position && typeof condNode.position.x === 'number'
              ? condNode.position.x
              : 0;
          const baseY =
            condNode && condNode.position && typeof condNode.position.y === 'number'
              ? condNode.position.y
              : 0;
          const created = steps.map((step, index) => ({
            id: getId(),
            type: step.type,
            position: {
              x: baseX,
              y: baseY + (index + 1) * 140,
            },
            data: {
              ...(step.data || {}),
              branchConditionId: conditionId,
              branchSide: side,
            },
          }));
          return [...nds, ...created];
        });
        syncGraphFromList();
      } else {
        const steps = (graph.nodes || []).filter(
          (n) => n.type === 'send_template' || n.type === 'send_message'
        );
        if (!steps.length) {
          setVoiceError('Could not understand any steps from your description.');
          return;
        }
        setNodes((nds) => {
          const yValues = nds.map((n) =>
            n.position && typeof n.position.y === 'number' ? n.position.y : 0
          );
          const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
          const firstMessage = nds.find(
            (n) => n.type === 'send_template' || n.type === 'send_message'
          );
          const baseX =
            firstMessage && firstMessage.position && typeof firstMessage.position.x === 'number'
              ? firstMessage.position.x
              : 0;
          const created = steps.map((step, index) => ({
            id: getId(),
            type: step.type,
            position: {
              x: baseX,
              y: maxY + (index + 1) * 140,
            },
            data: {
              ...(step.data || {}),
            },
          }));
          return [...nds, ...created];
        });
        syncGraphFromList();
      }
      setIsVoiceModalOpen(false);
      setVoiceText('');
      setVoiceContext(null);
      setVoiceGraph(null);
      setVoicePreview([]);
      return;
    }
    setIsVoiceProcessing(true);
    setVoiceError('');
    try {
      const graph = await aiGenerateWorkflow(voiceText.trim());
      if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
        const lines = summarizeVoiceSteps(graph, voiceContext);
        if (!lines.length) {
          setVoiceError('Could not understand any steps from your description.');
          setVoiceGraph(null);
          setVoicePreview([]);
        } else {
          setVoiceGraph(graph);
          setVoicePreview(lines);
        }
      } else {
        setVoiceError('Could not understand AI response. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate workflow from voice:', err);
      setVoiceError('Failed to generate workflow. Please try again.');
      setVoiceGraph(null);
      setVoicePreview([]);
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const sortedNodes = [...nodes].sort((a, b) => {
    const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
    const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
    return ay - by;
  });

  const summarizeVoiceSteps = (graph, context) => {
    if (!graph || !Array.isArray(graph.nodes)) return [];
    let nodesToUse = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
    if (context && context.mode === 'branch') {
      nodesToUse = nodesToUse.filter(
        (n) => n.type === 'send_template' || n.type === 'send_message'
      );
    }
    nodesToUse = nodesToUse.filter(
      (n) => n.type === 'send_template' || n.type === 'send_message' || n.type === 'delay'
    );
    nodesToUse.sort((a, b) => {
      const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
      const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
      return ay - by;
    });
    const lines = [];
    nodesToUse.forEach((node) => {
      const data = node.data || {};
      if (node.type === 'send_template' || node.type === 'send_message') {
        const type = data.scheduleType || 'immediate';
        if (type === 'delay') {
          const rawVal =
            typeof data.delayValue === 'number'
              ? data.delayValue
              : parseInt(String(data.delayValue || '0'), 10);
          const v = Number.isNaN(rawVal) ? 0 : rawVal;
          const u = data.delayUnit || 'minutes';
          if (v > 0) {
            lines.push(`Wait ${v} ${u}`);
          }
        }
        if (node.type === 'send_template') {
          const name = data.template || data.label || 'template';
          lines.push(`Send template "${name}"`);
        } else {
          const msg = (data.message || '').trim();
          const short =
            msg.length > 60 ? `${msg.slice(0, 57)}...` : msg || 'message';
          lines.push(`Send message "${short}"`);
        }
      } else if (node.type === 'delay') {
        const v =
          typeof data.duration === 'number'
            ? data.duration
            : parseInt(String(data.duration || '0'), 10);
        const u = data.unit || 'minutes';
        if (!Number.isNaN(v) && v > 0) {
          lines.push(`Wait ${v} ${u}`);
        }
      }
    });
    return lines;
  };

  const getScheduleSummary = (data) => {
    const type = data.scheduleType || 'immediate';
    if (type === 'immediate') {
      return 'Message sent immediately after previous step';
    }
    if (type === 'delay') {
      const value = data.delayValue || data.duration || 0;
      const unit = data.delayUnit || data.unit || 'minutes';
      return `Message sent ${value} ${unit} after previous step`;
    }
    if (type === 'specific_time') {
      return 'Message sent at the scheduled time';
    }
    return '';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative">
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[95vw] p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mic size={18} className="text-slate-700" />
              Add using voice
            </h3>
            <p className="text-xs text-slate-500">
              Example: I want to send a WhatsApp template named "course_selection" and after 1 day send a message saying hi.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className="flex items-center gap-2"
                >
                  <Mic size={16} />
                  {isRecording ? 'Stop recording' : 'Start recording'}
                </Button>
                <span className="text-xs text-slate-500">
                  {isRecording ? 'Listening...' : 'You can also type below'}
                </span>
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                placeholder='Describe the flow you want, for example: "Send template course_selection, then after 1 day send a message saying hi."'
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
              />
              {voicePreview.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-md p-2 bg-slate-50">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Detected steps
                  </div>
                  <ol className="text-[11px] text-slate-700 space-y-1 list-decimal list-inside">
                    {voicePreview.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ol>
                </div>
              )}
              {voiceError && (
                <p className="text-xs text-red-500">
                  {voiceError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsVoiceModalOpen(false);
                  setVoiceText('');
                  setVoiceError('');
                  setVoiceGraph(null);
                  setVoicePreview([]);
                  if (isRecording) {
                    handleStopRecording();
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleGenerateFromVoice} disabled={isVoiceProcessing}>
                {isVoiceProcessing && <Loader2 size={16} className="animate-spin mr-2" />}
                {isVoiceProcessing
                  ? 'Generating...'
                  : voiceGraph && voicePreview.length > 0
                  ? 'Apply to workflow'
                  : 'Generate steps'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Run Modal */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden p-6 space-y-4">
             <h3 className="font-semibold text-slate-900">Run Workflow</h3>
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Test Phone Number</label>
               <input 
                 className="w-full border border-slate-300 rounded-md p-2 text-sm"
                 placeholder="e.g. 15551234567"
                 value={runPhoneNumber}
                 onChange={(e) => setRunPhoneNumber(e.target.value)}
               />
               <p className="text-xs text-slate-500">Enter number with country code (no +)</p>
             </div>
             <div className="flex justify-end gap-2 pt-2">
               <Button variant="ghost" onClick={() => setIsRunModalOpen(false)}>Cancel</Button>
               <Button onClick={handleRun} disabled={isRunning}>
                 {isRunning ? <Loader2 size={16} className="animate-spin mr-2" /> : <Play size={16} className="mr-2" />}
                 {isRunning ? 'Running...' : 'Run Now'}
               </Button>
             </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-slate-800">Workflow Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 mr-2">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'canvas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              List
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setVoiceContext({ mode: 'global' });
              setIsVoiceModalOpen(true);
            }}
            className="flex items-center gap-2 text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Mic size={16} />
            Add using voice
          </Button>
          <Button variant="outline" onClick={() => setIsRunModalOpen(true)} className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50">
            <Play size={16} />
            Run Test
          </Button>
          <Button onClick={handleManualSave} className="flex items-center gap-2">
            <Save size={16} />
            Save Workflow
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Palette */}
        <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Blocks</h2>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto">
            {viewMode === 'canvas' && (
              <DraggableBlock
                type="trigger"
                label="Trigger"
                icon={Zap}
                color="bg-purple-600"
                onAdd={handleAddNodeFromPalette}
                disabledDrag={false}
              />
            )}
            <DraggableBlock
              type="send_template"
              label="Send Template"
              icon={MessageSquare}
              color="bg-green-600"
              onAdd={handleAddNodeFromPalette}
              disabledDrag={viewMode !== 'canvas'}
            />
            <DraggableBlock
              type="send_message"
              label="Send Message"
              icon={MessageCircle}
              color="bg-teal-500"
              onAdd={handleAddNodeFromPalette}
              disabledDrag={viewMode !== 'canvas'}
            />
            <DraggableBlock
              type="condition"
              label="Condition"
              icon={GitBranch}
              color="bg-blue-600"
              onAdd={handleAddNodeFromPalette}
              disabledDrag={viewMode !== 'canvas'}
            />
            {viewMode === 'canvas' && (
              <>
                <DraggableBlock
                  type="delay"
                  label="Delay"
                  icon={Clock}
                  color="bg-orange-500"
                  onAdd={handleAddNodeFromPalette}
                  disabledDrag={false}
                />
                <DraggableBlock
                  type="action"
                  label="Action"
                  icon={Plus}
                  color="bg-indigo-600"
                  onAdd={handleAddNodeFromPalette}
                  disabledDrag={false}
                />
                <DraggableBlock
                  type="custom_code"
                  label="Custom Code"
                  icon={Code}
                  color="bg-gray-800"
                  onAdd={handleAddNodeFromPalette}
                  disabledDrag={false}
                />
                <DraggableBlock
                  type="end"
                  label="End"
                  icon={StopCircle}
                  color="bg-slate-600"
                  onAdd={handleAddNodeFromPalette}
                  disabledDrag={false}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          {viewMode === 'canvas' ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#f1f5f9" gap={16} />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="h-full overflow-y-auto p-4 bg-slate-50">
              {sortedNodes.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No nodes added yet. Drag blocks from the left to build your workflow.
                </div>
              ) : (
                <ol className="space-y-2">
                  {sortedNodes.map((node) => {
                    const isMessageNode = node.type === 'send_template' || node.type === 'send_message';
                    const isExpanded = expandedNodeId === node.id;
                    if (isMessageNode) {
                      const title =
                        node.type === 'send_template'
                          ? node.data?.template || node.data?.label || 'Untitled Message'
                          : node.data?.label || node.data?.message || 'Untitled Message';
                      const scheduleSummary = getScheduleSummary(node.data || {});
                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => {
                            setSelectedNode(node);
                            setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                          }}
                          className={`rounded-md border px-3 py-2 text-sm bg-white ${
                            selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 cursor-move">⋮⋮</span>
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{title}</span>
                                <span className="text-[11px] text-slate-500">{scheduleSummary}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                                  setSelectedNode(node);
                                }}
                              >
                                {isExpanded ? 'Hide' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNodes((nds) => nds.filter((n) => n.id !== node.id));
                                  if (selectedNode && selectedNode.id === node.id) {
                                    setSelectedNode(null);
                                  }
                                  if (expandedNodeId === node.id) {
                                    setExpandedNodeId(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Message Name</label>
                                <input
                                  className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                  value={node.data?.label || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    updateNodeFields(node.id, { label: value });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Schedule</label>
                                <div
                                  className="flex flex-wrap gap-3 text-xs text-slate-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={(node.data?.scheduleType || 'immediate') === 'immediate'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'immediate',
                                        })
                                      }
                                    />
                                    <span>Immediate</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'specific_time'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'specific_time',
                                        })
                                      }
                                    />
                                    <span>Specific time</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'delay'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'delay',
                                        })
                                      }
                                    />
                                    <span>After X minutes/hours/days</span>
                                  </label>
                                </div>
                                {node.data?.scheduleType === 'delay' && (
                                  <div
                                    className="flex items-center gap-2 mt-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      className="w-20 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayValue ?? ''}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayValue: e.target.value ? parseInt(e.target.value, 10) : '',
                                        })
                                      }
                                    />
                                    <select
                                      className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayUnit || 'minutes'}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayUnit: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="minutes">Minutes</option>
                                      <option value="hours">Hours</option>
                                      <option value="days">Days</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                              {node.type === 'send_message' && (
                                <div className="space-y-1">
                                  <label className="text-xs text-slate-500">Content</label>
                                  <textarea
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[120px]"
                                    placeholder="Enter message content..."
                                    value={node.data?.message || ''}
                                    onChange={(e) =>
                                      updateNodeFields(node.id, {
                                        message: e.target.value,
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    }
                    if (node.type === 'condition') {
                      const title = node.data?.label || 'Condition';
                      const desc = node.data?.condition || 'Configure condition';

                      const branchChildren = {};
                      sortedNodes.forEach((n) => {
                        const data = n.data || {};
                        if (data.branchConditionId === node.id && (data.branchSide === 'yes' || data.branchSide === 'no')) {
                          if (!branchChildren[data.branchSide]) branchChildren[data.branchSide] = [];
                          branchChildren[data.branchSide].push(n);
                        }
                      });

                      const yesChildren = (branchChildren.yes || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const noChildren = (branchChildren.no || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const isYesActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'yes';
                      const isNoActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'no';

                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => setSelectedNode(node)}
                          className={`rounded-md border px-3 py-2 text-sm bg-white ${
                            selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-slate-400 cursor-move">⋮⋮</span>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">{title}</span>
                              <span className="text-[11px] text-slate-500">{desc}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 text-[11px] text-slate-600 border rounded overflow-hidden">
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold ${
                                isYesActive ? 'text-white bg-green-500' : 'text-green-600 bg-green-50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                              }}
                            >
                              YES
                            </button>
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold border-l border-slate-200 ${
                                isNoActive ? 'text-white bg-red-500' : 'text-red-600 bg-red-50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                              }}
                            >
                              NO
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-green-300 text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'yes' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add YES flow using voice
                            </button>
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-red-300 text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'no' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add NO flow using voice
                            </button>
                          </div>
                          {(yesChildren.length > 0 || noChildren.length > 0) && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                {yesChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1 border-l border-dashed border-slate-200 pl-2">
                                {noChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    }
                    return (
                      <li
                        key={node.id}
                        draggable
                        onDragStart={(event) => handleListItemDragStart(event, node.id)}
                        onDragOver={handleListItemDragOver}
                        onDrop={(event) => handleListItemDrop(event, node.id)}
                        onDragEnd={handleListItemDragEnd}
                        onClick={() => setSelectedNode(node)}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-move bg-white ${
                          selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">{node.type}</span>
                          <span className="text-slate-800">
                            {(node.data &&
                              (node.data.label ||
                                node.data.template ||
                                node.data.message ||
                                node.data.condition ||
                                node.data.actionType)) ||
                              'Untitled'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">Drag to reorder</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Config */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Configuration</h2>
              <div className="text-xs text-slate-500 mt-1">ID: {selectedNode.id}</div>
              <div className="text-xs text-slate-500">Type: {selectedNode.type}</div>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Dynamic Config Forms based on Node Type */}
              {selectedNode.type === 'trigger' && (
                 <div className="space-y-3">
                   <label className="block text-sm font-medium text-slate-700">Trigger Event</label>
                   <select 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.triggerType || 'new_lead'}
                    onChange={(e) => updateNodeData('triggerType', e.target.value)}
                   >
                     <option value="new_lead">New Lead Created</option>
                     <option value="first_message">User Sends First Message</option>
                     <option value="tag_added">Tag Added</option>
                   </select>
                 </div>
              )}

              {selectedNode.type === 'send_template' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-medium text-slate-700">Select Template</label>
                    {loadingTemplates && <Loader2 size={12} className="animate-spin text-slate-400" />}
                  </div>
                  <select 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.template || ''}
                    onChange={(e) => {
                      const tName = e.target.value;
                      const found = templates.find((t) => t.name === tName);
                      let btns = [];
                      let content = '';
                      let vars = {};
                      let components = [];
                      if (found) {
                        content = found.bodyText || '';
                        if (found.buttons && Array.isArray(found.buttons)) {
                          btns = found.buttons.map((b) => b.text).filter(Boolean);
                        }
                        const keys = extractTemplatePlaceholders(found.bodyText || '');
                        keys.forEach((k) => {
                          const ex = found.examples && Object.prototype.hasOwnProperty.call(found.examples, k)
                            ? found.examples[k]
                            : '';
                          vars[k] = ex || '';
                        });
                        components = buildTemplateComponentsPayload(found, vars);
                      }
                      if (!selectedNode) return;
                      setNodes((nds) =>
                        nds.map((node) => {
                          if (node.id === selectedNode.id) {
                            const newData = {
                              ...node.data,
                              template: tName,
                              buttons: btns,
                              content,
                              variables: vars,
                              components,
                              languageCode: found ? (found.language || 'en_US') : 'en_US',
                            };
                            setSelectedNode({ ...node, data: newData });
                            return { ...node, data: newData };
                          }
                          return node;
                        })
                      );
                    }}
                  >
                    <option value="">-- Select Template --</option>
                    {templates.length > 0 ? (
                      templates.map(t => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.language})
                        </option>
                      ))
                    ) : (
                      <option disabled>No approved templates found</option>
                    )}
                  </select>
                  
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Variables</label>
                    {(() => {
                      const tmpl = templates.find((t) => t.name === selectedNode.data.template);
                      const keys = tmpl ? extractTemplatePlaceholders(tmpl.bodyText || '') : [];
                      const vars = selectedNode.data.variables || {};
                      if (!tmpl || keys.length === 0) {
                        return (
                          <div className="text-xs text-slate-500">
                            No variables for this template.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {keys.map((k) => (
                            <div key={k} className="space-y-1">
                              <div className="text-xs text-slate-500 font-mono">
                                {'{{' + k + '}}'}
                              </div>
                              <input
                                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                placeholder={`Value for ${k}`}
                                value={vars[k] || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const nextVars = { ...vars, [k]: value };
                                  const meta = templates.find((t) => t.name === selectedNode.data.template);
                                  const nextComps = buildTemplateComponentsPayload(meta, nextVars);
                                  updateNodeFields(selectedNode.id, {
                                    variables: nextVars,
                                    components: nextComps,
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Wait Duration</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      className="w-20 border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.duration || 0}
                      onChange={(e) => updateNodeData('duration', parseInt(e.target.value))}
                    />
                    <select 
                      className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.unit || 'minutes'}
                      onChange={(e) => updateNodeData('unit', e.target.value)}
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              )}
              
              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Condition Type</label>
                  <select 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.conditionType || 'user_replied'}
                    onChange={(e) => updateNodeData('conditionType', e.target.value)}
                  >
                    <option value="user_replied">User Replied</option>
                    <option value="has_tag">User Has Tag</option>
                    <option value="variable_match">Variable Match</option>
                  </select>

                  {selectedNode.data.conditionType === 'has_tag' && (
                     <input 
                       placeholder="Tag Name" 
                       className="w-full border border-slate-300 rounded-md p-2 text-sm"
                       value={selectedNode.data.tagName || ''}
                       onChange={(e) => updateNodeData('tagName', e.target.value)}
                     />
                  )}

                  {selectedNode.data.conditionType === 'variable_match' && (
                    <div className="space-y-2">
                       <input 
                         placeholder="Variable Name" 
                         className="w-full border border-slate-300 rounded-md p-2 text-sm"
                         value={selectedNode.data.variableName || ''}
                         onChange={(e) => updateNodeData('variableName', e.target.value)}
                       />
                       <input 
                         placeholder="Value to Match" 
                         className="w-full border border-slate-300 rounded-md p-2 text-sm"
                         value={selectedNode.data.variableValue || ''}
                         onChange={(e) => updateNodeData('variableValue', e.target.value)}
                       />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'send_message' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Message Text</label>
                  <textarea 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[100px]"
                    placeholder="Enter message text..."
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateNodeData('message', e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Note: Can only be sent within 24 hours of the user's last message.
                  </p>
                </div>
              )}

              {selectedNode.type === 'custom_code' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">JavaScript Code</label>
                  <textarea 
                    className="w-full border border-slate-900 bg-slate-900 text-slate-50 rounded-md p-2 text-sm font-mono min-h-[200px]"
                    placeholder="// e.g. console.log('Processing request...')"
                    value={selectedNode.data.code || ''}
                    onChange={(e) => updateNodeData('code', e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Code runs in a restricted environment. Use `console.log` for debugging.
                  </p>
                </div>
              )}

              {selectedNode.type === 'action' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Action</label>
                  <select 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.actionType || 'add_tag'}
                    onChange={(e) => {
                      const type = e.target.value;
                      updateNodeFields(selectedNode.id, {
                        actionType: type,
                        actionValue: '',
                        variableName: '',
                        variableValue: '',
                        targetWorkflowName: '',
                      });
                    }}
                  >
                    <option value="add_tag">Add Tag</option>
                    <option value="remove_tag">Remove Tag</option>
                    <option value="assign_agent">Assign Agent</option>
                    <option value="set_variable">Set Variable</option>
                    <option value="start_workflow">Start Workflow</option>
                  </select>
                  
                  {selectedNode.data.actionType === 'assign_agent' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Agent Email or ID</label>
                      <input 
                         placeholder="agent@example.com" 
                         className="w-full border border-slate-300 rounded-md p-2 text-sm"
                         value={selectedNode.data.actionValue || ''}
                         onChange={(e) => updateNodeData('actionValue', e.target.value)}
                       />
                    </div>
                  ) : selectedNode.data.actionType === 'set_variable' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Variable Name</label>
                        <input 
                           placeholder="e.g. user_type" 
                           className="w-full border border-slate-300 rounded-md p-2 text-sm"
                           value={selectedNode.data.variableName || ''}
                           onChange={(e) => updateNodeData('variableName', e.target.value)}
                         />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Value</label>
                        <input 
                           placeholder="e.g. premium" 
                           className="w-full border border-slate-300 rounded-md p-2 text-sm"
                           value={selectedNode.data.variableValue || ''}
                           onChange={(e) => updateNodeData('variableValue', e.target.value)}
                         />
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'start_workflow' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Workflow to start</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const wf = availableWorkflows.find(
                            (w) => String(w.id) === String(value)
                          );
                          updateNodeFields(selectedNode.id, {
                            actionValue: value,
                            targetWorkflowName: wf ? wf.name : '',
                          });
                        }}
                      >
                        <option value="">Select workflow...</option>
                        {availableWorkflows.map((wf) => (
                          <option key={wf.id} value={wf.id}>
                            {wf.name}
                          </option>
                        ))}
                      </select>
                      {loadingWorkflows && (
                        <p className="text-[10px] text-slate-400">Loading workflows...</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Tag Name</label>
                      <input 
                         placeholder="e.g. VIP" 
                         className="w-full border border-slate-300 rounded-md p-2 text-sm"
                         value={selectedNode.data.actionValue || ''}
                         onChange={(e) => updateNodeData('actionValue', e.target.value)}
                       />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-auto p-4 border-t border-slate-100">
               <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                 setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                 setSelectedNode(null);
               }}>
                 Delete Node
               </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const DraggableBlock = ({ type, label, icon: Icon, color, onAdd, disabledDrag }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg ${
        disabledDrag ? 'cursor-pointer' : 'cursor-grab'
      } hover:border-blue-400 hover:shadow-sm transition-all`}
      onDragStart={disabledDrag ? undefined : (event) => onDragStart(event, type)}
      draggable={!disabledDrag}
      onClick={() => {
        if (onAdd) onAdd(type);
      }}
    >
      <div className={`p-2 rounded-md ${color} text-white`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
};
