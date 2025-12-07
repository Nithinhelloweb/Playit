const Song = require('../models/Song');
const User = require('../models/User');
const multer = require('multer');
const { getGridFSBucket } = require('../utils/gridfs');
const { Readable } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Configure multer to use memory storage (buffer)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedMimes = [
            'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav',
            'audio/x-m4a', 'audio/flac', 'audio/x-flac'
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Only audio files are allowed (MP3, WAV, M4A, FLAC)'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max file size (FLAC files can be larger)
    }
});

// convertToFlac function removed


/**
 * Helper function to get audio duration from buffer using ffmpeg
 */
const getAudioDuration = async (buffer, mimetype) => {
    return new Promise((resolve, reject) => {
        // Create a temporary file to write the buffer
        const tempFile = path.join(os.tmpdir(), `audio-${Date.now()}.tmp`);

        try {
            // Write buffer to temporary file
            fs.writeFileSync(tempFile, buffer);

            // Use ffmpeg to get duration
            ffmpeg.ffprobe(tempFile, (err, metadata) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (cleanupErr) {
                    console.error('Error cleaning up temp file:', cleanupErr);
                }

                if (err) {
                    console.error('FFprobe error:', err);
                    resolve(0); // Return 0 on error rather than rejecting
                } else {
                    const duration = metadata.format.duration || 0;
                    resolve(Math.floor(duration));
                }
            });
        } catch (error) {
            console.error('Error in getAudioDuration:', error);
            // Clean up temp file if it exists
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupErr) {
                // Ignore cleanup errors
            }
            resolve(0);
        }
    });
};

/**
 * Upload new song
 * POST /api/admin/upload
 * Requires admin authentication
 * Audio files are stored in MongoDB GridFS
 */
const uploadSong = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Please upload an audio file' });
        }

        const { title, artist, album } = req.body;

        if (!title || !artist) {
            return res.status(400).json({ message: 'Title and artist are required' });
        }

        // Upload to GridFS
        console.log(`Uploading ${req.file.originalname} to GridFS...`);

        const bucket = getGridFSBucket();
        if (!bucket) {
            return res.status(500).json({ message: 'GridFS not initialized' });
        }

        const filename = `${Date.now()}-${req.file.originalname}`;

        // Create upload stream
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype,
            metadata: {
                originalName: req.file.originalname,
                uploadDate: new Date()
            }
        });

        // Write buffer to GridFS
        uploadStream.end(req.file.buffer);

        // Wait for upload to complete
        const gridfsId = await new Promise((resolve, reject) => {
            uploadStream.on('finish', () => {
                console.log(`✅ File uploaded to GridFS: ${uploadStream.id}`);
                resolve(uploadStream.id);
            });
            uploadStream.on('error', (error) => {
                console.error('❌ GridFS upload error:', error);
                reject(error);
            });
        });

        // Get audio duration from file
        console.log('Calculating audio duration...');
        const duration = await getAudioDuration(req.file.buffer, req.file.mimetype);
        console.log(`✅ Duration calculated: ${duration} seconds`);

        // Create song record with GridFS reference
        const song = await Song.create({
            title,
            artist,
            album: album || 'Unknown Album',
            duration: duration,
            gridfsId: gridfsId,
            mimeType: req.file.mimetype
        });

        res.status(201).json(song);
    } catch (error) {
        console.error('Upload song error:', error);
        res.status(500).json({ message: 'Error uploading song' });
    }
};


/**
 * Edit song metadata
 * PUT /api/admin/songs/:id
 * Requires admin authentication
 */
const editSong = async (req, res) => {
    try {
        const { title, artist, album, duration } = req.body;

        const song = await Song.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Update fields
        if (title) song.title = title;
        if (artist) song.artist = artist;
        if (album !== undefined) song.album = album;
        if (duration !== undefined) song.duration = duration;

        await song.save();
        res.json(song);
    } catch (error) {
        console.error('Edit song error:', error);
        res.status(500).json({ message: 'Error editing song' });
    }
};

/**
 * Delete song
 * DELETE /api/admin/songs/:id
 * Requires admin authentication
 */
const deleteSong = async (req, res) => {
    try {
        const song = await Song.findById(req.params.id);
        if (!song) {
            return res.status(404).json({ message: 'Song not found' });
        }

        // Delete file from GridFS
        if (song.gridfsId) {
            try {
                const bucket = getGridFSBucket();
                if (bucket) {
                    await bucket.delete(song.gridfsId);
                    console.log(`🗑️ File deleted from GridFS: ${song.gridfsId}`);
                }
            } catch (err) {
                console.log('File may not exist in GridFS:', err.message);
            }
        }

        // Delete from database
        await Song.findByIdAndDelete(req.params.id);

        res.json({ message: 'Song deleted successfully' });
    } catch (error) {
        console.error('Delete song error:', error);
        res.status(500).json({ message: 'Error deleting song' });
    }
};

/**
 * Get all users
 * GET /api/admin/users
 * Requires admin authentication
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 * Requires admin authentication
 */
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting admin users
        if (user.isAdmin) {
            return res.status(403).json({ message: 'Cannot delete admin users' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};

/**
 * Recalculate durations for all songs
 * POST /api/admin/recalculate-durations
 * Requires admin authentication
 */
const recalculateDurations = async (req, res) => {
    try {
        const songs = await Song.find({ duration: 0 });
        console.log(`Found ${songs.length} songs with 0 duration`);

        if (songs.length === 0) {
            return res.json({ message: 'No songs need duration update', updated: 0 });
        }

        const bucket = getGridFSBucket();
        if (!bucket) {
            return res.status(500).json({ message: 'GridFS not initialized' });
        }

        let updated = 0;
        let failed = 0;

        for (const song of songs) {
            try {
                if (!song.gridfsId) {
                    console.log(`⏭️  Skipping ${song.title} - no GridFS file`);
                    failed++;
                    continue;
                }

                // Download file from GridFS to buffer
                const chunks = [];
                const downloadStream = bucket.openDownloadStream(song.gridfsId);

                await new Promise((resolve, reject) => {
                    downloadStream.on('data', (chunk) => chunks.push(chunk));
                    downloadStream.on('end', resolve);
                    downloadStream.on('error', reject);
                });

                const buffer = Buffer.concat(chunks);

                // Calculate duration
                const duration = await getAudioDuration(buffer, song.mimeType);

                if (duration > 0) {
                    song.duration = duration;
                    await song.save();
                    console.log(`✅ Updated ${song.title}: ${duration}s`);
                    updated++;
                } else {
                    console.log(`⚠️  ${song.title}: duration is 0`);
                    failed++;
                }
            } catch (error) {
                console.error(`❌ Error processing ${song.title}:`, error.message);
                failed++;
            }
        }

        res.json({
            message: `Duration recalculation complete`,
            total: songs.length,
            updated,
            failed
        });
    } catch (error) {
        console.error('Recalculate durations error:', error);
        res.status(500).json({ message: 'Error recalculating durations' });
    }
};

module.exports = {
    upload,
    uploadSong,
    editSong,
    deleteSong,
    getAllUsers,
    deleteUser,
    recalculateDurations
};
