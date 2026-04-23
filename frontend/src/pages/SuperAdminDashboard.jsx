import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  UserPlus,
  BookOpen,
  GraduationCap,
  RefreshCw,
  Activity,
  ScrollText,
  Clock3
} from 'lucide-react';
import AdminLayout from './AdminLayout';


const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:3000';

const API_USERS = `${API_ORIGIN}/api/v1/users`;
const API_COURSES = `${API_ORIGIN}/api/courses`;
const API_STUDENTS = `${API_ORIGIN}/api/students`;

const getAuthHeaders = () => {
  try {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const getResponseData = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const formatRole = (role) =>
  String(role || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
};

const roleTheme = {
  super_admin: 'from-emerald-500 to-teal-500',
  admin: 'from-indigo-500 to-blue-500',
  faculty: 'from-amber-500 to-orange-500',
  student: 'from-violet-500 to-fuchsia-500',
  candidate: 'from-slate-500 to-slate-700',
  unknown: 'from-slate-400 to-slate-600'
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const headers = getAuthHeaders();

    try {
      const [usersRes, coursesRes, studentsRes, logsRes] = await Promise.all([
        axios.get(`${API_USERS}/all-users`, { headers }),
        axios.get(`${API_COURSES}/get-all-courses`, { headers }),
        axios.get(`${API_STUDENTS}/get-all-students`, { headers }),
        axios.get(`${API_USERS}/audit-logs?limit=15`, { headers })
      ]);

      setUsers(getResponseData(usersRes.data, ['data', 'users']));
      setCourses(getResponseData(coursesRes.data, ['courses', 'data']));
      setStudents(getResponseData(studentsRes.data, ['students', 'data']));
      setLogs(getResponseData(logsRes.data, ['data', 'logs']));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load system data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const recordDashboardView = async () => {
      try {
        await axios.post(
          `${API_USERS}/audit-logs`,
          {
            action: 'view_super_admin_dashboard',
            targetType: 'dashboard',
            targetId: 'super_admin',
            details: { source: 'super_admin_dashboard' }
          },
          { headers: getAuthHeaders() }
        );
      } catch {
        // Keep dashboard usable even if audit logging fails.
      }
    };

    recordDashboardView();
    load();
  }, []);

  const stats = useMemo(() => {
    const byRole = users.reduce((acc, user) => {
      const role = String(user.role || 'unknown').toLowerCase();
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    return {
      totalUsers: users.length,
      superAdmins: byRole.super_admin || 0,
      admins: byRole.admin || 0,
      faculty: byRole.faculty || 0,
      students: students.length,
      courses: courses.length
    };
  }, [users, students, courses]);

  const recentUsersByRole = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      const first = new Date(a.created_at || a.createdAt || 0).getTime();
      const second = new Date(b.created_at || b.createdAt || 0).getTime();
      return second - first;
    });

    return sorted.reduce((acc, user) => {
      const role = String(user.role || 'unknown').toLowerCase();
      if (!acc[role]) acc[role] = [];
      if (acc[role].length < 4) acc[role].push(user);
      return acc;
    }, {});
  }, [users]);

  const recentRoleEntries = useMemo(() => {
    const roleOrder = ['super_admin', 'admin', 'faculty', 'student', 'candidate', 'unknown'];
    return roleOrder
      .map((role) => ({
        role,
        users: recentUsersByRole[role] || []
      }))
      .filter((entry) => entry.users.length > 0);
  }, [recentUsersByRole]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="lms-card overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <ShieldCheck size={26} />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-black tracking-tight">Super Admin Dashboard</h1>
                <p className="mt-1 text-sm text-white/85">
                  Centralized oversight for users, courses, and system activity.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/add-admin')}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-emerald-700 shadow-sm transition hover:-translate-y-0.5"
                >
                  <UserPlus size={15} />
                  Add Admin
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-70"
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Users</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{stats.totalUsers}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {stats.superAdmins} super admins, {stats.admins} admins, {stats.faculty} faculty
            </p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Students</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{stats.students}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <GraduationCap size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Learners tracked in the platform</p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Courses</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{stats.courses}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <BookOpen size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Active catalog entries</p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Audit Events</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{logs.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Activity size={20} />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">Latest centralized activity logs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.15fr]">
          <div className="lms-card overflow-hidden p-0">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Users size={18} />
                  Recent Users
                </h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-sm">
                  Section wise
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {recentRoleEntries.length === 0 ? (
                <p className="text-sm text-slate-400">No recent users found.</p>
              ) : (
                recentRoleEntries.map((entry) => (
                  <div key={entry.role} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-slate-800">{formatRole(entry.role)}</h4>
                        <p className="text-xs text-slate-500">{entry.users.length} recent accounts</p>
                      </div>
                      <span className={`rounded-full bg-gradient-to-r px-3 py-1 text-xs font-bold text-white ${roleTheme[entry.role] || roleTheme.unknown}`}>
                        {formatRole(entry.role)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {entry.users.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-start justify-between rounded-2xl border border-white bg-white p-3 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">{user.name || 'Unnamed user'}</p>
                            <p className="truncate text-xs text-slate-500">{user.email || 'No email'}</p>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-xs font-semibold text-slate-500">
                              {formatDateTime(user.created_at || user.createdAt)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">{user.phone || 'No phone'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lms-card overflow-hidden p-0">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  <ScrollText size={18} />
                  System Logs
                </h3>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                  {logs.length} events
                </span>
              </div>
            </div>

            <div className="max-h-[640px] space-y-3 overflow-y-auto bg-slate-50 p-5">
              {logs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  No audit logs recorded yet.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex">
                      <div
                        className={`w-1.5 ${log.status === 'success' ? 'bg-emerald-500' : log.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`}
                      />
                      <div className="flex-1 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
                              {String(log.action || 'unknown_action').replace(/_/g, ' ')}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Actor: {log.actor_role ? formatRole(log.actor_role) : 'System'}
                              {log.actor_user_id ? ` #${log.actor_user_id}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <Clock3 size={14} />
                            {formatDateTime(log.created_at || log.createdAt)}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Target</p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {formatRole(log.target_type || 'general')}
                              {log.target_id ? ` #${log.target_id}` : ''}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Status</p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">{formatRole(log.status || 'success')}</p>
                          </div>
                        </div>

                        {log.details && (
                          <div className="mt-3 rounded-xl bg-slate-950 px-3 py-3 font-mono text-[11px] text-slate-200">
                            <pre className="whitespace-pre-wrap break-words">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;