const Order = require('../models/Order');
const Product = require('../models/Product');

exports.getAdminDashboard = async (req, res) => {
    try {
        // Product Pagination - matching pPage/oPage if you use those in server.js
        // but sticking to page/orderPage as per your controller logic
        const page = parseInt(req.query.page) || 1;
        const limit = 3; 
        const skip = (page - 1) * limit;

        const orderPage = parseInt(req.query.orderPage) || 1;
        const orderLimit = 5; 
        const orderSkip = (orderPage - 1) * orderLimit;

        const totalProducts = await Product.countDocuments();
        const products = await Product.find()
            .skip(skip)
            .limit(limit);

        const activeOrdersQuery = { status: { $nin: ['Completed', 'Cancelled'] } };
        const totalActiveOrders = await Order.countDocuments(activeOrdersQuery);
        
        const activeOrders = await Order.find(activeOrdersQuery)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(orderSkip)
            .limit(orderLimit);

        const completedOrders = await Order.find({ status: 'Completed' })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        res.render('admin-dashboard', { 
            activeOrders, 
            completedOrders,
            menu: products, 
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            orderCurrentPage: orderPage,
            orderTotalPages: Math.ceil(totalActiveOrders / orderLimit),
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.render('admin-dashboard', { 
            activeOrders: [], completedOrders: [], menu: [], 
            currentPage: 1, totalPages: 1, 
            orderCurrentPage: 1, orderTotalPages: 1,
            error: "Database Error" 
        });
    }
};

exports.addProduct = async (req, res) => {
    try {
        // 1. Check if req.body exists (prevents the destructure error)
        if (!req.body) {
            console.error("Form body is missing. Check Multer setup.");
            return res.redirect('/admin-dashboard');
        }

        const { name, price, category, stock } = req.body;

        // 2. Handle the Image File from Multer
        // Your EJS uses name="imageFile", so Multer puts it in req.file
        let imagePath = '/images/default-food.png'; 
        if (req.file) {
            imagePath = `/images/${req.file.filename}`;
        }

        const newProduct = new Product({ 
            name, 
            price: Number(price), 
            category, 
            image: imagePath,
            stock: Number(stock) || 0,
            isAvailable: true
        });

        await newProduct.save();
        console.log("✅ Product Added Successfully");
        res.redirect('/admin-dashboard');
    } catch (err) {
        console.error("❌ Add Product Error:", err);
        res.redirect('/admin-dashboard');
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { productId, stock, isAvailable } = req.body;
        
        // Safety check for ID
        if (!productId) return res.status(400).send("Product ID missing");

        await Product.findByIdAndUpdate(productId, {
            stock: Number(stock),
            // Handles checkbox logic correctly
            isAvailable: isAvailable === 'true' || isAvailable === 'on' || isAvailable === true
        });
        res.redirect('/admin-dashboard');
    } catch (err) {
        console.error("Update Stock Error:", err);
        res.status(500).send("Update Failed");
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const orderId = req.params.id;

        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        
        // Trigger Socket.io notification if needed
        const io = req.app.get('socketio');
        if (io && updatedOrder && updatedOrder.userId) {
            io.to(updatedOrder.userId.toString()).emit('orderUpdate', {
                orderId: updatedOrder._id.toString().slice(-6),
                status: status
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ success: false });
    }
};