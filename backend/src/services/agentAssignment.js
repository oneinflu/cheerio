'use strict';
const db = require('../../db');

/**
 * Find the best agent for assignment based on Round Robin (Least Recently Assigned)
 * and matching attributes.
 * 
 * @param {Object} conditions - Filter conditions (e.g., { course: 'CPA', language: 'English' })
 * @param {string} [teamId] - Optional team ID to filter by
 * @returns {Promise<string|null>} - Returns the user ID of the assigned agent, or null if no match.
 */
async function findAgentForAssignment(conditions = {}, teamId = null) {
  const { course, language } = conditions;
  
  // Build the query
  // We want to find agents who match the criteria.
  // We order by their last assignment time (ascending) to pick the one waiting longest.
  // Users with NO assignments (NULL) come first (NULLS FIRST).
  
  const params = [];
  let paramIndex = 1;
  
  let query = `
    SELECT u.id, MAX(ca.claimed_at) as last_assigned_at
    FROM users u
    LEFT JOIN conversation_assignments ca ON u.id = ca.assignee_user_id
    LEFT JOIN team_members tm ON u.id = tm.user_id
    WHERE u.active = true
      AND u.role IN ('agent', 'supervisor', 'admin')
  `;

  if (course) {
    query += ` AND (u.attributes->>'course' = $${paramIndex} OR u.attributes->'courses' ? $${paramIndex})`;
    params.push(course);
    paramIndex++;
  }

  if (language) {
    query += ` AND (u.attributes->>'language' = $${paramIndex} OR u.attributes->'languages' ? $${paramIndex})`;
    params.push(language);
    paramIndex++;
  }

  if (teamId) {
    query += ` AND tm.team_id = $${paramIndex}`;
    params.push(teamId);
    paramIndex++;
  }

  query += `
    GROUP BY u.id
    ORDER BY last_assigned_at ASC NULLS FIRST
    LIMIT 1
  `;

  try {
    const res = await db.query(query, params);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    return null;
  } catch (err) {
    console.error('[AgentAssignment] Error finding agent:', err);
    return null;
  }
}

module.exports = {
  findAgentForAssignment
};
