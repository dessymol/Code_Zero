import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { clearSession, setSession } from '../utils/auth';
import AuthShell from '../components/AuthShell';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const API_USER_LOGIN = 'http://localhost:3000/api/v1/users/login';
  const API_STUDENT_LOGIN = 'http://localhost:3000/api/students/login';

  const redirectByRole = (role) => {
    if (role === 'super_admin') return '/super-admin/dashboard';
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'faculty') return '/faculty/dashboard';
    if (role === 'student') return '/student/dashboard';
    return '/';
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    clearSession();

    try {
      const payload = { email: email.trim().toLowerCase(), password };
      let token = null;
      let user = null;

      try {
        const response = await axios.post(API_USER_LOGIN, payload);
        token = response?.data?.token;
        user = response?.data?.user;
      } catch {
        const studentResponse = await axios.post(API_STUDENT_LOGIN, payload);
        token = studentResponse?.data?.token;
        user = studentResponse?.data?.user;
      }

      if (!token || !user?.role) {
        throw new Error('Invalid login response');
      }

      setSession({ token, user });
      navigate(redirectByRole(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
      clearSession();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      portalLabel="Unified Portal"
      title="Sign In"
      subtitle="Use your LMS account credentials to continue."
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className="lms-input"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className="lms-input"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-end text-sm">
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
          >
            Forgot Password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="lms-btn-primary w-full py-3 text-base"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </AuthShell>
  );
};

export default AdminLogin;
