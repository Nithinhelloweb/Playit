const { DynamoDBClient, CreateTableCommand, DescribeTableCommand, ResourceNotFoundException } = require('@aws-sdk/client-dynamodb');
const { TABLES } = require('../config/dynamodb');

/**
 * Create DynamoDB tables if they don't exist
 */

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

/**
 * Check if table exists
 */
const tableExists = async (tableName) => {
    try {
        const command = new DescribeTableCommand({ TableName: tableName });
        await client.send(command);
        return true;
    } catch (error) {
        if (error instanceof ResourceNotFoundException) {
            return false;
        }
        throw error;
    }
};

/**
 * Create Users table
 */
const createUsersTable = async () => {
    const params = {
        TableName: TABLES.USERS,
        KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'email-index',
                KeySchema: [
                    { AttributeName: 'email', KeyType: 'HASH' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    const command = new CreateTableCommand(params);
    await client.send(command);
};

/**
 * Create Songs table
 */
const createSongsTable = async () => {
    const params = {
        TableName: TABLES.SONGS,
        KeySchema: [
            { AttributeName: 'songId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'songId', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    const command = new CreateTableCommand(params);
    await client.send(command);
};

/**
 * Create Playlists table
 */
const createPlaylistsTable = async () => {
    const params = {
        TableName: TABLES.PLAYLISTS,
        KeySchema: [
            { AttributeName: 'playlistId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'playlistId', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'userId-index',
                KeySchema: [
                    { AttributeName: 'userId', KeyType: 'HASH' }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    const command = new CreateTableCommand(params);
    await client.send(command);
};

/**
 * Create RecentlyPlayed table
 */
const createRecentlyPlayedTable = async () => {
    const params = {
        TableName: TABLES.RECENTLY_PLAYED,
        KeySchema: [
            { AttributeName: 'recentlyPlayedId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'recentlyPlayedId', AttributeType: 'S' }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    const command = new CreateTableCommand(params);
    await client.send(command);
};

/**
 * Create all tables
 */
const createTables = async () => {
    const tables = [
        { name: TABLES.USERS, createFn: createUsersTable },
        { name: TABLES.SONGS, createFn: createSongsTable },
        { name: TABLES.PLAYLISTS, createFn: createPlaylistsTable },
        { name: TABLES.RECENTLY_PLAYED, createFn: createRecentlyPlayedTable }
    ];

    for (const table of tables) {
        const exists = await tableExists(table.name);
        if (!exists) {
            console.log(`📝 Creating table: ${table.name}`);
            await table.createFn();
            console.log(`✅ Table created: ${table.name}`);
        } else {
            console.log(`✅ Table already exists: ${table.name}`);
        }
    }
};

module.exports = { createTables };
