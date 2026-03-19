const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'canteen_secret_789';

exports.verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        res.clearCookie('token').redirect('/login');
    }
};

exports.isAdmin = (req, res, next) => {
   if (req.user && req.user.role && req.user.role.toLowerCase() === 'admin') {
        next();
    } else {
        res.status(403).send("Access Denied: Admins Only");
    }
};