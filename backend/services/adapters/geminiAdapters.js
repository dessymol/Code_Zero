// backend/services/adapters/geminiAdapter.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Send a prompt to Gemini and return the raw text response.
 * @param {string} prompt
 * @param {{ api_key?: string }} config
 * @returns {Promise<string>}
 */
async function call(prompt, config = {}) {
  const apiKey = config?.api_key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,       // Low temperature = more deterministic JSON
            maxOutputTokens: 2048,
        }
    });

    const text = result.response.text();
    if (!text) throw new Error('Gemini returned an empty response');
    return text;
}

module.exports = { call };
