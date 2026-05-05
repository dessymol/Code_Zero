const { QueryTypes } = require('sequelize');

const hasColumn = async (sequelize, tableName, columnName) => {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
        AND COLUMN_NAME = :columnName
    `,
    {
      replacements: { tableName, columnName },
      type: QueryTypes.SELECT
    }
  );

  return Number(rows?.count || 0) > 0;
};

const ensureApplicationSchema = async (sequelize, logger = console) => {
  const usersHasLlmProvider = await hasColumn(sequelize, 'users', 'llm_provider');

  if (!usersHasLlmProvider) {
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN llm_provider ENUM('gemini', 'groq', 'local') NOT NULL DEFAULT 'gemini'
    `);
    logger.info('[DB Schema] Added users.llm_provider column.');
  }

  const submissionFeedbacksHasSimilarityPercentage = await hasColumn(sequelize, 'submissionfeedbacks', 'similarity_percentage');
  if (!submissionFeedbacksHasSimilarityPercentage) {
    await sequelize.query(`
      ALTER TABLE submissionfeedbacks
      ADD COLUMN similarity_percentage INT NULL
    `);
    logger.info('[DB Schema] Added submissionfeedbacks.similarity_percentage column.');
  }

  const submissionFeedbacksHasSimilarityFeedback = await hasColumn(sequelize, 'submissionfeedbacks', 'similarity_feedback');
  if (!submissionFeedbacksHasSimilarityFeedback) {
    await sequelize.query(`
      ALTER TABLE submissionfeedbacks
      ADD COLUMN similarity_feedback TEXT NULL
    `);
    logger.info('[DB Schema] Added submissionfeedbacks.similarity_feedback column.');
  }

  const submissionFeedbacksHasTestcaseFeedback = await hasColumn(sequelize, 'submissionfeedbacks', 'testcase_feedback');
  if (!submissionFeedbacksHasTestcaseFeedback) {
    await sequelize.query(`
      ALTER TABLE submissionfeedbacks
      ADD COLUMN testcase_feedback TEXT NULL
    `);
    logger.info('[DB Schema] Added submissionfeedbacks.testcase_feedback column.');
  }
};

module.exports = {
  ensureApplicationSchema
};
