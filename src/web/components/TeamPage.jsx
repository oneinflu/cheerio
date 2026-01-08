'use strict';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { UserPlus, UserMinus, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TeamPage({ conversations, agents, currentUser, onAssign, onUnassign }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = conversations.slice();
    if (!q) return base;
    return base.filter((c) => String(c.contactName || '').toLowerCase().includes(q));
  }, [conversations, query]);

  const agentsById = useMemo(() => {
    const m = new Map();
    for (const a of agents) m.set(a.id, a);
    return m;
  }, [agents]);

  const handleAssign = async (conversationId, assigneeUserId) => {
    setStatus(null);
    try {
      await onAssign(conversationId, assigneeUserId);
      const name = agentsById.get(assigneeUserId)?.name || 'Agent';
      setStatus({ type: 'success', message: `Assigned to ${name}` });
    } catch (e) {
      setStatus({ type: 'error', message: 'Assignment failed' });
    }
  };

  const handleUnassign = async (conversationId) => {
    setStatus(null);
    try {
      await onUnassign(conversationId);
      setStatus({ type: 'success', message: 'Conversation unassigned' });
    } catch (e) {
      setStatus({ type: 'error', message: 'Unassign failed' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Team</h1>
            <p className="text-sm text-slate-500">Assign and manage conversations</p>
          </div>
          <div className="w-full max-w-md">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input className="pl-9" placeholder="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-4">
        {status && (
          <div
            className={cn(
              'rounded-md border px-4 py-3 text-sm',
              status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
            )}
          >
            {status.message}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Active Conversations</span>
              <Badge variant="outline">{visible.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-4 font-medium">Contact</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Assignee</th>
                    <th className="py-2 pr-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((c) => {
                    const isAssigned = Boolean(c.assigneeUserId);
                    const canUnassign = currentUser.role === 'admin' || c.assigneeUserId === currentUser.id;
                    return (
                      <tr key={c.id} className="align-middle">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-slate-900">{c.contactName}</div>
                          <div className="text-xs text-slate-500">{c.id.slice(0, 8)}…</div>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={c.status === 'open' ? 'secondary' : 'outline'}>{c.status}</Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            className="h-10 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                            value={c.assigneeUserId || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (!value) return;
                              handleAssign(c.id, value);
                            }}
                          >
                            <option value="" disabled>
                              {isAssigned ? agentsById.get(c.assigneeUserId)?.name || 'Assigned' : 'Unassigned'}
                            </option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.role})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAssign(c.id, currentUser.id)}
                              disabled={c.assigneeUserId === currentUser.id}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Assign to me
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnassign(c.id)}
                              disabled={!isAssigned || !canUnassign}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Unassign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-500">
                        No conversations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

