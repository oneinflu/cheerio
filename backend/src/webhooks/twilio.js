'use strict';
const express = require('express');
const router = express.Router();
const twilio = require('../services/twilioClient');
const db = require('../../db');
const { triggerWorkflowsForEvent } = require('../services/workflows');

/**
 * POST /webhooks/twilio/sms
 * Twilio sends SMS status callbacks as URL-encoded form data
 */
router.post('/sms', async (req, res) => {
    try {
        const body = req.body || {};
        const sid = body.MessageSid;
        const status = (body.MessageStatus || '').toLowerCase();
        const from = body.From;
        const to = body.To;

        console.log(`[TwilioWebhook] SMS Sid=${sid} Status=${status} From=${from} To=${to}`);

        if (sid) {
            await twilio.updateLog(sid, { status });

            // Find team for workflow trigger
            const logRes = await db.query('SELECT team_id, to_number FROM twilio_logs WHERE sid = $1', [sid]);
            if (logRes.rowCount > 0) {
                const log = logRes.rows[0];
                if (status === 'delivered' && log.to_number) {
                    triggerWorkflowsForEvent('sms_delivered', log.to_number, {
                        sid, teamId: log.team_id
                    }).catch(() => {});
                }
                if (status === 'failed' && log.to_number) {
                    triggerWorkflowsForEvent('sms_failed', log.to_number, {
                        sid, teamId: log.team_id
                    }).catch(() => {});
                }
            }
        }

        res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (err) {
        console.error('[TwilioWebhook] SMS error:', err.message);
        res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
});

/**
 * POST /webhooks/twilio/call
 * Twilio sends call status callbacks as URL-encoded form data
 */
router.post('/call', async (req, res) => {
    try {
        const body = req.body || {};
        const sid = body.CallSid;
        const status = (body.CallStatus || '').toLowerCase();
        const from = body.From || body.Caller;
        const to = body.To || body.Called;
        const duration = parseInt(body.CallDuration || '0');
        const recordingUrl = body.RecordingUrl || null;

        console.log(`[TwilioWebhook] Call Sid=${sid} Status=${status} From=${from} To=${to}`);

        if (sid) {
            await twilio.updateLog(sid, {
                status,
                duration: duration || undefined,
                recording_url: recordingUrl || undefined
            });

            const logRes = await db.query('SELECT team_id, to_number, direction FROM twilio_logs WHERE sid = $1', [sid]);
            if (logRes.rowCount > 0) {
                const log = logRes.rows[0];
                const contactPhone = log.direction === 'inbound' ? from : log.to_number;
                const teamId = log.team_id;

                if (status === 'completed' && contactPhone) {
                    triggerWorkflowsForEvent('call_completed', contactPhone, {
                        sid, duration, recordingUrl, teamId, channel: 'twilio'
                    }).catch(() => {});
                }
                if (status === 'in-progress' && contactPhone) {
                    triggerWorkflowsForEvent('call_answered', contactPhone, {
                        sid, teamId, channel: 'twilio'
                    }).catch(() => {});
                }
                if (['failed', 'busy', 'no-answer'].includes(status) && contactPhone) {
                    triggerWorkflowsForEvent('call_failed', contactPhone, {
                        sid, status, teamId, channel: 'twilio'
                    }).catch(() => {});
                }
            } else {
                // Inbound call — find team by phone_number in twilio_settings
                const settingsRes = await db.query(
                    'SELECT team_id FROM twilio_settings WHERE phone_number = $1 AND is_active = TRUE LIMIT 1',
                    [to]
                );
                if (settingsRes.rowCount > 0) {
                    const teamId = settingsRes.rows[0].team_id;
                    await twilio.saveLog({
                        teamId, type: 'call', sid,
                        fromNumber: from, toNumber: to,
                        direction: 'inbound', status
                    });
                }
            }
        }

        // Return TwiML to keep Twilio happy
        res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (err) {
        console.error('[TwilioWebhook] Call error:', err.message);
        res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
});

module.exports = router;
