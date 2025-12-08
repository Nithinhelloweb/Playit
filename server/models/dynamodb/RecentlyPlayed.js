const { TABLES, execute, PutCommand, ScanCommand, DeleteCommand, QueryCommand } = require('../../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

/**
 * RecentlyPlayed Model for DynamoDB
 * Tracks user's recently played songs (max 20 per user)
 */

class RecentlyPlayed {
    /**
     * Add song to recently played
     * @param {string} userId
     * @param {Object} songData - Full song object to denormalize
     */
    static async add(userId, songData) {
        const recentlyPlayedId = uuidv4();
        const playedAt = new Date().toISOString();

        // First, remove any existing entry for this song by this user
        await this.removeUserSong(userId, songData.songId);

        const item = {
            recentlyPlayedId,
            userId,
            songId: songData.songId,
            songData: songData, // Denormalized song data
            playedAt
        };

        const command = new PutCommand({
            TableName: TABLES.RECENTLY_PLAYED,
            Item: item
        });

        await execute(command);

        // Cleanup old entries (keep only last 20)
        await this.cleanup(userId);
    }

    /**
     * Remove a specific song entry for a user
     * @param {string} userId
     * @param {string} songId
     */
    static async removeUserSong(userId, songId) {
        const items = await this.findByUser(userId);
        const toDelete = items.find(item => item.songId === songId);

        if (toDelete) {
            const command = new DeleteCommand({
                TableName: TABLES.RECENTLY_PLAYED,
                Key: { recentlyPlayedId: toDelete.recentlyPlayedId }
            });
            await execute(command);
        }
    }

    /**
     * Get recently played songs for a user
     * @param {string} userId
     * @returns {Promise<Array>} Array of recently played items (max 20)
     */
    static async findByUser(userId) {
        const command = new ScanCommand({
            TableName: TABLES.RECENTLY_PLAYED,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        });

        const result = await execute(command);
        const items = result.Items || [];

        // Sort by playedAt descending
        items.sort((a, b) => new Date(b.playedAt) - new Date(a.playedAt));

        // Return only last 20
        return items.slice(0, 20);
    }

    /**
     * Cleanup old entries for a user (keep only last 20)
     * @param {string} userId
     */
    static async cleanup(userId) {
        const items = await this.findByUser(userId);

        // If more than 20, delete the oldest ones
        if (items.length > 20) {
            const toDelete = items.slice(20); // Everything after the first 20

            for (const item of toDelete) {
                const command = new DeleteCommand({
                    TableName: TABLES.RECENTLY_PLAYED,
                    Key: { recentlyPlayedId: item.recentlyPlayedId }
                });
                await execute(command);
            }
        }
    }

    /**
     * Delete all recently played for a user
     * @param {string} userId
     */
    static async deleteByUser(userId) {
        const items = await this.findByUser(userId);

        for (const item of items) {
            const command = new DeleteCommand({
                TableName: TABLES.RECENTLY_PLAYED,
                Key: { recentlyPlayedId: item.recentlyPlayedId }
            });
            await execute(command);
        }
    }
}

module.exports = RecentlyPlayed;
