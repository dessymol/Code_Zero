// models/questionbatches.js
module.exports = (sequelize, DataTypes) => {
  const QuestionBatch = sequelize.define('QuestionBatch', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    // keep types consistent with your other models (INTEGER)
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    batch_id: { type: DataTypes.INTEGER, allowNull: false },

    enabled: { type: DataTypes.BOOLEAN, defaultValue: false },

    // this will store the user id who toggled — keep as INTEGER to match users.id
    toggled_by: { type: DataTypes.INTEGER, allowNull: true },

    toggled_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'question_batches',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['question_id', 'batch_id'], name: 'uq_question_batch' },
      { fields: ['batch_id'], name: 'idx_qb_batch' },
      { fields: ['question_id'], name: 'idx_qb_question' }
    ]
  });

  QuestionBatch.associate = (models) => {
    // Do NOT let Sequelize create FK constraints automatically here.
    // We set constraints: false to avoid "foreign key incorrectly formed" errors during sync.
    // If you later create proper FK constraints via migrations, you can remove constraints:false.

    QuestionBatch.belongsTo(models.Question, { foreignKey: 'question_id', as: 'Question', constraints: false });
    QuestionBatch.belongsTo(models.Batch, { foreignKey: 'batch_id', as: 'Batch', constraints: false });
    QuestionBatch.belongsTo(models.User, { foreignKey: 'toggled_by', as: 'Toggler', constraints: false });
  };

  return QuestionBatch;
};
