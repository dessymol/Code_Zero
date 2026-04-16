import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, BookOpen, Users, FileText, CheckCircle, BarChart2, Edit, Lock,
  Settings, LogOut, ChevronDown, ChevronRight, Activity, AlertCircle,
  Calendar, Layers, Filter, Search, X, Check, Mail, Phone
} from "lucide-react";
import FacultyNavbar from "./FacultyNavbar";
import axios from "axios";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const API_USERS = "http://localhost:3000/api/v1/users";
const API_COURSES = "http://localhost:3000/api/courses";
const API_STUDENTS = "http://localhost:3000/api/students";
const API_SUBMISSIONS = "http://localhost:3000/api/submissions";
const API_QUESTIONS = "http://localhost:3000/api/questions";

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6"];

// --- Reusable Components ---

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
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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

const StatCard = ({ title, value, icon: Icon, color, subtitle, loading }) => {
  const colorStyles = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    pink: "bg-pink-50 text-pink-600 border-pink-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
  };
  const theme = colorStyles[color] || colorStyles.indigo;

  return (
    <div className={`p-6 rounded-2xl border ${theme} h-full transition-all hover:-translate-y-1 hover:shadow-lg`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl bg-white shadow-sm ring-1 ring-inset ring-slate-100`}>
          <Icon size={24} className={theme.split(' ')[1]} />
        </div>
        {subtitle && <span className="text-xs font-bold px-2 py-1 bg-white/60 rounded-full">{subtitle}</span>}
      </div>
      <div>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800">{loading ? '-' : value}</h3>
      </div>
    </div>
  );
};

const Spinner = () => (
  <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function FacultyProfile() {
  const navigate = useNavigate();

  // Data & Loading
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [questionsWithBatchStates, setQuestionsWithBatchStates] = useState([]);

  // UI State
  const [tab, setTab] = useState("overview"); // overview, analytics, settings
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "" });
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  // Analytics
  const [aggregatedStats, setAggregatedStats] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Initial Load
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const headers = getAuthHeaders();
        // Profile
        const rProfile = await axios.get(`${API_USERS}/me`, { headers });
        const me = rProfile?.data?.data ?? rProfile?.data;
        if (mounted) {
          setProfile(me);
          setEditForm({ name: me?.name || "", phone: me?.phone || "", email: me?.email || "" });
        }

        // Courses
        const rCourses = await axios.get(`${API_COURSES}/faculty-courses`, { headers });
        const raw = rCourses?.data?.courses ?? rCourses?.data?.data ?? [];
        const normalized = (Array.isArray(raw) ? raw : []).map(c => ({
          ...c, studentCount: c.studentCount ?? c.count ?? 0
        }));

        if (mounted) {
          setCourses(normalized);
          if (normalized.length && !selectedCourseId) setSelectedCourseId(normalized[0].id || normalized[0]._id);
        }
      } catch (err) {
        console.error("Init Error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Course Data Load
  useEffect(() => {
    if (!selectedCourseId) return;
    let mounted = true;
    const loadCourseData = async () => {
      setAnalyticsLoading(true);
      const headers = getAuthHeaders();
      try {
        // Batches
        const rBatches = await axios.get(`${API_STUDENTS}/batches/${selectedCourseId}`, { headers });
        if (mounted) setBatches(rBatches?.data?.batches || []);

        // Students
        const rStudents = await axios.get(`${API_STUDENTS}/by-course/${selectedCourseId}`, { headers });
        if (mounted) setStudents(rStudents?.data?.students || []);

        // Submissions
        const rSubs = await axios.get(`${API_SUBMISSIONS}/faculty/course/${selectedCourseId}`, { headers });
        if (mounted) setSubmissions(rSubs?.data?.submissions || []);

        // Questions
        const rQuestions = await axios.get(`${API_QUESTIONS}/bank/${selectedCourseId}?includeBatches=1`, { headers });
        if (mounted) setQuestionsWithBatchStates(rQuestions?.data?.questions || []);

      } catch (err) {
        console.error("Course Data Error", err);
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    };
    loadCourseData();
    return () => { mounted = false; };
  }, [selectedCourseId]);

  // --- Calculations ---

  const statsPerBatch = useMemo(() => {
    const map = {};
    const ensure = (id, name) => { if (!map[id]) map[id] = { id, name, students: 0, toggled: 0, submissions: 0 }; };

    // Process batches first to ensure empty batches appear
    batches.forEach(b => ensure(b.id, b.name));

    students.forEach(s => {
      (s.Batches || []).forEach(b => {
        ensure(b.id, b.name);
        map[b.id].students++;
      });
    });

    questionsWithBatchStates.forEach(q => {
      const enabled = q.enabled_batches ?? [];
      enabled.forEach(b => {
        if (!b) return;
        ensure(b.id, b.name);
        map[b.id].toggled++;
      });
    });

    return Object.values(map);
  }, [batches, students, questionsWithBatchStates]);

  const submissionsByDay = useMemo(() => {
    const days = 14;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    submissions.forEach(s => {
      const d = new Date(s.createdAt);
      if (!isNaN(d)) map[d.toISOString().slice(0, 10)]++;
    });
    return Object.keys(map).map(k => ({ date: k.slice(5), count: map[k] }));
  }, [submissions]);

  // --- Handlers ---

  const handleSaveProfile = async () => {
    try {
      await axios.put(`${API_USERS}/me`, editForm, { headers: getAuthHeaders() });
      const r = await axios.get(`${API_USERS}/me`, { headers: getAuthHeaders() });
      setProfile(r.data.data);
      setEditOpen(false);
      alert("Profile updated!");
    } catch (e) { alert("Failed to update profile"); }
  };

  const handleChangePassword = async () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return alert("Passwords do not match");
    try {
      await axios.post(`${API_USERS}/change-password`, {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword
      }, { headers: getAuthHeaders() });
      setPwdOpen(false);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password changed!");
    } catch (e) { alert("Failed to change password"); }
  };

  const initials = (profile?.name || "F").split(" ").map(x => x?.[0] || "").slice(0, 2).join("").toUpperCase();

  if (loading) return (
    <div className="lms-page-bg min-h-screen flex items-center justify-center flex-col">
      <Spinner />
      <p className="mt-4 text-slate-500 font-medium">Loading Profile...</p>
    </div>
  );

  return (
    <div className="lms-page-bg min-h-screen">
      <FacultyNavbar />

      <div className="pt-8 px-4 md:px-8 pb-12 max-w-[1600px] mx-auto space-y-8">

        {/* Header Profile Card */}
        <div className="lms-card p-6">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-pink-500 to-orange-500"></div>
          <div className="flex flex-col md:flex-row gap-8 items-center relative z-10">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 p-1 shadow-2xl">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-purple-600">
                  {initials}
                </div>
              </div>
              <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-500 border-4 border-white rounded-full"></div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">{profile?.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-slate-500 font-medium mb-4">
                <span className="flex items-center gap-1.5"><Mail size={16} /> {profile?.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={16} /> {profile?.phone || "No Phone"}</span>
                <span className="flex items-center gap-1.5"><User size={16} /> Faculty ID: {profile?.id}</span>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100 flex items-center gap-1">
                  <BookOpen size={14} /> {courses.length} Courses
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100 flex items-center gap-1">
                  <CheckCircle size={14} /> Active Status
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[160px]">
              <button onClick={() => setEditOpen(true)} className="flex items-center justify-center gap-2 px-6 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors">
                <Edit size={16} /> Edit Profile
              </button>
              <button onClick={() => setPwdOpen(true)} className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                <Lock size={16} /> Password
              </button>
            </div>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-100 w-fit shadow-sm">
          {['overview', 'analytics', 'settings'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${tab === t ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 mb-6">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Filter size={20} /></div>
                <select
                  className="flex-1 bg-transparent font-bold text-slate-700 outline-none"
                  value={selectedCourseId || ''}
                  onChange={e => setSelectedCourseId(e.target.value)}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.course_code})</option>)}
                </select>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Students" value={students.length} icon={Users} color="indigo" loading={analyticsLoading} />
              <StatCard title="Submissions" value={submissions.length} icon={FileText} color="pink" loading={analyticsLoading} />
              <StatCard title="Active Batches" value={batches.length} icon={Layers} color="emerald" loading={analyticsLoading} />
              <StatCard title="Question Bank" value={questionsWithBatchStates.length} icon={BookOpen} color="amber" loading={analyticsLoading} />
            </div>

            {/* Charts Section */}
            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Activity size={18} /> Submission Activity (Last 14 Days)</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={submissionsByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <RechartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChart size={18} /> Batch Distribution</h3>
              <div className="h-[300px]">
                {statsPerBatch.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statsPerBatch} dataKey="students" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                        {statsPerBatch.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartTooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">No batch data</div>
                )}
              </div>
            </div>

            {/* Batch Stats Table */}
            <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4">Batch Performance</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-slate-500 text-xs uppercase font-bold bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 rounded-l-lg">Batch Name</th>
                      <th className="px-6 py-4">Total Students</th>
                      <th className="px-6 py-4">Questions Active</th>
                      <th className="px-6 py-4 rounded-r-lg">Submissions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {statsPerBatch.map((b, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-700">{b.name}</td>
                        <td className="px-6 py-4 text-slate-600">{b.students}</td>
                        <td className="px-6 py-4 text-slate-600">{b.toggled}</td>
                        <td className="px-6 py-4 text-slate-600">{b.submissions}</td>
                      </tr>
                    ))}
                    {statsPerBatch.length === 0 && (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No batches found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'analytics' && (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
            <BarChart2 size={64} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-2xl font-bold text-slate-700 mb-2">Detailed Analytics</h3>
            <p className="text-slate-500 mb-6">Advanced reporting and export features coming soon.</p>
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 text-lg mb-6">Account Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-700">Update Contact Info</p>
                    <p className="text-sm text-slate-500">Change your email or phone number</p>
                  </div>
                  <button onClick={() => setEditOpen(true)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Edit</button>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-700">Security</p>
                    <p className="text-sm text-slate-500">Update your password</p>
                  </div>
                  <button onClick={() => setPwdOpen(true)} className="px-4 py-2 text-sm font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Change</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile"
        footer={<><button onClick={() => setEditOpen(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button><button onClick={handleSaveProfile} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Name</label><input className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Email</label><input className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Phone</label><input className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal isOpen={pwdOpen} onClose={() => setPwdOpen(false)} title="Change Password"
        footer={<><button onClick={() => setPwdOpen(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button><button onClick={handleChangePassword} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Update</button></>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Current Password</label><input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">New Password</label><input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Confirm New Password</label><input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} /></div>
        </div>
      </Modal>

    </div>
  );
}