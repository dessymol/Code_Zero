// routes/studentroutes.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const {
  // ===== existing controllers (unchanged) =====
  loginStudent,
  uploadStudents,
  getAllStudents,
  addStudent,
  updateStudent,
  removeStudentFromCourse,
  coursesWithExams,

  // ===== new controllers for batches (ADDED) =====
  getStudentsByCourse,      // GET /by-course/:courseId
  getBatchesForCourse,      // GET /batches/:courseId
  createBatch,              // POST /batches/:courseId
  getStudentsInBatch,       // GET /batch/:batchId
  assignStudentToBatch,     // POST /:studentId/assign-batch/:batchId
  removeStudentFromBatch,   // DELETE /:studentId/batch/:batchId
  updateBatch,               // PUT /batches/:batchId
  getBatchesForBatchManagement,
  deleteBatch,
  getStudentMe,
  updateStudentMe,
  changeStudentPassword,
  deleteStudentMe,
  getUploadTemplateMeta,
  uploadTemplateFile,
  downloadUploadTemplate,
} = require('../controllers/studentController');

const { authMiddleware, studentAuth, roleMiddleware } = require('../Middleware/authmiddleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
const templateStagingDir = path.join(uploadDir, 'templates-staging');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(templateStagingDir)) fs.mkdirSync(templateStagingDir, { recursive: true });
const upload = multer({ dest: 'uploads/' });
const templateUpload = multer({ dest: templateStagingDir });

/* ===================== EXISTING ROUTES (kept exactly) ===================== */
router.get('/get-all-students', authMiddleware, roleMiddleware('admin', 'faculty'), getAllStudents);
router.post('/upload', authMiddleware, roleMiddleware('admin'), upload.single('file'), uploadStudents);
router.get('/templates/:templateType', authMiddleware, roleMiddleware('admin'), getUploadTemplateMeta);
router.post('/templates/:templateType', authMiddleware, roleMiddleware('admin'), templateUpload.single('templateFile'), uploadTemplateFile);
router.get('/templates/:templateType/download', authMiddleware, roleMiddleware('admin', 'faculty'), downloadUploadTemplate);
router.post('/add', authMiddleware, roleMiddleware('admin'), addStudent);
router.put('/update/:id', authMiddleware, roleMiddleware('admin'), updateStudent);
router.delete('/remove/:studentId/:courseId', authMiddleware, roleMiddleware('admin'), removeStudentFromCourse);
router.post('/login', loginStudent);
router.get('/courses-with-exams', studentAuth, coursesWithExams);

/* ======================= NEW BATCH-RELATED ROUTES ======================== */
router.get('/by-course/:courseId', authMiddleware, roleMiddleware('admin', 'faculty'), getStudentsByCourse);
router.get('/batches/:courseId', authMiddleware, roleMiddleware('admin', 'faculty'), getBatchesForCourse);
router.get('/batchmanagement/:courseId', authMiddleware, roleMiddleware('admin', 'faculty'), getBatchesForBatchManagement);
router.get('/batch/:batchId', authMiddleware, roleMiddleware('admin', 'faculty'), getStudentsInBatch);

router.post('/batches/:courseId', authMiddleware, roleMiddleware('admin'), createBatch);
router.put('/batches/:batchId', authMiddleware, roleMiddleware('admin'), updateBatch); // <-- update batch (name/code/dates/is_active)

router.get('/batch/:batchId', authMiddleware, roleMiddleware('admin', 'faculty'), getStudentsInBatch);

router.post('/:studentId/assign-batch/:batchId', authMiddleware, roleMiddleware('admin'), assignStudentToBatch);
router.delete('/:studentId/batch/:batchId', authMiddleware, roleMiddleware('admin'), removeStudentFromBatch);

// DELETE /api/students/batches/:batchId
router.delete('/batches/:batchId', authMiddleware, roleMiddleware('admin'), deleteBatch);


// Student self-profile routes
router.get('/me', studentAuth, getStudentMe);
router.put('/me', studentAuth, updateStudentMe);
router.post('/change-password', studentAuth, changeStudentPassword);
router.delete('/me', studentAuth, deleteStudentMe);



module.exports = router;
