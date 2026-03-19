require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const http = require('http');
const fs = require('fs'); // Added for folder check
const { Server } = require('socket.io');

const Product = require('./models/Product');
const Order = require('./models/Order'); 
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const JWT_SECRET = process.env.JWT_SECRET || 'canteen_secret_789';

// --- INITIAL SETUP ---

// Ensure the upload directory exists or Multer will fail
const uploadDir = path.join(__dirname, 'public/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Socket.io Connection Logic
io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });
});

app.set('socketio', io);

// Storage setup for Product Images
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());                                            
app.use(cookieParser());                                            

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/canteenDB')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Connection Error:', err));

// --- MIDDLEWARES ---

const isAdmin = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role.toLowerCase() === 'admin') { 
            req.user = decoded;
            next();
        } else {
            res.status(403).send("Access Denied: Admins Only");
        }
    } catch (err) {
        res.clearCookie('token');
        res.redirect('/login');
    }
};

const isLoggedIn = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ success: false, message: "Please login" });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: "Session expired" });
    }
};

app.use('/', authRoutes);

// --- ROUTES ---

// 1. User Dashboard
app.get('/', async (req, res) => {
    try {
        const activeCategory = req.query.category || 'All';
        let filter = {}; 
        if (activeCategory !== 'All') filter.category = activeCategory;

        const menu = await Product.find(filter);
        let user = null;
        let myOrders = [];

        if (req.cookies.token) {
            try { 
                user = jwt.verify(req.cookies.token, JWT_SECRET);
                myOrders = await Order.find({ userId: user.id }).sort({ createdAt: -1 });
            } catch (err) {}
        }
        res.render('dashboard', { menu, activeCategory, user, myOrders });
    } catch (err) { res.status(500).send("Error loading dashboard"); }
});

// 2. Admin Dashboard
app.get('/admin-dashboard', isAdmin, async (req, res) => {
    try {
        const pPage = parseInt(req.query.page) || 1; 
        const pLimit = 5; 
        const pSkip = (pPage - 1) * pLimit;
        const totalProducts = await Product.countDocuments();

        const oPage = parseInt(req.query.orderPage) || 1;
        const oLimit = 5;
        const oSkip = (oPage - 1) * oLimit;
        const totalOrdersCount = await Order.countDocuments({ status: { $ne: 'Completed' } });

        const products = await Product.find().skip(pSkip).limit(pLimit);
        const activeOrders = await Order.find({ status: { $ne: 'Completed' } })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .skip(oSkip)
            .limit(oLimit);

        res.render('admin-dashboard', { 
            menu: products,
            activeOrders,
            currentPage: pPage,
            totalPages: Math.ceil(totalProducts / pLimit),
            orderCurrentPage: oPage,
            orderTotalPages: Math.ceil(totalOrdersCount / oLimit),
            error: null 
        });
    } catch (err) { 
        res.status(500).send("Error loading admin dashboard"); 
    }
});

// 3. Add New Product (REPAIRED ROUTE)
// --- ADMIN ROUTES ---

// 1. Ensure the route matches the form action: /admin/add-product
app.post('/admin/add-product', isAdmin, (req, res) => {
    // 2. Manually invoke multer here. 
    // 'imageFile' MUST match the 'name' attribute in your <input type="file">
    upload.single('imageFile')(req, res, async (err) => {
        if (err) {
            console.error("Multer Error:", err);
            return res.status(500).send("Upload Error");
        }

        // 3. AFTER upload.single runs, req.body is now populated!
        try {
            const { name, price, stock, category } = req.body;

            // Debugging: If this is still empty, check your EJS form tags
            console.log("Parsed Body:", req.body); 

            if (!name || !price) {
                return res.status(400).send("Name and Price are required.");
            }

            const imagePath = req.file ? `/images/${req.file.filename}` : '/images/default.png';

            const newProduct = new Product({
                name,
                price: parseFloat(price),
                stock: parseInt(stock) || 0,
                category,
                image: imagePath,
                isAvailable: true
            });

            await newProduct.save();
            res.redirect('/admin-dashboard');
        } catch (dbErr) {
            console.error("Database Error:", dbErr);
            res.status(500).send("Database Error");
        }
    });
});

// 4. Update Stock & Availability
app.post('/admin/update-stock', isAdmin, async (req, res) => {
    try {
        const { productId, stock, isAvailable } = req.body;
        await Product.findByIdAndUpdate(productId, {
            stock: parseInt(stock),
            isAvailable: isAvailable === 'true' || isAvailable === 'on' 
        });
        res.redirect('/admin-dashboard');
    } catch (err) {
        res.status(500).send("Error updating stock");
    }
});

// 5. Update Order Status
app.post('/admin/order-status/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body; 
        const order = await Order.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
        
        const io = req.app.get('socketio');
        if (order && order.userId) {
            io.to(order.userId.toString()).emit('orderUpdate', {
                orderId: order._id.toString().slice(-6),
                status: status
            });
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// 6. Place Order
app.post('/place-order', isLoggedIn, async (req, res) => {
    try {
        const { items, totalAmount, pickupTime } = req.body;
        
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product || product.stock < item.qty || !product.isAvailable) {
                return res.status(400).json({ success: false, message: `${item.name} is unavailable` });
            }
        }

        const order = new Order({ 
            userId: req.user.id, items, totalAmount, pickupTime, status: 'Pending'
        });
        await order.save();

        for (const item of items) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));