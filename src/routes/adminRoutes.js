import express from 'express';
import { getStats, getUsers, createUser, updateUserRole } from '../controllers/adminController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply protect and admin middleware to all routes in this file
router.use(protect, admin);

router.get('/stats', getStats);

router.route('/users')
    .get(getUsers)
    .post(createUser);

router.put('/users/:id/role', updateUserRole);

export default router;
