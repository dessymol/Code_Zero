// backend/services/llmService.js
// Central LLM service. All callers use this file only.
// Primary provider is controlled by LLM_PROVIDER in .env.
// If the primary provider fails, we fall back to the secondary adapter.

const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase().trim();

const adapters = {
    gemini: require('./adapters/geminiAdapters'),
    local: require('./adapters/ollamaAdapter'),
};

function getAdapterOrder() {
    if (provider === 'local') return ['local', 'gemini'];
    return ['gemini', 'local'];
}

async function callWithFallback(prompt) {
    const order = getAdapterOrder();
    const errors = [];

    for (const name of order) {
        const adapter = adapters[name];
        if (!adapter?.call) continue;

        try {
            return await adapter.call(prompt);
        } catch (err) {
            const message = err?.message || String(err);
            errors.push(`${name}: ${message}`);
            console.warn(`[llmService] ${name} failed, trying next adapter: ${message}`);
        }
    }

    throw new Error(`All LLM providers failed. ${errors.join(' | ')}`);
}

/**
 * Generate test cases for a question.
 * @param {object} question - { title, description, sample_input, sample_output, language_id }
 * @param {number} count - Number of test cases to generate
 * @returns {Promise<Array<{input: string, output: string}>>}
 */
async function generateTestCases(question, count = 5) {
    const prompt = buildTestCasePrompt(question, count);
    const raw = await callWithFallback(prompt);
    return parseJsonArray(raw, 'test cases');
}

/**
 * Generate feedback for a submission.
 * @param {object} params - { code, languageName, question, judgeResult, score, maxScore }
 * @returns {Promise<{summary, what_went_wrong, hint, positive}>}
 */
async function generateFeedback(params) {
    const prompt = buildFeedbackPrompt(params);
    const raw = await callWithFallback(prompt);
    return parseJsonObject(raw, 'feedback');
}

// ── Prompt builders ──────────────────────────────────────────────

function buildTestCasePrompt(question, count) {
    return `You are a test case generator for a coding judge system.
 
Question title: ${question.title}
Description: ${question.description || 'No description provided.'}
Sample input: ${question.sample_input || 'None'}
Sample output: ${question.sample_output || 'None'}
 
Generate exactly ${count} test cases. Cover edge cases: empty input, large values, negative numbers, boundary conditions.
 
Rules:
- Output must be exact (no trailing spaces, no extra newlines beyond what is required)
- Each test case must be independently runnable
- Return ONLY a JSON array. No explanation, no markdown, no code fences.
 
Format:
[
  { "input": "...", "output": "..." },
  { "input": "...", "output": "..." }
]`;
}

function buildFeedbackPrompt({ code, languageName, question, judgeResult, score, maxScore }) {
    const status = judgeResult?.status?.description || 'Unknown';
    const stdout = judgeResult?.stdout || '';
    const stderr = judgeResult?.stderr || '';
    const compileErr = judgeResult?.compile_output || '';

    return `You are a coding tutor reviewing a student's submission. Be concise and constructive.
 
Question: ${question.title}
Language: ${languageName}
Score achieved: ${score}/${maxScore}
Judge status: ${status}
Expected output: ${question.sample_output || 'None'}
${compileErr ? `\nCompiler error:\n${compileErr}` : ''}
${stderr ? `\nRuntime error:\n${stderr}` : ''}
${stdout ? `\nOutput produced:\n${stdout}` : ''}
 
Student code:
${code}
 
Respond ONLY with this JSON object. No markdown, no explanation outside the JSON:
{
  "summary": "One sentence verdict on the submission",
  "what_went_wrong": "Specific explanation of the error (null if the code is correct)",
  "hint": "A nudge toward the fix without giving the full answer (null if correct)",
  "positive": "One thing the student did well in their code"
}`;
}

// ── JSON parsers ─────────────────────────────────────────────────

function parseJsonArray(raw, label) {
    const cleaned = stripCodeFences(raw);
    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array');
        return parsed;
    } catch (err) {
        console.error(`[llmService] Failed to parse ${label} JSON:`, err.message);
        console.error('[llmService] Raw response:', raw);
        throw new Error(`LLM returned invalid JSON for ${label}: ${err.message}`);
    }
}

function parseJsonObject(raw, label) {
    const cleaned = stripCodeFences(raw);
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Response is not a JSON object');
        return parsed;
    } catch (err) {
        console.error(`[llmService] Failed to parse ${label} JSON:`, err.message);
        console.error('[llmService] Raw response:', raw);
        throw new Error(`LLM returned invalid JSON for ${label}: ${err.message}`);
    }
}

function stripCodeFences(text) {
    // Remove ```json ... ``` or ``` ... ``` wrappers LLMs sometimes add despite instructions
    return text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
}

module.exports = { generateTestCases, generateFeedback };
