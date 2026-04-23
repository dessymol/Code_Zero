import React, { useEffect, useState, useMemo } from 'react';
import {
  Download, FileText, RefreshCw, Filter, Folder,
  ChevronRight, BarChart2, Layers, Code, FileSpreadsheet
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import FacultyNavbar from './FacultyNavbar';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:3000/api';

// --- Reusable Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <Filter size={20} className="rotate-45" />
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

export default function FacultyReports() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [activeCourse, setActiveCourse] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [viewMode, setViewMode] = useState(null); // 'name' or 'code'
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/courses/faculty-courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(res.data.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = async (course, mode) => {
    setActiveCourse(course);
    setViewMode(mode);
    setLoadingBatches(true);
    setBatches([]);

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Try fetch detailed export batches first
      try {
        const res = await axios.get(`${API}/export/courses/${course.id}/batches`, { headers });
        let data = res.data?.batches ?? res.data?.data ?? [];
        setBatches(data);
      } catch (e) {
        // Fallback to basic batches
        const res2 = await axios.get(`${API}/students/batches/${course.id}`, { headers });
        let data = res2.data?.batches ?? [];
        setBatches(data.map(b => ({ ...b, subbatches: [] })));
      }
    } catch (err) {
      console.error('Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  const closeDialog = () => {
    setActiveCourse(null);
    setViewMode(null);
    setBatches([]);
  };

  const handleDownload = async (url, filename) => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename || 'report.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Grouping logic for 'View by Name'
  const groupedBatches = useMemo(() => {
    const groups = {};
    batches.forEach(b => {
      const key = b.name || 'Unnamed';
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    });
    return groups;
  }, [batches]);

  return (
    <>
      <FacultyNavbar />

      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container py-6 space-y-6">

          {/* Header */}
          <div className="lms-card p-5 border-l-4 border-l-purple-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center shadow-sm shrink-0">
                <BarChart2 size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">Analytics & Reports</h1>
                <p className="text-sm text-slate-500">Generate detailed Excel reports for your courses</p>
              </div>
              <button onClick={fetchCourses} className="lms-btn-secondary gap-2 h-9 px-3 text-sm shrink-0">
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* Courses Grid */}
          {loading ? (
            <div className="lms-card flex flex-col items-center justify-center py-20">
              <RefreshCw className="animate-spin text-indigo-600 mb-4" size={40} />
              <p className="text-slate-500 font-bold">Loading courses...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="lms-card flex flex-col items-center justify-center py-20 border-dashed">
              <FileText className="text-slate-300 mb-4" size={64} />
              <h3 className="text-xl font-bold text-slate-600">No Courses Available</h3>
              <p className="text-slate-400">You don't have any courses assigned for reporting.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map(course => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="h-1.5 w-full bg-purple-600"></div>
                  <div className="p-6 flex-1 flex flex-col text-center">
                    <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                      <FileSpreadsheet size={32} />
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-1">{course.name}</h3>
                    <p className="text-slate-400 font-mono text-sm font-bold mb-6">{course.course_code}</p>

                    <div className="mt-auto grid grid-cols-2 gap-3">
                      <button
                        onClick={() => openDialog(course, 'name')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                      >
                        <Layers size={18} /> By Group
                      </button>
                      <button
                        onClick={() => openDialog(course, 'code')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors border border-slate-200"
                      >
                        <Code size={18} /> By Code
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Selection Modal */}
      <Modal
        isOpen={!!activeCourse}
        onClose={closeDialog}
        title={viewMode === 'name' ? `Reports by Group: ${activeCourse?.name}` : `Reports by Batch Code: ${activeCourse?.name}`}
      >
        {loadingBatches ? (
          <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-indigo-600" size={32} /></div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Folder size={48} className="mx-auto mb-3 opacity-50" />
            <p>No batches found for this course.</p>
          </div>
        ) : viewMode === 'name' ? (
          // View by Name (Grouped)
          <div className="p-4 space-y-3">
            {Object.entries(groupedBatches).map(([name, group]) => {
              const totalSubs = group.reduce((sum, b) => sum + (b.submissionCount || 0), 0);
              return (
                <div key={name} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors shadow-sm">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-slate-700">{name}</h4>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-bold border border-slate-200">{group.length} Batches</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {group.map(b => b.code).filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(`${API}/export/courses/${activeCourse.id}/subbatches/combined`, `${name}_Report.xlsx`)}
                    disabled={downloading || totalSubs === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm shadow-md shadow-indigo-200"
                  >
                    {downloading ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          // View by Code (Individual)
          <div className="p-4 space-y-3">
            {batches.map(batch => (
              <div key={batch.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors shadow-sm">
                <div>
                  <h4 className="font-bold text-slate-700">{batch.code || batch.name || `Batch ${batch.id}`}</h4>
                  <p className="text-xs text-slate-400 mt-1">Files: {batch.submissionCount ?? 'N/A'}</p>
                </div>
                <button
                  onClick={() => handleDownload(`${API}/export/batches/${batch.id}/export`, `${batch.code || 'Batch'}_Report.xlsx`)}
                  disabled={downloading || batch.submissionCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-lg font-bold hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {downloading ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                  Export
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>

    </>
  );
}