const { AuditLog } = require('../models');

const writeAuditLog = async ({
  actorUserId = null,
  actorRole = null,
  action,
  targetType = null,
  targetId = null,
  status = 'success',
  details = null
}) => {
  if (!action) return null;

  try {
    return await AuditLog.create({
      user_id: actorUserId,
      action,
      resource_type: targetType,
      resource_id: targetId == null ? null : targetId,
      status,
      details: { ...details, actorRole }
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error.message || error);
    return null;
  }
};

module.exports = {
  writeAuditLog
};
