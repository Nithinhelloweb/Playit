const User = require('../models/User');
const Song = require('../models/Song');

/**
 * Add song to favorites
 * POST /api/favorites/:songId
 * Requires authentication
 */
const addToFavorites = async (req, res) => {
    try {
        const songId = req.params.songId;

        // Check if song exists
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Get user
        const user = await User.findById(req.user._id);

        // Check if already in favorites
        if (user.favorites.includes(songId)) {
            return res.status(400).json({ message: 'Song already in favorites' });
        }

        // Add to favorites
        user.favorites.push(songId);
        await user.save();

        res.json({ message: 'Added to favorites', favorites: user.favorites });
    } catch (error) {
        console.error('Add to favorites error:', error);
        res.status(500).json({ message: 'Error adding to favorites' });
    }
};

/**
 * Remove song from favorites
 * DELETE /api/favorites/:songId
 * Requires authentication
 */
const removeFromFavorites = async (req, res) => {
    try {
        const songId = req.params.songId;

        // Get user
        const user = await User.findById(req.user._id);

        // Remove from favorites
        user.favorites = user.favorites.filter(id => id.toString() !== songId);
        await user.save();

        res.json({ message: 'Removed from favorites', favorites: user.favorites });
    } catch (error) {
        console.error('Remove from favorites error:', error);
        res.status(500).json({ message: 'Error removing from favorites' });
    }
};

/**
 * Get user's favorite songs
 * GET /api/favorites
 * Requires authentication
 */
const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('favorites');
        res.json(user.favorites);
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ message: 'Error fetching favorites' });
    }
};

module.exports = {
    addToFavorites,
    removeFromFavorites,
    getFavorites
};
