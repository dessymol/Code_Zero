// backend/services/adapters/ollamaAdapter.js
const axios = require('axios');

const BASE_URL = process.env.LOCAL_LLM_URL || 'http://localhost:11434';
const MODEL = process.env.LOCAL_LLM_MODEL || 'qwen2.5-coder:3b';
const TIMEOUT = parseInt(process.env.LOCAL_LLM_TIMEOUT_MS || '60000', 10);

/**
 * Send a prompt to Ollama and return the raw text response.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function call(prompt) {
    const response = await axios.post(
        `${BASE_URL}/api/generate`,
        {
            model: MODEL,
            prompt,
            stream: false,      // Wait for the full response
            options: {
                temperature: 0.2,
                num_predict: 2048,
            }
        },
        { timeout: TIMEOUT }
    );

    const text = response.data?.response;
    if (!text) throw new Error('Ollama returned an empty response');
    return text;
}

module.exports = { call };
