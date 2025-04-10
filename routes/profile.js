const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();

// Authentication middleware for profile routes
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
    req.user = decoded; // decoded contains user id in req.user.id
    next();
  });
};

// GET /api/profile - return the logged-in user's profile data
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ status: 'success', data: user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/profile - update the user's password
router.put('/', protect, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'New password must be at least 6 characters'
      });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Set the new password (the pre-save hook in user.js will hash it)
    user.password = newPassword;
    await user.save();
    res.json({ status: 'success', message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
