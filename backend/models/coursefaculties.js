// models/coursefaculties.js
module.exports = (sequelize, DataTypes) => {
  const CourseFaculty = sequelize.define('CourseFaculty', {
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'course_faculties',
    timestamps: true,       // auto-manages createdAt/updatedAt
    underscored: true       // maps them to created_at / updated_at
  });

  return CourseFaculty;
};
