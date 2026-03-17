import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CreditCard, Megaphone, MessageSquare, Users, Workflow, TrendingUp, Star } from 'lucide-react';
import { getDashboardData } from '../api';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';

const CHANNEL_COLORS = {
  whatsapp: '#00C853',
  instagram: '#EC4899',
  telegram: '#229ED9',
};

function formatMoney(amount, currency) {
  const n = Number(amount || 0);
  const cur = currency || 'INR';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
}

/* ── Reusable light card ─────────────────────────────────── */
function LCard({ children, className = '', accent, id }) {
  return (
    <div
      id={id}
      className={className}
      style={{
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {accent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
      )}
      {children}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────── */
function KpiCard({ id, icon: Icon, iconBg, iconColor, accent, label, value, chips }) {
  return (
    <LCard id={id} accent={accent}>
      <div style={{ padding: '20px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ background: iconBg, borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} style={{ color: iconColor }} />
          </div>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', lineHeight: 1, marginBottom: 14 }}>{value}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((chip, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: chip.bg, color: chip.color }}>
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </LCard>
  );
}

/* ── Custom tooltip ──────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: '#334155', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: <span style={{ color: '#0f172a' }}>{p.value}</span></p>
      ))}
    </div>
  );
}

/* ── Section header ──────────────────────────────────────── */
function SectionTitle({ icon: Icon, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ background: `${color}15`, borderRadius: 8, padding: 6, display: 'flex' }}>
        <Icon size={14} style={{ color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', letterSpacing: '0.02em' }}>{children}</span>
    </div>
  );
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
      color: CHANNEL_COLORS[r.channel_type] || '#6366f1',
    }));
  }, [data]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f8fafc' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#00C853', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
        <p style={{ color: '#64748b', fontWeight: 500 }}>Loading dashboard…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f8fafc' }}>
        <p style={{ color: '#94a3b8', fontWeight: 500 }}>Failed to load dashboard.</p>
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
    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 20, padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Dashboard</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, fontWeight: 500 }}>Live metrics from your workspace</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '5px 12px' }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.6 }} />
              <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-flex' }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Live</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1600, margin: '0 auto' }}>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard
            id="tour-kpi-conversations"
            icon={MessageSquare}
            iconBg="#eff6ff"
            iconColor="#3b82f6"
            accent="linear-gradient(90deg, #3b82f6, #6366f1)"
            label="Conversations"
            value={c.total || 0}
            chips={[
              { label: `${c.open || 0} open`, bg: '#eff6ff', color: '#2563eb' },
              { label: `${c.snoozed || 0} snoozed`, bg: '#fefce8', color: '#ca8a04' },
              { label: `${c.closed || 0} closed`, bg: '#f0fdf4', color: '#16a34a' },
            ]}
          />
          <KpiCard
            id="tour-kpi-messages"
            icon={Activity}
            iconBg="#f5f3ff"
            iconColor="#7c3aed"
            accent="linear-gradient(90deg, #7c3aed, #a855f7)"
            label="Messages (14d)"
            value={(msgTotals.inbound || 0) + (msgTotals.outbound || 0)}
            chips={[
              { label: `${msgTotals.inbound || 0} inbound`, bg: '#eff6ff', color: '#2563eb' },
              { label: `${msgTotals.outbound || 0} outbound`, bg: '#f0fdf4', color: '#16a34a' },
            ]}
          />
          <KpiCard
            id="tour-kpi-contacts"
            icon={Users}
            iconBg="#f0fdf4"
            iconColor="#16a34a"
            accent="linear-gradient(90deg, #16a34a, #00C853)"
            label="Contacts"
            value={contacts.total || 0}
            chips={[
              { label: `+${contacts.new_7d || 0} this week`, bg: '#f0fdf4', color: '#15803d' },
            ]}
          />
          <KpiCard
            id="tour-kpi-csat"
            icon={Star}
            iconBg="#fdf2f8"
            iconColor="#db2777"
            accent="linear-gradient(90deg, #db2777, #f472b6)"
            label="CSAT Score"
            value={csat.average || '—'}
            chips={[
              { label: `${csat.total || 0} responses`, bg: '#fdf2f8', color: '#be185d' },
              { label: `${csat.positiveRate || 0}% positive`, bg: '#f0fdf4', color: '#15803d' },
            ]}
          />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
          <LCard id="tour-volume-chart">
            <div style={{ padding: '20px 24px 0' }}>
              <SectionTitle icon={TrendingUp} color="#6366f1">Message Volume — Last 14 Days</SectionTitle>
            </div>
            <div style={{ height: 280, padding: '0 16px 16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C853" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#6366f1" fillOpacity={1} fill="url(#inboundFill)" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#00C853" fillOpacity={1} fill="url(#outboundFill)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </LCard>

          <LCard id="tour-channels-chart">
            <div style={{ padding: '20px 24px 0' }}>
              <SectionTitle icon={Activity} color="#ec4899">Channels (14d)</SectionTitle>
            </div>
            <div style={{ height: 180, padding: '0 8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={4} strokeWidth={0}>
                    {channelPie.map((e) => (
                      <Cell key={e.name} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ padding: '8px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {channelPie.map((ch) => (
                <div key={ch.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', textTransform: 'capitalize' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: ch.color, flexShrink: 0 }} />
                    {ch.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{ch.value}</span>
                </div>
              ))}
              {channelPie.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8' }}>No message data yet</p>}
            </div>
          </LCard>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {/* Automations */}
          <LCard id="tour-automations-card" accent="linear-gradient(90deg, #0f172a, #334155)">
            <div style={{ padding: '20px 24px' }}>
              <SectionTitle icon={Workflow} color="#334155">Automations</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Workflows', `${automations.workflows_active || 0} / ${automations.workflows_total || 0} active`],
                  ['Rules', `${automations.rules_active || 0} / ${automations.rules_total || 0} active`],
                  ['WhatsApp Flows', automations.whatsapp_flows_total || 0],
                  ['Email Templates', automations.email_templates_total || 0],
                  ['Media Assets', automations.media_assets_total || 0],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </LCard>

          {/* Campaigns */}
          <LCard id="tour-campaigns-card" accent="linear-gradient(90deg, #7c3aed, #a855f7)">
            <div style={{ padding: '20px 24px' }}>
              <SectionTitle icon={Megaphone} color="#7c3aed">Campaigns</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Total', campaigns.total || 0],
                  ['Scheduled', campaigns.scheduled || 0],
                  ['Running', campaigns.running || 0],
                  ['Completed', campaigns.completed || 0],
                  ['Stopped', campaigns.stopped || 0],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </LCard>

          {/* Payments */}
          <LCard id="tour-payments-card" accent="linear-gradient(90deg, #059669, #00C853)">
            <div style={{ padding: '20px 24px' }}>
              <SectionTitle icon={CreditCard} color="#059669">Payments</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Pending', payments.pending || 0],
                  ['Paid', payments.paid || 0],
                  ['Expired', payments.expired || 0],
                  ['Pending Amount', formatMoney(payments.pending_amount, 'INR')],
                  ['Paid Amount', formatMoney(payments.paid_amount, 'INR')],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </LCard>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Recent Conversations */}
          <LCard id="tour-recent-conversations">
            <div style={{ padding: '20px 24px 0' }}>
              <SectionTitle icon={MessageSquare} color="#3b82f6">Recent Conversations</SectionTitle>
            </div>
            <div style={{ padding: '0 24px 20px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['Contact', 'Channel', 'Status', 'Assignee'].map((h) => (
                      <th key={h} style={{ padding: '0 8px 10px 0', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.recentConversations || []).map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{r.display_name || r.external_id}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.external_id}</div>
                      </td>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', padding: '3px 8px', borderRadius: 99, background: CHANNEL_COLORS[r.channel_type] ? `${CHANNEL_COLORS[r.channel_type]}18` : '#f1f5f9', color: CHANNEL_COLORS[r.channel_type] || '#475569' }}>
                          {r.channel_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: r.status === 'open' ? '#eff6ff' : r.status === 'resolved' ? '#f0fdf4' : '#f8fafc', color: r.status === 'open' ? '#2563eb' : r.status === 'resolved' ? '#16a34a' : '#475569', textTransform: 'capitalize' }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0', color: '#475569', fontWeight: 500 }}>{r.assignee_name || '—'}</td>
                    </tr>
                  ))}
                  {!(data.recentConversations || []).length && (
                    <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8' }}>No recent conversations</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </LCard>

          {/* Agent Workload */}
          <LCard id="tour-agent-workload">
            <div style={{ padding: '20px 24px 0' }}>
              <SectionTitle icon={Users} color="#16a34a">Agent Workload (7d)</SectionTitle>
            </div>
            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(data.agents || []).map((a, i) => {
                const gradients = [
                  'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  'linear-gradient(135deg, #00C853, #0ea5e9)',
                  'linear-gradient(135deg, #f59e0b, #ef4444)',
                  'linear-gradient(135deg, #ec4899, #f43f5e)',
                  'linear-gradient(135deg, #0ea5e9, #6366f1)',
                ];
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: gradients[i % gradients.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {a.initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{a.role}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#eff6ff', color: '#2563eb' }}>{a.openAssigned} open</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a' }}>{a.outboundSent} sent</span>
                    </div>
                  </div>
                );
              })}
              {!(data.agents || []).length && <p style={{ fontSize: 13, color: '#94a3b8' }}>No agent data</p>}
            </div>
          </LCard>
        </div>

      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
