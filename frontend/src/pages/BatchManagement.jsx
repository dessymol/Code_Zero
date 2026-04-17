import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Users, Search, Layers, Plus, RefreshCw,
  Trash2, Edit, X,
  ChevronRight, ArrowRight, AlertCircle
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import apiClient from '../services/api';

const API_COURSES = '/courses/get-all-courses';
const API_BASE = '/students';

const batchAPI = {
  getBatches: (courseId) => apiClient.get(`${API_BASE}/batchmanagement/${courseId}`),
  getBatchStudents: (batchId) => apiClient.get(`${API_BASE}/batch/${batchId}`),
  createBatch: (courseId, data) => apiClient.post(`${API_BASE}/batches/${courseId}`, data),
  updateBatch: (batchId, data) => apiClient.put(`${API_BASE}/batches/${batchId}`, data),
  deleteBatch: (batchId) => apiClient.delete(`${API_BASE}/batches/${batchId}`)
};

// --- Helper Components ---

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
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
          className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]`}
        >
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ActionButton = ({ onClick, icon: Icon, label, variant = 'primary', disabled = false, size = 'normal' }) => {
  const baseClass = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const sizeClass = size === 'small' ? 'h-9 px-3 text-xs' : 'h-11 px-4 text-sm';
  const variants = {
    primary: 'lms-btn-primary',
    secondary: 'lms-btn-secondary',
    ghost: 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${sizeClass} ${variants[variant]}`}>
      {Icon && <Icon size={size === 'small' ? 14 : 18} strokeWidth={2.5} />}
      {label}
    </button>
  );
};

