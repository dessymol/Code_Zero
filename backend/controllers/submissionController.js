exports.getSubmissionFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const submissionId = Number(id);
    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      return res.status(400).json({ message: 'Valid submission id is required' });
    }

    const feedback = await db.SubmissionFeedback.findOne({
      where: { submission_id: submissionId }
    });
    if (!feedback) {
      return res.status(200).json({ status: 'pending' });
    }
    return res.json(feedback);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllStudentFeedback = async (req, res) => {
  try {
    const studentId = req.user.id; // from studentAuth middleware
    console.log(`[getAllStudentFeedback] Fetching feedback for student ${studentId}`);

    const feedbackList = await db.SubmissionFeedback.findAll({
      include: [{
        model: db.Submission,
        where: { student_id: studentId },
        include: [{
          model: db.Question,
          attributes: ['title'],
          include: [{
            model: db.Course,
            attributes: ['name']
          }]
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    console.log(`[getAllStudentFeedback] Found ${feedbackList.length} feedback records for student ${studentId}`);
    if (feedbackList.length > 0) {
      console.log(`[getAllStudentFeedback] Sample feedback:`, feedbackList[0]);
    }

    return res.json(feedbackList);
  } catch (err) {
    console.error(`[getAllStudentFeedback] Error:`, err.message);
    return res.status(500).json({ message: err.message });
  }
};
const axios = require('axios');
const db = require('../models'); // load models/index.js once
const judge0Service = require('../services/judge0Service');
const { generateFeedback } = require('../services/llmServices');
const { getActiveLLMConfig } = require('../services/apiSettingsService');

// destructure models + sequelize instance from db
const {
  Submission,
  Question,
  QuestionBatch,
  Student,
  Course,
  User,
  AuditLog,
  Batch,
  Testcase,
  TestResult,
  sequelize
} = db;

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// Language ID to Name mapping for feedback
const LANGUAGE_ID_MAP = {
  71: 'Python 3.8.1',
  70: 'Python 2.7',
  63: 'JavaScript (Node.js 12.14.0)',
  62: 'Java (OpenJDK 13.0.1)',
  50: 'C (GCC 9.2.0)',
  54: 'C++ (GCC 9.2.0)',
  51: 'C# (Mono 6.12.0)',
  60: 'Go (1.13.5)',
  78: 'Kotlin (1.3.71)',
  68: 'PHP (7.4.1)',
};

// normalize helper
function normalizeOutput(s = '') {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
}

function getJudgeStatusId(result = {}) {
  return result.status ? result.status.id : (result.status_id || 0);
}

function getGradedStatus(awardedScore, maxScore, statusId) {
  if (statusId !== 3) {
    return statusId === 6 ? 'Compilation Error' : 'Runtime/Error';
  }

  const score = Number(awardedScore) || 0;
  const total = Number(maxScore) || 0;
  if (total > 0 && score >= total) return 'Accepted';
  if (score > 0) return 'Partially Accepted';
  return 'Wrong Answer';
}

const EXAM_VIOLATION_ACTION = 'EXAM_VIOLATION';

async function getExamViolationLogs(studentId, courseId) {
  if (!AuditLog) return [];
  return AuditLog.findAll({
    where: {
      user_id: studentId,
      action: EXAM_VIOLATION_ACTION,
      resource_type: 'COURSE_EXAM',
      resource_id: Number(courseId)
    },
    order: [['id', 'ASC']]
  });
}

function normalizeViolationLogs(logs = []) {
  return logs.map((log) => ({
    id: log.id,
    reason: log.details?.reason || 'Violation recorded',
    time: log.createdAt
  }));
}

function buildExamSessionKey(questionId, batchId, activationVersion) {
  return `q:${Number(questionId)}:b:${batchId ? Number(batchId) : 0}:v:${Math.max(1, Number(activationVersion) || 1)}`;
}

function chooseActiveBatchState(questionBatches = [], batchIdsForCourse = []) {
  return (questionBatches || [])
    .filter((qb) => qb.enabled === true && batchIdsForCourse.includes(Number(qb.batch_id)))
    .sort((a, b) => {
      const aTime = a.toggled_at ? new Date(a.toggled_at).getTime() : 0;
      const bTime = b.toggled_at ? new Date(b.toggled_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (Number(b.activation_version) || 1) - (Number(a.activation_version) || 1);
    })[0] || null;
}

async function getVisibleQuestionSessionsForStudentCourse(studentId, courseId) {
  if (!studentId || !courseId) return [];

  const student = await Student.findByPk(studentId, {
    include: [{ model: Batch, attributes: ['id', 'course_id'] }]
  });
  if (!student) return [];

  const batchIdsForCourse = (student.Batches || [])
    .filter((batch) => Number(batch.course_id) === Number(courseId))
    .map((batch) => Number(batch.id))
    .filter(Boolean);

  const questionsRaw = await Question.findAll({
    where: { course_id: Number(courseId) },
    include: [{
      model: db.QuestionBatch,
      as: 'QuestionBatches',
      required: false,
      attributes: ['id', 'batch_id', 'enabled', 'activation_version', 'toggled_at']
    }],
    order: [['id', 'ASC']]
  });

  return (questionsRaw || [])
    .map((question) => {
      const plain = question.get ? question.get({ plain: true }) : question;
      const qbs = plain.QuestionBatches || plain.QuestionBatch || [];

      if (!qbs || qbs.length === 0) {
        return {
          question: plain,
          questionId: Number(plain.id),
          batchId: null,
          activationVersion: 1,
          examSessionKey: buildExamSessionKey(plain.id, null, 1),
          isLegacyCompatible: true
        };
      }

      const activeBatch = chooseActiveBatchState(qbs, batchIdsForCourse);
      if (!activeBatch) return null;

      const activationVersion = Math.max(1, Number(activeBatch.activation_version) || 1);
      return {
        question: plain,
        questionId: Number(plain.id),
        batchId: Number(activeBatch.batch_id),
        activationVersion,
        examSessionKey: buildExamSessionKey(plain.id, activeBatch.batch_id, activationVersion),
        isLegacyCompatible: activationVersion === 1
      };
    })
    .filter(Boolean);
}

async function getStudentCourseExamState(studentId, courseId) {
  const visibleSessions = await getVisibleQuestionSessionsForStudentCourse(studentId, courseId);
  if (!visibleSessions.length) {
    return {
      visibleSessions: [],
      visibleQuestionIds: [],
      submittedQuestionIds: [],
      remainingQuestionIds: [],
      hasAnySubmission: false,
      alreadySubmitted: false
    };
  }

  const visibleQuestionIds = visibleSessions.map((session) => session.questionId);
  const visibleSessionKeys = visibleSessions.map((session) => session.examSessionKey);
  const legacyCompatibleQuestionIds = visibleSessions
    .filter((session) => session.isLegacyCompatible)
    .map((session) => session.questionId);

  const submittedRows = await Submission.findAll({
    where: {
      student_id: studentId,
      [Op.or]: [
        { exam_session_key: { [Op.in]: visibleSessionKeys } },
        {
          question_id: { [Op.in]: legacyCompatibleQuestionIds.length ? legacyCompatibleQuestionIds : [-1] },
          exam_session_key: { [Op.is]: null }
        }
      ]
    },
    attributes: ['question_id', 'exam_session_key'],
    group: ['question_id', 'exam_session_key']
  });

  const submittedSessionKeys = new Set();
  const submittedQuestionIdSet = new Set();
  submittedRows.forEach((row) => {
    const questionId = Number(row.question_id);
    const sessionKey = row.exam_session_key || null;
    if (sessionKey) {
      submittedSessionKeys.add(String(sessionKey));
      if (questionId) submittedQuestionIdSet.add(questionId);
      return;
    }

    const legacySession = visibleSessions.find((session) => session.questionId === questionId && session.isLegacyCompatible);
    if (legacySession) {
      submittedSessionKeys.add(legacySession.examSessionKey);
      submittedQuestionIdSet.add(questionId);
    }
  });

  const remainingSessions = visibleSessions.filter((session) => !submittedSessionKeys.has(session.examSessionKey));
  const submittedQuestionIds = visibleSessions
    .filter((session) => submittedSessionKeys.has(session.examSessionKey))
    .map((session) => session.questionId);
  const remainingQuestionIds = remainingSessions.map((session) => session.questionId);

  return {
    visibleSessions,
    visibleQuestionIds,
    submittedQuestionIds,
    remainingQuestionIds,
    hasAnySubmission: submittedSessionKeys.size > 0,
    alreadySubmitted: visibleSessions.length > 0 && remainingSessions.length === 0
  };
}

function formatTestCaseResultsForFeedback(rows = []) {
  return rows.map((row, index) => ({
    number: index + 1,
    testcase_id: row.test_case_id || row.testcase_id || row.testcaseId || null,
    input: row.input || '',
    expected_output: row.expected_output || '',
    actual_output: row.actual_output || row.output || '',
    passed: Boolean(row.passed),
    status: row.status || (row.passed ? 'passed' : 'failed'),
    error_message: row.error_message || null
  }));
}

exports.getExamViolationStatus = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    const { courseId } = req.params;

    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId is required' });

    const course = await Course.findByPk(courseId, { attributes: ['id', 'allowed_violations'] });
    const violationLimit = Math.max(1, Number(course?.allowed_violations) || 3);
    const logs = await getExamViolationLogs(studentId, courseId);
    const count = logs.length;
    const examState = await getStudentCourseExamState(studentId, courseId);
    const alreadySubmitted = examState.alreadySubmitted;
    const blocked = alreadySubmitted || count >= violationLimit;

    return res.status(200).json({
      success: true,
      courseId: Number(courseId),
      alreadySubmitted,
      violationLimit,
      violationCount: count,
      remainingViolations: Math.max(0, violationLimit - count),
      blocked,
      message: alreadySubmitted
        ? 'You have already completed this exam'
        : (count >= violationLimit ? 'This exam is locked because the maximum number of violations has been reached.' : ''),
      violations: normalizeViolationLogs(logs)
    });
  } catch (err) {
    console.error('getExamViolationStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch exam violation status', error: err.message });
  }
};

exports.recordExamViolation = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    const { courseId } = req.params;
    const reason = String(req.body?.reason || 'Violation recorded').trim();

    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!courseId) return res.status(400).json({ success: false, message: 'courseId is required' });

    const course = await Course.findByPk(courseId, { attributes: ['id', 'allowed_violations'] });
    const violationLimit = Math.max(1, Number(course?.allowed_violations) || 3);

    if (AuditLog) {
      await AuditLog.create({
        user_id: studentId,
        action: EXAM_VIOLATION_ACTION,
        resource_type: 'COURSE_EXAM',
        resource_id: Number(courseId),
        status: 'success',
        details: {
          reason,
          studentId,
          courseId: Number(courseId)
        }
      });
    }

    const logs = await getExamViolationLogs(studentId, courseId);
    const count = logs.length;

    return res.status(201).json({
      success: true,
      courseId: Number(courseId),
      violationLimit,
      violationCount: count,
      remainingViolations: Math.max(0, violationLimit - count),
      blocked: count >= violationLimit,
      violations: normalizeViolationLogs(logs)
    });
  } catch (err) {
    console.error('recordExamViolation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record exam violation', error: err.message });
  }
};

