// models/batches.js
module.exports = (sequelize, DataTypes) => {
  const Batch = sequelize.define('Batch', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    // removed global unique on code so same code can be reused under different batch names
    code: { type: DataTypes.STRING, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'batches',
    underscored: true,
    paranoid: true,
    timestamps: true,

    // composite indexes: enforce uniqueness for (course_id, name, code)
    indexes: [
      { unique: true, fields: ['course_id', 'name', 'code'], name: 'uq_course_name_code' },
      { fields: ['course_id'], name: 'idx_batches_course' },
      { fields: ['name'], name: 'idx_batches_name' },
    ],
  });

  Batch.associate = (models) => {
    Batch.belongsTo(models.Course, { foreignKey: 'course_id' });
    Batch.belongsToMany(models.Student, {
      through: models.BatchStudent,
      foreignKey: 'batch_id',
      otherKey: 'student_id',
    });
  };

  return Batch;
};
