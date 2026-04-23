// backend/models/auditlog.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the user performing the action'
    },
    user_email: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Email of the user (for deleted users)'
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type of action (e.g., CREATE_QUESTION, DELETE_STUDENT, LOGIN)'
    },
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of resource affected (e.g., QUESTION, STUDENT, COURSE)'
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'ID of the resource affected'
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Additional details about the action (changes, before/after values)'
    },
    status: {
      type: DataTypes.ENUM('success', 'failure'),
      defaultValue: 'success',
      comment: 'Whether the action succeeded or failed'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Client IP address'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent string'
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['action'] },
      { fields: ['resource_type'] }
    ]
  });

  return AuditLog;
};
