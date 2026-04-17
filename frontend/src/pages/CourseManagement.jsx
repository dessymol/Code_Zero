import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Filter, Download, RefreshCw, Layers, Edit, Trash2,
  Users, CheckCircle, XCircle, MoreVertical, BookOpen, AlertCircle,
  ChevronLeft, ChevronRight, X, UserPlus, Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './AdminLayout';
import apiClient from '../services/api';

// --- API Endpoints ---
const API_COURSES = '/courses/getActiveandInactiveCourses';
const API_FACULTIES = '/v1/users/faculties';

// --- Components ---

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
          className="relative w-full max-w-xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
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

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-emerald-500' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-0'}`}
    />
  </button>
);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-rose-500' : 'bg-amber-500';
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 text-white font-bold ${bg}`}>
      <span>{message}</span>
      <button onClick={onClose}><X size={16} /></button>
    </motion.div>
  );
};

export default function CourseManagement() {
  // State
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [toast, setToast] = useState(null);
  const [pageError, setPageError] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);

  // Forms
  const [courseForm, setCourseForm] = useState({ name: '', course_code: '', description: '', is_active: true, allowed_violations: 3 });
  const [editingId, setEditingId] = useState(null);

  // Assign Faculty
  const [assignCourseId, setAssignCourseId] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // Fetch Data
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(API_COURSES);
      const payload = res.data || {};
      const all = Array.isArray(payload) ? payload : (Array.isArray(payload.courses) ? payload.courses : []);
      setCourses(all);
      setPageError('');
    } catch (err) {
      setCourses([]);
      setPageError(err?.response?.data?.message || 'Failed to load courses.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFaculties = async () => {
    try {
      const res = await apiClient.get(API_FACULTIES);
      const list = (res.data?.faculties || []).map((f) => ({ ...f, id: Number(f.id) }));
      setFaculties(list);
      setPageError('');
    } catch (err) {
      setFaculties([]);
      console.warn('fetchFaculties', err);
    }
  };

  const refreshData = useCallback(() => {
    fetchCourses();
    fetchFaculties();
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Derived State
  const filteredCourses = courses.filter(c => {
    const matchesName = (c.name || '').toLowerCase().includes(nameFilter.toLowerCase());
    const matchesStatus = showInactive ? !c.is_active : !!c.is_active;
    return matchesName && matchesStatus;
  });

  // No pagination as per request
  const paginatedCourses = filteredCourses;
  // const totalPages = Math.ceil(filteredCourses.length / rowsPerPage); // Unused now

  // Handlers
  const handleAddCourse = async () => {
    try {
      await apiClient.post('/courses/create-course', {
        name: courseForm.name,
        course_code: courseForm.course_code,
        description: courseForm.description,
        is_active: !!courseForm.is_active,
        allowed_violations: Number(courseForm.allowed_violations ?? 3),
      });
      setOpenAdd(false);
      showToast('Course added successfully');
      fetchCourses();
    } catch (err) {
      showToast(err.response?.data?.message || 'Add failed', 'error');
    }
  };

  const handleEditCourse = async () => {
    try {
      await apiClient.put(`/courses/update-course/${editingId}`, {
        name: courseForm.name,
        course_code: courseForm.course_code,
        description: courseForm.description,
        is_active: !!courseForm.is_active,
        allowed_violations: Number(courseForm.allowed_violations ?? 3),
      });
      setOpenEdit(false);
      setEditingId(null);
      showToast('Course updated successfully');
      fetchCourses();
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      await apiClient.delete(`/courses/delete-course/${id}`);
      showToast('Course deleted', 'success');
      fetchCourses();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  const handleToggleStatus = async (course) => {
    const newStatus = !course.is_active;
    // Optimistic update
    setCourses(prev => prev.map(c => c.id === course.id ? { ...c, is_active: newStatus } : c));
    try {
      await apiClient.put(`/courses/update-course/${course.id}`, {
        is_active: newStatus,
        allowed_violations: course.allowed_violations
      });
      showToast(`Course ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      fetchCourses(); // revert
      showToast('Status update failed', 'error');
    }
  };

  const openAssignModal = async (course) => {
    setAssignCourseId(course.id);
    setSelectedFacultyIds([]);
    setOpenAssign(true);
    try {
      const res = await apiClient.get(`/courses/${course.id}/with-faculties`);
      const current = (res.data?.course?.Faculties || []).map((f) => Number(f.id));
      setSelectedFacultyIds(current);
    } catch (err) { }
  };

  const handleAssignSave = async () => {
    try {
      await apiClient.post(`/courses/${assignCourseId}/assign-faculties`, { facultyIds: selectedFacultyIds });
      setOpenAssign(false);
      showToast('Faculties assigned successfully');
    } catch (err) {
      showToast('Assignment failed', 'error');
    }
  };

  const toggleFacultySelection = (fid) => {
    setSelectedFacultyIds(prev => prev.includes(fid) ? prev.filter(id => id !== fid) : [...prev, fid]);
  };

  // Render Helpers
  const renderCourseForm = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Course Name</label>
        <input className="lms-input" value={courseForm.name} onChange={e => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="e.g. Data Structures" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Course Code</label>
        <input className="lms-input" value={courseForm.course_code} onChange={e => setCourseForm({ ...courseForm, course_code: e.target.value })} placeholder="e.g. CS101" />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
        <textarea className="w-full px-3.5 py-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 min-h-[100px]" value={courseForm.description} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Course details..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Allowed Violations</label>
          <input type="number" className="lms-input" value={courseForm.allowed_violations} onChange={e => setCourseForm({ ...courseForm, allowed_violations: e.target.value })} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <ToggleSwitch checked={courseForm.is_active} onChange={v => setCourseForm({ ...courseForm, is_active: v })} />
          <span className="text-sm font-bold text-slate-700">Active Course</span>
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout disableScroll={true}>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
        <AnimatePresence>
          {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        </AnimatePresence>

        {/* Fixed Header & Controls Section */}
        <div className="flex-none px-4 md:px-8 py-6 space-y-6 bg-slate-50 z-10">
          <div className="lms-container space-y-6">
            {pageError && (
              <div className="lms-card border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-start gap-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Course data is unavailable right now.</p>
                  <p className="text-sm">{pageError}</p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="lms-card p-6 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center">
                    <BookOpen size={26} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Course Management</h1>
                    <p className="text-slate-500">Create, assign and manage academic courses</p>
                  </div>
                </div>
                <button
                  onClick={refreshData}
                  className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="lms-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => { setShowInactive(false); setPage(0); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!showInactive ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Active Courses
                </button>
                <button
                  onClick={() => { setShowInactive(true); setPage(0); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${showInactive ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Inactive
                </button>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    className="lms-input pl-10 pr-4"
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => {
                    setCourseForm({ name: '', course_code: '', description: '', is_active: true, allowed_violations: 3 });
                    setOpenAdd(true);
                  }}
                  className="lms-btn-primary"
                >
                  <Plus size={20} />
                  Add Course
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="lms-container pb-8">
            {/* Table */}
            <div className="lms-card min-h-[500px] flex flex-col">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                  <RefreshCw className="animate-spin mb-4" size={40} />
                  <p>Loading courses...</p>
                </div>
              ) : paginatedCourses.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                  <Layers size={64} className="opacity-20 mb-4" />
                  <h3 className="text-xl font-bold text-slate-500">No courses found</h3>
                  <p className="text-sm">Try adjusting your filters or add a new course.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 bg-slate-50">Status</th>
                          <th className="px-6 py-4 bg-slate-50">Code</th>
                          <th className="px-6 py-4 bg-slate-50">Name</th>
                          <th className="px-6 py-4 bg-slate-50">Violations</th>
                          <th className="px-6 py-4 bg-slate-50">Date Added</th>
                          <th className="px-6 py-4 text-right bg-slate-50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedCourses.map(course => (
                          <tr key={course.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleToggleStatus(course)}
                                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit transition-all ${course.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                              >
                                {course.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                {course.is_active ? 'Active' : 'Inactive'}
                              </button>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm text-slate-500">{course.course_code || '-'}</td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-700 block">{course.name}</span>
                              <span className="text-xs text-slate-400 truncate max-w-[200px] block" title={course.description}>{course.description}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-medium">
                              {course.allowed_violations}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-400">
                              {new Date(course.createdAt || Date.now()).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openAssignModal(course)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="Assign Faculty"><UserPlus size={18} /></button>
                                <button onClick={() => { setEditingId(course.id); setCourseForm({ ...course, is_active: !!course.is_active }); setOpenEdit(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><Edit size={18} /></button>
                                <button onClick={() => handleDelete(course.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg" title="Delete"><Trash2 size={18} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {/* <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50 sticky bottom-0 z-10">
                    <span className="text-sm text-slate-500 font-medium">Page {page + 1} of {totalPages || 1}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border rounded-lg hover:bg-white disabled:opacity-50"><ChevronLeft size={20} /></button>
                      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-2 border rounded-lg hover:bg-white disabled:opacity-50"><ChevronRight size={20} /></button>
                    </div>
                  </div> */}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal isOpen={openAdd} onClose={() => setOpenAdd(false)} title="Add New Course"
        footer={<><button onClick={() => setOpenAdd(false)} className="lms-btn-secondary">Cancel</button><button onClick={handleAddCourse} className="lms-btn-primary">Create Course</button></>}>
        {renderCourseForm()}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={openEdit} onClose={() => setOpenEdit(false)} title="Edit Course"
        footer={<><button onClick={() => setOpenEdit(false)} className="lms-btn-secondary">Cancel</button><button onClick={handleEditCourse} className="lms-btn-primary">Save Changes</button></>}>
        {renderCourseForm()}
      </Modal>

      {/* Assign Modal */}
      <Modal isOpen={openAssign} onClose={() => setOpenAssign(false)} title="Assign Faculty"
        footer={<><button onClick={() => setOpenAssign(false)} className="lms-btn-secondary">Cancel</button><button onClick={handleAssignSave} className="lms-btn-primary">Save Assignments</button></>}>
        <div className="space-y-4">
          {faculties.length === 0 && <p className="text-slate-500">No faculties found.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
            {faculties.map(f => {
              const isSelected = selectedFacultyIds.includes(f.id);
              return (
                <div key={f.id} onClick={() => toggleFacultySelection(f.id)} className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${isSelected ? 'bg-indigo-600' : 'bg-slate-400'}`}>
                    {f.name?.[0] || 'U'}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{f.name}</p>
                    <p className="text-xs text-slate-500">{f.email}</p>
                  </div>
                  {isSelected && <CheckCircle size={16} className="ml-auto text-indigo-600" />}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

    </AdminLayout>
  );
}
