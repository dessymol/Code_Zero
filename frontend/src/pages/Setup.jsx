import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, Lock, Mail, User } from 'lucide-react';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

export default function Setup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', setupSecret: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const headers = {};
      if (form.setupSecret) headers['x-setup-secret'] = form.setupSecret.trim();
      await axios.post(`${API_ORIGIN}/api/setup`, {
        name: form.name,
        email: form.email,
        password: form.password
      }, { headers });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lms-page-bg min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-6 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">System Setup</h1>
              <p className="text-sm text-slate-500">Create the first Super Admin account</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                required
                value={form.name}
                onChange={onChange('name')}
                className="lms-input pl-9"
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="email"
                required
                value={form.email}
                onChange={onChange('email')}
                className="lms-input pl-9"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="password"
                required
                value={form.password}
                onChange={onChange('password')}
                className="lms-input pl-9"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Must include upper, lower, number, and special character.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Setup Secret (optional)</label>
            <input
              type="password"
              value={form.setupSecret}
              onChange={onChange('setupSecret')}
              className="lms-input"
              placeholder="If your server requires a setup secret"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="lms-btn-primary w-full h-11 text-sm disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Super Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
