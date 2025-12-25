const Song = require('../models/dynamodb/Song');
const User = require('../models/dynamodb/User');
const multer = require('multer');
const { uploadFile, deleteFile } = require('../config/s3');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Configure multer to use memory storage (buffer)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedMimes = [
            'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav',
            'audio/x-m4a', 'audio/flac', 'audio/x-flac',
            'video/mpeg', 'video/mp4' // MPEG files to be converted to MP3
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            return cb(new Error('Only audio files are allowed (MP3, WAV, M4A, FLAC, MPEG)'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max file size
    }
});

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
 * Helper function to convert MPEG video to MP3 audio
 */
const convertToMp3 = async (buffer, originalFilename) => {
    return new Promise((resolve, reject) => {
        const tempInputFile = path.join(os.tmpdir(), `input-${Date.now()}.tmp`);
        const tempOutputFile = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

        try {
            // Write buffer to temporary input file
            fs.writeFileSync(tempInputFile, buffer);
            console.log('🔄 Converting MPEG to MP3...');

            // Convert using ffmpeg
            ffmpeg(tempInputFile)
                .toFormat('mp3')
                .audioBitrate('192k') // Good quality MP3
                .on('end', () => {
                    try {
                        // Read the converted file
                        const mp3Buffer = fs.readFileSync(tempOutputFile);

                        // Clean up temp files
                        try {
                            fs.unlinkSync(tempInputFile);
                            fs.unlinkSync(tempOutputFile);
                        } catch (cleanupErr) {
                            console.error('Error cleaning up temp files:', cleanupErr);
                        }

                        console.log('✅ Conversion to MP3 completed');

                        // Return converted buffer and new filename
                        const newFilename = originalFilename.replace(/\.(mpeg|mpg|mp4)$/i, '.mp3');
                        resolve({
                            buffer: mp3Buffer,
                            filename: newFilename,
                            mimetype: 'audio/mpeg'
                        });
                    } catch (readErr) {
                        reject(new Error('Failed to read converted file: ' + readErr.message));
                    }
                })
                .on('error', (err) => {
                    // Clean up temp files
                    try {
                        if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
                        if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
                    } catch (cleanupErr) {
                        console.error('Error cleaning up temp files:', cleanupErr);
                    }
                    reject(new Error('Conversion failed: ' + err.message));
                })
                .save(tempOutputFile);
        } catch (error) {
            // Clean up temp files if they exist
            try {
                if (fs.existsSync(tempInputFile)) fs.unlinkSync(tempInputFile);
                if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
            } catch (cleanupErr) {
                console.error('Error cleaning up temp files:', cleanupErr);
            }
            reject(new Error('Conversion setup failed: ' + error.message));
        }
    });
};

/**
 * Upload new song
 * POST /api/admin/upload
 * Requires admin authentication
 * Audio files are stored in S3
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

        // Check if file is MPEG and needs conversion
        let fileBuffer = req.file.buffer;
        let fileName = req.file.originalname;
        let fileMimeType = req.file.mimetype;

        const isMpeg = ['video/mpeg', 'video/mp4'].includes(req.file.mimetype);

        if (isMpeg) {
            console.log(`📼 MPEG file detected: ${req.file.originalname}`);
            try {
                const converted = await convertToMp3(req.file.buffer, req.file.originalname);
                fileBuffer = converted.buffer;
                fileName = converted.filename;
                fileMimeType = converted.mimetype;
                console.log(`✅ Converted to: ${fileName}`);
            } catch (conversionError) {
                console.error('Conversion error:', conversionError);
                return res.status(500).json({
                    message: 'Failed to convert MPEG to MP3',
                    error: conversionError.message
                });
            }
        }

        // Upload to S3
        console.log(`Uploading ${fileName} to S3...`);

        const s3Key = `songs/${Date.now()}-${fileName}`;

        const s3Url = await uploadFile(s3Key, fileBuffer, fileMimeType);
        console.log(`✅ File uploaded to S3: ${s3Url}`);

        // Get audio duration from file
        console.log('Calculating audio duration...');
        const duration = await getAudioDuration(fileBuffer, fileMimeType);
        console.log(`✅ Duration calculated: ${duration} seconds`);

        // Create song record with S3 reference
        const song = await Song.create({
            title,
            artist,
            album: album || 'Unknown Album',
            duration: duration,
            s3Key: s3Key,
            s3Url: s3Url,
            mimeType: fileMimeType
        });

        // Add _id for backward compatibility
        res.status(201).json({
            ...song,
            _id: song.songId
        });
    } catch (error) {
        console.error('Upload song error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode
        });
        res.status(500).json({
            message: 'Error uploading song',
            error: error.message
        });
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

        // Update song
        const updatedSong = await Song.update(req.params.id, {
            title,
            artist,
            album,
            duration
        });

        // Add _id for backward compatibility
        res.json({
            ...updatedSong,
            _id: updatedSong.songId
        });
    } catch (error) {
        console.error('Edit song error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            songId: req.params.id,
            updates: req.body
        });
        res.status(500).json({
            message: 'Error editing song',
            error: error.message
        });
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

        // Delete file from S3
        if (song.s3Key) {
            try {
                await deleteFile(song.s3Key);
                console.log(`🗑️ File deleted from S3: ${song.s3Key}`);
            } catch (err) {
                console.log('Error deleting from S3:', err.message);
            }
        }

        // Delete from database
        await Song.delete(req.params.id);

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
        const users = await User.findAll();

        // Remove passwords and add _id for backward compatibility
        const usersWithoutPassword = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return {
                ...userWithoutPassword,
                _id: user.userId
            };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(usersWithoutPassword);
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

        await User.delete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};

module.exports = {
    upload,
    uploadSong,
    editSong,
    deleteSong,
    getAllUsers,
    deleteUser
};
