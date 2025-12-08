const express = require('express');
const Song = require('../models/dynamodb/Song');
const { uploadFile, deleteFile } = require('../config/s3');
const { protect, admin } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Only image files are allowed (JPEG, PNG, WebP)'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max for images
    }
});

/**
 * Get all albums with their covers
 * GET /api/albums
 */
router.get('/', async (req, res) => {
    try {
        const songs = await Song.findAll();

        // Group by album and get unique albums with cover
        const albumMap = new Map();

        songs.forEach(song => {
            const albumName = song.album || 'Unknown Album';
            if (!albumMap.has(albumName)) {
                albumMap.set(albumName, {
                    name: albumName,
                    artist: song.artist,
                    coverImage: song.coverImage,
                    songCount: 0
                });
            }
            albumMap.get(albumName).songCount++;
        });

        const albums = Array.from(albumMap.values());
        res.json(albums);
    } catch (error) {
        console.error('Get albums error:', error);
        res.status(500).json({ message: 'Error fetching albums' });
    }
});

/**
 * Upload album cover
 * POST /api/albums/:albumName/cover
 * Requires admin authentication
 */
router.post('/:albumName/cover', protect, admin, upload.single('cover'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an image file' });
        }

        const albumName = decodeURIComponent(req.params.albumName);

        // Upload to S3
        const s3Key = `album-covers/${Date.now()}-${req.file.originalname}`;
        const coverUrl = await uploadFile(s3Key, req.file.buffer, req.file.mimetype);

        console.log(`✅ Album cover uploaded: ${coverUrl}`);

        // Update all songs with this album name
        const updatedCount = await Song.updateAlbumCover(albumName, coverUrl);

        res.json({
            message: `Album cover updated for ${updatedCount} songs`,
            coverUrl,
            albumName,
            updatedCount
        });
    } catch (error) {
        console.error('Upload album cover error:', error);
        res.status(500).json({
            message: 'Error uploading album cover',
            error: error.message
        });
    }
});

/**
 * Delete album cover
 * DELETE /api/albums/:albumName/cover
 * Requires admin authentication
 */
router.delete('/:albumName/cover', protect, admin, async (req, res) => {
    try {
        const albumName = decodeURIComponent(req.params.albumName);

        // Get one song from this album to get the S3 key
        const songs = await Song.findAll();
        const albumSong = songs.find(s => s.album === albumName);

        if (albumSong && albumSong.coverImage) {
            // Extract S3 key from URL
            const url = new URL(albumSong.coverImage);
            const s3Key = url.pathname.substring(1); // Remove leading /

            // Delete from S3
            try {
                await deleteFile(s3Key);
                console.log(`🗑️ Deleted album cover from S3: ${s3Key}`);
            } catch (err) {
                console.log('S3 delete error (file may not exist):', err.message);
            }
        }

        // Remove cover from all songs in album
        const updatedCount = await Song.updateAlbumCover(albumName, null);

        res.json({
            message: `Album cover removed from ${updatedCount} songs`,
            albumName,
            updatedCount
        });
    } catch (error) {
        console.error('Delete album cover error:', error);
        res.status(500).json({
            message: 'Error deleting album cover',
            error: error.message
        });
    }
});

module.exports = router;
