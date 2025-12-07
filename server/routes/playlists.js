const express = require('express');
const {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addSongToPlaylist,
    removeSongFromPlaylist,
    updatePlaylist,
    deletePlaylist
} = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Playlist routes
 * All routes require authentication
 */

// POST /api/playlists - Create playlist
router.post('/', protect, createPlaylist);

// GET /api/playlists - Get user playlists
router.get('/', protect, getUserPlaylists);

// GET /api/playlists/:id - Get playlist by ID
router.get('/:id', protect, getPlaylistById);

// POST /api/playlists/:id/songs - Add song to playlist
router.post('/:id/songs', protect, addSongToPlaylist);

// DELETE /api/playlists/:id/songs/:songId - Remove song from playlist
router.delete('/:id/songs/:songId', protect, removeSongFromPlaylist);

// PUT /api/playlists/:id - Update playlist (rename)
router.put('/:id', protect, updatePlaylist);

// DELETE /api/playlists/:id - Delete playlist
router.delete('/:id', protect, deletePlaylist);

module.exports = router;
