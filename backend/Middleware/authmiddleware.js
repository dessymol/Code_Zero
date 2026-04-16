const jwt = require('jsonwebtoken');
const { User, Student } = require('../models');
const ApiError = require('../utils/ApiError');

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';
const isAdminLike = (role) => role === 'admin' || role === 'super_admin';
const roleMatches = (userRole, roles) => {
  if (roles.includes(userRole)) return true;
  if (userRole === 'super_admin' && roles.includes('admin')) return true;
  return false;
};

const getTokenFromRequest = (req) => {
  const header = req.headers.authorization || req.header('Authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
};

const decodeTokenOrThrow = (req) => {
  const token = getTokenFromRequest(req);
  if (!token) throw new ApiError(401, 'Authentication required');
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Unauthorized: Invalid or expired token');
  }
};

const authMiddleware = async (req, res, next) => {
  try {
    const decoded = decodeTokenOrThrow(req);
    const user = await User.findByPk(decoded.id);
    if (!user || user.is_active === false) {
      throw new ApiError(401, 'Unauthorized: User not found or inactive');
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

const roleMiddleware = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (!roleMatches(req.user.role, roles)) return next(new ApiError(403, 'Access denied'));
  return next();
};

const verifyToken = (req, res, next) => {
  try {
    const decoded = decodeTokenOrThrow(req);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    next(err);
  }
};

const restrictTo = (role) => roleMiddleware(role);

const studentAuth = async (req, res, next) => {
  try {
    const decoded = decodeTokenOrThrow(req);
    if (decoded.role !== 'student') {
      throw new ApiError(403, 'Forbidden: Student access only');
    }
    const student = await Student.findByPk(decoded.id);
    if (!student || student.is_active === false) {
      throw new ApiError(401, 'Unauthorized: Student not found or inactive');
    }
    req.user = { id: student.id, role: 'student' };
    next();
  } catch (err) {
    next(err);
  }
};

const facultyAuth = async (req, res, next) => {
  try {
    const decoded = decodeTokenOrThrow(req);
    const user = await User.findByPk(decoded.id);
    if (!user || user.is_active === false) throw new ApiError(401, 'Unauthorized: User not found or inactive');
    if (user.role !== 'faculty') throw new ApiError(403, 'Forbidden: Faculty access only');
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const decoded = decodeTokenOrThrow(req);
    const user = await User.findByPk(decoded.id);
    if (!user || user.is_active === false) throw new ApiError(401, 'Unauthorized: User not found or inactive');
    if (!isAdminLike(user.role)) throw new ApiError(403, 'Forbidden: Admin access only');
    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authMiddleware,
  roleMiddleware,
  verifyToken,
  restrictTo,
  studentAuth,
  facultyAuth,
  adminAuth,
};
