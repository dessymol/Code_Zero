const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { Op } = require('sequelize'); 
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    if (!normalizedEmail || !password) {
      throw new ApiError(400, 'Email and password are required');
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new ApiError(400, 'Invalid email format');
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new ApiError(400, 'Invalid credentials');
    }

    const user = await User.scope('withPassword').findOne({ where: { email: normalizedEmail } });
    if (!user || !user.is_active) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }

    // ✅ Generate JWT here
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new ApiError(401, 'Authentication required'));

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(new ApiError(400, 'Both current and new password are required'));
    }
    if (newPassword.length < 6) {
      return next(new ApiError(400, 'New password must be at least 6 characters'));
    }

    // IMPORTANT: explicitly include the password field in the query
    // If your model's password attribute is named differently, replace 'password' with the real name
    const user = await User.findByPk(userId, {
      attributes: { include: ['password'] }
    });

    if (!user) return next(new ApiError(404, 'User not found'));

    // If password field is missing or undefined, fail with a clear error
    if (!user.password) {
      return next(new ApiError(500, 'User has no password set; cannot verify current password'));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return next(new ApiError(401, 'Current password is incorrect'));

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// add near the top of userController.js (after login/changePassword)
// if not already imported

/**
 * GET /api/v1/users/me
 * Return the current user's public info (exclude password)
 */
exports.getMe = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new ApiError(401, 'Authentication required'));

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });
    if (!user) return next(new ApiError(404, 'User not found'));

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/users/me
 * Update the current user's profile fields (name, email, phone).
 * Returns the updated user (password excluded).
 */
// userController.js

exports.updateMe = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new ApiError(401, 'Authentication required'));

    const { name, email, phone } = req.body || {};

    // basic validation
    if (email && typeof email !== 'string') {
      return next(new ApiError(400, 'Invalid email'));
    }

    // find user
    const user = await User.findByPk(userId);
    if (!user) return next(new ApiError(404, 'User not found'));

    // if email is being changed, ensure uniqueness
    if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
      const existing = await User.findOne({
        where: { email: email.toLowerCase(), id: { [Op.ne]: userId } },
      });
      if (existing) {
        return next(new ApiError(400, 'Email is already in use by another account'));
      }
      user.email = email.toLowerCase();
    }

    // update provided fields only
    if (typeof name !== 'undefined') user.name = String(name).trim();
    if (typeof phone !== 'undefined') user.phone = String(phone).trim();

    await user.save();

    // reload and exclude password in response
    const updated = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    // bubble up sequelize validation/unique errors as 400
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      return next(
        new ApiError(
          400,
          err.errors?.map((e) => e.message).join('; ') || err.message
        )
      );
    }
    next(err);
  }
};