exports.executeCode = async (req, res) => {
  try {
    const { code, language, stdin, expectedOutput, questionId } = req.body;
    const normalizedLanguageId = Number(language);

    if (!code || !normalizedLanguageId) {
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
    judgeResult = await judge0Service.submitCode(
      code,
      language_id,
      stdin || question.sample_input || '',   // prefer req.body.stdin
      question.sample_output || '',
      true
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
    const resolvedCourseId = Number(course_id || question.course_id);
    const visibleSessions = await getVisibleQuestionSessionsForStudentCourse(student_id, resolvedCourseId);
    const currentExamSession = visibleSessions.find((session) => Number(session.questionId) === Number(question_id));
    if (!currentExamSession) {
      await t.rollback();
      return res.status(403).json({ message: 'This question is not active for the student in the current exam' });
    }
    const testcases = await db.Testcase.findAll({
      where: { question_id },
      transaction: t
    });
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
    const statusId = getJudgeStatusId(judgeResult);

    let awarded_score = 0;
    const qScore = Number(question.score) || 0;
    let testResultRows = []; // DB rows; also reused for AI feedback context.
    let gradingStatusId = statusId;

    if (testcases.length > 0) {
      // ── Multi-testcase scoring path ───────────────────────────────
      let passedCount = 0;
      testResultRows = []; // Initialize for this path

      for (const tc of testcases) {
        let tcResult;
        try {
          tcResult = await judge0Service.submitCode(
            code,
            language_id,
            tc.input || '',
            tc.output || '',
            true   // wait
          );
        } catch (e) {
          tcResult = { status: { id: 0, description: 'Judge0 error' }, stdout: '' };
        }

        const tcStdout = normalizeOutput((tcResult.stdout || '').toString());
        const tcExpected = normalizeOutput((tc.output || '').toString());
        const tcStatusId = getJudgeStatusId(tcResult);
        const passed = tcStatusId === 3 && tcStdout === tcExpected;
        if (passed) passedCount++;
        if (tcStatusId !== 3 && gradingStatusId === 3) gradingStatusId = tcStatusId;

        testResultRows.push({
          submission_id: null, // filled in after submission is created
          test_case_id: tc.id,
          testcase_id: tc.id,
          input: tc.input || '',
          expected_output: tcExpected,
          passed,
          status: passed ? 'passed' : (tcStatusId === 3 ? 'failed' : 'error'),
          output: tcStdout,
          actual_output: tcStdout,
          execution_time: tcResult.time ? Number(tcResult.time) : null,
          memory_usage: tcResult.memory != null ? Number(tcResult.memory) : null,
          error_message: tcResult.stderr || tcResult.compile_output || null
        });
      }

      awarded_score = Math.round((passedCount / testcases.length) * qScore);
      if (passedCount > 0) gradingStatusId = 3;

      // Store per-testcase results (after submission row is created — see Step C)
      // We carry testResultRows forward via a closure variable.
      // (See Step C below for the insert.)

    } else {
      // ── Fallback: single sample_output comparison ─────────────────
      const rawStdout = (judgeResult.stdout || '').toString();
      const stdout = normalizeOutput(rawStdout);
      const expectedRaw = (question.sample_output || '').toString();
      const expected = normalizeOutput(expectedRaw);
      const statusId = getJudgeStatusId(judgeResult);
      gradingStatusId = statusId;

      if (statusId === 3 && expected !== '') {
        awarded_score = (stdout === expected) ? qScore : 0;
      } else if (statusId === 3 && expected === '') {
        awarded_score = qScore;
      }
    }

    const gradedStatus = getGradedStatus(awarded_score, qScore, gradingStatusId);

    // Find existing submission (your existing code)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await Submission.findOne({
      where: {
        question_id,
        student_id,
        exam_session_key: currentExamSession.examSessionKey,
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
      existing.status = gradedStatus;
      existing.score = Number(awarded_score);
      existing.batch_id = currentExamSession.batchId;
      existing.activation_version = currentExamSession.activationVersion;
      existing.exam_session_key = currentExamSession.examSessionKey;
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
        batch_id: currentExamSession.batchId,
        activation_version: currentExamSession.activationVersion,
        exam_session_key: currentExamSession.examSessionKey,
        output: JSON.stringify(judgeResult),
        status: gradedStatus,
        execution_time: judgeResult.time ? String(judgeResult.time) : null,
        score: Number(awarded_score),
        token: submissionToken,
      }, { transaction: t });

      action = 'created';
    }

    await t.commit();
    if (testcases.length > 0 && testResultRows.length > 0) {
      const submissionId = submission.id;
      setImmediate(async () => {
        try {
          const rows = testResultRows.map(r => ({
            submission_id: submissionId,
            test_case_id: r.test_case_id,
            status: r.status,
            execution_time: r.execution_time,
            memory_usage: r.memory_usage,
            output: r.output,
            error_message: r.error_message
          }));
          await db.TestResult.bulkCreate(rows);
        } catch (err) {
          console.warn('[TestResults] Failed to save test results:', err.message);
        }
      });
    }
    // ── Async AI Feedback (fire-and-forget) ──────────────────────
    // This runs AFTER the response is sent. Student never waits for this.
    const activeLLM = await getActiveLLMConfig().catch(() => null);
    if (activeLLM || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.LLM_PROVIDER === 'local') {
      const submissionId = submission.id;
      const languageName = LANGUAGE_ID_MAP[Number(language_id)] || `Language ${language_id}`;
      const inputToUse = stdin || question.sample_input || '';
      const faculty = question.faculty_id
        ? await User.findByPk(question.faculty_id, { attributes: ['llm_provider'] })
        : null;
      const feedbackPayload = {
        code,
        input: inputToUse,
        languageName,
        question: {
          title: question.title,
          description: question.description,
          sample_output: question.sample_output,
          reference_solution: question.reference_solution
        },
        judgeResult,
        score: awarded_score,
        maxScore: question.score,
        testCaseResults: formatTestCaseResultsForFeedback(testResultRows),
        llmProvider: faculty?.llm_provider
      };

      console.log(`[Feedback] Starting generation for submission ${submissionId}`);

      setImmediate(async () => {
        try {
          console.log(`[Feedback] Calling generateFeedback for submission ${submissionId}`);
          const feedback = await generateFeedback(feedbackPayload);
          console.log(`[Feedback] Generated feedback for submission ${submissionId}:`, feedback);

          const [feedbackRow, created] = await db.SubmissionFeedback.findOrCreate({
            where: { submission_id: submissionId },
            defaults: {
              submission_id: submissionId,
              summary: feedback.summary || null,
              what_went_wrong: feedback.what_went_wrong || null,
              hint: feedback.hint || null,
              positive: feedback.positive || null,
              similarity_percentage: feedback.similarity_percentage != null ? Number(feedback.similarity_percentage) : null,
              similarity_feedback: feedback.similarity_feedback || null,
              testcase_feedback: feedback.testcase_feedback || null,
              status: 'done'
            }
          });

          if (!created) {
            feedbackRow.summary = feedback.summary || null;
            feedbackRow.what_went_wrong = feedback.what_went_wrong || null;
            feedbackRow.hint = feedback.hint || null;
            feedbackRow.positive = feedback.positive || null;
            feedbackRow.similarity_percentage = feedback.similarity_percentage != null ? Number(feedback.similarity_percentage) : null;
            feedbackRow.similarity_feedback = feedback.similarity_feedback || null;
            feedbackRow.testcase_feedback = feedback.testcase_feedback || null;
            feedbackRow.status = 'done';
            await feedbackRow.save();
          }
          console.log(`[Feedback] Successfully saved feedback for submission ${submissionId}`);
        } catch (err) {
          console.error(`[Feedback] Failed for submission ${submissionId}:`, err.message);
          console.error(`[Feedback] Error details:`, err);
          // Silently create a failed record so the frontend knows to stop polling
          try {
            const [feedbackRow, created] = await db.SubmissionFeedback.findOrCreate({
              where: { submission_id: submissionId },
              defaults: {
                submission_id: submissionId,
                status: 'failed'
              }
            });
            if (!created) {
              feedbackRow.status = 'failed';
              await feedbackRow.save();
            }
            console.log(`[Feedback] Created failed record for submission ${submissionId}`);
          } catch (createErr) {
            console.error(`[Feedback] Failed to create failed record:`, createErr.message);
          }
        }
      });
    } else {
      console.log(`[Feedback] Skipping feedback generation - no active LLM configuration found`);
    }
    // ─────────────────────────────────────────────────────────────

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
      attributes: ['question_id'],
      group: ['Submission.question_id', 'Question.id', 'Question.course_id']
    });

    const attemptedCourseIds = [...new Set(
      submissions
        .map((submission) => Number(submission.Question?.course_id))
        .filter(Boolean)
    )];

    const completedCourseIds = [];
    for (const courseId of attemptedCourseIds) {
      const examState = await getStudentCourseExamState(studentId, courseId);
      if (examState.alreadySubmitted) {
        completedCourseIds.push(courseId);
      }
    }

    return res.status(200).json({ courses: completedCourseIds });
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
      manually_overridden: Boolean(sub.manually_overridden),
      approved: Boolean(sub.approved),
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

    const examState = await getStudentCourseExamState(studentId, courseId);
    const remainingSessions = (examState.visibleSessions || []).filter(
      (session) => examState.remainingQuestionIds.includes(session.questionId)
    );

    const currentCycleQuestions = remainingSessions.map((session) => {
      const plain = session.question || {};
      return {
        ...plain,
        batch_id: session.batchId,
        activation_version: session.activationVersion,
        exam_session_key: session.examSessionKey,
        language_id: plain.language_id ?? null,
        score: plain.score ?? null,
      };
    });

    return res.status(200).json({ questions: currentCycleQuestions, count: currentCycleQuestions.length });

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
      manually_overridden: Boolean(s.manually_overridden),
      approved: Boolean(s.approved),
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
      manually_overridden: Boolean(s.manually_overridden),
      approved: Boolean(s.approved),
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
      manually_overridden: Boolean(s.manually_overridden),
      approved: Boolean(s.approved),
      createdAt: s.createdAt
    }));

    return res.status(200).json({ success: true, course, submissions: submissionData });
  } catch (error) {
    console.error('Error fetching submissions (faculty by course):', error);
    return res.status(500).json({ success: false, message: 'Error fetching submissions', error: error.message });
  }
};

