'use strict';

const db = require('../../db');

/**
 * Service: Dashboard
 * 
 * Provides aggregated analytics for the main dashboard.
 */

async function getStats(teamId) {
  // 1. Conversation Counts
  // We want: total, open, snoozed, assigned, unassigned
  // "open" usually means status='open'
  // "snoozed" means status='snoozed'
  // "assigned" means status='open' AND assigned_to is not null
  // "unassigned" means status='open' AND assigned_to is null
  
  // Note: Adjust logic if your definition of "open" work includes snoozed or not.
  // Based on the screenshot "3 open . 0 snoozed" implies they are separate buckets under "Open Work"
  
  const statsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'open') AS open_count,
      COUNT(*) FILTER (WHERE status = 'snoozed') AS snoozed_count,
      COUNT(*) FILTER (WHERE status = 'open' AND ca.assignee_user_id IS NOT NULL) AS assigned_count,
      COUNT(*) FILTER (WHERE status = 'open' AND ca.assignee_user_id IS NULL) AS unassigned_count
    FROM conversations c
    LEFT JOIN conversation_assignments ca
      ON ca.conversation_id = c.id AND ca.released_at IS NULL
    WHERE 1=1
    -- AND c.team_id = $1 -- Uncomment if team filtering is strict
  `;
  
  const res = await db.query(statsQuery);
  const row = res.rows[0];

  return {
    total: parseInt(row.open_count, 10) + parseInt(row.snoozed_count, 10), // Total "Active" work
    open: parseInt(row.open_count, 10),
    snoozed: parseInt(row.snoozed_count, 10),
    assigned: parseInt(row.assigned_count, 10),
    unassigned: parseInt(row.unassigned_count, 10)
  };
}

async function getVolume(teamId) {
  // Weekly Message Volume (Last 7 days)
  // Group by day of week
  // We want inbound messages only? Or total? Screenshot says "Message Volume", likely total or inbound.
  // Let's assume Inbound for "Workload".
  
  const volumeQuery = `
    SELECT
      to_char(created_at, 'Dy') as day_label,
      COUNT(*) as count
    FROM messages
    WHERE created_at >= NOW() - INTERVAL '7 days'
    -- AND direction = 'inbound' -- Optional: filter by direction
    GROUP BY 1, DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `;

  const res = await db.query(volumeQuery);
  
  // Map to format { label: 'Mon', value: 10 }
  // Ensure we have all 7 days? Or just return what we have.
  // The frontend likely expects an array.
  
  return res.rows.map(r => ({
    label: r.day_label,
    value: parseInt(r.count, 10)
  }));
}

async function getAgents(teamId) {
  // Query users table for real agents
  try {
    const res = await db.query(
      `SELECT id, name, role, email FROM users ORDER BY name ASC`
    );
    
    if (res.rows.length > 0) {
      return res.rows.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        initials: (u.name || 'User').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
      }));
    }
  } catch (err) {
    console.error('Error fetching agents from DB:', err.message);
  }

  // Fallback only if DB fails or is empty
  return [];
}

module.exports = {
  getStats,
  getVolume,
  getAgents
};
