const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Please provide your name'],
        trim: true 
    },
    email: { 
        type: String, 
        required: [true, 'Please provide an email'], 
        unique: true,
        lowercase: true,
        trim: true 
    },
    password: { 
        type: String, 
        required: [true, 'Please provide a password'] 
    },
    collegeId: { 
        type: String, 
        required: [true, 'College ID is required for verification'],
        unique: true, // Prevents multiple accounts for one ID
        trim: true 
    },
    role: { 
        type: String, 
        enum: ['Student', 'Admin'], 
        default: 'Student' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Create an index for email to speed up the login process
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);