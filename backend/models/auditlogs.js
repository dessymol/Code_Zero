module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    actor_role: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    target_type: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    target_id: {
      type: DataTypes.STRING(80),
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
        foreignKey: 'actor_user_id',
        as: 'Actor'
      });
    }
  };

  return AuditLog;
};
