const { TABLES, execute, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('../../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * Playlist Model for DynamoDB
 * Handles user playlists with denormalized song data
 */

class Playlist {
    /**
     * Create a new playlist
     * @param {Object} playlistData - {name, description, userId}
     * @returns {Promise<Object>} Created playlist object
     */
    static async create(playlistData) {
        const playlistId = uuidv4();
        const now = new Date().toISOString();

        const playlist = {
            playlistId,
            userId: playlistData.userId,
            name: playlistData.name,
            description: playlistData.description || '',
            songs: [],
            createdAt: now,
            updatedAt: now
        };

        const command = new PutCommand({
            TableName: TABLES.PLAYLISTS,
            Item: playlist
        });

        await execute(command);
        return playlist;
    }

    /**
     * Find all playlists for a user
     * @param {string} userId
     * @returns {Promise<Array>} Array of playlists
     */
    static async findByUser(userId) {
        const command = new ScanCommand({
            TableName: TABLES.PLAYLISTS,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        });

        const result = await execute(command);
        const playlists = result.Items || [];

        // Sort by createdAt descending
        return playlists.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Find playlist by ID
     * @param {string} playlistId
     * @returns {Promise<Object|null>} Playlist object or null
     */
    static async findById(playlistId) {
        const command = new GetCommand({
            TableName: TABLES.PLAYLISTS,
            Key: { playlistId }
        });

        const result = await execute(command);
        return result.Item || null;
    }

    /**
     * Add song to playlist
     * @param {string} playlistId
     * @param {Object} songData - Full song object to denormalize
     * @returns {Promise<Object>} Updated playlist
     */
    static async addSong(playlistId, songData) {
        const playlist = await this.findById(playlistId);
        if (!playlist) throw new Error('Playlist not found');

        // Check if song already exists
        const songExists = playlist.songs.some(s => s.songId === songData.songId);
        if (songExists) {
            throw new Error('Song already in playlist');
        }

        // Add song to array
        const updatedSongs = [...playlist.songs, songData];

        const command = new UpdateCommand({
            TableName: TABLES.PLAYLISTS,
            Key: { playlistId },
            UpdateExpression: 'SET songs = :songs, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':songs': updatedSongs,
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        });

        const result = await execute(command);
        return result.Attributes;
    }

    /**
     * Remove song from playlist
     * @param {string} playlistId
     * @param {string} songId
     * @returns {Promise<Object>} Updated playlist
     */
    static async removeSong(playlistId, songId) {
        const playlist = await this.findById(playlistId);
        if (!playlist) throw new Error('Playlist not found');

        // Filter out the song
        const updatedSongs = playlist.songs.filter(s => s.songId !== songId);

        const command = new UpdateCommand({
            TableName: TABLES.PLAYLISTS,
            Key: { playlistId },
            UpdateExpression: 'SET songs = :songs, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':songs': updatedSongs,
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        });

        const result = await execute(command);
        return result.Attributes;
    }

    /**
     * Update playlist metadata
     * @param {string} playlistId
     * @param {Object} updates - {name, description}
     * @returns {Promise<Object>} Updated playlist
     */
    static async update(playlistId, updates) {
        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = {
            ':updatedAt': new Date().toISOString()
        };
        const expressionAttributeNames = {};

        if (updates.name) {
            updateExpression += ', #name = :name';
            expressionAttributeNames['#name'] = 'name';
            expressionAttributeValues[':name'] = updates.name;
        }

        if (updates.description !== undefined) {
            updateExpression += ', description = :description';
            expressionAttributeValues[':description'] = updates.description;
        }

        const command = new UpdateCommand({
            TableName: TABLES.PLAYLISTS,
            Key: { playlistId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        });

        const result = await execute(command);
        return result.Attributes;
    }

    /**
     * Delete playlist
     * @param {string} playlistId
     */
    static async delete(playlistId) {
        const command = new DeleteCommand({
            TableName: TABLES.PLAYLISTS,
            Key: { playlistId }
        });

        await execute(command);
    }
}

module.exports = Playlist;
