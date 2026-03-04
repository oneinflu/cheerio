const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

/**
 * GET /api/labels
 * Returns all labels with contact counts.
 */
router.get('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT cl.id, cl.name, cl.created_at, COUNT(clm.contact_id)::int as assigned_count
            FROM contact_labels cl
            LEFT JOIN contact_label_maps clm ON cl.id = clm.label_id
            GROUP BY cl.id
            ORDER BY cl.name ASC
        `);
        res.json({ success: true, labels: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/labels/:id/contacts
 * Returns all contacts belonging to a label.
 */
router.get('/:id/contacts', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query(`
            SELECT c.id, c.external_id, c.display_name, c.created_at, ch.type as channel_type, ch.name as channel_name
            FROM contact_label_maps clm
            JOIN contacts c ON c.id = clm.contact_id
            JOIN channels ch ON ch.id = c.channel_id
            WHERE clm.label_id = $1
            ORDER BY c.display_name ASC
        `, [id]);
        res.json({ success: true, contacts: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/labels
 * Creates a new label. Optionally accepts contact_ids[] to assign immediately.
 */
router.post('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    const client = await db.getClient();
    try {
        const { name, contact_ids = [] } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        await client.query('BEGIN');

        const labelRes = await client.query(
            'INSERT INTO contact_labels (name) VALUES ($1) RETURNING *',
            [name.trim()]
        );
        const label = labelRes.rows[0];

        // Bulk-insert contact mappings if provided
        let insertedCount = 0;
        if (contact_ids.length > 0) {
            const values = contact_ids.map((cid, i) => `($1, $${i + 2})`).join(', ');
            const params = [label.id, ...contact_ids];
            const mapping = await client.query(
                `INSERT INTO contact_label_maps (label_id, contact_id) VALUES ${values} ON CONFLICT DO NOTHING`,
                params
            );
            insertedCount = mapping.rowCount;
        }

        await client.query('COMMIT');
        res.json({ success: true, label: { ...label, assigned_count: insertedCount } });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: 'Label name already exists' });
        next(err);
    } finally {
        client.release();
    }
});

/**
 * POST /api/labels/:id/contacts
 * Adds contacts to an existing label (array of contact UUIDs).
 */
router.post('/:id/contacts', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { contact_ids = [] } = req.body;

        if (!contact_ids.length) {
            return res.status(400).json({ error: 'contact_ids array is required' });
        }

        const values = contact_ids.map((cid, i) => `($1, $${i + 2})`).join(', ');
        const params = [id, ...contact_ids];
        await db.query(
            `INSERT INTO contact_label_maps (label_id, contact_id) VALUES ${values} ON CONFLICT DO NOTHING`,
            params
        );

        // Return updated count
        const countRes = await db.query(
            'SELECT COUNT(*)::int as total FROM contact_label_maps WHERE label_id = $1',
            [id]
        );
        res.json({ success: true, total: countRes.rows[0].total });
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /api/labels/:id
 * Deletes a label (and its mappings via CASCADE).
 */
router.delete('/:id', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM contact_labels WHERE id = $1 RETURNING id', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Label not found' });
        res.json({ success: true, deleted_id: id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
