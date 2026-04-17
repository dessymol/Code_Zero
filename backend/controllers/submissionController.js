const axios = require('axios');
const db = require('../models'); // load models/index.js once
const judge0Service = require('../services/judge0Service');

// destructure models + sequelize instance from db
const {
  Submission,
  Question,
  QuestionBatch,
  Student,
  Course,
  User,
  Batch,
  sequelize
} = db;

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// normalize helper
function normalizeOutput(s = '') {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

exports.executeCode = async (req, res) => {
  try {
    const { code, language, stdin, expectedOutput, questionId } = req.body;
    
    if (!code || !language) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code and language are required' 
      });
    }

    // Get question details if questionId is provided
    let question = null;
    let sampleInput = '';
    let sampleOutput = '';
    
    if (questionId) {
      question = await Question.findByPk(questionId);
      if (question) {
        sampleInput = question.sample_input || '';
        sampleOutput = question.sample_output || '';
      }
    }

    // Use provided stdin or question's sample input
    const inputToUse = stdin || sampleInput;
    
    // Submit to Judge0
    const judgeResult = await judge0Service.submitCode(
      code,
      language,
      inputToUse,
      expectedOutput || sampleOutput,
      true // Wait for execution
    );

    // Return the Judge0 result
    return res.status(200).json({
      success: true,
      data: judgeResult,
      question: question ? {
        id: question.id,
        title: question.title,
        sample_input: question.sample_input,
        sample_output: question.sample_output
      } : null
    });
  } catch (error) {
    console.error('Code execution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error executing code',
      error: error.message
    });
  }
};


exports.submitCode = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      code,
      language_id,
      question_id,
      course_id,
      student_id,
      judge_result, // Optional: if frontend already submitted to Judge0
      jwt_token,
      // New: allow direct submission without pre-executed result
      stdin,
      expected_output
    } = req.body;

    if (!question_id || !student_id) {
      await t.rollback();
      return res.status(400).json({ message: 'question_id and student_id required' });
    }

    const question = await Question.findByPk(question_id, { transaction: t });
    if (!question) {
      await t.rollback();
      return res.status(404).json({ message: 'Question not found' });
    }

    // If question has assigned language, enforce it
    const permittedLang = question.language_id !== undefined && question.language_id !== null
      ? Number(question.language_id)
      : null;
    if (permittedLang !== null && Number(language_id) !== permittedLang) {
      await t.rollback();
      return res.status(400).json({ message: 'Submitted language does not match permitted language for this question' });
    }

    let judgeResult = judge_result;
    
    // If judge_result is not provided, submit to Judge0 ourselves
    if (!judgeResult && code && language_id) {
      try {
        judgeResult = await judge0Service.submitCode(
          code,
          language_id,
          question.sample_input || '',
          question.sample_output || '',
          true
        );
      } catch (judgeError) {
        await t.rollback();
        return res.status(500).json({ 
          message: 'Failed to execute code with Judge0', 
          error: judgeError.message 
        });
      }
    }

    if (!judgeResult) {
      await t.rollback();
      return res.status(400).json({ message: 'judge_result required' });
    }

    // Normalize and compute awarded score (your existing code)
    const rawStdout = (judgeResult.stdout || '').toString();
    const stdout = normalizeOutput(rawStdout);
    const expectedRaw = (question.sample_output || '').toString();
    const expected = normalizeOutput(expectedRaw);
    const statusId = judgeResult.status ? judgeResult.status.id : (judgeResult.status_id || 0);

    let awarded_score = 0;
    const qScore = Number(question.score) || 0;
    if (statusId === 3 && expected !== '') {
      awarded_score = (stdout === expected) ? qScore : 0;
    } else if (statusId === 3 && expected === '') {
      awarded_score = qScore;
    } else {
      awarded_score = 0;
    }

    // Find existing submission (your existing code)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await Submission.findOne({
      where: {
        question_id,
        student_id,
        createdAt: { [Op.between]: [startOfDay, endOfDay] }
      },
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    let submission;
    let action = 'created';

    if (existing && existing.code === code) {
      // Update existing submission
      existing.code = code;
      existing.language_id = Number(language_id);
      existing.output = JSON.stringify(judgeResult);
      existing.status = judgeResult.status ? (judgeResult.status.description || '') : (judgeResult.status_description || '');
      existing.score = Number(awarded_score);
      existing.execution_time = judgeResult.time ? String(judgeResult.time) : existing.execution_time || null;
      existing.updatedAt = new Date();
      submission = await existing.save({ transaction: t });
      action = 'updated';
    } else {
      // Create new submission
      const submissionToken = jwt_token || uuidv4();

      submission = await Submission.create({
        code,
        language_id: Number(language_id),
        question_id,
        student_id,
        output: JSON.stringify(judgeResult),
        status: judgeResult.status ? (judgeResult.status.description || '') : (judgeResult.status_description || ''),
        execution_time: judgeResult.time ? String(judgeResult.time) : null,
        score: Number(awarded_score),
        token: submissionToken,
      }, { transaction: t });

      action = 'created';
    }

    await t.commit();
    
    // Return Judge0 result along with submission data
    return res.status(action === 'created' ? 201 : 200).json({ 
      submission, 
      score: awarded_score, 
      action,
      judgeResult: {
        token: judgeResult.token,
        status: judgeResult.status,
        stdout: judgeResult.stdout,
        stderr: judgeResult.stderr,
        compile_output: judgeResult.compile_output,
        time: judgeResult.time,
        memory: judgeResult.memory
      }
    });
  } catch (err) {
    try { await t.rollback(); } catch (e) { console.warn('rollback failed', e); }
    console.error('submit error', err);
    return res.status(500).json({ message: 'Could not save submission', error: err.message || String(err) });
  }
};

