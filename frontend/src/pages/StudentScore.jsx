import React, { useEffect, useMemo, useState } from 'react';
import {
  Trophy, TrendingUp, Activity, Code, RotateCw, ArrowRight,
  Target, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import StudentNavbar from './StudentNavbar';

const API_COURSES = 'http://localhost:3000/api/students/courses-with-exams';
const API_SUBMISSIONS = 'http://localhost:3000/api/submissions/mine';

// Helper to pick an icon based on course name
function getCourseIcon(name, idx) {
  if (!name) return <Activity size={24} />;
  const n = name.toLowerCase();
  if (n.includes('learn') || n.includes('machine') || n.includes('ml')) return <Activity size={24} />;
  if (n.includes('data') || n.includes('algorithm') || n.includes('dsa')) return <RotateCw size={24} />;
  if (n.includes('web') || n.includes('frontend') || n.includes('react')) return <Code size={24} />;

  const icons = [<Activity size={24} />, <RotateCw size={24} />, <Code size={24} />];
  return icons[idx % icons.length];
}

export default function StudentScore() {
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [coursesRes, subsRes] = await Promise.allSettled([
          axios.get(API_COURSES, { headers }),
          axios.get(API_SUBMISSIONS, { headers }),
        ]);

        // Normalize courses
        let coursesData = [];
        if (coursesRes.status === 'fulfilled') {
          const d = coursesRes.value?.data ?? {};
          const rawCourses = Array.isArray(d) ? d : (d.courses || d.data || []);
          coursesData = rawCourses.map((c, idx) => ({
            id: c.course_id ?? c.id ?? c._id ?? `c-${idx}`,
            name: c.course_name ?? c.name ?? c.title ?? `Course ${idx + 1}`,
            code: c.course_code ?? c.code ?? '',
          }));
        }

        // Normalize submissions
        let subsRaw = [];
        if (subsRes.status === 'fulfilled') {
          const d = subsRes.value?.data ?? {};
          if (Array.isArray(d)) subsRaw = d;
          else if (Array.isArray(d.submissions)) subsRaw = d.submissions;
          else if (Array.isArray(d.data)) subsRaw = d.data;
          else if (Array.isArray(d.items)) subsRaw = d.items;
        }

        const normalizedSubs = subsRaw.map((s, idx) => {
          const courseId = s.course?.id ?? s.course_id ?? s.courseId ?? s.Question?.course_id ?? null;
          const courseName = s.course?.name ?? s.course_name ?? s.courseName ?? s.Question?.Course?.name ?? null;
          const status = (s.status ?? s.state ?? (s.raw && s.raw.status) ?? '').toString();
          const scoreRaw = s.score ?? s.marks ?? s.points ?? null;
          const score = (scoreRaw != null && scoreRaw !== '') ? Number(scoreRaw) : null;
          const createdAt = s.createdAt ?? s.created_at ?? s.created_at_date ?? null;

          return {
            id: s.id ?? s._id ?? `sub-${idx}`,
            courseId,
            courseName,
            status,
            score: Number.isNaN(score) ? null : score,
            createdAt,
            raw: s,
          };
        });

        if (mounted) {
          setCourses(coursesData);
          setSubmissions(normalizedSubs);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (mounted) setError(err.response?.data?.message || 'Failed to load data');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    return () => { mounted = false; };
  }, []);

  const aggregates = useMemo(() => {
    const map = new Map();
    courses.forEach(c => {
      map.set(c.id, { id: c.id, name: c.name || c.code || c.id, score: 0, accepted: 0, total: 0 });
    });

    submissions.forEach(s => {
      const key = s.courseId ?? s.courseName ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, { id: key, name: s.courseName ?? (typeof key === 'string' ? key : 'Unknown Course'), score: 0, accepted: 0, total: 0 });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (s.status?.toLowerCase() === 'accepted') {
        entry.accepted += 1;
        const sc = Number(s.score);
        if (!isNaN(sc)) entry.score += sc;
      }
    });

    return Array.from(map.values());
  }, [courses, submissions]);

  return (
    <>
      <StudentNavbar />

      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container py-6 space-y-6">

          {/* Header */}
          <div className="lms-card p-5 border-l-4 border-l-emerald-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
                <Trophy size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">My Performance</h1>
                <p className="text-sm text-slate-500">Track your progress and scores across all courses</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <span className="lms-badge lms-badge-green gap-1"><Target size={11} /> {aggregates.reduce((acc, c) => acc + c.accepted, 0)} Accepted</span>
                <span className="lms-badge lms-badge-blue gap-1"><Activity size={11} /> {submissions.length} Total</span>
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="lms-card flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Calculating scores…</p>
            </div>
          ) : error ? (
            <div className="lms-card p-5 flex items-center gap-3 border-red-200 bg-red-50">
              <AlertCircle size={20} className="text-red-500 shrink-0" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          ) : aggregates.length === 0 ? (
            <div className="lms-card flex flex-col items-center justify-center py-20 border-dashed text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><TrendingUp size={28} className="text-slate-400" /></div>
              <h3 className="text-base font-bold text-slate-700 mb-1">No Activity Yet</h3>
              <p className="text-sm text-slate-500">Start solving exam problems to see your stats here!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {aggregates.map((course, idx) => {
                const ratio = course.total > 0 ? (course.accepted / course.total) : 0;
                const isPositive = ratio >= 0.5;

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group"
                  >
                    <div className="p-6 flex-1">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-100 shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform duration-300">
                          {getCourseIcon(course.name, idx)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-2">{course.name}</h3>
                          <p className="text-xs font-mono text-slate-400 mt-1">{course.id}</p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Score</p>
                        <div className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                          {course.score}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                          <span>Progress</span>
                          <span>{Math.round(ratio * 100)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${ratio * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full rounded-full ${isPositive ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`}
                          />
                        </div>
                        <p className={`text-xs font-bold mt-2 ${isPositive ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {course.accepted} / {course.total} Problems Solved
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button
                        onClick={() => navigate(`/student/submissions?courseId=${encodeURIComponent(course.id)}`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                      >
                        View Details <ArrowRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
