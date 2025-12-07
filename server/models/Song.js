const mongoose = require('mongoose');

/**
 * Song Schema
 * Stores metadata for music files including title, artist, album
 * Audio file is stored in Google Drive, referenced by googleDriveFileId
 */
const songSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Song title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    artist: {
        type: String,
        required: [true, 'Artist name is required'],
        trim: true,
        maxlength: [100, 'Artist name cannot exceed 100 characters']
    },
    album: {
        type: String,
        trim: true,
        default: 'Unknown Album',
        maxlength: [100, 'Album name cannot exceed 100 characters']
    },
    duration: {
        type: Number,
        required: [true, 'Duration is required'],
        min: [0, 'Duration must be positive']
    },
    // Google Drive storage
    googleDriveFileId: {
        type: String,
        required: false
    },
    googleDriveUrl: {
        type: String,
        required: false
    },
    // Legacy GridFS support (for existing songs)
    gridfsId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    mimeType: {
        type: String,
        default: 'audio/flac'
    },
    coverImage: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

/**
 * Create indexes for efficient searching
 */
songSchema.index({ title: 'text', artist: 'text', album: 'text' });

module.exports = mongoose.model('Song', songSchema);

