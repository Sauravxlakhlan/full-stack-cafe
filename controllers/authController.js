const User = require('../models/User');
const Product = require('../models/Product'); 
const Order = require('../models/Order');     
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'canteen_secret_789';

exports.getSignup = (req, res) => res.render('signup', { error: null });
exports.getLogin = (req, res) => res.render('login', { error: null });

exports.postSignup = async (req, res) => {
    try {
        const { name, email, password, collegeId, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.render('signup', { error: 'Email already registered' });

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            collegeId,
            role: role || 'Student' 
        });
        
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        res.render('signup', { error: 'Signup failed.' });
    }
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('login', { error: "Invalid email or password" });
        }

        // Standardize role to lowercase
        const userRole = user.role.toLowerCase(); 

        // Payload uses 'id'
        const token = jwt.sign(
            { id: user._id, name: user.name, role: userRole },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, { httpOnly: true });

        if (userRole === 'admin') {
            res.redirect('/admin-dashboard'); 
        } else {
            res.redirect('/');
        }
    } catch (err) {
        res.render('login', { error: 'Login error occurred' });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const selectedCategory = req.query.category;
        
        // Ensure req.user exists before accessing id
        if (!req.user) return res.redirect('/login');

        let filter = { 
            isAvailable: { $ne: false }, 
            stock: { $ne: 0 } 
        };

        if (selectedCategory && selectedCategory !== 'All') {
            filter.category = selectedCategory;
        }

        const products = await Product.find(filter);
        // Using req.user.id because that's what we put in the JWT payload
        const myOrders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });

        res.render('dashboard', { 
            user: req.user, 
            menu: products,
            myOrders: myOrders,
            activeCategory: selectedCategory || 'All' 
        });
    } catch (err) {
        console.error("Dashboard Error:", err);
        res.render('dashboard', { user: {}, menu: [], myOrders: [], activeCategory: 'All' });
    }
};

exports.placeOrder = async (req, res) => {
    try {
        const { items, totalAmount, pickupTime } = req.body;
        
        if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

        const newOrder = new Order({
            userId: req.user.id, 
            items,
            totalAmount,
            pickupTime,
            status: 'Pending'
        });
        await newOrder.save();
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};