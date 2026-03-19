const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// --- MULTER SETUP ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// PUBLIC ROUTES
router.get('/signup', authController.getSignup);
router.post('/signup', authController.postSignup);
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

// STUDENT ROUTES
router.get('/', verifyToken, authController.getDashboard); 
router.post('/place-order', verifyToken, authController.placeOrder);

// ADMIN ROUTES
router.get('/admin-dashboard', verifyToken, isAdmin, adminController.getAdminDashboard);

// FIXED LINE: Added upload.single('imageFile')
// 'imageFile' must match the 'name' attribute in your EJS <input type="file">
router.post('/admin/add-product', verifyToken, isAdmin, upload.single('imageFile'), adminController.addProduct);

router.post('/admin/update-stock', verifyToken, isAdmin, adminController.updateStock);
router.post('/admin/order-status/:id', verifyToken, isAdmin, adminController.updateOrderStatus);

// LOGOUT
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

module.exports = router;