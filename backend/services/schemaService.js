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
};

module.exports = {
  ensureApplicationSchema
};
