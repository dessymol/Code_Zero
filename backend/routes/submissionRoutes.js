const express = require('express');
const router = express.Router();
const {
  submitCode,
  getCompletedCourses,
  getQuestionsForStudentCourse,
  getAllSubmissionsByCourse,
  getCourseSubmissionsForAdmin,
  getSubmissionsByCourseAndBatch,
  getMySubmissions,
  getCourseSubmissionsForFaculty,
  executeCode,
  getSupportedLanguages,
  getSubmissionStatus
} = require('../controllers/submissionController');
const { studentAuth, facultyAuth, adminAuth, authMiddleware, roleMiddleware } = require('../Middleware/authmiddleware');

router.get('/languages', getSupportedLanguages);
router.get('/status/:token', getSubmissionStatus);
router.post('/execute', studentAuth, executeCode);

router.post('/submit', studentAuth, submitCode);

router.get('/completed-courses', studentAuth, getCompletedCourses);
router.get('/student-questions/:courseId', studentAuth, getQuestionsForStudentCourse);

router.get('/course/:courseId', facultyAuth, getAllSubmissionsByCourse);
router.get('/admin/course/:courseId', adminAuth, getCourseSubmissionsForAdmin);

router.get(
  '/admin/course/:courseId/batch/:batchId',
  authMiddleware,
  roleMiddleware('admin'),
  getSubmissionsByCourseAndBatch
);

router.get(
  '/faculty/course/:courseId',
  authMiddleware,
  roleMiddleware('faculty'),
  getCourseSubmissionsForFaculty
);

router.get('/mine', studentAuth, getMySubmissions);

module.exports = router;
