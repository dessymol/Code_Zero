// import axios from 'axios';

// // Judge0 configuration
// const JUDGE0_CONFIG = {
//   rapidApi: {
//     url: 'https://judge0-ce.p.rapidapi.com',
//     key: 'your-rapidapi-key-here', // Get from RapidAPI
//     host: 'judge0-ce.p.rapidapi.com'
//   },
//   // Alternative: Self-hosted Judge0
//   selfHosted: {
//     url: 'http://localhost:3000', // Your Judge0 instance
//     key: null
//   }
// };

// class Judge0Service {
//   constructor(config = JUDGE0_CONFIG.rapidApi) {
//     this.config = config;
//     this.client = axios.create({
//       baseURL: config.url,
//       headers: {
//         'X-RapidAPI-Key': config.key,
//         'X-RapidAPI-Host': config.host,
//         'Content-Type': 'application/json'
//       }
//     });
//   }

//   // Get available languages
//   async getLanguages() {
//     try {
//       const response = await this.client.get('/languages');
//       return response.data;
//     } catch (error) {
//       console.error('Error fetching languages:', error);
//       throw error;
//     }
//   }

//   // Submit code for execution
//   async submitCode(sourceCode, languageId, stdin = '') {
//     try {
//       const submissionData = {
//         source_code: sourceCode,
//         language_id: languageId,
//         stdin: stdin,
//         redirect_stderr_to_stdout: true
//       };

//       const response = await this.client.post('/submissions', submissionData, {
//         params: {
//           base64_encoded: false,
//           wait: true // Wait for execution to complete
//         }
//       });

//       return response.data;
//     } catch (error) {
//       console.error('Error submitting code:', error);
//       throw error;
//     }
//   }

//   // Get submission result
//   async getSubmissionResult(token) {
//     try {
//       const response = await this.client.get(`/submissions/${token}`, {
//         params: {
//           base64_encoded: false
//         }
//       });
//       return response.data;
//     } catch (error) {
//       console.error('Error fetching submission result:', error);
//       throw error;
//     }
//   }
// }

// export default Judge0Service;