import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import StudentNavbar from './StudentNavbar';
import { useSearchParams } from 'react-router-dom';
import {
  RefreshCw, BookOpen, Download, AlertCircle, CheckCircle,
  XCircle, Clock, Calendar, Filter, Hash
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

const API_SUBMISSIONS = 'http://localhost:3000/api/submissions/mine';
const API_EXPORT_MY = 'http://localhost:3000/api/export/students/me/submissions/export';

const StatusBadge = ({ status }) => {
  const s = (status || '').toLowerCase();

  if (s === 'accepted' || s === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle size={12} /> Accepted
      </span>
    );
  }
  if (s === 'rejected' || s === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
        <XCircle size={12} /> Failed
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
        <Clock size={12} /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
      {status || 'Unknown'}
    </span>
  );
};

export default function StudentSubmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') || '');
  const [exporting, setExporting] = useState(false);

  // ---------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(API_SUBMISSIONS, { headers });
        const payload = res?.data ?? {};
        let arr = [];
        if (Array.isArray(payload)) arr = payload;
        else if (Array.isArray(payload.submissions)) arr = payload.submissions;
        else if (Array.isArray(payload.data)) arr = payload.data;
        else if (Array.isArray(payload.items)) arr = payload.items;

        const normalized = arr.map((s) => ({
          id: s.id ?? s._id ?? s.submission_id ?? null,
          question_title: s.question_title ?? s.question?.title ?? s.Question?.title ?? s.questionTitle ?? '-',
          course: (s.course && {
            id: s.course.id ?? s.course.course_id ?? s.course._id,
            name: s.course.name,
          }) || (s.Question && s.Question.Course && {
            id: s.Question.Course.id ?? s.Question.Course._id ?? s.Question.Course.course_id,
            name: s.Question.Course.name,
          }) || null,
          status: s.status ?? s.state ?? null,
          score: s.score ?? s.marks ?? null,
          createdAt: s.createdAt ?? s.created_at ?? s.created_at_date ?? s.created_on ?? null,
          raw: s,
        }));
        const sorted = normalized.slice().sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        if (mounted) setSubmissions(sorted);
      } catch (err) {
        setError('Failed to load submissions');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // ---------------------------------------------------------------------
  // Helper data
  // ---------------------------------------------------------------------
  const courses = useMemo(() => {
    const map = new Map();
    submissions.forEach((s) => {
      const id = s.course?.id ?? s.raw?.Question?.Course?.id ?? s.raw?.course?.id;
      const name = s.course?.name ?? s.raw?.Question?.Course?.name ?? s.raw?.course?.name;
      if (id || name) {
        const key = id ?? name;
        if (!map.has(key)) map.set(key, { id: id ?? name, name: name ?? String(id) });
      }
    });
    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [submissions]);

  const filtered = useMemo(() => {
    if (!selectedCourseId) return [];
    return submissions.filter((s) => {
      const id = s.course?.id ?? s.raw?.Question?.Course?.id ?? s.raw?.course?.id ?? s.course?.name ?? '';
      return String(id) === String(selectedCourseId);
    });
  }, [submissions, selectedCourseId]);

  const groupedFiltered = useMemo(() => {
    const acc = {};
    filtered.forEach((item) => {
      const d = item.createdAt ? new Date(item.createdAt) : new Date();
      if (isNaN(d.getTime())) return;
      const iso = d.toISOString().slice(0, 10);
      const display = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[iso]) acc[iso] = { display, items: [] };
      acc[iso].items.push(item);
    });
    return acc;
  }, [filtered]);

  const dateKeys = useMemo(() => Object.keys(groupedFiltered).sort((a, b) => new Date(b) - new Date(a)), [groupedFiltered]);
  const selectedCourse = useMemo(() => courses.find((c) => String(c.id) === String(selectedCourseId)), [courses, selectedCourseId]);

  useEffect(() => {
    if (!courses.length) return;
    if (!selectedCourseId) return;
    const hasSelected = courses.some((c) => String(c.id) === String(selectedCourseId));
    if (!hasSelected) setSelectedCourseId('');
  }, [courses, selectedCourseId]);

  // ---------------------------------------------------------------------
  // Export handling
  // ---------------------------------------------------------------------
  const handleExport = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const params = {};
      if (selectedCourseId) params.courseId = selectedCourseId;

      const resp = await axios.get(API_EXPORT_MY, { headers, params, responseType: 'blob', timeout: 30000 });
      let filename = 'my_submissions.xlsx';

      const blob = new Blob([resp.data], { type: resp.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="lms-page-bg min-h-screen flex flex-col">
      <StudentNavbar />
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Loading submissions...</p>
      </div>
    </div>
  );

  return (
    <div className="lms-page-bg min-h-screen pb-12">
      <StudentNavbar />

      <div className="lms-container pt-6">
        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="lms-card p-5 mb-6 border-l-4 border-l-emerald-600">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <Hash size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">My Submissions</h1>
              <p className="text-sm text-slate-500">Track your coding journey and review past solutions</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    const nextCourseId = e.target.value;
                    setSelectedCourseId(nextCourseId);
                    if (nextCourseId) {
                      setSearchParams({ courseId: nextCourseId });
                    } else {
                      setSearchParams({});
                    }
                  }}
                  className="lms-input pl-9 text-sm appearance-none cursor-pointer"
                >
                  <option value="">— Select Course —</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || !selectedCourseId}
                className="lms-btn-secondary gap-2 h-9 px-3 text-sm disabled:opacity-50"
              >
                {exporting ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>

        {/* Course Stats / Selected Info */}
        <AnimatePresence mode="wait">
          {selectedCourse && (
            <div className="lms-card p-4 mb-5 border-l-4 border-l-emerald-600 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{selectedCourse.name}</h3>
                <p className="text-xs text-slate-500">{filtered.length} submission{filtered.length !== 1 ? 's' : ''} in this course</p>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Content */}
        {!selectedCourseId ? (
          <div className="lms-card flex flex-col items-center justify-center py-16 border-dashed text-slate-400">
            <BookOpen size={64} className="mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-500">No Course Selected</h3>
            <p>Please select a course from the dropdown to view submissions.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="lms-card flex flex-col items-center justify-center py-16 border-dashed text-slate-400">
            <AlertCircle size={64} className="mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-slate-500">No Submissions Yet</h3>
            <p>Start solving problems to see your history here!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {dateKeys.map((dateKey) => (
              <div key={dateKey} className="lms-card overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-slate-700">{groupedFiltered[dateKey].display}</h3>
                  <span className="ml-auto text-xs font-bold px-2 py-1 bg-white rounded-md border border-slate-200 text-slate-500">
                    {groupedFiltered[dateKey].items.length} Submissions
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase font-bold text-slate-400 bg-white">
                        <th className="px-6 py-3 w-16 text-center">#</th>
                        <th className="px-6 py-3">Problem Title</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-center">Score</th>
                        <th className="px-6 py-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {groupedFiltered[dateKey].items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group cursor-default">
                          <td className="px-6 py-4 text-center text-sm text-slate-400 font-mono">
                            {(idx + 1).toString().padStart(2, '0')}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-700">{item.question_title}</p>
                            <p className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">{item.course?.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`font-mono font-bold ${item.score === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {item.score ?? '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-slate-400 font-mono">
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
