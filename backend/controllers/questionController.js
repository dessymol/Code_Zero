// controllers/questionController.js
const { Op } = require('sequelize');
const {
  Question,
  QuestionBatch,
  Batch,
  Course,
  User,
  sequelize,
  Student,
  Testcase
} = require('../models');

/**
 * Create a question (faculty)
 * POST /api/questions/add
 */
// questionController.js (partial)
// controllers/questionController.js (partial)
// Ensure you have: const { Question } = require('../models'); at top of the file

// assumes Question model and any necessary imports are available in this file
exports.createQuestion = async (req, res) => {
  try {
    const caller = req.user || {};
    const isAdmin = caller.role === 'admin' || caller.isAdmin;

    // By default, assign the question's faculty_id to the caller's id so
    // the creator's name (faculty or admin) can be resolved from Users table.
    // If an admin explicitly wants to create the question on behalf of some faculty,
    // they may pass `faculty_id` in the request body — in that case we use it.
    let facultyId = caller.id ? Number(caller.id) : null;

    if (isAdmin && req.body.faculty_id != null) {
      // allow admin to assign to another faculty explicitly
      const parsed = Number(req.body.faculty_id);
      if (!Number.isNaN(parsed)) facultyId = parsed;
    }

    const {
      title,
      description = '',
      sample_input = '',
      sample_output = '',
      course_id,
      language_id,
      score,
      duration = 10,
    } = req.body || {};

    // basic validation
    if (!title || String(title).trim() === '') {
      return res.status(400).json({ message: 'title is required' });
    }
    if (course_id == null) {
      return res.status(400).json({ message: 'course_id is required' });
    }
    if (language_id == null) {
      return res.status(400).json({ message: 'language_id is required' });
    }
    if (score == null) {
      return res.status(400).json({ message: 'score is required' });
    }

    const payload = {
      title: String(title).trim(),
      description: String(description || ''),
      sample_input: String(sample_input || ''),
      sample_output: String(sample_output || ''),
      course_id: Number(course_id),
      faculty_id: facultyId === null ? null : Number(facultyId),
      language_id: Number(language_id),
      score: Number(score),
      duration: Number(duration),
    };

    const newQuestion = await Question.create(payload);

    // Optionally: If you want to return a payload with resolved faculty name,
    // you can re-query with include(User) here. For now we return the created record.
    return res.status(201).json(newQuestion);
  } catch (err) {
    console.error('createQuestion error:', err);
    const details = err && err.errors ? err.errors.map(e => ({ path: e.path, message: e.message })) : null;
    return res.status(500).json({
      message: 'Could not create question',
      error: err.message,
      details,
    });
  }
};



// Update question (owner faculty or admin)
exports.updateQuestion = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Question id is required' });

    const question = await Question.findByPk(id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const user = req.user || {};
    const requesterId = Number(user.id || 0);
    const isAdmin = user.role === 'admin' || user.isAdmin;
    if (!isAdmin && Number(question.faculty_id) !== requesterId) {
      return res.status(403).json({ message: 'Forbidden: not owner' });
    }

    const allowed = ['title', 'description', 'sample_input', 'sample_output', 'duration', 'language_id', 'score', 'faculty_id'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No valid fields provided' });

    await question.update(updates);
    const updated = await Question.findByPk(id);
    return res.json(updated);
  } catch (err) {
    console.error('updateQuestion error:', err);
    return res.status(500).json({ message: 'Could not update question', error: err.message });
  }
};

