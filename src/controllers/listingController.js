import Listing from '../models/Listing.js';

// Haversine formula to calculate distance between two coordinates in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

// @desc    Fetch nearby active listings
// @route   GET /api/listings/nearby
// @access  Public
export const getNearbyListings = async (req, res) => {
    try {
        const { latitude, longitude, radius, pricingType, foodType, sort } = req.query;

        const maxDistance = radius ? parseFloat(radius) * 1000 : 10000; // default 10km in meters

        const pipeline = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    distanceField: 'distanceKm',
                    maxDistance: maxDistance,
                    distanceMultiplier: 0.001, // Convert meters to km
                    spherical: true
                }
            },
            {
                $match: {
                    status: 'active',
                    expiresAt: { $gt: new Date() }
                }
            }
        ];

        if (pricingType) {
            pipeline.push({ $match: { pricingType } });
        }
        
        if (foodType) {
            pipeline.push({ $match: { foodType: { $regex: foodType, $options: 'i' } } });
        }

        // Apply sorting
        let sortObj = {};
        if (sort === 'nearest') {
            sortObj = { distanceKm: 1 };
        } else if (sort === 'recent') {
            sortObj = { createdAt: -1 };
        } else if (sort === 'price') {
            sortObj = { price: 1 };
        } else if (sort === 'expiring') {
            sortObj = { expiresAt: 1 };
        } else {
            sortObj = { distanceKm: 1 }; // Default to nearest
        }
        
        pipeline.push({ $sort: sortObj });

        // Execute pipeline
        let listings = await Listing.aggregate(pipeline);
        
        // Populate supplierId since aggregate doesn't do it automatically
        await Listing.populate(listings, { path: 'supplierId', select: 'name email verified geolocation' });

        res.json(listings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Fetch all active listings (for buyers)
// @route   GET /api/listings
// @access  Public
export const getListings = async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        const listings = await Listing.find({ status: 'active' })
            .populate('supplierId', 'name email verified geolocation')
            .sort({ expiresAt: 1 }); // Soonest to expire first

        let filteredListings = listings;

        // Apply radius filter if coordinates and radius are provided
        if (lat && lng && radius) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const maxRadius = parseFloat(radius);

            filteredListings = listings.filter(listing => {
                if (!listing.pickupLocation?.lat || !listing.pickupLocation?.lng) return false;
                const dist = getDistanceFromLatLonInKm(
                    userLat, userLng, 
                    listing.pickupLocation.lat, listing.pickupLocation.lng
                );
                // Attach distance to the object for sorting or display (optional, but useful)
                listing._doc.distanceKm = dist;
                return dist <= maxRadius;
            });
            
            // Optionally sort by closest if a location was provided
            filteredListings.sort((a, b) => a._doc.distanceKm - b._doc.distanceKm);
        }

        res.json(filteredListings);
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

        const geoPickupLocation = {
            address: pickupLocation.address,
            location: {
                type: 'Point',
                coordinates: [pickupLocation.lng, pickupLocation.lat]
            }
        };

        const listing = new Listing({
            foodType,
            quantity,
            cookedAt,
            expiresAt,
            pricingType,
            price: pricingType === 'paid' ? price : 0,
            images,
            pickupLocation: geoPickupLocation,
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
                return res.status(403).json({ message: 'Not authorized to update this listing' });
            }

            listing.foodType = req.body.foodType || listing.foodType;
            listing.quantity = req.body.quantity || listing.quantity;
            listing.expiresAt = req.body.expiresAt || listing.expiresAt;
            listing.pricingType = req.body.pricingType || listing.pricingType;
            listing.price = req.body.pricingType === 'paid' ? (req.body.price || listing.price) : 0;
            listing.status = req.body.status || listing.status;
            
            if (req.body.pickupLocation) {
                listing.pickupLocation = {
                    address: req.body.pickupLocation.address || listing.pickupLocation.address,
                    location: {
                        type: 'Point',
                        coordinates: [
                            req.body.pickupLocation.lng || listing.pickupLocation.location.coordinates[0],
                            req.body.pickupLocation.lat || listing.pickupLocation.location.coordinates[1]
                        ]
                    }
                };
            }

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
                return res.status(403).json({ message: 'Not authorized to delete this listing' });
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
