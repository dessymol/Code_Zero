// src/pages/CodingPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

// Judge0 Configuration - FIXED
// Use environment variable with fallback
const JUDGE0_API_URL = import.meta.env.VITE_JUDGE0_URL || 'http://localhost:2358';
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || null;
const RAPIDAPI_HOST = import.meta.env.VITE_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';

// Use your backend URL for submissions (not used for routes here, we keep original hardcoded routes)
const BACKEND_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const JUDGE0_SUBMISSIONS_URL = `${JUDGE0_API_URL}/submissions`;
const JUDGE0_SUBMISSIONS_BATCH_URL = `${JUDGE0_API_URL}/submissions/batch`;

// Helper function to get Judge0 headers (supports both self-hosted and RapidAPI)
const getJudge0Headers = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Add RapidAPI headers if using RapidAPI
  if (RAPIDAPI_KEY && JUDGE0_API_URL.includes('rapidapi.com')) {
    headers['X-RapidAPI-Key'] = RAPIDAPI_KEY;
    headers['X-RapidAPI-Host'] = RAPIDAPI_HOST;
  }
  
  return headers;
};

const ACKS = [
  'I will not switch tabs or applications during the exam.',
  'I will not use copy/paste or external help.',
  'I understand the exam runs in fullscreen and exiting it will be treated as a violation.',
  'I will not use forbidden keys (Alt, Ctrl, Fn, Tab, Esc, F1–F12).',
  'I understand code may be auto-submitted when time for a question expires.',
];

// ✅ Single consistent mapping: DB language_id → Judge0 language_id + display name
const LANGUAGE_MAPPING = {
  62: { name: 'Java',       judge0Id: 62 },
  70: { name: 'Python 2',   judge0Id: 70 }, // Python 2.7
  71: { name: 'Python 3',   judge0Id: 71 }, // Python 3.8
  50: { name: 'C',          judge0Id: 50 },
  54: { name: 'C++',        judge0Id: 54 },
  63: { name: 'JavaScript', judge0Id: 63 },
  51: { name: 'C#',         judge0Id: 51 },
  60: { name: 'Go',         judge0Id: 60 },
  78: { name: 'Kotlin',     judge0Id: 78 },
  68: { name: 'PHP',        judge0Id: 68 },
};

const findLangName = (id) => {
  if (id === undefined || id === null) return 'Unknown';
  const mapping = LANGUAGE_MAPPING[id];
  if (mapping && mapping.name) return mapping.name;
  return `Language ID: ${id}`;
};

const formatJudgeResult = (res = {}, expected = '') => {
  const statusMessage = res.status?.description || 'Unknown Status';
  const statusId = res.status?.id || res.status_id || 0;
  const stdout = res.stdout ?? '';
  const compile_output = res.compile_output ?? '';
  const stderr = res.stderr ?? '';
  const time = res.time ?? '';
  const memory = res.memory ?? '';
  const message = res.message ?? '';

  let parts = [];

  console.log("🔍 Status ID check:", statusId);

  // Show status first
  parts.push(`Status: ${statusMessage}${statusId ? ` (ID: ${statusId})` : ''}`);

  if (compile_output) parts.push(`Compiler Output:\n${compile_output}`);
  if (stderr) parts.push(`Error Output:\n${stderr}`);

  parts.push(`Expected Output:\n${expected || '(no expected output)'}`);
  parts.push(`Actual Output:\n${stdout || '(no output)'}`);

  if (time) parts.push(`Time: ${time}s`);
  if (memory) parts.push(`Memory: ${memory}KB`);

  return {
    displayText: parts.join('\n\n'),
    stdout,
    compile_output,
    stderr,
    statusMessage,
    statusId,
    time,
    memory,
    raw: res
  };
};

const CodingPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const timerRef = useRef();

  const [questions, setQuestions] = useState([]);
  const [codes, setCodes] = useState({});
  const [results, setResults] = useState({});
  const [compiling, setCompiling] = useState({});
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [exitLoading, setExitLoading] = useState(false);

  // Exam security states
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState([]);
  const [escModal, setEscModal] = useState(false);
  const [locked, setLocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState([]);
  const [ackState, setAckState] = useState(() => ACKS.map(() => false));
  const [showWarning, setShowWarning] = useState(false);
  const [violationLimit, setViolationLimit] = useState(3);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Violation popup state
  const [showViolationPopup, setShowViolationPopup] = useState(false);
  const [remainingViolations, setRemainingViolations] = useState(null);
  const violationPopupTimeoutRef = useRef(null);

  // Judge0 custom input states
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customStdin, setCustomStdin] = useState('');

  // Student id extraction
  const studentId = (() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const [, payload] = token.split('.');
      const decoded = JSON.parse(window.atob(payload));
      return decoded.id || decoded.student_id;
    } catch {
      return null;
    }
  })();

  // Fullscreen helpers
  const goFullScreen = (elem) => {
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    setFullscreen(true);
  };

  const exitFullScreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
    setFullscreen(false);
  };

  // Violation logging
  const handleViolation = (reason) => {
    const timestamp = new Date().toLocaleTimeString();
    setViolations(prev => {
      const newV = [...prev, { reason, time: timestamp }];
      const limit = Math.max(0, Number(violationLimit || 3));
      const remaining = Math.max(0, limit - newV.length);
      setRemainingViolations(remaining);

      if (violationPopupTimeoutRef.current) {
        clearTimeout(violationPopupTimeoutRef.current);
        violationPopupTimeoutRef.current = null;
      }
      setShowViolationPopup(true);
      violationPopupTimeoutRef.current = setTimeout(() => {
        setShowViolationPopup(false);
        violationPopupTimeoutRef.current = null;
      }, 4000);

      if (newV.length === Math.max(0, limit - 1)) setShowWarning(true);
      if (newV.length >= Math.max(1, limit)) setShowFinalModal(true);
      return newV;
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (violationPopupTimeoutRef.current) {
        clearTimeout(violationPopupTimeoutRef.current);
        violationPopupTimeoutRef.current = null;
      }
    };
  }, []);

  // Log Judge0 configuration on component mount
  useEffect(() => {
    console.log('🔧 ========== Judge0 Configuration ==========');
    console.log('📍 Judge0 API URL:', JUDGE0_API_URL);
    console.log('🔗 Submissions URL:', JUDGE0_SUBMISSIONS_URL);
    console.log('🔑 RapidAPI Key:', RAPIDAPI_KEY ? `${RAPIDAPI_KEY.substring(0, 10)}...` : 'Not set');
    console.log('🌐 RapidAPI Host:', RAPIDAPI_HOST);
    console.log('✅ Using RapidAPI:', JUDGE0_API_URL.includes('rapidapi.com'));
    console.log('📋 Headers:', getJudge0Headers());
    console.log('===========================================');
  }, []);

  const forceExitExam = () => navigate('/student/dashboard');

  // Security handlers
  useEffect(() => {
    if (!started) return;

    const handleContextMenu = (e) => {
      e.preventDefault();
      handleViolation('Right click / context menu');
    };

    const handleBlur = () => {
      handleViolation('Window lost focus / minimized');
      forceExitExam();
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement && !escModal) {
        setLocked(true);
        setEscModal(true);
        handleViolation('Exited fullscreen');
      }
    };

    const forbiddenKeys = [
      'Alt', 'Control', 'Tab', 'Fn',
      ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1))
    ];

    const handleKeydown = (e) => {
      if (locked) {
        e.preventDefault();
        return false;
      }

      if (e.key === 'Escape' || e.key === 'Esc' || e.key === 'Meta') {
        e.preventDefault();
        setLocked(true);
        setEscModal(true);
        return false;
      }

      if ((e.ctrlKey || e.metaKey) && ['c','v','x'].includes(e.key.toLowerCase())) {
        handleViolation(`Copy/Paste/Cut detected: ${e.key}`);
        e.preventDefault();
        return false;
      }

      if (forbiddenKeys.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) {
        handleViolation(`Forbidden key: ${e.key}`);
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('keydown', handleKeydown, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('keydown', handleKeydown, true);
    };
  }, [started, escModal, locked, violationLimit]);

  useEffect(() => {
    document.body.style.pointerEvents = locked ? 'none' : '';
    document.body.style.userSelect = locked ? 'none' : '';
    return () => {
      document.body.style.pointerEvents = '';
      document.body.style.userSelect = '';
    };
  }, [locked]);

  // Timer
  useEffect(() => {
    if (!started || questions.length === 0 || currentIdx >= questions.length) return;
    clearInterval(timerRef.current);
    const q = questions[currentIdx];
    const seconds = (Number(q.duration) || 10) * 60;
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIdx, questions, started]);

  useEffect(() => {
    if (timeLeft <= 0 && started && questions.length > 0 && currentIdx < questions.length) {
      (async () => {
        await handleAutoSubmit();
      })();
    }
  }, [timeLeft]);

  // Map question object → Judge0 language_id
  const getQuestionLanguageId = (q) => {
    if (!q) return null;

    const src = q.question ?? q.raw ?? q;

    const candidates = [
      src.language_id,
      src.languageId,
      src.language,
      src.lang_id,
      q.language_id,
      q.languageId,
      q.language,
      (src.Question && src.Question.language_id),
      (src.question && src.question.language_id),
    ];

    for (const c of candidates) {
      if (c !== undefined && c !== null) {
        const rawId = Number(c);
        const mapping = LANGUAGE_MAPPING[rawId];
        // ⭐ Map DB ID → Judge0 ID if present
        return mapping?.judge0Id || rawId;
      }
    }

    return null;
  };

  // ----------------- Judge0 Integration -----------------
  const sendToJudge0 = async ({ source, stdin = '', language_id }) => {
    console.log('🚀 ========== Judge0 Execution Started ==========');
    console.log('📍 Judge0 API URL:', JUDGE0_API_URL);
    console.log('🔑 Using RapidAPI:', JUDGE0_API_URL.includes('rapidapi.com'));
    console.log('📋 Request Details:', { 
      language_id, 
      source_length: source.length, 
      stdin_length: stdin.length,
      headers: getJudge0Headers()
    });
    
    try {
      console.log('📤 Step 1: Submitting code to Judge0...');
      console.log('Submitting to Judge0:', { language_id, source_length: source.length, stdin_length: stdin.length });

      const submissionData = {
        source_code: source,
        language_id: language_id,
        stdin: stdin,
        expected_output: null,
        cpu_time_limit: 5,
        memory_limit: 128000,
        stack_limit: 64000,
      };

      // Create submission
      console.log('📡 Step 2: Sending POST request to:', JUDGE0_SUBMISSIONS_URL);
      console.log('📦 Submission payload:', {
        language_id: submissionData.language_id,
        source_code_length: submissionData.source_code.length,
        stdin: submissionData.stdin,
        cpu_time_limit: submissionData.cpu_time_limit,
        memory_limit: submissionData.memory_limit
      });
      
      const createResponse = await axios.post(JUDGE0_SUBMISSIONS_URL, submissionData, {
        headers: getJudge0Headers(),
        timeout: 10000,
      });

      const token = createResponse.data.token;
      console.log('✅ Step 3: Submission created successfully!');
      console.log('🎫 Token received:', token);
      console.log('📊 Full response:', createResponse.data);

      // Poll for result
      console.log('⏳ Step 4: Starting to poll for execution result...');
      let result = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        if (attempts > 0) {
          const delay = Math.min(1000 * (1 + attempts * 0.3), 2000);
          console.log(`⏸️  Waiting ${delay}ms before next poll attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
          const pollUrl = `${JUDGE0_SUBMISSIONS_URL}/${token}`;
          console.log(`🔍 Step 4.${attempts + 1}: Polling attempt ${attempts + 1}/${maxAttempts} - GET ${pollUrl}`);
          
          const resultResponse = await axios.get(pollUrl, {
            headers: getJudge0Headers(),
            timeout: 5000,
          });

          result = resultResponse.data;
          const statusId = result.status?.id || result.status_id;
          const statusDesc = result.status?.description || 'Unknown';
          
          console.log(`📊 Poll attempt ${attempts + 1} response:`, {
            statusId,
            statusDescription: statusDesc,
            hasStdout: !!result.stdout,
            hasStderr: !!result.stderr,
            hasCompileOutput: !!result.compile_output,
            time: result.time,
            memory: result.memory
          });
          console.log(`Poll attempt ${attempts + 1}: Status ID = ${statusId}, Description = ${statusDesc}`);

          // Status IDs: 1 = In Queue, 2 = Processing, others = Complete/Error
          if (result.status && result.status.id !== 1 && result.status.id !== 2) {
            console.log('✅ Step 5: Processing complete!');
            console.log('📋 Final result:', {
              status: result.status,
              stdout: result.stdout,
              stderr: result.stderr,
              compile_output: result.compile_output,
              time: result.time,
              memory: result.memory
            });
            console.log('Processing complete:', result);
            break;
          } else {
            console.log(`⏳ Still processing... (Status: ${statusDesc})`);
          }
        } catch (error) {
          console.warn(`⚠️  Error fetching result (attempt ${attempts + 1}), retrying...`, error.message);
          console.warn(`Error fetching result (attempt ${attempts + 1}), retrying...`, error.message);
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            console.log('🔄 Connection issue detected, will retry...');
            // retry
          } else {
            console.error('❌ Unexpected error during polling:', error);
          }
        }

        attempts++;
      }

      if (!result) {
        console.error('❌ Step 6: Timeout - No result received after', maxAttempts, 'attempts');
        throw new Error('Timeout waiting for Judge0 result after 30 seconds');
      }

      if (result.status && result.status.id === 13) {
        console.error('⚠️  Step 6: Judge0 returned Internal Error:', {
          status: result.status,
          stderr: result.stderr,
          compile_output: result.compile_output,
          message: result.message
        });
        console.error('Judge0 returned Internal Error:', {
          status: result.status,
          stderr: result.stderr,
          compile_output: result.compile_output,
          message: result.message
        });
      }

      console.log('✅ Step 6: Judge0 execution completed successfully');
      console.log('📊 Final Judge0 result:', result);
      console.log('🏁 ========== Judge0 Execution Ended ==========');
      return result;

    } catch (error) {
      console.error('❌ ========== Judge0 Execution Failed ==========');
      console.error('🚨 Judge0 submission error:', error);
      console.error('📋 Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Judge0 server is not running. Please ensure Docker is running and Judge0 containers are started.');
      } else if (error.response) {
        const errorData = error.response.data;
        const errorMsg = typeof errorData === 'string' ? errorData : (errorData?.error || JSON.stringify(errorData));
        throw new Error(`Judge0 API error (${error.response.status}): ${errorMsg}`);
      } else if (error.request) {
        throw new Error('Cannot connect to Judge0 server. Check if the service is running on port 2358.');
      } else {
        throw new Error(`Judge0 error: ${error.message}`);
      }
    }
  };

  // Test Judge0 connection
  const testJudge0Connection = async () => {
    console.log('🔌 Testing Judge0 connection...');
    console.log('📍 Testing URL:', `${JUDGE0_API_URL}/languages`);
    console.log('🔑 Headers:', getJudge0Headers());
    
    try {
      const response = await axios.get(`${JUDGE0_API_URL}/languages`, { 
        headers: getJudge0Headers(),
        timeout: 5000 
      });
      console.log('✅ Judge0 connection test: SUCCESS');
      console.log('📊 Languages available:', response.data?.length || 0);
      console.log('Judge connection test:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Judge0 connection test: FAILED');
      console.error('🚨 Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      console.error('Judge connection test failed:', error);
      return false;
    }
  };

  const handleCompile = async (qid) => {
    console.log('🔨 ========== Compile Request Started ==========');
    console.log('📝 Question ID:', qid);
    setCompiling(c => ({ ...c, [qid]: true }));
    setResults(r => ({ ...r, [qid]: 'Compiling...' }));

    try {
      console.log('🔌 Testing Judge0 connection before compile...');
      const isConnected = await testJudge0Connection();
      if (!isConnected) {
        setResults(prev => ({
          ...prev,
          [qid]: 'Error: Cannot connect to Judge0 server. Please ensure Docker is running and Judge0 is started on port 2358.'
        }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const code = codes[qid];
      if (!code || !code.trim()) {
        setResults(prev => ({ ...prev, [qid]: 'Error: Code is empty. Please write some code before running.' }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const currentQuestion = questions.find(q => q.id === qid);
      const langForQuestion = getQuestionLanguageId(currentQuestion);

      if (!langForQuestion) {
        setResults(prev => ({ ...prev, [qid]: `This question does not have an assigned language. Contact your instructor.` }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      console.log('📤 Sending code to Judge0 for compilation...');
      const res = await sendToJudge0({
        source: code,
        stdin: useCustomInput ? customStdin : (currentQuestion?.sample_input || ''),
        language_id: langForQuestion
      });

      console.log('✅ Compilation result received');
      const formatted = formatJudgeResult(res, currentQuestion.sample_output);
      console.log('📋 Formatted result:', formatted);
      setResults(prev => ({ ...prev, [qid]: formatted.displayText }));
      console.log('🏁 ========== Compile Request Completed ==========');
    } catch (err) {
      console.error('❌ ========== Compile Request Failed ==========');
      console.error('Compile error:', err);
      setResults(prev => ({
        ...prev,
        [qid]: `Compile/Run Error: ${err.message}\n\nPlease ensure:\n1. Docker is running\n2. Judge0 is started: docker run -d -p 2358:2358 judge0/judge0:1.13.0\n3. Port 2358 is available`
      }));
    }
    setCompiling(c => ({ ...c, [qid]: false }));
  };

  const handleRun = async (qid, sample_input) => {
    console.log('▶️  ========== Run Request Started ==========');
    console.log('📝 Question ID:', qid);
    console.log('📥 Sample input:', sample_input);
    setCompiling(c => ({ ...c, [qid]: true }));
    setResults(r => ({ ...r, [qid]: 'Running...' }));

    try {
      const code = codes[qid];
      if (!code || !code.trim()) {
        setResults(prev => ({ ...prev, [qid]: 'Error: Code is empty. Please write some code before running.' }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const currentQuestion = questions.find(q => q.id === qid);
      const langForQuestion = getQuestionLanguageId(currentQuestion);

      if (!langForQuestion) {
        setResults(prev => ({ ...prev, [qid]: `This question does not have an assigned language. Contact your instructor.` }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const stdin = useCustomInput ? customStdin : (sample_input || '');
      console.log('📤 Sending code to Judge0 for execution...');
      console.log('📥 Using input:', stdin);
      const res = await sendToJudge0({
        source: code,
        stdin,
        language_id: langForQuestion
      });

      console.log('✅ Execution result received');
      const formatted = formatJudgeResult(res, currentQuestion.sample_output);
      console.log('📋 Formatted result:', formatted);
      setResults(prev => ({ ...prev, [qid]: formatted.displayText }));
      console.log('🏁 ========== Run Request Completed ==========');
    } catch (err) {
      console.error('❌ ========== Run Request Failed ==========');
      console.error('Run error:', err);
      setResults(prev => ({
        ...prev,
        [qid]: `Run Error: ${err.message}\n\nPlease check if Judge0 is running properly.`
      }));
    }
    setCompiling(c => ({ ...c, [qid]: false }));
  };

  const handleSubmit = async (qid, sample_input, sample_output) => {
    setCompiling(c => ({ ...c, [qid]: true }));
    setResults(r => ({ ...r, [qid]: 'Submitting...' }));

    try {
      const code = codes[qid];
      if (!code || !code.trim()) {
        setResults(prev => ({ ...prev, [qid]: 'Error: Code is empty. Please write some code before submitting.' }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const currentQuestion = questions.find(q => q.id === qid);
      const langForQuestion = getQuestionLanguageId(currentQuestion);

      if (!langForQuestion) {
        setResults(prev => ({ ...prev, [qid]: `Cannot submit: no language assigned to this question.` }));
        setCompiling(c => ({ ...c, [qid]: false }));
        return;
      }

      const stdin = useCustomInput ? customStdin : (sample_input || '');
      console.log('📤 ========== Submit Request Started ==========');
      console.log('📝 Question ID:', qid);
      console.log('📥 Using input:', stdin);
      console.log('📤 Sending code to Judge0 for submission...');
      const judgeResp = await sendToJudge0({
        source: code,
        stdin,
        language_id: langForQuestion
      });
      console.log('✅ Submission result received from Judge0');

      const formatted = formatJudgeResult(judgeResp, currentQuestion.sample_output);
      const statusMessage = judgeResp.status ? judgeResp.status.description : 'Unknown Status';

      const token = localStorage.getItem('token');

      // ✅ Keep your original route exactly
      await axios.post(
        'http://localhost:3000/api/submissions/submit',
        {
          code,
          language_id: Number(langForQuestion),
          question_id: qid,
          course_id: courseId,
          student_id: studentId,
          jwt_token: token,
          sample_input: stdin,
          sample_output: currentQuestion.sample_output,
          judge_result: judgeResp
        },
        { headers: { Authorization: token ? `Bearer ${token}` : '' } }
      );

      // Mark as submitted
      setSubmittedQuestions(prev => [...new Set([...prev, qid])]);

      // Remove submitted question
      const newQuestions = questions.filter(q => q.id !== qid);
      setQuestions(newQuestions);

      setCodes(prev => {
        const next = { ...prev };
        delete next[qid];
        return next;
      });

      setCurrentIdx((prevIdx) => {
        if (newQuestions.length === 0) return 0;
        return prevIdx > newQuestions.length - 1 ? Math.max(0, newQuestions.length - 1) : prevIdx;
      });

      setResults(prev => ({
        ...prev,
        [qid]: `✅ Submission Complete!\nJudge0 Status: ${statusMessage}\n\n${formatted.displayText}`
      }));
    } catch (err) {
      console.error('Submission error:', err);
      setResults(prev => ({
        ...prev,
        [qid]: `Submission Error: ${err.response?.data?.message || err.message}\n\nCode was saved but Judge0 execution failed.`
      }));
    }
    setCompiling(c => ({ ...c, [qid]: false }));
  };

  const handleAutoSubmit = async () => {
    const q = questions[currentIdx];
    if (!q) {
      if (currentIdx + 1 < questions.length) setCurrentIdx(currentIdx + 1);
      else handleFinalSubmit();
      return;
    }
    await handleSubmit(q.id, q.sample_input, q.sample_output);
    if (currentIdx + 1 < questions.length) setCurrentIdx(currentIdx + 1);
    else handleFinalSubmit();
  };

  const handleFinalSubmit = async () => {
    const currentQ = questions[currentIdx];
    if (currentQ) {
      await handleSubmit(currentQ.id, currentQ.sample_input, currentQ.sample_output);
    }
    exitFullScreen();
    navigate('/student/dashboard');
  };

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setPageError('');
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // ✅ Keep your original routes
        const qResp = await axios.get(
          `http://localhost:3000/api/submissions/student-questions/${courseId}`,
          { headers }
        );

        let fetchedQuestions = [];
        if (qResp && qResp.data) {
          if (Array.isArray(qResp.data)) fetchedQuestions = qResp.data;
          else if (Array.isArray(qResp.data.questions)) fetchedQuestions = qResp.data.questions;
          else if (Array.isArray(qResp.data.data)) fetchedQuestions = qResp.data.data;
        }
        fetchedQuestions = Array.isArray(fetchedQuestions) ? fetchedQuestions : [];

        // Normalize questions
        const normalized = fetchedQuestions.map(q => {
          const src = q.question ?? q;
          const id = src.id ?? q.id;
          const language_id = getQuestionLanguageId(q) ?? null;
          const duration = src.duration ?? q.duration ?? 10;
          const sample_input = src.sample_input ?? src.stdin ?? q.sample_input ?? '';
          const sample_output = src.sample_output ?? src.stdout ?? q.sample_output ?? '';
          const title = src.title ?? q.title ?? 'Untitled';
          const description = src.description ?? q.description ?? '';
          const score = src.score ?? q.score ?? null;
          return {
            ...q,
            id,
            title,
            description,
            sample_input,
            sample_output,
            duration,
            language_id,
            score,
            raw: src,
          };
        });

        setQuestions(normalized);
        setCodes(Object.fromEntries(normalized.map(q => [q.id, ''])));
        setResults({});
        setSubmittedQuestions([]);
        setTotalQuestions(normalized.length);

        // Course details for violation limit
        try {
          const courseResp = await axios.get(
            `http://localhost:3000/api/courses/get-course/${courseId}`,
            { headers }
          );
          const courseData = courseResp?.data?.course ? courseResp.data.course : courseResp.data;
          if (courseData && typeof courseData.allowed_violations !== 'undefined') {
            setViolationLimit(Number(courseData.allowed_violations) || 3);
          } else {
            setViolationLimit(3);
          }
        } catch (err) {
          setViolationLimit(3);
        }

        // Test Judge0 connection on load
        const isJudge0Connected = await testJudge0Connection();
        if (!isJudge0Connected) {
          console.warn('Judge0 is not connected. Code execution will fail.');
        }

      } catch (err) {
        console.error('Could not load questions:', err);
        setPageError(`Could not load questions. (${err.response?.data?.message || err.message})`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId]);

  const handleExit = () => {
    setExitLoading(true);
    setEscModal(true);
    exitFullScreen();
    setTimeout(() => navigate('/student/dashboard'), 300);
  };

  const handleEscContinue = () => {
    setEscModal(false);
    setLocked(false);
    setExitLoading(false);
    setTimeout(() => goFullScreen(document.documentElement), 100);
  };

  const handleEscFinalSubmit = () => {
    setEscModal(false);
    setLocked(true);
    handleFinalSubmit();
  };

  // --- UI & render ---
  if (!started) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f4fafd',
        padding: 16,
      }}>
        <div style={{
          width: '100%', maxWidth: 1100, margin: '0 auto', backgroundColor: '#fff',
          padding: '2rem', borderRadius: 12, boxShadow: '0 6px 30px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ color: '#1976d2', marginBottom: 12, textAlign: 'center' }}>Exam Instructions & Acknowledgements</h2>
          <p style={{ color: '#333', marginBottom: 12 }}>
            Read the following carefully. You must acknowledge all items to start the exam.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 18 }}>
            {ACKS.map((text, i) => (
              <li key={i} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={ackState[i]}
                  onChange={() => setAckState(prev => prev.map((v, idx) => idx === i ? !v : v))}
                />
                <span style={{ color: '#111' }}>{text}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => setAckState(ACKS.map(() => true))}
              style={{
                backgroundColor: '#e2e4ecff', border: 'none', padding: '8px 14px', borderRadius: 6, cursor: 'pointer'
              }}
            >
              Acknowledge All
            </button>

            <button
              onClick={() => {
                if (ackState.every(Boolean)) {
                  goFullScreen(document.documentElement);
                  setStarted(true);
                }
              }}
              disabled={!ackState.every(Boolean)}
              style={{
                backgroundColor: ackState.every(Boolean) ? '#32bb5fff' : '#36be24da',
                color: '#0b0c0bff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                cursor: ackState.every(Boolean) ? 'pointer' : 'not-allowed',
                fontWeight: 700
              }}
            >
              Start Exam
            </button>

            <button
              onClick={() => navigate('/student/dashboard')}
              style={{
                backgroundColor: '#f2f3f6ff',
                border: '1px solid #0100005f',
                padding: '10px 16px',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>

          <p style={{ marginTop: 12, color: '#666', fontSize: 13, textAlign: 'center' }}>
            Total visible questions for you: <strong>{totalQuestions}</strong>
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Loading questions.</div>;
  if (pageError) return <div style={{ color: 'red', padding: 20 }}>{pageError}</div>;
  if (!studentId) return <div style={{ color: 'red', padding: 20 }}>You must log in to attempt this exam.</div>;

  if (questions.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
        ✅ You have submitted all visible questions for this course or no toggled questions are available.
        <br />
        <button
          onClick={() => navigate('/student/dashboard')}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: 16,
            borderRadius: 6,
            border: 'none',
            backgroundColor: '#1976d2',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = questions && questions.length > 0 && currentIdx >= 0 && currentIdx < questions.length
    ? questions[currentIdx]
    : null;

  if (!currentQuestion) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        Loading question...
      </div>
    );
  }

  const minutes = Math.floor(Math.max(0, timeLeft) / 60);
  const seconds = Math.max(0, timeLeft) % 60;

  const currentQuestionLangId = getQuestionLanguageId(currentQuestion) ?? null;
  const currentQuestionLangName = currentQuestionLangId ? findLangName(currentQuestionLangId) : 'Not assigned';

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: '#f4fafd',
      color: '#111',
      paddingBottom: 32,
      paddingTop: 20,
      boxSizing: 'border-box',
    }}>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#0b2376', color: '#fff',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Coding Exam</h3>
          <div style={{ padding: '6px 10px', background: '#ffc107', color: '#000', borderRadius: 20, fontWeight: 700 }}>
            Time left: {minutes}:{String(seconds).padStart(2, '0')}
          </div>
          <div style={{ marginLeft: 12, opacity: 0.9 }}>
            Question {currentIdx + 1} / {questions.length}
          </div>
        </div>

        <div>
          <button onClick={handleExit} disabled={exitLoading} style={{
            padding: '6px 12px', marginLeft: 8, background: '#fff', color: '#0b2376', borderRadius: 6, border: 'none', cursor: 'pointer'
          }}>
            {exitLoading ? 'Exiting.' : 'Exit'}
          </button>
        </div>
      </header>

      {/* Two column layout */}
      <div style={{ display: 'flex', gap: 16, padding: '18px', maxWidth: 1400, margin: '0 auto' }}>
        {/* LEFT PANEL */}
        <aside style={{
          width: '40%', background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 6px 18px rgba(3,102,214,0.06)', overflowY: 'auto', maxHeight: '75vh'
        }}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, color: '#0b2376' }}>{currentQuestion.title}</h2>
            <div style={{ marginTop: 8, color: '#333', fontSize: 13 }}>
              <strong>Course:</strong> {courseId}
            </div>
            <div style={{ marginTop: 6, color: '#333', fontSize: 13 }}>
              <strong>Language:</strong> {currentQuestionLangName}
            </div>
            <div style={{ marginTop: 6, color: '#333', fontSize: 13 }}>
              <strong>Score:</strong> {currentQuestion.score ?? 'N/A'}
            </div>
          </div>

          <div style={{ marginTop: 12, color: '#222' }} dangerouslySetInnerHTML={{ __html: currentQuestion.description || '' }} />

          {currentQuestion.sample_input && (
            <>
              <div style={{ marginTop: 14, fontWeight: 700 }}>Sample Input</div>
              <pre style={{ background: '#f6f8ff', padding: 10, borderRadius: 6, fontFamily: 'monospace' }}>
                {currentQuestion.sample_input}
              </pre>
            </>
          )}

          {currentQuestion.sample_output && (
            <>
              <div style={{ marginTop: 10, fontWeight: 700 }}>Sample Output</div>
              <pre style={{ background: '#f6f8ff', padding: 10, borderRadius: 6, fontFamily: 'monospace' }}>
                {currentQuestion.sample_output}
              </pre>
            </>
          )}

          {currentQuestion.explanation && (
            <>
              <div style={{ marginTop: 10, fontWeight: 700 }}>Explanation</div>
              <div style={{ marginTop: 6 }}>{currentQuestion.explanation}</div>
            </>
          )}
        </aside>

        {/* RIGHT PANEL */}
        <section style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick jump */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIdx(idx)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: idx === currentIdx ? '#1976d2' : '#e6eefc',
                  color: idx === currentIdx ? '#fff' : '#0b2376', border: 'none', cursor: 'pointer'
                }}
                title={`Go to question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#333' }}>
              {submittedQuestions.length} attempted / {totalQuestions} total
            </div>
          </div>

          {/* Editor card */}
          <div style={{ background: '#fff', borderRadius: 8, padding: 12, boxShadow: '0 6px 18px rgba(3,102,214,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontWeight: 700, background: '#f3f4f6' }}>
                  {currentQuestionLangName}
                </div>
                <div style={{ color: '#666', fontSize: 13 }}>Compiler</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={useCustomInput} onChange={e => setUseCustomInput(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Use Custom Input</span>
                </label>
              </div>
            </div>

            <textarea
              value={codes[currentQuestion.id] ?? ''}
              onChange={e => setCodes(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
              style={{
                width: '100%', minHeight: 420, fontFamily: 'monospace',
                fontSize: 14, padding: 12, borderRadius: 6, border: '1px solid #dbeafe', boxSizing: 'border-box'
              }}
              placeholder="// Write your solution here"
            />

            {useCustomInput && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 700 }}>Custom Input</div>
                <textarea
                  value={customStdin}
                  onChange={e => setCustomStdin(e.target.value)}
                  style={{ minHeight: 80, fontFamily: 'monospace', padding: 8, borderRadius: 6, border: '1px solid #e6eefc' }}
                  placeholder="Enter input that will be passed to your program when running/submitting"
                />
              </div>
            )}

            <div style={{ minHeight: 120, background: '#f7fafc', border: '1px solid #e6eefc', padding: 10, borderRadius: 6, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#0b2376' }}>
              {typeof results[currentQuestion.id] === 'string'
                ? results[currentQuestion.id]
                : (results[currentQuestion.id] ? results[currentQuestion.id] : 'Output / compiler messages will appear here.')}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => handleCompile(currentQuestion.id)}
                disabled={!!compiling[currentQuestion.id]}
                style={{
                  padding: '10px 16px', borderRadius: 6, border: '2px solid #1976d2', background: '#fff', color: '#1976d2', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {compiling[currentQuestion.id] ? 'Compiling...' : 'Compile & Test'}
              </button>

              <button
                onClick={() => handleRun(currentQuestion.id, currentQuestion.sample_input)}
                disabled={!!compiling[currentQuestion.id]}
                style={{
                  padding: '10px 16px', borderRadius: 6, border: '2px solid #1976d2', background: '#def0fe', color: '#1976d2', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {compiling[currentQuestion.id] ? 'Running...' : 'Run'}
              </button>

              <button
                onClick={() => handleSubmit(currentQuestion.id, currentQuestion.sample_input, currentQuestion.sample_output)}
                disabled={!!compiling[currentQuestion.id]}
                style={{
                  padding: '10px 16px', borderRadius: 6, background: '#0b66c3', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {compiling[currentQuestion.id] ? 'Submitting.' : 'Submit Code'}
              </button>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setCodes(prev => ({ ...prev, [currentQuestion.id]: '' })); setResults(prev => ({ ...prev, [currentQuestion.id]: '' })); }}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Prev / Next and Finish */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(i => i - 1)}
                style={{ padding: '8px 12px', borderRadius: 6, cursor: currentIdx === 0 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={currentIdx === questions.length - 1}
                onClick={() => setCurrentIdx(i => i + 1)}
                style={{ padding: '8px 12px', borderRadius: 6, cursor: currentIdx === questions.length - 1 ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>

              <button
                onClick={handleFinalSubmit}
                style={{ padding: '8px 12px', borderRadius: 6, background: '#0b66c3', color: '#fff', cursor: 'pointer' }}
              >
                Finish Exam
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Violations UI */}
      {violations.length > 0 && (
        <div style={{ maxWidth: 1400, margin: '12px auto', padding: 12, background: '#fff3f2', borderRadius: 8, border: '1px solid #fde2e2' }}>
          <strong style={{ color: '#b71c1c' }}>Security Warnings</strong>
          <ul>
            {violations.map((v, i) => <li key={i}>{v.time} — {v.reason}</li>)}
          </ul>
          <div style={{ marginTop: 8, color: '#333', fontSize: 13 }}>
            Allowed violations for this course: <strong>{violationLimit ?? 3}</strong>
          </div>
        </div>
      )}

      {/* Violation Remaining Popup */}
      {showViolationPopup && (
        <div style={{
          position: 'fixed',
          right: 20,
          top: 80,
          zIndex: 12000,
          background: '#fff',
          border: '1px solid #fbcaca',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          padding: '12px 16px',
          borderRadius: 8,
          minWidth: 240
        }}>
          <div style={{ fontWeight: 800, color: '#b71c1c', marginBottom: 6 }}>Security Violation</div>
          <div style={{ fontSize: 14, color: '#333' }}>
            You committed a violation. Remaining allowed violations: <strong>{remainingViolations !== null ? remainingViolations : (violationLimit ?? 3)}</strong>
          </div>
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button onClick={() => { setShowViolationPopup(false); if (violationPopupTimeoutRef.current) { clearTimeout(violationPopupTimeoutRef.current); violationPopupTimeoutRef.current = null; } }} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#1976d2', color: '#fff', cursor: 'pointer' }}>OK</button>
          </div>
        </div>
      )}

      {/* showWarning modal */}
      {showWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, color: '#b71c1c' }}>Warning</h3>
            <p>You are one violation away from automatic submission. Please avoid further violations.</p>
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setShowWarning(false)} style={{ padding: '8px 12px' }}>Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* showFinalModal */}
      {showFinalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, color: '#b71c1c' }}>Exam Ended</h3>
            <p>You exceeded the maximum number of violations. Your exam will be submitted now.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handleFinalSubmit} style={{ padding: '8px 12px', background: '#1976d2', color: '#fff', borderRadius: 6 }}>Submit & Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* ESC modal */}
      {escModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, maxWidth: 420 }}>
            <h4 style={{ marginBottom: '1rem', color: '#1976d2' }}>You pressed Esc / exited fullscreen</h4>
            <p>Do you want to submit your code now or continue (re-enter fullscreen)?</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handleEscFinalSubmit} style={{ padding: '10px 16px', backgroundColor: '#dc3545', color: '#fff', borderRadius: 6 }}>Final Submit</button>
              <button onClick={handleEscContinue} style={{ padding: '10px 16px', backgroundColor: '#28a745', color: '#fff', borderRadius: 6 }}>Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingPage;
