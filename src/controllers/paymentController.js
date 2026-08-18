import Order from '../models/Order.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret'
});

// @desc    Create a Razorpay order
// @route   POST /api/payments/create-order
// @access  Private (Buyer/NGO)
export const createPaymentOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }

        const order = await Order.findById(orderId).populate('listingId');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Ensure user is the buyer
        if (order.buyerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to pay for this order' });
        }
        
        // Ensure payment status is pending
        if (order.paymentStatus !== 'pending') {
            return res.status(400).json({ message: `Order cannot be paid. Current payment status is ${order.paymentStatus}` });
        }

        // Generate Razorpay Order
        const amountInPaise = Math.round(order.totalAmount * 100);
        
        const options = {
            amount: amountInPaise,
            currency: order.currency || 'INR',
            receipt: order._id.toString(),
            payment_capture: 1 // Auto capture
        };

        const razorpayOrder = await razorpay.orders.create(options);
        
        order.paymentGateway = 'razorpay';
        order.paymentOrderId = razorpayOrder.id;
        await order.save();
        
        res.status(200).json({
            id: razorpayOrder.id,
            currency: razorpayOrder.currency,
            amount: razorpayOrder.amount,
            keyId: process.env.RAZORPAY_KEY_ID // send public key ID to frontend
        });

    } catch (error) {
        console.error('Razorpay Create Error:', error);
        res.status(500).json({ message: 'Payment initiation failed', error: error.message });
    }
};

// @desc    Verify Razorpay payment signature
// @route   POST /api/payments/verify
// @access  Private (Buyer/NGO)
export const verifyPayment = async (req, res) => {
    try {
        const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        
        if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification parameters' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Idempotency: If already paid, return safe idempotent success
        if (order.paymentStatus === 'paid' && order.paymentTransactionId === razorpay_payment_id) {
            return res.status(200).json({ message: 'Payment already verified successfully' });
        }
        
        if (order.buyerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        
        if (order.paymentOrderId !== razorpay_order_id) {
            return res.status(400).json({ message: 'Invalid payment order ID' });
        }
        
        // Verify signature cryptographically
        const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        
        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(body.toString())
            .digest("hex");
            
        if (expectedSignature !== razorpay_signature) {
            // Log as failed attempt
            order.paymentStatus = 'failed';
            await order.save();
            return res.status(400).json({ message: 'Invalid payment signature' });
        }
        
        // Verification successful
        order.paymentStatus = 'paid';
        order.paymentTransactionId = razorpay_payment_id;
        order.paymentSignature = razorpay_signature;
        order.paymentVerifiedAt = new Date();
        await order.save();
        
        res.status(200).json({ message: 'Payment verified successfully' });

    } catch (error) {
        console.error('Razorpay Verify Error:', error);
        res.status(500).json({ message: 'Payment verification failed', error: error.message });
    }
};

// @desc    Razorpay Webhook handler
// @route   POST /api/payments/webhook
// @access  Public
export const razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';
        const signature = req.headers['x-razorpay-signature'];

        if (!signature) {
            return res.status(400).json({ message: 'Missing signature' });
        }

        if (!req.rawBody) {
             return res.status(400).json({ message: 'Raw body missing for signature verification' });
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(req.rawBody)
            .digest("hex");

        if (expectedSignature !== signature) {
            return res.status(400).json({ message: 'Invalid webhook signature' });
        }

        const event = req.body;
        
        if (event.event === 'payment.captured' || event.event === 'order.paid') {
            let payment;
            if (event.event === 'payment.captured') {
                payment = event.payload.payment.entity;
            } else {
                payment = event.payload.order.entity;
            }
            
            const razorpayOrderId = payment.order_id || payment.id;
            
            const order = await Order.findOne({ paymentOrderId: razorpayOrderId });
            
            // Reconcile state
            if (order && order.paymentStatus === 'pending') {
                order.paymentStatus = 'paid';
                order.paymentTransactionId = event.event === 'payment.captured' ? payment.id : undefined;
                order.paymentVerifiedAt = new Date();
                await order.save();
            }
        }
        
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Webhook processing error', error: error.message });
    }
};