exports.getFacultySummary = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    if (!facultyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const faculty = await User.findByPk(facultyId, {
      include: [
        {
          model: Course,
          as: 'FacultyCourses',
          through: { attributes: [] },
          attributes: ['id', 'name', 'course_code', 'is_active']
        }
      ]
    });

    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });

    const courses = Array.isArray(faculty.FacultyCourses) ? faculty.FacultyCourses : [];
    const courseIds = courses.map(c => c.id).filter(Boolean);

    if (!courseIds.length) {
      return res.status(200).json({ success: true, courses: [], courseStatus: {}, timeseries: [] });
    }

    const submissions = await Submission.findAll({
      include: [{ model: Question, attributes: ['id', 'course_id'], where: { course_id: courseIds } }],
      attributes: ['id', 'createdAt']
    });

    const studentCourses = await Course.findAll({
      where: { id: courseIds },
      include: [{ model: Student, attributes: ['id'] }],
      attributes: ['id']
    });

    const submissionsByCourse = {};
    const timeseriesMap = {};

    submissions.forEach((submission) => {
      const courseId = submission.Question?.course_id;
      if (courseId) {
        submissionsByCourse[courseId] = (submissionsByCourse[courseId] || 0) + 1;
      }
      const createdAt = submission.createdAt ? new Date(submission.createdAt).toISOString().slice(0, 10) : null;
      if (createdAt) {
        timeseriesMap[createdAt] = (timeseriesMap[createdAt] || 0) + 1;
      }
    });

    const studentCounts = {};
    studentCourses.forEach((course) => {
      const uniqueStudents = new Set((course.Students || []).map(s => s.id).filter(Boolean));
      studentCounts[course.id] = uniqueStudents.size;
    });

    const summaryCourses = courses.map((course) => ({
      id: course.id,
      name: course.name,
      course_name: course.name,
      submissionsCount: submissionsByCourse[course.id] || 0,
      studentCount: studentCounts[course.id] || 0,
      course_status: course.is_active ? 'Active' : 'Inactive',
      status: course.is_active ? 'Active' : 'Inactive'
    }));

    const courseStatus = summaryCourses.reduce((acc, current) => {
      const key = current.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const now = new Date();
    const timeseries = [];
    for (let i = 8; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);
      timeseries.push({ date: dateKey, total_submissions: timeseriesMap[dateKey] || 0 });
    }

    return res.status(200).json({ success: true, courses: summaryCourses, courseStatus, timeseries });
  } catch (error) {
    console.error('getFacultySummary error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching faculty summary', error: error.message });
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
          attributes: ['id', 'title', 'course_id', 'score'],
          include: [{ model: Course, attributes: ['id', 'name', 'course_code'] }]
        },
        {
          model: Student,
          attributes: ['id', 'name', 'email'],
          include: [{ model: Batch, attributes: ['id', 'name', 'code'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 200
    });

    const submissionIds = subs.map((s) => s.id).filter(Boolean);
    const feedbackRows = submissionIds.length
      ? await db.SubmissionFeedback.findAll({
          where: { submission_id: submissionIds },
          order: [['submission_id', 'ASC'], ['createdAt', 'DESC'], ['id', 'DESC']]
        })
      : [];

    const latestFeedbackBySubmission = new Map();
    feedbackRows.forEach((feedback) => {
      if (!latestFeedbackBySubmission.has(feedback.submission_id)) {
        latestFeedbackBySubmission.set(feedback.submission_id, feedback);
      }
    });

    const data = subs.map(s => {
      const feedback = latestFeedbackBySubmission.get(s.id);
      return {
      id: s.id,
      question_id: s.question_id,
      question_title: s.Question?.title || null,
      maxScore: s.Question?.score ?? null,
      course: s.Question?.Course ? { id: s.Question.Course.id, name: s.Question.Course.name, code: s.Question.Course.course_code || s.Question.Course.code } : null,
      status: s.status,
      score: s.score,
      similarity_score: feedback?.similarity_percentage ?? null,
      similarity_feedback: feedback?.similarity_feedback ?? null,
      feedback_status: feedback?.status ?? null,
      createdAt: s.createdAt,
      student_batches: (s.Student?.Batches || []).map(b => ({ id: b.id, name: b.name, code: b.code }))
    };
    });

    return res.status(200).json({ success: true, submissions: data });
  } catch (err) {
    console.error('getMySubmissions error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: err.message });
  }
};
exports.overrideScore = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    if (!facultyId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { score, note } = req.body;

    if (score === undefined || score === null || isNaN(Number(score))) {
      return res.status(400).json({ message: 'score (number) is required' });
    }

    const submission = await Submission.findByPk(id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    submission.score = Number(score);
    submission.manually_overridden = true;
    submission.override_note = note || null;
    await submission.save();

    return res.json({ success: true, submission });
  } catch (err) {
    console.error('overrideScore error:', err);
    return res.status(500).json({ message: err.message });
  }
};
exports.approveSubmission = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    if (!facultyId) return res.status(401).json({ message: 'Unauthorized' });

    const submission = await Submission.findByPk(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    submission.approved = !submission.approved;
    await submission.save();

    return res.json({
      success: true,
      approved: Boolean(submission.approved),
      message: submission.approved ? 'Submission approved' : 'Submission approval removed',
      submission
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getStudentViolationsForFaculty = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    if (!facultyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Get courses assigned to this faculty
    const facultyCourses = await Course.findAll({
      include: [{
        model: User,
        as: 'Faculties',
        where: { id: facultyId },
        attributes: []
      }],
      attributes: ['id', 'name', 'course_code', 'allowed_violations']
    });

    const courseIds = facultyCourses.map(c => c.id);
    if (!courseIds.length) {
      return res.status(200).json({ success: true, violations: [] });
    }

    // Get all students in these courses
    const studentsInCourses = await Student.findAll({
      include: [{
        model: Course,
        where: { id: courseIds },
        attributes: ['id', 'name', 'course_code', 'allowed_violations'],
        through: { attributes: [] }
      }],
      attributes: ['id', 'name', 'email']
    });

    const violations = [];
    for (const student of studentsInCourses) {
      for (const course of student.Courses) {
        const logs = await getExamViolationLogs(student.id, course.id);
        const violationLimit = Math.max(1, Number(course.allowed_violations) || 1);
        const count = logs.length;
        const examState = await getStudentCourseExamState(student.id, course.id);
        const alreadySubmitted = examState.alreadySubmitted;
        const blockedByViolation = count >= violationLimit;

        if (count > 0) {
          violations.push({
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            courseId: course.id,
            courseName: course.name,
            courseCode: course.course_code,
            violationLimit,
            violationCount: count,
            remainingViolations: Math.max(0, violationLimit - count),
            blocked: blockedByViolation,
            alreadySubmitted,
            violations: normalizeViolationLogs(logs)
          });
        }
      }
    }

    return res.status(200).json({ success: true, violations });
  } catch (err) {
    console.error('getStudentViolationsForFaculty error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch violations', error: err.message });
  }
};

exports.resetStudentViolations = async (req, res) => {
  try {
    const facultyId = req.user && req.user.id;
    const { studentId, courseId } = req.params;

    if (!facultyId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!studentId || !courseId) return res.status(400).json({ success: false, message: 'studentId and courseId are required' });

    // Verify faculty is assigned to the course
    const course = await Course.findByPk(courseId, {
      include: [{
        model: User,
        as: 'Faculties',
        where: { id: facultyId },
        attributes: ['id']
      }]
    });

    if (!course || !course.Faculties || course.Faculties.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this course' });
    }

    // Delete all violation logs for this student and course
    if (AuditLog) {
      await AuditLog.destroy({
        where: {
          user_id: studentId,
          action: EXAM_VIOLATION_ACTION,
          resource_type: 'COURSE_EXAM',
          resource_id: Number(courseId)
        }
      });
    }

    return res.status(200).json({ success: true, message: 'Violations reset successfully' });
  } catch (err) {
    console.error('resetStudentViolations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset violations', error: err.message });
  }
};
