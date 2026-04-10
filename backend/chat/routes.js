// chat/routes.js
const express = require('express');
const router = express.Router();
const db = require('../models');

// using the same auth middleware pattern as your project
// adjust path if your project uses a different relative path to auth middleware
const { roleMiddleware , authMiddleware } = require('../Middleware/authmiddleware') || require('../authmiddleware');

const {
  getCourseMessages,
  postCourseMessage,
  getCourseMessagesForFaculty,
  postCourseMessageForFaculty
} = require('./controller');

router.get('/course/:courseId', authMiddleware, getCourseMessages);
router.post('/course/:courseId', authMiddleware, postCourseMessage);

// Faculty-only endpoint that enforces the faculty belongs to the course
router.get('/course/:courseId/faculty', authMiddleware, roleMiddleware('faculty'), getCourseMessagesForFaculty);
router.post('/course/:courseId/faculty', authMiddleware, roleMiddleware('faculty'), postCourseMessageForFaculty);

// optional compatibility
// router.get('/course/:courseId/messages', authMiddleware, chatController.getCourseMessages);
// router.post('/course/:courseId/messages', authMiddleware, chatController.postCourseMessage);

module.exports = router;
