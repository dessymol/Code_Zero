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

const hasTable = async (sequelize, tableName) => {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :tableName
    `,
    {
      replacements: { tableName },
      type: QueryTypes.SELECT
    }
  );

  return Number(rows?.count || 0) > 0;
};

const ensureApplicationSchema = async (sequelize, logger = console) => {
  const apiSettingsTableExists = await hasTable(sequelize, 'api_settings');
  if (!apiSettingsTableExists) {
    await sequelize.query(`
      CREATE TABLE api_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(64) NOT NULL,
        provider_name VARCHAR(64) NOT NULL,
        api_key TEXT NULL,
        base_url TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    logger.info('[DB Schema] Created api_settings table.');
  }

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

  const questionBatchesHasActivationVersion = await hasColumn(sequelize, 'question_batches', 'activation_version');
  if (!questionBatchesHasActivationVersion) {
    await sequelize.query(`
      ALTER TABLE question_batches
      ADD COLUMN activation_version INT NOT NULL DEFAULT 1
    `);
    logger.info('[DB Schema] Added question_batches.activation_version column.');
  }

  const submissionsHasBatchId = await hasColumn(sequelize, 'submissions', 'batch_id');
  if (!submissionsHasBatchId) {
    await sequelize.query(`
      ALTER TABLE submissions
      ADD COLUMN batch_id INT NULL
    `);
    logger.info('[DB Schema] Added submissions.batch_id column.');
  }

  const submissionsHasActivationVersion = await hasColumn(sequelize, 'submissions', 'activation_version');
  if (!submissionsHasActivationVersion) {
    await sequelize.query(`
      ALTER TABLE submissions
      ADD COLUMN activation_version INT NULL
    `);
    logger.info('[DB Schema] Added submissions.activation_version column.');
  }

  const submissionsHasExamSessionKey = await hasColumn(sequelize, 'submissions', 'exam_session_key');
  if (!submissionsHasExamSessionKey) {
    await sequelize.query(`
      ALTER TABLE submissions
      ADD COLUMN exam_session_key VARCHAR(255) NULL
    `);
    logger.info('[DB Schema] Added submissions.exam_session_key column.');
  }
};

module.exports = {
  ensureApplicationSchema
};
