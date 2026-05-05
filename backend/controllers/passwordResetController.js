const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, Student } = require('../models');
const { sendMail } = require('../utils/mailer');

const isPlaceholderValue = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;

    return (
        normalized.includes('your_email') ||
        normalized.includes('your-real-gmail') ||
        normalized.includes('your_app_password') ||
        normalized.includes('app-password') ||
        normalized.includes('example.com') ||
        normalized === 'changeme'
    );
};

const hasUsableEmailConfig = () => (
    !isPlaceholderValue(process.env.EMAIL_USER) &&
    !isPlaceholderValue(process.env.EMAIL_PASS)
);

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const sendOTPEmail = async (email, otp, userType) => {
    console.log(`
    ========================================
    PASSWORD RESET OTP (Log)
    ========================================
    To: ${email}
    User Type: ${userType}
    OTP Code: ${otp}
    ========================================
    `);

    if (!hasUsableEmailConfig()) {
        const message = 'Email credentials are missing or still set to placeholder values in backend/.env.';
        console.warn(message);
        return { delivered: false, fallback: message };
    }

    try {
        await sendMail({
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

        console.log(`Email sent successfully to ${email}`);
        return { delivered: true, fallback: null };
    } catch (error) {
        console.error('Failed to send OTP email:', error);
        return {
            delivered: false,
            fallback: error.message || 'Failed to send OTP email'
        };
    }
};

const findUserByType = async (email, userType, withPassword = false) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedType = String(userType || '').trim().toLowerCase();

    if (normalizedType === 'student') {
        return Student.findOne({ where: { email: normalizedEmail } });
    }

    const query = withPassword
        ? User.scope('withPassword')
        : User;

    const user = await query.findOne({
        where: { email: normalizedEmail },
        ...(withPassword ? {} : { attributes: { include: ['reset_otp', 'reset_otp_expires'] } })
    });

    if (!user) return null;
    if (normalizedType === 'admin' && user.role !== 'admin') return null;
    if (normalizedType === 'faculty' && user.role !== 'faculty') return null;

    return user;
};

exports.requestOTP = async (req, res) => {
    try {
        const { email, userType } = req.body || {};

        if (!email || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email and user type are required'
            });
        }

        const normalizedType = String(userType).toLowerCase();
        if (!['admin', 'faculty', 'student'].includes(normalizedType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type'
            });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await findUserByType(normalizedEmail, normalizedType, true);

        if (!user) {
            return res.status(200).json({
                success: true,
                message: 'If the email exists, an OTP has been sent'
            });
        }

        const otp = generateOTP();
        user.reset_otp = otp;
        user.reset_otp_expires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const emailResult = await sendOTPEmail(normalizedEmail, otp, normalizedType);

        return res.status(200).json({
            success: true,
            message: emailResult.delivered
                ? 'OTP sent to your email address'
                : 'OTP generated, but email delivery failed. Check backend email settings or server logs.'
        });
    } catch (error) {
        console.error('Request OTP error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to send OTP. Please try again.'
        });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp, userType } = req.body || {};

        if (!email || !otp || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, and user type are required'
            });
        }

        const user = await findUserByType(email, userType, false);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP or email'
            });
        }

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

        if (String(user.reset_otp) !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, userType } = req.body || {};

        if (!email || !otp || !newPassword || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, new password, and user type are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const user = await findUserByType(email, userType, true);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

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

        if (String(user.reset_otp) !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.reset_otp = null;
        user.reset_otp_expires = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

exports.resendOTP = async (req, res) => exports.requestOTP(req, res);
