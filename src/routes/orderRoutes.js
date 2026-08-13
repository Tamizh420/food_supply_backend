import express from 'express';
import { addOrderItems, getOrderById, getMyOrders, getOrders, updateOrderStatus } from '../controllers/orderController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, addOrderItems)
    .get(protect, admin, getOrders);
    
router.route('/myorders').get(protect, getMyOrders);

router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').put(protect, admin, updateOrderStatus);

export default router;
