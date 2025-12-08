const Playlist = require('../models/dynamodb/Playlist');
const Song = require('../models/dynamodb/Song');

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
            userId: req.user.userId
        });

        // Add _id for backward compatibility
        res.status(201).json({
            ...playlist,
            _id: playlist.playlistId,
            user: playlist.userId
        });
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
        const playlists = await Playlist.findByUser(req.user.userId);

        // Map to include _id for backward compatibility
        const playlistsWithId = playlists.map(playlist => ({
            ...playlist,
            _id: playlist.playlistId,
            user: playlist.userId,
            songs: playlist.songs.map(song => ({
                ...song,
                _id: song.songId
            }))
        }));

        res.json(playlistsWithId);
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
        const playlist = await Playlist.findById(req.params.id);

        if (!playlist) {
            return res.status(404).json({ message: 'Playlist not found' });
        }

        // Check if user owns the playlist
        if (playlist.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to access this playlist' });
        }

        // Add _id for backward compatibility
        res.json({
            ...playlist,
            _id: playlist.playlistId,
            user: playlist.userId,
            songs: playlist.songs.map(song => ({
                ...song,
                _id: song.songId
            }))
        });
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
        if (playlist.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        // Add song with denormalized data
        const updatedPlaylist = await Playlist.addSong(req.params.id, song);

        // Add _id for backward compatibility
        res.json({
            ...updatedPlaylist,
            _id: updatedPlaylist.playlistId,
            user: updatedPlaylist.userId,
            songs: updatedPlaylist.songs.map(s => ({
                ...s,
                _id: s.songId
            }))
        });
    } catch (error) {
        console.error('Add song to playlist error:', error);
        if (error.message === 'Song already in playlist') {
            return res.status(400).json({ message: error.message });
        }
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
        if (playlist.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        // Remove song
        const updatedPlaylist = await Playlist.removeSong(id, songId);

        // Add _id for backward compatibility
        res.json({
            ...updatedPlaylist,
            _id: updatedPlaylist.playlistId,
            user: updatedPlaylist.userId,
            songs: updatedPlaylist.songs.map(s => ({
                ...s,
                _id: s.songId
            }))
        });
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
        if (playlist.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to modify this playlist' });
        }

        // Update playlist
        const updatedPlaylist = await Playlist.update(req.params.id, {
            name,
            description
        });

        // Add _id for backward compatibility
        res.json({
            ...updatedPlaylist,
            _id: updatedPlaylist.playlistId,
            user: updatedPlaylist.userId,
            songs: updatedPlaylist.songs.map(s => ({
                ...s,
                _id: s.songId
            }))
        });
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
        if (playlist.userId !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized to delete this playlist' });
        }

        await Playlist.delete(req.params.id);
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
