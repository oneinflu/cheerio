'use strict';
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const folderName = process.env.CLOUDINARY_FOLDER || 'whatsapp_media';

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        return {
            folder: folderName,
            resource_type: 'auto',
            // Generate a unique filename if needed, or let Cloudinary handle it
        };
    },
});

const parser = multer({ storage: storage });

// Get Media by Resource Type (image, video, raw)
router.get('/', async (req, res) => {
    try {
        const resourceType = req.query.resource_type || 'image'; // image, video, raw (docs)

        // Using the Admin API to list resources in a folder immediately
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: folderName + '/',
            max_results: 100,
            resource_type: resourceType
        });

        res.json(result.resources);
    } catch (err) {
        console.error('Cloudinary fetching error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Upload Media
router.post('/upload', parser.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
        success: true,
        file: req.file,
        url: req.file.path,
        public_id: req.file.filename,
        resource_type: req.file.resource_type || 'auto'
    });
});

// Delete Media
router.delete('/', async (req, res) => {
    try {
        const { public_id, resource_type } = req.body;
        if (!public_id) return res.status(400).json({ error: 'public_id is required' });

        // Destroy needs resource_type to properly delete videos/raw
        const resType = resource_type || 'image';

        const result = await cloudinary.uploader.destroy(public_id, {
            invalidate: true,
            resource_type: resType
        });

        res.json({ success: true, result });
    } catch (err) {
        console.error('Cloudinary delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
