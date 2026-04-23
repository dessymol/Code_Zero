module.exports = (sequelize, DataTypes) => {
  const Submission = sequelize.define('Submission', {
    code: DataTypes.TEXT,
    language_id: DataTypes.STRING,
    status: DataTypes.STRING,
    output: DataTypes.TEXT,
    token: { type: DataTypes.STRING, allowNull: false },
    execution_time: DataTypes.STRING,
    score: DataTypes.INTEGER,
    manually_overridden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    override_note: {
      type: DataTypes.STRING,
      allowNull: true
    },
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
