'use strict';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { getRules, createRule, updateRule, deleteRule, getWorkflows } from '../api';

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    event_type: 'message_text',
    match_value: '',
    action_type: 'send_message',
    message: '',
    workflow_id: '',
  });

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await getRules();
      if (Array.isArray(data)) {
        setRules(data);
        setError(null);
      } else {
        setRules([]);
        setError((data && (data.error || data.message)) || 'Failed to load rules');
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
      setError('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      setLoadingWorkflows(true);
      const data = await getWorkflows();
      if (Array.isArray(data)) {
        setWorkflows(data);
      } else {
        setWorkflows([]);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setWorkflows([]);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  useEffect(() => {
    loadRules();
    loadWorkflows();
  }, []);

  const openModal = (rule = null) => {
    if (rule) {
      const cfg = rule.action_config || {};
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        is_active: rule.is_active,
        event_type: rule.event_type,
        match_value: rule.match_value,
        action_type: rule.action_type,
        message: cfg.message || cfg.text || '',
        workflow_id: cfg.workflow_id || '',
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        is_active: true,
        event_type: 'message_text',
        match_value: '',
        action_type: 'send_message',
        message: '',
        workflow_id: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formData.name,
      description: formData.description || null,
      is_active: formData.is_active,
      event_type: formData.event_type,
      match_value: formData.match_value,
      action_type: formData.action_type,
      action_config:
        formData.action_type === 'send_message'
          ? { message: formData.message }
          : { workflow_id: formData.workflow_id },
    };

    try {
      if (editingRule) {
        await updateRule(editingRule.id, payload);
      } else {
        await createRule(payload);
      }
      closeModal();
      loadRules();
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await deleteRule(id);
      loadRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  if (loading && rules.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Automation Rules</h1>
            <p className="text-sm text-slate-500">
              Define simple rules like “if user says hi” or “course is CPA”.
            </p>
          </div>
          <Button onClick={() => openModal()}>
            <Plus size={16} className="mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200 border-dashed">
            <h3 className="text-lg font-medium text-slate-900">No rules yet</h3>
            <p className="text-slate-500 mt-1">
              Create your first rule to automate replies and workflows.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">When</th>
                  <th className="px-6 py-4">Then</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const cfg = rule.action_config || {};
                  const whenText =
                    rule.event_type === 'message_text'
                      ? `User message contains "${rule.match_value}"`
                      : `Course equals "${rule.match_value}"`;
                  const thenText =
                    rule.action_type === 'send_message'
                      ? `Send message: ${cfg.message || cfg.text || ''}`
                      : `Start workflow`;
                  const wf =
                    rule.action_type === 'start_workflow' &&
                    workflows.find((w) => String(w.id) === String(cfg.workflow_id));
                  return (
                    <tr key={rule.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-slate-500 text-xs mt-0.5 line-clamp-1">
                            {rule.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700 text-xs">{whenText}</td>
                      <td className="px-6 py-4 text-slate-700 text-xs">
                        {thenText}
                        {wf && (
                          <span className="ml-1 text-slate-500">
                            ({wf.name})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span
                          className={
                            rule.is_active
                              ? 'inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 border border-green-100'
                              : 'inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200'
                          }
                        >
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-500 hover:text-blue-600"
                            onClick={() =>
                              updateRule(rule.id, { is_active: !rule.is_active }).then(loadRules)
                            }
                          >
                            {rule.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-slate-500 hover:text-blue-600"
                            onClick={() => openModal(rule)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRule ? 'Edit Rule' : 'Create Rule'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Greet on hi"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional: explain what this rule does"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">When</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                value={formData.event_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    event_type: e.target.value,
                  })
                }
              >
                <option value="message_text">User message contains text</option>
                <option value="course_equals">Course equals value</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Match value
              </label>
              <Input
                required
                value={formData.match_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    match_value: e.target.value,
                  })
                }
                placeholder={
                  formData.event_type === 'message_text'
                    ? 'e.g. hi'
                    : 'e.g. CPA'
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Then</label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                value={formData.action_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    action_type: e.target.value,
                  })
                }
              >
                <option value="send_message">Send message</option>
                <option value="start_workflow">Start workflow</option>
              </select>
            </div>

            {formData.action_type === 'send_message' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Message to send
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      message: e.target.value,
                    })
                  }
                  placeholder="Type the reply message"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Workflow to start
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  value={formData.workflow_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      workflow_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select workflow...</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name}
                    </option>
                  ))}
                </select>
                {loadingWorkflows && (
                  <p className="text-[10px] text-slate-400">Loading workflows...</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_active: e.target.checked,
                  })
                }
              />
              Active
            </label>

            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit">
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

