module.exports = (sequelize, DataTypes) => {
  const Testcase = sequelize.define('Testcase', {
    input: DataTypes.TEXT,
    output: DataTypes.TEXT,
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    timestamps: true
  });

  return Testcase;
};
