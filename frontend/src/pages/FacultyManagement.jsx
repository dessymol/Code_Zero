import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, RefreshCw, Edit, Trash2, X, Mail, Phone, Shield, Users, CheckCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import axios from 'axios';
import { useToast } from '../context/ToastContext';

const API_BASE = 'http://localhost:3000/api/v1/users';

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="lms-modal-overlay" onClick={onClose}>
      <div className={`lms-modal-box relative w-full ${maxWidth}`} onClick={(e) => e.stopPropagation()}>
        <div className="lms-modal-header">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="lms-modal-body">{children}</div>
      </div>
    </div>
  );
};

const COLORS = ['#2563eb','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#4f46e5'];

const FacultyForm = ({ facultyForm, setFacultyForm, submitting, isEdit, onSubmit, onCancel }) => (
  <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
    <div>
      <label htmlFor="faculty-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name<span className="text-red-500 ml-0.5">*</span></label>
      <input id="faculty-name" type="text" autoComplete="name" required placeholder="Dr. John Smith" className="lms-input"
        value={facultyForm.name} onChange={e => setFacultyForm(prev => ({ ...prev, name: e.target.value }))} />
    </div>
    <div>
      <label htmlFor="faculty-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address<span className="text-red-500 ml-0.5">*</span></label>
      <input id="faculty-email" type="email" autoComplete="email" required placeholder="john@example.com" className="lms-input"
        value={facultyForm.email} onChange={e => setFacultyForm(prev => ({ ...prev, email: e.target.value }))} />
    </div>
    <div>
      <label htmlFor="faculty-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
      <input id="faculty-phone" type="text" autoComplete="tel" placeholder="+91 98765 43210" className="lms-input"
        value={facultyForm.phone} onChange={e => setFacultyForm(prev => ({ ...prev, phone: e.target.value }))} />
    </div>
    {isEdit && (
      <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200">
        <span className="text-amber-500 mt-0.5">âš </span>
        <p className="text-xs text-amber-800 font-medium">Leave password blank to keep the existing password unchanged.</p>
      </div>
    )}
    <div>
      <label htmlFor="faculty-password" className="block text-sm font-semibold text-slate-700 mb-1.5">{isEdit ? 'New Password (Optional)' : 'Password'}{!isEdit && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input id="faculty-password" type="password" required={!isEdit} autoComplete="new-password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className="lms-input"
        value={facultyForm.password} onChange={e => setFacultyForm(prev => ({ ...prev, password: e.target.value }))} />
    </div>
    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="lms-btn-secondary">Cancel</button>
      <button type="submit" disabled={submitting || (!isEdit && (!facultyForm.name || !facultyForm.email || !facultyForm.password))} className="lms-btn-primary">
        {submitting ? <RefreshCw size={15} className="animate-spin" /> : isEdit ? <><CheckCircle size={15} /> Save Changes</> : <><UserPlus size={15} /> Add Faculty</>}
      </button>
    </div>
  </form>
);

const FacultyManagement = () => {
  const toast = useToast();
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [facultyForm, setFacultyForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchFaculties = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE}/faculties`, { headers: { Authorization: `Bearer ${token}` } });
      setFaculties(res.data.faculties || []);
    } catch { setFaculties([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFaculties(); }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return faculties.filter(f => (f?.name || '').toLowerCase().includes(q) || (f?.email || '').toLowerCase().includes(q) || (f?.phone || '').toLowerCase().includes(q));
  }, [faculties, searchQuery]);

  const resetForm = () => setFacultyForm({ name: '', email: '', phone: '', password: '' });

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE}/add-faculty`, facultyForm, { headers: { Authorization: `Bearer ${token}` } });
      setOpenAdd(false); resetForm(); fetchFaculties();
      toast.success('Faculty added successfully');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add faculty'); }
    finally { setSubmitting(false); }
  };

  const openEditDialog = (f) => {
    setFacultyForm({ name: f.name || '', email: f.email || '', phone: f.phone || '', password: '' });
    setEditingId(f.id); setOpenEdit(true);
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE}/faculties/update/${editingId}`, facultyForm, { headers: { Authorization: `Bearer ${token}` } });
      setOpenEdit(false); setEditingId(null); fetchFaculties();
      toast.success('Faculty updated successfully');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to update faculty'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/faculties/delete/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchFaculties(); toast.success('Faculty deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete faculty'); }
  };

  const FacultyFormInternal = ({ onSubmit, isEdit }) => (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <div>
        <label htmlFor="faculty-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name<span className="text-red-500 ml-0.5">*</span></label>
        <input id="faculty-name" type="text" autoComplete="name" required placeholder="Dr. John Smith" className="lms-input"
          value={facultyForm.name} onChange={e => setFacultyForm(prev => ({ ...prev, name: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="faculty-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address<span className="text-red-500 ml-0.5">*</span></label>
        <input id="faculty-email" type="email" autoComplete="email" required placeholder="john@example.com" className="lms-input"
          value={facultyForm.email} onChange={e => setFacultyForm(prev => ({ ...prev, email: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="faculty-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
        <input id="faculty-phone" type="text" autoComplete="tel" placeholder="+91 98765 43210" className="lms-input"
          value={facultyForm.phone} onChange={e => setFacultyForm(prev => ({ ...prev, phone: e.target.value }))} />
      </div>
      {isEdit && (
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-200">
          <span className="text-amber-500 mt-0.5">⚠</span>
          <p className="text-xs text-amber-800 font-medium">Leave password blank to keep the existing password unchanged.</p>
        </div>
      )}
      <div>
        <label htmlFor="faculty-password" className="block text-sm font-semibold text-slate-700 mb-1.5">{isEdit ? 'New Password (Optional)' : 'Password'}{!isEdit && <span className="text-red-500 ml-0.5">*</span>}</label>
        <input id="faculty-password" type="password" required={!isEdit} autoComplete="new-password" placeholder="••••••••" className="lms-input"
          value={facultyForm.password} onChange={e => setFacultyForm(prev => ({ ...prev, password: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
        <button type="button" onClick={() => isEdit ? setOpenEdit(false) : setOpenAdd(false)} className="lms-btn-secondary">Cancel</button>
        <button type="submit" disabled={submitting || (!isEdit && (!facultyForm.name || !facultyForm.email || !facultyForm.password))} className="lms-btn-primary">
          {submitting ? <RefreshCw size={15} className="animate-spin" /> : isEdit ? <><CheckCircle size={15} /> Save Changes</> : <><UserPlus size={15} /> Add Faculty</>}
        </button>
      </div>
    </form>
  );

  return (
    <AdminLayout>
      {/* Page Header */}
      <div className="mb-6">
        <div className="lms-card p-6 border-l-4 border-l-blue-600">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
                <Shield size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Faculty Management</h1>
                <p className="text-sm text-slate-500">{faculties.length} faculty member{faculties.length !== 1 ? 's' : ''} registered</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={fetchFaculties} disabled={loading} className="lms-btn-secondary gap-2">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => { resetForm(); setOpenAdd(true); }} className="lms-btn-primary gap-2">
                <UserPlus size={15} /> Add Faculty
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Faculty', value: faculties.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active', value: faculties.filter(f => f.is_active !== false).length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Search Results', value: filtered.length, icon: Search, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'With Phone', value: faculties.filter(f => f.phone).length, icon: Phone, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="lms-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}><s.icon size={17} className={s.color} /></div>
            <div><div className={`text-2xl font-black ${s.color}`}>{s.value}</div><div className="text-xs text-slate-500 font-medium">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="lms-card p-4 mb-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Search by name, email or phone…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="lms-input pl-10 text-sm" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="lms-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" style={{ borderWidth: 3 }} />
            <p className="text-slate-500 text-sm font-medium">Loading faculty list…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"><Users size={28} className="text-slate-400" /></div>
            <h3 className="text-base font-bold text-slate-700 mb-1">{searchQuery ? 'No results found' : 'No faculty yet'}</h3>
            <p className="text-sm text-slate-500">{searchQuery ? 'Try a different search term.' : 'Click "Add Faculty" to get started.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Faculty Member</th>
                  <th>Contact Information</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                    <tr key={f.id} className="group transition-all hover:bg-slate-50">
                    <td className="text-slate-400 font-bold text-xs w-10">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}>
                          {(f.name || 'F').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{f.name || '—'}</div>
                          <div className="text-xs text-slate-400 font-mono">ID: {f.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm text-slate-700"><Mail size={13} className="text-slate-400 shrink-0" />{f.email || '—'}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500"><Phone size={12} className="text-slate-400 shrink-0" />{f.phone || 'No phone'}</div>
                      </div>
                    </td>
                    <td>
                      <span className={`lms-badge ${f.is_active !== false ? 'lms-badge-green' : 'lms-badge-gray'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 ${f.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {f.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditDialog(f)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Edit"><Edit size={15} /></button>
                        <button onClick={() => handleDelete(f.id, f.name)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={openAdd} onClose={() => setOpenAdd(false)} title="Add New Faculty Member">
        <FacultyForm
          facultyForm={facultyForm}
          setFacultyForm={setFacultyForm}
          submitting={submitting}
          isEdit={false}
          onSubmit={handleAdd}
          onCancel={() => setOpenAdd(false)}
        />
      </Modal>
      <Modal isOpen={openEdit} onClose={() => setOpenEdit(false)} title="Edit Faculty Member">
        <FacultyForm
          facultyForm={facultyForm}
          setFacultyForm={setFacultyForm}
          submitting={submitting}
          isEdit={true}
          onSubmit={handleUpdate}
          onCancel={() => setOpenEdit(false)}
        />
      </Modal>
    </AdminLayout>
  );
};
export default FacultyManagement;
