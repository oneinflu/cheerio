'use strict';
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { MessageSquare, Users, Clock, TrendingUp } from 'lucide-react';

export default function DashboardPage({ conversations, agents }) {
  const stats = useMemo(() => {
    const total = conversations.length;
    const assigned = conversations.filter((c) => Boolean(c.assigneeUserId)).length;
    const unassigned = total - assigned;
    const open = conversations.filter((c) => c.status === 'open').length;
    const snoozed = conversations.filter((c) => c.status === 'snoozed').length;
    return { total, assigned, unassigned, open, snoozed };
  }, [conversations]);

  const volume = useMemo(
    () => [
      { label: 'Mon', value: 18 },
      { label: 'Tue', value: 25 },
      { label: 'Wed', value: 22 },
      { label: 'Thu', value: 31 },
      { label: 'Fri', value: 27 },
      { label: 'Sat', value: 12 },
      { label: 'Sun', value: 9 },
    ],
    []
  );

  const maxVolume = Math.max(...volume.map((v) => v.value));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Live overview with demo KPIs</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">WhatsApp</Badge>
            <Badge variant="outline">Demo Mode</Badge>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Open Work
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{stats.total}</div>
              <div className="mt-1 text-xs text-slate-500">{stats.open} open • {stats.snoozed} snoozed</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">{stats.assigned}</div>
              <div className="mt-1 text-xs text-slate-500">{stats.unassigned} unassigned</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Median First Reply
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">2m 14s</div>
              <div className="mt-1 text-xs text-slate-500">Demo KPI</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                SLA Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-slate-900">96%</div>
              <div className="mt-1 text-xs text-slate-500">Demo KPI</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Weekly Message Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-40">
                {volume.map((v) => (
                  <div key={v.label} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-md bg-blue-600/80"
                      style={{ height: `${Math.max(8, Math.round((v.value / maxVolume) * 160))}px` }}
                    />
                    <div className="text-[11px] text-slate-500">{v.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agents (Demo)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-700">
                        {a.initials}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{a.name}</div>
                        <div className="text-xs text-slate-500">{a.role}</div>
                      </div>
                    </div>
                    <Badge variant={a.role === 'admin' ? 'secondary' : 'outline'}>{a.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

