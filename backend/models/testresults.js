module.exports = (sequelize, DataTypes) => {
  const TestResult = sequelize.define('TestResult', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    status: {
      type: DataTypes.ENUM(
        'passed',
        'failed',
        'error'
      ),
      allowNull: false
    },
    execution_time: {
      type: DataTypes.FLOAT
    },
    memory_usage: {
      type: DataTypes.INTEGER
    },
    output: {
      type: DataTypes.TEXT
    },
    error_message: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'test_results',
    timestamps: false
  });

  TestResult.associate = (models) => {
    TestResult.belongsTo(models.Submission, {
      foreignKey: 'submission_id',
      as: 'submission'
    });
    TestResult.belongsTo(models.TestCase, {
      foreignKey: 'test_case_id',
      as: 'testCase'
    });
  };

  return TestResult;
};