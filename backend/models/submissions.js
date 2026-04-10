module.exports = (sequelize, DataTypes) => {
  const Submission = sequelize.define('Submission', {
    code: DataTypes.TEXT,
    language_id: DataTypes.STRING,
    status: DataTypes.STRING,
    output: DataTypes.TEXT,
    token: { type: DataTypes.STRING, allowNull: false },
    execution_time: DataTypes.STRING,
    score: DataTypes.INTEGER,
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    timestamps: true
  });

  return Submission;
};
