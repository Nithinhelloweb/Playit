const express = require('express');
const {
    addToFavorites,
    removeFromFavorites,
    getFavorites
} = require('../controllers/favoriteController');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Favorites routes
 * All routes require authentication
 */

// POST /api/favorites/:songId - Add to favorites
router.post('/:songId', protect, addToFavorites);

// DELETE /api/favorites/:songId - Remove from favorites
router.delete('/:songId', protect, removeFromFavorites);

// GET /api/favorites - Get user favorites
router.get('/', protect, getFavorites);

module.exports = router;
