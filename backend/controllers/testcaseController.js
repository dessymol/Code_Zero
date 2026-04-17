// backend/controllers/testcaseController.js
const db = require('../models');
const { generateTestCases } = require('../services/llmServices');

const { Question, Testcase } = db;

/**
 * POST /api/questions/:id/testcases/generate
 * Calls LLM, returns draft test cases — does NOT save to DB.
 */
exports.generate = async (req, res) => {
    try {
        const question = await Question.findByPk(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const count = parseInt(process.env.TESTCASE_COUNT || '5', 10);
        const testcases = await generateTestCases(question, count);

        return res.json({ success: true, testcases });
    } catch (err) {
        console.error('[testcaseController] generate error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * POST /api/questions/:id/testcases/approve
 * Body: { testcases: [{input, output}, ...] }
 * Saves approved test cases to DB.
 */
exports.approve = async (req, res) => {
    try {
        const question = await Question.findByPk(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        const incoming = req.body.testcases;
        if (!Array.isArray(incoming) || incoming.length === 0) {
            return res.status(400).json({ message: 'testcases array is required and must not be empty' });
        }

        // Validate shape
        for (const tc of incoming) {
            if (tc.input === undefined || tc.output === undefined) {
                return res.status(400).json({ message: 'Each test case must have input and output fields' });
            }
        }

        const records = incoming.map(tc => ({
            question_id: question.id,
            input: String(tc.input),
            output: String(tc.output),
            is_public: tc.is_public === true
        }));

        const created = await Testcase.bulkCreate(records);
        return res.status(201).json({ success: true, saved: created.length });
    } catch (err) {
        console.error('[testcaseController] approve error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/questions/:id/testcases
 * Returns all saved test cases for a question.
 */
exports.list = async (req, res) => {
    try {
        const testcases = await Testcase.findAll({
            where: { question_id: req.params.id },
            order: [['createdAt', 'ASC']]
        });
        return res.json({ success: true, testcases });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * DELETE /api/questions/:id/testcases/:tcId
 * Removes a single test case.
 */
exports.remove = async (req, res) => {
    try {
        const tc = await Testcase.findOne({
            where: { id: req.params.tcId, question_id: req.params.id }
        });
        if (!tc) return res.status(404).json({ message: 'Test case not found' });
        await tc.destroy();
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
/**
 * POST /api/questions/:id/verify
 * Runs question.reference_solution against every saved test case.
 * Returns per-test-case pass/fail without saving anything.
 */
exports.verify = async (req, res) => {
    try {
        const question = await Question.findByPk(req.params.id);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        if (!question.reference_solution) {
            return res.status(400).json({ message: 'No reference solution saved for this question' });
        }

        const testcases = await db.Testcase.findAll({ where: { question_id: question.id } });
        if (testcases.length === 0) {
            return res.status(400).json({ message: 'No test cases found for this question' });
        }

        const judge0Service = require('../services/judge0Service');

        const normalizeOutput = (s = '') =>
            String(s || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).join('\n').trim();

        const results = await Promise.all(testcases.map(async (tc) => {
            let result;
            try {
                result = await judge0Service.submitCode(
                    question.reference_solution,
                    question.language_id,
                    tc.input || '',
                    tc.output || '',
                    true
                );
            } catch (e) {
                return { testcase_id: tc.id, input: tc.input, passed: false, error: e.message };
            }
            const actual = normalizeOutput(result.stdout || '');
            const expected = normalizeOutput(tc.output || '');
            const statusId = result.status ? result.status.id : 0;
            return {
                testcase_id: tc.id,
                input: tc.input,
                expected,
                actual,
                passed: statusId === 3 && actual === expected,
                status: result.status?.description || 'Unknown'
            };
        }));

        const allPassed = results.every(r => r.passed);
        return res.json({ success: true, allPassed, results });
    } catch (err) {
        console.error('[testcaseController] verify error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};