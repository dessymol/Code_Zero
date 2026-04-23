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
        
        // Provide user-friendly error messages
        let userMessage = err.message;
        if (err.message.includes('All LLM providers failed')) {
            if (err.message.includes('503') || err.message.includes('Service Unavailable')) {
                userMessage = 'Gemini API is experiencing high demand. Please try again in a few moments.';
            } else if (err.message.includes('Ollama is not running')) {
                userMessage = 'Local LLM service (Ollama) is not available. Please start Ollama or use Gemini API.';
            } else {
                userMessage = 'All LLM services are currently unavailable. Please try again later.';
            }
        }
        
        return res.status(500).json({ success: false, message: userMessage });
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

        console.log(`[testcaseController] verify: Running ${testcases.length} testcases for question ${question.id}`);
        console.log(`[testcaseController] Language ID: ${question.language_id}`);
        console.log(`[testcaseController] Reference solution (first 200 chars): ${question.reference_solution?.substring(0, 200)}`);
        console.log(`[testcaseController] Reference solution length: ${question.reference_solution?.length}`);

        // Check for Python version issues
        if (question.language_id === 70 && question.reference_solution.includes('input()') && !question.reference_solution.includes('raw_input()')) {
            console.warn(`[testcaseController] ⚠️  WARNING: Code uses input() but language is Python 2.7 (ID 70). Python 2 uses raw_input() for string input. Consider changing to Python 3 (ID 71).`);
        }
        if (question.language_id === 71 && question.reference_solution.includes('raw_input()')) {
            console.warn(`[testcaseController] ⚠️  WARNING: Code uses raw_input() but language is Python 3 (ID 71). Python 3 uses input() for string input.`);
        }

        const results = await Promise.all(testcases.map(async (tc) => {
            let result;
            try {
                console.log(`[testcaseController] Running testcase ${tc.id}: input length=${tc.input?.length || 0}`);

                result = await judge0Service.submitCode(
                    question.reference_solution,
                    question.language_id,
                    tc.input || '',
                    tc.output || '',
                    true
                );

                console.log(`[testcaseController] Testcase ${tc.id} result: status=${result.status?.id}, stdout length=${result.stdout?.length || 0}`);

                if (result.status?.id === 11) {
                    // Runtime error - log stderr
                    console.error(`[testcaseController] Testcase ${tc.id} Runtime Error: ${result.stderr || 'No error message'}`);
                }
            } catch (e) {
                console.error(`[testcaseController] Testcase ${tc.id} error:`, e.message);
                return { testcase_id: tc.id, input: tc.input, passed: false, error: e.message };
            }
            const actual = normalizeOutput(result.stdout || '');
            const expected = normalizeOutput(tc.output || '');
            const statusId = result.status ? result.status.id : 0;
            const passed = statusId === 3 && actual === expected;

            console.log(`[testcaseController] Testcase ${tc.id}: ${passed ? 'PASS' : 'FAIL'} (status=${statusId})`);

            return {
                testcase_id: tc.id,
                input: tc.input,
                expected,
                actual,
                passed,
                status: result.status?.description || 'Unknown'
            };
        }));

        const allPassed = results.every(r => r.passed);
        console.log(`[testcaseController] Verification complete: ${results.filter(r => r.passed).length}/${results.length} passed`);

        return res.json({ success: true, allPassed, results });
    } catch (err) {
        console.error('[testcaseController] verify error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};
