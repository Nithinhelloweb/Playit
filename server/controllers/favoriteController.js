const User = require('../models/dynamodb/User');
const Song = require('../models/dynamodb/Song');

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
        const user = await User.findById(req.user.userId);

        // Check if already in favorites
        if (user.favorites && user.favorites.includes(songId)) {
            return res.status(400).json({ message: 'Song already in favorites' });
        }

        // Add to favorites
        const favorites = user.favorites || [];
        favorites.push(songId);

        await User.update(user.userId, { favorites });

        res.json({ message: 'Added to favorites', favorites });
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
        const user = await User.findById(req.user.userId);

        // Remove from favorites
        const favorites = (user.favorites || []).filter(id => id !== songId);

        await User.update(user.userId, { favorites });

        res.json({ message: 'Removed from favorites', favorites });
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
        const user = await User.findById(req.user.userId);
        const favoriteIds = user.favorites || [];

        // Fetch all favorite songs
        const favoriteSongs = [];
        for (const songId of favoriteIds) {
            const song = await Song.findById(songId);
            if (song) {
                favoriteSongs.push({
                    ...song,
                    _id: song.songId
                });
            }
        }

        res.json(favoriteSongs);
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
