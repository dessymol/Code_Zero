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
    // Sanitize question input to prevent JSON injection
    const sanitize = (str) => String(str || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');

    return `You are a test case generator for a coding judge system.

Question title: ${sanitize(question.title).substring(0, 100)}
Description: ${sanitize(question.description || 'No description provided.').substring(0, 300)}
Sample input: ${sanitize(question.sample_input || 'None').substring(0, 200)}
Sample output: ${sanitize(question.sample_output || 'None').substring(0, 200)}

Generate exactly ${count} test cases. Cover edge cases: empty input, large values, negative numbers, boundary conditions.

CRITICAL REQUIREMENTS:
- Each input and output MUST be properly escaped JSON strings
- Do NOT include unescaped quotes or special characters inside strings
- Do NOT generate extremely long inputs (keep inputs under 500 characters each)
- Output must be exact with no trailing spaces or extra newlines unless required
- Each test case must be independently runnable

Return ONLY a valid JSON array. No explanation, no markdown, no code fences.

Valid format example:
[
  { "input": "", "output": "" },
  { "input": "test", "output": "result" }
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
        console.error('[llmService] Cleaned response:', cleaned.substring(0, 500) + (cleaned.length > 500 ? '...' : ''));
        console.error('[llmService] Raw response length:', raw.length);

        // Try to recover from truncated JSON
        try {
            const recovered = attemptRecoverTruncatedJson(cleaned);
            console.warn(`[llmService] Attempting recovery for ${label}...`);
            const parsed = JSON.parse(recovered);
            if (!Array.isArray(parsed)) throw new Error('Recovered response is not a JSON array');
            console.warn(`[llmService] Successfully recovered ${label} JSON`);
            return parsed;
        } catch (recoveryErr) {
            console.error('[llmService] Recovery failed:', recoveryErr.message);
            throw new Error(`LLM returned invalid JSON for ${label}: ${err.message}`);
        }
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
        console.error('[llmService] Cleaned response:', cleaned.substring(0, 500) + (cleaned.length > 500 ? '...' : ''));
        console.error('[llmService] Raw response length:', raw.length);
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

function attemptRecoverTruncatedJson(text) {
    // If the JSON appears to be truncated with an unterminated string,
    // try to close it gracefully
    let recovered = text;

    // Count unescaped quotes to detect unclosed string
    const quoteMatches = text.match(/(?<!\\)"/g) || [];

    // If odd number of quotes, we likely have an unterminated string
    if (quoteMatches.length % 2 === 1) {
        // Try to close the object/array properly
        recovered = text.replace(/,\s*$/, '') + '"}]'; // Close unterminated string and array
        try {
            JSON.parse(recovered);
            return recovered;
        } catch (e) {
            // Try alternative recovery
            recovered = text.replace(/,\s*$/, '') + '"}]';
            // If still fails, return original and let it throw
            return text;
        }
    }

    // Try closing unclosed braces/brackets
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;

    recovered = text;
    for (let i = openBraces - closeBraces; i > 0; i--) {
        recovered += '}';
    }
    for (let i = openBrackets - closeBrackets; i > 0; i--) {
        recovered += ']';
    }

    return recovered;
}

module.exports = { generateTestCases, generateFeedback };
