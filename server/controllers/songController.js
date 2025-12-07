const Song = require('../models/Song');
const RecentlyPlayed = require('../models/RecentlyPlayed');
const { getGridFSBucket } = require('../utils/gridfs');
const mongoose = require('mongoose');

/**
 * Get all songs
 * GET /api/songs
 */
const getAllSongs = async (req, res) => {
    try {
        const songs = await Song.find().sort({ createdAt: -1 });
        res.json(songs);
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

        res.json(song);
    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({ message: 'Error fetching song' });
    }
};

/**
 * Stream song file from Google Drive
 * GET /api/songs/stream/:id
 * Redirects to Google Drive direct download URL
 */
const streamSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Check if song has Google Drive URL
        if (song.googleDriveUrl) {
            // Redirect to Google Drive streaming URL
            return res.redirect(song.googleDriveUrl);
        }

        // Legacy support: if gridfsId exists, try GridFS
        if (song.gridfsId) {
            const bucket = getGridFSBucket();
            if (!bucket) {
                return res.status(500).json({ message: 'Storage not initialized' });
            }

            const files = await bucket.find({ _id: song.gridfsId }).toArray();
            if (!files || files.length === 0) {
                return res.status(404).json({ message: 'Audio file not found' });
            }

            const file = files[0];
            const fileSize = file.length;
            const range = req.headers.range;
            const contentType = song.mimeType || 'audio/mpeg';

            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                };
                res.writeHead(206, head);

                const downloadStream = bucket.openDownloadStream(song.gridfsId, {
                    start: start,
                    end: end + 1
                });
                downloadStream.pipe(res);
            } else {
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes'
                };
                res.writeHead(200, head);

                const downloadStream = bucket.openDownloadStream(song.gridfsId);
                downloadStream.pipe(res);
            }
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

        // Search in title, artist, and album fields
        const songs = await Song.find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { artist: { $regex: query, $options: 'i' } },
                { album: { $regex: query, $options: 'i' } }
            ]
        }).limit(50);

        res.json(songs);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Error searching songs' });
    }
};

/**
 * Download song from Google Drive
 * GET /api/songs/download/:id
 * Requires authentication
 */
const downloadSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);

        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Check if song has Google Drive URL
        if (song.googleDriveUrl) {
            // Redirect to Google Drive download URL
            return res.redirect(song.googleDriveUrl);
        }

        // Legacy support: if gridfsId exists, try GridFS
        if (song.gridfsId) {
            const bucket = getGridFSBucket();
            if (!bucket) {
                return res.status(500).json({ message: 'Storage not initialized' });
            }

            const files = await bucket.find({ _id: song.gridfsId }).toArray();
            if (!files || files.length === 0) {
                return res.status(404).json({ message: 'Audio file not found' });
            }

            const file = files[0];

            res.setHeader('Content-Disposition', `attachment; filename="${song.title} - ${song.artist}.flac"`);
            res.setHeader('Content-Type', song.mimeType || 'audio/flac');
            res.setHeader('Content-Length', file.length);

            const downloadStream = bucket.openDownloadStream(song.gridfsId);
            downloadStream.pipe(res);
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
        const userId = req.user._id;

        // Check if song exists
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Remove existing entry for this song (to avoid duplicates)
        await RecentlyPlayed.deleteOne({ user: userId, song: songId });

        // Add to recently played with current timestamp
        await RecentlyPlayed.create({
            user: userId,
            song: songId
        });

        // Keep only last 20 items per user
        const recentCount = await RecentlyPlayed.countDocuments({ user: userId });
        if (recentCount > 20) {
            const toRemove = await RecentlyPlayed.find({ user: userId })
                .sort({ playedAt: 1 })
                .limit(recentCount - 20);

            await RecentlyPlayed.deleteMany({
                _id: { $in: toRemove.map(item => item._id) }
            });
        }

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
        const userId = req.user._id;

        const recentlyPlayed = await RecentlyPlayed.find({ user: userId })
            .sort({ playedAt: -1 })
            .limit(20)
            .populate('song');

        res.json(recentlyPlayed);
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
        const songs = await Song.find().sort({ album: 1, title: 1 });

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
            album.songs.push(song);
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

module.exports = {
    getAllSongs,
    getSongById,
    streamSong,
    searchSongs,
    downloadSong,
    addToRecentlyPlayed,
    getRecentlyPlayed,
    getAlbums
};