/**
 * NEW: Get supported programming languages from Judge0
 */
exports.getSupportedLanguages = async (req, res) => {
  try {
    const languages = await judge0Service.getLanguages();
    
    // Transform to simpler format for frontend
    const formattedLanguages = languages.map(lang => ({
      id: lang.id,
      name: lang.name,
      value: lang.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      display: lang.name
    }));

    return res.status(200).json({
      success: true,
      languages: formattedLanguages
    });
  } catch (error) {
    console.error('Get languages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch languages',
      languages: [
        { id: 71, name: 'Python 3.8.1', value: 'python', display: 'Python' },
        { id: 63, name: 'JavaScript (Node.js 12.14.0)', value: 'javascript', display: 'JavaScript' },
        { id: 62, name: 'Java (OpenJDK 13.0.1)', value: 'java', display: 'Java' },
        { id: 50, name: 'C (GCC 9.2.0)', value: 'c', display: 'C' },
        { id: 54, name: 'C++ (GCC 9.2.0)', value: 'cpp', display: 'C++' }
      ]
    });
  }
};

/**
 * NEW: Get submission status from Judge0
 */
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Submission token is required'
      });
    }

    const result = await judge0Service.getSubmission(token);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get submission status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission status',
      error: error.message
    });
  }
};




/**
 * Get unique course IDs a student has submissions for.
 */
exports.getCompletedCourses = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });

    const submissions = await Submission.findAll({
      where: { student_id: studentId },
      include: [{ model: Question, attributes: ['course_id'] }],
      attributes: ['id']
    });

    const courseIds = [...new Set(submissions.map(s => s.Question?.course_id).filter(Boolean))];
    return res.status(200).json({ courses: courseIds });
  } catch (err) {
    console.error('getCompletedCourses error:', err);
    return res.status(500).json({ message: 'Could not fetch completed courses', error: err.message });
  }
};

/**
 * Generic: get all submissions for a course (no batch grouping)
 * Used by parts of UI that only need flattened list.
 */
