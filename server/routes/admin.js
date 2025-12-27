const express = require('express');
const {
    upload,
    uploadSong,
    editSong,
    deleteSong,
    getAllUsers,
    deleteUser,
    getPendingSongs,
    approveSong
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

/**
 * Admin routes
 * All routes require authentication and admin privileges
 */

// POST /api/admin/upload - Upload new song
router.post('/upload', protect, admin, upload.single('song'), uploadSong);

// GET /api/admin/pending-songs - Get pending user uploads
router.get('/pending-songs', protect, admin, getPendingSongs);

// PUT /api/admin/songs/:id/approve - Approve a user upload
router.put('/songs/:id/approve', protect, admin, approveSong);

// PUT /api/admin/songs/:id - Edit song metadata
router.put('/songs/:id', protect, admin, editSong);

// DELETE /api/admin/songs/:id - Delete song
router.delete('/songs/:id', protect, admin, deleteSong);

// GET /api/admin/users - Get all users
router.get('/users', protect, admin, getAllUsers);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', protect, admin, deleteUser);

module.exports = router;
