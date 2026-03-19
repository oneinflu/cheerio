'use strict';
const axios = require('axios');
const db = require('../../db');

/**
 * Get Exotel credentials for a team
 */
async function getCredentials(teamId) {
    if (!teamId) return null;
    try {
        const result = await db.query(
            'SELECT sid, api_key, api_token, subdomain, caller_id FROM exotel_settings WHERE team_id = $1 AND is_active = TRUE',
            [teamId]
        );
        if (result.rowCount > 0) return result.rows[0];
    } catch (err) {
        console.error('[Exotel] Error fetching credentials:', err.message);
    }
    return null;
}

/**
 * Build Exotel API base URL
 * Format: https://{api_key}:{api_token}@{subdomain}/v1/Accounts/{sid}/
 */
function buildBaseUrl(creds) {
    return `https://${creds.api_key}:${creds.api_token}@${creds.subdomain}/v1/Accounts/${creds.sid}`;
}

/**
 * Initiate an outbound call via Exotel
 * @param {Object} opts
 * @param {string} opts.teamId
 * @param {string} opts.from      - Agent's number or ExoPhone (virtual number)
 * @param {string} opts.to        - Customer's phone number
 * @param {string} opts.callerId  - ExoPhone / caller ID shown to customer (optional, falls back to settings)
 * @param {string} opts.statusCallbackUrl - URL for call status updates
 * @param {boolean} opts.record   - Whether to record the call
 */
async function initiateCall({ teamId, from, to, callerId, statusCallbackUrl, record = false }) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Exotel not configured for this team');

    const effectiveCallerId = callerId || creds.caller_id || from;
    const baseUrl = buildBaseUrl(creds);

    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('CallerId', effectiveCallerId);
    if (statusCallbackUrl) params.append('StatusCallback', statusCallbackUrl);
    if (record) params.append('Record', 'true');

    try {
        const response = await axios.post(`${baseUrl}/Calls/connect.json`, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const call = response.data?.Call;
        return {
            callSid: call?.Sid,
            status: call?.Status,
            from: call?.From,
            to: call?.To,
            dateCreated: call?.DateCreated
        };
    } catch (err) {
        const msg = err.response?.data?.RestException?.Message || err.message;
        console.error('[Exotel] initiateCall error:', msg);
        throw new Error(msg || 'Failed to initiate call');
    }
}

/**
 * Get details of a specific call
 */
async function getCallDetails(teamId, callSid) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Exotel not configured for this team');

    const baseUrl = buildBaseUrl(creds);
    try {
        const response = await axios.get(`${baseUrl}/Calls/${callSid}.json`);
        return response.data?.Call || null;
    } catch (err) {
        const msg = err.response?.data?.RestException?.Message || err.message;
        throw new Error(msg || 'Failed to fetch call details');
    }
}

/**
 * Get call logs with optional filters
 */
async function getCallLogs(teamId, { limit = 25, offset = 0 } = {}) {
    try {
        const result = await db.query(
            `SELECT ecl.*, c.name AS contact_name, c.external_id AS contact_phone
             FROM exotel_call_logs ecl
             LEFT JOIN contacts c ON c.id = ecl.contact_id
             WHERE ecl.team_id = $1
             ORDER BY ecl.created_at DESC
             LIMIT $2 OFFSET $3`,
            [teamId, limit, offset]
        );
        return result.rows;
    } catch (err) {
        console.error('[Exotel] getCallLogs error:', err.message);
        return [];
    }
}

/**
 * Save a call log entry to DB
 */
async function saveCallLog({ teamId, callSid, fromNumber, toNumber, direction, status, contactId, conversationId, initiatedBy }) {
    try {
        const result = await db.query(
            `INSERT INTO exotel_call_logs
             (team_id, call_sid, from_number, to_number, direction, status, contact_id, conversation_id, initiated_by, started_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING *`,
            [teamId, callSid, fromNumber, toNumber, direction || 'outbound', status || 'initiated', contactId || null, conversationId || null, initiatedBy || null]
        );
        return result.rows[0];
    } catch (err) {
        console.error('[Exotel] saveCallLog error:', err.message);
        return null;
    }
}

/**
 * Update a call log by call SID
 */
async function updateCallLog(callSid, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.duration !== undefined) { fields.push(`duration = $${idx++}`); values.push(updates.duration); }
    if (updates.recording_url !== undefined) { fields.push(`recording_url = $${idx++}`); values.push(updates.recording_url); }
    if (updates.ended_at !== undefined) { fields.push(`ended_at = $${idx++}`); values.push(updates.ended_at); }

    if (fields.length === 0) return;
    values.push(callSid);

    try {
        await db.query(
            `UPDATE exotel_call_logs SET ${fields.join(', ')} WHERE call_sid = $${idx}`,
            values
        );
    } catch (err) {
        console.error('[Exotel] updateCallLog error:', err.message);
    }
}

module.exports = {
    getCredentials,
    initiateCall,
    getCallDetails,
    getCallLogs,
    saveCallLog,
    updateCallLog
};
