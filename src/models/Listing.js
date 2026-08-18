import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
    foodType: { type: String, required: true },
    quantity: { type: String, required: true }, // e.g. "5 servings", "2 kg"
    cookedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    pricingType: { type: String, enum: ['paid', 'free'], required: true },
    price: { type: Number, default: 0, min: 0 },
    images: [{ type: String }],
    status: { type: String, enum: ['active', 'expired', 'claimed'], default: 'active' },
    pickupLocation: {
        address: { type: String, required: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true } // [longitude, latitude]
        }
    },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Create a 2dsphere index on pickupLocation.location for geospatial queries
listingSchema.index({ "pickupLocation.location": "2dsphere" }); // Basic index, for actual $geoNear it should be a GeoJSON Point.
// To properly use $geoNear, it's better to format as GeoJSON:
// location: { type: { type: String, default: 'Point' }, coordinates: [Number] }
// But following prompt exactly for now.

const Listing = mongoose.model('Listing', listingSchema);
export default Listing;
