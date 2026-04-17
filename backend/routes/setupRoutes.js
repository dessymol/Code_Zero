const express = require('express');
const bcrypt = require('bcryptjs');
const { User, SystemConfig, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');
const { requireNotInitialized, setupRateLimit } = require('../Middleware/initMiddleware');
const { getInitState, setInitialized } = require('../services/initState');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStrongPassword = (pwd) => {
  if (typeof pwd !== 'string') return false;
  if (pwd.length < 8) return false;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  return hasUpper && hasLower && hasNumber && hasSpecial;
};

const checkSetupSecret = (req) => {
  const required = process.env.SETUP_SECRET;
  if (!required) return true;
  const provided = req.header('x-setup-secret');
  return String(provided || '').trim() === String(required).trim();
};

router.get('/auth/status', async (req, res) => {
  res.status(200).json({ initialized: !!getInitState() });
});

router.get('/setup', requireNotInitialized, (req, res) => {
  res.status(200).json({ initialized: false, message: 'Setup required' });
});

router.post('/setup', requireNotInitialized, setupRateLimit, async (req, res, next) => {
  let transaction;
  try {
    if (!checkSetupSecret(req)) {
      throw new ApiError(403, 'Invalid setup secret');
    }

    const { name, email, password } = req.body || {};
    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password) {
      throw new ApiError(400, 'Name, email, and password are required');
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new ApiError(400, 'Invalid email format');
    }
    if (!isStrongPassword(password)) {
      throw new ApiError(400, 'Password must be at least 8 characters and include upper, lower, number, and special character');
    }

    transaction = await sequelize.transaction();

    const existingCount = await User.count({ transaction });
    if (existingCount > 0) {
      throw new ApiError(403, 'System already initialized');
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail }, transaction });
    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: 'super_admin'
    }, { transaction });

    await SystemConfig.upsert({ id: 1, initialized: true }, { transaction });

    await transaction.commit();
    await setInitialized(true);

    res.status(201).json({
      success: true,
      message: 'System initialized. Please log in.',
      redirect: '/login'
    });
  } catch (err) {
    if (transaction) await transaction.rollback();
    next(err);
  }
});

module.exports = router;
