// backend/services/adapters/geminiAdapter.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!apiKey) {
    console.warn('[geminiAdapter] GEMINI_API_KEY is not set. Gemini calls will fail.');
}

const genAI = new GoogleGenerativeAI(apiKey || '');
const model = genAI.getGenerativeModel({ model: modelName });

/**
 * Send a prompt to Gemini and return the raw text response.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function call(prompt) {
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,       // Low temperature = more deterministic JSON
            maxOutputTokens: 4096,  // Increased from 2048 to handle longer test cases
        }
    });

    const text = result.response.text();
    if (!text) throw new Error('Gemini returned an empty response');
    return text;
}

module.exports = { call };
