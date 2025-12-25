const express = require('express');
const {
    getAllSongs,
    getSongById,
    streamSong,
    searchSongs,
    downloadSong,
    addToRecentlyPlayed,
    getRecentlyPlayed,
    getAlbums
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

// PUT /api/songs/reorder - Update song order (admin only)
const { admin } = require('../middleware/auth');
router.put('/reorder', protect, admin, require('../controllers/songController').updateSongOrder);

// GET /api/songs/:id - Get song details (public) - MUST BE LAST
router.get('/:id', getSongById);

module.exports = router;
