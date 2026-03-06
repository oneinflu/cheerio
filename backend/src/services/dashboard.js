'use strict';

const db = require('../../db');

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
  const res = await db.query(`
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
  `);
  return res.rows[0];
}

async function getContactStats() {
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d
    FROM contacts
  `);
  return res.rows[0];
}

async function getMessageVolume(days) {
  const res = await db.query(
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
  res.rows.forEach((r) => {
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
  const res = await db.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE direction='inbound')::int AS inbound,
        COUNT(*) FILTER (WHERE direction='outbound')::int AS outbound
      FROM messages
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
    `,
    [days]
  );
  return res.rows[0];
}

async function getChannelBreakdown(days) {
  const res = await db.query(
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
  return res.rows;
}

async function getAgents(days) {
  const res = await db.query(
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
  return res.rows.map((u) => ({
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
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='draft')::int AS draft,
      COUNT(*) FILTER (WHERE status='scheduled')::int AS scheduled,
      COUNT(*) FILTER (WHERE status='running')::int AS running,
      COUNT(*) FILTER (WHERE status='completed')::int AS completed,
      COUNT(*) FILTER (WHERE status='stopped')::int AS stopped
    FROM campaigns
  `);
  return res.rows[0];
}

async function getRecentCampaigns(limit) {
  const res = await db.query(
    `
      SELECT id, name, channel_type, status, total_contacts, sent_count, delivered_count, created_at, scheduled_at, started_at, completed_at
      FROM campaigns
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

async function getPaymentSummary() {
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='pending')::int AS pending,
      COUNT(*) FILTER (WHERE status='paid')::int AS paid,
      COUNT(*) FILTER (WHERE status='expired')::int AS expired,
      COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0)::float AS pending_amount,
      COALESCE(SUM(amount) FILTER (WHERE status='paid'), 0)::float AS paid_amount
    FROM payment_requests
  `);
  return res.rows[0];
}

async function getRecentPayments(limit) {
  const res = await db.query(
    `
      SELECT id, amount, currency, request_type, status, created_at, updated_at
      FROM payment_requests
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

async function getAutomationSummary() {
  const res = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM workflows) AS workflows_total,
      (SELECT COUNT(*)::int FROM workflows WHERE status='active') AS workflows_active,
      (SELECT COUNT(*)::int FROM whatsapp_flows) AS whatsapp_flows_total,
      (SELECT COUNT(*)::int FROM automation_rules) AS rules_total,
      (SELECT COUNT(*)::int FROM automation_rules WHERE is_active = TRUE) AS rules_active,
      (SELECT COUNT(*)::int FROM email_templates) AS email_templates_total,
      (SELECT COUNT(*)::int FROM media_assets) AS media_assets_total
  `);
  return res.rows[0];
}

async function getCSAT() {
  const res = await db.query(`
    SELECT
      COUNT(*)::int AS total,
      AVG(score)::float AS average,
      COUNT(*) FILTER (WHERE score >= 4)::int AS positive
    FROM csat_scores
  `);
  const row = res.rows[0];
  const total = row.total || 0;
  const positive = row.positive || 0;
  const average = total > 0 ? Number(row.average || 0).toFixed(1) : '0.0';
  const positiveRate = total > 0 ? Math.round((positive / total) * 100) : 0;
  return { total, average, positive, positiveRate };
}

async function getRecentConversations(limit) {
  const res = await db.query(
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
  return res.rows;
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
