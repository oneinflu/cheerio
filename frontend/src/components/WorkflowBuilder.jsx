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
import { Save, ArrowLeft, Plus, Clock, MessageSquare, GitBranch, Zap, StopCircle, Loader2, Play } from 'lucide-react';
import { getTemplates, runWorkflow } from '../api';

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
        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded mb-2 max-h-[100px] overflow-y-auto border border-slate-100 whitespace-pre-wrap">
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

const ActionNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Action" icon={Plus} colorClass="bg-indigo-600">
      <div className="text-xs text-slate-600">{data.action || 'Configure action'}</div>
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
  action: ActionNode,
  end: EndNode,
};

// --- Helper Functions ---

const getId = () => `node_${Date.now()}`;

// --- Main Component ---

export default function WorkflowBuilder({ onBack, onSave, initialWorkflow }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow?.steps?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.steps?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Test/Run State
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runPhoneNumber, setRunPhoneNumber] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  React.useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTemplates();
        if (res && res.data) {
          setTemplates(res.data.filter(t => t.status === 'APPROVED'));
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

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

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative">
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
            <DraggableBlock type="trigger" label="Trigger" icon={Zap} color="bg-purple-600" />
            <DraggableBlock type="send_template" label="Send Template" icon={MessageSquare} color="bg-green-600" />
            <DraggableBlock type="delay" label="Delay" icon={Clock} color="bg-orange-500" />
            <DraggableBlock type="condition" label="Condition" icon={GitBranch} color="bg-blue-600" />
            <DraggableBlock type="action" label="Action" icon={Plus} color="bg-indigo-600" />
            <DraggableBlock type="end" label="End" icon={StopCircle} color="bg-slate-600" />
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
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
                      const found = templates.find(t => t.name === tName);
                      let btns = [];
                      let content = '';

                      if (found && found.components) {
                        const btnComp = found.components.find(c => c.type === 'BUTTONS');
                        if (btnComp && btnComp.buttons) {
                           btns = btnComp.buttons.map(b => b.text);
                        }
                        
                        const bodyComp = found.components.find(c => c.type === 'BODY');
                        if (bodyComp && bodyComp.text) {
                           content = bodyComp.text;
                        }
                      }
                      
                      if (!selectedNode) return;
                      setNodes((nds) =>
                        nds.map((node) => {
                          if (node.id === selectedNode.id) {
                            const newData = { 
                              ...node.data, 
                              template: tName,
                              buttons: btns,
                              content: content
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
                    <div className="space-y-2">
                       <input 
                         placeholder="{{1}} value" 
                         className="w-full border border-slate-300 rounded-md p-2 text-sm"
                         onChange={(e) => updateNodeData('var1', e.target.value)}
                         value={selectedNode.data.var1 || ''}
                       />
                    </div>
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
                </div>
              )}

              {selectedNode.type === 'action' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Action</label>
                  <select 
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.actionType || 'add_tag'}
                    onChange={(e) => updateNodeData('actionType', e.target.value)}
                  >
                    <option value="add_tag">Add Tag</option>
                    <option value="remove_tag">Remove Tag</option>
                    <option value="assign_agent">Assign Agent</option>
                  </select>
                  
                  <input 
                     placeholder="Value (e.g. Tag Name)" 
                     className="w-full border border-slate-300 rounded-md p-2 text-sm"
                     value={selectedNode.data.actionValue || ''}
                     onChange={(e) => updateNodeData('actionValue', e.target.value)}
                   />
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

const DraggableBlock = ({ type, label, icon: Icon, color }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-grab hover:border-blue-400 hover:shadow-sm transition-all"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      <div className={`p-2 rounded-md ${color} text-white`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
};
