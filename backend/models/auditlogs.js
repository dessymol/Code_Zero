module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    resource_type: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'success'
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  AuditLog.associate = (db) => {
    if (db.User) {
      AuditLog.belongsTo(db.User, {
        foreignKey: 'user_id',
        as: 'Actor'
      });
    }
  };

  return AuditLog;
};
