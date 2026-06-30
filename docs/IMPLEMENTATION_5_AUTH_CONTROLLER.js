// FILE: TeachingBoard-backend/src/controllers/authController.js
// FUNCTIONS: register, login, refresh, logout

const User = require('../models/User');
const ParentAccount = require('../models/ParentAccount');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Generate unique student code
 * Format: STU-<timestamp>-<random>
 */
const generateStudentCode = async () => {
  while (true) {
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 7);
    const code = `STU-${timestamp}-${random}`;

    const exists = await User.findOne({ student_code: code });
    if (!exists) return code;
  }
};

/**
 * Generate unique parent code
 * Format: PAR-<timestamp>-<random>
 */
const generateParentCode = async () => {
  while (true) {
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 7);
    const code = `PAR-${timestamp}-${random}`;

    const exists = await ParentAccount.findOne({ parent_code: code });
    if (!exists) return code;
  }
};

/**
 * Student Registration
 * POST /api/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Phone validation (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number (10 digits required)'
      });
    }

    // Password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered'
      });
    }

    // Check duplicate phone
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        message: 'This phone number is already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate student code
    const studentCode = await generateStudentCode();

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      student_code: studentCode,
      payment_status: 'pending',
      subscription_status: 'inactive',
      first_login_date: new Date()
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        student_id: user._id,
        student_code: user.student_code,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Student Login
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user with password (select: false by default)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        student_id: user._id,
        student_code: user.student_code,
        email: user.email,
        name: user.name,
        welcome_seen: user.welcome_seen,
        subscription_status: user.subscription_status
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Refresh Token
 * POST /api/auth/refresh
 */
exports.refreshToken = (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Generate new access token
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Token refreshed'
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
exports.logout = (req, res, next) => {
  try {
    res.clearCookie('token');
    res.clearCookie('refreshToken');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Profile
 * GET /api/student/profile
 */
exports.getStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const user = await User.findById(studentId).select('-password -student_pin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get Student Codes
 * GET /api/student/codes
 */
exports.getStudentCodes = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const user = await User.findById(studentId).select('student_code parent_code');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        student_code: user.student_code,
        parent_code: user.parent_code
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Mark Welcome as Seen
 * POST /api/student/welcome-seen
 */
exports.markWelcomeSeen = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const user = await User.findByIdAndUpdate(
      studentId,
      {
        welcome_seen: true,
        welcome_shown_date: new Date()
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Welcome marked as seen'
    });

  } catch (error) {
    next(error);
  }
};
