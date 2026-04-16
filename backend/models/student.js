module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define('Student', {
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: false,
    },
    phone: {
      type: DataTypes.STRING
    },
    password: DataTypes.STRING,
    reset_otp: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    reset_otp_expires: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'

  });

  return Student;
};


