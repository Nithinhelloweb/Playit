require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Song = require('../models/Song');

/**
 * Seed Database with Initial Data
 * Creates an admin user and optionally sample songs
 */

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/music-player';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Create admin user
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@musicplayer.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (!existingAdmin) {
            const admin = await User.create({
                name: 'Admin User',
                email: adminEmail,
                password: adminPassword,
                isAdmin: true
            });
            console.log(`✅ Admin user created: ${admin.email}`);
            console.log(`   Password: ${adminPassword}`);
        } else {
            console.log('ℹ️  Admin user already exists');
        }

        // Create sample user
        const sampleUser = await User.findOne({ email: 'user@example.com' });
        if (!sampleUser) {
            await User.create({
                name: 'John Doe',
                email: 'user@example.com',
                password: 'password123',
                isAdmin: false
            });
            console.log('✅ Sample user created: user@example.com (password: password123)');
        }

        console.log('\n📝 Note: To add songs, use the admin panel to upload MP3 files');
        console.log('   Or manually add songs to server/uploads/songs/ directory\n');

        console.log('✅ Database seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};

seedDatabase();
