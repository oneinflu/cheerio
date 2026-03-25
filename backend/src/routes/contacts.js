const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');
const workflowSvc = require('../services/workflows');

/**
 * GET /api/contacts
 * Returns a paginated list of contacts with optional search.
 */
router.get('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let countQuery = 'SELECT count(*) FROM contacts';
        let dataQuery = `
      SELECT
        c.id, c.channel_id, c.external_id, c.display_name, c.profile, c.created_at, c.updated_at,
        ch.type as channel_type, ch.name as channel_name,
        lat.conversation_id,
        lat.assignee_id,
        lat.assignee_name
      FROM contacts c
      JOIN channels ch ON c.channel_id = ch.id
      LEFT JOIN LATERAL(
          SELECT 
            curr_conv.id as conversation_id,
            u.id as assignee_id,
            u.name as assignee_name
          FROM conversations curr_conv
          LEFT JOIN conversation_assignments ca ON ca.conversation_id = curr_conv.id AND ca.released_at IS NULL
          LEFT JOIN users u ON u.id = ca.assignee_user_id
          WHERE curr_conv.contact_id = c.id
          ORDER BY curr_conv.created_at DESC
          LIMIT 1
      ) lat ON true
    `;
        let queryParams = [];

        if (search) {
            countQuery += ' WHERE c.display_name ILIKE $1 OR c.external_id ILIKE $1';
            dataQuery += ' WHERE c.display_name ILIKE $1 OR c.external_id ILIKE $1';
            queryParams.push(`%${search}%`);
        }

        dataQuery += ` ORDER BY c.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2} `;

        const countRes = await db.query(countQuery, queryParams);
        const totalCount = parseInt(countRes.rows[0].count, 10);

        const dataParams = [...queryParams, limit, offset];
        const dataRes = await db.query(dataQuery, dataParams);

        return res.json({
            success: true,
            contacts: dataRes.rows,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/contacts
 * Adds a single contact manually
 */
router.post('/', auth.requireRole('admin', 'super_admin', 'quality_manager', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { channel_id, external_id, display_name, profile } = req.body;

        if (!channel_id || !external_id) {
            return res.status(400).json({ error: 'channel_id and external_id are required' });
        }

        const insertQuery = `
            INSERT INTO contacts(channel_id, external_id, display_name, profile)
        VALUES($1, $2, $3, $4)
        RETURNING *
            `;
        const result = await db.query(insertQuery, [channel_id, external_id, display_name || null, profile || {}]);
        const newContact = result.rows[0];

        // Fire new_contact workflows in background (non-blocking)
        workflowSvc.triggerContactCreatedWorkflows({
            id: newContact.id,
            external_id: newContact.external_id,
            name: newContact.display_name || '',
            phone: newContact.external_id || '',
            email: (newContact.profile && newContact.profile.email) || '',
            tags: (newContact.profile && newContact.profile.tags) || [],
            source: (newContact.profile && newContact.profile.source) || '',
            course: (newContact.profile && (newContact.profile.course || newContact.profile.courseName)) || '',
        }).catch(err => console.error('[ContactsRoute] Failed to trigger new_contact workflows:', err.message));

        return res.json({ success: true, contact: newContact });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Contact already exists on this channel' });
        }
        next(err);
    }
});

/**
 * GET /api/contacts/channels
 * Returns all active channels for use in dropdown selects.
 */
router.get('/channels', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, type, name, external_id FROM channels WHERE active = true ORDER BY name ASC`
        );
        return res.json({ success: true, channels: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/contacts/:id
 * Removes a contact and all cascading data (conversations, messages).
 */
router.delete('/:id', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM contacts WHERE id = $1', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Contact not found' });
        }

        return res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (err) {
        next(err);
    }
});

const axios = require('axios');
const crypto = require('crypto');

/**
 * POST /api/contacts/sync
 * Syncs contacts from XOLOX API for a specific page and limit.
 */
router.post('/sync', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 100;

        console.log(`[Sync] Starting sync for page ${page}, limit ${limit}`);

        // 1. Get/Create XOLOX channel
        let channelId;
        const channelRes = await db.query("SELECT id FROM channels WHERE name = 'XOLOX' LIMIT 1");
        if (channelRes.rowCount > 0) {
            channelId = channelRes.rows[0].id;
        } else {
            console.log('[Sync] XOLOX channel not found, creating one...');
            // The database only supports 'whatsapp' and 'instagram' for channel_type.
            // Using 'whatsapp' ensures compatibility with the ENUM.
            const newChannelId = crypto.randomUUID();
            const newChannelRes = await db.query(
                "INSERT INTO channels (id, name, type, external_id, active) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [newChannelId, 'XOLOX', 'whatsapp', 'xolox_external', true]
            );
            channelId = newChannelRes.rows[0].id;
        }

        // 2. Fetch from XOLOX
        const xoloxUrl = `https://api.starforze.com/api/leads?page=${page}&limit=${limit}`;
        let xData;
        try {
            // Forward the Bearer token from the original request
            const authHeader = req.headers.authorization;
            const xResponse = await axios.get(xoloxUrl, {
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': authHeader // Pass same token to XOLOX
                },
                timeout: 30000 // 30s timeout for large data
            });
            xData = xResponse.data;
        } catch (fetchErr) {
            console.error('[Sync] XOLOX API call failed:', fetchErr.message);
            return res.status(502).json({
                success: false,
                message: 'Failed to reach XOLOX API',
                error: fetchErr.message
            });
        }

        if (!xData.success || !xData.data || !Array.isArray(xData.data.data)) {
            console.error('[Sync] Invalid XOLOX response structure:', JSON.stringify(xData).substring(0, 200));
            return res.status(502).json({ 
                success: false, 
                message: 'Invalid response structure from XOLOX',
            });
        }

        const leads = xData.data.data;
        console.log(`[Sync] Processing ${leads.length} leads...`);
        const results = { updated: 0, created: 0, errors: 0 };

        // 3. Upsert into contacts
        for (const lead of leads) {
            try {
                const externalId = lead.mobile; 
                if (!externalId) continue;

                const displayName = lead.name || 'Unknown';
                const profile = {
                    email: lead.email,
                    leadId: lead.leadId,
                    leadStage: lead.leadStage,
                    course: lead.courseId?.name,
                    assignedTo: lead.assignedTo ? `${lead.assignedTo.firstname} ${lead.assignedTo.lastname}` : null,
                    leadSource: lead.leadSource,
                    leadSubSource: lead.leadSubSource,
                    studyMode: lead.studyMode,
                    syncedAt: new Date().toISOString(),
                    xoloxData: lead
                };

                const upsertQuery = `
                    INSERT INTO contacts (channel_id, external_id, display_name, profile, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (channel_id, external_id) 
                    DO UPDATE SET 
                        display_name = EXCLUDED.display_name,
                        profile = EXCLUDED.profile,
                        updated_at = NOW()
                    RETURNING (xmax = 0) AS inserted;
                `;
                const upsertRes = await db.query(upsertQuery, [channelId, externalId, displayName, profile]);
                
                if (upsertRes.rows[0]?.inserted) {
                    results.created++;
                } else {
                    results.updated++;
                }
            } catch (err) {
                results.errors++;
            }
        }

        console.log(`[Sync] Sync completed: Created ${results.created}, Updated ${results.updated}, Errors ${results.errors}`);

        return res.json({
            success: true,
            message: `Sync completed for page ${page}`,
            data: {
                totalInPage: leads.length,
                ...results,
                xoloxTotalCount: xData.data.count
            }
        });
    } catch (err) {
        console.error('[Sync] Fatal Error:', err);
        next(err);
    }
});

module.exports = router;


