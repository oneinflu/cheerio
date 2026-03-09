import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import {
  getWorkflow,
  getWorkflowsKanban,
  reorderStageWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  deleteLeadStage,
  createLeadStage,
} from '../api';
import { Plus, X, GripVertical, MoreHorizontal } from 'lucide-react';

function CreateWorkflowModal({ isOpen, onClose, onSubmit, stageName }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name, description });
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-900">Create Workflow</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Follow-up"
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
            />
          </div>
          {stageName && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
              Adding to stage: <span className="font-medium text-slate-700">{stageName}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create Workflow'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateStageModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0f172a');
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), color: color || null, is_closed: isClosed });
      setName('');
      setColor('#0f172a');
      setIsClosed(false);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-900">Create Stage</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stage name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New, Contacted, Qualified"
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
            <input
              type="color"
              className="h-10 w-16 p-0 border border-slate-200 rounded"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isClosed} onChange={(e) => setIsClosed(e.target.checked)} />
            Closed stage
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create Stage'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditWorkflowModal({ isOpen, onClose, onSubmit, workflow }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || '');
      setDescription(workflow.description || '');
    }
  }, [workflow]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ ...workflow, name, description });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-900">Edit Workflow</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Follow-up"
              autoFocus
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkflowsKanban({ currentUser, onOpenBuilder }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    return ids[0] || null;
  }, [currentUser]);

  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [createModal, setCreateModal] = useState({ isOpen: false, stageId: null, stageName: null });
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [openStageMenuId, setOpenStageMenuId] = useState(null);
  const [openWorkflowMenuId, setOpenWorkflowMenuId] = useState(null);
  const [editWorkflow, setEditWorkflow] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getWorkflowsKanban(teamId);
      if (res && Array.isArray(res.columns)) {
        setColumns(res.columns);
        setError(null);
      } else {
        setColumns([]);
        setError('Failed to load kanban');
      }
    } catch (e) {
      setError('Failed to load kanban');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [teamId]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target && typeof e.target.closest === 'function') {
        if (e.target.closest('[data-kanban-menu]')) return;
      }
      setOpenStageMenuId(null);
      setOpenWorkflowMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDragStart = (workflowId, fromStageId) => {
    setDragItem({ workflowId, fromStageId });
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (toStageId, toIndex) => {
    if (!dragItem) return;
    const { workflowId, fromStageId } = dragItem;
    
    const newColumns = [...columns];
    const sourceCol = newColumns.find(c => c.stage.id === fromStageId);
    const destCol = newColumns.find(c => c.stage.id === toStageId);
    
    if (sourceCol && destCol) {
      const workflowIndex = sourceCol.workflows.findIndex(w => w.id === workflowId);
      if (workflowIndex > -1) {
        const [workflow] = sourceCol.workflows.splice(workflowIndex, 1);
        destCol.workflows.splice(toIndex, 0, workflow);
        setColumns(newColumns);
      }
    }

    const moves = [{ workflowId, toStageId, toPosition: toIndex + 1 }];
    try {
      await reorderStageWorkflows(moves);
    } catch (e) {
      console.error("Failed to save reorder", e);
      load();
    }
    setDragItem(null);
  };

  const openCreateModal = (stageId, stageName) => {
    setCreateModal({ isOpen: true, stageId, stageName });
  };

  const handleCreateSubmit = async (data) => {
    if (!createModal.stageId) return;
    await createWorkflow({
      ...data,
      stageId: createModal.stageId,
      status: 'active',
      steps: { nodes: [], edges: [], trigger: '' },
    });
    await load();
  };

  const handleDeleteStage = async (stage) => {
    const ok = window.confirm(`Delete stage "${stage.name}"?`);
    if (!ok) return;
    try {
      await deleteLeadStage(stage.id, teamId);
      setOpenStageMenuId(null);
      await load();
    } catch (e) {
      setError('Failed to delete stage');
    }
  };

  const handleCreateStageSubmit = async (payload) => {
    await createLeadStage(payload, teamId);
    await load();
  };

  const handleToggleWorkflowStatus = async (workflowId, nextStatus) => {
    try {
      await updateWorkflow(workflowId, { status: nextStatus });
      setColumns((prev) =>
        prev.map((c) => ({
          ...c,
          workflows: c.workflows.map((w) => (w.id === workflowId ? { ...w, status: nextStatus } : w)),
        }))
      );
      setOpenWorkflowMenuId(null);
    } catch (e) {
      setError('Failed to update workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    const ok = window.confirm('Delete this workflow?');
    if (!ok) return;
    try {
      await deleteWorkflow(workflowId);
      setOpenWorkflowMenuId(null);
      await load();
    } catch (e) {
      setError('Failed to delete workflow');
    }
  };

  const handleEditWorkflowSubmit = async (updatedData) => {
    try {
      await updateWorkflow(updatedData.id, {
        name: updatedData.name,
        description: updatedData.description
      });
      await load();
      setEditWorkflow(null);
    } catch (e) {
      setError('Failed to update workflow');
    }
  };

  const handleDuplicateWorkflow = async (stageId, workflowId) => {
    try {
      const wf = await getWorkflow(workflowId);
      const steps = wf && wf.steps ? wf.steps : { nodes: [], edges: [], trigger: '' };
      const nameBase = (wf && wf.name ? wf.name : 'Workflow').trim();
      const copyName = `${nameBase} (Copy)`;
      const created = await createWorkflow({
        name: copyName,
        description: (wf && wf.description) || '',
        status: 'inactive',
        steps,
        stageId,
      });
      setOpenWorkflowMenuId(null);
      await load();
      if (created && created.id && onOpenBuilder) {
        const createdFull = await getWorkflow(created.id);
        if (createdFull && createdFull.id) onOpenBuilder(createdFull);
      }
    } catch (e) {
      setError('Failed to duplicate workflow');
    }
  };

  if (loading && columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-medium">Loading Board...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
      <div className="border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="px-8 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Workflows Board</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your automation pipeline visually</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-6 h-full pb-2">
          {columns.map((col) => (
            <div key={col.stage.id} className="w-80 flex-shrink-0 flex flex-col h-full max-h-full">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm" 
                    style={{ backgroundColor: col.stage.color || '#0f172a' }}
                  />
                  <span className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                    {col.stage.name}
                  </span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {col.workflows.length}
                  </span>
                </div>
                <div className="relative" data-kanban-menu>
                  <button
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenStageMenuId((v) => (v === col.stage.id ? null : col.stage.id));
                      setOpenWorkflowMenuId(null);
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {openStageMenuId === col.stage.id && (
                    <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenStageMenuId(null);
                          setIsStageModalOpen(true);
                        }}
                      >
                        Add stage
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteStage(col.stage);
                        }}
                      >
                        Delete stage
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div 
                className="flex-1 bg-slate-100/50 rounded-xl border border-slate-200/60 p-2 flex flex-col gap-2 overflow-y-auto custom-scrollbar relative group"
                onDragOver={handleDragOver}
                onDrop={(e) => {
                   e.preventDefault();
                   handleDrop(col.stage.id, col.workflows.length);
                }}
              >
                {col.workflows.map((w, idx) => (
                  <div
                    key={w.id}
                    className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-200 transition-all group/card relative"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      handleDragStart(w.id, col.stage.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDrop(col.stage.id, idx);
                    }}
                    onClick={async () => {
                      try {
                        const wf = await getWorkflow(w.id);
                        if (wf && wf.id && onOpenBuilder) onOpenBuilder(wf);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-slate-800 text-sm leading-snug hover:text-blue-600 transition-colors">
                        {w.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="text-slate-300 group-hover/card:text-slate-400 cursor-move">
                          <GripVertical size={14} />
                        </div>
                        <div className="relative opacity-0 group-hover/card:opacity-100 transition-opacity" data-kanban-menu>
                          <button
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenWorkflowMenuId((v) => (v === w.id ? null : w.id));
                              setOpenStageMenuId(null);
                            }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {openWorkflowMenuId === w.id && (
                            <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditWorkflow(w);
                                  setOpenWorkflowMenuId(null);
                                }}
                              >
                                Edit details
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const nextStatus = w.status === 'active' ? 'inactive' : 'active';
                                  handleToggleWorkflowStatus(w.id, nextStatus);
                                }}
                              >
                                {w.status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDuplicateWorkflow(col.stage.id, w.id);
                                }}
                              >
                                Duplicate
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteWorkflow(w.id);
                                }}
                              >
                                Delete workflow
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {w.description && (
                      <div className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
                        {w.description}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 h-5 ${w.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500'}`}
                      >
                        {w.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                    </div>
                  </div>
                ))}

                {col.workflows.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50 m-1">
                    <span className="text-xs font-medium">No workflows</span>
                    <span className="text-[10px] opacity-70 mt-1">Drop here or create new</span>
                  </div>
                )}
                
                <button
                  onClick={() => openCreateModal(col.stage.id, col.stage.name)}
                  className="w-full py-2 flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg border border-transparent hover:border-blue-100 transition-all text-sm font-medium mt-auto shrink-0"
                >
                  <Plus size={16} />
                  <span>Add Workflow</span>
                </button>
              </div>
            </div>
          ))}
          
          <div className="w-80 flex-shrink-0 flex flex-col h-full opacity-60 hover:opacity-100 transition-opacity">
            <div className="h-10 mb-3"></div>
            <button 
              onClick={() => setIsStageModalOpen(true)}
              className="flex-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 flex flex-col items-center justify-center text-slate-500 transition-all gap-2"
            >
              <Plus size={24} />
              <span className="font-medium">Add New Stage</span>
            </button>
          </div>
        </div>
      </div>

      <CreateWorkflowModal 
        isOpen={createModal.isOpen} 
        onClose={() => setCreateModal({ ...createModal, isOpen: false })}
        onSubmit={handleCreateSubmit}
        stageName={createModal.stageName}
      />
      <CreateStageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        onSubmit={handleCreateStageSubmit}
      />
      <EditWorkflowModal 
        isOpen={!!editWorkflow}
        onClose={() => setEditWorkflow(null)}
        onSubmit={handleEditWorkflowSubmit}
        workflow={editWorkflow}
      />
    </div>
  );
}
