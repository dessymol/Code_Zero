/**
 * User controller for authentication, profile updates and faculty LLM provider preferences.
 * Exposes route handlers for login, password changes, getting the current user, and updating user settings.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { Op } = require('sequelize'); 
const { writeAuditLog } = require('../services/auditLogService');
const { getProviderConfig, normalizeProvider, SUPPORTED_PROVIDERS } = require('../services/llmServices');
const { getActiveLLMConfig } = require('../services/apiSettingsService');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Authenticate user credentials and return a JWT token.
 * Input: req.body.email, req.body.password
 * Output: 200 JSON { message, token, user }
 */
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

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user_login',
      targetType: 'user',
      targetId: user.id,
      status: 'success',
      details: {
        email: user.email,
        name: user.name
      }
    });

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

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'user_login',
      targetType: 'user',
      targetId: user.id,
      status: 'success',
      details: {
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change the authenticated user's password.
 * Input: req.body.currentPassword, req.body.newPassword
 * Output: 200 JSON { success, message }
 */
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

/**
 * Get the current authenticated user's public profile.
 * Output: 200 JSON { success, data: user }
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
 * Update current authenticated user's profile data.
 * Input: req.body.name, req.body.email, req.body.phone
 * Output: 200 JSON { success, data: updatedUser }
 */
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

/**
 * Retrieve the current faculty user's selected LLM provider and supported runtime info.
 * Output: 200 JSON { success, data: { selectedProvider, supportedProviders, runtime } }
 */
exports.getMyLlmProvider = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new ApiError(401, 'Authentication required'));

    const user = await User.findByPk(userId, {
      attributes: ['id', 'role', 'llm_provider']
    });
    if (!user) return next(new ApiError(404, 'User not found'));
    if (user.role !== 'faculty') {
      return next(new ApiError(403, 'Only faculty can manage LLM provider preferences'));
    }

    const activeLLM = await getActiveLLMConfig().catch(() => null);
    const selectedProvider = activeLLM?.adapter_provider || normalizeProvider(user.llm_provider);

    return res.status(200).json({
      success: true,
      data: {
        selectedProvider,
        supportedProviders: SUPPORTED_PROVIDERS,
        runtime: await getProviderConfig()
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update the authenticated faculty user's preferred LLM provider.
 * Input: req.body.provider
 * Output: 200 JSON { success, message, data }
 */
exports.updateMyLlmProvider = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new ApiError(401, 'Authentication required'));

    const requestedProvider = String(req.body?.provider || '').toLowerCase().trim();
    if (!SUPPORTED_PROVIDERS.includes(requestedProvider)) {
      return next(new ApiError(400, `Provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`));
    }

    const user = await User.findByPk(userId);
    if (!user) return next(new ApiError(404, 'User not found'));
    if (user.role !== 'faculty') {
      return next(new ApiError(403, 'Only faculty can manage LLM provider preferences'));
    }

    user.llm_provider = requestedProvider;
    await user.save();

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'update_llm_provider',
      targetType: 'user',
      targetId: user.id,
      status: 'success',
      details: {
        provider: requestedProvider
      }
    });

    return res.status(200).json({
      success: true,
      message: 'LLM provider updated',
      data: {
        selectedProvider: (await getActiveLLMConfig().catch(() => null))?.adapter_provider || requestedProvider,
        supportedProviders: SUPPORTED_PROVIDERS,
        runtime: await getProviderConfig()
      }
    });
  } catch (err) {
    next(err);
  }
};
