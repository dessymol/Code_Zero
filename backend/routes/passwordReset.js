// backend/routes/passwordReset.js
const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/passwordResetController');

/**
 * @route   POST /api/password-reset/request-otp
 * @desc    Request OTP for password reset
 * @access  Public
 * @body    { email, userType: 'admin' | 'faculty' | 'student' }
 */
router.post('/request-otp', passwordResetController.requestOTP);

/**
 * @route   POST /api/password-reset/verify-otp
 * @desc    Verify OTP
 * @access  Public
 * @body    { email, otp, userType }
 */
router.post('/verify-otp', passwordResetController.verifyOTP);

/**
 * @route   POST /api/password-reset/reset-password
 * @desc    Reset password using verified OTP
 * @access  Public
 * @body    { email, otp, newPassword, userType }
 */
router.post('/reset-password', passwordResetController.resetPassword);

/**
 * @route   POST /api/password-reset/resend-otp
 * @desc    Resend OTP
 * @access  Public
 * @body    { email, userType }
 */
router.post('/resend-otp', passwordResetController.resendOTP);

module.exports = router;
