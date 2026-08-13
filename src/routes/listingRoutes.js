import express from 'express';
import { getListings, getMyListings, getListingById, createListing, updateListing, deleteListing } from '../controllers/listingController.js';
import { protect, supplier } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getListings)
    .post(protect, supplier, createListing);

router.route('/mylistings')
    .get(protect, supplier, getMyListings);

router.route('/:id')
    .get(getListingById)
    .put(protect, supplier, updateListing)
    .delete(protect, supplier, deleteListing);

export default router;
