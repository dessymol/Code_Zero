exports.getSubmissionFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await db.SubmissionFeedback.findOne({
      where: { submission_id: id }
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

// destructure models + sequelize instance from db
const {
  Submission,
  ExamAttempt,
  Question,
  QuestionBatch,
  Student,
  Course,
  User,
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

async function getVisibleQuestionsForStudentCourse(studentId, courseId) {
  const student = await Student.findByPk(studentId, {
    include: [{ model: Batch, attributes: ['id', 'course_id'] }]
  });
  if (!student) return [];

  const batchIdsForCourse = (student.Batches || [])
    .filter((batch) => Number(batch.course_id) === Number(courseId))
    .map((batch) => batch.id);

  const questions = await Question.findAll({
    where: { course_id: courseId },
    include: [{
      model: QuestionBatch,
      as: 'QuestionBatches',
      required: false,
      attributes: ['id', 'batch_id', 'enabled']
    }],
    order: [['id', 'ASC']]
  });

  return (questions || []).filter((question) => {
    const batchRows = question.QuestionBatches || [];
    if (batchRows.length === 0) return true;
    return batchRows.some((row) => row.enabled === true && batchIdsForCourse.includes(row.batch_id));
  });
}

async function buildFeedbackForSubmission({ submission, question, judgeResult, score }) {
  if (!(process.env.GEMINI_API_KEY || process.env.LLM_PROVIDER === 'local')) return;

  const languageName = LANGUAGE_ID_MAP[Number(submission.language_id)] || `Language ${submission.language_id}`;
  const feedbackPayload = {
    code: submission.code,
    input: question.sample_input || '',
    languageName,
    question: {
      title: question.title,
      description: question.description,
      sample_output: question.sample_output
    },
    judgeResult,
    score,
    maxScore: question.score
  };

  setImmediate(async () => {
    try {
      const feedback = await generateFeedback(feedbackPayload);
      await db.SubmissionFeedback.upsert({
        submission_id: submission.id,
        summary: feedback.summary || null,
        what_went_wrong: feedback.what_went_wrong || null,
        hint: feedback.hint || null,
        positive: feedback.positive || null,
        status: 'done'
      });
    } catch (err) {
      console.error(`[Feedback] Failed for submission ${submission.id}:`, err.message);
      try {
        await db.SubmissionFeedback.upsert({
          submission_id: submission.id,
          status: 'failed'
        });
      } catch (createErr) {
        console.error(`[Feedback] Failed to create failed record for submission ${submission.id}:`, createErr.message);
      }
    }
  });
}

async function evaluateSubmissionAgainstFacultyTestcases(submission, question, transaction) {
  const testcases = await Testcase.findAll({
    where: { question_id: question.id },
    order: [['createdAt', 'ASC']],
    transaction
  });

  const maxScore = Number(question.score) || 0;
  const results = [];
  let passedCount = 0;
  let lastJudgeResult = null;

  if (testcases.length === 0) {
    return {
      status: 'No Testcases',
      score: 0,
      passedCount: 0,
      totalTestcases: 0,
      testResults: [],
      lastJudgeResult: null
    };
  }

  for (const testcase of testcases) {
    let judgeResult;
    try {
      judgeResult = await judge0Service.submitCode(
        submission.code,
        Number(submission.language_id),
        testcase.input || '',
        testcase.output || '',
        true
      );
    } catch (err) {
      judgeResult = {
        status: { id: 13, description: 'Judge0 error' },
        stdout: '',
        stderr: err.message,
        time: null,
        memory: null
      };
    }

    lastJudgeResult = judgeResult;
    const actualOutput = normalizeOutput((judgeResult.stdout || '').toString());
    const expectedOutput = normalizeOutput((testcase.output || '').toString());
    const statusId = judgeResult.status ? judgeResult.status.id : (judgeResult.status_id || 0);
    const passed = statusId === 3 && actualOutput === expectedOutput;

    if (passed) passedCount += 1;

    results.push({
      submission_id: submission.id,
      testcase_id: testcase.id,
      status: passed ? 'passed' : (statusId === 3 ? 'failed' : 'error'),
      status_id: statusId,
      execution_time: judgeResult.time ? Number(judgeResult.time) : null,
      memory_usage: judgeResult.memory ? Number(judgeResult.memory) : null,
      output: actualOutput,
      expected_output: expectedOutput,
      error_message: judgeResult.stderr || judgeResult.compile_output || judgeResult.message || null
    });
  }

  await TestResult.destroy({
    where: { submission_id: submission.id },
    transaction
  });
  await TestResult.bulkCreate(results, { transaction });

  const score = Math.floor((passedCount / testcases.length) * maxScore);
  const status = passedCount === testcases.length
    ? 'Accepted'
    : passedCount > 0
      ? 'Partial'
      : (results.some((row) => row.status === 'error') ? 'Error' : 'Wrong Answer');

  return {
    status,
    score,
    passedCount,
    totalTestcases: testcases.length,
    testResults: results,
    lastJudgeResult
  };
}

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
    const expectedOutputToUse = expectedOutput || sampleOutput;

    // Submit to Judge0
    const judgeResult = await judge0Service.submitCode(
      code,
      normalizedLanguageId,
      inputToUse,
      expectedOutputToUse,
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
    const inputToUse = stdin || question.sample_input || '';
    const expectedOutputToUse = expected_output || question.sample_output || '';

    // If judge_result is not provided, submit to Judge0 ourselves
    if (!judgeResult && code && language_id) {
      try {
        judgeResult = await judge0Service.submitCode(
          code,
          language_id,
          inputToUse,
          expectedOutputToUse,
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
    let testResultRows = []; // Declare here so it's in scope later

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
        const tcStatusId = tcResult.status ? tcResult.status.id : 0;
        const passed = tcStatusId === 3 && tcStdout === tcExpected;
        if (passed) passedCount++;

        testResultRows.push({
          submission_id: null, // filled in after submission is created
          testcase_id: tc.id,
          passed,
          actual_output: tcStdout,
          execution_time: tcResult.time ? String(tcResult.time) : null
        });
      }

      awarded_score = Math.round((passedCount / testcases.length) * qScore);

      // Store per-testcase results (after submission row is created — see Step C)
      // We carry testResultRows forward via a closure variable.
      // (See Step C below for the insert.)

    } else {
      // ── Fallback: single sample_output comparison ─────────────────
      const rawStdout = (judgeResult.stdout || '').toString();
      const stdout = normalizeOutput(rawStdout);
      const expectedRaw = (question.sample_output || '').toString();
      const expected = normalizeOutput(expectedRaw);
      const statusId = judgeResult.status ? judgeResult.status.id : (judgeResult.status_id || 0);

      if (statusId === 3 && expected !== '') {
        awarded_score = (stdout === expected) ? qScore : 0;
      } else if (statusId === 3 && expected === '') {
        awarded_score = qScore;
      }
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
    if (testcases.length > 0 && testResultRows.length > 0) {
      const submissionId = submission.id;
      setImmediate(async () => {
        try {
          const rows = testResultRows.map(r => ({ ...r, submission_id: submissionId }));
          await db.TestResult.bulkCreate(rows);
        } catch (err) {
          console.warn('[TestResults] Failed to save test results:', err.message);
        }
      });
    }
    // ── Async AI Feedback (fire-and-forget) ──────────────────────
    // This runs AFTER the response is sent. Student never waits for this.
    if (process.env.GEMINI_API_KEY || process.env.LLM_PROVIDER === 'local') {
      const submissionId = submission.id;
      const languageName = LANGUAGE_ID_MAP[Number(language_id)] || `Language ${language_id}`;
      const feedbackPayload = {
        code,
        input: inputToUse,
        languageName,
        question: {
          title: question.title,
          description: question.description,
          sample_output: question.sample_output
        },
        judgeResult,
        score: awarded_score,
        maxScore: question.score
      };

      console.log(`[Feedback] Starting generation for submission ${submissionId}`);

      setImmediate(async () => {
        try {
          console.log(`[Feedback] Calling generateFeedback for submission ${submissionId}`);
          const feedback = await generateFeedback(feedbackPayload);
          console.log(`[Feedback] Generated feedback for submission ${submissionId}:`, feedback);

          await db.SubmissionFeedback.create({
            submission_id: submissionId,
            summary: feedback.summary || null,
            what_went_wrong: feedback.what_went_wrong || null,
            hint: feedback.hint || null,
            positive: feedback.positive || null,
            status: 'done'
          });
          console.log(`[Feedback] Successfully saved feedback for submission ${submissionId}`);
        } catch (err) {
          console.error(`[Feedback] Failed for submission ${submissionId}:`, err.message);
          console.error(`[Feedback] Error details:`, err);
          // Silently create a failed record so the frontend knows to stop polling
          try {
            await db.SubmissionFeedback.create({
              submission_id: submissionId,
              status: 'failed'
            });
            console.log(`[Feedback] Created failed record for submission ${submissionId}`);
          } catch (createErr) {
            console.error(`[Feedback] Failed to create failed record:`, createErr.message);
          }
        }
      });
    } else {
      console.log(`[Feedback] Skipping feedback generation - no API key or local provider configured`);
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

exports.startExamAttempt = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const studentId = req.user?.id;
    const courseId = Number(req.body.course_id);
    if (!studentId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!courseId) {
      await t.rollback();
      return res.status(400).json({ message: 'course_id is required' });
    }

    let attempt = await ExamAttempt.findOne({
      where: {
        student_id: studentId,
        course_id: courseId,
        status: 'active'
      },
      order: [['createdAt', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!attempt) {
      attempt = await ExamAttempt.create({
        student_id: studentId,
        course_id: courseId,
        status: 'active',
        started_at: new Date()
      }, { transaction: t });
    }

    const savedSubmissions = await Submission.findAll({
      where: {
        attempt_id: attempt.id,
        student_id: studentId,
        is_final: false
      },
      attributes: ['id', 'question_id', 'code', 'language_id', 'updatedAt'],
      transaction: t
    });

    await t.commit();
    return res.status(200).json({
      success: true,
      attempt,
      savedAnswers: savedSubmissions
    });
  } catch (err) {
    try { await t.rollback(); } catch (e) { console.warn('rollback failed', e); }
    console.error('startExamAttempt error', err);
    return res.status(500).json({ message: 'Could not start exam attempt', error: err.message || String(err) });
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
      attempt_id
    } = req.body;

    const authStudentId = req.user?.id;
    if (!authStudentId || Number(student_id) !== Number(authStudentId)) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized student' });
    }
    if (!question_id || !course_id || !attempt_id) {
      await t.rollback();
      return res.status(400).json({ message: 'question_id, course_id and attempt_id are required' });
    }
    if (!code || !String(code).trim()) {
      await t.rollback();
      return res.status(400).json({ message: 'Code is required' });
    }

    const attempt = await ExamAttempt.findOne({
      where: {
        id: attempt_id,
        student_id: authStudentId,
        course_id,
        status: 'active'
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ message: 'Active exam attempt not found' });
    }

    const question = await Question.findOne({
      where: {
        id: question_id,
        course_id
      },
      transaction: t
    });
    if (!question) {
      await t.rollback();
      return res.status(404).json({ message: 'Question not found' });
    }

    const permittedLang = question.language_id !== undefined && question.language_id !== null
      ? Number(question.language_id)
      : null;
    if (permittedLang !== null && Number(language_id) !== permittedLang) {
      await t.rollback();
      return res.status(400).json({ message: 'Submitted language does not match permitted language for this question' });
    }

    let submission = await Submission.findOne({
      where: {
        attempt_id: attempt.id,
        question_id,
        student_id: authStudentId,
        is_final: false
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    const payload = {
      code,
      language_id: Number(language_id),
      question_id,
      student_id: authStudentId,
      attempt_id: attempt.id,
      output: null,
      status: 'Saved',
      execution_time: null,
      score: null,
      token: submission?.token || uuidv4(),
      is_final: false,
      finalized_at: null
    };

    let action = 'created';
    if (submission) {
      await submission.update(payload, { transaction: t });
      action = 'updated';
    } else {
      submission = await Submission.create(payload, { transaction: t });
    }

    await t.commit();
    return res.status(action === 'created' ? 201 : 200).json({
      success: true,
      action,
      message: 'Answer saved. Final scoring happens when the exam is finished.',
      submission
    });
  } catch (err) {
    try { await t.rollback(); } catch (e) { console.warn('rollback failed', e); }
    console.error('save answer error', err);
    return res.status(500).json({ message: 'Could not save answer', error: err.message || String(err) });
  }
};

exports.finalizeExamAttempt = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const studentId = req.user?.id;
    const attemptId = Number(req.params.attemptId);
    const violationCount = Number(req.body?.violation_count || 0);

    if (!studentId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!attemptId) {
      await t.rollback();
      return res.status(400).json({ message: 'attemptId is required' });
    }

    const attempt = await ExamAttempt.findOne({
      where: {
        id: attemptId,
        student_id: studentId
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ message: 'Exam attempt not found' });
    }
    if (attempt.status === 'finalized') {
      await t.rollback();
      return res.status(200).json({
        success: true,
        attempt,
        results: [],
        summary: {
          totalScore: attempt.total_score,
          questionCount: 0,
          finalizedAt: attempt.finalized_at
        }
      });
    }

    const visibleQuestions = await getVisibleQuestionsForStudentCourse(studentId, attempt.course_id);
    const visibleQuestionIds = visibleQuestions.map((question) => question.id);

    const submissions = await Submission.findAll({
      where: {
        attempt_id: attempt.id,
        student_id: studentId,
        question_id: { [Op.in]: visibleQuestionIds }
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    const submissionByQuestionId = new Map(submissions.map((submission) => [Number(submission.question_id), submission]));

    const results = [];
    let totalScore = 0;

    for (const question of visibleQuestions) {
      const submission = submissionByQuestionId.get(Number(question.id));
      if (!submission || !submission.code) {
        results.push({
          question_id: question.id,
          title: question.title,
          score: 0,
          maxScore: Number(question.score) || 0,
          status: 'Not Answered',
          passedCount: 0,
          totalTestcases: 0
        });
        continue;
      }

      const evaluation = await evaluateSubmissionAgainstFacultyTestcases(submission, question, t);
      totalScore += evaluation.score;

      await submission.update({
        status: evaluation.status,
        score: evaluation.score,
        output: evaluation.lastJudgeResult ? JSON.stringify(evaluation.lastJudgeResult) : null,
        execution_time: evaluation.lastJudgeResult?.time ? String(evaluation.lastJudgeResult.time) : null,
        is_final: true,
        finalized_at: new Date()
      }, { transaction: t });

      results.push({
        question_id: question.id,
        title: question.title,
        submission_id: submission.id,
        score: evaluation.score,
        maxScore: Number(question.score) || 0,
        status: evaluation.status,
        passedCount: evaluation.passedCount,
        totalTestcases: evaluation.totalTestcases
      });

      await buildFeedbackForSubmission({
        submission,
        question,
        judgeResult: evaluation.lastJudgeResult,
        score: evaluation.score
      });
    }

    attempt.status = 'finalized';
    attempt.finalized_at = new Date();
    attempt.total_score = totalScore;
    attempt.violation_count = Number.isFinite(violationCount) ? violationCount : 0;
    await attempt.save({ transaction: t });

    await t.commit();
    return res.status(200).json({
      success: true,
      attempt,
      results,
      summary: {
        totalScore,
        questionCount: visibleQuestions.length,
        finalizedAt: attempt.finalized_at
      }
    });
  } catch (err) {
    try { await t.rollback(); } catch (e) { console.warn('rollback failed', e); }
    console.error('finalizeExamAttempt error', err);
    return res.status(500).json({ message: 'Could not finalize exam attempt', error: err.message || String(err) });
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
      where: { student_id: studentId, is_final: true },
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
      where: { is_final: true },
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
      where: { is_final: true },
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
      where: { is_final: true },
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
      where: { is_final: true },
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


exports.getMySubmissions = async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const subs = await Submission.findAll({
      where: { student_id: studentId, is_final: true },
      include: [
        {
          model: Question,
          attributes: ['id', 'title', 'course_id'],
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
