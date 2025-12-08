const { TABLES, execute, PutCommand, GetCommand, ScanCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('../../config/dynamodb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/**
 * User Model for DynamoDB
 * Handles user account operations
 */

class User {
    /**
     * Create a new user
     * @param {Object} userData - {name, email, password}
     * @returns {Promise<Object>} Created user object
     */
    static async create(userData) {
        const { name, email, password } = userData;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userId = uuidv4();
        const now = new Date().toISOString();

        const user = {
            userId,
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            favorites: [],
            isAdmin: false,
            createdAt: now,
            updatedAt: now
        };

        const command = new PutCommand({
            TableName: TABLES.USERS,
            Item: user,
            ConditionExpression: 'attribute_not_exists(email)'
        });

        await execute(command);

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    /**
     * Find user by email
     * @param {string} email
     * @returns {Promise<Object|null>} User object or null
     */
    static async findByEmail(email) {
        const command = new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email.toLowerCase()
            }
        });

        const result = await execute(command);
        return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    }

    /**
     * Find user by ID
     * @param {string} userId
     * @returns {Promise<Object|null>} User object or null
     */
    static async findById(userId) {
        const command = new GetCommand({
            TableName: TABLES.USERS,
            Key: { userId }
        });

        const result = await execute(command);
        return result.Item || null;
    }

    /**
     * Update user
     * @param {string} userId
     * @param {Object} updates
     * @returns {Promise<Object>} Updated user
     */
    static async update(userId, updates) {
        const now = new Date().toISOString();

        // Build update expression
        let updateExpression = 'SET updatedAt = :updatedAt';
        const expressionAttributeValues = {
            ':updatedAt': now
        };

        if (updates.name) {
            updateExpression += ', #name = :name';
            expressionAttributeValues[':name'] = updates.name;
        }

        if (updates.favorites !== undefined) {
            updateExpression += ', favorites = :favorites';
            expressionAttributeValues[':favorites'] = updates.favorites;
        }

        const command = new UpdateCommand({
            TableName: TABLES.USERS,
            Key: { userId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: updates.name ? { '#name': 'name' } : undefined,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        });

        const result = await execute(command);
        return result.Attributes;
    }

    /**
     * Delete user
     * @param {string} userId
     */
    static async delete(userId) {
        const command = new DeleteCommand({
            TableName: TABLES.USERS,
            Key: { userId }
        });

        await execute(command);
    }

    /**
     * Get all users
     * @returns {Promise<Array>} Array of users
     */
    static async findAll() {
        const command = new ScanCommand({
            TableName: TABLES.USERS
        });

        const result = await execute(command);
        return result.Items || [];
    }

    /**
     * Compare password
     * @param {string} plainPassword
     * @param {string} hashedPassword
     * @returns {Promise<boolean>}
     */
    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;
