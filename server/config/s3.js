const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/**
 * S3 Configuration
 * Handles audio file storage and retrieval from AWS S3
 */

// Create S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.S3_BUCKET;

/**
 * Upload file to S3
 * @param {string} key - S3 object key (file path)
 * @param {Buffer} buffer - File buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} S3 object URL
 */
const uploadFile = async (key, buffer, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
        // Note: ACL removed - bucket policy should handle public access if needed
        // If bucket has ACLs disabled, use bucket policy or signed URLs instead
    });

    try {
        await s3Client.send(command);
        console.log(`✅ File uploaded to S3: ${key}`);
    } catch (error) {
        console.error('❌ S3 upload error:', error);
        throw error;
    }

    // Return public URL (works if bucket policy allows public read)
    // Otherwise, use signed URLs for access
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 */
const deleteFile = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });

    await s3Client.send(command);
};

/**
 * Generate signed URL for secure access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds (default 1 hour)
 * @returns {Promise<string>} Signed URL
 */
const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
};

module.exports = {
    s3Client,
    uploadFile,
    deleteFile,
    getSignedDownloadUrl,
    BUCKET_NAME
};
