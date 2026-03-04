const express = require('express');
const router = express.Router();
const db = require('../../db');
const auth = require('../middlewares/auth');

/**
 * GET /api/labels
 * Returns all valid contact labels along with the count of contacts assigned.
 */
router.get('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const query = `
               SELECT cl.id, cl.name, cl.created_at, COUNT(clm.contact_id) as assigned_count
               FROM contact_labels cl
               LEFT JOIN contact_label_maps clm ON cl.id = clm.label_id
               GROUP BY cl.id
               ORDER BY cl.name ASC
           `;
        const result = await db.query(query);
        res.json({ success: true, labels: result.rows });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/labels
 * Creates a new contact label.
 */
router.post('/', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const result = await db.query(
            'INSERT INTO contact_labels (name) VALUES ($1) RETURNING *',
            [name.trim()]
        );

        // Return mapped structure to emulate existing array returns instantly
        res.json({
            success: true,
            label: { ...result.rows[0], assigned_count: 0 }
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Label name already exists' });
        }
        next(err);
    }
});

/**
 * DELETE /api/labels/:id
 * Deletes a contact label. Cascades deletion due to schema definition.
 */
router.delete('/:id', auth.requireRole('admin', 'agent', 'supervisor'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM contact_labels WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Label not found' });
        }

        res.json({ success: true, deleted_id: id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
