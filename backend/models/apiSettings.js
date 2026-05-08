module.exports = (sequelize, DataTypes) => {
  const ApiSetting = sequelize.define(
    'ApiSetting',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      provider_name: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      api_key: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      base_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'api_settings',
      timestamps: true,
      paranoid: false,
    }
  );

  return ApiSetting;
};

