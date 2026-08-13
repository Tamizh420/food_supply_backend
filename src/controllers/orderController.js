import Order from '../models/Order.js';
import Listing from '../models/Listing.js';

// @desc    Request to claim/buy a listing
// @route   POST /api/orders
// @access  Private (Buyer/NGO)
export const requestOrder = async (req, res) => {
    try {
        const { listingId, scheduledPickupTime } = req.body;

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
                return res.status(401).json({ message: 'Not authorized to view this order' });
            }
            res.json(order);
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
            
        res.json(orders);
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
        const isAdmin = req.user.role === 'admin';

        if (!isSupplier && !isAdmin) {
             return res.status(401).json({ message: 'Only supplier or admin can update status' });
        }

        const newStatus = req.body.status;
        order.status = newStatus || order.status;

        // If rejected or cancelled, free up the listing
        if (newStatus === 'rejected' || newStatus === 'cancelled') {
            const listing = await Listing.findById(order.listingId);
            if (listing && new Date(listing.expiresAt) > new Date()) {
                listing.status = 'active';
                await listing.save();
            }
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
