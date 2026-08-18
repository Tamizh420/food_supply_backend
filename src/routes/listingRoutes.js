import express from 'express';
import { getListings, getNearbyListings, getMyListings, getListingById, createListing, updateListing, deleteListing } from '../controllers/listingController.js';
import { protect, supplier } from '../middlewares/authMiddleware.js';
import { validate, validateListing, validateNearbyQuery } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getListings)
    .post(protect, supplier, validateListing, validate, createListing);

router.get('/nearby', validateNearbyQuery, validate, getNearbyListings);

router.route('/mylistings')
    .get(protect, supplier, getMyListings);

router.route('/:id')
    .get(getListingById)
    .put(protect, supplier, validateListing, validate, updateListing)
    .delete(protect, supplier, deleteListing);

export default router;
