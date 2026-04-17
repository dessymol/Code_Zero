import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, BarChart2, Search, Printer, Calendar, Hash, Mail,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Download, Filter,
  ArrowLeft, FileText, Code, Globe, User
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import FacultyNavbar from './FacultyNavbar';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:3000/api';

const formatDateKey = (iso) => {
  if (!iso) return 'Unknown Date';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown Date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// --- Reusable Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <XCircle size={20} />
            </button>
          </div>
          <div className="p-0 overflow-y-auto custom-scrollbar bg-slate-50">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const StatusBadge = ({ status }) => {
  const s = (status || '').toLowerCase();
  if (s === 'success' || s === 'accepted' || s === 'passed') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Accepted</span>;
  if (s === 'error' || s === 'failed' || s === 'rejected') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200"><XCircle size={12} /> Failed</span>;
  if (s === 'pending') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200"><Clock size={12} /> Pending</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{status}</span>;
};

const ScoreBadge = ({ score }) => {
  const num = Number(score);
  let colorClass = 'bg-rose-100 text-rose-700 border-rose-200';
  if (num >= 90) colorClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (num >= 70) colorClass = 'bg-amber-100 text-amber-700 border-amber-200';
  else if (num >= 50) colorClass = 'bg-orange-100 text-orange-700 border-orange-200';

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
      {score} pts
    </span>
  );
};

