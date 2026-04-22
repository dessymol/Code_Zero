const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

const { authMiddleware, roleMiddleware, studentAuth, adminAuth } = require('../Middleware/authmiddleware');

router.post('/add', authMiddleware, roleMiddleware('faculty'), questionController.createQuestion);
router.get('/course1/:courseId', authMiddleware, roleMiddleware('faculty'), questionController.getQuestionsByCourse);
router.get('/course/:courseId', studentAuth, questionController.getQuestionsForStudentCourse);

router.put('/update/:id', authMiddleware, roleMiddleware('faculty'), questionController.updateQuestion);
router.delete('/delete/:id', authMiddleware, roleMiddleware('faculty'), questionController.deleteQuestion);

router.get('/bank/:courseId', authMiddleware, questionController.getQuestionBankForCourse);
router.post('/:id/toggle-batch', authMiddleware, roleMiddleware('faculty'), questionController.toggleQuestionForBatch);
router.post('/:questionId/batch/:batchId/toggle', authMiddleware, roleMiddleware('faculty'), questionController.toggleQuestionForBatch);

router.get('/for-batch/:batchId', studentAuth, questionController.getActiveQuestionsForBatch);

router.get('/admin/bank/:courseId', adminAuth, questionController.getQuestionBankForCourse);
router.post('/admin/add', adminAuth, questionController.createQuestion);
router.put('/admin/update/:id', adminAuth, questionController.updateQuestion);
router.delete('/admin/delete/:id', adminAuth, questionController.deleteQuestion);

module.exports = router;
