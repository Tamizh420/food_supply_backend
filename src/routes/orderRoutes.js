import express from 'express';
import { requestOrder, getOrderById, getMyOrders, getOrders, updateOrderStatus, verifyPickup } from '../controllers/orderController.js';
import { protect, admin, supplier } from '../middlewares/authMiddleware.js';
import { validate, validateOrderRequest, validateOrderStatusUpdate } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, validateOrderRequest, validate, requestOrder)
    .get(protect, admin, getOrders);
    
router.route('/myorders').get(protect, getMyOrders);

router.route('/:id').get(protect, getOrderById);
router.route('/:id/status').put(protect, validateOrderStatusUpdate, validate, updateOrderStatus); // Controller checks if user is supplier
router.route('/:id/verify').post(protect, supplier, verifyPickup);
export default router;
