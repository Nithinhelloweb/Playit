const Playlist = require('../models/Playlist');
const Song = require('../models/Song');

/**
 * Create new playlist
 * POST /api/playlists
 * Requires authentication
 */
const createPlaylist = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Playlist name is required' });
        }

        const playlist = await Playlist.create({
            name,
            description: description || '',
            user: req.user._id,
            songs: []
        });

        res.status(201).json(playlist);
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ message: 'Error creating playlist' });
    }
};

/**
 * Get user playlists
 * GET /api/playlists
 * Requires authentication
 */
const getUserPlaylists = async (req, res) => {
    try {
        const playlists = await Playlist.find({ user: req.user._id })
            .populate('songs')
            .sort({ createdAt: -1 });

        res.json(playlists);
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ message: 'Error fetching playlists' });
    }
};

/**
 * Get playlist by ID
 * GET /api/playlists/:id
 * Requires authentication
 */
const getPlaylistById = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id).populate('songs');

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check if user owns the playlist
        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to access this playlist' });
        }

        res.json(playlist);
    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ message: 'Error fetching playlist' });
    }
};

/**
 * Add song to playlist
 * POST /api/playlists/:id/songs
 * Requires authentication
 */
const addSongToPlaylist = async (req, res) => {
    try {
        const { songId } = req.body;

        if (!songId) {
            return res.status(400).json({ message: 'Song ID is required' });
        }

        // Check if song exists
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Get playlist
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check ownership
        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        // Check if song already in playlist
        if (playlist.songs.includes(songId)) {
            return res.status(400).json({ message: 'Song already in playlist' });
        }

        // Add song
        playlist.songs.push(songId);
        await playlist.save();

        const updatedPlaylist = await Playlist.findById(playlist._id).populate('songs');
        res.json(updatedPlaylist);
    } catch (error) {
        console.error('Add song to playlist error:', error);
        res.status(500).json({ message: 'Error adding song to playlist' });
    }
};

/**
 * Remove song from playlist
 * DELETE /api/playlists/:id/songs/:songId
 * Requires authentication
 */
const removeSongFromPlaylist = async (req, res) => {
    try {
        const { id, songId } = req.params;

        const playlist = await Playlist.findById(id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check ownership
        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        // Remove song
        playlist.songs = playlist.songs.filter(s => s.toString() !== songId);
        await playlist.save();

        const updatedPlaylist = await Playlist.findById(playlist._id).populate('songs');
        res.json(updatedPlaylist);
    } catch (error) {
        console.error('Remove song from playlist error:', error);
        res.status(500).json({ message: 'Error removing song from playlist' });
    }
};

/**
 * Update playlist (rename)
 * PUT /api/playlists/:id
 * Requires authentication
 */
const updatePlaylist = async (req, res) => {
    try {
        const { name, description } = req.body;

        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check ownership
        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        if (name) playlist.name = name;
        if (description !== undefined) playlist.description = description;

        await playlist.save();

        const updatedPlaylist = await Playlist.findById(playlist._id).populate('songs');
        res.json(updatedPlaylist);
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ message: 'Error updating playlist' });
    }
};

/**
 * Delete playlist
 * DELETE /api/playlists/:id
 * Requires authentication
 */
const deletePlaylist = async (req, res) => {
    try {
        const playlist = await Playlist.findById(req.params.id);
        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check ownership
        if (playlist.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this playlist' });
        }

        await Playlist.findByIdAndDelete(req.params.id);
        res.json({ message: 'Playlist deleted successfully' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ message: 'Error deleting playlist' });
    }
};

module.exports = {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addSongToPlaylist,
    removeSongFromPlaylist,
    updatePlaylist,
    deletePlaylist
};