exports.getAllSubmissionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) return res.status(400).json({ message: 'courseId required' });

    const submissions = await Submission.findAll({
      include: [
        {
          model: Question,
          where: { course_id: courseId },
          attributes: []
        },
        {
          model: Student,
          attributes: ['id', 'name', 'email'],
          include: [{ model: Batch, attributes: ['id', 'name', 'code'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const submissionData = submissions.map(sub => ({
      id: sub.id,
      student_id: sub.student_id,
      student_name: sub.Student?.name || null,
      student_email: sub.Student?.email || null,
      student_batches: (sub.Student?.Batches || []).map(b => ({ id: b.id, name: b.name, code: b.code })),
      question_id: sub.question_id,
      code: sub.code,
      language_id: sub.language_id,
      status: sub.status,
      output: sub.output,
      execution_time: sub.execution_time,
      score: sub.score,
      createdAt: sub.createdAt
    }));

    return res.status(200).json({ submissions: submissionData });
  } catch (error) {
    console.error('getAllSubmissionsByCourse error:', error);
    return res.status(500).json({ message: 'Failed to fetch submissions', error: error.message });
  }
};


exports.getQuestionsForStudentCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    // Fetch all questions for the course
    const questions = await Question.findAll({
      where: { course_id: courseId },
      order: [['createdAt', 'DESC']],
      // include associations if you need them (e.g., QuestionBatch) — keep minimal for performance
    });

    // If no authenticated student, return all questions (backwards-compatible)
    const studentId = req.user && req.user.id;
    if (!studentId) {
      const normalized = questions.map(q => {
        const plain = q.get ? q.get({ plain: true }) : q;
        return {
          ...plain,
          language_id: plain.language_id ?? null,
          score: plain.score ?? null,
        };
      });
      return res.status(200).json({ questions: normalized, count: normalized.length });
    }

    // Collect question IDs for this course
    const questionIds = questions.map(q => q.id).filter(Boolean);
    if (questionIds.length === 0) {
      return res.status(200).json({ questions: [], count: 0 });
    }

    // Find distinct question_ids the student has submitted for (any submission)
    const submitted = await Submission.findAll({
      where: {
        student_id: studentId,
        question_id: { [Op.in]: questionIds }
      },
      attributes: ['question_id'],
      group: ['question_id']
    });

    const submittedIds = submitted.map(s => s.question_id).filter(Boolean);

    // Filter out submitted questions
    const remaining = questions.filter(q => !submittedIds.includes(q.id));

    // Normalize shape for frontend consumption
    const normalized = remaining.map(q => {
      const plain = q.get ? q.get({ plain: true }) : q;
      return {
        ...plain,
        language_id: plain.language_id ?? null,
        score: plain.score ?? null,
      };
    });

    return res.status(200).json({ questions: normalized, count: normalized.length });
  } catch (err) {
    console.error('getQuestionsForStudentCourse error:', err);
    return res.status(500).json({ message: 'Could not fetch questions', error: err.message || String(err) });
  }
};


/**
 * ADMIN: get course submissions with optional batch filter (batchId or batchCode).
 * - If batchId/batchCode provided: return only submissions whose student belongs to that batch.
 * - If no batch filter provided: return all submissions for the course (backwards-compatible).
 */
exports.getCourseSubmissionsForAdmin = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { batchId, batchCode } = req.query;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'courseId is required' });
    }

    // Ensure course exists
    const course = await require('../models').Course.findByPk(courseId, {
      attributes: ['id', 'name', 'course_code']
    });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Batch filter logic (by id or code)
    let batchFilterObj = {};
    if (batchId) batchFilterObj.id = batchId;
    if (batchCode) batchFilterObj.code = batchCode;

    let studentInclude = {
      model: require('../models').Student,
      attributes: ['id', 'name', 'email'],
      include: [{
        model: require('../models').Batch,
        attributes: ['id', 'name', 'code'],
        ...(batchId || batchCode ? { where: batchFilterObj } : {})
      }]
    };

    // Only include students that are a member of the specified batch
    let submissionWhere = {};
    let include = [
      {
        model: require('../models').Question,
        attributes: ['id', 'title', 'course_id'],
        where: { course_id: courseId },
        include: [{ model: require('../models').Course, attributes: ['id', 'name', 'course_code'] }]
      },
      studentInclude
    ];

    let submissions = await require('../models').Submission.findAll({
      include,
      order: [['createdAt', 'DESC']]
    });

    // If filtering by batch, only keep submissions where the student is a member of the batch
    if (batchId || batchCode) {
      submissions = submissions.filter(sub => {
        const studentBatches = (sub.Student.Batches || []);
        // There must be at least one batch matching the filter
        return studentBatches.some(
          b =>
            (batchId && Number(b.id) === Number(batchId)) ||
            (batchCode && b.code === batchCode)
        );
      });
    }

    const submissionData = submissions.map(s => ({
      id: s.id,
      student_id: s.student_id,
      student_name: s.Student?.name || null,
      student_email: s.Student?.email || null,
      student_batches: (s.Student?.Batches || []).map(b => ({ id: b.id, name: b.name, code: b.code })),
      question_id: s.question_id,
      question_title: s.Question?.title || null,
      code: s.code,
      language_id: s.language_id,
      status: s.status,
      output: s.output,
      execution_time: s.execution_time,
      score: s.score,
      createdAt: s.createdAt
    }));

    return res.status(200).json({ success: true, course, submissions: submissionData });
  } catch (error) {
    console.error('Error fetching submissions (admin by course):', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching submissions',
      error: error.message
    });
  }
};