const BatchManagement = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [batches, setBatches] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const [selectedSubBatch, setSelectedSubBatch] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState('sub-batch');
  const [editBatch, setEditBatch] = useState(null);
  const [batchForm, setBatchForm] = useState({ name: '', code: '' });

  const [onlyActive, setOnlyActive] = useState(false);

  // Mobile View State: 'groups', 'batches', 'details'
  const [mobileView, setMobileView] = useState('groups');

  const handleApiError = (error, defaultMessage, options = {}) => {
    const { notify = true } = options;
    if (error?.response?.status === 401) {
      if (notify) {
        toast.error('Session expired. Please log in again.');
      }
      navigate('/login');
      return;
    }
    if (notify) {
      toast.error(error?.response?.data?.message || defaultMessage || 'Operation failed');
    }
  };

  const loadCourses = async (options = {}) => {
    const { notify = false } = options;
    try {
      const res = await apiClient.get(API_COURSES);
      setCourses(res.data?.courses || res.data || []);
      setPageError('');
    } catch (e) {
      setCourses([]);
      setPageError(e?.response?.data?.message || 'Failed to load courses.');
      handleApiError(e, 'Failed to load courses', { notify });
    }
  };

  const loadBatches = async (cid, options = {}) => {
    const { notify = false } = options;
    if (!cid) {
      setBatches([]);
      setGroupFilter('');
      setSelectedSubBatch(null);
      setBatchStudents([]);
      setPageError('');
      return;
    }
    setLoading(true);
    try {
      const res = await batchAPI.getBatches(cid);
      const raw = res.data?.batches ?? res.data?.data ?? res.data ?? [];
      const arr = Array.isArray(raw) ? raw : (raw.batches || raw.data || []);
      const normalized = (arr || []).map(x => ({ ...x, is_active: !!x.is_active }));
      normalized.sort((a, b) => {
        const na = (a.name || '').toLowerCase();
        const nb = (b.name || '').toLowerCase();
        if (na === nb) return (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase());
        return na.localeCompare(nb);
      });
      setBatches(normalized);

      // If filtering by group, ensure filtered selection is valid
      if (groupFilter && !normalized.some(b => b.name === groupFilter)) {
        setGroupFilter('');
      }
      // If sub-batch selected, re-select updated version
      if (selectedSubBatch) {
        const fresh = normalized.find(b => b.id === selectedSubBatch.id);
        if (fresh) setSelectedSubBatch(fresh);
        else {
          setSelectedSubBatch(null);
          setBatchStudents([]);
        }
      }
      setPageError('');
    } catch (e) {
      setPageError(e?.response?.data?.message || 'Failed to load batches.');
      handleApiError(e, 'Failed to load batches', { notify });
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchStudents = async (bid, options = {}) => {
    const { notify = true } = options;
    if (!bid) {
      setBatchStudents([]);
      return;
    }
    setLoading(true);
    try {
      const res = await batchAPI.getBatchStudents(bid);
      const arr = res.data?.students || res.data?.data || res.data || [];
      const students = Array.isArray(arr) ? arr : (arr.students || arr.data || []);
      students.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setBatchStudents(students);
    } catch (e) {
      handleApiError(e, 'Failed to load students', { notify });
      setBatchStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (courseId) loadBatches(courseId); else loadBatches(''); }, [courseId]);

  const groups = useMemo(() =>
    [...new Set(batches.map(b => b.name || '(No group)').filter(Boolean))]
      .filter(n => n.toLowerCase().includes(searchGroup.toLowerCase())),
    [batches, searchGroup]
  );

  const subbatches = useMemo(() => {
    let filtered = groupFilter
      ? batches.filter(b => (b.name || '(No group)') === groupFilter)
      : batches;
    if (onlyActive) filtered = filtered.filter(s => s.is_active);
    return filtered;
  }, [batches, groupFilter, onlyActive]);

  const getGroupColor = useCallback((groupName) => {
    const colors = [
      'text-indigo-600 bg-indigo-50 border-indigo-200',
      'text-purple-600 bg-purple-50 border-purple-200',
      'text-pink-600 bg-pink-50 border-pink-200',
      'text-cyan-600 bg-cyan-50 border-cyan-200',
      'text-emerald-600 bg-emerald-50 border-emerald-200',
      'text-orange-600 bg-orange-50 border-orange-200'
    ];
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }, []);

  const saveBatch = async () => {
    if (!batchForm.name) {
      toast.error('Batch name is required');
      return;
    }
    if (!courseId) {
      toast.error('Select a course first');
      return;
    }

    setOperationLoading(true);
    let codeToSend = batchForm.code && batchForm.code.trim() ? batchForm.code.trim() : '';
    if (createMode === 'group-only') codeToSend = `__GROUP__${Date.now()}`;

    try {
      if (editBatch && editBatch.id) {
        await batchAPI.updateBatch(editBatch.id, { name: batchForm.name, code: codeToSend });
      } else {
        await batchAPI.createBatch(courseId, { name: batchForm.name, code: codeToSend });
      }
      setDialogOpen(false);
      setEditBatch(null);
      setBatchForm({ name: '', code: '' });
      setCreateMode('sub-batch');
      await loadBatches(courseId);
      toast.success(editBatch ? 'Batch updated successfully' : 'Batch created successfully');
    } catch (e) {
      handleApiError(e, 'Save operation failed');
    } finally {
      setOperationLoading(false);
    }
  };

  const deleteBatch = async (b) => {
    if (!b || !b.id) return;
    if (!window.confirm(`Delete "${b.code}" from "${b.name}"?`)) return;

    setOperationLoading(true);
    try {
      await batchAPI.deleteBatch(b.id);
      if (selectedSubBatch && selectedSubBatch.id === b.id) {
        setSelectedSubBatch(null);
        setBatchStudents([]);
      }
      await loadBatches(courseId);
      toast.success('Batch deleted successfully');
    } catch (e) {
      handleApiError(e, 'Delete failed');
    } finally {
      setOperationLoading(false);
    }
  };

  const toggleActive = async (b) => {
    if (!b || !b.id) return;
    setOperationLoading(true);
    const newState = !b.is_active;
    try {
      await batchAPI.updateBatch(b.id, { is_active: newState });
      await loadBatches(courseId);
      toast.success(newState ? 'Batch activated' : 'Batch deactivated');
    } catch (e) {
      handleApiError(e, 'Toggle failed');
    } finally {
      setOperationLoading(false);
    }
  };

  const openSubBatch = async (b) => {
    setSelectedSubBatch(b);
    await loadBatchStudents(b.id, { notify: true });
    setMobileView('details');
  };

  const openCreateDialog = (mode = 'sub-batch') => {
    setEditBatch(null);
    setCreateMode(mode);
    // If creating sub-batch, pre-fill current group name if selected
    setBatchForm({
      name: mode === 'sub-batch' && groupFilter ? groupFilter : '',
      code: ''
    });
    setDialogOpen(true);
  };

  // --- Render ---

  return (
    <AdminLayout>
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm shrink-0">
          <div className="lms-container flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                <Layers size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Batch Management</h1>
                <p className="text-slate-500 text-sm">Organize students into groups and batches</p>
              </div>
            </div>

            {/* Course Selector in Header */}
            <div className="w-full md:w-64">
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="">Select Course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {pageError && (
          <div className="lms-container px-4 md:px-6 pt-4">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Batch data could not be loaded.</p>
                <p className="text-sm">{pageError}</p>
              </div>
            </div>
          </div>
        )}

        {/* --- Main Content (3 Panes) --- */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full lms-container p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* Left Pane: Groups */}
            <div className={`md:col-span-3 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${mobileView !== 'groups' ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700">Groups</h3>
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{groups.length}</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchGroup}
                    onChange={e => setSearchGroup(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {courseId ? groups.map(g => {
                  const active = groupFilter === g;
                  const count = batches.filter(b => b.name === g).length;
                  return (
                    <button
                      key={g}
                      onClick={() => {
                        setGroupFilter(g);
                        setSelectedSubBatch(null);
                        setBatchStudents([]);
                        setMobileView('batches');
                      }}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center justify-between group ${active ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                    >
                      <div>
                        <p className={`font-bold text-sm ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{g}</p>
                        <p className="text-xs text-slate-500">{count} batches</p>
                      </div>
                      <ChevronRight size={16} className={`transition-transform ${active ? 'text-indigo-500 translate-x-1' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    </button>
                  );
                }) : (
                  <div className="p-4 text-center text-slate-400 italic text-sm">Select a course first</div>
                )}
                {courseId && groups.length === 0 && (
                  <div className="p-4 text-center text-slate-400 italic text-sm">No groups found</div>
                )}
              </div>

              <div className="p-3 border-t border-slate-100">
                <ActionButton
                  label="New Group"
                  onClick={() => openCreateDialog('group-only')}
                  disabled={!courseId}
                  icon={Plus}
                  variant="secondary"
                  size="small"
                />
              </div>
            </div>

            {/* Middle Pane: Sub-Batches */}
            <div className={`md:col-span-4 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${mobileView !== 'batches' ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-3">
                  {/* Mobile Back Button */}
                  <button onClick={() => setMobileView('groups')} className="md:hidden p-1 -ml-1 text-slate-400">
                    <ChevronRight className="rotate-180" size={20} />
                  </button>
                  <h3 className="font-bold text-slate-700 flex-1 truncate">{groupFilter || 'All Batches'}</h3>

                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} className="hidden" />
                    <span className={`text-xs font-bold px-2 py-1 rounded border transition-colors ${onlyActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>Active Only</span>
                  </label>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {subbatches.map(b => (
                  <div
                    key={b.id}
                    className={`relative p-3 rounded-xl border transition-all ${selectedSubBatch?.id === b.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200 z-10' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => toggleActive(b)}
                        disabled={operationLoading}
                        className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${b.is_active ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                        title={b.is_active ? 'Deactivate batch' : 'Activate batch'}
                      >
                        {b.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                    <div
                      onClick={() => openSubBatch(b)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${b.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          {b.code}
                        </span>
                        {selectedSubBatch?.id === b.id && <ArrowRight size={16} className="text-indigo-500" />}
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mb-0.5">{b.name}</h4>
                    </div>

                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100/50">
                      <button onClick={() => { setCreateMode('sub-batch'); setBatchForm({ name: b.name, code: b.code }); setEditBatch(b); setDialogOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteBatch(b)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {subbatches.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-sm">No batches found</div>
                )}
              </div>

              <div className="p-3 border-t border-slate-100">
                <ActionButton
                  label="New Batch"
                  onClick={() => openCreateDialog('sub-batch')}
                  disabled={!courseId}
                  icon={Plus}
                  variant="primary"
                  size="small"
                />
              </div>
            </div>

            {/* Right Pane: Students */}
            <div className={`md:col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${mobileView !== 'details' ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <button onClick={() => setMobileView('batches')} className="md:hidden p-1 -ml-1 text-slate-400">
                  <ChevronRight className="rotate-180" size={20} />
                </button>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-700">{selectedSubBatch ? selectedSubBatch.code : 'Batch Details'}</h3>
                  <p className="text-xs text-slate-500">{selectedSubBatch ? `${batchStudents.length} students` : 'Select a batch to view students'}</p>
                </div>
                {selectedSubBatch && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${selectedSubBatch.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {selectedSubBatch.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => toggleActive(selectedSubBatch)}
                      disabled={operationLoading}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${selectedSubBatch.is_active ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                      title={selectedSubBatch.is_active ? 'Deactivate batch' : 'Activate batch'}
                    >
                      {selectedSubBatch.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {loading && selectedSubBatch ? (
                  <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-indigo-500" /></div>
                ) : !selectedSubBatch ? (
                  <div className="text-center p-8 opacity-50">
                    <Users size={48} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Select a batch from the list</p>
                  </div>
                ) : batchStudents.length === 0 ? (
                  <div className="text-center p-8 opacity-50">
                    <p className="text-sm">No students assigned to this batch</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {batchStudents.map((s, i) => (
                      <div key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-white">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-700 text-sm truncate">{s.name}</p>
                          <p className="text-xs text-slate-500 truncate">{s.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editBatch ? 'Edit Batch' : (createMode === 'group-only' ? 'New Batch Group' : 'New Sub-Batch')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Group Name</label>
            <input
              type="text"
              className="lms-input"
              placeholder="e.g. 2024-2028 Batch A"
              value={batchForm.name}
              onChange={e => setBatchForm(prev => ({ ...prev, name: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">This groups multiple sub-batches (theory, lab, etc.)</p>
          </div>

          {createMode !== 'group-only' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Sub-Batch Code</label>
              <input
                type="text"
                className="lms-input"
                placeholder="e.g. A1, Lab-Group-1"
                value={batchForm.code}
                onChange={e => setBatchForm(prev => ({ ...prev, code: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Unique identifier for this specific batch segment</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setDialogOpen(false)} />
            <ActionButton label="Save" variant="primary" onClick={saveBatch} disabled={!batchForm.name} />
          </div>
        </div>
      </Modal>

    </AdminLayout>
  );
};

export default BatchManagement;
