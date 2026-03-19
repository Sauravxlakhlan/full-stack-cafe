const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, enum: ['Breakfast', 'Lunch', 'Snacks', 'Drinks'], required: true },
    image: { type: String, required: true },
    description: { type: String },
    stock: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Product', productSchema);