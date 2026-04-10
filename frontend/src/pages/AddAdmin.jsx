import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, RefreshCw, Download,
  Users, Shield, Mail, Phone, Key,
  School, GraduationCap, LayoutDashboard, Filter, Activity, Terminal
} from "lucide-react"; // Using Lucide icons
import AdminLayout from "./AdminLayout";
import axios from "axios";

// Constants
const API_USERS = "http://localhost:3000/api/v1/users";
const API_COURSES = "http://localhost:3000/api/courses";
const API_STUDENTS = "http://localhost:3000/api/students";
const API_FACULTIES = "http://localhost:3000/api/v1/users/faculties";

const getAuthHeaders = () => {
  try {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const safeArray = (v) => Array.isArray(v) ? v : [];

export default function AddAdmin() {
  // Data State
  const [admins, setAdmins] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [faculties, setFaculties] = useState([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [debugLogs, setDebugLogs] = useState([]);

  // Form State
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });

  const pushDebug = useCallback((label, payload) => {
    setDebugLogs(prev => [{ ts: new Date().toLocaleString(), label, payload }, ...prev].slice(0, 200));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadingError("");
    try {
      const headers = getAuthHeaders();
      const [usersRes, coursesRes, studentsRes, facultiesRes] = await Promise.allSettled([
        axios.get(API_USERS, { headers }).catch(e => e),
        axios.get(`${API_COURSES}/get-all-courses`).catch(e => e),
        axios.get(`${API_STUDENTS}/get-all-students`).catch(e => e),
        axios.get(API_FACULTIES, { headers }).catch(e => e)
      ]);

      // Users/Admins
      if (usersRes.status === "fulfilled" && usersRes.value) {
        const raw = usersRes.value.data?.data ?? usersRes.value.data ?? usersRes.value;
        const arr = Array.isArray(raw) ? raw.filter(u => (u.role || "").toLowerCase() === "admin") : [];
        setAdmins(arr);
        pushDebug("GET /users", { ok: true, count: arr.length });
      } else {
        setAdmins([]);
        pushDebug("GET /users", { ok: false });
      }

      // Courses
      if (coursesRes.status === "fulfilled" && coursesRes.value) {
        const raw = coursesRes.value.data?.courses ?? coursesRes.value.data ?? coursesRes.value;
        setCourses(safeArray(raw));
        pushDebug("GET /courses", { ok: true, count: safeArray(raw).length });
      } else {
        setCourses([]);
        pushDebug("GET /courses", { ok: false });
      }

      // Students
      if (studentsRes.status === "fulfilled" && studentsRes.value) {
        const raw = studentsRes.value.data?.students ?? studentsRes.value.data ?? studentsRes.value;
        setStudents(safeArray(raw));
        pushDebug("GET /students", { ok: true, count: safeArray(raw).length });
      } else {
        setStudents([]);
        pushDebug("GET /students", { ok: false });
      }

      // Faculties
      if (facultiesRes.status === "fulfilled" && facultiesRes.value) {
        const raw = facultiesRes.value.data?.faculties ?? facultiesRes.value.data ?? facultiesRes.value;
        setFaculties(safeArray(raw));
        pushDebug("GET /faculties", { ok: true, count: safeArray(raw).length });
      } else {
        setFaculties([]);
        pushDebug("GET /faculties", { ok: false });
      }

    } catch (err) {
      setLoadingError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [pushDebug]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAdd = useCallback(async () => {
    setAddError(""); setSuccessMsg("");
    if (!form.name || !form.email || !form.phone || !form.password) {
      setAddError("All fields are required.");
      return;
    }
    setAdding(true);
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_USERS}/create-admin`, form, { headers });
      setSuccessMsg("Admin created successfully.");
      pushDebug("POST /users/create-admin", { ok: true });
      setForm({ name: "", email: "", phone: "", password: "" });
      await fetchAll();
    } catch (err) {
      setAddError(err.response?.data?.message || err.message || "Failed to create admin");
      pushDebug("POST /users/create-admin", { ok: false, error: err.message });
    } finally {
      setAdding(false);
    }
  }, [form, fetchAll, pushDebug]);

  const exportCSV = (rows, filename = "export.csv") => {
    try {
      const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const courseCounts = useMemo(() => {
    const map = {};
    // Initialize map with courses
    courses.forEach(c => {
      const id = c.id ?? c._id ?? c.courseId ?? c.course_id ?? c.course_code ?? c.code ?? c.name;
      if (id) map[String(id)] = { course: c, students: 0, faculties: 0, id: String(id) };
    });

    // Count students
    students.forEach(s => {
      const ids = [s.courseId, s.course_id, s.course];
      ids.forEach(i => { if (i && map[String(i)]) map[String(i)].students++; });

      const arr = s.courses ?? s.Courses ?? s.enrolledCourses ?? s.student_courses;
      if (Array.isArray(arr)) {
        arr.forEach(cc => {
          const cid = cc?.id ?? cc?._id ?? cc?.courseId ?? cc?.course_id ?? cc?.course_code ?? cc?.code;
          if (cid && map[String(cid)]) map[String(cid)].students++;
        });
      }
    });

    // Count faculties
    faculties.forEach(f => {
      const ids = [f.courseId, f.course_id, f.course];
      ids.forEach(i => { if (i && map[String(i)]) map[String(i)].faculties++; });

      const arr = f.courses ?? f.Courses ?? f.assignedCourses ?? f.faculty_courses;
      if (Array.isArray(arr)) {
        arr.forEach(cc => {
          const cid = cc?.id ?? cc?._id ?? cc?.courseId ?? cc?.course_id ?? cc?.course_code ?? cc?.code;
          if (cid && map[String(cid)]) map[String(cid)].faculties++;
        });
      }
    });

    return map;
  }, [courses, students, faculties]);

  const topCourses = useMemo(() => {
    const arr = Object.values(courseCounts).map(it => ({
      id: it.id,
      name: it.course?.name ?? it.course?.course_name ?? it.id,
      students: it.students || 0,
      faculties: it.faculties || 0
    }));
    arr.sort((a, b) => b.students - a.students);
    return arr.slice(0, 8);
  }, [courseCounts]);

  return (
    <AdminLayout>
      <div className="fixed inset-0 overflow-y-auto pt-16 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="min-h-full p-4 md:p-8">

          {/* Main Header Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-white/50 overflow-hidden mb-8 relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r bg-indigo-600" />
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg transform transition-transform">
                <LayoutDashboard size={40} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Admin Dashboard</h1>
                <p className="text-slate-500 font-medium text-lg">System analytics & administrator management</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => exportCSV([["Name", "Email", "Phone", "Created"], ...(admins.map(a => [a.name || "", a.email || "", a.phone || "", a.createdAt || ""]))], `admins_${new Date().toISOString().slice(0, 10)}.csv`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                >
                  <Download size={18} />
                  <span className="hidden md:inline">Export CSV</span>
                </button>
                <button
                  onClick={fetchAll}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-md"
                >
                  <RefreshCw size={18} />
                  <span className="hidden md:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {loadingError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <strong>Error loading data:</strong> {loadingError}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT COLUMN */}
            <div className="lg:col-span-4 space-y-8">

              {/* Create Admin Form */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-slate-800">Create Admin</h2>
                      <p className="text-xs text-slate-500 font-medium">Add new administrator access</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {addError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-medium">
                      {addError}
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium">
                      {successMsg}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all"
                          placeholder="John Admin"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="email"
                          value={form.email}
                          onChange={e => setForm({ ...form, email: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all"
                          placeholder="admin@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={form.phone}
                          onChange={e => setForm({ ...form, phone: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all"
                          placeholder="+1 234 567 890"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="password"
                          value={form.password}
                          onChange={e => setForm({ ...form, password: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={() => setForm({ name: "", email: "", phone: "", password: "" })}
                      className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="flex-[2] py-2.5 bg-gradient-to-r bg-indigo-600 text-slate-600 font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {adding ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
                      Create Admin
                    </button>
                  </div>
                </div>
              </div>

              {/* System Overview KPIs */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={20} className="text-indigo-500" />
                  System Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <School size={18} />
                      </div>
                      <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Total Courses</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{courses.length}</div>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Students</div>
                    <div className="text-2xl font-black text-emerald-600">{students.length}</div>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Faculties</div>
                    <div className="text-2xl font-black text-amber-600">{faculties.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-8 space-y-8">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Top Courses */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <GraduationCap className="text-purple-500" size={20} />
                      Top Courses
                    </h3>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar space-y-3">
                    {loading ? (
                      <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-slate-300" /></div>
                    ) : topCourses.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">No data available</div>
                    ) : (
                      topCourses.map((c, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors group">
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-indigo-600 text-sm shadow-sm">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <h4 className="font-bold text-slate-700 truncate text-sm">{c.name}</h4>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">{c.students} Students</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                style={{ width: `${Math.min(100, (c.students / (Math.max(...topCourses.map(x => x.students)) || 1)) * 100)}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] text-slate-400 font-medium">
                              {c.faculties} Faculties
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Admins Overview */}
                <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <Shield className="text-emerald-500" size={20} />
                      Admin List
                    </h3>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                    {admins.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">No admins found</div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 font-bold uppercase border-b border-slate-100">
                          <tr>
                            <th className="pb-3 pl-2">Name</th>
                            <th className="pb-3">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {admins.map((a, i) => (
                            <tr key={i} className="group">
                              <td className="py-3 pl-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">
                                    {(a.name || "A")[0]}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-700">{a.name}</div>
                                    <div className="text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="text-xs text-slate-500 font-medium">{a.email}</div>
                                <div className="text-[10px] text-slate-400">{a.phone}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              {/* System Logs */}
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                    <Terminal size={16} className="text-slate-400" />
                    System Logs
                  </h3>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                    {debugLogs.length} events
                  </span>
                </div>
                <div className="bg-slate-900 text-slate-300 p-4 font-mono text-xs max-h-[200px] overflow-y-auto custom-scrollbar">
                  {debugLogs.length === 0 ? (
                    <div className="text-slate-600 italic">No logs generated yet...</div>
                  ) : debugLogs.map((log, i) => (
                    <div key={i} className="mb-1.5 border-b border-slate-800/50 pb-1.5 last:border-0 last:mb-0 last:pb-0">
                      <span className="text-emerald-500 mr-2">[{log.ts}]</span>
                      <span className="text-indigo-400 font-bold mr-2">{log.label}</span>
                      <span className="text-slate-400">
                        {typeof log.payload === 'object' ? JSON.stringify(log.payload) : log.payload}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}