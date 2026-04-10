// chat/socket.js
const db = require('../models'); // must be one level up

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('socket connected:', socket.id);

    socket.on('joinCourse', async (courseId) => {
      try {
        if (!courseId) return;
        const room = `course_${courseId}`;
        socket.join(room);

        const CourseMessage = db.CourseMessage || db.courseMessages || db.course_message;
        if (CourseMessage) {
          const msgs = await CourseMessage.findAll({
            where: { course_id: courseId },
            order: [['created_at', 'ASC']],
            limit: 200
          });
          socket.emit('chatHistory', msgs.map(m => ({
            id: m.id,
            course_id: m.course_id,
            user_id: m.user_id,
            sender_name: m.sender_name,
            message: m.message,
            created_at: m.createdAt || m.created_at
          })));
        } else {
          socket.emit('chatHistory', []);
        }
      } catch (err) {
        console.error('joinCourse error', err);
      }
    });

    socket.on('leaveCourse', (courseId) => {
      if (!courseId) return;
      socket.leave(`course_${courseId}`);
    });

    socket.on('sendMessage', async (payload) => {
      try {
        const { courseId, message, userId, senderName } = payload || {};
        if (!courseId || !message) return;

        const CourseMessage = db.CourseMessage || db.courseMessages || db.course_message;
        if (!CourseMessage) return;

        const created = await CourseMessage.create({
          course_id: courseId,
          user_id: userId || null,
          sender_name: senderName || 'Unknown',
          message
        });

        const out = {
          id: created.id,
          course_id: created.course_id,
          user_id: created.user_id,
          sender_name: created.sender_name,
          message: created.message,
          created_at: created.createdAt || created.created_at
        };

        io.to(`course_${courseId}`).emit('newCourseMessage', out);
      } catch (err) {
        console.error('sendMessage socket error', err);
      }
    });

    socket.on('disconnect', () => {});
  });
};
