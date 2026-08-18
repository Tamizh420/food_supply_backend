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
        
        console.log("Inspecting listings...");
        const listings = await collection.find({}).toArray();
        let invalidCount = 0;

        for (const listing of listings) {
            let isInvalid = false;
            let reason = '';

            const loc = listing.pickupLocation?.location;
            if (!loc) {
                isInvalid = true;
                reason = 'Missing location object';
            } else if (loc.type !== 'Point') {
                isInvalid = true;
                reason = 'Malformed GeoJSON type';
            } else if (!loc.coordinates || loc.coordinates.length !== 2) {
                isInvalid = true;
                reason = 'Malformed coordinates array';
            } else {
                const lng = loc.coordinates[0];
                const lat = loc.coordinates[1];
                
                if (typeof lat !== 'number' || typeof lng !== 'number') {
                    isInvalid = true;
                    reason = 'Coordinates are not numbers';
                } else if (lat < -90 || lat > 90) {
                    isInvalid = true;
                    reason = `Latitude out of bounds: ${lat}`;
                } else if (lng < -180 || lng > 180) {
                    isInvalid = true;
                    reason = `Longitude out of bounds: ${lng}`;
                } else if (lat === 0 && lng === 0) {
                    isInvalid = true;
                    reason = `Zeroed out coordinates [0,0] (likely old bad test data)`;
                }
            }
            
            if (isInvalid) {
                console.log(`Found invalid record: ${listing._id} - ${reason}`);
                await collection.deleteOne({ _id: listing._id });
                console.log(`Deleted test record: ${listing._id}`);
                invalidCount++;
            }
        }
        console.log(`Cleanup complete. Removed ${invalidCount} invalid test records.`);

        console.log("Checking index status...");
        const indexes = await collection.indexes();
        const has2dSphere = indexes.some(idx => idx.key && idx.key['pickupLocation.location'] === '2dsphere');
        console.log(`2dsphere index exists: ${has2dSphere}`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
};

run();
