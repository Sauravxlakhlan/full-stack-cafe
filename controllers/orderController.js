const Order = require('../models/Order');

exports.placeOrder = async (req, res) => {
    try {
        const { items, totalAmount, pickupTime } = req.body;

        // Validation
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const newOrder = new Order({
            userId: req.user._id,
            items: items,
            totalAmount: totalAmount,
            pickupTime: pickupTime,
            status: 'Pending'
        });

        await newOrder.save();
        
        console.log("New Order Created:", newOrder._id);
        res.json({ success: true, orderId: newOrder._id });
    } catch (err) {
        console.error("Order Placement Error:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};