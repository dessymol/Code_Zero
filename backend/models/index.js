/* models/index.js */
'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('../config/connection');

const db = {};
db.SubmissionFeedback = require('./submissionfeedback')(sequelize, DataTypes);
db.AuditLog = require('./auditlog')(sequelize, DataTypes);

db.User = require('./users')(sequelize, DataTypes);
db.Student = require('./student')(sequelize, DataTypes);
db.Course = require('./courses')(sequelize, DataTypes);
db.Question = require('./questions')(sequelize, DataTypes);
db.CourseMessage = require('./courseMessages')(sequelize, DataTypes);
db.Submission = require('./submissions')(sequelize, DataTypes);
db.Result = require('./results')(sequelize, DataTypes);
db.SystemConfig = require('./systemconfig')(sequelize, DataTypes);
db.AuditLog = require('./auditlogs')(sequelize, DataTypes);
db.Testcase = require('./testcases')(sequelize, DataTypes);
db.TestCase = db.Testcase;
db.TestResult = require('./testresults')(sequelize, DataTypes);
db.Batch = require('./batches')(sequelize, DataTypes);
db.BatchStudent = require('./batchstudents')(sequelize, DataTypes);

try {
  db.QuestionBatch = require('./questionbatches')(sequelize, DataTypes);
} catch (err) {
  // Optional model.
}

Object.keys(db).forEach((name) => {
  if (db[name] && typeof db[name].associate === 'function') {
    db[name].associate(db);
  }
});

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

db.Course.hasMany(db.Question, { foreignKey: 'course_id' });
db.Question.belongsTo(db.Course, { foreignKey: 'course_id' });

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

db.Student.hasMany(db.Submission, { foreignKey: 'student_id' });
db.Submission.belongsTo(db.Student, { foreignKey: 'student_id' });

db.Question.hasMany(db.Submission, { foreignKey: 'question_id' });
db.Submission.belongsTo(db.Question, { foreignKey: 'question_id' });
db.Submission.hasOne(db.SubmissionFeedback, { foreignKey: 'submission_id', as: 'Feedback' });
db.SubmissionFeedback.belongsTo(db.Submission, { foreignKey: 'submission_id' });

if (db.Question && db.Testcase) {
  db.Question.hasMany(db.Testcase, { foreignKey: 'question_id' });
  db.Testcase.belongsTo(db.Question, { foreignKey: 'question_id' });
}

if (db.Submission && db.TestResult) {
  db.Submission.hasMany(db.TestResult, { foreignKey: 'submission_id', as: 'testResults' });
}

if (db.Testcase && db.TestResult) {
  db.Testcase.hasMany(db.TestResult, { foreignKey: 'test_case_id', as: 'results' });
}

if (db.Result) {
  db.Student.hasMany(db.Result, { foreignKey: 'student_id' });
  db.Course.hasMany(db.Result, { foreignKey: 'course_id' });
  db.Result.belongsTo(db.Student, { foreignKey: 'student_id' });
  db.Result.belongsTo(db.Course, { foreignKey: 'course_id' });
}

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

if (db.Course && db.CourseMessage) {
  db.Course.hasMany(db.CourseMessage, { foreignKey: 'course_id' });
  db.CourseMessage.belongsTo(db.Course, { foreignKey: 'course_id' });
}

if (db.User && db.CourseMessage) {
  db.User.hasMany(db.CourseMessage, { foreignKey: 'user_id' });
  db.CourseMessage.belongsTo(db.User, { foreignKey: 'user_id', as: 'User' });
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
