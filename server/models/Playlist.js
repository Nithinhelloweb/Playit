const mongoose = require('mongoose');

/**
 * Playlist Schema
 * Stores user-created playlists with references to songs
 */
const playlistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Playlist name is required'],
        trim: true,
        maxlength: [50, 'Playlist name cannot exceed 50 characters']
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User reference is required']
    },
    songs: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song'
    }],
    description: {
        type: String,
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters'],
        default: ''
    }
}, {
    timestamps: true
});

/**
 * Index for efficient user playlist queries
 */
playlistSchema.index({ user: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);
