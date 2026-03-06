'use strict';

const db = require('../../db');

async function safeFirstRow(sql, params, fallback) {
  try {
    const res = await db.query(sql, params);
    return res.rows[0] || fallback;
  } catch (err) {
    console.error('[dashboard]', err.message);
    return fallback;
  }
}

async function safeRows(sql, params) {
  try {
    const res = await db.query(sql, params);
    return res.rows || [];
  } catch (err) {
    console.error('[dashboard]', err.message);
    return [];
  }
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

async function getConversationStats() {
  const res = await safeFirstRow(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE c.status = 'open')::int AS open,
      COUNT(*) FILTER (WHERE c.status = 'snoozed')::int AS snoozed,
      COUNT(*) FILTER (WHERE c.status = 'closed')::int AS closed,
      COUNT(*) FILTER (
        WHERE c.status = 'open' AND ca.assignee_user_id IS NOT NULL
      )::int AS assigned_open,
      COUNT(*) FILTER (
        WHERE c.status = 'open' AND ca.assignee_user_id IS NULL
      )::int AS unassigned_open
    FROM conversations c
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
  `, [], {
    total: 0,
    open: 0,
    snoozed: 0,
    closed: 0,
    assigned_open: 0,
    unassigned_open: 0,
  });
  return res;
}

async function getContactStats() {
  const res = await safeFirstRow(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d
    FROM contacts
  `, [], { total: 0, new_7d: 0 });
  return res;
}

async function getMessageVolume(days) {
  const res = await safeRows(
    `
      SELECT
        DATE(created_at) AS day,
        COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound,
        COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound
      FROM messages
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    [days]
  );

  const byDay = new Map();
  res.forEach((r) => {
    const key = toISODate(new Date(r.day));
    byDay.set(key, { inbound: r.inbound || 0, outbound: r.outbound || 0 });
  });

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = toISODate(d);
    const v = byDay.get(key) || { inbound: 0, outbound: 0 };
    out.push({ date: key, label: toLabel(d), inbound: v.inbound, outbound: v.outbound });
  }
  return out;
}

async function getMessageTotals(days) {
  const res = await safeFirstRow(
    `
      SELECT
        COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound,
        COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound
      FROM messages
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
    `,
    [days],
    { inbound: 0, outbound: 0 }
  );
  return res;
}

async function getChannelBreakdown(days) {
  const res = await safeRows(
    `
      SELECT ch.type::text AS channel_type, COUNT(*)::int AS count
      FROM messages m
      JOIN channels ch ON ch.id = m.channel_id
      WHERE m.created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY 1
      ORDER BY count DESC
    `,
    [days]
  );
  return res;
}

async function getAgents(days) {
  const res = await safeRows(
    `
      SELECT
        u.id,
        u.name,
        u.role::text AS role,
        (SELECT COUNT(*)::int
         FROM conversation_assignments ca
         JOIN conversations c ON c.id = ca.conversation_id
         WHERE ca.assignee_user_id = u.id
           AND ca.released_at IS NULL
           AND c.status = 'open') AS open_assigned,
        (SELECT COUNT(*)::int
         FROM messages m
         WHERE m.author_user_id = u.id
           AND m.direction = 'outbound'
           AND m.created_at >= NOW() - ($1::text || ' days')::interval) AS outbound_sent
      FROM users u
      ORDER BY open_assigned DESC, outbound_sent DESC, u.name ASC
      LIMIT 10
    `,
    [days]
  );
  return res.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    initials: String(u.name || 'U')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
    openAssigned: u.open_assigned || 0,
    outboundSent: u.outbound_sent || 0,
  }));
}

async function getCampaignSummary() {
  return safeFirstRow(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='draft')::int AS draft,
        COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status='running')::int AS running,
        COUNT(*) FILTER (WHERE status='completed')::int AS completed,
        COUNT(*) FILTER (WHERE status='stopped')::int AS stopped
      FROM campaigns
    `,
    [],
    { total: 0, draft: 0, scheduled: 0, running: 0, completed: 0, stopped: 0 }
  );
}

