module.exports = (sequelize, DataTypes) => {
  const TestResult = sequelize.define('TestResult', {
    submission_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    testcase_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('passed', 'failed', 'error'),
      allowNull: false
    },
    status_id: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    expected_output: {
      type: DataTypes.TEXT
    },
    error_message: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'test_results',
    timestamps: true
  });

  TestResult.associate = (models) => {
    TestResult.belongsTo(models.Submission, {
      foreignKey: 'submission_id',
      as: 'submission'
    });
    TestResult.belongsTo(models.TestCase, {
      foreignKey: 'testcase_id',
      as: 'testCase',
      onDelete: 'CASCADE'
    });
  };

  return TestResult;
};
