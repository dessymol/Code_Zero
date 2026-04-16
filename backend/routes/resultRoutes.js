const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultController');
const { authMiddleware, roleMiddleware } = require('../Middleware/authmiddleware');

// View results (admin/faculty)
router.get('/:course_id', authMiddleware, roleMiddleware('admin', 'faculty'), resultsController.getResultsByCourse);

// Export results (admin/faculty)
router.get('/export/:course_id', authMiddleware, roleMiddleware('admin', 'faculty'), resultsController.exportResults);

module.exports = router;
