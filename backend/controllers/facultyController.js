const bcrypt = require('bcryptjs');
const {
  Submission,
  Question,
  Student,
  Course,
  FacultyCourse,
  User,
  Faculty,
} = require('../models');
const { sendMail } = require('../utils/mailer');
const { facultyTemplate } = require('../utils/emailTemplates');

// Admin adds a faculty to users table
exports.addFaculty = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // normalize email
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const faculty = await User.create({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: 'faculty'
    });

    // Send email with credentials (do not fail creation if email fails)
    try {
      const html = facultyTemplate({ name: faculty.name || '', email: faculty.email, password: password });
      await sendMail({ to: faculty.email, subject: 'Your faculty account — ICT Portal', html });
    } catch (mailErr) {
      console.error('Failed to send faculty welcome email', mailErr);
      // Optionally include a flag in response so frontend can warn admin
      return res.status(201).json({ message: 'Faculty added (email failed)', faculty, emailSent: false });
    }

    return res.status(201).json({ message: 'Faculty added', faculty, emailSent: true });
  } catch (error) {
    console.error('addFaculty error', error);
    res.status(500).json({ message: 'Error adding faculty', error: error.message || error });
  }
};


exports.getAllFaculties = async (req, res) => {
  try {
    const faculties = await User.findAll({ where: { role: 'faculty' } });
    res.status(200).json({ 
            success: true,
            count: faculties.length,
            faculties : faculties });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching faculties', error });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    const faculty = await User.findOne({ where: { id, role: 'faculty' } });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    faculty.name = name || faculty.name;
    faculty.email = email || faculty.email;
    faculty.phone = phone || faculty.phone;

    await faculty.save();

    res.status(200).json({ message: 'Faculty updated', faculty });
  } catch (error) {
    res.status(500).json({ message: 'Error updating faculty', error });
  }
};


exports.deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;

    const faculty = await User.findOne({ where: { id, role: 'faculty' } });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    await faculty.destroy();

    res.status(200).json({ message: 'Faculty deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting faculty', error });
  }
};


exports.getSubmissionsByCourse = async (req, res) => {
  try {
    // const { courseId } = req.params.courseId;
    const { courseId } = req.params;

    const submissions = await Submission.findAll({
      include: [
        {
          model: Question,
          where: { course_id: courseId },
          attributes: [], // don't need to expose question fields except id, but can add as needed
        },
        {
          model: Student,
          attributes: ['id', 'name'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const submissionData = submissions.map((sub) => ({
      id: sub.id,
      student_id: sub.student_id,
      student_name: sub.Student ? sub.Student.name : 'N/A',
      question_id: sub.question_id,
      code: sub.code,
      language_id: sub.language_id,
      status: sub.status,
      output: sub.output,
      execution_time: sub.execution_time,
      score: sub.score,
      createdAt: sub.createdAt,
    }));

    return res.status(200).json({ submissions: submissionData });
  } catch (error) {
    console.error('Error fetching submissions by course:', error);
    return res.status(500).json({ message: 'Failed to fetch submissions', error: error.message });
  }
};

exports.getAllSubmissionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    // Join Submission -> Question (with courseId), include Student info
    const submissions = await Submission.findAll({
      include: [
        { model: Question, where: { course_id: courseId }, attributes: [] },
        { model: Student, attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Map or format as needed, e.g., group by student, etc.
    res.status(200).json({ submissions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
};

exports.getFacultiesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Course ID is required' });
    }

    // Fetch course with its faculties (via course_faculties join table)
    const course = await Course.findByPk(courseId, {
      include: [
        {
          model: User,
          as: 'Faculties', // must match association in models/index.js
          attributes: ['id', 'name', 'email'],
          through: { attributes: [] } // exclude join table fields
        }
      ],
      attributes: ['id']
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const faculties = course.Faculties || [];
    return res.status(200).json({
      success: true,
      count: faculties.length,
      faculties
    });
  } catch (err) {
    console.error('getFacultiesByCourse error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
