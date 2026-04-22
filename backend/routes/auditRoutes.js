// backend/routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { authMiddleware } = require('../Middleware/authmiddleware');

/**
 * GET /api/audit-logs
 * Retrieve audit logs (admin only)
 * Query params: user_id, action, resource_type, page, limit, days
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }

    const {
      user_id,
      action,
      resource_type,
      page = 1,
      limit = 50,
      days = 30
    } = req.query;

    const logs = await auditService.getLogs({
      user_id: user_id ? parseInt(user_id) : undefined,
      action,
      resource_type,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100), // Max 100 items per page
      days: parseInt(days) || 30
    });

    return res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    console.error('[auditRoutes] GET error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs'
    });
  }
});

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
    }

    const stats = await auditService.getStats();
    return res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[auditRoutes] Stats error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch audit stats'
    });
  }
});

module.exports = router;
