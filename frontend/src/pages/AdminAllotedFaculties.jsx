// src/pages/AdminAllotedFaculties.jsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, User, Users, Mail, Phone, RefreshCw, Shield, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost:3000/api';
const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#4f46e5','#db2777'];

export default function AdminAllotedFaculties() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [faculties, setFaculties] = useState([]);
  const [courseInfo, setCourseInfo] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [fRes, cRes] = await Promise.all([
        axios.get(`${API_BASE}/courses/${courseId}/faculties`),
        axios.get(`${API_BASE}/courses/${courseId}`),
      ]);
      const facs = fRes.data?.faculties ?? fRes.data ?? [];
      setFaculties(Array.isArray(facs) ? facs : []);
      setCourseInfo(cRes.data?.course ?? cRes.data ?? null);
    } catch {
      setFaculties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [courseId]);

  const courseName  = courseInfo?.name  ?? courseInfo?.course?.name  ?? `Course #${courseId}`;
  const courseCode  = courseInfo?.course_code ?? courseInfo?.course?.course_code ?? '';

  return (
    <AdminLayout>
      <div className="mb-6">
        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-sm">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <ArrowLeft size={15} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Courses</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-semibold truncate max-w-[200px]">{courseName}</span>
          <span className="text-slate-300">/</span>
          <span className="text-blue-600 font-semibold">Faculty</span>
        </div>

        {/* Page Header */}
        <div className="lms-card p-5 mb-6 border-l-4 border-l-blue-600">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
              <Users size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-900">Allocated Faculty</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-sm text-slate-500 truncate">{courseName}</p>
                {courseCode && (
                  <span className="lms-badge lms-badge-blue font-mono">{courseCode}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={load} disabled={loading}
                className="lms-btn-secondary gap-2 h-9 px-3 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => navigate('/admin/courses')}
                className="lms-btn-primary gap-2 h-9 px-3 text-sm">
                <Shield size={14} /> Manage
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Faculty', value: faculties.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active', value: faculties.filter(f => f.is_active !== false).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Course ID', value: `#${courseId}`, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((s, i) => (
            <div key={i} className="lms-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <User size={16} className={s.color} />
              </div>
              <div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="lms-card overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading faculty data…</p>
            </div>
          ) : faculties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Users size={28} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">No Faculty Allocated</h3>
              <p className="text-sm text-slate-500 max-w-xs mb-5">
                This course doesn't have any faculty members assigned yet. Go to Course Management to assign faculty.
              </p>
              <button onClick={() => navigate('/admin/courses')} className="lms-btn-primary gap-2">
                <Shield size={15} /> Go to Courses
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Faculty Member</th>
                    <th>Contact Information</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faculties.map((f, idx) => (
                    <motion.tr key={f.id || idx}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}>
                      <td className="text-slate-400 font-bold text-xs">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: COLORS[idx % COLORS.length] }}>
                            {(f.name || 'F').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{f.name || '—'}</div>
                            <div className="text-xs text-slate-400">ID: {f.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <Mail size={13} className="text-slate-400 shrink-0" />
                            {f.email || '—'}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            {f.phone || 'No phone'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`lms-badge ${f.is_active !== false ? 'lms-badge-green' : 'lms-badge-gray'} gap-1`}>
                          {f.is_active !== false
                            ? <><CheckCircle size={10} /> Active</>
                            : <><XCircle size={10} /> Inactive</>}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
