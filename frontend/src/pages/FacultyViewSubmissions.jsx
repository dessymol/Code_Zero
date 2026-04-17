// src/pages/FacultyViewSubmissions.jsx
import React, { useEffect, useState } from 'react';
import { RefreshCw, Users, FileText, ClipboardList, ArrowRight, BookOpen, BarChart2 } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FacultyNavbar from './FacultyNavbar';
import { motion } from 'framer-motion';

const API = 'http://localhost:3000/api';
const COLORS = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#0891b2','#4f46e5','#db2777'];

export default function FacultyViewSubmissions() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const normalizeCourse = (c) => ({
    ...c,
    id: c.id ?? c.course_id ?? c.courseId ?? c._id,
    name: c.name ?? c.course_name ?? c.title ?? c.courseTitle ?? c.course_title ?? '',
    course_code: c.course_code ?? c.code ?? c.courseCode ?? c.courseCodeValue ?? '',
    description: c.description ?? c.course_description ?? c.course_desc ?? c.desc ?? c.details ?? c.summary ?? '',
  });

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/courses/faculty-courses`, { headers: { Authorization: `Bearer ${token}` } });
      const list = Array.isArray(res.data?.courses) ? res.data.courses : [];
      setCourses(list.map(normalizeCourse));
    } catch { setCourses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  return (
    <>
      <FacultyNavbar />
      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container py-6">

          {/* Header */}
          <div className="lms-card p-5 mb-6 border-l-4 border-l-purple-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-sm shrink-0">
                <ClipboardList size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">Evaluate Submissions</h1>
                <p className="text-sm text-slate-500">Select a course to review and grade student work</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="lms-badge lms-badge-purple gap-1"><Users size={11} /> {courses.length} Courses</span>
                <button onClick={fetchCourses} disabled={loading} className="lms-btn-secondary gap-2 h-9 px-3 text-sm">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="lms-card flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading courses…</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="lms-card flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText size={28} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">No Courses Assigned</h3>
              <p className="text-sm text-slate-500 max-w-xs">You haven't been assigned to any courses yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {courses.map((course, i) => (
                <motion.div key={course.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/faculty/evaluate/${course.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden cursor-pointer group flex flex-col">
                  <div className="h-1.5" style={{ background: COLORS[i % COLORS.length] }} />
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}>
                        <FileText size={18} />
                      </div>
                      <span className="lms-badge lms-badge-purple font-mono text-xs">{course.course_code || '—'}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug mb-1 line-clamp-2 group-hover:text-purple-700 transition-colors">{course.name}</h3>
                    {course.description && (
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">{course.description}</p>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                      <span className="text-xs font-semibold text-slate-500">View submissions</span>
                      <ArrowRight size={16} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
