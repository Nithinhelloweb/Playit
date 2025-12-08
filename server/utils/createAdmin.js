require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/**
 * Create admin user in DynamoDB
 */

const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'MusicPlayer';
const USERS_TABLE = `${TABLE_PREFIX}_Users`;

async function createAdminUser() {
    try {
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@musicplayer.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

        // Check if admin already exists
        const scanCommand = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': adminEmail
            }
        });

        const existingUsers = await docClient.send(scanCommand);

        if (existingUsers.Items && existingUsers.Items.length > 0) {
            console.log('✅ Admin user already exists');
            console.log(`Email: ${adminEmail}`);
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const userId = uuidv4();
        const now = new Date().toISOString();

        const admin = {
            userId,
            name: 'Admin',
            email: adminEmail,
            password: hashedPassword,
            favorites: [],
            isAdmin: true,
            createdAt: now,
            updatedAt: now
        };

        const putCommand = new PutCommand({
            TableName: USERS_TABLE,
            Item: admin
        });

        await docClient.send(putCommand);

        console.log('✅ Admin user created successfully!');
        console.log(`Email: ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log(`User ID: ${userId}`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    }
}

createAdminUser();
