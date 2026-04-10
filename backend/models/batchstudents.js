// models/batchstudents.js
module.exports = (sequelize, DataTypes) => {
  const BatchStudent = sequelize.define('BatchStudent', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    batch_id: { type: DataTypes.INTEGER, allowNull: false },
    student_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'batch_students',
    underscored: true,
    paranoid: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['batch_id', 'student_id'] },
      { fields: ['batch_id'] },
      { fields: ['student_id'] },
    ],
  });

  BatchStudent.associate = (models) => {
    BatchStudent.belongsTo(models.Batch,   { foreignKey: 'batch_id' });
    BatchStudent.belongsTo(models.Student, { foreignKey: 'student_id' });
  };

  return BatchStudent;
};
