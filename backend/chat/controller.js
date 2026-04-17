// chat/controller.js
const db = require('../models'); // must point to your models/index.js

const Course = db.Course;
const CourseMessage = db.CourseMessage || db.courseMessages || db.CourseMessage;
const User = db.User; // your User model (used as Faculty in associations)

// NOTE: association alias in your models/index.js is "Faculties"
// so we will include User with as: 'Faculties'
const FACULTIES_ALIAS = 'Faculties';

exports.getCourseMessages = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!courseId) return res.status(400).json({ message: 'Missing courseId' });

    const user = req.user || {};
    const role = user.role || 'unknown';

    if (!Course) {
      console.error('getCourseMessages: Course model missing');
      return res.status(500).json({ message: 'Server misconfigured: Course model missing' });
    }

    // include faculties only if User model exists and association likely defined
    const includeArr = [];
    if (User) {
      // use alias 'Faculties' since models/index.js defines it that way
      includeArr.push({ model: User, as: FACULTIES_ALIAS, attributes: ['id'] });
    }

    const course = await Course.findByPk(courseId, {
      include: includeArr.length ? includeArr : undefined
    });

    if (!course) return res.status(404).json({ message: 'Course not found' });

    // Authorization: admin OR faculty assigned to the course
    if (role !== 'admin') {
      if (role !== 'faculty') return res.status(403).json({ message: 'Only admin or faculty can view course chats' });

      // Check assignment using the included alias if available:
      let assigned = false;
      if (course[FACULTIES_ALIAS] && Array.isArray(course[FACULTIES_ALIAS])) {
        assigned = course[FACULTIES_ALIAS].some(f => Number(f.id) === Number(user.id));
      } else if (typeof course.getFaculties === 'function') {
        // fallback: association methods created by Sequelize
        const facs = await course.getFaculties({ attributes: ['id'] });
        assigned = (facs || []).some(f => Number(f.id) === Number(user.id));
      }

      if (!assigned) return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    // Now fetch messages
    if (!CourseMessage) {
      console.error('getCourseMessages: CourseMessage model missing');
      return res.status(500).json({ message: 'Server misconfigured: CourseMessage model missing' });
    }

    const messages = await CourseMessage.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'ASC']],
      limit: 100
    });

    return res.json({ messages });
  } catch (err) {
    console.error('getCourseMessages error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.postCourseMessage = async (req, res) => {
  try {
    // load models (safe to do here so handler is self-contained)
     // adjust only if your alias is different

    const courseId = Number(req.params.courseId);
    const { message } = req.body || {};
    // req.user may be partially populated by auth middleware
    let user = req.user || {};

    // validate input
    if (!courseId || !message || String(message).trim() === '') {
      return res.status(400).json({ message: 'courseId and message are required' });
    }

    if (!Course) {
      console.error('postCourseMessage: Course model missing');
      return res.status(500).json({ message: 'Server misconfigured: Course model missing' });
    }

    // include faculties so we can check assignment for faculty role
    const includeArr = [];
    if (User) includeArr.push({ model: User, as: FACULTIES_ALIAS, attributes: ['id', 'name', 'email'] });

    const course = await Course.findByPk(courseId, {
      include: includeArr.length ? includeArr : undefined
    });

    if (!course) return res.status(404).json({ message: 'Course not found' });

    // Determine role and permission
    const role = user.role || 'unknown';
    if (role !== 'admin') {
      if (role !== 'faculty') return res.status(403).json({ message: 'Only admin or faculty can post chats' });

      // Check assignment
      let assigned = false;
      if (course[FACULTIES_ALIAS] && Array.isArray(course[FACULTIES_ALIAS])) {
        assigned = course[FACULTIES_ALIAS].some(f => Number(f.id) === Number(user.id));
      } else if (typeof course.getFaculties === 'function') {
        const facs = await course.getFaculties({ attributes: ['id'] });
        assigned = (facs || []).some(f => Number(f.id) === Number(user.id));
      }

      if (!assigned) return res.status(403).json({ message: 'You are not assigned to this course' });
    }

    if (!CourseMessage) {
      console.error('postCourseMessage: CourseMessage model missing');
      return res.status(500).json({ message: 'Server misconfigured: CourseMessage model missing' });
    }

    // Resolve sender info reliably (prefer req.user fields; otherwise fetch from DB)
    let senderName = user.name || user.fullName || user.email || null;
    let senderEmail = user.email || null;
    let senderId = user.id || null;

    if ((!senderName || !senderEmail) && senderId && User) {
      try {
        const dbUser = await User.findByPk(senderId, { attributes: ['id', 'name', 'email'] });
        if (dbUser) {
          senderName = senderName || dbUser.name || null;
          senderEmail = senderEmail || dbUser.email || null;
          senderId = dbUser.id || senderId;
        }
      } catch (e) {
        console.warn('Failed to fetch user for sender info fallback', e);
      }
    }

    // If still missing a readable name, default to 'Unknown'
    if (!senderName) senderName = 'Unknown';

    // Create message record
    const created = await CourseMessage.create({
      course_id: courseId,
      user_id: senderId || null,
      sender_name: senderName,
      message: String(message)
    });

    // Build canonical output including sender object
    const out = {
      id: created.id,
      course_id: created.course_id,
      user_id: created.user_id,
      sender_name: created.sender_name,
      message: created.message,
      created_at: created.createdAt || created.created_at,
      // include sender details so frontend can always show name/email
      sender: {
        id: senderId || null,
        name: senderName,
        email: senderEmail || null
      }
    };

    // Emit via socket if io is attached to app (server.js should set app.set('io', io))
    try {
      const io = req.app && req.app.get && req.app.get('io');
      if (io) io.to(`course_${courseId}`).emit('newCourseMessage', out);
    } catch (emitErr) {
      console.warn('emit failed', emitErr);
    }

    return res.status(201).json({ message: 'sent', data: out });
  } catch (err) {
    console.error('postCourseMessage error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};




//For faculty

const Faculty = db.Faculty || db.User || db.users || db.Users; // fallback
// helper to get io if you registered socket helper
let getIO = null;
try {
  const socketHelper = require('../socket'); // optional; adjust path
  if (socketHelper && socketHelper.getIO) getIO = socketHelper.getIO;
} catch (e) {
  // no socket helper available
}

// Utility: check if faculty (user) is assigned to a course
async function facultyAssignedToCourse(userId, courseId) {
  if (!Course) return false;
  try {
    // try to load the course with its Faculties association; the association alias might be 'Faculties'
    const courseWithFac = await Course.findByPk(courseId, {
      include: (Faculty ? [{ model: Faculty, as: 'Faculties', attributes: ['id'] }] : [])
    });

    if (!courseWithFac) return false;
    // try to read courseWithFac.Faculties or courseWithFac.faculties
    const facets = courseWithFac.Faculties ?? courseWithFac.faculties ?? courseWithFac.Users ?? courseWithFac.users ?? [];
    return facets.some(f => Number(f.id) === Number(userId));
  } catch (err) {
    // If the include alias is wrong, try a fallback: load faculty-courses table or check DB differently
    console.warn('facultyAssignedToCourse fallback error', err && err.message);
    // fallback false (deny)
    return false;
  }
}

// Faculty-only GET: verifies faculty assigned to course before returning messages
exports.getCourseMessagesForFaculty = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const ok = await facultyAssignedToCourse(userId, courseId);
    if (!ok) return res.status(403).json({ message: 'You are not assigned to this course' });

    return exports.getCourseMessages(req, res);
  } catch (err) {
    console.error('getCourseMessagesForFaculty error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Faculty-only POST: verifies assignment before allowing posting
exports.postCourseMessageForFaculty = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user && req.user.id;
    const role = req.user && req.user.role;
    const username = req.user && (req.user.name || req.user.email || 'faculty');
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    const ok = await facultyAssignedToCourse(userId, courseId);
    if (!ok) return res.status(403).json({ message: 'You are not assigned to this course' });

    return exports.postCourseMessage(req, res);
  } catch (err) {
    console.error('postCourseMessageForFaculty error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};