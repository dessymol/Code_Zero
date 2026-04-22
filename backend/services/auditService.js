// backend/services/auditService.js
const db = require('../models');
const { AuditLog } = db;

/**
 * Log an action to the audit log table
 * @param {object} options
 * @param {number} options.user_id - ID of the user performing the action
 * @param {string} options.user_email - Email of the user (for deleted/anonymous users)
 * @param {string} options.action - Type of action (e.g., 'CREATE_QUESTION', 'DELETE_STUDENT')
 * @param {string} options.resource_type - Type of resource (e.g., 'QUESTION', 'STUDENT')
 * @param {number} options.resource_id - ID of the affected resource
 * @param {object} options.details - Additional details (changes, before/after, etc.)
 * @param {string} options.status - 'success' or 'failure'
 * @param {string} options.ip_address - Client IP address
 * @param {string} options.user_agent - User agent string
 * @returns {Promise<AuditLog>}
 */
async function log(options = {}) {
  try {
    return await AuditLog.create({
      user_id: options.user_id || null,
      user_email: options.user_email || null,
      action: options.action || 'UNKNOWN',
      resource_type: options.resource_type || null,
      resource_id: options.resource_id || null,
      details: options.details || null,
      status: options.status || 'success',
      ip_address: options.ip_address || null,
      user_agent: options.user_agent || null
    });
  } catch (err) {
    console.error('[auditService] Error logging action:', err.message);
    // Don't throw - silently fail to prevent audit logging from breaking the main flow
    return null;
  }
}

/**
 * Get audit logs with optional filters
 * @param {object} filters
 * @param {number} filters.user_id - Filter by user ID
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.resource_type - Filter by resource type
 * @param {number} filters.page - Page number (1-indexed)
 * @param {number} filters.limit - Items per page
 * @returns {Promise<{rows, count, page, limit, pages}>}
 */
async function getLogs(filters = {}) {
  const {
    user_id,
    action,
    resource_type,
    page = 1,
    limit = 50,
    days = 30
  } = filters;

  const where = {};
  
  if (user_id) where.user_id = user_id;
  if (action) where.action = action;
  if (resource_type) where.resource_type = resource_type;
  
  // Filter by days in the past
  if (days) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    where.createdAt = { [db.sequelize.Sequelize.Op.gte]: pastDate };
  }

  const offset = (page - 1) * limit;

  try {
    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      rows,
      count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    };
  } catch (err) {
    console.error('[auditService] Error fetching logs:', err.message);
    throw err;
  }
}

/**
 * Get summary stats for the audit log
 * @returns {Promise<object>}
 */
async function getStats() {
  try {
    const total = await AuditLog.count();
    const last24h = await AuditLog.count({
      where: {
        createdAt: {
          [db.sequelize.Sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const actions = await db.sequelize.query(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `, { raw: true });

    return {
      total,
      last24h,
      topActions: actions
    };
  } catch (err) {
    console.error('[auditService] Error getting stats:', err.message);
    throw err;
  }
}

module.exports = {
  log,
  getLogs,
  getStats
};
