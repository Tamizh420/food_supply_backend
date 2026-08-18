import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const migrate = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const db = mongoose.connection.db;
        const collection = db.collection('listings');

        const listings = await collection.find({}).toArray();
        let count = 0;

        for (const listing of listings) {
            // Check if it has the old structure
            if (listing.pickupLocation && listing.pickupLocation.lat !== undefined && listing.pickupLocation.lng !== undefined) {
                const { lat, lng, address } = listing.pickupLocation;
                
                const newPickupLocation = {
                    address: address,
                    location: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                };

                await collection.updateOne(
                    { _id: listing._id },
                    { $set: { pickupLocation: newPickupLocation } }
                );
                count++;
            }
        }
        
        // Also drop old index if it exists, Mongoose might recreate it if defined in code, but we removed it.
        try {
            await collection.dropIndex("pickupLocation.lat_1_pickupLocation.lng_1");
            console.log("Old index dropped.");
        } catch (e) {
            console.log("Old index drop skipped (might not exist).");
        }

        console.log(`Migration complete. Updated ${count} listings.`);
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
    }
};

migrate();
