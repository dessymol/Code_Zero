module.exports = (sequelize, DataTypes) => {
  const Result = sequelize.define('Result', {
    student_id: { type: DataTypes.INTEGER, allowNull: false },
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    code_submitted: { type: DataTypes.TEXT, allowNull: false },
    language: { type: DataTypes.STRING, allowNull: false },
    output: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING },
    token: { type: DataTypes.STRING, allowNull: false },
    marks_awarded: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    timestamps: true
  });

  return Result;
};
