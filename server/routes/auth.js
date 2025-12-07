const express = require('express');
const { signup, login } = require('../controllers/authController');

const router = express.Router();

/**
 * Authentication routes
 */

// POST /api/auth/signup - Register new user
router.post('/signup', signup);

// POST /api/auth/login - Login user
router.post('/login', login);

module.exports = router;