exports.getSubmissionsByCourseAndBatch = async (req, res) => {
  try {
    const { courseId, batchId } = req.params;
    if (!courseId || !batchId) return res.status(400).json({ success: false, message: 'courseId and batchId are required' });

    // Inner join student->batch with a where clause ensures only students in batchId will be returned
    const submissions = await Submission.findAll({
      include: [
        {
          model: Question,
          attributes: ['id', 'title', 'course_id'],
          where: { course_id: courseId },
          include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }]
        },
        {
          model: Student,
          attributes: ['id', 'name', 'email'],
          include: [{
            model: Batch,
            attributes: ['id', 'name', 'code'],
            where: { id: batchId } // THIS enforces the student being in the given batch
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const submissionData = submissions.map(s => ({
      id: s.id,
      student_id: s.student_id,
      student_name: s.Student?.name || null,
      student_email: s.Student?.email || null,
      student_batches: (s.Student?.Batches || []).map(b => ({ id: b.id, name: b.name, code: b.code })),
      question_id: s.question_id,
      question_title: s.Question?.title || null,
      code: s.code,
      language_id: s.language_id,
      status: s.status,
      output: s.output,
      execution_time: s.execution_time,
      score: s.score,
      createdAt: s.createdAt
    }));

    return res.status(200).json({ success: true, submissions: submissionData });
  } catch (error) {
    console.error('getSubmissionsByCourseAndBatch error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching submissions', error: error.message });
  }
};



/**
 * Faculty view for course submissions:
 * - Faculty must be assigned to course (attempts to validate).
 * - Optional batch filter (query param batchId) restricts to students in that batch.
 */
exports.getCourseSubmissionsForFaculty = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    const { courseId } = req.params;
    const { batchId } = req.query; // optional

    if (!facultyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId required' });

    const course = await Course.findByPk(courseId, { attributes: ['id', 'name', 'course_code'] });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    // Optional: check faculty assignment to this course
    let assigned = true;
    try {
      if (typeof course.hasFaculty === 'function') {
        assigned = await course.hasFaculty(facultyId);
      } else if (typeof course.getFaculties === 'function') {
        const facs = await course.getFaculties({ where: { id: facultyId } });
        assigned = facs && facs.length > 0;
      }
    } catch (e) {
      assigned = true;
    }
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this course' });
    }

    // Build includes
    const include = [
      {
        model: Question,
        attributes: ['id', 'title', 'course_id'],
        where: { course_id: courseId },
        include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }]
      },
      {
        model: Student,
        attributes: ['id', 'name', 'email'],
        include: [
          {
            model: Batch,
            attributes: ['id', 'name', 'code'],
            ...(batchId ? { where: { id: batchId }, required: true } : {})
          }
        ]
      }
    ];

    const submissions = await Submission.findAll({
      include,
      order: [['createdAt', 'DESC']]
    });

    // Map clean data
    const submissionData = submissions.map((s) => ({
      id: s.id,
      student_id: s.student_id,
      student_name: s.Student?.name || null,
      student_email: s.Student?.email || null,
      student_batches: (s.Student?.Batches || []).map(b => ({
        id: b.id,
        name: b.name,
        code: b.code
      })),
      question_id: s.question_id,
      question_title: s.Question?.title || null,
      code: s.code,
      language_id: s.language_id,
      status: s.status,
      output: s.output,
      execution_time: s.execution_time,
      score: s.score,
      createdAt: s.createdAt
    }));

    return res.status(200).json({ success: true, course, submissions: submissionData });
  } catch (error) {
    console.error('Error fetching submissions (faculty by course):', error);
    return res.status(500).json({ success: false, message: 'Error fetching submissions', error: error.message });
  }
};


exports.getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const subs = await Submission.findAll({
      where: { student_id: studentId },
      include: [
        {
          model: Question,
          attributes: ['id', 'title', 'course_id'],
          include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }]
        },
        {
          model: Student,
          attributes: ['id','name','email'],
          include: [{ model: Batch, attributes: ['id','name','code'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 200
    });

    const data = subs.map(s => ({
      id: s.id,
      question_id: s.question_id,
      question_title: s.Question?.title || null,
      course: s.Question?.Course ? { id: s.Question.Course.id, name: s.Question.Course.name, code: s.Question.Course.course_code || s.Question.Course.code } : null,
      status: s.status,
      score: s.score,
      createdAt: s.createdAt,
      student_batches: (s.Student?.Batches || []).map(b => ({ id: b.id, name: b.name, code: b.code }))
    }));

    return res.status(200).json({ success: true, submissions: data });
  } catch (err) {
    console.error('getMySubmissions error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: err.message });
  }
};
