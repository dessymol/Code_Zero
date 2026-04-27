module.exports = (sequelize, DataTypes) => {
  const ExamAttempt = sequelize.define('ExamAttempt', {
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'finalized', 'abandoned'),
      allowNull: false,
      defaultValue: 'active'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    finalized_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    total_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    violation_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    tableName: 'exam_attempts',
    timestamps: true
  });

  return ExamAttempt;
};
