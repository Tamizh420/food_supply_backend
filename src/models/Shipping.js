import mongoose from 'mongoose';

const shippingSchema = new mongoose.Schema({
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    carrier: { type: String, required: true },
    trackingNumber: { type: String },
    status: { type: String, enum: ['DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'], default: 'DISPATCHED' },
    estimatedDeliveryDate: { type: Date }
}, { timestamps: true });

const Shipping = mongoose.model('Shipping', shippingSchema);
export default Shipping;
