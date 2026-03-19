require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const http = require('http'); // 1. Import http
const { Server } = require('socket.io'); // 2. Import Socket.io

const Product = require('./models/Product');
const Order = require('./models/Order'); 
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app); // 3. Create HTTP server
const io = new Server(server); // 4. Initialize Socket.io

const JWT_SECRET = process.env.JWT_SECRET || 'canteen_secret_789';

// 5. Socket.io Connection Logic
io.on('connection', (socket) => {
    // When a user logs in, they join a private room based on their User ID
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });
});

// Middleware to make 'io' accessible in routes
app.set('socketio', io);

// Storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/images'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());                                            
app.use(cookieParser());                                            

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/canteenDB')
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ Connection Error:', err));

// Middlewares
const isAdmin = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please login" });
        }
        return res.redirect('/login');
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.role.toLowerCase() === 'admin') { 
            req.user = decoded;
            next();
        } else {
            res.status(403).json({ success: false, message: "Not an admin" });
        }
    } catch (err) {
        res.clearCookie('token');
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ success: false, message: "Session expired" });
        }
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

// User Dashboard
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

// Admin Dashboard - PAGINATED
app.get('/admin-dashboard', isAdmin, async (req, res) => {
    try {
        const pPage = parseInt(req.query.pPage) || 1;
        const pLimit = 3;
        const pSkip = (pPage - 1) * pLimit;
        const totalProducts = await Product.countDocuments();

        const oPage = parseInt(req.query.oPage) || 1;
        const oLimit = 4;
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
            pCurrentPage: pPage,
            pTotalPages: Math.ceil(totalProducts / pLimit),
            oCurrentPage: oPage,
            oTotalPages: Math.ceil(totalOrdersCount / oLimit),
            error: null 
        });
    } catch (err) { 
        res.status(500).send("Error loading admin dashboard"); 
    }
});

// --- UPDATED: Admin Order Status with Socket Emit ---
app.post('/admin/order-status/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body; 
        const order = await Order.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
        
        // 6. Trigger live notification
        const io = req.app.get('socketio');
        io.to(order.userId.toString()).emit('orderUpdate', {
            orderId: order._id.toString().slice(-6), // Send last 6 digits of ID
            status: status
        });

        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/place-order', isLoggedIn, async (req, res) => {
    try {
        const { items, totalAmount, pickupTime } = req.body;
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product || product.stock < item.qty || product.isAvailable === false) {
                return res.status(400).json({ success: false, message: `${item.name} is out of stock` });
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
// 7. Use server.listen instead of app.listen
server.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));