import express from 'express';
import { createPaymentOrder, verifyPayment, razorpayWebhook } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/create-order').post(protect, createPaymentOrder);
router.route('/verify').post(protect, verifyPayment);
router.route('/webhook').post(razorpayWebhook);

export default router;
