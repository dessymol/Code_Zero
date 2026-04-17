import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, UserPlus, BookOpen, GraduationCap, RefreshCw, Activity
} from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_BASE = 'http://localhost:3000/api';
const API_USERS = 'http://localhost:3000/api/v1/users/all-users';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, coursesRes, studentsRes] = await Promise.allSettled([
        axios.get(API_USERS),
        axios.get(`${API_BASE}/courses/get-all-courses`),
        axios.get(`${API_BASE}/students/get-all-students`)
      ]);

      if (usersRes.status === 'fulfilled') {
        const data = usersRes.value?.data?.data || usersRes.value?.data?.users || [];
        setUsers(Array.isArray(data) ? data : []);
      } else {
        setUsers([]);
      }

      if (coursesRes.status === 'fulfilled') {
        const data = coursesRes.value?.data?.courses || coursesRes.value?.data || [];
        setCourses(Array.isArray(data) ? data : []);
      } else {
        setCourses([]);
      }

      if (studentsRes.status === 'fulfilled') {
        const data = studentsRes.value?.data?.students || studentsRes.value?.data || [];
        setStudents(Array.isArray(data) ? data : []);
      } else {
        setStudents([]);
      }
    } catch (err) {
      setError('Failed to load system data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const byRole = users.reduce((acc, u) => {
      const role = (u.role || 'unknown').toLowerCase();
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    return {
      totalUsers: users.length,
      superAdmins: byRole.super_admin || 0,
      admins: byRole.admin || 0,
      faculty: byRole.faculty || 0,
      candidates: byRole.candidate || 0,
      students: students.length,
      courses: courses.length
    };
  }, [users, students, courses]);

  const recentUsers = useMemo(() => {
    const sorted = users.slice().sort((a, b) => {
      const ta = new Date(a.created_at || a.createdAt || 0).getTime();
      const tb = new Date(b.created_at || b.createdAt || 0).getTime();
      return tb - ta;
    });
    return sorted.slice(0, 8);
  }, [users]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="lms-card p-6 border-l-4 border-l-emerald-600">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
              <p className="text-sm text-slate-500">System oversight, user management, and administrative controls</p>
            </div>
            <button onClick={load} disabled={loading} className="lms-btn-secondary gap-2 h-10 px-4 text-sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Users</p>
                <p className="text-3xl font-black text-slate-800">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {stats.superAdmins} super admins · {stats.admins} admins · {stats.faculty} faculty
            </p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Students</p>
                <p className="text-3xl font-black text-slate-800">{stats.students}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <GraduationCap size={20} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Active learner accounts</p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Courses</p>
                <p className="text-3xl font-black text-slate-800">{stats.courses}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <BookOpen size={20} />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Configured courses</p>
          </div>

          <div className="lms-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Actions</p>
                <p className="text-lg font-bold text-slate-800">Manage</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Activity size={20} />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => navigate('/admin/add-admin')} className="lms-btn-primary h-9 px-3 text-xs">
                <UserPlus size={14} className="mr-1" /> Add Admin
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lms-card p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={18} /> Recent Users
            </h3>
            <div className="space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No users found.</p>
              ) : (
                recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-700">{u.name || 'Unnamed'}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-600">
                      {(u.role || 'unknown').toUpperCase()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lms-card p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-4">System Logs</h3>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                Log collection is not configured yet. If you want centralized logs, I can add a simple audit log table and record admin actions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
