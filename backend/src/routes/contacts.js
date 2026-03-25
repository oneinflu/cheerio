const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
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
        const leadStage = req.query.leadStage || '';
        const course = req.query.course || '';
        const assignedTo = req.query.assignedTo || '';

        let countQuery = 'SELECT count(*) FROM contacts c';
        let dataQuery = `
        SELECT
          c.id, c.channel_id, c.external_id, c.display_name, c.profile, 
          c.lead_stage, c.course, c.assigned_to, c.email, c.lead_id, c.last_sync_at,
          c.created_at, c.updated_at,
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
        let whereClauses = [];

        if (search) {
            queryParams.push(`%${search}%`);
            whereClauses.push(`(c.display_name ILIKE $${queryParams.length} OR c.external_id ILIKE $${queryParams.length})`);
        }

        if (leadStage) {
            queryParams.push(leadStage);
            whereClauses.push(`c.lead_stage = $${queryParams.length}`);
        }

        if (course) {
            queryParams.push(course);
            whereClauses.push(`c.course = $${queryParams.length}`);
        }

        if (assignedTo) {
            queryParams.push(assignedTo);
            whereClauses.push(`c.assigned_to = $${queryParams.length}`);
        }

        if (whereClauses.length > 0) {
            const condition = ' WHERE ' + whereClauses.join(' AND ');
            countQuery += condition;
            dataQuery += condition;
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

// Global state to track background sync status
let syncStatus = {
    isRunning: false,
    totalLeads: 0,
    syncedLeads: 0,
    currentPage: 0,
    totalPages: 0,
    lastError: null,
    startTime: null,
    completedTime: null
};

/**
 * GET /api/contacts/sync/status
 * Returns current background sync status.
 */
router.get('/sync/status', auth.requireRole('admin', 'supervisor'), (req, res) => {
    res.json({ success: true, status: syncStatus });
});

/**
 * POST /api/contacts/sync
 * Starts a sync. If 'full' is provided, it runs in background.
 */
router.post('/sync', auth.requireRole('admin', 'supervisor'), async (req, res, next) => {
    try {
        const isFullSync = req.body.full === true;
        
        // Return if sync is already running
        if (isFullSync && syncStatus.isRunning) {
            return res.status(409).json({ success: false, message: 'A sync is already in progress' });
        }

        const page = parseInt(req.body.page) || 1;
        const limit = parseInt(req.body.limit) || 100;
        const authHeader = req.headers.authorization;

        // 1. Get/Create XOLOX channel (shared logic)
        const getChannel = async () => {
            const channelRes = await db.query("SELECT id FROM channels WHERE name = 'XOLOX' LIMIT 1");
            if (channelRes.rowCount > 0) return channelRes.rows[0].id;
            
            const newId = crypto.randomUUID();
            const res = await db.query(
                "INSERT INTO channels (id, name, type, external_id, active) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                [newId, 'XOLOX', 'whatsapp', 'xolox_external', true]
            );
            return res.rows[0].id;
        };

        const channelId = await getChannel();

        // Single Page Sync Logic (Immediate response)
        const syncPage = async (p, l) => {
            const xoloxUrl = `https://api.starforze.com/api/leads?page=${p}&limit=${l}`;
            const xRes = await axios.get(xoloxUrl, {
                headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                timeout: 30000
            });
            const data = xRes.data;
            if (!data.success || !data.data || !Array.isArray(data.data.data)) throw new Error('Invalid XOLOX response');
            
            let inserted = 0, updated = 0;
            for (const lead of data.data.data) {
                if (!lead.mobile) continue;
                const profile = {
                    leadId: lead.leadId,
                    leadSource: lead.leadSource,
                    xoloxData: lead
                };
                const leadStage = lead.leadStage;
                const courseName = lead.courseId?.name;
                const assignedTo = lead.assignedTo ? `${lead.assignedTo.firstname} ${lead.assignedTo.lastname}` : null;
                const lastSyncAt = new Date().toISOString();

                const upsertRes = await db.query(`
                    INSERT INTO contacts (channel_id, external_id, display_name, profile, lead_stage, course, assigned_to, last_sync_at, email, lead_id, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                    ON CONFLICT (channel_id, external_id) DO UPDATE SET 
                    display_name = EXCLUDED.display_name, 
                    profile = EXCLUDED.profile, 
                    lead_stage = EXCLUDED.lead_stage,
                    course = EXCLUDED.course,
                    assigned_to = EXCLUDED.assigned_to,
                    last_sync_at = EXCLUDED.last_sync_at,
                    email = EXCLUDED.email,
                    lead_id = EXCLUDED.lead_id,
                    updated_at = NOW()
                    RETURNING (xmax = 0) AS inserted;
                `, [channelId, lead.mobile, lead.name || 'Unknown', profile, leadStage, courseName, assignedTo, lastSyncAt, lead.email, lead.leadId]);
                if (upsertRes.rows[0]?.inserted) inserted++; else updated++;
            }
            return { total: data.data.count, processed: data.data.data.length, inserted, updated };
        };

        if (isFullSync) {
            // Start Background Full Sync
            syncStatus = { 
                isRunning: true, totalLeads: 0, syncedLeads: 0, currentPage: 0, totalPages: 0, 
                lastError: null, startTime: new Date().toISOString(), completedTime: null 
            };

            // Start the async loop without awaiting it
            (async () => {
                try {
                    console.log('[Sync] Background sync started...');
                    const first = await syncPage(1, 100);
                    syncStatus.totalLeads = first.total;
                    syncStatus.syncedLeads = first.inserted + first.updated;
                    syncStatus.totalPages = Math.ceil(first.total / 100);
                    syncStatus.currentPage = 1;

                    for (let p = 2; p <= syncStatus.totalPages; p++) {
                        const next = await syncPage(p, 100);
                        syncStatus.syncedLeads += (next.inserted + next.updated);
                        syncStatus.currentPage = p;
                        if (p % 10 === 0) console.log(`[Sync] Background Progress: ${syncStatus.syncedLeads}/${syncStatus.totalLeads} (${syncStatus.currentPage}/${syncStatus.totalPages})`);
                    }
                    syncStatus.completedTime = new Date().toISOString();
                } catch (err) {
                    console.error('[Sync] Background error:', err.message);
                    syncStatus.lastError = err.message;
                } finally {
                    syncStatus.isRunning = false;
                    console.log('[Sync] Background sync finished.');
                }
            })();

            return res.json({ success: true, message: 'Background sync started', status: syncStatus });
        } else {
            // Single page sync
            const result = await syncPage(page, limit);
            return res.json({ success: true, message: `Page ${page} synced`, data: result });
        }
    } catch (err) {
        console.error('[Sync] POST Error:', err);
        next(err);
    }
});

module.exports = router;



