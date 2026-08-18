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
        
        console.log("Fixing invalid coordinates...");
        const listings = await collection.find({}).toArray();
        for (const listing of listings) {
            const coords = listing.pickupLocation?.location?.coordinates;
            if (coords) {
                let [lng, lat] = coords;
                let updated = false;
                if (lng > 180 || lng < -180) { lng = 0; updated = true; }
                if (lat > 90 || lat < -90) { lat = 0; updated = true; }
                
                if (updated) {
                    await collection.updateOne(
                        { _id: listing._id },
                        { $set: { "pickupLocation.location.coordinates": [lng, lat] } }
                    );
                    console.log(`Fixed listing ${listing._id}`);
                }
            }
        }
        
        console.log("Creating 2dsphere index...");
        const result = await collection.createIndex({ "pickupLocation.location": "2dsphere" });
        console.log("Index created:", result);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

run();