// Delete question (owner faculty or admin)
exports.deleteQuestion = async (req, res) => {
  try {
    const id = req.params.id;
    const question = await Question.findByPk(id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const user = req.user || {};
    const isAdmin = user.role === 'admin' || user.isAdmin;
    if (!isAdmin && Number(question.faculty_id) !== Number(user.id)) {
      return res.status(403).json({ message: 'Forbidden: not owner' });
    }

    await question.destroy();
    return res.status(200).json({ message: 'Question deleted' });
  } catch (err) {
    console.error('deleteQuestion error:', err);
    return res.status(500).json({ message: 'Error deleting question', error: err.message });
  }
};

// Admin/faculty question bank (returns batch_states if requested)
// Admin/faculty question bank (returns batch_states if requested)
// Admin/faculty question bank (returns only enabled batches when includeBatches=1)
exports.getQuestionBankForCourse = async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!courseId) return res.status(400).json({ message: 'Invalid course id' });

    const includeBatches = req.query.includeBatches === '1' || req.query.includeBatches === 'true';

    // Build a safe attributes list — avoid selecting DB columns that may not exist (some envs differ)
    const baseAttributes = [
      'id',
      'title',
      'description',
      'sample_input',
      'sample_output',
      'course_id',
      'faculty_id',
      'language_id',
      'score',
      'created_at',
      'updated_at'
    ];

    // Query questions for course
    const questions = await Question.findAll({
      where: { course_id: courseId },
      order: [['created_at', 'ASC']],
      attributes: baseAttributes
    });

    if (!includeBatches) {
      return res.status(200).json({ success: true, questions });
    }

    const questionIds = questions.map(q => q.id);
    if (questionIds.length === 0) {
      return res.status(200).json({ success: true, questions: [] });
    }

    // --- Auto-detect alias for Batch on QuestionBatch associations (defensive) ---
    let batchAlias = null;
    try {
      const assocKeys = Object.keys(QuestionBatch.associations || {});
      for (const key of assocKeys) {
        const assoc = QuestionBatch.associations[key];
        if (!assoc || !assoc.target) continue;

        // try to get a target name in multiple possible shapes
        let targetName = null;
        try {
          if (assoc.target.name) targetName = assoc.target.name;
          else if (assoc.target.options && assoc.target.options.name && assoc.target.options.name.singular) targetName = assoc.target.options.name.singular;
          else if (typeof assoc.target.getTableName === 'function') targetName = String(assoc.target.getTableName());
          else if (assoc.target.tableName) targetName = assoc.target.tableName;
        } catch (e) {
          // ignore and continue
        }

        if (targetName && String(targetName).toLowerCase().includes('batch')) {
          batchAlias = key;
          break;
        }

        // final defensive check: inspect assoc.as or association name
        if (assoc.as && String(assoc.as).toLowerCase().includes('batch')) {
          batchAlias = key;
          break;
        }
      }
    } catch (e) {
      console.warn('could not auto-detect QuestionBatch->Batch alias', e);
    }

    // If alias not found, try common names
    if (!batchAlias) {
      const tries = ['batch', 'Batch', 'Batches', 'batchInfo', 'BatchInfo'];
      for (const t of tries) {
        if (QuestionBatch.associations && QuestionBatch.associations[t]) {
          batchAlias = t;
          break;
        }
      }
    }

    // Build include using detected alias if available
    const includeEntry = {
      model: Batch,
      attributes: ['id', 'name', 'code']
    };
    if (batchAlias) includeEntry.as = batchAlias;

    // Query only enabled QuestionBatch rows and include Batch info by alias (if any)
    const qbs = await QuestionBatch.findAll({
      where: {
        question_id: { [Op.in]: questionIds },
        enabled: true
      },
      attributes: ['id', 'question_id', 'batch_id', 'enabled', 'toggled_by', 'toggled_at'],
      include: [includeEntry]
    });

    // Build map: questionId -> { batchId: {...} }
    const map = {};
    for (const qb of qbs) {
      const qid = qb.question_id;
      if (!map[qid]) map[qid] = {};

      // Try to read included batch object safely from several possible property names
      let batchObj = null;
      if (batchAlias && qb[batchAlias]) batchObj = qb[batchAlias];
      else if (qb.Batch) batchObj = qb.Batch;
      else if (qb.batch) batchObj = qb.batch;
      else if (qb.dataValues && (qb.dataValues.Batch || qb.dataValues.batch || qb.dataValues[batchAlias])) {
        batchObj = qb.dataValues.Batch || qb.dataValues.batch || qb.dataValues[batchAlias];
      }

      map[qid][qb.batch_id] = {
        enabled: qb.enabled,
        toggled_by: qb.toggled_by,
        toggled_at: qb.toggled_at,
        id: qb.id,
        batch: batchObj ? { id: batchObj.id, name: batchObj.name, code: batchObj.code } : { id: qb.batch_id }
      };
    }

    // Attach enabled batch info to each question
    const questionsWithStates = questions.map(q => {
      const qs = (typeof q.toJSON === 'function') ? q.toJSON() : q;
      qs.batch_states = map[q.id] || {}; // only enabled batches included
      qs.enabled_batches = Object.values(qs.batch_states).map(s => s.batch).filter(Boolean);
      return qs;
    });

    return res.status(200).json({ success: true, questions: questionsWithStates });
  } catch (err) {
    console.error('getQuestionBankForCourse:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};





/**
 * Get all questions for a course (student/faculty)
 * GET /api/questions/course/:courseId
 */
exports.getQuestionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const questions = await Question.findAll({
      where: { course_id: courseId },
      attributes: ['id', 'title', 'description', 'sample_input', 'sample_output', 'course_id', 'faculty_id'],
      include: [
        {
          model: Course,
          as: 'Course',
          attributes: ['id', 'name', 'course_code']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    return res.status(200).json({
      message: 'Questions fetched successfully',
      questions
    });
  } catch (error) {
    console.error('Error fetching questions by course:', error);
    return res.status(500).json({
      message: 'Error fetching questions',
      error: error.message
    });
  }
};


/**
 * Toggle question for a batch (upsert) - robust version with checks
 * POST /api/questions/:id/toggle-batch
 * body: { batchId: number, enabled: boolean }
 *
 * Also keep compatibility with route POST /api/questions/:questionId/batch/:batchId/toggle
 */
exports.toggleQuestionForBatch = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Support two calling styles:
    // - route: POST /questions/:id/toggle-batch with body { batchId, enabled }
    // - route: POST /questions/:questionId/batch/:batchId/toggle (no body)
    const paramId = req.params.id || req.params.questionId;
    const questionId = Number(paramId);
    let batchId = req.body.batchId || req.params.batchId;
    batchId = Number(batchId);
    const enabledFromBody = (typeof req.body.enabled === 'boolean') ? req.body.enabled : undefined;
    const userId = req.user && req.user.id;

    if (!questionId || !batchId) {
      await t.rollback();
      return res.status(400).json({ message: 'Missing/invalid questionId or batchId' });
    }

    const question = await Question.findByPk(questionId, { attributes: ['id', 'course_id', 'faculty_id'] });
    if (!question) {
      await t.rollback();
      return res.status(404).json({ message: 'Question not found' });
    }

    const batch = await Batch.findByPk(batchId, { attributes: ['id', 'course_id'] });
    if (!batch) {
      await t.rollback();
      return res.status(404).json({ message: 'Batch not found' });
    }

    if (Number(batch.course_id) !== Number(question.course_id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Batch and question belong to different courses' });
    }

    // Find or create
    const [qb, created] = await QuestionBatch.findOrCreate({
      where: { question_id: questionId, batch_id: batchId },
      defaults: {
        enabled: (enabledFromBody !== undefined) ? enabledFromBody : true,
        toggled_by: userId || null,
        toggled_at: new Date()
      },
      transaction: t
    });

    if (!created) {
      // If enabled specified in body, use it; otherwise toggle
      if (enabledFromBody !== undefined) {
        qb.enabled = enabledFromBody;
      } else {
        qb.enabled = !qb.enabled;
      }
      qb.toggled_by = userId || qb.toggled_by;
      qb.toggled_at = new Date();
      await qb.save({ transaction: t });
    }

    await t.commit();

    // return updated record (without heavy includes)
    return res.status(200).json({ success: true, questionBatch: qb });
  } catch (err) {
    await t.rollback();
    console.error('toggleQuestionForBatch err:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};


/**
 * Get active questions for a batch (student-facing)
 * GET /api/questions/for-batch/:batchId   (your route uses /for-batch/:batchId)
 */
exports.getActiveQuestionsForBatch = async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    if (!batchId) return res.status(400).json({ message: 'Invalid batch id' });

    const questions = await Question.findAll({
      include: [{
        model: QuestionBatch,
        required: true,
        where: { batch_id: batchId, enabled: true },
        attributes: []
      }],
      order: [['created_at', 'ASC']]
    });

    return res.status(200).json({ success: true, questions });
  } catch (err) {
    console.error('getActiveQuestionsForBatch err:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};




/**
 * GET /api/questions/course/:courseId
 * Returns questions for a course filtered for the authenticated student:
 * - questions with no batch toggles (global) OR
 * - questions toggled enabled for any batch that the student belongs to (for that course)
 *
 * Requires studentAuth that sets req.user.id
 */
// controllers/questionController.js
// Add / export this function (or replace if you already have it)


exports.getQuestionsForStudentCourse = async (req, res, next) => {
  try {
    const courseId = Number.parseInt(req.params.courseId, 10);
    if (Number.isNaN(courseId)) return res.status(400).json({ success: false, message: 'Invalid course id' });

    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Load student with batches (so we can inspect batch.course_id)
    const student = await Student.findByPk(studentId, {
      include: [{ model: Batch, attributes: ['id', 'course_id'] }],
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const batchIdsForCourse = (student.Batches || [])
      .filter(b => Number(b.course_id) === Number(courseId))
      .map(b => b.id);

    // Fetch questions for the course, including any QuestionBatch rows (left join)
    // NOTE: we must use the same alias as the association. Your models appear to use "QuestionBatches".
    const questionsRaw = await Question.findAll({
      where: { course_id: courseId },
      include: [
        {
          model: QuestionBatch,
          as: 'QuestionBatches',   // <-- IMPORTANT: match association alias
          required: false,         // left join -> get questions without any QuestionBatch rows
          attributes: ['id', 'batch_id', 'enabled', 'toggled_at'],
        }
      ],
      order: [['id', 'ASC']],
    });

    // filter to visible questions:
    // - questions with no QuestionBatch rows -> considered "global" and visible
    // - OR questions that have at least one QuestionBatch row with enabled===true AND batch_id in student's batches for that course
    const filtered = (questionsRaw || []).filter(q => {
      // Sequelize sometimes names the included rows using different key, try both
      const qbs = q.QuestionBatches || q.QuestionBatch || [];
      // if no batch-rows -> show (global)
      if (!qbs || qbs.length === 0) return true;
      // otherwise check for any enabled row that matches student's batch ids
      const anyEnabled = qbs.some(qb => qb.enabled === true && batchIdsForCourse.includes(qb.batch_id));
      return anyEnabled;
    });

    // Normalize and return
    const questions = filtered.map(q => {
      const qbs = q.QuestionBatches || q.QuestionBatch || [];

      // read language_id and score directly from the Question instance (these fields exist on your model).
      // fallback to null if not present
      const language_id = (q.language_id !== undefined && q.language_id !== null) ? Number(q.language_id) : null;
      const score = (q.score !== undefined && q.score !== null) ? Number(q.score) : null;

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        sample_input: q.sample_input || q.sampleInput || null,
        sample_output: q.sample_output || q.sampleOutput || null,
        language_id,           // <-- newly included
        score,                 // <-- newly included
        batch_states: (qbs || []).reduce((acc, qb) => {
          acc[qb.batch_id] = { enabled: !!qb.enabled, toggled_at: qb.toggled_at || null };
          return acc;
        }, {})
      };
    });

    return res.status(200).json({ success: true, questions });
  } catch (err) {
    console.error('getQuestionsForStudentCourse error:', err);
    return next(err);
  }
};


exports.getAvailableQuestionsForStudent = async (req, res, next) => {
  try {
    const studentId = req.user?.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { courseId } = req.params;
    if (!courseId) return res.status(400).json({ success: false, message: 'Missing courseId' });

    // load student's batches for this course
    // Note: uses the association Student.getBatches available in your models
    const Student = require('../models').Student;
    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const studentBatches = await student.getBatches({
      where: { course_id: courseId },
      attributes: ['id'],
      joinTableAttributes: []
    });

    const batchIds = (studentBatches || []).map(b => b.id);

    if (!batchIds.length) {
      // No batches -> no batch-specific toggles for this student
      // return empty array (no available questions)
      return res.status(200).json({ success: true, questions: [] });
    }

    // Query QuestionBatch entries that are enabled and belong to student's batches,
    // then include the Question details (distinct).
    // We will return unique Questions (no duplicated questions if assigned to multiple batches).
    const qbRows = await QuestionBatch.findAll({
      where: {
        batch_id: { [Op.in]: batchIds },
        enabled: true
      },
      include: [{
        model: Question,
        required: true,
        where: { course_id: courseId },
        attributes: ['id', 'title', 'description', 'sample_input', 'sample_output', 'duration']
      }],
      // if you have pagination you can add limit/offset
    });

    // Collect unique questions
    const map = new Map();
    for (const qb of qbRows) {
      // qb.Question should be populated by include
      const q = qb.Question || qb.dataValues?.Question;
      if (!q) continue;
      if (!map.has(String(q.id))) map.set(String(q.id), q);
    }
    const questions = Array.from(map.values());

    return res.status(200).json({ success: true, questions });
  } catch (err) {
    console.error('getAvailableQuestionsForStudent error:', err);
    next(err);
  }
};
