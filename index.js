import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import listingRoutes from './src/routes/listingRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import cron from 'node-cron';
import Listing from './src/models/Listing.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/orders', orderRoutes);

// Cron Job: Every 5 minutes, mark expired active listings as 'expired'
cron.schedule('*/5 * * * *', async () => {
    try {
        const now = new Date();
        const result = await Listing.updateMany(
            { status: 'active', expiresAt: { $lt: now } },
            { $set: { status: 'expired' } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Cron: Marked ${result.modifiedCount} listings as expired.`);
        }
    } catch (error) {
        console.error('Cron Error:', error);
    }
});

// Basic Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});