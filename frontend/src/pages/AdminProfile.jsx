import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import axios from "axios";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import {
  Users, BookOpen, GraduationCap, Edit, Lock, Download,
  Search, Filter, ChevronDown, CheckCircle, X, Shield,
  Mail, Phone, Calendar, PieChart as PieChartIcon, Activity, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_USERS = "http://localhost:3000/api/v1/users";
const API_COURSES = "http://localhost:3000/api/courses";
const API_STUDENTS = "http://localhost:3000/api/students";
const API_FACULTIES = "http://localhost:3000/api/v1/users/faculties";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

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
  const baseClass = "flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  const sizeClass = size === 'small' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const variants = {
    primary: "lms-btn-primary",
    secondary: "lms-btn-secondary",
    ghost: "inline-flex items-center gap-2 rounded-xl font-bold bg-transparent text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${sizeClass} ${variants[variant]}`}>
      {Icon && <Icon size={size === 'small' ? 14 : 18} strokeWidth={2.5} />}
      {label}
    </button>
  );
};

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
  const getColorClasses = (c) => {
    switch (c) {
      case 'indigo': return 'from-indigo-500 to-purple-600 text-indigo-50 bg-indigo-50 border-indigo-100';
      case 'purple': return 'from-purple-500 to-pink-600 text-purple-50 bg-purple-50 border-purple-100';
      case 'cyan': return 'from-cyan-500 to-blue-600 text-cyan-50 bg-cyan-50 border-cyan-100';
      default: return 'from-slate-500 to-slate-600 text-slate-50 bg-slate-50 border-slate-100';
    }
  };

  // Custom color mapping just for gradient bg
  const bgGradient = color === 'indigo' ? 'bg-indigo-50' : color === 'purple' ? 'bg-purple-50' : 'bg-cyan-50';
  const border = color === 'indigo' ? 'border-indigo-100' : color === 'purple' ? 'border-purple-100' : 'border-cyan-100';
  const iconGradient = color === 'indigo' ? 'from-indigo-500 to-purple-600' : color === 'purple' ? 'from-purple-500 to-pink-600' : 'from-cyan-500 to-blue-600';
  const textGradient = color === 'indigo' ? 'from-indigo-600 to-purple-600' : color === 'purple' ? 'from-purple-600 to-pink-600' : 'from-cyan-600 to-blue-600';

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} ${bgGradient} p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}>
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">{title}</p>
          <h3 className={`text-3xl font-black bg-gradient-to-r ${textGradient} bg-clip-text text-transparent`}>
            {value}
          </h3>
          {subtitle && <p className="text-xs font-semibold text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${iconGradient} text-white shadow-lg`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

// Data Helpers
const getId = (obj) => {
  if (obj == null) return null;
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  return obj.id ?? obj._id ?? obj.courseId ?? obj.course_id ?? obj._id?.$oid ?? null;
};
const asKey = (s) => (s == null ? null : String(s).trim().toLowerCase());

export default function AdminProfile() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [students, setStudents] = useState([]);

  const [courseSearch, setCourseSearch] = useState("");
  const [courseSortBy, setCourseSortBy] = useState("name");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdErrors, setPwdErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [meRes, coursesRes, facultiesRes, studentsRes] = await Promise.allSettled([
          axios.get(`${API_USERS}/me`, { headers }).catch(e => e),
          axios.get(`${API_COURSES}/get-all-courses`).catch(e => e),
          axios.get(API_FACULTIES, { headers }).catch(e => e),
          axios.get(`${API_STUDENTS}/get-all-students`).catch(e => e),
        ]);

        if (!mounted) return;

        if (meRes.status === "fulfilled" && meRes.value?.data) {
          const me = meRes.value.data?.data ?? meRes.value.data ?? null;
          setProfile(me);
          setEditForm({ name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "" });
        }

        const getArr = (res) => {
          if (res.status !== 'fulfilled' || !res.value) return [];
          const d = res.value.data;
          if (d?.courses && Array.isArray(d.courses)) return d.courses;
          if (d?.faculties && Array.isArray(d.faculties)) return d.faculties;
          if (d?.students && Array.isArray(d.students)) return d.students;
          if (Array.isArray(d)) return d;
          return [];
        };

        setCourses(getArr(coursesRes));
        setFaculties(getArr(facultiesRes));
        setStudents(getArr(studentsRes));

      } catch (err) {
        console.error("load error", err);
        setLoadError("Unexpected error while loading admin page.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Compute logic (kept from original)
  const { courseCountsMap, unassignedCounts } = useMemo(() => {
    const byId = {}; const byCode = {}; const byName = {};
    (courses || []).forEach(c => {
      const id = getId(c) ?? Math.random().toString(36).slice(2);
      const idStr = String(id);
      byId[idStr] = { course: c, studentCount: 0, facultyCount: 0, reportedStudentCount: c.studentCount ?? c.studentsCount ?? c.enrolled ?? null };
      const codeKey = asKey(c.course_code ?? c.code ?? c.courseCode);
      if (codeKey) byCode[codeKey] = idStr;
      const nameKey = asKey(c.name ?? c.title ?? c.course_name);
      if (nameKey) byName[nameKey] = idStr;
    });

    let unassignedStudents = 0; let unassignedFaculties = 0;
    const matchCourseIdFrom = (val) => {
      if (val == null) return null;
      const id = getId(val);
      if (id != null && byId[String(id)]) return String(id);
      const s = String(val).trim();
      const codeKey = asKey(val?.code ?? val?.course_code ?? s);
      if (codeKey && byCode[codeKey]) return byCode[codeKey];
      const nameKey = asKey(val?.name ?? val?.title ?? s);
      if (nameKey && byName[nameKey]) return byName[nameKey];
      return null;
    };

    const extractCourseIdsFromEntity = (ent) => {
      const found = new Set();
      const singleFields = ["courseId", "course_id", "course", "assignedCourse", "assigned_course"];
      for (const f of singleFields) {
        const v = ent[f];
        if (v != null) {
          if (Array.isArray(v)) { v.forEach(item => { const mid = matchCourseIdFrom(item); if (mid) found.add(mid); }); }
          else { const mid = matchCourseIdFrom(v); if (mid) found.add(mid); }
        }
      }
      return Array.from(found);
    };

    (students || []).forEach(s => {
      let ids = extractCourseIdsFromEntity(s);
      if (ids.length === 0) {
        const direct = s.course ?? s.Course ?? null;
        const mid = matchCourseIdFrom(direct ?? s);
        if (mid) ids.push(mid);
      }
      if (ids.length === 0) unassignedStudents += 1;
      else ids.forEach(id => { if (byId[id]) byId[id].studentCount += 1; });
    });

    (faculties || []).forEach(f => {
      const ids = extractCourseIdsFromEntity(f);
      if (ids.length === 0) unassignedFaculties += 1;
      else ids.forEach(id => { if (byId[id]) byId[id].facultyCount += 1; });
    });

    return { courseCountsMap: byId, unassignedCounts: { students: unassignedStudents, faculties: unassignedFaculties } };
  }, [courses, students, faculties]);

  const courseEnrollments = useMemo(() => {
    const arr = Object.keys(courseCountsMap).map(id => {
      const item = courseCountsMap[id];
      const name = item.course?.name ?? item.course?.title ?? item.course?.course_name ?? `Course ${id}`;
      return { id, name: name.substring(0, 15) + '...', full_name: name, value: item.studentCount ?? 0 };
    }).sort((a, b) => b.value - a.value);
    return arr.slice(0, 6).length ? arr.slice(0, 6) : [{ id: "nodata", name: "No data", value: 0 }];
  }, [courseCountsMap]);

  const signupsByDay = useMemo(() => {
    const days = 14; const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    (students || []).forEach(s => {
      const dt = s.createdAt ?? s.created_at ?? s.timestamp ?? s.joinedAt ?? s.created;
      if (!dt) return;
      const d = new Date(dt); if (isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      if (map[key] != null) map[key] += 1;
    });
    return Object.keys(map).map(k => ({ date: k.slice(5), count: map[k] }));
  }, [students]);

  const facultyByDept = useMemo(() => {
    const m = {};
    (faculties || []).forEach(f => {
      const dept = f.department ?? f.dept ?? f.role ?? "Unknown";
      m[dept] = (m[dept] || 0) + 1;
    });
    return Object.keys(m).map((k, i) => ({ name: k, value: m[k], color: COLORS[i % COLORS.length] }));
  }, [faculties]);

  const filteredCourses = useMemo(() => {
    const q = (courseSearch || "").trim().toLowerCase();
    const arr = (courses || []).map(c => {
      const id = getId(c) ?? Math.random().toString(36).slice(2);
      const mapEntry = courseCountsMap[String(id)] ?? { studentCount: 0, facultyCount: 0 };
      return {
        ...c,
        id,
        computedStudents: mapEntry.studentCount ?? 0,
        computedFaculties: mapEntry.facultyCount ?? 0,
        reportedStudents: c.studentCount ?? c.studentsCount ?? c.enrolled ?? null
      };
    }).filter(c => {
      if (!q) return true;
      const name = (c.name ?? c.course_name ?? c.title ?? "").toString().toLowerCase();
      const code = (c.course_code ?? c.code ?? "").toString().toLowerCase();
      return name.includes(q) || code.includes(q);
    });
    if (courseSortBy === "students") return arr.sort((a, b) => (b.computedStudents || 0) - (a.computedStudents || 0));
    return arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [courses, courseCountsMap, courseSearch, courseSortBy]);

  const exportCSV = (rows, filename) => {
    const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_USERS}/me`, { name: editForm.name, email: editForm.email, phone: editForm.phone }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const r = await axios.get(`${API_USERS}/me`, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(r?.data?.data ?? r?.data ?? null);
      setEditOpen(false);
      alert('Profile updated');
    } catch (err) {
      alert('Update failed');
    }
  };

  const handleChangePassword = async () => {
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_USERS}/change-password`, { currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPwdOpen(false);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert('Password changed');
    } catch (err) {
      alert('Password change failed');
    }
  };

  if (loading) return <AdminLayout><div className="flex justify-center items-center h-screen"><div className="animate-spin text-indigo-600"><RefreshCw size={40} /></div></div></AdminLayout>;
  if (loadError) return <AdminLayout><div className="p-8 text-center text-red-500">{loadError}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="bg-slate-50 min-h-screen pb-10">

        {/* Profile Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-8 shadow-sm mb-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-indigo-50 shadow-xl">
              {(profile?.name || "A").substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-slate-900 mb-1">{profile?.name || "Administrator"}</h1>
              <p className="text-slate-500 font-medium mb-3">{profile?.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold border border-indigo-100 flex items-center gap-1.5"><Shield size={14} /> Admin</span>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-100 flex items-center gap-1.5"><CheckCircle size={14} /> Active</span>
              </div>
            </div>
            <div className="flex gap-3">
              <ActionButton icon={Edit} label="Edit" variant="ghost" onClick={() => setEditOpen(true)} />
              <ActionButton icon={Lock} label="Password" variant="ghost" onClick={() => setPwdOpen(true)} />
              <ActionButton icon={Download} label="Export System Data" onClick={() => exportCSV([["Course", "Code", "Count"], ...filteredCourses.map(c => [c.name, c.computedStudents])], "system_data.csv")} />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Total Courses" value={courses.length} icon={BookOpen} color="indigo" subtitle="Active academic courses" />
            <StatCard title="Faculty Members" value={faculties.length} icon={Users} color="purple" subtitle="Teaching & support staff" />
            <StatCard title="Enrolled Students" value={students.length} icon={GraduationCap} color="cyan" subtitle="Across all batches" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enrollment Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Activity size={18} className="text-indigo-500" /> Enrollment Trends</h3>
                <select className="text-xs border rounded-lg px-2 py-1 bg-slate-50 outline-none"><option>Last 14 Days</option></select>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={signupsByDay}>
                    <defs>
                      <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Courses */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><PieChartIcon size={18} className="text-purple-500" /> Top Courses</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courseEnrollments} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Course Data Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-800">System Course Overview</h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={courseSortBy}
                  onChange={e => setCourseSortBy(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                >
                  <option value="name">Sort by Name</option>
                  <option value="students">Sort by Students</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-3 font-bold">Course Name</th>
                    <th className="px-6 py-3 font-bold">Code</th>
                    <th className="px-6 py-3 font-bold">Calculated Students</th>
                    <th className="px-6 py-3 font-bold">Calculated Faculties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.slice(0, 50).map((c, i) => (
                    <tr key={c.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-3 text-slate-500 font-mono text-xs">{c.course_code || c.code}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.computedStudents > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                          {c.computedStudents}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-500">{c.computedFaculties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 text-center text-xs text-slate-400 lms-page-bg/30 border-t border-slate-100">
                Showing top {Math.min(filteredCourses.length, 50)} of {filteredCourses.length} courses
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
            <input type="email" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setEditOpen(false)} />
            <ActionButton label="Save Changes" onClick={handleSaveProfile} />
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={pwdOpen} onClose={() => setPwdOpen(false)} title="Change Password">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Current Password</label>
            <input type="password" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
            <input type="password" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Confirm New Password</label>
            <input type="password" className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={pwdForm.confirmPassword} onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} />
            {pwdErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{pwdErrors.confirmPassword}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setPwdOpen(false)} />
            <ActionButton label="Change Password" onClick={handleChangePassword} />
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}