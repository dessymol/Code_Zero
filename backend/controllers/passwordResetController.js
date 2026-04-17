// backend/controllers/passwordResetController.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Student } = require('../models');

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Send OTP via email (mock implementation - replace with actual email service)
 * You can integrate with services like SendGrid, AWS SES, Nodemailer, etc.
 */
const sendOTPEmail = async (email, otp, userType) => {
    // Log OTP for dev/debugging
    console.log(`
    ========================================
    PASSWORD RESET OTP (Log)
    ========================================
    To: ${email}
    User Type: ${userType}
    OTP Code: ${otp}
    ========================================
    `);

    // Use Nodemailer if credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Password Reset OTP - CodeZero',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <h2 style="color: #4f46e5;">Password Reset Request</h2>
                        <p>Hello,</p>
                        <p>You requested to reset your password for your <strong>${userType}</strong> account.</p>
                        <p>Please use the following One-Time Password (OTP) to proceed:</p>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                            <span style="color: #4f46e5; font-size: 28px; letter-spacing: 5px; font-weight: bold;">${otp}</span>
                        </div>
                        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
                        <p style="font-size: 0.9em; color: #666;">If you did not request this, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 0.8em; color: #888;">CodeZero Team</p>
                    </div>
                `
            });
            console.log('✅ Email sent successfully to ' + email);
        } catch (emailErr) {
            console.error('❌ Failed to send email:', emailErr);
            // Don't throw, so the API still succeeds (OTP is still in DB/Logs)
        }
    } else {
        console.log('⚠️ Email credentials not found in .env. Email was NOT sent. Check console logs for OTP.');
    }

    return true;
};

/**
 * Request OTP for password reset
 * Works for Admin, Faculty (User model) and Student
 */
exports.requestOTP = async (req, res) => {
    try {
        const { email, userType } = req.body;

        if (!email || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email and user type are required'
            });
        }

        // Validate userType
        if (!['admin', 'faculty', 'student'].includes(userType.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type'
            });
        }

        let user;
        const normalizedType = userType.toLowerCase();

        // Find user based on type
        if (normalizedType === 'student') {
            user = await Student.findOne({ where: { email } });
        } else {
            // Admin and Faculty are in User model
            user = await User.findOne({
                where: { email },
                attributes: { include: ['password'] } // Include password field
            });

            // Verify role matches
            if (user && normalizedType === 'admin' && user.role !== 'admin') {
                user = null;
            } else if (user && normalizedType === 'faculty' && user.role !== 'faculty') {
                user = null;
            }
        }

        if (!user) {
            // For security, don't reveal if email exists
            return res.status(200).json({
                success: true,
                message: 'If the email exists, an OTP has been sent'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP to database
        user.reset_otp = otp;
        user.reset_otp_expires = otpExpires;
        await user.save();

        // Send OTP via email
        await sendOTPEmail(email, otp, normalizedType);

        res.status(200).json({
            success: true,
            message: 'OTP sent to your email address',
            // For development only - remove in production:
            dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined
        });

    } catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP. Please try again.'
        });
    }
};

/**
 * Verify OTP
 */
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp, userType } = req.body;

        if (!email || !otp || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, and user type are required'
            });
        }

        let user;
        const normalizedType = userType.toLowerCase();

        // Find user
        if (normalizedType === 'student') {
            user = await Student.findOne({ where: { email } });
        } else {
            user = await User.findOne({
                where: { email },
                attributes: { include: ['password', 'reset_otp', 'reset_otp_expires'] }
            });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP or email'
            });
        }

        // Check if OTP exists and is not expired
        if (!user.reset_otp || !user.reset_otp_expires) {
            return res.status(400).json({
                success: false,
                message: 'No OTP request found. Please request a new OTP.'
            });
        }

        if (new Date() > new Date(user.reset_otp_expires)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Verify OTP
        if (user.reset_otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully'
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
};

/**
 * Reset password using OTP
 */
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, userType } = req.body;

        if (!email || !otp || !newPassword || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, new password, and user type are required'
            });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        let user;
        const normalizedType = userType.toLowerCase();

        // Find user
        if (normalizedType === 'student') {
            user = await Student.findOne({ where: { email } });
        } else {
            user = await User.scope('withPassword').findOne({ where: { email } });
        }

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        // Verify OTP again
        if (!user.reset_otp || !user.reset_otp_expires) {
            return res.status(400).json({
                success: false,
                message: 'No OTP request found'
            });
        }

        if (new Date() > new Date(user.reset_otp_expires)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        if (user.reset_otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP
        user.password = hashedPassword;
        user.reset_otp = null;
        user.reset_otp_expires = null;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

/**
 * Resend OTP (with rate limiting recommended)
 */
exports.resendOTP = async (req, res) => {
    try {
        const { email, userType } = req.body;

        if (!email || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email and user type are required'
            });
        }

        // Reuse the requestOTP logic
        return exports.requestOTP(req, res);

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend OTP'
        });
    }
};
