// backend/services/llmService.js
// Central LLM service. All callers use this file only.
// Primary provider can be passed per request, then falls back to LLM_PROVIDER.
// If the primary provider fails, we fall back through the remaining adapters.

const DEFAULT_PROVIDER = 'gemini';
const SUPPORTED_PROVIDERS = ['gemini', 'groq', 'local'];

const adapters = {
    gemini: require('./adapters/geminiAdapters'),
    groq: require('./adapters/groqAdapter'),
    local: require('./adapters/ollamaAdapter'),
};

function normalizeProvider(value) {
    const provider = String(value || process.env.LLM_PROVIDER || DEFAULT_PROVIDER).toLowerCase().trim();
    return SUPPORTED_PROVIDERS.includes(provider) ? provider : DEFAULT_PROVIDER;
}

function getAdapterOrder(preferredProvider) {
    const primary = normalizeProvider(preferredProvider);
    return [primary, ...SUPPORTED_PROVIDERS.filter((name) => name !== primary)];
}

function getProviderConfig() {
    return {
        selected: normalizeProvider(process.env.LLM_PROVIDER),
        providers: SUPPORTED_PROVIDERS.map((name) => ({
            name,
            configured:
                name === 'gemini' ? Boolean(process.env.GEMINI_API_KEY) :
                name === 'groq' ? Boolean(process.env.GROQ_API_KEY) :
                true
        }))
    };
}

async function callWithFallback(prompt, options = {}) {
    const order = getAdapterOrder(options.provider);
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
    const raw = await callWithFallback(prompt, { provider: question?.llmProvider || question?.llm_provider });
    return parseJsonArray(raw, 'test cases');
}

/**
 * Generate feedback for a submission.
 * @param {object} params - { code, input, languageName, question, judgeResult, score, maxScore, testCaseResults }
 * @returns {Promise<{summary, what_went_wrong, hint, positive, similarity_percentage, similarity_feedback, testcase_feedback}>}
 */
