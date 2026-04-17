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
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action,
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
      status,
      details
    });
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error.message || error);
    return null;
  }
};

module.exports = {
  writeAuditLog
};
