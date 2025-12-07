require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { initGridFS } = require('./server/utils/gridfs');
const { initGoogleDrive } = require('./server/utils/googleDrive');

// Import routes
const authRoutes = require('./server/routes/auth');
const songRoutes = require('./server/routes/songs');
const playlistRoutes = require('./server/routes/playlists');
const favoriteRoutes = require('./server/routes/favorites');
const adminRoutes = require('./server/routes/admin');

/**
 * Initialize Express app
 */
const app = express();

/**
 * Middleware
 */
// CORS Configuration - Environment aware
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? true  // Allow same-origin in production
        : '*',  // Allow all origins in development
    credentials: true
};
app.use(cors(corsOptions)); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

/**
 * Serve static files from public directory
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin', adminRoutes);

/**
 * Serve HTML pages for specific routes
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * MongoDB Connection
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/music-player';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connected successfully');

        // Initialize GridFS bucket for legacy audio files
        initGridFS();

        // Initialize Google Drive for new audio uploads
        try {
            initGoogleDrive();
        } catch (error) {
            console.warn('⚠️ Google Drive not configured. New uploads will fail.');
            console.warn('   Please add google-credentials.json and set GOOGLE_DRIVE_FOLDER_ID in .env');
        }
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

/**
 * Start server
 */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🎵 TamilBeats Server running on port ${PORT}`);
    console.log(`📁 Access the app at http://localhost:${PORT}`);
});

