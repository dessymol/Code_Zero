import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { clearSession, setSession } from '../utils/auth';
import AuthShell from '../components/AuthShell';

const StudentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const API_URL = 'http://localhost:3000/api/students/login';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    clearSession();
    try {
      const res = await axios.post(API_URL, { email: email.trim().toLowerCase(), password });
      const { token, user } = res.data || {};
      if (!token || !user || user.role !== 'student') {
        throw new Error('Invalid login response');
      }
      setSession({ token, user });
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      role="student"
      title="Student Login"
      subtitle="Access your courses, attempt exams, and track your results."
      accent="from-indigo-700 to-sky-700"
      switches={[
        { label: 'Admin Login', onClick: () => navigate('/') },
        { label: 'Faculty Login', onClick: () => navigate('/faculty/login') },
      ]}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="student-email">
            Email
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            type="email"
            id="student-email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="student@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="student-password">
            Password
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            type="password"
            id="student-password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="********"
          />
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <button
          className="w-full py-3 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800 disabled:opacity-70 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/student-forgot-password')}
          className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-4"
        >
          Forgot Password?
        </button>
      </form>
    </AuthShell>
  );
};

export default StudentLogin;
