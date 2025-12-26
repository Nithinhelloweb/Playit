const Song = require('../models/dynamodb/Song');
const RecentlyPlayed = require('../models/dynamodb/RecentlyPlayed');
const { uploadFile, deleteFile } = require('../config/s3');
const multer = require('multer');

// Optional music-metadata import (may fail on serverless)
let mm = null;
try {
    mm = require('music-metadata');
} catch (e) {
    console.warn('music-metadata not available, duration extraction disabled');
}

// Configure multer for user uploads
const storage = multer.memoryStorage();
const userUpload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav', 'audio/x-m4a', 'audio/flac'];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Only audio files are allowed (MP3, WAV, M4A, FLAC)'));
        }
        cb(null, true);
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for users
});

const USER_UPLOAD_LIMIT = 50;
/**
 * Get all songs
 * GET /api/songs
 */
const getAllSongs = async (req, res) => {
    try {
        const songs = await Song.findAll();

        // Map to include _id for backward compatibility
        const songsWithId = songs.map(song => ({
            ...song,
            _id: song.songId
        }));

        res.json(songsWithId);
    } catch (error) {
        console.error('Get songs error:', error);
        res.status(500).json({ message: 'Error fetching songs' });
    }
};

/**
 * Get song by ID
 * GET /api/songs/:id
 */
const getSongById = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Add _id for backward compatibility
        res.json({
            ...song,
            _id: song.songId
        });
    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({ message: 'Error fetching song' });
    }
};

/**
 * Stream song file from S3
 * GET /api/songs/stream/:id
 * Redirects to S3 URL for streaming
 */
const streamSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Redirect to S3 URL for streaming
        if (song.s3Url) {
            return res.redirect(song.s3Url);
        } else {
            return res.status(404).json({ message: 'Audio file not found' });
        }
    } catch (error) {
        console.error('Stream song error:', error);
        res.status(500).json({ message: 'Error streaming song' });
    }
};

/**
 * Search songs
 * GET /api/search?q=query
 */
const searchSongs = async (req, res) => {
    try {
        const query = req.query.q;

        if (!query) {
            return res.json([]);
        }

        const songs = await Song.search(query);

        // Map to include _id for backward compatibility
        const songsWithId = songs.map(song => ({
            ...song,
            _id: song.songId
        }));

        res.json(songsWithId.slice(0, 50)); // Limit to 50 results
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Error searching songs' });
    }
};

/**
 * Download song from S3
 * GET /api/songs/download/:id
 * Requires authentication
 */
const downloadSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Redirect to S3 URL for download
        if (song.s3Url) {
            return res.redirect(song.s3Url);
        } else {
            return res.status(404).json({ message: 'Audio file not found' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Error downloading song' });
    }
};

/**
 * Add song to recently played
 * POST /api/recently-played/:id
 * Requires authentication
 */
const addToRecentlyPlayed = async (req, res) => {
    try {
        const songId = req.params.id;
        const userId = req.user.userId;

        // Check if song exists
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Add to recently played with denormalized song data
        await RecentlyPlayed.add(userId, song);

        res.json({ message: 'Added to recently played' });
    } catch (error) {
        console.error('Recently played error:', error);
        res.status(500).json({ message: 'Error updating recently played' });
    }
};

/**
 * Get recently played songs
 * GET /api/recently-played
 * Requires authentication
 */
const getRecentlyPlayed = async (req, res) => {
    try {
        const userId = req.user.userId;

        const recentlyPlayed = await RecentlyPlayed.findByUser(userId);

        // Map to expected format
        const formatted = recentlyPlayed.map(item => ({
            _id: item.recentlyPlayedId,
            user: userId,
            song: {
                ...item.songData,
                _id: item.songData.songId
            },
            playedAt: item.playedAt
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Get recently played error:', error);
        res.status(500).json({ message: 'Error fetching recently played' });
    }
};

/**
 * Get all albums (songs grouped by album name)
 * GET /api/songs/albums
 */
const getAlbums = async (req, res) => {
    try {
        // Get all songs
        const songs = await Song.findAll();

        // Group songs by album
        const albumMap = new Map();

        songs.forEach(song => {
            const albumName = song.album || 'Unknown Album';

            if (!albumMap.has(albumName)) {
                albumMap.set(albumName, {
                    name: albumName,
                    artist: song.artist,
                    coverImage: song.coverImage,
                    songs: [],
                    totalDuration: 0
                });
            }

            const album = albumMap.get(albumName);
            // Add _id for backward compatibility
            album.songs.push({
                ...song,
                _id: song.songId
            });
            album.totalDuration += song.duration || 0;

            // Use cover image from first song that has one
            if (!album.coverImage && song.coverImage) {
                album.coverImage = song.coverImage;
            }
        });

        // Convert map to array and add metadata
        const albums = Array.from(albumMap.values()).map(album => ({
            ...album,
            songCount: album.songs.length,
            // Get most common artist if multiple
            artist: album.songs.length > 0 ? album.songs[0].artist : 'Unknown Artist'
        }));

        // Sort by album name
        albums.sort((a, b) => a.name.localeCompare(b.name));

        res.json(albums);
    } catch (error) {
        console.error('Get albums error:', error);
        res.status(500).json({ message: 'Error fetching albums' });
    }
};

/**
 * Update song order
 * PUT /api/songs/reorder
 * Requires authentication
 */
const updateSongOrder = async (req, res) => {
    try {
        const { orderData } = req.body;

        if (!Array.isArray(orderData)) {
            return res.status(400).json({ message: 'Invalid order data' });
        }

        const updateCount = await Song.updateOrder(orderData);

        res.json({
            message: 'Song order updated successfully',
            updatedCount: updateCount
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Failed to update song order' });
    }
};

/**
 * User upload song
 * POST /api/songs/upload
 * Enforces 50-song limit per user (admin unlimited)
 */
const userUploadSong = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an audio file' });
        }

        const userId = req.user.userId;
        const isAdmin = req.user.isAdmin;
        const { title, artist, album, duration: clientDuration } = req.body;

        if (!title || !artist) {
            return res.status(400).json({ message: 'Title and artist are required' });
        }

        // Check upload limit (admin = unlimited)
        if (!isAdmin) {
            const count = await Song.countByUser(userId);
            if (count >= USER_UPLOAD_LIMIT) {
                return res.status(403).json({
                    message: `Upload limit reached. Maximum ${USER_UPLOAD_LIMIT} songs per user.`,
                    currentCount: count,
                    limit: USER_UPLOAD_LIMIT
                });
            }
        }

        // Use client-provided duration, or try server-side extraction as fallback
        let duration = parseInt(clientDuration) || 0;
        if (duration === 0 && mm) {
            try {
                const metadata = await mm.parseBuffer(req.file.buffer, req.file.mimetype);
                duration = Math.floor(metadata.format.duration || 0);
            } catch (metaErr) {
                console.error('Error getting duration:', metaErr);
            }
        }

        // Upload to S3
        const s3Key = `songs/${Date.now()}-${req.file.originalname}`;
        const s3Url = await uploadFile(s3Key, req.file.buffer, req.file.mimetype);

        // Create song record with uploadedBy
        const song = await Song.create({
            title,
            artist,
            album: album || 'Unknown Album',
            duration,
            s3Key,
            s3Url,
            mimeType: req.file.mimetype,
            uploadedBy: userId
        });

        // Get updated count
        const uploadCount = await Song.countByUser(userId);

        res.status(201).json({
            ...song,
            _id: song.songId,
            uploadCount,
            limit: isAdmin ? 'unlimited' : USER_UPLOAD_LIMIT
        });
    } catch (error) {
        console.error('User upload error:', error);
        res.status(500).json({ message: 'Error uploading song', error: error.message });
    }
};

/**
 * Get user's uploaded songs
 * GET /api/songs/my-uploads
 */
const getMyUploads = async (req, res) => {
    try {
        const userId = req.user.userId;
        const isAdmin = req.user.isAdmin;
        const songs = await Song.findByUser(userId);

        const songsWithId = songs.map(song => ({
            ...song,
            _id: song.songId
        }));

        res.json({
            songs: songsWithId,
            count: songs.length,
            limit: isAdmin ? 'unlimited' : USER_UPLOAD_LIMIT,
            remaining: isAdmin ? 'unlimited' : Math.max(0, USER_UPLOAD_LIMIT - songs.length)
        });
    } catch (error) {
        console.error('Get my uploads error:', error);
        res.status(500).json({ message: 'Error fetching uploads' });
    }
};

/**
 * Delete user's own uploaded song
 * DELETE /api/songs/my-uploads/:id
 * Users can only delete songs they uploaded
 */
const deleteMyUpload = async (req, res) => {
    try {
        const songId = req.params.id;
        const userId = req.user.userId;
        const isAdmin = req.user.isAdmin;

        // Get song to check ownership
        const song = await Song.findById(songId);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Check ownership (admin can delete any song)
        if (!isAdmin && song.uploadedBy !== userId) {
            return res.status(403).json({ message: 'You can only delete songs you uploaded' });
        }

        // Delete from S3 if file exists
        if (song.s3Key) {
            try {
                await deleteFile(song.s3Key);
            } catch (s3Error) {
                console.error('Error deleting from S3:', s3Error);
                // Continue with DB deletion even if S3 fails
            }
        }

        // Delete from database
        await Song.delete(songId);

        res.json({ message: 'Song deleted successfully' });
    } catch (error) {
        console.error('Delete my upload error:', error);
        res.status(500).json({ message: 'Error deleting song' });
    }
};

module.exports = {
    getAllSongs,
    getSongById,
    streamSong,
    searchSongs,
    downloadSong,
    addToRecentlyPlayed,
    getRecentlyPlayed,
    getAlbums,
    updateSongOrder,
    userUpload,
    userUploadSong,
    getMyUploads,
    deleteMyUpload
};
