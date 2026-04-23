import React, { useEffect, useMemo, useState } from "react";
import {
  Users, BookOpen, Clock, Edit, Lock, Trash2,
  CheckCircle, AlertCircle, PieChart as PieChartIcon,
  Activity, Shield, Medal, Book, Upload, ChevronDown,
  ChevronRight, Calendar, Phone, Mail
} from "lucide-react";
import StudentNavbar from "./StudentNavbar";
import axios from "axios";
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../utils/auth';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "http://localhost:3000/api";
const API_ME = `${API_BASE}/students/me`;
const API_COURSES_WITH_EXAMS = `${API_BASE}/students/courses-with-exams`;
const API_SUBMISSIONS_MINE = `${API_BASE}/submissions/mine`;
const API_CHANGE_PASSWORD = `${API_BASE}/students/change-password`;
const API_UPDATE_ME = `${API_BASE}/students/me`;

const STATUS_COLORS = {
  accepted: "#10b981",
  pending: "#f59e0b",
  rejected: "#ef4444"
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
          className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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

const ActionButton = ({ onClick, icon: Icon, label, variant = 'primary', disabled = false, size = 'normal', fullWidth = false }) => {
  const baseClass = "flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  const sizeClass = size === 'small' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const widthClass = fullWidth ? 'w-full' : '';
  const variants = {
    primary: "lms-btn-primary",
    secondary: "lms-btn-secondary",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
    ghost: "bg-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${sizeClass} ${widthClass} ${variants[variant]}`}>
      {Icon && <Icon size={size === 'small' ? 14 : 18} strokeWidth={2.5} />}
      {label}
    </button>
  );
};

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
  const getColors = (c) => {
    switch (c) {
      case 'indigo': return { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', iconBg: 'bg-indigo-100' };
      case 'emerald': return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', iconBg: 'bg-emerald-100' };
      case 'cyan': return { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100', iconBg: 'bg-cyan-100' };
      case 'amber': return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', iconBg: 'bg-amber-100' };
      default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', iconBg: 'bg-slate-100' };
    }
  };
  const theme = getColors(color);

  return (
    <div className={`p-6 rounded-2xl border ${theme.border} ${theme.bg} flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-1 h-full`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${theme.iconBg} ${theme.text}`}>
          <Icon size={24} />
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full bg-white/60 ${theme.text}`}>
          {subtitle}
        </span>
      </div>
      <div>
        <h4 className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">{title}</h4>
        <p className={`text-3xl font-black ${theme.text}`}>{value}</p>
      </div>
    </div>
  );
};

export default function StudentProfile() {
  const navigate = useNavigate();

  // loading & data
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [fetchDebug, setFetchDebug] = useState([]);
  const [error, setError] = useState("");

  // UI state
  const [tab, setTab] = useState("overview"); // overview, submissions, settings
  const [coursesOpen, setCoursesOpen] = useState(true);

  // dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  // form state
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [deletingAccount, setDeletingAccount] = useState(false);

  // debug helper
  const debug = (label, obj) => {
    const entry = { ts: new Date().toISOString(), label, data: obj };
    // console.log("STUDENTPROFILE DEBUG:", label, obj); 
    setFetchDebug(prev => [entry, ...prev].slice(0, 60));
  };

  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      setError("");
      debug("start-fetch", "starting sequential fetches");
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const r = await axios.get(API_ME, { headers });
        const me = r?.data?.data ?? r?.data ?? null;
        if (mounted) {
          setProfile(me);
          setEditForm({ name: me?.name || "", phone: me?.phone || "" });
        }
      } catch (err) { debug("GET /students/me ERROR", err); }

      try {
        const r = await axios.get(API_COURSES_WITH_EXAMS, { headers });
        const raw = r?.data?.courses ?? r?.data?.data ?? r?.data ?? [];
        if (mounted) setCourses(Array.isArray(raw) ? raw : []);
      } catch (err) { debug("GET /students/courses-with-exams ERROR", err); }

      try {
        const r = await axios.get(API_SUBMISSIONS_MINE, { headers });
        const payload = r?.data ?? {};
        let arr = [];
        if (Array.isArray(payload)) arr = payload;
        else if (Array.isArray(payload.submissions)) arr = payload.submissions;
        else if (Array.isArray(payload.data)) arr = payload.data;
        else if (Array.isArray(payload.items)) arr = payload.items;

        arr = arr.slice().sort((a, b) => new Date(b?.createdAt ?? 0).getTime() - new Date(a?.createdAt ?? 0).getTime());
        if (mounted) setSubmissions(arr);
      } catch (err) {
        debug("GET /submissions/mine ERROR", err);
        if (err?.response?.status !== 404) setError("Failed to fetch submissions");
      }

      if (mounted) setLoading(false);
    }

    loadAll();
    return () => { mounted = false; };
  }, []);

  // derived metrics
  const submissionCount = Array.isArray(submissions) ? submissions.length : 0;
  const acceptedCount = Array.isArray(submissions) ? submissions.filter(s => ((s?.status || "") + "").toLowerCase() === "accepted").length : 0;
  const totalScore = Array.isArray(submissions) ? submissions.reduce((sum, s) => {
    if (((s?.status || "") + "").toLowerCase() === "accepted") {
      const sc = Number(s?.score);
      return sum + (Number.isNaN(sc) ? 0 : sc);
    }
    return sum;
  }, 0) : 0;

  const acceptanceRate = submissionCount > 0 ? Math.round((acceptedCount / submissionCount) * 100) : 0;

  const topCourse = (() => {
    if (courses.length) {
      const c = courses[0];
      return { name: c?.course_name || c?.name || c?.title || "", code: c?.course_code || c?.code || "" };
    }
    return { name: "", code: "" };
  })();

  const batch = (() => {
    if (profile) {
      if (Array.isArray(profile.batches) && profile.batches.length) return profile.batches[0];
      if (profile.batchName) return { name: profile.batchName, code: profile.batch_code || "" };
    }
    return { name: "N/A", code: "" };
  })();

  const activityData = useMemo(() => {
    const days = 30;
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      map[date.toISOString().slice(0, 10)] = 0;
    }
    (submissions || []).forEach(s => {
      const dt = s?.createdAt ?? s?.created_at ?? s?.created_at_date ?? null;
      if (!dt) return;
      const key = new Date(dt).toISOString().slice(0, 10);
      if (map[key] != null) map[key] += 1;
    });
    return Object.keys(map).map(k => ({ date: k, count: map[k] }));
  }, [submissions]);

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(API_UPDATE_ME, { name: editForm.name, phone: editForm.phone }, { headers: { Authorization: `Bearer ${token}` } });
      const r = await axios.get(API_ME, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(r?.data?.data ?? r?.data ?? null);
      setEditOpen(false);
      alert("Profile updated successfully");
    } catch (err) {
      alert("Failed to save profile");
    }
  };

  const handleChangePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword || !pwdForm.confirmPassword) return alert("Fill all fields");
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return alert("Passwords do not match");
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        API_CHANGE_PASSWORD,
        { currentPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Password changed successfully");
      setPwdOpen(false);
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      alert("Failed to change password");
    }
  };

  const handleDeleteAccount = async () => {
    const proceed = window.confirm("Delete your account permanently? This cannot be undone.");
    if (!proceed) return;

    setDeletingAccount(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/students/me`, { headers: { Authorization: `Bearer ${token}` } });
      clearSession();
      navigate('/');
    } catch (err) {
      alert("Failed to delete account");
      setDeletingAccount(false);
    }
  };

  const initials = (profile?.name || "S").split(" ").map(x => x?.[0] || "").slice(0, 2).join("").toUpperCase() || "S";

  if (loading) return (
    <div className="lms-page-bg min-h-screen flex flex-col">
      <StudentNavbar />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin text-indigo-600"><Upload size={40} /></div>
        <p className="text-slate-500 font-medium">Loading profile...</p>
      </div>
    </div>
  );

  return (
    <div className="lms-page-bg min-h-screen pb-12 pt-1">
      <StudentNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8 border border-white/50 relative">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r bg-emerald-600"></div>
          <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-emerald-600 p-1 shadow-2xl">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-4xl font-black text-transparent bg-clip-text bg-emerald-600 uppercase">
                  {initials}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 bg-green-500 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center">
                <CheckCircle size={16} className="text-white fill-green-500" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-2">
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">{profile?.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-4 text-slate-500 font-medium">
                <span className="flex items-center gap-1.5"><Mail size={16} /> {profile?.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={16} /> {profile?.phone || "No phone"}</span>
                <span className="flex items-center gap-1.5"><Shield size={16} /> Student ID: {profile?.id}</span>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4 pt-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100 shadow-sm flex items-center gap-1">
                  <Users size={14} /> {batch.name || "No Batch"}
                </span>
                {topCourse.name && (
                  <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-bold border border-purple-100 shadow-sm flex items-center gap-1">
                    <BookOpen size={14} /> {topCourse.name}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 min-w-[160px]">
              <ActionButton icon={Edit} label="Edit Profile" variant="ghost" onClick={() => { setEditForm({ name: profile?.name || "", phone: profile?.phone || "" }); setEditOpen(true); }} fullWidth />
              <ActionButton icon={Lock} label="Change Password" variant="primary" onClick={() => setPwdOpen(true)} fullWidth />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-8 bg-white p-1 rounded-xl shadow-sm border border-slate-100 w-fit">
          {['overview', 'submissions', 'settings'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all capitalize ${tab === t ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Score" value={totalScore} icon={Medal} color="indigo" subtitle={`${acceptedCount} Accepted`} />
                <StatCard title="Submissions" value={submissionCount} icon={Upload} color="emerald" subtitle={`${acceptanceRate}% Success Rate`} />
                <StatCard title="Courses" value={courses.length} icon={Book} color="cyan" subtitle="Active" />
                <StatCard title="Performance" value={`${acceptanceRate}%`} icon={Activity} color="amber" subtitle="Overall" />
              </div>

              <div className="md:col-span-3 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Activity size={18} /> Submission Activity</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activityData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                        <RechartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={18} /> Recent Submissions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-50/50">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg">Problem</th>
                          <th className="px-4 py-3">Language</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 rounded-r-lg text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {submissions.slice(0, 5).map((s, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-700">{s.Question?.title || s.title || `Problem ${s.question_id}`}</td>
                            <td className="px-4 py-3 text-slate-500">{s.language || "Unknown"}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChartIcon size={18} /> Breakdown</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[{ name: 'Accepted', value: acceptedCount }, { name: 'Other', value: submissionCount - acceptedCount }]} dataKey="value" innerRadius={40} outerRadius={70}>
                          <Cell fill={STATUS_COLORS.accepted} />
                          <Cell fill={STATUS_COLORS.pending} />
                        </Pie>
                        <RechartTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Accepted</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Other</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><BookOpen size={18} /> My Courses</h3>
                  <div className="space-y-2">
                    {courses.map((c, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="font-bold text-slate-800 text-sm mb-0.5">{c.name || c.course_name}</p>
                        <p className="text-xs text-slate-500">{c.code || c.course_code}</p>
                      </div>
                    ))}
                    {courses.length === 0 && <p className="text-slate-400 text-sm italic text-center py-4">No courses assigned</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'submissions' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800">All Submissions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                    <tr>
                      <th className="px-6 py-4">Question</th>
                      <th className="px-6 py-4">Language</th>
                      <th className="px-6 py-4">Result</th>
                      <th className="px-6 py-4 text-right">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-700">{s.Question?.title || s.title || `Question ID: ${s.question_id}`}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-600">{s.language}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${s.status === 'accepted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            {s.status === 'accepted' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                            {s.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {submissions.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-400">No submissions found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-4">Account Actions</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">Update Profile</p>
                      <p className="text-sm text-slate-500">Change your name or contact info</p>
                    </div>
                    <ActionButton icon={Edit} label="Edit" size="small" variant="secondary" onClick={() => setEditOpen(true)} />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-800">Change Password</p>
                      <p className="text-sm text-slate-500">Update your login credentials</p>
                    </div>
                    <ActionButton icon={Lock} label="Update" size="small" variant="secondary" onClick={() => setPwdOpen(true)} />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                    <div>
                      <p className="font-bold text-red-700">Delete Account</p>
                      <p className="text-sm text-red-500">Permanently remove your data</p>
                    </div>
                    <ActionButton icon={Trash2} label="Delete" size="small" variant="danger" onClick={handleDeleteAccount} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Name</label>
            <input className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
            <input className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setEditOpen(false)} />
            <ActionButton label="Save Changes" onClick={handleSaveProfile} />
          </div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal isOpen={pwdOpen} onClose={() => setPwdOpen(false)} title="Change Password">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Current Password</label>
            <input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.oldPassword} onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
            <input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Confirm New Password</label>
            <input type="password" className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setPwdOpen(false)} />
            <ActionButton label="Change Password" onClick={handleChangePassword} />
          </div>
        </div>
      </Modal>

    </div>
  );
}
