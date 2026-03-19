'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../db');
const exotel = require('../services/exotelClient');
const { triggerWorkflowsForEvent } = require('../services/workflows');

/**
 * POST /webhooks/exotel/status
 * Exotel sends call status updates as URL-encoded form data
 * Fields: CallSid, From, To, Direction, Status, DialCallStatus,
 *         DialWhomNumber, StartTime, EndTime, Duration, RecordingUrl, etc.
 */
router.post('/status', async (req, res) => {
    try {
        const body = req.body || {};
        const callSid = body.CallSid;
        const status = (body.DialCallStatus || body.Status || '').toLowerCase();
        const from = body.From || body.CallFrom;
        const to = body.To || body.CallTo;
        const duration = parseInt(body.Duration || body.DialCallDuration || '0');
        const recordingUrl = body.RecordingUrl || null;
        const endTime = body.EndTime || null;

        console.log(`[ExotelWebhook] CallSid=${callSid} Status=${status} From=${from} To=${to}`);

        if (!callSid) {
            return res.status(200).send('OK'); // Acknowledge even if no callSid
        }

        // Find the call log by callSid to get teamId
        const logRes = await db.query(
            'SELECT * FROM exotel_call_logs WHERE call_sid = $1',
            [callSid]
        );

        if (logRes.rowCount > 0) {
            const log = logRes.rows[0];

            // Update call log with latest status
            await exotel.updateCallLog(callSid, {
                status,
                duration: duration || log.duration,
                recording_url: recordingUrl || log.recording_url,
                ended_at: ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)
                    ? (endTime ? new Date(endTime) : new Date())
                    : undefined
            });

            // Trigger workflows on call events
            const teamId = log.team_id;
            const contactPhone = log.to_number || to;

            if (status === 'completed' && contactPhone) {
                triggerWorkflowsForEvent('call_completed', contactPhone, {
                    callSid,
                    duration,
                    recordingUrl,
                    teamId,
                    direction: log.direction
                }).catch(err => console.error('[ExotelWebhook] workflow trigger error:', err.message));
            }

            if (status === 'in-progress' && contactPhone) {
                triggerWorkflowsForEvent('call_answered', contactPhone, {
                    callSid,
                    teamId,
                    direction: log.direction
                }).catch(err => console.error('[ExotelWebhook] workflow trigger error:', err.message));
            }

            if (['failed', 'busy', 'no-answer'].includes(status) && contactPhone) {
                triggerWorkflowsForEvent('call_failed', contactPhone, {
                    callSid,
                    status,
                    teamId,
                    direction: log.direction
                }).catch(err => console.error('[ExotelWebhook] workflow trigger error:', err.message));
            }
        } else {
            // Inbound call — not initiated via our system, so no log yet.
            // Try to find team by caller_id / ExoPhone in exotel_settings
            const settingsRes = await db.query(
                'SELECT team_id FROM exotel_settings WHERE caller_id = $1 AND is_active = TRUE LIMIT 1',
                [to]
            );
            if (settingsRes.rowCount > 0) {
                const teamId = settingsRes.rows[0].team_id;
                await exotel.saveCallLog({
                    teamId,
                    callSid,
                    fromNumber: from,
                    toNumber: to,
                    direction: 'inbound',
                    status
                });

                if (status === 'completed' && from) {
                    triggerWorkflowsForEvent('call_completed', from, {
                        callSid, duration, recordingUrl, teamId, direction: 'inbound'
                    }).catch(() => {});
                }
            }
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('[ExotelWebhook] Error:', err.message);
        res.status(200).send('OK'); // Always 200 to Exotel
    }
});

/**
 * POST /webhooks/exotel/passthru
 * Exotel passthru URL (for IVR / applet flows) — optional
 */
router.post('/passthru', async (req, res) => {
    console.log('[ExotelWebhook] Passthru:', JSON.stringify(req.body));
    // Return basic Exoml to play a message then hangup
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Our team will get back to you shortly.</Say>
  <Hangup/>
</Response>`);
});

module.exports = router;
