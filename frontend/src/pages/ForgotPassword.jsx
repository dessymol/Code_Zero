import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Send, RefreshCw } from 'lucide-react';
import AuthShell from '../components/AuthShell';

const API_BASE = 'http://localhost:3000/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const explicitType = location.state?.userType;
  const inferUserType = () => {
    const path = location.pathname;
    if (path.includes('admin')) return 'admin';
    if (path.includes('faculty')) return 'faculty';
    if (path.includes('student')) return 'student';
    return explicitType || 'admin';
  };

  const [userType, setUserType] = useState(inferUserType());
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const requestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/password-reset/request-otp`, { email, userType });
      if (response.data.success) {
        setSuccess('OTP sent to your email.');
        if (isDev && response.data.dev_otp) setDevOtp(response.data.dev_otp);
        setTimeout(() => {
          setStep(2);
          setSuccess('');
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/password-reset/verify-otp`, { email, otp, userType });
      if (response.data.success) {
        setSuccess('OTP verified.');
        setTimeout(() => {
          setStep(3);
          setSuccess('');
        }, 600);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/password-reset/reset-password`, {
        email,
        otp,
        newPassword,
        userType,
      });
      if (response.data.success) {
        setSuccess('Password reset successful.');
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/password-reset/resend-otp`, { email, userType });
      if (response.data.success) {
        setSuccess('OTP resent.');
        if (isDev && response.data.dev_otp) setDevOtp(response.data.dev_otp);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset Password" subtitle="Verify your account to set a new password." portalLabel="Password Recovery">
      <button
        onClick={() => (step > 1 ? setStep((p) => p - 1) : navigate('/login'))}
        type="button"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
      >
        <ArrowLeft size={16} />
        Back to Login
      </button>

      {error && <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>}
      {isDev && devOtp && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800">Development OTP</p>
          <p className="text-xl font-black text-amber-900 tracking-widest">{devOtp}</p>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={requestOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Type</label>
            <select value={userType} onChange={(e) => setUserType(e.target.value)} className="lms-input">
              <option value="admin">Admin</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="lms-input pl-10"
                placeholder="name@company.com"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="lms-btn-primary w-full py-3">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            Send OTP
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">OTP</label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="lms-input text-center tracking-[0.3em] text-xl font-bold"
              placeholder="000000"
            />
          </div>
          <button type="submit" disabled={loading || otp.length !== 6} className="lms-btn-primary w-full py-3">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            Verify OTP
          </button>
          <button type="button" onClick={resendOTP} disabled={loading} className="lms-btn-secondary w-full py-3">
            Resend OTP
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="lms-input pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="lms-input pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowConfirmPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="lms-btn-primary w-full py-3">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            Reset Password
          </button>
        </form>
      )}
    </AuthShell>
  );
}
  const isDev = import.meta.env.DEV;
