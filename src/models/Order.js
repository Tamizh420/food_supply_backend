import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { 
        type: String, 
        enum: ['requested', 'accepted', 'ready', 'completed', 'rejected', 'cancelled'], 
        default: 'requested' 
    },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'not_applicable'], default: 'not_applicable' },
    scheduledPickupTime: { type: Date }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