async function getRecentCampaigns(limit) {
  const res = await safeRows(
    `
      SELECT id, name, channel_type, status, total_contacts, sent_count, delivered_count, created_at, scheduled_at, started_at, completed_at
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return res;
}

async function getPaymentSummary() {
  return safeFirstRow(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='paid')::int AS paid,
        COUNT(*) FILTER (WHERE status='expired')::int AS expired,
        COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0)::float AS pending_amount,
        COALESCE(SUM(amount) FILTER (WHERE status='paid'), 0)::float AS paid_amount
      FROM payment_requests
    `,
    [],
    { total: 0, pending: 0, paid: 0, expired: 0, pending_amount: 0, paid_amount: 0 }
  );
}

async function getRecentPayments(limit) {
  const res = await safeRows(
    `
      SELECT id, amount, currency, request_type, status, created_at, updated_at
      FROM payment_requests
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return res;
}

async function getAutomationSummary() {
  const workflowsTotal = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM workflows`, [], { v: 0 });
  const workflowsActive = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM workflows WHERE status='active'`, [], { v: 0 });
  const waFlowsTotal = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM whatsapp_flows`, [], { v: 0 });
  const rulesTotal = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM automation_rules`, [], { v: 0 });
  const rulesActive = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM automation_rules WHERE is_active = TRUE`, [], { v: 0 });
  const emailTemplatesTotal = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM email_templates`, [], { v: 0 });
  const mediaAssetsTotal = await safeFirstRow(`SELECT COUNT(*)::int AS v FROM media_assets`, [], { v: 0 });

  return {
    workflows_total: workflowsTotal.v || 0,
    workflows_active: workflowsActive.v || 0,
    whatsapp_flows_total: waFlowsTotal.v || 0,
    rules_total: rulesTotal.v || 0,
    rules_active: rulesActive.v || 0,
    email_templates_total: emailTemplatesTotal.v || 0,
    media_assets_total: mediaAssetsTotal.v || 0,
  };
}

async function getCSAT() {
  const row = await safeFirstRow(
    `
      SELECT
        COUNT(*)::int AS total,
        AVG(score)::float AS average,
        COUNT(*) FILTER (WHERE score >= 4)::int AS positive
      FROM csat_scores
    `,
    [],
    { total: 0, average: 0, positive: 0 }
  );
  const total = row.total || 0;
  const positive = row.positive || 0;
  const average = total > 0 ? Number(row.average || 0).toFixed(1) : '0.0';
  const positiveRate = total > 0 ? Math.round((positive / total) * 100) : 0;
  return { total, average, positive, positiveRate };
}

async function getRecentConversations(limit) {
  const res = await safeRows(
    `
      SELECT
        c.id,
        c.status::text AS status,
        c.last_message_at,
        c.created_at,
        ch.type::text AS channel_type,
        ch.name AS channel_name,
        ct.display_name,
        ct.external_id,
        ca.assignee_user_id,
        u.name AS assignee_name
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      JOIN channels ch ON ch.id = c.channel_id
      LEFT JOIN conversation_assignments ca
        ON ca.conversation_id = c.id AND ca.released_at IS NULL
      LEFT JOIN users u ON u.id = ca.assignee_user_id
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT $1
    `,
    [limit]
  );
  return res;
}

async function getDashboard(teamId) {
  const days = 14;
  const [conversations, contacts, messageTotals, volume, channels, agents, campaigns, recentCampaigns, payments, recentPayments, automations, csat, recentConversations] =
    await Promise.all([
      getConversationStats(teamId),
      getContactStats(teamId),
      getMessageTotals(days),
      getMessageVolume(days),
      getChannelBreakdown(days),
      getAgents(7),
      getCampaignSummary(),
      getRecentCampaigns(8),
      getPaymentSummary(),
      getRecentPayments(8),
      getAutomationSummary(),
      getCSAT(),
      getRecentConversations(12),
    ]);

  return {
    conversations,
    contacts,
    messages: {
      days,
      totals: messageTotals,
      volume,
      channels,
    },
    agents,
    campaigns: {
      summary: campaigns,
      recent: recentCampaigns,
    },
    payments: {
      summary: payments,
      recent: recentPayments,
    },
    automations,
    csat,
    recentConversations,
  };
}

module.exports = { getDashboard };
