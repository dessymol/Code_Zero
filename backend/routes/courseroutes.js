const express = require('express');
const {
  createCourse,
  getAllActiveCourses,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  assignFacultiesToCourse,
  getCoursesForFaculty,
  getCourseByIdForAdmin,
  getCourseWithFaculties,
  getBatchesForFaculty,
  getFacultiesForCourse
} = require('../controllers/courseController');
const { authMiddleware, roleMiddleware , restrictTo , adminAuth } = require('../Middleware/authmiddleware');

const router = express.Router();

router.post('/create-course', adminAuth, createCourse);
router.get('/get-all-courses', authMiddleware, roleMiddleware('admin', 'faculty'), getAllActiveCourses);
router.get('/getActiveandInactiveCourses', authMiddleware, roleMiddleware('admin'), getAllCourses
);
router.get('/get-course/:id', getCourseById);
router.put('/update-course/:id', adminAuth, updateCourse);
router.delete('/delete-course/:id', adminAuth, deleteCourse);
router.get('/:id/with-faculties', adminAuth, getCourseWithFaculties);

router.get('/faculty-courses', authMiddleware, restrictTo('faculty'), getCoursesForFaculty);
router.get('/faculty-batches', authMiddleware, roleMiddleware('faculty'), getBatchesForFaculty);
router.get('/:courseId/faculties', authMiddleware, roleMiddleware('admin', 'faculty'), getFacultiesForCourse);

// Route to assign faculties
router.post('/:courseId/assign-faculties', adminAuth, assignFacultiesToCourse);
router.get('/:id', getCourseByIdForAdmin);

module.exports = router;
