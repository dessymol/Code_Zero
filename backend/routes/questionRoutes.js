// routes/questionRoutes.js
const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

// adjust path if your auth middleware path differs
const { authMiddleware, roleMiddleware, studentAuth , adminAuth } = require('../Middleware/authmiddleware');

// Create question (faculty)
router.post('/add', authMiddleware, roleMiddleware('faculty'), questionController.createQuestion);

// Faculty view for course (faculty-only)
router.get('/course1/:courseId', authMiddleware, roleMiddleware('faculty'), questionController.getQuestionsByCourse);

// STUDENT-FACING route (single, correct handler):
// This must be the one students call — it returns only questions visible to the student
router.get('/course/:courseId', studentAuth, questionController.getQuestionsForStudentCourse);

// Update / Delete (faculty)
router.put('/update/:id', authMiddleware, roleMiddleware('faculty'), questionController.updateQuestion);
router.delete('/delete/:id', authMiddleware, roleMiddleware('faculty'), questionController.deleteQuestion);

// Question bank (faculty) (optionally include batch states)
router.get('/bank/:courseId', authMiddleware, questionController.getQuestionBankForCourse);

// Routes for toggling question/batch state (faculty only)
router.post('/:id/toggle-batch', authMiddleware, roleMiddleware('faculty'), questionController.toggleQuestionForBatch);
router.post('/:questionId/batch/:batchId/toggle', authMiddleware, roleMiddleware('faculty'), questionController.toggleQuestionForBatch);

// Student-facing: get active questions for a batch (alternative endpoint)
router.get('/for-batch/:batchId', studentAuth, questionController.getActiveQuestionsForBatch);

// NEW route: fetch toggled-on questions for the logged-in student for a course
// // GET /api/questions/toggled/:courseId
// router.get('/toggled/:courseId', studentAuth, questionController.getToggledQuestionsForStudent);
router.get('/admin/bank/:courseId', adminAuth, questionController.getQuestionBankForCourse);
router.post('/admin/add', adminAuth, questionController.createQuestion);
router.put('/admin/update/:id', adminAuth, questionController.updateQuestion);
router.delete('/admin/delete/:id', adminAuth, questionController.deleteQuestion);

module.exports = router;
