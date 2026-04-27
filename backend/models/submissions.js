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
    is_final: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    finalized_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    override_note: {
      type: DataTypes.STRING,
      allowNull: true
    },
    attempt_id: {
      type: DataTypes.INTEGER,
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