export default function FacultyEvaluate() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [batches, setBatches] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [courseInfo, setCourseInfo] = useState({ id: courseId, name: '', course_code: '' });

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'unassigned', or batchId

  // Scores Modal
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [scoreBatch, setScoreBatch] = useState(null);
  const [scoreRows, setScoreRows] = useState([]);
  const [scoreLoading, setScoreLoading] = useState(false);

  useEffect(() => {
    if (courseId) fetchBatchesAndSubmissions();
  }, [courseId]);

  const fetchBatchesAndSubmissions = async () => {
    setLoading(true);
    try {
      // 1. Batches
      const bRes = await axios.get(`${API}/students/batches/${courseId}`, { headers });
      const bList = (bRes.data?.batches || []).map(b => ({
        id: b.id, name: b.name, code: b.code, count: b.studentCount ?? b.count
      }));
      setBatches(bList);

      // 2. Submissions
      const sRes = await axios.get(`${API}/submissions/faculty/course/${courseId}`, { headers });
      const raw = sRes.data?.submissions || [];
      const course = sRes.data?.course || {};

      setCourseInfo({
        id: course.id || courseId,
        name: course.name || '',
        course_code: course.course_code || ''
      });

      setAllSubmissions(raw);
    } catch (err) {
      setError('Failed to load data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  // Grouping Logic
  const filteredSubmissions = useMemo(() => {
    if (activeTab === 'all') return allSubmissions;
    if (activeTab === 'unassigned') {
      return allSubmissions.filter(s => {
        const sbs = s.student_batches || s.Student?.Batches || [];
        return !sbs.length;
      });
    }
    return allSubmissions.filter(s => {
      const sbs = s.student_batches || s.Student?.Batches || [];
      return sbs.some(b => String(b.id || b) === String(activeTab));
    });
  }, [allSubmissions, activeTab]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredSubmissions.forEach(s => {
      const d = formatDateKey(s.createdAt);
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    // Sort dates desc
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [filteredSubmissions]);

  // Batch Stats
  const batchStats = useMemo(() => {
    const stats = { total: allSubmissions.length, unassigned: 0, batches: {} };
    allSubmissions.forEach(s => {
      const sbs = s.student_batches || s.Student?.Batches || [];
      if (!sbs.length) stats.unassigned++;
      else sbs.forEach(b => {
        const bid = b.id || b;
        stats.batches[bid] = (stats.batches[bid] || 0) + 1;
      });
    });
    return stats;
  }, [allSubmissions]);

  const openScores = async (batch) => {
    setScoreBatch(batch);
    setScoreModalOpen(true);
    setScoreLoading(true);
    try {
      const batchSubs = allSubmissions.filter(s =>
        (s.student_batches || s.Student?.Batches || []).some(b => String(b.id || b) === String(batch.id))
      );

      const totals = {};
      batchSubs.forEach(s => {
        const sid = s.student_id ?? s.Student?.id;
        if (!sid) return;
        if (!totals[sid]) totals[sid] = {
          id: sid,
          name: s.student_name ?? s.Student?.name ?? 'Unknown',
          email: s.student_email ?? s.Student?.email,
          total: 0
        };
        totals[sid].total += Number(s.score || 0);
      });

      setScoreRows(Object.values(totals).sort((a, b) => b.total - a.total));
    } catch (e) {
      setScoreRows([]);
    } finally {
      setScoreLoading(false);
    }
  };

  return (
    <>
      <FacultyNavbar />
      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container py-6 space-y-5">

          {/* Header */}
          <div className="lms-card p-5 border-l-4 border-l-purple-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button onClick={() => navigate('/faculty/view-submissions')}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0">
                <ArrowLeft size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-slate-900 truncate">{courseInfo.name || 'Loading…'}</h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {courseInfo.course_code && (
                    <span className="lms-badge lms-badge-purple font-mono text-xs">{courseInfo.course_code}</span>
                  )}
                  <span className="text-sm text-slate-500">Manage Submissions & Grades</span>
                </div>
              </div>
              <button onClick={fetchBatchesAndSubmissions} disabled={loading}
                className="lms-btn-secondary gap-2 h-9 px-3 text-sm shrink-0">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-3 py-2 custom-scrollbar">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border ${activeTab === 'all' ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{batchStats.total}</span>
              All Submissions
            </button>

            {batches.map(b => (
              <div key={b.id} className="relative group">
                <button
                  onClick={() => setActiveTab(String(b.id))}
                  className={`flex items-center gap-2 px-5 py-2.5 pr-12 rounded-xl font-bold whitespace-nowrap transition-all border ${String(activeTab) === String(b.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${String(activeTab) === String(b.id) ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{batchStats.batches[b.id] || 0}</span>
                  {b.code || b.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openScores(b); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-black/10 text-current transition-colors opacity-60 hover:opacity-100"
                  title="View Batch Scores"
                >
                  <BarChart2 size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setActiveTab('unassigned')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border ${activeTab === 'unassigned' ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${activeTab === 'unassigned' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{batchStats.unassigned}</span>
              Unassigned
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="lms-card flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading submissions…</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="lms-card flex flex-col items-center justify-center py-20 border-dashed">
              <FileText className="text-slate-300 mb-4" size={64} />
              <h3 className="text-xl font-bold text-slate-600">No Submissions Found</h3>
              <p className="text-slate-400">There are no submissions for this selection.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(([date, dateSubs]) => (
                <div key={date} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-700">
                      <Calendar size={18} className="text-indigo-600" />
                      {date}
                    </div>
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-500">
                      {dateSubs.length} Submissions
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dateSubs.map(s => (
                      <div key={s.id} className="p-4 rounded-xl border border-slate-100 hover:border-indigo-200 bg-white hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                              {s.student_name?.[0] || 'S'}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{s.student_name || 'Unknown'}</h4>
                              <p className="text-xs text-slate-500">{s.student_email}</p>
                            </div>
                          </div>
                          <ScoreBadge score={s.score} />
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Code size={16} className="text-indigo-500" />
                            <span className="truncate flex-1" title={s.question_title}>{s.question_title}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded border border-slate-200">
                              Lang: {s.language_id}
                            </span>
                            <StatusBadge status={s.status} />
                          </div>
                        </div>

                        {s.output && (
                          <div className="bg-slate-900 rounded-lg p-3 relative group/code">
                            <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Output</div>
                            </div>
                            <pre className="text-xs text-emerald-400 font-mono overflow-x-auto custom-scrollbar max-h-24">
                              {s.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scores Modal */}
      <Modal isOpen={scoreModalOpen} onClose={() => setScoreModalOpen(false)} title={`Batch Scores: ${scoreBatch?.code || 'View'}`}>
        {scoreLoading ? (
          <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-indigo-600" size={32} /></div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold sticky top-0">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {scoreRows.map((r, i) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 font-mono text-slate-400 font-bold">#{i + 1}</td>
                  <td className="px-6 py-3">
                    <p className="font-bold text-slate-700 text-sm">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.email}</p>
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-indigo-600">{r.total}</td>
                </tr>
              ))}
              {scoreRows.length === 0 && (
                <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-400">No scores recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Modal>

    </>
  );
}