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
    paymentStatus: { type: String, enum: ['not_applicable', 'pending', 'paid', 'failed', 'refund_pending', 'refunded'], default: 'not_applicable' },
    priceAtOrder: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentGateway: { type: String },
    paymentOrderId: { type: String },
    paymentTransactionId: { type: String },
    paymentSignature: { type: String },
    refundId: { type: String },
    scheduledPickupTime: { type: Date },
    pickupCode: { type: String },
    failedVerificationAttempts: { type: Number, default: 0 },
    pickupVerifiedAt: { type: Date },
    pickupVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verificationMethod: { type: String, enum: ['code', 'admin_override'] }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
export default Order;
