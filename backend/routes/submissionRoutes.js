const express = require('express');
const router = express.Router();
<<<<<<< HEAD
<<<<<<< HEAD
const {
  submitCode,
  getSubmissionFeedback,
  getCompletedCourses,
  getQuestionsForStudentCourse,
  getAllSubmissionsByCourse,
  getCourseSubmissionsForAdmin,
  getSubmissionsByCourseAndBatch,
  getMySubmissions,
  getCourseSubmissionsForFaculty,
  getFacultySummary,
=======
=======
>>>>>>> a30089a (first commit)
const { 
  submitCode, 
  getCompletedCourses, 
  getQuestionsForStudentCourse,
  getAllSubmissionsByCourse, 
  getCourseSubmissionsForAdmin, 
  getSubmissionsByCourseAndBatch, 
  getMySubmissions,
  getCourseSubmissionsForFaculty,
<<<<<<< HEAD
>>>>>>> d809dc4 (solved some frontend vulnerability)
=======
>>>>>>> a30089a (first commit)
  // NEW: Add these imports
  executeCode,
  getSupportedLanguages,
  getSubmissionStatus
} = require('../controllers/submissionController');
const { studentAuth, facultyAuth, adminAuth, authMiddleware, roleMiddleware } = require('../Middleware/authmiddleware');

// ========================
// PUBLIC ENDPOINTS (No auth required for testing)
// ========================
router.get('/languages', getSupportedLanguages); // Get all supported programming languages
router.get('/status/:token', getSubmissionStatus); // Check submission status by token
router.post('/execute', studentAuth, executeCode);

// ========================
// AUTHENTICATED ENDPOINTS
// ========================

// Code execution (test/run code without saving)
// For production: router.post('/execute', authMiddleware, executeCode);

// Student submits code (save to database)
// Temporarily remove auth for testing
router.post('/submit', studentAuth, submitCode);
// For production: router.post('/submit', authMiddleware, roleMiddleware('student'), submitCode);

<<<<<<< HEAD
<<<<<<< HEAD
// Student polls this after submitting
router.get('/:id/feedback', studentAuth, getSubmissionFeedback);

=======
>>>>>>> d809dc4 (solved some frontend vulnerability)
=======
>>>>>>> a30089a (first commit)
// Student gets their completed courses
router.get('/completed-courses', studentAuth, getCompletedCourses);

// Student gets questions for a course (excluding already submitted)
router.get('/student-questions/:courseId', studentAuth, getQuestionsForStudentCourse);

// Faculty views all submissions for a course
router.get('/course/:courseId', facultyAuth, getAllSubmissionsByCourse);

// Admin views all submissions for a course
router.get('/admin/course/:courseId', adminAuth, getCourseSubmissionsForAdmin);

// Admin gets submissions for a specific batch
router.get(
<<<<<<< HEAD
<<<<<<< HEAD
  '/admin/course/:courseId/batch/:batchId',
  authMiddleware,
  roleMiddleware('admin'),
=======
  '/admin/course/:courseId/batch/:batchId', 
  authMiddleware, 
  roleMiddleware('admin'), 
>>>>>>> d809dc4 (solved some frontend vulnerability)
=======
  '/admin/course/:courseId/batch/:batchId', 
  authMiddleware, 
  roleMiddleware('admin'), 
>>>>>>> a30089a (first commit)
  getSubmissionsByCourseAndBatch
);

// Faculty gets submissions for a course they teach
router.get(
<<<<<<< HEAD
<<<<<<< HEAD
  '/faculty/course/:courseId',
  authMiddleware,
=======
  '/faculty/course/:courseId', 
  authMiddleware, 
>>>>>>> d809dc4 (solved some frontend vulnerability)
=======
  '/faculty/course/:courseId', 
  authMiddleware, 
>>>>>>> a30089a (first commit)
  roleMiddleware('faculty'),
  getCourseSubmissionsForFaculty
);

<<<<<<< HEAD
<<<<<<< HEAD
// Faculty gets summary of all submissions across their courses
router.get(
  '/faculty/summary',
  authMiddleware,
  roleMiddleware('faculty'),
  getFacultySummary
);

=======
>>>>>>> d809dc4 (solved some frontend vulnerability)
=======
>>>>>>> a30089a (first commit)
// Student can see their own submissions
router.get('/mine', studentAuth, getMySubmissions);

module.exports = router;
