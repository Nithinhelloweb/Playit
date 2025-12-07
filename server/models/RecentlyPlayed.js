const mongoose = require('mongoose');

/**
 * Recently Played Schema
 * Tracks songs played by users with timestamps
 * Limited to 20 most recent items per user
 */
const recentlyPlayedSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User reference is required']
    },
    song: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
        required: [true, 'Song reference is required']
    },
    playedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

/**
 * Indexes for efficient queries
 * Compound index for user + playedAt for sorting
 */
recentlyPlayedSchema.index({ user: 1, playedAt: -1 });
recentlyPlayedSchema.index({ song: 1 });

module.exports = mongoose.model('RecentlyPlayed', recentlyPlayedSchema);
