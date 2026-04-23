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
    try {
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
    } catch (err) {
        // Provide better error messages for common issues
        if (err.code === 'ECONNREFUSED') {
            throw new Error(`Ollama is not running or not accessible at ${BASE_URL}. Make sure Ollama is started.`);
        } else if (err.code === 'ENOTFOUND') {
            throw new Error(`Cannot reach Ollama server at ${BASE_URL}. Check the LOCAL_LLM_URL configuration.`);
        } else if (err.message === 'timeout of ' + TIMEOUT + 'ms exceeded') {
            throw new Error(`Ollama request timed out after ${TIMEOUT}ms. The server may be overloaded.`);
        } else if (err.response?.status) {
            throw new Error(`Ollama API error: ${err.response.status} ${err.response.statusText}`);
        }
        // Re-throw with original message if not a known error type
        throw err;
    }
}

module.exports = { call };
