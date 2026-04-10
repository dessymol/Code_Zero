import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, GraduationCap, FileQuestion, ClipboardList, Trophy,
  RefreshCw, LayoutDashboard, AlertCircle, BookOpen, Clock, CheckCircle
} from 'lucide-react';
import axios from 'axios';
import StudentNavbar from './StudentNavbar';
import { motion } from 'framer-motion';

const COURSE_COLORS = [
  { bg: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: '#2563eb' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: '#059669' },
  { bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', accent: '#7c3aed' },
  { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', accent: '#d97706' },
  { bg: 'bg-rose-600', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', accent: '#dc2626' },
  { bg: 'bg-cyan-600', light: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', accent: '#0891b2' },
  { bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', accent: '#4f46e5' },
  { bg: 'bg-teal-600', light: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', accent: '#0d9488' },
];
const COURSE_ICONS = [GraduationCap, FileQuestion, ClipboardList, Trophy, BookOpen];

const StudentDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchCourses = async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await axios.get('http://localhost:3000/api/students/courses-with-exams', { headers });
      const list = Array.isArray(resp.data.courses) ? resp.data.courses : [];
      setCourses(list.map(c => ({
        course_id: c.course_id ?? c.id ?? null,
        course_name: c.course_name ?? c.name ?? '',
        course_code: c.course_code ?? c.code ?? '',
        hasExam: !!(c.hasExam === true || c.hasExam === 1 || c.hasExam === '1' || c.hasExam === 'true'),
        description: c.description ?? c.course_description ?? c.course_desc ?? c.desc ?? c.details ?? c.summary ?? '',
      })));
    } catch (err) {
      setError('Failed to load courses. Please try again.');
      setCourses([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const stats = [
    { label: 'Enrolled Courses', value: courses.length, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Exams Available', value: courses.filter(c => c.hasExam).length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Pending Exams', value: courses.filter(c => !c.hasExam).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ];

  return (
    <>
      <StudentNavbar />
      <div className="fixed inset-0 overflow-auto lms-page-bg" style={{ top: '56px' }}>
        <div className="lms-container py-6 md:py-8 min-h-full">

          {/* Header */}
          <div className="relative mb-8 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, #059669, #2563eb)' }} />
            <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                <LayoutDashboard size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">My Learning Portal</h1>
                <p className="text-slate-500">View your assigned courses and start your exams</p>
              </div>
              <button onClick={fetchCourses} disabled={loading}
                className="lms-btn-primary gap-2" style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', border: 'none' }}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`lms-card p-5 flex items-center gap-4 border ${s.border}`}>
                <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon size={22} className={s.color} />
                </div>
                <div>
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Courses */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">Loading your courses...</p>
            </div>
          ) : error ? (
            <div className="lms-card p-10 text-center max-w-lg mx-auto border-red-100">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-700 mb-2">Failed to Load</h3>
              <p className="text-slate-500 mb-6 text-sm">{error}</p>
              <button onClick={fetchCourses} className="lms-btn-primary">Try Again</button>
            </div>
          ) : courses.length === 0 ? (
            <div className="lms-card p-16 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
                <GraduationCap size={40} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Courses Yet</h3>
              <p className="text-slate-500 text-sm">You haven't been allocated to any courses yet. Contact your administrator.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800">Your Courses</h2>
                <span className="text-sm text-slate-500">{courses.length} course{courses.length !== 1 ? 's' : ''} enrolled</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {courses.map((course, index) => {
                  const id = course.course_id ?? course.id;
                  const color = COURSE_COLORS[index % COURSE_COLORS.length];
                  const Icon = COURSE_ICONS[index % COURSE_ICONS.length];
                  return (
                    <motion.div key={id ?? index}
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col">
                      {/* Card Top Strip */}
                      <div className={`h-1.5 ${color.bg}`} />
                      <div className="p-5 flex-1 flex flex-col">
                        {/* Icon + Badge */}
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center shadow-sm`}>
                            <Icon size={22} className="text-white" />
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${color.light} ${color.text} border ${color.border}`}>
                            {course.hasExam ? '✓ Ready' : 'Upcoming'}
                          </span>
                        </div>
                        {/* Course Info */}
                        <div className="flex-1 mb-5">
                          <h3 className="font-bold text-slate-800 text-base leading-snug mb-1 line-clamp-2">{course.course_name}</h3>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{course.course_code}</p>
                          {course.description && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{course.description}</p>
                          )}
                        </div>
                        {/* CTA Button */}
                        <button
                          onClick={() => course.hasExam && navigate(`/student/exam/${id}`)}
                          disabled={!course.hasExam}
                          className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-150 ${
                            course.hasExam
                              ? `${color.bg} text-white shadow-sm hover:brightness-95 active:scale-95`
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}>
                          {course.hasExam ? (<><Play size={15} fill="currentColor" /> Start Exam</>) : (<><Clock size={15} /> Not Available</>)}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
export default StudentDashboard;
