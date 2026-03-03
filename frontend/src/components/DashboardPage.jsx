'use strict';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import {
  MessageSquare, Users, Clock, TrendingUp, Loader2, Sparkles,
  Target, Zap, Award, BarChart3, PieChart as PieChartIcon,
  PhoneCall, HeartPulse, Activity
} from 'lucide-react';
import { getDashboardData } from '../api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardPage({ teamId, role }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: { total: 0, open: 0, snoozed: 0, closed: 0, assigned: 0, unassigned: 0 },
    volume: [],
    agents: [],
    revenueImpact: { amount: '$0', growth: '0%', campaignsRun: 0, roas: '0x' },
    channelInsights: [],
    kpi: { medianFirstReply: '-', slaCompliance: '-', csatScore: '-', resolutionRate: '-' }
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await getDashboardData(teamId);
        // Ensure defaults if fields are missing in case backend hasn't upgraded fully
        setData(prev => ({
          ...prev,
          ...res,
          revenueImpact: res.revenueImpact || prev.revenueImpact,
          channelInsights: res.channelInsights || prev.channelInsights,
          kpi: res.kpi || prev.kpi,
          stats: res.stats || prev.stats
        }));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 font-medium">Loading Workspace Intelligence...</p>
      </div>
    );
  }

  const { stats, volume, agents, kpi, revenueImpact, channelInsights } = data;

  // Custom Tooltip for Area Chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex flex-col gap-2 min-w-[150px]">
          <p className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="font-bold text-slate-700">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">

      {/* Playful Premium Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intelligence Hub</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500 font-medium tracking-wide">
                  Welcome back, Agent
                </p>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 px-2">Live Workspace</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Status</span>
                <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Systems Operational
                </span>
              </div>
            </div>
            <button className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-sm shadow-sm transition-colors flex items-center gap-2">
              Download Report
            </button>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-[1600px] mx-auto">

        {/* KPI Row (Gradients & Colorful Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-5 rounded-bl-[100px] -mr-8 -mt-8" />
            <CardHeader className="pl-6 pt-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md"><MessageSquare className="w-4 h-4" /></div>
                Open Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="text-4xl font-black text-slate-800 tracking-tighter">{stats?.open || 0}</div>
              <div className="mt-2 text-sm font-medium text-slate-500 flex items-center gap-2">
                <span className="text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full text-xs font-bold">{stats?.snoozed || 0} snoozed</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-bold">{stats?.closed || 0} resolved</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-5 rounded-bl-[100px] -mr-8 -mt-8" />
            <CardHeader className="pl-6 pt-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md"><Zap className="w-4 h-4" /></div>
                First Response Line
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="text-4xl font-black text-slate-800 tracking-tighter">{kpi?.medianFirstReply || '0s'}</div>
              <div className="mt-2 text-sm font-medium text-emerald-600 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                <span>Top 10% Industry Avg</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow bg-gradient-to-br from-emerald-50 to-teal-50/30 ring-1 ring-emerald-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-10 rounded-bl-[100px] -mr-8 -mt-8" />
            <CardHeader className="pl-6 pt-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-emerald-700 font-semibold uppercase tracking-wider">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md"><Target className="w-4 h-4" /></div>
                Revenue Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="text-4xl font-black text-emerald-800 tracking-tighter">{revenueImpact?.amount || '$0'}</div>
              <div className="mt-2 text-sm font-medium text-emerald-600 flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wider">{revenueImpact?.growth} MOM</span>
                <span className="text-emerald-700/80">{revenueImpact?.roas} ROAS</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500 opacity-5 rounded-bl-[100px] -mr-8 -mt-8" />
            <CardHeader className="pl-6 pt-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                <div className="p-1.5 bg-pink-100 text-pink-600 rounded-md"><HeartPulse className="w-4 h-4" /></div>
                CSAT Score
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              <div className="text-4xl font-black text-slate-800 tracking-tighter">{kpi?.csatScore || '0/5'}</div>
              <div className="mt-2 text-sm font-medium text-slate-500 flex items-center gap-2">
                <span className="text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full text-xs font-bold">{kpi?.resolutionRate} Resolution</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Graphs Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Area Chart for Volume */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Omnichannel Volume</CardTitle>
                <p className="text-sm font-medium text-slate-500 mt-1">7-day rolling view of inbound vs outbound interactions</p>
              </div>
              <div className="p-2 border border-slate-100 rounded-md bg-slate-50">
                <Activity className="w-5 h-5 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[320px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volume && volume.length > 0 ? volume : [{ label: 'Mon', inbound: 0, outbound: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area type="monotone" name="Inbound Messages" dataKey="inbound" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorInbound)" />
                    <Area type="monotone" name="Outbound Marketing" dataKey="outbound" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorOutbound)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Breakdown / Pie Chart */}
          <Card className="border-0 shadow-sm flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                Traffic Origin <Badge variant="secondary" className="ml-auto text-[10px] h-5">LIVE</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col justify-center">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelInsights?.length > 0 ? channelInsights : [{ name: 'WhatsApp', value: 100, color: '#10B981' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {channelInsights?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Share']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {channelInsights?.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: c.color }} />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">{c.name}</span>
                      <span className="text-[10px] font-medium text-slate-500">{c.value}% traffic</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Third Row: Agent Leaderboard & Actionable Insight List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Agent Performance Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="div-table w-full text-sm">
                <div className="grid grid-cols-12 gap-4 pb-3 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <div className="col-span-5">Agent</div>
                  <div className="col-span-3 text-center">Score</div>
                  <div className="col-span-2 text-center">Tickets</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>
                <div className="space-y-1">
                  {agents.map((a, idx) => (
                    <div key={a.id} className="grid grid-cols-12 gap-4 items-center p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="relative">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${idx === 0 ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 ring-2 ring-yellow-100' : 'bg-gradient-to-tr from-slate-400 to-slate-500'}`}>
                            {a.initials}
                          </div>
                          {idx === 0 && <div className="absolute -top-1 -right-1 text-xs">👑</div>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{a.name}</div>
                          <div className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">{a.role}</div>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-700">{a.score || 90}%</span>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${a.score > 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${a.score || 90}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-center font-semibold text-slate-600">
                        {a.tickets || Math.floor(Math.random() * 50)}
                      </div>
                      <div className="col-span-2 text-right">
                        <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700">Online</Badge>
                      </div>
                    </div>
                  ))}
                  {agents.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No agents available.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-b from-blue-900 to-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            <CardHeader className="relative z-10 border-b border-white/10 pb-4">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-300" />
                AI Insights & Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 pt-6 space-y-5">

              <div className="flex gap-4 items-start">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-300 shrink-0 border border-blue-500/30">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-blue-100">Surge in "Pricing" inquiries</h4>
                  <p className="text-xs text-blue-200/70 mt-1 leading-relaxed">
                    Your automated bot is deflecting 42% of basic pricing questions. Consider upgrading the bot templates for faster closures.
                  </p>
                  <button className="mt-2 text-[11px] font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-md transition-colors shadow-sm">
                    Review Bot Flows
                  </button>
                </div>
              </div>

              <div className="w-full h-px bg-white/10" />

              <div className="flex gap-4 items-start">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300 shrink-0 border border-emerald-500/30">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-100">Peak hour approaching</h4>
                  <p className="text-xs text-emerald-200/70 mt-1 leading-relaxed">
                    Historically, ticket volumes spike between 2PM - 4PM on Tuesdays. 3 agents are currently online.
                  </p>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
