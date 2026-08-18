import express from 'express';
import { authUser, registerUser, getUserProfile } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { validate, validateRegister, validateLogin } from '../middlewares/validationMiddleware.js';

const router = express.Router();

router.post('/register', validateRegister, validate, registerUser);
router.post('/login', validateLogin, validate, authUser);
router.get('/profile', protect, getUserProfile);

export default router;
