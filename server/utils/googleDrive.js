const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

let drive = null;

/**
 * Initialize Google Drive client using service account credentials
 */
const initGoogleDrive = () => {
    try {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-credentials.json';
        const absolutePath = path.resolve(credentialsPath);

        // Check if credentials file exists
        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ Google credentials file not found at: ${absolutePath}`);
            throw new Error(`Credentials file not found: ${absolutePath}`);
        }



        const auth = new google.auth.GoogleAuth({
            keyFile: absolutePath,
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        drive = google.drive({ version: 'v3', auth });
        return drive;
    } catch (error) {
        console.error('❌ Google Drive initialization error:', error.message);
        throw error;
    }
};

/**
 * Get the Google Drive client
 * @returns {Object} Google Drive client
 */
const getGoogleDrive = () => {
    if (!drive) {
        // Try to initialize if not done yet
        initGoogleDrive();
    }
    return drive;
};

/**
 * Upload a file buffer to Google Drive
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} - Object containing fileId and webViewLink
 */
const uploadToGoogleDrive = async (buffer, filename, mimeType) => {
    const driveClient = getGoogleDrive();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        console.error('❌ GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
        throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
    }



    // Convert buffer to readable stream
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    const fileMetadata = {
        name: filename,
        parents: [folderId]
    };

    const media = {
        mimeType: mimeType,
        body: readableStream
    };

    try {

        const response = await driveClient.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink'
        });


        // Make the file publicly accessible for streaming
        await driveClient.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });



        return {
            fileId: response.data.id,
            fileName: response.data.name,
            webViewLink: response.data.webViewLink,
            // Direct download/stream link
            directLink: `https://drive.google.com/uc?export=download&id=${response.data.id}`
        };
    } catch (error) {
        console.error('❌ Google Drive upload error:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
};

/**
 * Get a direct streaming URL for a Google Drive file
 * @param {string} fileId - Google Drive file ID
 * @returns {string} - Direct streaming URL
 */
const getGoogleDriveStreamUrl = (fileId) => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 */
const deleteFromGoogleDrive = async (fileId) => {
    const driveClient = getGoogleDrive();

    try {
        await driveClient.files.delete({
            fileId: fileId
        });

    } catch (error) {
        console.error('Google Drive delete error:', error);
        throw error;
    }
};

/**
 * Get file metadata from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<Object>} - File metadata
 */
const getGoogleDriveFileInfo = async (fileId) => {
    const driveClient = getGoogleDrive();

    try {
        const response = await driveClient.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size, webViewLink'
        });
        return response.data;
    } catch (error) {
        console.error('Google Drive get file info error:', error);
        throw error;
    }
};

module.exports = {
    initGoogleDrive,
    getGoogleDrive,
    uploadToGoogleDrive,
    getGoogleDriveStreamUrl,
    deleteFromGoogleDrive,
    getGoogleDriveFileInfo
};
