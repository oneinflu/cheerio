'use strict';
const axios = require('axios');
const db = require('../../db');

async function getCredentials(teamId) {
    if (!teamId) return null;
    try {
        const result = await db.query(
            'SELECT account_sid, auth_token, phone_number, messaging_service_sid FROM twilio_settings WHERE team_id = $1 AND is_active = TRUE',
            [teamId]
        );
        if (result.rowCount > 0) return result.rows[0];
    } catch (err) {
        console.error('[Twilio] Error fetching credentials:', err.message);
    }
    return null;
}

function buildBaseUrl(creds) {
    return `https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}`;
}

function basicAuth(creds) {
    return Buffer.from(`${creds.account_sid}:${creds.auth_token}`).toString('base64');
}

async function sendSms({ teamId, to, body, from }) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Twilio not configured for this team');

    const baseUrl = buildBaseUrl(creds);
    const params = new URLSearchParams();
    params.append('To', to);
    params.append('Body', body);
    if (from) {
        params.append('From', from);
    } else if (creds.messaging_service_sid) {
        params.append('MessagingServiceSid', creds.messaging_service_sid);
    } else {
        params.append('From', creds.phone_number);
    }

    try {
        const response = await axios.post(`${baseUrl}/Messages.json`, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth(creds)}`
            }
        });
        return {
            sid: response.data.sid,
            status: response.data.status,
            from: response.data.from,
            to: response.data.to,
            dateCreated: response.data.date_created
        };
    } catch (err) {
        const msg = err.response?.data?.message || err.message;
        console.error('[Twilio] sendSms error:', msg);
        throw new Error(msg || 'Failed to send SMS');
    }
}

async function initiateCall({ teamId, to, from, statusCallbackUrl, record = false }) {
    const creds = await getCredentials(teamId);
    if (!creds) throw new Error('Twilio not configured for this team');

    const baseUrl = buildBaseUrl(creds);
    const effectiveFrom = from || creds.phone_number;

    const params = new URLSearchParams();
    params.append('To', to);
    params.append('From', effectiveFrom);
    // Twilio requires a Url for TwiML instructions
    params.append('Url', 'http://demo.twilio.com/docs/voice.xml');
    if (statusCallbackUrl) {
        params.append('StatusCallback', statusCallbackUrl);
        params.append('StatusCallbackMethod', 'POST');
    }
    if (record) params.append('Record', 'true');

    try {
        const response = await axios.post(`${baseUrl}/Calls.json`, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth(creds)}`
            }
        });
        return {
            sid: response.data.sid,
            status: response.data.status,
            from: response.data.from,
            to: response.data.to,
            dateCreated: response.data.date_created
        };
    } catch (err) {
        const msg = err.response?.data?.message || err.message;
        console.error('[Twilio] initiateCall error:', msg);
        throw new Error(msg || 'Failed to initiate call');
    }
}

async function getLogs(teamId, { type, limit = 25, offset = 0 } = {}) {
    try {
        const conditions = ['tl.team_id = $1'];
        const values = [teamId];
        let idx = 2;
        if (type) {
            conditions.push(`tl.type = $${idx++}`);
            values.push(type);
        }
        values.push(limit, offset);
        const result = await db.query(
            `SELECT tl.*, c.name AS contact_name
             FROM twilio_logs tl
             LEFT JOIN contacts c ON c.id = tl.contact_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY tl.created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            values
        );
        return result.rows;
    } catch (err) {
        console.error('[Twilio] getLogs error:', err.message);
        return [];
    }
}

async function saveLog({ teamId, type, sid, fromNumber, toNumber, direction, status, body, contactId, conversationId, initiatedBy }) {
    try {
        const result = await db.query(
            `INSERT INTO twilio_logs
             (team_id, type, sid, from_number, to_number, direction, status, body, contact_id, conversation_id, initiated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [teamId, type || 'sms', sid, fromNumber, toNumber, direction || 'outbound', status || 'initiated', body || null, contactId || null, conversationId || null, initiatedBy || null]
        );
        return result.rows[0];
    } catch (err) {
        console.error('[Twilio] saveLog error:', err.message);
        return null;
    }
}

async function updateLog(sid, updates) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.duration !== undefined) { fields.push(`duration = $${idx++}`); values.push(updates.duration); }
    if (updates.recording_url !== undefined) { fields.push(`recording_url = $${idx++}`); values.push(updates.recording_url); }
    if (updates.price !== undefined) { fields.push(`price = $${idx++}`); values.push(updates.price); }
    if (fields.length === 0) return;
    fields.push(`updated_at = NOW()`);
    values.push(sid);
    try {
        await db.query(
            `UPDATE twilio_logs SET ${fields.join(', ')} WHERE sid = $${idx}`,
            values
        );
    } catch (err) {
        console.error('[Twilio] updateLog error:', err.message);
    }
}

module.exports = { getCredentials, sendSms, initiateCall, getLogs, saveLog, updateLog };
