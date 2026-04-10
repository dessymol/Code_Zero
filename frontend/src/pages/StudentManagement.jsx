import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Search, UserPlus, Upload, FileText, Filter, RefreshCw,
  MoreVertical, Edit, Trash2, CheckCircle, X, ChevronDown, Mail, Phone,
  Globe, Download, ArrowRight, Smartphone
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import Pagination from '../components/Pagination';

const API_BASE = 'http://localhost:3000/api';
const API_COURSES = `${API_BASE}/courses/get-all-courses`;
const API_STUDENTS = `${API_BASE}/students`;

// --- Components ---

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

const ActionButton = ({ onClick, icon: Icon, label, variant = 'primary', disabled = false }) => {
  const baseClass = 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    primary: 'lms-btn-primary',
    secondary: 'lms-btn-secondary',
    danger: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100',
    ghost: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg font-semibold text-slate-600 hover:bg-slate-100'
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${variants[variant]}`}>
      {Icon && <Icon size={18} strokeWidth={2.5} />}
      {label}
    </button>
  );
};

const StudentManagement = () => {
  // core data
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [batchNames, setBatchNames] = useState([]);
  const [batchCodesForName, setBatchCodesForName] = useState([]);
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  // UI / dialogs
  const [loading, setLoading] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  // forms
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', email: '', phone: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [templateMeta, setTemplateMeta] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [phoneError, setPhoneError] = useState({ add: false, edit: false });

  // search/snack
  const [searchQuery, setSearchQuery] = useState('');

  // global search dialog
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchStudent, setSelectedSearchStudent] = useState(null);
  const [selectedStudentBatches, setSelectedStudentBatches] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [globalStudentsCache, setGlobalStudentsCache] = useState([]);

  const authHeader = useMemo(() => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  // Validation
  const validatePhone = (phone) => {
    return /^\d{10}$/.test(phone) && /^[6-9]/.test(phone);
  }

  const handleAddPhoneChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^[0-9]+$/.test(val)) {
      setAddForm(prev => ({ ...prev, phone: val }));
      setPhoneError(prev => ({ ...prev, add: val.length > 0 && !validatePhone(val) }));
    }
  };

  const handleEditPhoneChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^[0-9]+$/.test(val)) {
      setEditForm(prev => ({ ...prev, phone: val }));
      setPhoneError(prev => ({ ...prev, edit: val.length > 0 && !validatePhone(val) }));
    }
  };

  // ---------- loaders ----------
  const loadCourses = async () => {
    try {
      const res = await axios.get(API_COURSES, { headers: authHeader });
      setCourses(res.data?.courses || []);
    } catch (err) {
      console.error('loadCourses', err);
      setCourses([]);
    }
  };

  const loadBatchesForCourse = async (cid) => {
    if (!cid) {
      setBatches([]);
      setBatchNames([]);
      setBatchCodesForName([]);
      setSelectedBatchName('');
      setSelectedBatchCode('');
      setSelectedBatchId('');
      return;
    }
    try {
      const res = await axios.get(`${API_STUDENTS}/batches/${cid}`, { headers: authHeader });
      const arr = res.data?.batches || [];
      arr.sort((a, b) => (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase()));
      setBatches(arr);
      const names = Array.from(new Set(arr.map(x => x.name || '').filter(Boolean)));
      setBatchNames(names);
      setSelectedBatchName('');
      setSelectedBatchCode('');
      setSelectedBatchId('');
      setBatchCodesForName([]);
    } catch (err) {
      console.error('loadBatchesForCourse', err);
    }
  };

  const fetchStudentsForBatchId = async (batch) => {
    if (!batch || !batch.id) return [];
    try {
      const res = await axios.get(`${API_STUDENTS}/batch/${batch.id}`, { headers: authHeader });
      const arr = res.data?.students || [];
      const withBatch = arr.map((s) => {
        const existingBatches = Array.isArray(s.batches) ? s.batches.slice() : [];
        const has = existingBatches.some(b => String(b.id) === String(batch.id) || b.code === batch.code);
        if (!has) existingBatches.push({ id: batch.id, name: batch.name || '', code: batch.code || '' });
        return { ...s, batches: existingBatches };
      });
      return withBatch;
    } catch (err) {
      console.error('fetchStudentsForBatchId', batch, err);
      return [];
    }
  };

  const loadStudents = async (cid, batchIdParam = '') => {
    if (!cid) {
      setStudents([]);
      return;
    }
    setLoading(true);
    try {
      if (batchIdParam) {
        const batch = batches.find(b => String(b.id) === String(batchIdParam)) || { id: batchIdParam, name: '', code: '' };
        const studentsForBatch = await fetchStudentsForBatchId(batch);
        setStudents(studentsForBatch);
        return;
      }

      if (selectedBatchName) {
        const matching = batches.filter(b => (b.name || '') === selectedBatchName);
        if (matching.length === 0) {
          setStudents([]);
          return;
        }
        const allArrays = await Promise.all(matching.map(b => fetchStudentsForBatchId(b)));
        const map = new Map();
        for (const arr of allArrays) {
          for (const s of arr) {
            const key = s.id != null ? `id:${s.id}` : `email:${(s.email || '').toLowerCase()}`;
            if (!map.has(key)) {
              map.set(key, { ...s, batches: Array.isArray(s.batches) ? s.batches.slice() : [] });
            } else {
              const existing = map.get(key);
              const existCodes = new Set((existing.batches || []).map(b => b.code));
              for (const nb of (s.batches || [])) {
                if (!existCodes.has(nb.code)) existing.batches.push(nb);
              }
              map.set(key, existing);
            }
          }
        }
        const combined = Array.from(map.values());
        setStudents(combined);
        return;
      }

      if (batches && batches.length > 0) {
        const allArrays = await Promise.all(batches.map(b => fetchStudentsForBatchId(b)));
        const map = new Map();
        for (const arr of allArrays) {
          for (const s of arr) {
            const key = s.id != null ? `id:${s.id}` : `email:${(s.email || '').toLowerCase()}`;
            if (!map.has(key)) {
              map.set(key, { ...s, batches: Array.isArray(s.batches) ? s.batches.slice() : [] });
            } else {
              const existing = map.get(key);
              const existCodes = new Set((existing.batches || []).map(b => b.code));
              for (const nb of (s.batches || [])) {
                if (!existCodes.has(nb.code)) existing.batches.push(nb);
              }
              map.set(key, existing);
            }
          }
        }
        const combined = Array.from(map.values());
        setStudents(combined);
        return;
      }

      {
        const res = await axios.get(`${API_STUDENTS}/by-course/${cid}`, { headers: authHeader });
        const arr = res.data?.students || res.data || [];
        const normalized = arr.map((s) => ({ ...s, batches: Array.isArray(s.batches) ? s.batches : (s.Batches || []) }));
        setStudents(normalized);
      }
    } catch (err) {
      console.error('loadStudents', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);

  useEffect(() => {
    if (courseId) {
      loadBatchesForCourse(courseId);
      loadStudents(courseId, '');
    } else {
      setStudents([]);
      setBatches([]);
      setBatchNames([]);
      setBatchCodesForName([]);
      setSelectedBatchName('');
      setSelectedBatchCode('');
      setSelectedBatchId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (!selectedBatchName) {
      setBatchCodesForName([]);
      setSelectedBatchCode('');
      setSelectedBatchId('');
      if (courseId) loadStudents(courseId, '');
      return;
    }
    const codes = batches.filter(b => (b.name || '') === selectedBatchName).map(b => ({ id: b.id, code: b.code }));
    codes.sort((a, b) => (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase()));
    setBatchCodesForName(codes);
    setSelectedBatchCode('');
    setSelectedBatchId('');
    if (courseId) loadStudents(courseId, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchName, batches]);

  useEffect(() => {
    if (!selectedBatchName || !selectedBatchCode) {
      setSelectedBatchId('');
      if (courseId) loadStudents(courseId, '');
      return;
    }
    const found = batches.find(b => (b.name || '') === selectedBatchName && (b.code || '') === selectedBatchCode);
    const id = found?.id || '';
    setSelectedBatchId(id);
    if (id) {
      loadStudents(courseId, id);
    } else {
      loadStudents(courseId, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchCode, selectedBatchName, batches]);

  // ---------- toast ----------
  const toast = useToast();

  // ---------- add/edit/upload ----------
  const handleAdd = async () => {
    try {
      const selectedCourse = courses.find(c => String(c.id) === String(courseId));
      if (!selectedCourse) { toast.error('Select a course first'); return; }
      if (!selectedBatchName || !selectedBatchCode) { toast.error('Select batch name and code'); return; }

      const payload = {
        name: addForm.name,
        email: addForm.email,
        phone: addForm.phone,
        course_code: selectedCourse.course_code
      };
      const res = await axios.post(`${API_STUDENTS}/add`, payload, { headers: authHeader });
      const createdId = res.data?.student?.id || res.data?.id || res.data?.insertId || res.data?.createdStudentId || null;

      if (createdId && selectedBatchId) {
        try {
          await axios.post(`${API_STUDENTS}/${createdId}/assign-batch/${selectedBatchId}`, {}, { headers: authHeader });
        } catch (e) { console.warn('assign created student failed', e?.message || e); }
      }
      setOpenAdd(false);
      await loadStudents(courseId, selectedBatchId || '');
      setAddForm({ name: '', email: '', phone: '' });
      toast.success('Student added successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Add student failed');
    }
  };

  const openEditDialog = (student) => {
    setEditForm({ id: student.id, name: student.name || '', email: student.email || '', phone: student.phone || '' });
    setOpenEdit(true);
  };

  const handleUpdateStudent = async () => {
    try {
      if (!editForm.id) return;
      await axios.put(`${API_STUDENTS}/update/${editForm.id}`, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone
      }, { headers: authHeader });
      setOpenEdit(false);
      await loadStudents(courseId, selectedBatchId || '');
      toast.success('Student updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Delete this student permanently?')) return;
    try {
      await axios.delete(`${API_STUDENTS}/remove/${studentId}/${courseId}`, { headers: authHeader });
      await loadStudents(courseId, selectedBatchId || '');
      toast.success('Student deleted successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleUpload = async () => {
    if (!courseId) { toast.error('Select a course before uploading'); return; }
    if (!selectedBatchName || !selectedBatchCode) { toast.error('Select a batch name and code'); return; }
    if (!uploadFile) { toast.error('Choose a file to upload'); return; }
    try {
      const selectedCourse = courses.find(c => String(c.id) === String(courseId));
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('course_code', selectedCourse?.course_code || '');
      form.append('batch_code', selectedBatchCode || '');
      if (selectedBatchId) form.append('batchId', selectedBatchId);

      const res = await axios.post(`${API_STUDENTS}/upload`, form, {
        headers: { ...authHeader, 'Content-Type': 'multipart/form-data' }
      });

      const { count, assignedExisting, failures } = res.data;
      let msg = `Successfully created ${count} new students.`;
      if (assignedExisting) msg += ` Assigned ${assignedExisting} existing students.`;

      let hasError = false;
      if (failures && failures.length > 0) {
        hasError = true;
        msg += `\n\n${failures.length} rows failed to process:`;
        failures.slice(0, 5).forEach(f => {
          msg += `\n- Row ${f.row?.Name || 'Unknown'}: ${f.error}`;
        });
        if (failures.length > 5) msg += `\n...and ${failures.length - 5} more.`;
      }

      if (hasError) toast.error(msg);
      else toast.success(msg);

      await loadBatchesForCourse(courseId);
      await loadStudents(courseId, selectedBatchId || '');
      setOpenUpload(false);
      setUploadFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  const loadStudentTemplateMeta = async () => {
    setTemplateLoading(true);
    try {
      const res = await axios.get(`${API_STUDENTS}/templates/students`, { headers: authHeader });
      setTemplateMeta(res.data?.template || null);
    } catch (err) {
      setTemplateMeta(null);
      toast.error(err.response?.data?.message || 'Failed to load upload template');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleTemplateUpload = async () => {
    if (!templateFile) {
      toast.error('Choose a template file first');
      return;
    }
    setTemplateUploading(true);
    try {
      const form = new FormData();
      form.append('templateFile', templateFile);
      await axios.post(`${API_STUDENTS}/templates/students`, form, {
        headers: { ...authHeader, 'Content-Type': 'multipart/form-data' }
      });
      setTemplateFile(null);
      await loadStudentTemplateMeta();
      toast.success('Student upload template saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Template upload failed');
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API_STUDENTS}/templates/students/download`, {
        headers: authHeader,
        responseType: 'blob'
      });
      const contentDisposition = response.headers['content-disposition'] || '';
      const fromHeader = /filename="?([^"]+)"?/i.exec(contentDisposition)?.[1];
      const filename = fromHeader || templateMeta?.fileName || 'students_import_template.csv';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Template download failed');
    }
  };

  // ---------- GLOBAL SEARCH flow ----------
  const openGlobalSearch = async () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedSearchStudent(null);
    setSelectedStudentBatches([]);
    setSearchDialogOpen(true);

    if (globalStudentsCache.length > 0) return;
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_STUDENTS}/get-all-students`, { headers: authHeader });
      const all = res.data?.students || [];
      setGlobalStudentsCache(all);
    } catch (err) {
      setGlobalStudentsCache([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!searchDialogOpen) return;
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const results = (globalStudentsCache || []).filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    );
    setSearchResults(results);
  }, [searchTerm, globalStudentsCache, searchDialogOpen]);

  const fetchStudentBatches = async (student) => {
    if (!student || !student.id) {
      setSelectedStudentBatches([]);
      return;
    }
    setSearchLoading(true);
    try {
      const found = [];
      for (const c of courses) {
        let courseBatches = [];
        try {
          const br = await axios.get(`${API_STUDENTS}/batches/${c.id}`, { headers: authHeader });
          courseBatches = br.data?.batches || [];
        } catch (err) {
          continue;
        }

        for (const b of courseBatches) {
          try {
            const sr = await axios.get(`${API_STUDENTS}/batch/${b.id}`, { headers: authHeader });
            const studentsInBatch = sr.data?.students || [];
            if (studentsInBatch.some(st => String(st.id) === String(student.id))) {
              found.push({ id: b.id, name: b.name, code: b.code, course_id: c.id, course_name: c.name });
            }
          } catch (errInner) {
            continue;
          }
        }
      }
      setSelectedStudentBatches(found);
    } catch (err) {
      setSelectedStudentBatches([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const onSelectSearchStudent = async (s) => {
    setSelectedSearchStudent(s);
    await fetchStudentBatches(s);
  };

  const filteredStudents = (students || []).filter(s => {
    if (!searchQuery || searchQuery.trim() === '') return true;
    const q = searchQuery.trim().toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.phone || '').toLowerCase().includes(q);
  });

  const canManage = Boolean(courseId && selectedBatchName && selectedBatchCode);

  // pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [courseId, selectedBatchName, selectedBatchCode, searchQuery]);

  useEffect(() => {
    if (openUpload) {
      loadStudentTemplateMeta();
    } else {
      setTemplateFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openUpload]);

  // Derived state for pagination
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(start, start + itemsPerPage);
  }, [filteredStudents, currentPage, itemsPerPage]);

  return (
    <AdminLayout disableScroll={true}>
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="mb-8 bg-white border-b border-slate-200 px-8 py-6 shadow-sm">
          <div className="lms-container flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                <Users size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Student Management</h1>
                <p className="text-slate-500 font-medium">Manage students across courses and batches</p>
              </div>
            </div>

            <div className="flex gap-3">
              <ActionButton
                icon={Globe}
                label="Global Search"
                variant="secondary"
                onClick={openGlobalSearch}
              />
            </div>
          </div>
        </div>

        {/* Filters & Content */}
        <div className="flex-1 overflow-auto px-4 md:px-8 pb-8 custom-scrollbar">
          <div className="lms-container space-y-6">

            {/* Filters Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                {/* Select Course */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Select Course
                  </label>
                  <div className="relative">
                    <select
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 appearance-none bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">Choose a course...</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Batch Name */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Batch Name
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBatchName}
                      onChange={(e) => setSelectedBatchName(e.target.value)}
                      disabled={!courseId}
                      className="w-full pl-4 pr-10 py-3 appearance-none bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">All Batches</option>
                      {batchNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Batch Code */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Batch Code
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBatchCode}
                      onChange={(e) => setSelectedBatchCode(e.target.value)}
                      disabled={!selectedBatchName}
                      className="w-full pl-4 pr-10 py-3 appearance-none bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">All Codes</option>
                      {batchCodesForName.map(c => (
                        <option key={c.id} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Search in List */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                    Filter List
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search name, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Actions for Selected Batch */}
            {canManage && (
              <div className="flex flex-wrap gap-4 justify-end">
                <ActionButton
                  icon={Upload}
                  label="Bulk Upload"
                  variant="secondary"
                  onClick={() => setOpenUpload(true)}
                />
                <ActionButton
                  icon={UserPlus}
                  label="Add Student"
                  variant="primary"
                  onClick={() => setOpenAdd(true)}
                />
              </div>
            )}

            {/* Students Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px] flex flex-col">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton width="40px" height="40px" rounded="rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton height="20px" width="30%" />
                        <Skeleton height="15px" width="50%" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !courseId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <Users size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">No Course Selected</h3>
                  <p className="text-slate-500 max-w-sm mx-auto">Please select a course from the filters above to view and manage registered students.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <Search size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">No Students Found</h3>
                  <p className="text-slate-500">Try adjusting your filters or search terms.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">#</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email / Contact</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Batches</th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedStudents.map((s, i) => (
                          <tr key={s.id || i} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">
                              {(currentPage - 1) * itemsPerPage + i + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-700">{s.name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                  <Mail size={14} className="text-slate-400" />
                                  {s.email}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                  <Phone size={14} className="text-slate-400" />
                                  {s.phone || 'N/A'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-2">
                                {s.batches && s.batches.length > 0 ? (
                                  s.batches.map(b => (
                                    <span key={b.id || `${b.code}-${b.name}`} className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
                                      {b.code}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2 opacity-100">
                                <button
                                  onClick={() => openEditDialog(s)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Edit Student"
                                >
                                  <Edit size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(s.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove Student"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {paginatedStudents.map((s) => (
                      <div key={s.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800">{s.name}</h4>
                            <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                              <Mail size={12} /> {s.email}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditDialog(s)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                            <button onClick={() => handleDeleteStudent(s.id)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {s.batches && s.batches.length > 0 ? (
                            s.batches.map(b => (
                              <span key={b.id || `${b.code}-${b.name}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                {b.code}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No batches</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Control */}
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredStudents.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* --- Dialogs --- */}

      {/* Add Student Modal */}
      <Modal isOpen={openAdd} onClose={() => setOpenAdd(false)} title="Add New Student">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              className="lms-input"
              value={addForm.name}
              onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              className="lms-input"
              value={addForm.email}
              onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
            <input
              type="text"
              maxLength={10}
              className={`lms-input ${phoneError.add ? 'border-red-500 ring-red-100 focus:ring-red-100 focus:border-red-500' : ''}`}
              placeholder="10-digit number"
              value={addForm.phone}
              onChange={handleAddPhoneChange}
            />
            {phoneError.add && <p className="text-red-500 text-xs mt-1 font-medium">Must be a valid 10-digit number</p>}
          </div>

          {selectedBatchName && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-sm font-bold text-emerald-800">Assigning to Batch</h4>
                <p className="text-sm text-emerald-600">{selectedBatchCode} - {selectedBatchName}</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setOpenAdd(false)} />
            <ActionButton
              label="Add Student"
              variant="primary"
              onClick={handleAdd}
              disabled={!addForm.name || !addForm.email || phoneError.add}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Student Modal */}
      <Modal isOpen={openEdit} onClose={() => setOpenEdit(false)} title="Edit Student">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              className="lms-input"
              value={editForm.name}
              onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              className="lms-input"
              value={editForm.email}
              onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              maxLength={10}
              className={`lms-input ${phoneError.edit ? 'border-red-500 ring-red-100 focus:ring-red-100 focus:border-red-500' : ''}`}
              placeholder="10-digit number"
              value={editForm.phone}
              onChange={handleEditPhoneChange}
            />
            {phoneError.edit && <p className="text-red-500 text-xs mt-1 font-medium">Must be a valid 10-digit number</p>}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setOpenEdit(false)} />
            <ActionButton
              label="Save Changes"
              variant="primary"
              onClick={handleUpdateStudent}
              disabled={!editForm.name || !editForm.email || phoneError.edit}
            />
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={openUpload} onClose={() => setOpenUpload(false)} title="Bulk Upload Students">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h4 className="flex items-center gap-2 font-bold text-blue-800 mb-2">
              <FileText size={18} />
              Format Requirements
            </h4>
            <p className="text-sm text-blue-700 mb-1">Upload a <strong>CSV</strong> or <strong>Excel</strong> file with columns:</p>
            <ul className="text-sm text-blue-700 list-disc list-inside font-medium pl-2">
              <li>Name</li>
              <li>Email</li>
              <li>Phone (Optional)</li>
            </ul>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-sm font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <Download size={14} /> Download CSV Template
              </button>
              <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-2">
                <p className="text-xs text-slate-600">
                  {templateLoading
                    ? 'Loading template details...'
                    : templateMeta
                      ? `Current template: ${templateMeta.fileName} (${new Date(templateMeta.uploadedAt).toLocaleString()})`
                      : 'Using default built-in template. Upload a custom one below.'}
                </p>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="file"
                    accept=".csv, .xls, .xlsx"
                    className="lms-input h-10 px-3 py-1.5 text-sm"
                    onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={handleTemplateUpload}
                    disabled={!templateFile || templateUploading}
                    className="lms-btn-secondary h-10 px-3 text-sm whitespace-nowrap"
                  >
                    {templateUploading ? 'Saving...' : 'Upload Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${uploadFile ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50'}`}>
            <Upload className={`mx-auto mb-4 ${uploadFile ? 'text-emerald-500' : 'text-slate-400'}`} size={48} />
            {uploadFile ? (
              <div>
                <p className="text-emerald-700 font-bold text-lg mb-1">File Selected</p>
                <p className="text-slate-600 border border-slate-200 bg-white px-3 py-1 rounded inline-block">{uploadFile.name}</p>
              </div>
            ) : (
              <>
                <p className="text-slate-700 font-bold mb-1">Click to browse</p>
                <p className="text-slate-500 text-sm">Supports .csv, .xls, .xlsx</p>
              </>
            )}
            <input
              type="file"
              accept=".csv, .xls, .xlsx"
              className="hidden"
              id="file-upload"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload" className="absolute inset-0 cursor-pointer"></label>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setOpenUpload(false)} />
            <ActionButton
              label="Upload"
              variant="primary"
              onClick={handleUpload}
              disabled={!uploadFile}
            />
          </div>
        </div>
      </Modal>

      {/* Global Search Modal */}
      <Modal isOpen={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} title="Global Student Search" maxWidth="max-w-2xl">
        <div className="space-y-6 min-h-[400px] flex flex-col">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              autoFocus
              placeholder="Search all students by name, email, phone..."
              className="lms-input pl-12 pr-4 text-base"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {searchLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <RefreshCw className="animate-spin text-indigo-500 mb-2" size={32} />
              <p className="text-slate-500">Searching directory...</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-60">
              <Search size={48} className="text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">{searchTerm ? 'No matches found' : 'Start typing to search...'}</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-1">
              {searchResults.map(s => (
                <div
                  key={s.id}
                  onClick={() => onSelectSearchStudent(s)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedSearchStudent?.id === s.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800">{s.name}</h4>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                        <Mail size={12} /> {s.email}
                      </div>
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                        <Smartphone size={12} /> {s.phone || 'N/A'}
                      </div>
                    </div>
                    {selectedSearchStudent?.id === s.id && <ArrowRight className="text-indigo-500" size={20} />}
                  </div>

                  {/* Expanded Details */}
                  {selectedSearchStudent?.id === s.id && (
                    <div className="mt-4 pt-4 border-t border-indigo-100/50">
                      <h5 className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">Enrollments</h5>
                      {searchLoading ? (
                        <p className="text-xs text-slate-400">Loading batches...</p>
                      ) : selectedStudentBatches.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedStudentBatches.map(b => (
                            <span key={b.id} className="text-xs px-2 py-1 bg-white border border-indigo-100 text-indigo-700 rounded-md font-medium shadow-sm">
                              {b.code} ({b.course_name})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No batch assignments found</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

    </AdminLayout>
  );
};

export default StudentManagement;
