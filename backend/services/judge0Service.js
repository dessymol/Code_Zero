const axios = require('axios');

class Judge0Service {
  constructor() {
    this.baseURL = process.env.JUDGE0_URL || 'http://localhost:2358';
    this.rapidApiKey = process.env.RAPIDAPI_KEY || null;
    this.rapidApiHost = process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
    
    // Configure headers based on whether we're using RapidAPI or self-hosted
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add RapidAPI headers if using RapidAPI
    if (this.rapidApiKey && this.baseURL.includes('rapidapi.com')) {
      headers['X-RapidAPI-Key'] = this.rapidApiKey;
      headers['X-RapidAPI-Host'] = this.rapidApiHost;
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000, // 60 seconds timeout for code execution
      headers: headers
    });
    
    // Map of common language names to Judge0 language IDs
    this.languageMap = {
      'python': 71,      // Python 3.8.1
      'python3': 71,     // Python 3.8.1
      'python2': 70,     // Python 2.7.17
      'javascript': 63,  // Node.js 12.14.0
      'js': 63,          // Node.js 12.14.0
      'node': 63,        // Node.js 12.14.0
      'java': 62,        // Java 13.0.1
      'c': 50,           // C (GCC 9.2.0)
      'cpp': 54,         // C++ (GCC 9.2.0)
      'c++': 54,         // C++ (GCC 9.2.0)
      'ruby': 72,        // Ruby 2.7.0
      'php': 68,         // PHP 7.4.1
      'go': 60,          // Go 1.13.5
      'rust': 73,        // Rust 1.40.0
      'swift': 83,       // Swift 5.2.3
      'typescript': 74,  // TypeScript 3.7.4
      'ts': 74,          // TypeScript 3.7.4
      'sql': 82,         // SQL (SQLite 3.27.2)
      'bash': 46,        // Bash 5.0.0
      'shell': 46,       // Bash 5.0.0
    };
  }

  /**
   * Get language ID from language name or ID
   * @param {string|number} language - Language name or ID
   * @returns {number} Judge0 language ID
   */
  getLanguageId(language) {
    if (typeof language === 'number') {
      return language;
    }
    
    const lang = String(language).toLowerCase().trim();
    return this.languageMap[lang] || 71; // Default to Python if not found
  }

  /**
   * Submit code to Judge0 for execution
   * @param {string} sourceCode - The source code to execute
   * @param {string|number} language - Language name or ID
   * @param {string} stdin - Input to the program
   * @param {string} expectedOutput - Expected output (optional)
   * @param {boolean} wait - Whether to wait for execution to complete
   * @returns {Promise<Object>} Judge0 response
   */
  async submitCode(sourceCode, language, stdin = '', expectedOutput = '', wait = true) {
    try {
      const languageId = this.getLanguageId(language);
      console.log('[Judge0Service] Submitting code:', {
        languageId,
        language,
        sourceCodeLength: sourceCode?.length || 0,
        stdinLength: stdin?.length || 0,
        wait
      });
      
      // Create submission without wait parameter to avoid timeout issues
      const createResponse = await this.client.post('/submissions', {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
        expected_output: expectedOutput || null,
        cpu_time_limit: 5,
        memory_limit: 128000,
        stack_limit: 64000
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout for submission creation
      });
      
      const token = createResponse.data.token;
      console.log('[Judge0Service] Submission created with token:', token);
      
      // If wait is false, return immediately with token
      if (!wait) {
        console.log('[Judge0Service] Returning immediately (wait=false)');
        return createResponse.data;
      }
      
      // Poll for result with exponential backoff
      let result = null;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max waiting
      
      console.log('[Judge0Service] Starting to poll for result...');
      while (attempts < maxAttempts) {
        // Wait before polling (exponential backoff)
        if (attempts > 0) {
          const delay = Math.min(1000 * (1 + attempts * 0.3), 2000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          const resultResponse = await this.client.get(`/submissions/${token}`, {
            timeout: 5000
          });
          
          result = resultResponse.data;
          const statusId = result.status?.id || result.status_id || 0;
          const statusDesc = result.status?.description || 'Unknown';
          
          console.log(`[Judge0Service] Poll attempt ${attempts + 1}: Status ID=${statusId}, Description=${statusDesc}`);
          
          // Check if processing is complete
          // Status IDs: 1 = In Queue, 2 = Processing, others = Complete/Error
          if (result.status && result.status.id !== 1 && result.status.id !== 2) {
            console.log('[Judge0Service] Processing complete:', {
              statusId,
              statusDesc,
              hasStdout: !!result.stdout,
              hasStderr: !!result.stderr,
              hasCompileOutput: !!result.compile_output
            });
            break; // Processing complete
          }
        } catch (pollError) {
          console.warn(`[Judge0Service] Error fetching result (attempt ${attempts + 1}):`, pollError.message);
        }
        
        attempts++;
      }
      
      if (!result) {
        console.error('[Judge0Service] Timeout waiting for result after', maxAttempts, 'attempts');
        throw new Error('Timeout waiting for Judge0 result');
      }
      
      // Log final result
      if (result.status?.id === 13) {
        console.error('[Judge0Service] Internal Error received:', {
          message: result.message,
          stderr: result.stderr,
          compile_output: result.compile_output
        });
      }
      
      return result;
    } catch (error) {
      console.error('[Judge0Service] Submission error:', {
        message: error.message,
        code: error.code,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        stack: error.stack
      });
      
      // Return a mock error response if Judge0 is down
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return {
          token: null,
          status: {
            id: 13, // Internal Error
            description: 'Judge0 service unavailable'
          },
          stdout: null,
          stderr: 'Judge0 service is not running or timed out. Please contact administrator.',
          compile_output: null,
          time: null,
          memory: null
        };
      }
      
      // If we got a response but it's an error, return it
      if (error.response && error.response.data) {
        return {
          token: null,
          status: {
            id: 13, // Internal Error
            description: error.response.data.error || 'Judge0 API error'
          },
          stdout: null,
          stderr: error.response.data.error || error.message,
          compile_output: null,
          time: null,
          memory: null
        };
      }
      
      throw error;
    }
  }

  /**
   * Get submission result by token
   * @param {string} token - Judge0 submission token
   * @returns {Promise<Object>} Submission result
   */
  async getSubmission(token) {
    try {
      const response = await this.client.get(`/submissions/${token}`);
      return response.data;
    } catch (error) {
      console.error('Judge0 get submission error:', error.message);
      throw error;
    }
  }

  /**
   * Get all supported languages
   * @returns {Promise<Array>} List of languages
   */
  async getLanguages() {
    try {
      const response = await this.client.get('/languages');
      return response.data;
    } catch (error) {
      console.error('Judge0 get languages error:', error.message);
      
      // Return a default list if Judge0 is down
      return [
        { id: 71, name: 'Python 3.8.1' },
        { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
        { id: 62, name: 'Java (OpenJDK 13.0.1)' },
        { id: 50, name: 'C (GCC 9.2.0)' },
        { id: 54, name: 'C++ (GCC 9.2.0)' }
      ];
    }
  }

  /**
   * Get system information and statistics
   * @returns {Promise<Object>} System info
   */
  async getSystemInfo() {
    try {
      const response = await this.client.get('/about');
      return response.data;
    } catch (error) {
      console.error('Judge0 get system info error:', error.message);
      return { message: 'Judge0 service unavailable' };
    }
  }
}

module.exports = new Judge0Service();