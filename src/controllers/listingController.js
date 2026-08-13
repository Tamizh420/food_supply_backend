import Listing from '../models/Listing.js';

// @desc    Fetch all active listings (for buyers)
// @route   GET /api/listings
// @access  Public
export const getListings = async (req, res) => {
    try {
        const listings = await Listing.find({ status: 'active' })
            .populate('supplierId', 'name email verified geolocation')
            .sort({ expiresAt: 1 }); // Soonest to expire first
        res.json(listings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Fetch supplier's own listings
// @route   GET /api/listings/mylistings
// @access  Private/Supplier
export const getMyListings = async (req, res) => {
    try {
        const listings = await Listing.find({ supplierId: req.user._id })
            .sort({ createdAt: -1 });
        res.json(listings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Fetch single listing
// @route   GET /api/listings/:id
// @access  Public
export const getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)
            .populate('supplierId', 'name email verified');
        if (listing) {
            res.json(listing);
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a listing
// @route   POST /api/listings
// @access  Private/Supplier
export const createListing = async (req, res) => {
    try {
        const { foodType, quantity, cookedAt, expiresAt, pricingType, price, images, pickupLocation } = req.body;

        const listing = new Listing({
            foodType,
            quantity,
            cookedAt,
            expiresAt,
            pricingType,
            price: pricingType === 'paid' ? price : 0,
            images,
            pickupLocation,
            supplierId: req.user._id,
        });

        const createdListing = await listing.save();
        res.status(201).json(createdListing);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update a listing
// @route   PUT /api/listings/:id
// @access  Private/Supplier
export const updateListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);

        if (listing) {
            if (listing.supplierId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(401).json({ message: 'Not authorized to update this listing' });
            }

            listing.foodType = req.body.foodType || listing.foodType;
            listing.quantity = req.body.quantity || listing.quantity;
            listing.expiresAt = req.body.expiresAt || listing.expiresAt;
            listing.pricingType = req.body.pricingType || listing.pricingType;
            listing.price = req.body.pricingType === 'paid' ? (req.body.price || listing.price) : 0;
            listing.status = req.body.status || listing.status;

            const updatedListing = await listing.save();
            res.json(updatedListing);
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a listing
// @route   DELETE /api/listings/:id
// @access  Private/Supplier
export const deleteListing = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);

        if (listing) {
             if (listing.supplierId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(401).json({ message: 'Not authorized to delete this listing' });
            }
            await Listing.deleteOne({ _id: listing._id });
            res.json({ message: 'Listing removed' });
        } else {
            res.status(404).json({ message: 'Listing not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};
