import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { getWorkflowsKanban, reorderStageWorkflows } from '../api';

export default function WorkflowsKanban({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    return ids[0] || null;
  }, [currentUser]);

  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragItem, setDragItem] = useState(null); // { workflowId, fromStageId }

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

  const handleDragStart = (workflowId, fromStageId) => {
    setDragItem({ workflowId, fromStageId });
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = async (toStageId, toIndex) => {
    if (!dragItem) return;
    const moves = [{ workflowId: dragItem.workflowId, toStageId, toPosition: toIndex }];
    await reorderStageWorkflows(moves);
    await load();
    setDragItem(null);
  };

  if (loading && columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <span className="text-slate-500 text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6">
          <h1 className="text-lg font-semibold text-slate-900">Workflows Kanban</h1>
          <p className="text-sm text-slate-500">Arrange workflows per lead stage. Drag to reorder or move.</p>
        </div>
      </div>
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-full">
          {columns.map((col) => (
            <div key={col.stage.id} className="w-72 flex-shrink-0">
              <div
                className="rounded-lg border shadow-sm overflow-hidden"
                style={{ borderColor: (col.stage.color || '#0f172a') + '33' }}
              >
                <div
                  className="px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: col.stage.color || '#0f172a' }}
                >
                  {col.stage.name}
                </div>
                <div
                  className="p-2 bg-slate-50 min-h-[200px]"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.stage.id, col.workflows.length + 1)}
                >
                  {col.workflows.map((w, idx) => (
                    <div
                      key={w.id}
                      className="bg-white rounded-md border border-slate-200 shadow-sm p-2 mb-2 cursor-move"
                      draggable
                      onDragStart={() => handleDragStart(w.id, col.stage.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(col.stage.id, idx + 1)}
                    >
                      <div className="text-sm font-medium text-slate-800">{w.name}</div>
                      {w.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{w.description}</div>
                      )}
                      <div className="mt-1">
                        <Badge variant={w.status === 'active' ? 'success' : 'secondary'}>{w.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {col.workflows.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-6">Drop workflows here</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

