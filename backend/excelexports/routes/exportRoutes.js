// backend/excelexports/routes/exportRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/exportController');
const { studentAuth } = require('../../Middleware/authmiddleware');

// list batches for a course (with submission counts)
router.get('/courses/:courseId/batches', ctrl.getBatchesForCourse);

// combined-by-name (single sheet for batch name)
router.get('/courses/:courseId/batches/combined-by-name', ctrl.exportCourseBatchesCombinedByName);

// combined subbatches (one sheet per batch)
router.get('/courses/:courseId/subbatches/combined', ctrl.exportCourseSubbatchesCombined);

// single batch export
router.get('/batches/:batchId/export', ctrl.exportBatchSubmissions);

// single subbatch export
router.get('/subbatches/:subbatchId/export', ctrl.exportSubBatchSubmissions);

// compatibility routes
router.get('/export/batch/:batchId', ctrl.exportBatchSubmissions);
router.get('/export/subbatch/:subbatchId', ctrl.exportSubBatchSubmissions);

// optional courses list
router.get('/courses', ctrl.listCourses);
router.get('/students/me/submissions/export', studentAuth,ctrl.exportMySubmissions);

module.exports = router;
