import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Trash2, Edit, Plus, RefreshCw, BarChart2, Users, Folder, Code, Type,
  FileText, Terminal, CheckCircle, Search, X, Monitor, Cpu, Database, Globe, Hash, Layout, Download, Filter, AlertCircle
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/api';

const API_COURSES = '/courses/get-all-courses';
const API_FACULTIES_ALL = '/v1/users/faculties';
const API_FACULTIES_BY_COURSE = '/v1/users/faculties/course';

// Programming languages mapping
const PROGRAMMING_LANGUAGES = [
  { id: 62, name: 'Java', icon: Monitor },
  { id: 63, name: 'JavaScript', icon: Code },
  { id: 71, name: 'Python', icon: Terminal },
  { id: 54, name: 'C++', icon: Code },
  { id: 50, name: 'C', icon: Code },
  { id: 51, name: 'C#', icon: Hash },
  { id: 72, name: 'Ruby', icon: Code },
  { id: 73, name: 'Go', icon: Code },
  { id: 74, name: 'TypeScript', icon: Code },
  { id: 82, name: 'SQL', icon: Database }
];

// --- Reusable Components (Tailwind) ---

const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar">
            {children}
          </div>
          {footer && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Spinner = ({ size = "md", color = "indigo" }) => {
  const sizeClasses = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  const colorClasses = { indigo: "text-indigo-600", white: "text-white" };
  return (
    <svg className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
};

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-rose-500' : 'bg-amber-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 text-white font-medium ${bgClass}`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="opacity-80 hover:opacity-100"><X size={16} /></button>
    </motion.div>
  );
};

export default function AdminQuestionBanks() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [pageError, setPageError] = useState('');

  // Dialog states
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingQ, setEditingQ] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    sample_input: '',
    sample_output: '',
    language_id: 62,
    score: 100,
    faculty_id: ''
  });

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  useEffect(() => {
    loadCourses();
    loadFaculties();
  }, []);

  useEffect(() => {
    if (!courseId) {
      setQuestions([]);
      setFaculties([]);
      setPageError('');
      return;
    }
    const doLoad = async (cid) => {
      const loadedFaculties = await loadFaculties(cid);
      await loadQuestions(cid, loadedFaculties);
    };
    doLoad(courseId);
  }, [courseId]);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get(API_COURSES);
      setCourses(res.data?.courses || []);
      setPageError('');
    } catch (err) {
      setCourses([]);
      setPageError(err?.response?.data?.message || 'Failed to load courses.');
    }
  };

  const loadFaculties = async (cid) => {
    try {
      const url = cid ? `${API_FACULTIES_BY_COURSE}/${cid}` : API_FACULTIES_ALL;
      const res = await apiClient.get(url);
      const raw = res.data?.faculties ?? res.data ?? [];
      const list = Array.isArray(raw) ? raw : (raw.faculties || raw.items || []);
      const normalized = (list || []).map(f => ({ ...f, id: Number(f.id) }));
      setFaculties(normalized);
      return normalized;
    } catch (err) {
      setFaculties([]);
      return [];
    }
  };

  const resolveFacultyName = (q, localFaculties) => {
    if (q && q.faculty) return q.faculty.name || q.faculty.fullname || q.faculty.username;
    if (q && q.faculty_user) return q.faculty_user.name || q.faculty_user.fullname || q.faculty_user.username;
    if (q && q.faculty_name) return q.faculty_name;
    if (q && q.created_by_name) return q.created_by_name;
    if (q && (q.faculty_id !== undefined && q.faculty_id !== null)) {
      const found = (localFaculties || []).find(x => Number(x.id) === Number(q.faculty_id));
      if (found) return found.name || found.fullname || found.email || String(found.id);
    }
    if (q && (q.faculty_id === null || q.faculty_id === undefined)) return 'Admin';
    return (q && q.faculty_id) ? String(q.faculty_id) : 'Unknown';
  };

  const getLanguageName = (languageId) => {
    return PROGRAMMING_LANGUAGES.find(lang => lang.id === languageId)?.name || 'Unknown';
  };

  const loadQuestions = async (cid, localFaculties = faculties) => {
    setLoading(true);
    setQuestions([]);
    try {
      const res = await apiClient.get(`/questions/admin/bank/${cid}?includeBatches=1`);
      const qs = res.data?.questions || [];
      const normalized = qs.map(q => ({
        ...q,
        faculty_name: resolveFacultyName(q, localFaculties),
        language_name: getLanguageName(q.language_id),
        toggle_count: (q.enabled_batches?.length) || (q.batch_states ? Object.keys(q.batch_states).length : 0),
        createdAt: q.createdAt || q.created_at,
        updatedAt: q.updatedAt || q.updated_at,
      }));
      setQuestions(normalized);
      setPageError('');
    } catch (err) {
      setPageError(err?.response?.data?.message || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    await loadCourses();
    if (!courseId) {
      setQuestions([]);
      await loadFaculties();
      return;
    }
    const loadedFaculties = await loadFaculties(courseId);
    await loadQuestions(courseId, loadedFaculties);
  };

  const openCreateDialog = () => {
    if (!courseId) return showToast('Select course first', 'warning');
    setForm({
      title: '', description: '', sample_input: '', sample_output: '',
      language_id: 62, score: 100, faculty_id: ''
    });
    setOpenCreate(true);
  };

  const handleCreate = async () => {
    if (!form.title) return showToast('Title required', 'error');
    setSaving(true);
    try {
      const payload = {
        ...form,
        course_id: courseId,
        faculty_id: form.faculty_id || undefined,
        duration: form.duration || 10
      };
      await apiClient.post('/questions/admin/add', payload);
      await loadQuestions(courseId, faculties);
      showToast('Question created', 'success');
      setOpenCreate(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Create failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (q) => {
    setEditingQ(q);
    setForm({
      title: q.title || '', description: q.description || '',
      sample_input: q.sample_input || '', sample_output: q.sample_output || '',
      language_id: q.language_id || 62, score: q.score || 100,
      faculty_id: q.faculty_id ?? ''
    });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingQ) return;
    setSaving(true);
    try {
      await apiClient.put(`/questions/admin/update/${editingQ.id}`, form);
      showToast('Question updated', 'success');
      setOpenEdit(false);
      setEditingQ(null);
      await loadQuestions(courseId, faculties);
    } catch (err) {
      showToast('Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await apiClient.delete(`/questions/admin/delete/${id}`);
      showToast('Question deleted', 'success');
      await loadQuestions(courseId, faculties);
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  // Form Content Renderer
  const renderFormContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 space-y-1">
        <label className="block text-sm font-bold text-slate-700">Title <span className="text-red-500">*</span></label>
        <div className="relative">
          <Type className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Array Summation"
          />
        </div>
      </div>

      <div className="md:col-span-2 space-y-1">
        <label className="block text-sm font-bold text-slate-700">Description</label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 text-slate-400" size={16} />
          <textarea
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px]"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Detailed problem statement..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">Language</label>
        <div className="relative">
          <Code className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <select
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none"
            value={form.language_id}
            onChange={e => setForm({ ...form, language_id: Number(e.target.value) })}
          >
            {PROGRAMMING_LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">Score</label>
        <div className="relative">
          <BarChart2 className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="number"
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            value={form.score}
            onChange={e => setForm({ ...form, score: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">Sample Input</label>
        <div className="relative">
          <Terminal className="absolute left-3 top-3 text-slate-400" size={16} />
          <textarea
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            value={form.sample_input}
            onChange={e => setForm({ ...form, sample_input: e.target.value })}
            placeholder="Input data..."
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-bold text-slate-700">Sample Output</label>
        <div className="relative">
          <Terminal className="absolute left-3 top-3 text-slate-400" size={16} />
          <textarea
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            value={form.sample_output}
            onChange={e => setForm({ ...form, sample_output: e.target.value })}
            placeholder="Expected output..."
            rows={3}
          />
        </div>
      </div>

      <div className="md:col-span-2 space-y-1">
        <label className="block text-sm font-bold text-slate-700">Assign Faculty (Optional)</label>
        <div className="relative">
          <Users className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <select
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none"
            value={form.faculty_id}
            onChange={e => setForm({ ...form, faculty_id: e.target.value })}
          >
            <option value="">-- Admin (Unassigned) --</option>
            {faculties.map(f => (
              <option key={f.id} value={f.id}>{f.name || f.fullname || f.username}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="min-h-full bg-slate-50 relative">
        {/* Toast */}
        <AnimatePresence>
          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>

        <div className="px-4 md:px-8 pb-8 max-w-[1600px] mx-auto space-y-6">
          {pageError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Question bank data could not be loaded.</p>
                <p className="text-sm">{pageError}</p>
              </div>
            </div>
          )}

          {/* Header Card */}
          <div className="lms-card p-6">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r bg-blue-600"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg transform transition-transform">
                  <Database className="text-white" size={40} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-1">Question Bank</h1>
                  <p className="text-slate-500 font-medium text-lg">Manage coding questions and evaluation criteria</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={refreshData}
                  className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Filter size={16} className="text-slate-400" />
                </div>
              </div>

              {questions.length > 0 && (
                <span className="hidden md:inline-flex px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100 items-center gap-1">
                  <Folder size={14} /> {questions.length} Questions
                </span>
              )}
            </div>

            <button
              onClick={openCreateDialog}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r bg-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              disabled={!courseId}
            >
              <Plus size={20} />
              Add Question
            </button>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
            {loading ? (
              <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-slate-400">
                <Spinner size="lg" />
                <p className="font-medium animate-pulse">Loading questions...</p>
              </div>
            ) : !courseId ? (
              <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-slate-300">
                <div className="w-32 h-32 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <Layout size={64} className="opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-slate-400">No Course Selected</h3>
                <p className="text-slate-400">Please select a course from the dropdown above.</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="h-[500px] flex flex-col items-center justify-center gap-4 text-slate-400">
                <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mb-2 text-indigo-300">
                  <Code size={48} />
                </div>
                <h3 className="text-xl font-bold text-slate-600">No Questions Found</h3>
                <p className="text-slate-500 max-w-sm text-center">Get started by creating the first question for this course bank.</p>
                <button onClick={openCreateDialog} className="mt-4 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-colors">
                  Create First Question
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-200">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4 w-1/3">Description</th>
                      <th className="px-6 py-4 text-center">Lang</th>
                      <th className="px-6 py-4 text-center">Score</th>
                      <th className="px-6 py-4">Faculty</th>
                      <th className="px-6 py-4 text-center">Usage</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questions.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">#{q.id}</td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-700 block">{q.title}</span>
                          <span className="text-xs text-slate-400">{new Date(q.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-500 line-clamp-2" title={q.description}>{q.description}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200 inline-flex items-center gap-1">
                            {q.language_name === 'Java' && <Monitor size={10} />}
                            {q.language_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
                            {q.score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-indigo-600">
                          {q.faculty_name}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {q.toggle_count > 0 ? (
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold">
                              {q.toggle_count} Batches
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditDialog(q)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(q.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Add Question"
        footer={
          <>
            <button onClick={() => setOpenCreate(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
              {saving && <Spinner size="sm" color="white" />}
              Create
            </button>
          </>
        }
      >
        {renderFormContent()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={openEdit}
        onClose={() => setOpenEdit(false)}
        title="Edit Question"
        footer={
          <>
            <button onClick={() => setOpenEdit(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleUpdate} disabled={saving} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2">
              {saving && <Spinner size="sm" color="white" />}
              Save Changes
            </button>
          </>
        }
      >
        {renderFormContent()}
      </Modal>

    </AdminLayout>
  );
}
