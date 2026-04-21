import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import FacultyNavbar from './FacultyNavbar';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, BookOpen, ClipboardList, MessageCircle, Search, LayoutDashboard, Download, Filter, RefreshCw,
  TrendingUp, Users, FileText, ChevronDown, MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';

const API = 'http://localhost:3000/api';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

const readNum = (obj, ...keys) => {
  if (!obj) return 0;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = Number(obj[k]);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
};

function Donut({ data = {}, size = 120, subtitle = '' }) {
  const entries = Object.entries(data || {});
  const total = Math.max(entries.reduce((s, [, v]) => s + (Number(v) || 0), 0), 1);

  let acc = 0;
  const stops = entries
    .map(([k, v], i) => {
      const start = (acc / total) * 100;
      acc += Number(v) || 0;
      const end = (acc / total) * 100;
      return `${PALETTE[i % PALETTE.length]} ${start}% ${end}%`;
    })
    .join(', ');
  const gradient = entries.length ? `conic-gradient(${stops})` : 'transparent';

  return (
    <div className="flex items-center gap-4">
      <div style={{ width: size, height: size }} className="relative shrink-0">
        <div
          className="w-full h-full rounded-full shadow-inner transition-transform duration-300 hover:scale-105"
          style={{ background: gradient }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white flex flex-col items-center justify-center text-center shadow-lg"
          style={{ width: size * 0.56, height: size * 0.56 }}
        >
          <div className="text-lg font-bold text-slate-800 leading-none">
            {entries.reduce((s, [, v]) => s + (Number(v) || 0), 0)}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-400">No data available</p>
        ) : (
          entries.map(([k, v], i) => (
            <div key={k} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="text-xs text-slate-500 font-medium truncate flex-1">{k}</span>
              <span className="text-xs text-slate-800 font-bold">{v}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AreaSpark({ points = [], height = 100, color = '#3b82f6' }) {
  if (!points || points.length === 0) return <p className="text-xs text-slate-400">No activity recorded</p>;

  const w = Math.max(240, points.length * 18);
  const h = height;
  const min = Math.min(...points.map(p => p.y));
  const max = Math.max(...points.map(p => p.y));
  const range = Math.max(max - min, 1);
  const step = w / Math.max(points.length - 1, 1);

  const pathD = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p.y - min) / range) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div className="w-full overflow-hidden rounded-xl bg-slate-50 border border-slate-100">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#areaGradient)" />
        <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function CourseBarList({ items = [], maxWidth = 420, labelKey = 'label', valueKey = 'value', heightPer = 28 }) {
  const max = Math.max(...(items.map(i => Number(i[valueKey] || 0))), 1);

  if (items.length === 0) return <p className="text-xs text-slate-400 italic">No items to display</p>;

  return (
    <div className="w-full overflow-x-auto custom-scrollbar pb-2">
      <div className="w-full min-w-[280px]">
        {items.map((it, idx) => {
          const v = Number(it[valueKey] || 0);
          const pct = Math.round((v / max) * 100);
          return (
            <div key={(it[labelKey] || '') + idx} className="flex items-center gap-2 mb-2 last:mb-0">
              <div
                className="w-32 text-xs font-medium text-slate-700 truncate"
                title={it[labelKey]}
              >
                {it[labelKey]}
              </div>
              <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-blue-700 rounded-md flex items-center px-2 text-[10px] text-white font-bold transition-all duration-500"
                  style={{ width: `${Math.max(pct, 0)}%` }}
                >
                  {v > 0 && v}
                </div>
              </div>
              <div className="w-8 text-right text-[10px] font-bold text-slate-400">{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, loading = false, subtitle }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-2xl p-5 w-full border border-slate-200 bg-white shadow-sm group"
      style={{
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div className="flex justify-between items-start h-full relative z-10">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-500">
            {title}
          </h3>
          <div
            className="text-3xl font-bold mb-1"
            style={{ color }}
          >
            {loading ? '...' : value}
          </div>
          {subtitle && (
            <span className="text-[11px] font-medium text-slate-500 block tracking-wide">
              {subtitle}
            </span>
          )}
        </div>

        <div
          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50"
          style={{
            color
          }}
        >
          {React.cloneElement(icon, { size: 24, color: color })}
        </div>
      </div>
    </motion.div>
  );
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [recentSubs, setRecentSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [rangeFilter, setRangeFilter] = useState('7');
  const [chats, setChats] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const token = useMemo(() => localStorage.getItem('token') || null, []);
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  useEffect(() => {
    fetchCourses();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (courses.length) fetchChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  useEffect(() => {
    if (courses.length > 0) fetchRecentSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, rangeFilter]);

  async function fetchCourses() {
    setLoadingCourses(true);
    try {
      const res = await axios.get(`${API}/courses/faculty-courses`, { headers });
      const list = Array.isArray(res.data?.courses) ? res.data.courses : [];
      const missing = list.filter(c => (c.submissionCount === undefined || c.submissionCount === null)).slice(0, 6);
      await Promise.all(missing.map(async (c) => {
        try {
          const r = await axios.get(`${API}/submissions/faculty/course/${c.id}`, { headers });
          const subs = Array.isArray(r.data?.submissions) ? r.data.submissions : (r.data?.data || []);
          c.submissionCount = subs.length;
          c._fetchedSubmissions = subs;
        } catch (e) {
          c.submissionCount = 0;
        }
      }));
      setCourses(list);
    } catch (err) {
      console.error('fetchCourses error', err?.response?.data || err.message);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }

  async function fetchSummary() {
    setLoadingSummary(true);
    try {
      const res = await axios.get(`${API}/submissions/faculty/summary`, { headers });
      setSummary(res.data || null);
    } catch (err) {
      console.warn('fetchSummary failed', err?.response?.data || err.message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }

  async function fetchRecentSubmissions() {
    setLoadingSubs(true);
    try {
      const list = [];
      const sampleCourses = courses.slice(0, 8);
      for (const c of sampleCourses) {
        try {
          const res = await axios.get(`${API}/submissions/faculty/course/${c.id}`, { headers });
          const subs = Array.isArray(res.data?.submissions) ? res.data.submissions : (res.data?.data || []);
          for (const s of subs) list.push({ ...s, course_name: c.name, course_id: c.id });
        } catch (e) {
          console.debug('single course subs fetch failed for', c.id, e?.message || e);
        }
      }
      const parsed = list
        .map(s => ({ ...s, createdAt: s.createdAt || s.created_at || new Date().toISOString() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const days = Number(rangeFilter || 7);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      const sliced = parsed.filter(s => new Date(s.createdAt) >= cutoff).slice(0, 200);
      setRecentSubs(sliced);
    } catch (err) {
      console.error('fetchRecentSubmissions error', err);
      setRecentSubs([]);
    } finally {
      setLoadingSubs(false);
    }
  }

  async function fetchChats() {
    try {
      const sample = courses.slice(0, 8);
      const out = [];
      await Promise.all(sample.map(async (c) => {
        try {
          const r = await axios.get(`${API}/chats/course/${c.id}/faculty`, { headers });
          const payload = r.data || {};
          const msgs = Array.isArray(payload.chats) ? payload.chats
            : Array.isArray(payload.messages) ? payload.messages
              : Array.isArray(payload.threads) ? payload.threads
                : Array.isArray(payload.data) ? payload.data
                  : [];
          const count = msgs.length;
          const last = count > 0 ? (msgs[count - 1].text || msgs[count - 1].message || msgs[count - 1].body || '') : '';
          out.push({ courseId: c.id, courseName: c.name, count, lastMessage: String(last).slice(0, 80) });
        } catch (e) {
          out.push({ courseId: c.id, courseName: c.name, count: 0, lastMessage: '' });
        }
      }));
      setChats(out);
    } catch (err) {
      console.error('fetchChats error', err);
      setChats([]);
    }
  }

  const totalCourses = courses.length;
  const totalStudents = courses.reduce((s, c) => s + readNum(c, 'studentCount', 'count', 'students'), 0);
  const totalSubmissions = courses.reduce((s, c) => s + readNum(c, 'submissionCount', 'submissions'), 0);
  const avgPerCourse = totalCourses ? Math.round(totalSubmissions / totalCourses) : 0;

  const statusCounts = useMemo(() => {
    if (summary && summary.courseStatus) return summary.courseStatus;
    const m = {};
    (courses || []).forEach(c => {
      const st = (c.status || c.course_status || c.state || 'Active').toString();
      m[st] = (m[st] || 0) + 1;
    });
    return m;
  }, [courses, summary]);

  const groupedSeries = useMemo(() => {
    if (summary && Array.isArray(summary.courses)) {
      const submissions = { name: 'Submissions', values: (summary.courses || []).slice(0, 6).map(s => ({ label: s.name || s.course_name, value: s.submissionsCount || s.submissions || 0 })) };
      const students = { name: 'Students', values: (summary.courses || []).slice(0, 6).map(s => ({ label: s.name || s.course_name, value: s.studentCount || s.students || 0 })) };
      return [submissions, students];
    }
    const sorted = courses.slice().sort((a, b) => readNum(b, 'submissionCount', 'submissions') - readNum(a, 'submissionCount', 'submissions')).slice(0, 6);
    const submissions = { name: 'Submissions', values: sorted.map(c => ({ label: c.name || `C${c.id}`, value: readNum(c, 'submissionCount', 'submissions') })) };
    const students = { name: 'Students', values: sorted.map(c => ({ label: c.name || `C${c.id}`, value: readNum(c, 'studentCount', 'count') })) };
    return [submissions, students];
  }, [courses, summary]);

  const areaTimeseries = useMemo(() => {
    if (summary && Array.isArray(summary.timeseries)) {
      return summary.timeseries.slice(-9).map(t => ({ x: (t.date || '').slice(5), y: Number(t.total_submissions || t.count || t.value || 0) }));
    }
    const map = {};
    const now = new Date();
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    courses.forEach(c => {
      const date = c.last_submission_date || c.lastSubmission || c.updatedAt || c.updated_at;
      if (!date) return;
      const k = new Date(date).toISOString().slice(0, 10);
      if (map[k] === undefined) map[k] = 0;
      map[k] += readNum(c, 'submissionCount', 'submissions');
    });
    return Object.keys(map).sort().map(k => ({ x: k.slice(5), y: map[k] || 0 }));
  }, [courses, summary]);

  const refreshAll = async () => { await fetchCourses(); await fetchSummary(); await fetchRecentSubmissions(); await fetchChats(); };

  return (
    <>
      <FacultyNavbar />
      <div className="fixed inset-0 top-16 overflow-auto lms-page-bg">
      <div className="lms-container py-6 md:py-8 min-h-full">

        {/* Header */}
        <div className="relative mb-8 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-7 relative z-10 flex flex-col md:flex-row items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <LayoutDashboard size={30} className="text-blue-700" />
            </div>

            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                Faculty Dashboard
              </h1>
              <p className="text-slate-500 text-base md:text-lg">
                Course management & analytics overview
              </p>
            </div>

            <div className="flex gap-3">
              <div className="relative">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="lms-btn-secondary h-11 px-4 text-slate-600 flex items-center gap-2"
                >
                  <Filter size={20} />
                  <span>{rangeFilter} Days</span>
                  <ChevronDown size={14} />
                </button>
                {isFilterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-20">
                    {[7, 14, 30, 90].map(days => (
                      <button
                        key={days}
                        onClick={() => { setRangeFilter(String(days)); setIsFilterOpen(false); }}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 text-sm font-semibold ${String(days) === rangeFilter ? 'text-blue-600' : 'text-slate-600'}`}
                      >
                        Last {days} Days
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={refreshAll}
                className="lms-btn-primary px-6 text-white flex items-center gap-2"
              >
                <RefreshCw size={20} className={loadingSummary ? "animate-spin" : ""} />
                <span className="hidden md:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Courses"
            value={totalCourses}
            icon={<BookOpen />}
            color="#6366f1"
            loading={loadingSummary}
            subtitle="Assigned"
          />
          <StatCard
            title="Total Students"
            value={totalStudents}
            icon={<Users />}
            color="#ec4899"
            loading={loadingSummary}
            subtitle="Enrolled"
          />
          <StatCard
            title="Submissions"
            value={totalSubmissions}
            icon={<TrendingUp />}
            color="#0ea5e9"
            loading={loadingSummary}
            subtitle="Total"
          />
          <StatCard
            title="Avg per Course"
            value={avgPerCourse}
            icon={<MessageCircle />}
            color="#10b981"
            loading={loadingSummary}
            subtitle="Submissions"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">

          {/* Left Column: Course Status & Submissions Trend */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status */}
            <div className="lms-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                  <ClipboardList size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Status</h3>
              </div>
              <Donut data={statusCounts} subtitle="Courses" size={140} />
            </div>

            {/* Recent Subs Preview */}
            <div className="lms-card p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Activity</h3>
                  <p className="text-xs text-slate-500 font-bold">Recent Submissions</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {loadingSubs ? (
                  <div className="text-center py-6 text-slate-400">Loading...</div>
                ) : recentSubs.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 italic">No recent activity</div>
                ) : (
                  recentSubs.map((s, i) => (
                    <div key={s.id || i} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[70%]">{s.student_name || s.studentName}</span>
                        <span className="text-[10px] font-medium text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate mb-2">{s.course_name}</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.verdict === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.verdict || 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Middle Column: Detailed Stats */}
          <div className="lg:col-span-1 xl:col-span-2 space-y-6">
            {/* Sparkline */}
            <div className="lms-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                    <TrendingUp size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Submission Trend</h3>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Last 9 Days</span>
              </div>
              <div className="h-[150px]">
                <AreaSpark points={areaTimeseries} height={150} color="#10b981" />
              </div>
            </div>

            {/* Students & Submissions Bar Lists */}
            <div className="lms-card p-6 min-h-[300px]">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Top Courses Performance</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-3 ml-1">Highest Submissions</h4>
                  <CourseBarList items={groupedSeries[0].values} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-3 ml-1">Highest Enrollment</h4>
                  <CourseBarList items={groupedSeries[1].values} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Messages & Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Messages */}
            <div className="lms-card p-6 flex flex-col h-[500px]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-pink-100 text-pink-600">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Messages</h3>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                {chats.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm">No new messages</div>
                ) : (
                  chats.map((chat, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 hover:border-pink-200 transition-colors cursor-pointer group" onClick={() => navigate(`/faculty/course/${chat.courseId}/chat`)}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-700 truncate">{chat.courseName}</span>
                        {chat.count > 0 && (
                          <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-pink-500 text-white text-[10px] font-bold rounded-full">
                            {chat.count}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 max-w-full">
                        {chat.lastMessage || 'No preview'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}
