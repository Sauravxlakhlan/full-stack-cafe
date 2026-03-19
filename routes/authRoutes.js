const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// PUBLIC ROUTES
router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// STUDENT ROUTES
// Note: Use '/' for the main dashboard if that's your home page
router.get('/', verifyToken, authController.getDashboard); 
router.post('/place-order', verifyToken, authController.placeOrder);

// ADMIN ROUTES
// Updated to match your EJS links
router.get('/admin-dashboard', verifyToken, isAdmin, adminController.getAdminDashboard);
router.post('/admin/add-product', verifyToken, isAdmin, adminController.addProduct);
router.post('/admin/update-stock', verifyToken, isAdmin, adminController.updateStock); // Added this for your stock form
router.post('/admin/order-status/:id', verifyToken, isAdmin, adminController.updateOrderStatus);

// LOGOUT
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

module.exports = router;