const { TABLES, execute, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('../../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * Song Model for DynamoDB
 * Handles song metadata and storage references
 */

class Song {
    /**
     * Create a new song
     * @param {Object} songData - {title, artist, album, duration, s3Key, s3Url, mimeType, coverImage}
     * @returns {Promise<Object>} Created song object
     */
    static async create(songData) {
        const songId = uuidv4();
        const now = new Date().toISOString();

        // Get max sortOrder
        const allSongs = await this.findAll();
        const maxOrder = allSongs.length > 0
            ? Math.max(...allSongs.map(s => s.sortOrder || 0))
            : -1;

        const song = {
            songId,
            title: songData.title,
            artist: songData.artist,
            album: songData.album || 'Unknown Album',
            duration: songData.duration || 0,
            s3Key: songData.s3Key,
            s3Url: songData.s3Url,
            mimeType: songData.mimeType || 'audio/mpeg',
            coverImage: songData.coverImage || null,
            sortOrder: maxOrder + 1,
            createdAt: now,
            updatedAt: now
        };

        const command = new PutCommand({
            TableName: TABLES.SONGS,
            Item: song
        });

        await execute(command);
        return song;
    }

    /**
     * Find all songs
     * @returns {Promise<Array>} Array of songs
     */
    static async findAll() {
        const command = new ScanCommand({
            TableName: TABLES.SONGS
        });

        const result = await execute(command);
        const songs = result.Items || [];

        // Sort by sortOrder, fallback to createdAt
        return songs.sort((a, b) => {
            const orderA = a.sortOrder !== undefined ? a.sortOrder : 999999;
            const orderB = b.sortOrder !== undefined ? b.sortOrder : 999999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    /**
     * Find song by ID
     * @param {string} songId
     * @returns {Promise<Object|null>} Song object or null
     */
    static async findById(songId) {
        const command = new GetCommand({
            TableName: TABLES.SONGS,
            Key: { songId }
        });

        const result = await execute(command);
        return result.Item || null;
    }

    /**
     * Search songs by title, artist, or album
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of matching songs
     */
    static async search(query) {
        if (!query) return [];

        const command = new ScanCommand({
            TableName: TABLES.SONGS,
            FilterExpression: 'contains(#title, :query) OR contains(#artist, :query) OR contains(#album, :query)',
            ExpressionAttributeNames: {
                '#title': 'title',
                '#artist': 'artist',
                '#album': 'album'
            },
            ExpressionAttributeValues: {
                ':query': query
            }
        });

        const result = await execute(command);
        return result.Items || [];
    }

    /**
     * Update song metadata
     * @param {string} songId
     * @param {Object} updates - {title, artist, album, duration}
     * @returns {Promise<Object>} Updated song
     */
    static async update(songId, updates) {
        const now = new Date().toISOString();

        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = {
            ':updatedAt': now
        };
        const expressionAttributeNames = {};

        if (updates.title) {
            updateExpression += ', #title = :title';
            expressionAttributeNames['#title'] = 'title';
            expressionAttributeValues[':title'] = updates.title;
        }

        if (updates.artist) {
            updateExpression += ', #artist = :artist';
            expressionAttributeNames['#artist'] = 'artist';
            expressionAttributeValues[':artist'] = updates.artist;
        }

        if (updates.album !== undefined) {
            updateExpression += ', #album = :album';
            expressionAttributeNames['#album'] = 'album';
            expressionAttributeValues[':album'] = updates.album;
        }

        if (updates.duration !== undefined) {
            updateExpression += ', #duration = :duration';
            expressionAttributeNames['#duration'] = 'duration';
            expressionAttributeValues[':duration'] = updates.duration;
        }

        const command = new UpdateCommand({
            TableName: TABLES.SONGS,
            Key: { songId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        });

        const result = await execute(command);
        return result.Attributes;
    }

    /**
     * Delete song
     * @param {string} songId
     */
    static async delete(songId) {
        const command = new DeleteCommand({
            TableName: TABLES.SONGS,
            Key: { songId }
        });

        await execute(command);
    }

    /**
     * Update album cover for all songs with matching album name
     * @param {string} albumName - Album name to update
     * @param {string|null} coverUrl - Cover URL or null to remove
     * @returns {Promise<number>} Number of songs updated
     */
    static async updateAlbumCover(albumName, coverUrl) {
        const songs = await this.findAll();
        const albumSongs = songs.filter(song => song.album === albumName);

        let updateCount = 0;
        for (const song of albumSongs) {
            try {
                const command = new UpdateCommand({
                    TableName: TABLES.SONGS,
                    Key: { songId: song.songId },
                    UpdateExpression: 'SET coverImage = :cover, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':cover': coverUrl,
                        ':updatedAt': new Date().toISOString()
                    }
                });
                await execute(command);
                updateCount++;
            } catch (error) {
                console.error(`Error updating cover for song ${song.songId}:`, error);
            }
        }

        return updateCount;
    }

    /**
     * Update sort order for multiple songs
     * @param {Array} orderData - Array of {songId, sortOrder}
     */
    static async updateOrder(orderData) {
        let updateCount = 0;
        for (const item of orderData) {
            try {
                const command = new UpdateCommand({
                    TableName: TABLES.SONGS,
                    Key: { songId: item.songId },
                    UpdateExpression: 'SET sortOrder = :order, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':order': item.sortOrder,
                        ':updatedAt': new Date().toISOString()
                    }
                });
                await execute(command);
                updateCount++;
            } catch (error) {
                console.error(`Error updating order for song ${item.songId}:`, error);
            }
        }
        return updateCount;
    }
}

module.exports = Song;