async function generateFeedback(params) {
    const prompt = buildFeedbackPrompt(params);
    const raw = await callWithFallback(prompt, { provider: params?.llmProvider || params?.llm_provider });
    const normalized = normalizeFeedbackResult(parseJsonObject(raw, 'feedback'));
    return applySimilarityFallback(normalized, params);
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

function buildFeedbackPrompt({ code, input, languageName, question, judgeResult, score, maxScore, testCaseResults = [] }) {
    const status = judgeResult?.status?.description || 'Unknown';
    const stdout = judgeResult?.stdout || '';
    const stderr = judgeResult?.stderr || '';
    const compileErr = judgeResult?.compile_output || '';
    const referenceSolution = question?.reference_solution || '';
    const testCaseBlock = Array.isArray(testCaseResults) && testCaseResults.length > 0
        ? JSON.stringify(testCaseResults, null, 2)
        : 'No saved testcase results were available; use the sample output context only.';

    return `You are a coding tutor reviewing a student's submission. Be concise, specific, and constructive.
 
Question: ${question.title}
Language: ${languageName}
Score achieved: ${score}/${maxScore}
Judge status: ${status}
Input provided: ${input || 'None'}
Expected output: ${question.sample_output || 'None'}
${compileErr ? `\nCompiler error:\n${compileErr}` : ''}
${stderr ? `\nRuntime error:\n${stderr}` : ''}
${stdout ? `\nOutput produced:\n${stdout}` : ''}

Saved testcase results:
${testCaseBlock}

Faculty model answer code:
${referenceSolution || 'No faculty model answer was provided.'}
 
Student code:
${code}

Evaluate two independent metrics:
1. Testcase correctness: mention the exact failing testcase numbers/ids, expected output, actual output, and likely reason when results are available.
2. Similarity Score: compare the student's algorithm, control flow, data structures, edge-case handling, and implementation style to the faculty model answer. This is NOT the correctness score. A code that passes all tests may still have a low Similarity Score if it uses a very different approach. If no faculty model answer exists, set similarity_percentage to null and explain that no comparison was possible.

Similarity Score rules:
- Return similarity_percentage as an integer from 0 to 100 when faculty model answer code exists.
- 90-100: nearly identical approach and structure.
- 70-89: same main algorithm with moderate implementation differences.
- 40-69: solves similarly at a high level but differs significantly.
- 1-39: mostly different approach.
- 0: unrelated, empty, or not a meaningful solution.
- Do not set similarity_percentage equal to the testcase score unless the code similarity truly supports it.
 
Respond ONLY with this JSON object. No markdown, no explanation outside the JSON:
{
  "summary": "One sentence verdict on the submission",
  "what_went_wrong": "Specific explanation of the error (null if the code is correct)",
  "hint": "A nudge toward the fix without giving the full answer (null if correct)",
  "positive": "One thing the student did well in their code",
  "similarity_percentage": null,
  "similarity_feedback": "How closely the student's approach matches the faculty model answer, or null if unavailable",
  "testcase_feedback": "Specific testcase-based feedback, naming failed cases and why, or null if all passed"
}`;
}

function normalizeFeedbackResult(result = {}) {
    const normalized = { ...result };
    const rawSimilarity = normalized.similarity_percentage ?? normalized.similarity_score ?? normalized.similarityScore;

    if (rawSimilarity === null || rawSimilarity === undefined || rawSimilarity === '') {
        normalized.similarity_percentage = null;
    } else {
        const parsed = Number(rawSimilarity);
        normalized.similarity_percentage = Number.isFinite(parsed)
            ? Math.max(0, Math.min(100, Math.round(parsed)))
            : null;
    }

    if (normalized.similarity_feedback === undefined) {
        normalized.similarity_feedback = null;
    }

    return normalized;
}

function applySimilarityFallback(result = {}, params = {}) {
    const normalized = { ...result };
    const referenceSolution = String(params?.question?.reference_solution || '').trim();
    const studentCode = String(params?.code || '').trim();

    if (!referenceSolution || normalized.similarity_percentage != null) {
        return normalized;
    }

    const similarity = computeCodeSimilarity(referenceSolution, studentCode);
    normalized.similarity_percentage = similarity;

    if (!normalized.similarity_feedback) {
        normalized.similarity_feedback =
            similarity >= 95
                ? 'The student submission is nearly identical to the faculty model answer.'
                : similarity >= 75
                    ? 'The student submission is very close to the faculty model answer with minor differences.'
                    : similarity >= 50
                        ? 'The student submission follows the faculty model answer in part, with noticeable differences.'
                        : 'The student submission differs significantly from the faculty model answer.';
    }

    return normalized;
}

function computeCodeSimilarity(referenceSolution, studentCode) {
    const left = normalizeCode(referenceSolution);
    const right = normalizeCode(studentCode);

    if (!left || !right) return 0;
    if (left === right) return 100;

    const leftLines = left.split('\n').filter(Boolean);
    const rightLines = right.split('\n').filter(Boolean);
    const leftSet = new Set(leftLines);
    const rightSet = new Set(rightLines);
    const intersection = [...leftSet].filter((line) => rightSet.has(line)).length;
    const union = new Set([...leftSet, ...rightSet]).size || 1;
    const lineSimilarity = intersection / union;

    const leftTokens = tokenizeCode(left);
    const rightTokens = tokenizeCode(right);
    const tokenSimilarity = jaccardSimilarity(leftTokens, rightTokens);

    return Math.max(0, Math.min(100, Math.round(((lineSimilarity * 0.45) + (tokenSimilarity * 0.55)) * 100)));
}

function normalizeCode(code) {
    return String(code || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim();
}

function tokenizeCode(code) {
    return new Set(
        String(code || '')
            .toLowerCase()
            .split(/[^a-z0-9_]+/i)
            .map((token) => token.trim())
            .filter(Boolean)
    );
}

function jaccardSimilarity(leftSet, rightSet) {
    const union = new Set([...leftSet, ...rightSet]);
    if (union.size === 0) return 0;
    const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
    return intersection / union.size;
}

// ── JSON parsers ─────────────────────────────────────────────────

function attemptJsonRepair(text) {
    // Try to repair truncated JSON by finding the last complete structure
    let openBraces = 0;
    let inString = false;
    let escaped = false;

    for (let i = text.length - 1; i >= 0; i--) {
        const char = text[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
        } else if (!inString) {
            if (char === '}') openBraces++;
            else if (char === '{') {
                openBraces--;
                if (openBraces === 0) {
                    // Found the last complete object
                    return text.substring(0, i + 1);
                }
            }
        }
    }

    return text;
}

function parseJsonArray(raw, label) {
    let cleaned = stripCodeFences(raw);

    try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array');
        return parsed;
    } catch (err) {
        // Try to repair truncated JSON
        console.warn(`[llmService] First parse attempt failed, attempting repair: ${err.message}`);

        try {
            // Find last complete array bracket
            const lastBracket = cleaned.lastIndexOf(']');
            if (lastBracket > 0) {
                const truncated = cleaned.substring(0, lastBracket + 1);
                const parsed = JSON.parse(truncated);
                if (Array.isArray(parsed)) {
                    console.warn(`[llmService] Successfully repaired truncated ${label} JSON`);
                    return parsed;
                }
            }
        } catch (repairErr) {
            console.warn(`[llmService] Repair attempt failed: ${repairErr.message}`);
        }

        console.error(`[llmService] Failed to parse ${label} JSON:`, err.message);
        console.error(`[llmService] Raw response (first 1000 chars):`, raw.substring(0, 1000));
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
        console.error('[llmService] Raw response:', raw.substring(0, 500));
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

module.exports = {
    generateTestCases,
    generateFeedback,
    getProviderConfig,
    normalizeProvider,
    SUPPORTED_PROVIDERS
};
