import express from 'express';
import { requestOrder, getOrderById, getMyOrders, getOrders, updateOrderStatus } from '../controllers/orderController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, requestOrder)
    .get(protect, admin, getOrders);
    
router.route('/myorders').get(protect, getMyOrders);

router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').put(protect, updateOrderStatus); // Controller checks if user is supplier

export default router;
