import express from 'express';
import { checkoutStub, verifyPaymentStub } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/checkout').post(protect, checkoutStub);
router.route('/verify').post(protect, verifyPaymentStub);

export default router;
