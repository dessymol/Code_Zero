// models/courseMessages.js
module.exports = (sequelize, DataTypes) => {
  const CourseMessage = sequelize.define('CourseMessage', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sender_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'course_messages',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  CourseMessage.associate = (models) => {
    if (models.Course) CourseMessage.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course' });
    if (models.Faculty) CourseMessage.belongsTo(models.Faculty, { foreignKey: 'user_id', as: 'faculty' });
    if (models.User) CourseMessage.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return CourseMessage;
};
