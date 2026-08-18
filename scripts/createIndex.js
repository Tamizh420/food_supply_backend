import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collection = db.collection('listings');
        
        console.log("Creating 2dsphere index...");
        const result = await collection.createIndex({ "pickupLocation.location": "2dsphere" });
        console.log("Index created:", result);
    } catch (err) {
        console.error("Error creating index:", err);
    } finally {
        await mongoose.disconnect();
    }
};

run();
