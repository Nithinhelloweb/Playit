const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gridFSBucket = null;

/**
 * Initialize GridFS bucket
 * Should be called after MongoDB connection is established
 */
const initGridFS = () => {
    if (mongoose.connection.db) {
        gridFSBucket = new GridFSBucket(mongoose.connection.db, {
            bucketName: 'songs'
        });
        console.log('✅ GridFS bucket initialized');
    }
};

/**
 * Get GridFS bucket for storing/retrieving audio files
 * @returns {GridFSBucket|null}
 */
const getGridFSBucket = () => {
    return gridFSBucket;
};

module.exports = {
    initGridFS,
    getGridFSBucket
};
