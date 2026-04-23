import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { clearSession, setSession } from '../utils/auth';
import AuthShell from '../components/AuthShell';

const FacultyLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API_URL = 'http://localhost:3000/api/v1/users/login';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    clearSession();
    try {
      const res = await axios.post(API_URL, { email: email.trim().toLowerCase(), password });
      if (res.data.token && res.data.user) {
        const { token, user } = res.data;
        if (user.role === 'faculty') {
          setSession({ token, user });
          navigate('/faculty/dashboard');
        } else {
          setError('Access denied. Only faculty members can login here.');
          clearSession();
        }
      } else {
        setError('Login failed. Invalid response from server.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      role="faculty"
      title="Faculty Login"
      subtitle="Review submissions, manage exams, and support learner progress."
      accent="from-cyan-700 to-blue-700"
      switches={[
        { label: 'Admin Login', onClick: () => navigate('/') },
        { label: 'Student Login', onClick: () => navigate('/student/login') },
      ]}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="faculty-email">
            Email
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"
            type="email"
            id="faculty-email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="faculty@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="faculty-password">
            Password
          </label>
          <input
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500"
            type="password"
            id="faculty-password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="********"
          />
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <button
          className="w-full py-3 rounded-xl bg-cyan-700 text-white font-bold hover:bg-cyan-800 disabled:opacity-70 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/faculty-forgot-password')}
          className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 underline underline-offset-4"
        >
          Forgot Password?
        </button>
      </form>
    </AuthShell>
  );
};

export default FacultyLogin;
