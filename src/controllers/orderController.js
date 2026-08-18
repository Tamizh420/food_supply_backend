import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import crypto from 'crypto';

const generatePickupCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // Generates 6 character alphanumeric code
};

const stripCodeIfSupplier = (orderObj, user) => {
    // If user is Admin, they can see everything. 
    // If user is Buyer, they can see the code.
    // If user is Supplier, strip the code.
    if (user.role === 'admin') return orderObj;
    
    // Check if the current user is NOT the buyer
    let isBuyer = false;
    if (orderObj.buyerId && orderObj.buyerId._id) {
        isBuyer = orderObj.buyerId._id.toString() === user._id.toString();
    } else if (orderObj.buyerId) {
        isBuyer = orderObj.buyerId.toString() === user._id.toString();
    }

    if (!isBuyer) {
        // Strip the code
        const safeOrder = orderObj.toObject ? orderObj.toObject() : { ...orderObj };
        delete safeOrder.pickupCode;
        return safeOrder;
    }
    return orderObj;
};

// @desc    Request to claim/buy a listing
// @route   POST /api/orders
// @access  Private (Buyer/NGO)
export const requestOrder = async (req, res) => {
    try {
        let { listingId, scheduledPickupTime, quantity } = req.body;

        quantity = quantity ? Number(quantity) : 1;
        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be a positive integer' });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }
        if (listing.status !== 'active') {
            return res.status(400).json({ message: 'Listing is no longer active' });
        }

        const order = new Order({
            listingId,
            buyerId: req.user._id,
            supplierId: listing.supplierId,
            status: 'requested',
            paymentStatus: listing.pricingType === 'paid' ? 'pending' : 'not_applicable',
            priceAtOrder: listing.price || 0,
            quantity: quantity,
            totalAmount: (listing.price || 0) * quantity,
            currency: 'INR',
            scheduledPickupTime
        });

        // Mark listing as claimed so others can't request it simultaneously
        // Alternatively, it could stay active until the supplier 'accepts' it.
        // Let's mark it 'claimed' for simplicity of the prompt flow.
        listing.status = 'claimed';
        await listing.save();

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('buyerId', 'name email')
            .populate('supplierId', 'name email')
            .populate('listingId');

        if (order) {
            // Check if user is buyer, supplier, or admin
            if (
                order.buyerId._id.toString() !== req.user._id.toString() && 
                order.supplierId._id.toString() !== req.user._id.toString() &&
                req.user.role !== 'admin'
            ) {
                return res.status(403).json({ message: 'Not authorized to view this order' });
            }
            
            const safeOrder = stripCodeIfSupplier(order, req.user);
            res.json(safeOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get logged in user orders (buyer or supplier)
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'supplier') {
            query = { supplierId: req.user._id };
        } else {
            query = { buyerId: req.user._id };
        }

        const orders = await Order.find(query)
            .populate('listingId')
            .populate('buyerId', 'name')
            .populate('supplierId', 'name')
            .sort({ createdAt: -1 });
            
        const safeOrders = orders.map(order => stripCodeIfSupplier(order, req.user));
        res.json(safeOrders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('buyerId', 'name')
            .populate('supplierId', 'name')
            .populate('listingId')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
export const updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const isSupplier = order.supplierId.toString() === req.user._id.toString();
        const isBuyer = order.buyerId.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isSupplier && !isBuyer && !isAdmin) {
             return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        const newStatus = req.body.status;
        
        if (isBuyer && !isAdmin && newStatus !== 'cancelled') {
             return res.status(403).json({ message: 'Buyers can only cancel orders' });
        }

        const currentStatus = order.status;

        // Enforce state transitions
        if (!isAdmin) {
            const validTransitions = {
                requested: ['accepted', 'rejected', 'cancelled'],
                accepted: ['ready', 'cancelled'],
                ready: ['cancelled'], // 'completed' must happen via verification endpoint
                completed: [],
                rejected: [],
                cancelled: []
            };

            if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
                return res.status(400).json({ message: `Cannot transition from ${currentStatus} to ${newStatus}` });
            }
            
            // Payment check: cannot accept or mark ready if payment is pending (for paid listings)
            // Note: During phase 5.1, payment UI is mock, but we enforce backend rules
            // Wait, if we enforce it now, we can't test accept/ready without a mock payment endpoint.
            // But the rule states: "Order payment = paid -> Supplier accepts"
            // Let's enforce that paymentStatus must be 'paid' or 'not_applicable' to accept an order.
            if ((newStatus === 'accepted' || newStatus === 'ready') && order.paymentStatus === 'pending') {
                return res.status(400).json({ message: `Cannot mark order as ${newStatus} while payment is pending` });
            }
        }

        // If rejecting or cancelling from an active state, free up the listing
        if ((newStatus === 'rejected' || newStatus === 'cancelled') && currentStatus !== 'rejected' && currentStatus !== 'cancelled') {
            const listing = await Listing.findById(order.listingId);
            if (listing && new Date(listing.expiresAt) > new Date()) {
                listing.status = 'active';
                await listing.save();
            }
            // Clear pickup code if cancelled/rejected
            order.pickupCode = undefined;
        }

        // Generate pickup code when status becomes ready
        if (newStatus === 'ready' && currentStatus !== 'ready') {
            order.pickupCode = generatePickupCode();
            order.failedVerificationAttempts = 0;
        }

        order.status = newStatus;

        const updatedOrder = await order.save();
        const safeOrder = stripCodeIfSupplier(updatedOrder, req.user);
        res.json(safeOrder);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Verify order pickup
// @route   POST /api/orders/:id/verify
// @access  Private (Supplier)
export const verifyPickup = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only the supplier can verify
        if (order.supplierId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the supplier of this order can verify pickup' });
        }

        if (order.status !== 'ready') {
            return res.status(400).json({ message: `Order is not ready for pickup. Current status: ${order.status}` });
        }
        
        // Check brute force
        if (order.failedVerificationAttempts >= 5) {
            return res.status(429).json({ message: 'Too many failed verification attempts. Please contact support.' });
        }

        const { verificationCode } = req.body;

        if (!verificationCode || verificationCode.toUpperCase() !== order.pickupCode) {
            order.failedVerificationAttempts += 1;
            await order.save();
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Successful verification
        order.status = 'completed';
        order.pickupVerifiedAt = new Date();
        order.pickupVerifiedBy = req.user._id;
        order.verificationMethod = 'code';
        order.pickupCode = undefined; // Clear the code so it can't be reused or viewed again
        
        const updatedOrder = await order.save();
        res.json(updatedOrder);

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
