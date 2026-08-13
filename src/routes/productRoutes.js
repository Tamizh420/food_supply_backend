import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js';
import { protect, supplier } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getProducts)
    .post(protect, supplier, createProduct);

router.route('/:id')
    .get(getProductById)
    .put(protect, supplier, updateProduct)
    .delete(protect, supplier, deleteProduct);

export default router;
