import Payment from '../models/Payment.js';
import Order from '../models/Order.js';

// @desc    Initiate a payment stub
// @route   POST /api/payments/checkout
// @access  Private (Buyer)
export const checkoutStub = async (req, res) => {
    try {
        const { orderId, amount, method } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.buyerId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized for this order' });
        }

        if (order.paymentStatus !== 'pending') {
            return res.status(400).json({ message: 'Payment already processed or not required' });
        }

        // Stubbed response simulating Razorpay/Stripe order creation
        const payment = new Payment({
            orderId,
            amount,
            method: method || 'stripe',
            status: 'pending',
            transactionId: `txn_stub_${Date.now()}`
        });

        await payment.save();

        res.status(200).json({ 
            success: true, 
            message: 'Payment intent created (Stub)',
            paymentId: payment._id,
            transactionId: payment.transactionId
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Verify payment stub
// @route   POST /api/payments/verify
// @access  Private (Buyer)
export const verifyPaymentStub = async (req, res) => {
    try {
        const { paymentId, success } = req.body;

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        if (success) {
            payment.status = 'completed';
            await payment.save();

            // Update order payment status
            const order = await Order.findById(payment.orderId);
            order.paymentStatus = 'paid';
            await order.save();

            res.json({ success: true, message: 'Payment verified and order updated' });
        } else {
            payment.status = 'failed';
            await payment.save();
            res.status(400).json({ success: false, message: 'Payment failed' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
