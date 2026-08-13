import mongoose from 'mongoose';

const pickupDeliverySchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    mode: { type: String, enum: ['self-pickup', 'delivery'], required: true },
    address: { type: String }, // Optional if self-pickup, required if delivery
    status: { type: String, enum: ['pending', 'in-transit', 'delivered', 'picked-up'], default: 'pending' }
}, { timestamps: true });

const PickupDelivery = mongoose.model('PickupDelivery', pickupDeliverySchema);
export default PickupDelivery;
