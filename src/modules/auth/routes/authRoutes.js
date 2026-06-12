const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../../../middlewares/authMiddleware');

const router = express.Router();

// Public Routes (GET for rendering views, POST for data submission)
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/register', authController.register);

const userController = require('../../users/controllers/userController');

// Protected Routes
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);
router.get('/profile', protect, authController.getProfile);
router.post('/profile', protect, authController.updateProfile);

// Password Self-Service
router.post('/change-password', protect, userController.updateMyPassword);

module.exports = router;
