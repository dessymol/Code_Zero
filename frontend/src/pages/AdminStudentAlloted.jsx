// src/pages/AdminStudentAlloted.jsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Users, Mail, Phone, User, RefreshCw, Download, GraduationCap, Layers, Search, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { motion } from 'framer-motion';

const API_STUDENTS = 'http://localhost:3000/api/students';
const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#4f46e5','#db2777'];

export default function AdminStudentAlloted() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(searchParams.get('batchId') || '');
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get(`${API_STUDENTS}/batches/${courseId}`)
      .then(r => setBatches(r.data?.batches || []))
      .catch(() => setBatches([]));
  }, [courseId]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const url = selectedBatch
        ? `${API_STUDENTS}/batch/${selectedBatch}`
        : `${API_STUDENTS}/by-course/${courseId}`;
      const r = await axios.get(url);
      setStudents(r.data?.students || []);
    } catch { setStudents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStudents(); }, [courseId, selectedBatch]);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return (s.name||'').toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q);
  });

  const exportCSV = () => {
    const rows = [['#','Name','Email','Phone','Batch'],
      ...students.map((s,i) => [i+1, s.name||'', s.email||'', s.phone||'', s.Batch?.name||'All'])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `students-course-${courseId}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5 text-sm">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium">
            <ArrowLeft size={15} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Course #{courseId}</span>
          <span className="text-slate-300">/</span>
          <span className="text-blue-600 font-semibold">Students</span>
        </div>

        {/* Page Header */}
        <div className="lms-card p-5 mb-6 border-l-4 border-l-cyan-600">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-900">Enrolled Students</h1>
              <p className="text-sm text-slate-500">Course #{courseId} · {students.length} student{students.length !== 1 ? 's' : ''} total</p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <button onClick={exportCSV} disabled={students.length === 0} className="lms-btn-secondary gap-2 h-9 px-3 text-sm disabled:opacity-50">
                <Download size={14} /> Export CSV
              </button>
              <button onClick={loadStudents} disabled={loading} className="lms-btn-secondary gap-2 h-9 px-3 text-sm">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Students', value: students.length, color: 'text-cyan-600', bg: 'bg-cyan-50', icon: Users },
            { label: 'Total Batches', value: batches.length, color: 'text-purple-600', bg: 'bg-purple-50', icon: Layers },
            { label: 'With Phone', value: students.filter(s => s.phone).length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Phone },
            { label: 'Search Results', value: filtered.length, color: 'text-amber-600', bg: 'bg-amber-50', icon: Search },
          ].map((s, i) => (
            <div key={i} className="lms-card p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 font-medium">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="lms-card p-4 mb-5 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input type="text" placeholder="Search students by name or email…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="lms-input pl-9 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative sm:w-56">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
            <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
              className="lms-input pl-9 text-sm appearance-none">
              <option value="">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} — {b.code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="lms-card overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading students…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <GraduationCap size={28} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">
                {search ? 'No Matching Students' : 'No Students Found'}
              </h3>
              <p className="text-sm text-slate-500 max-w-xs">
                {search ? 'Try a different search term.' : 'No students are enrolled in this course yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Student</th>
                    <th>Contact</th>
                    <th>Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <motion.tr key={s.id || i}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}>
                      <td className="text-slate-400 font-bold text-xs">{i + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}>
                            {(s.name||'S').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{s.name || '—'}</div>
                            <div className="text-xs text-slate-400">ID: {s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-slate-700"><Mail size={13} className="text-slate-400 shrink-0" />{s.email||'—'}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone size={12} className="text-slate-400 shrink-0" />{s.phone||'No phone'}</div>
                        </div>
                      </td>
                      <td>
                        {s.Batch ? (
                          <span className="lms-badge lms-badge-blue gap-1"><Layers size={10} />{s.Batch.name} · {s.Batch.code}</span>
                        ) : s.batches?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.batches.map((b,bi) => (
                              <span key={bi} className="lms-badge lms-badge-blue text-[10px] font-mono">{b.code||b.name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="lms-badge lms-badge-gray">No batch</span>
                        )}
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
