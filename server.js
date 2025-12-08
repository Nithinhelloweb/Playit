require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createTables } = require('./server/utils/createTables');

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
 * DynamoDB Connection & Table Creation
 */
const initializeDynamoDB = async () => {
    try {
        console.log('🔧 Initializing DynamoDB tables...');
        await createTables();
        console.log('✅ DynamoDB tables ready');
    } catch (error) {
        console.error('❌ DynamoDB initialization error:', error);
        console.error('⚠️  Server will continue, but database operations may fail');
    }
};

// Initialize DynamoDB
initializeDynamoDB();

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
    console.log(`☁️  Using AWS DynamoDB (Region: ${process.env.AWS_REGION})`);
    console.log(`☁️  Using AWS S3 Bucket: ${process.env.S3_BUCKET}`);
});
