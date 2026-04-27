const express = require('express');
const router = express.Router();
const {
  submitCode,
  getSubmissionFeedback,
  getAllStudentFeedback,
  getCompletedCourses,
  getQuestionsForStudentCourse,
  getAllSubmissionsByCourse,
  getCourseSubmissionsForAdmin,
  getSubmissionsByCourseAndBatch,
  getMySubmissions,
  getCourseSubmissionsForFaculty,
  startExamAttempt,
  finalizeExamAttempt,
  // NEW: Add these imports
  executeCode,
  getSupportedLanguages,
  getSubmissionStatus,
  approveSubmission,
  overrideScore
} = require('../controllers/submissionController');
const { studentAuth, facultyAuth, adminAuth, authMiddleware, roleMiddleware } = require('../Middleware/authmiddleware');
// ========================
// PUBLIC ENDPOINTS (No auth required for testing)
// ========================
router.get('/languages', getSupportedLanguages); // Get all supported programming languages
router.get('/status/:token', getSubmissionStatus); // Check submission status by token
router.post('/execute', studentAuth, executeCode);
router.post('/attempts/start', studentAuth, startExamAttempt);
router.post('/attempts/:attemptId/finalize', studentAuth, finalizeExamAttempt);

// ========================
// AUTHENTICATED ENDPOINTS
// ========================

// Code execution (test/run code without saving)
// For production: router.post('/execute', authMiddleware, executeCode);

// Student submits code (save to database)
// Temporarily remove auth for testing
router.post('/submit', studentAuth, submitCode);
// For production: router.post('/submit', authMiddleware, roleMiddleware('student'), submitCode);

// Student polls this after submitting
router.get('/:id/feedback', studentAuth, getSubmissionFeedback);

// Student gets all their feedback
router.get('/student/feedback', studentAuth, getAllStudentFeedback);

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
  '/admin/course/:courseId/batch/:batchId',
  authMiddleware,
  roleMiddleware('admin'),
  getSubmissionsByCourseAndBatch
);

// Faculty gets submissions for a course they teach
router.get(
  '/faculty/course/:courseId',
  authMiddleware,
  roleMiddleware('faculty'),
  getCourseSubmissionsForFaculty
);
router.patch('/:id/approve', authMiddleware, roleMiddleware('faculty'), approveSubmission);
// Student can see their own submissions
router.get('/mine', studentAuth, getMySubmissions);
router.patch('/:id/score', authMiddleware, roleMiddleware('faculty'), overrideScore);
module.exports = router;
