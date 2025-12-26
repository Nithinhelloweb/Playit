const express = require('express');
const {
    getAllSongs,
    getSongById,
    streamSong,
    searchSongs,
    downloadSong,
    addToRecentlyPlayed,
    getRecentlyPlayed,
    getAlbums,
    userUpload,
    userUploadSong,
    getMyUploads,
    deleteMyUpload
} = require('../controllers/songController');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Song routes
 */

// GET /api/songs - Get all songs (public)
router.get('/', getAllSongs);

// GET /api/songs/search - Search songs (public)
router.get('/search', searchSongs);

// GET /api/songs/albums - Get all albums grouped (public)
router.get('/albums', getAlbums);

// GET /api/songs/stream/:id - Stream song (public)
router.get('/stream/:id', streamSong);

// GET /api/songs/download/:id - Download song (protected)
router.get('/download/:id', protect, downloadSong);

// POST /api/songs/recently-played/:id - Add to recently played (protected)
router.post('/recently-played/:id', protect, addToRecentlyPlayed);

// GET /api/songs/recently-played - Get recently played (protected)
router.get('/recently-played', protect, getRecentlyPlayed);

// POST /api/songs/upload - User song upload (protected, 50 limit)
// Wrapped with error handler for multer errors
router.post('/upload', protect, (req, res, next) => {
    userUpload.single('song')(req, res, (err) => {
        if (err) {
            // Multer error (file type, size, etc.)
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Maximum 50MB allowed.' });
            }
            return res.status(400).json({ message: err.message || 'File upload error' });
        }
        next();
    });
}, userUploadSong);

// GET /api/songs/my-uploads - Get user's uploaded songs (protected)
router.get('/my-uploads', protect, getMyUploads);

// DELETE /api/songs/my-uploads/:id - Delete user's own uploaded song (protected)
router.delete('/my-uploads/:id', protect, deleteMyUpload);

// PUT /api/songs/reorder - Update song order (admin only)
const { admin } = require('../middleware/auth');
router.put('/reorder', protect, admin, require('../controllers/songController').updateSongOrder);

// GET /api/songs/:id - Get song details (public) - MUST BE LAST
router.get('/:id', getSongById);

module.exports = router;
