import User from '../models/User.js';
import Order from '../models/Order.js';
import Listing from '../models/Listing.js';

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
export const getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        
        const listings = await Listing.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const listingStats = {
            active: 0,
            claimed: 0,
            expired: 0
        };
        
        listings.forEach(l => {
            if (l._id === 'active' || l._id === 'available') listingStats.active += l.count;
            if (l._id === 'claimed' || l._id === 'completed' || l._id === 'accepted' || l._id === 'ready') listingStats.claimed += l.count;
            if (l._id === 'expired') listingStats.expired += l.count;
        });

        res.json({ totalUsers, totalOrders, listingStats });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching stats' });
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching users' });
    }
};

// @desc    Create a user
// @route   POST /api/admin/users
// @access  Private/Admin
export const createUser = async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const user = await User.create({
            name,
            email,
            password,
            role: role || 'buyer'
        });
        
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error creating user' });
    }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.role = req.body.role || user.role;
            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                role: updatedUser.role
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error updating user role' });
    }
};
