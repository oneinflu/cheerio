import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Activity, CreditCard, Loader2, Megaphone, MessageSquare, Users, Workflow } from 'lucide-react';
import { getDashboardData } from '../api';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

const CHANNEL_COLORS = {
  whatsapp: '#10B981',
  instagram: '#EC4899',
};

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  const cur = currency || 'INR';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage({ teamId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getDashboardData(teamId);
        setData(res);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId]);

  const channelPie = useMemo(() => {
    const rows = data?.messages?.channels || [];
    return rows.map((r) => ({
      name: r.channel_type,
      value: r.count,
      color: CHANNEL_COLORS[r.channel_type] || '#3B82F6',
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 font-medium">Loading dashboard…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
        <p className="text-slate-500 font-medium">Failed to load dashboard.</p>
      </div>
    );
  }

  const c = data.conversations || {};
  const contacts = data.contacts || {};
  const msgTotals = data.messages?.totals || {};
  const volume = data.messages?.volume || [];
  const csat = data.csat || {};
  const payments = data.payments?.summary || {};
  const campaigns = data.campaigns?.summary || {};
  const automations = data.automations || {};

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Live metrics from your database</p>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live
            </span>
          </Badge>
        </div>
      </div>

      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-600" />
                Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{c.total || 0}</div>
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">{c.open || 0} open</span>
                <span className="px-2 py-1 rounded bg-yellow-50 text-yellow-700 font-semibold">{c.snoozed || 0} snoozed</span>
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">{c.closed || 0} closed</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">{c.assigned_open || 0} assigned</span>
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">{c.unassigned_open || 0} unassigned</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                Messages (14d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{(msgTotals.inbound || 0) + (msgTotals.outbound || 0)}</div>
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">{msgTotals.inbound || 0} inbound</span>
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">{msgTotals.outbound || 0} outbound</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <Users size={16} className="text-emerald-600" />
                Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{contacts.total || 0}</div>
              <div className="mt-2 text-xs text-slate-500">
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold">{contacts.new_7d || 0} new (7d)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600 flex items-center gap-2">
                <span className="text-pink-600 font-bold">★</span>
                CSAT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{csat.average || '0.0'}</div>
              <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-pink-50 text-pink-700 font-semibold">{csat.total || 0} responses</span>
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">{csat.positiveRate || 0}% ≥4</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                Message Volume (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volume} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#3B82F6" fillOpacity={1} fill="url(#inboundFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#10B981" fillOpacity={1} fill="url(#outboundFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800">Channels (14d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelPie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {channelPie.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1">
                {channelPie.map((ch) => (
                  <div key={ch.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: ch.color }} />
                      <span className="capitalize text-slate-700">{ch.name}</span>
                    </span>
                    <span className="font-semibold text-slate-800">{ch.value}</span>
                  </div>
                ))}
                {channelPie.length === 0 && <div className="text-sm text-slate-400">No message data</div>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Workflow size={16} className="text-slate-700" />
                Automations
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center justify-between"><span className="text-slate-600">Workflows</span><span className="font-semibold text-slate-900">{automations.workflows_active || 0} / {automations.workflows_total || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Rules</span><span className="font-semibold text-slate-900">{automations.rules_active || 0} / {automations.rules_total || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">WhatsApp Flows</span><span className="font-semibold text-slate-900">{automations.whatsapp_flows_total || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Email Templates</span><span className="font-semibold text-slate-900">{automations.email_templates_total || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Media Assets</span><span className="font-semibold text-slate-900">{automations.media_assets_total || 0}</span></div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Megaphone size={16} className="text-indigo-600" />
                Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center justify-between"><span className="text-slate-600">Total</span><span className="font-semibold text-slate-900">{campaigns.total || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Scheduled</span><span className="font-semibold text-slate-900">{campaigns.scheduled || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Running</span><span className="font-semibold text-slate-900">{campaigns.running || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Completed</span><span className="font-semibold text-slate-900">{campaigns.completed || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Stopped</span><span className="font-semibold text-slate-900">{campaigns.stopped || 0}</span></div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-600" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center justify-between"><span className="text-slate-600">Pending</span><span className="font-semibold text-slate-900">{payments.pending || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Paid</span><span className="font-semibold text-slate-900">{payments.paid || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Expired</span><span className="font-semibold text-slate-900">{payments.expired || 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Pending Amount</span><span className="font-semibold text-slate-900">{formatMoney(payments.pending_amount, 'INR')}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Paid Amount</span><span className="font-semibold text-slate-900">{formatMoney(payments.paid_amount, 'INR')}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800">Recent Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500 border-b">
                    <tr>
                      <th className="py-2 text-left">Contact</th>
                      <th className="py-2 text-left">Channel</th>
                      <th className="py-2 text-left">Status</th>
                      <th className="py-2 text-left">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data.recentConversations || []).map((r) => (
                      <tr key={r.id}>
                        <td className="py-2">
                          <div className="font-semibold text-slate-800">{r.display_name || r.external_id}</div>
                          <div className="text-xs text-slate-500">{r.external_id}</div>
                        </td>
                        <td className="py-2 capitalize text-slate-700">{r.channel_type}</td>
                        <td className="py-2">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold capitalize">{r.status}</span>
                        </td>
                        <td className="py-2 text-slate-700">{r.assignee_name || '—'}</td>
                      </tr>
                    ))}
                    {(data.recentConversations || []).length === 0 && (
                      <tr>
                        <td className="py-6 text-center text-slate-400" colSpan={4}>No conversations</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800">Agent Workload (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data.agents || []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0">{a.initials}</div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{a.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{a.role}</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <div><span className="font-semibold text-slate-900">{a.openAssigned}</span> open</div>
                      <div><span className="font-semibold text-slate-900">{a.outboundSent}</span> sent</div>
                    </div>
                  </div>
                ))}
                {(data.agents || []).length === 0 && <div className="text-sm text-slate-400">No agents</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
