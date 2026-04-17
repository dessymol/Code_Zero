/* models/index.js */
'use strict';

const { Sequelize, DataTypes } = require('sequelize');
// ✅ Use your custom connection (reads from .env)
const { sequelize } = require('../config/connection');

const db = {};

/* ---------------------- Load model factory files ---------------------- */
db.User         = require('./users')(sequelize, DataTypes);
db.Student      = require('./student')(sequelize, DataTypes);
db.Course       = require('./courses')(sequelize, DataTypes);
db.Question     = require('./questions')(sequelize, DataTypes);
db.CourseMessage = require('./courseMessages')(sequelize, DataTypes);
db.Submission   = require('./submissions')(sequelize, DataTypes);
db.Result       = require('./results')(sequelize, DataTypes);
db.SystemConfig = require('./systemconfig')(sequelize, DataTypes);

// NEW for batches
db.Batch        = require('./batches')(sequelize, DataTypes);
db.BatchStudent = require('./batchstudents')(sequelize, DataTypes);

// NEW: question_batches join (per-question per-batch toggle)
try {
  db.QuestionBatch = require('./questionbatches')(sequelize, DataTypes);
} catch (err) {
  // If the file doesn't exist yet, keep going. Add the model file and restart.
  // console.warn('questionbatches model not found:', err.message);
}

/* ---------------------- Allow models to self-associate ---------------------- */
Object.keys(db).forEach((name) => {
  if (db[name] && typeof db[name].associate === 'function') {
    db[name].associate(db);
  }
});

/* ----------------------------- Associations ----------------------------- */
/** Course ↔ Student (many-to-many via course_students) */
db.Course.belongsToMany(db.Student, {
  through: 'course_students',
  foreignKey: 'course_id',
  otherKey: 'student_id',
});
db.Student.belongsToMany(db.Course, {
  through: 'course_students',
  foreignKey: 'student_id',
  otherKey: 'course_id',
});

/** Course ↔ Faculty(User) (many-to-many via course_faculties) */
db.Course.belongsToMany(db.User, {
  through: 'course_faculties',
  as: 'Faculties',
  foreignKey: 'course_id',
  otherKey: 'faculty_id',
});
db.User.belongsToMany(db.Course, {
  through: 'course_faculties',
  as: 'FacultyCourses',
  foreignKey: 'faculty_id',
  otherKey: 'course_id',
});

/** Course → Questions (one-to-many) */
db.Course.hasMany(db.Question, { foreignKey: 'course_id' });
db.Question.belongsTo(db.Course, { foreignKey: 'course_id' });

/** Batches:
 *  Course → Batches (one-to-many)
 *  Batch ↔ Student (many-to-many via BatchStudent)
 */
db.Course.hasMany(db.Batch, { foreignKey: 'course_id' });
db.Batch.belongsTo(db.Course, { foreignKey: 'course_id' });

db.Batch.belongsToMany(db.Student, {
  through: db.BatchStudent,
  foreignKey: 'batch_id',
  otherKey: 'student_id',
});
db.Student.belongsToMany(db.Batch, {
  through: db.BatchStudent,
  foreignKey: 'student_id',
  otherKey: 'batch_id',
});

/** Submissions */
db.Student.hasMany(db.Submission, { foreignKey: 'student_id' });
db.Submission.belongsTo(db.Student, { foreignKey: 'student_id' });

db.Question.hasMany(db.Submission, { foreignKey: 'question_id' });
db.Submission.belongsTo(db.Question, { foreignKey: 'question_id' });

/** Results (if you use a rollup per course/student) */
if (db.Result) {
  db.Student.hasMany(db.Result, { foreignKey: 'student_id' });
  db.Course.hasMany(db.Result, { foreignKey: 'course_id' });
  db.Result.belongsTo(db.Student, { foreignKey: 'student_id' });
  db.Result.belongsTo(db.Course, { foreignKey: 'course_id' });
}

/* ---------------------- QuestionBatch associations ---------------------- */
/** Question <-> Batch via QuestionBatch (toggle per batch) */
if (db.QuestionBatch && db.Batch && db.Question) {
  db.Question.belongsToMany(db.Batch, {
    through: db.QuestionBatch,
    foreignKey: 'question_id',
    otherKey: 'batch_id',
    as: 'Batches'
  });
  db.Batch.belongsToMany(db.Question, {
    through: db.QuestionBatch,
    foreignKey: 'batch_id',
    otherKey: 'question_id',
    as: 'Questions'
  });

  db.Question.hasMany(db.QuestionBatch, { foreignKey: 'question_id', as: 'QuestionBatches' });
  db.Batch.hasMany(db.QuestionBatch, { foreignKey: 'batch_id', as: 'QuestionBatches' });
}




//Message system
if (db.Course && db.CourseMessage) {
  db.Course.hasMany(db.CourseMessage, { foreignKey: 'course_id' });
  db.CourseMessage.belongsTo(db.Course, { foreignKey: 'course_id' });
}

// A user can send many messages
if (db.User && db.CourseMessage) {
  db.User.hasMany(db.CourseMessage, { foreignKey: 'user_id' });
  // alias 'User' lets you include sender info easily in queries
  db.CourseMessage.belongsTo(db.User, { foreignKey: 'user_id', as: 'User' });
}

/* ------------------------------- Exports ----------------------------------- */
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
