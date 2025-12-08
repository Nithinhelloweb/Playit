const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * DynamoDB Configuration
 * Initializes DynamoDB client with AWS credentials from environment
 */

// Create DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Create Document Client (simplifies working with DynamoDB)
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false
    }
});

// Table names with optional prefix
const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'MusicPlayer';

const TABLES = {
    USERS: `${TABLE_PREFIX}_Users`,
    SONGS: `${TABLE_PREFIX}_Songs`,
    PLAYLISTS: `${TABLE_PREFIX}_Playlists`,
    RECENTLY_PLAYED: `${TABLE_PREFIX}_RecentlyPlayed`
};

/**
 * Helper function to execute DynamoDB commands
 */
const execute = async (command) => {
    try {
        return await docClient.send(command);
    } catch (error) {
        console.error('DynamoDB error:', error);
        throw error;
    }
};

module.exports = {
    docClient,
    client,
    TABLES,
    execute,
    // Export command classes for use in models
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
    QueryCommand
};
