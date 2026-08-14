import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import User from './models/User.js';

dotenv.config();

connectDB();

const importData = async () => {
    try {
        await User.deleteMany(); // Clear existing users

        const users = [
            {
                name: 'Admin User',
                email: 'admin@example.com',
                password: 'password123',
                role: 'admin',
                verified: true
            },
            {
                name: 'Supplier User',
                email: 'supplier@example.com',
                password: 'password123',
                role: 'supplier',
                verified: true
            },
            {
                name: 'Buyer User',
                email: 'buyer@example.com',
                password: 'password123',
                role: 'buyer',
                verified: true
            },
            {
                name: 'NGO User',
                email: 'ngo@example.com',
                password: 'password123',
                role: 'ngo',
                verified: true
            }
        ];

        for (const userData of users) {
            const user = new User(userData);
            await user.save();
        }

        console.log('Data Imported! Users seeded successfully.');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await User.deleteMany();

        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
