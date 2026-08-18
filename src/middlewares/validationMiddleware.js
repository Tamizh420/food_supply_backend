import { body, query, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

    return res.status(400).json({
        errors: extractedErrors,
    });
};

export const validateRegister = [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['supplier', 'buyer', 'ngo', 'admin']).withMessage('Invalid role'),
];

export const validateLogin = [
    body('email').isEmail().withMessage('Please include a valid email'),
    body('password').exists().withMessage('Password is required'),
];

export const validateListing = [
    body('foodType').notEmpty().withMessage('Food type is required'),
    body('quantity').notEmpty().withMessage('Quantity is required'),
    body('cookedAt').isISO8601().toDate().withMessage('Valid cookedAt date is required'),
    body('expiresAt').isISO8601().toDate().withMessage('Valid expiresAt date is required')
        .custom((value, { req }) => {
            if (req.body.cookedAt && new Date(value) <= new Date(req.body.cookedAt)) {
                throw new Error('expiresAt must be after cookedAt');
            }
            return true;
        }),
    body('pricingType').isIn(['paid', 'free']).withMessage('Pricing type must be paid or free'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('pickupLocation.lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude between -90 and 90 is required'),
    body('pickupLocation.lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude between -180 and 180 is required'),
    body('pickupLocation.address').notEmpty().withMessage('Address is required'),
];

export const validateOrderRequest = [
    body('listingId').isMongoId().withMessage('Valid listing ID is required'),
    body('scheduledPickupTime').optional().isISO8601().toDate().withMessage('Valid scheduled time is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
];

export const validateNearbyQuery = [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    query('radius').optional().isFloat({ min: 0, max: 100 }).withMessage('Radius must be between 0 and 100 km'),
    query('pricingType').optional().isIn(['paid', 'free']).withMessage('Pricing type must be paid or free'),
    query('sort').optional().isIn(['nearest', 'recent', 'price', 'expiring']).withMessage('Invalid sort parameter')
];

export const validateOrderStatusUpdate = [
    body('status').isIn(['requested', 'accepted', 'ready', 'completed', 'rejected', 'cancelled']).withMessage('Invalid status'),
];
