const axios = require('axios');

async function call(prompt, config = {}) {
    const API_KEY = config?.api_key || process.env.GROQ_API_KEY;
    const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const BASE_URL = config?.base_url || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    const TIMEOUT = parseInt(process.env.GROQ_TIMEOUT_MS || '60000', 10);
    const MAX_OUTPUT_TOKENS = parseInt(process.env.GROQ_MAX_OUTPUT_TOKENS || '4096', 10);

    if (!API_KEY) {
        throw new Error('GROQ_API_KEY is not configured');
    }

    const payload = {
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: 'Return only valid JSON. Do not include markdown, prose, or code fences.'
            },
            { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
    };

    if (MODEL.startsWith('openai/gpt-oss')) {
        payload.include_reasoning = false;
        payload.reasoning_effort = 'low';
    }

    const response = await axios.post(
        `${BASE_URL}/chat/completions`,
        payload,
        {
            timeout: TIMEOUT,
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const message = response.data?.choices?.[0]?.message || {};
    const text = extractText(message);
    if (!text) {
        const finishReason = response.data?.choices?.[0]?.finish_reason || 'unknown';
        throw new Error(`Groq returned an empty response (finish_reason: ${finishReason})`);
    }
    return text;
}

function extractText(message) {
    if (typeof message.content === 'string' && message.content.trim()) {
        return message.content.trim();
    }

    if (Array.isArray(message.content)) {
        const text = message.content
            .map((part) => {
                if (typeof part === 'string') return part;
                return part?.text || part?.content || '';
            })
            .join('')
            .trim();
        if (text) return text;
    }

    if (typeof message.refusal === 'string' && message.refusal.trim()) {
        throw new Error(`Groq refused the request: ${message.refusal}`);
    }

    return '';
}

module.exports = { call };
