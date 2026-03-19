const Order = require('../models/Order');
const Product = require('../models/Product');

exports.getAdminDashboard = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3; 
        const skip = (page - 1) * limit;

        const orderPage = parseInt(req.query.orderPage) || 1;
        const orderLimit = 5; 
        const orderSkip = (orderPage - 1) * orderLimit;

        //  Fetch Paginated Products
        const totalProducts = await Product.countDocuments();
        const products = await Product.find()
            .skip(skip)
            .limit(limit);

        //  Fetch Paginated Active Orders 
        const activeOrdersQuery = { status: { $nin: ['Completed', 'Cancelled'] } };
        const totalActiveOrders = await Order.countDocuments(activeOrdersQuery);
        
        const activeOrders = await Order.find(activeOrdersQuery)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(orderSkip)
            .limit(orderLimit);

        // Fetch Completed Orders 
        const completedOrders = await Order.find({ status: 'Completed' })
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        res.render('admin-dashboard', { 
            activeOrders, 
            completedOrders,
            menu: products, 
            // Product Pagination Data
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            // Order Pagination Data
            orderCurrentPage: orderPage,
            orderTotalPages: Math.ceil(totalActiveOrders / orderLimit),
            error: null 
        });
    } catch (err) {
        console.error(err);
        res.render('admin-dashboard', { 
            activeOrders: [], 
            completedOrders: [], 
            menu: [], 
            currentPage: 1, 
            totalPages: 1, 
            orderCurrentPage: 1,
            orderTotalPages: 1,
            error: "Database Error" 
        });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const { name, price, category, imageUrl, stock } = req.body;
        const newProduct = new Product({ 
            name, 
            price: Number(price), 
            category, 
            // Handles both manual URL and empty state
            image: imageUrl || 'https://placehold.co/400x300?text=No+Image',
            stock: Number(stock) || 0,
            isAvailable: true
        });
        await newProduct.save();
        res.redirect('/admin-dashboard');
    } catch (err) {
        console.error("Add Product Error:", err);
        res.redirect('/admin-dashboard');
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { productId, stock, isAvailable } = req.body;
        await Product.findByIdAndUpdate(productId, {
            stock: Number(stock),
            // checkbox 'on' or 'true' from the form
            isAvailable: isAvailable === 'true' || isAvailable === 'on'
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
        await Order.findByIdAndUpdate(req.params.id, { status });
        res.json({ success: true });
    } catch (error) {
        console.error("Update Status Error:", error);
        res.status(500).json({ success: false });
    }
};