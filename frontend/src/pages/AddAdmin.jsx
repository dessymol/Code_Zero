import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Plus,
  RefreshCw,
  Download,
  Users,
  Shield,
  Mail,
  Phone,
  Key,
  School,
  GraduationCap,
  LayoutDashboard,
  Activity,
  Terminal,
  UserCog
} from 'lucide-react';
import AdminLayout from './AdminLayout';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:5000';
const API_USERS = `${API_ORIGIN}/api/v1/users`;
const API_ALL_USERS = `${API_USERS}/all-users`;
const API_COURSES = `${API_ORIGIN}/api/courses`;
const API_STUDENTS = `${API_ORIGIN}/api/students`;
const API_FACULTIES = `${API_USERS}/faculties`;
const getCourseWithFacultiesUrl = (courseId) => `${API_COURSES}/${courseId}/with-faculties`;
const getStudentsByCourseUrl = (courseId) => `${API_STUDENTS}/by-course/${courseId}`;

const getAuthHeaders = () => {
  try {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const getResponseData = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const getRequestErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unexpected request failure';

const getCreatedDate = (item) => item?.createdAt || item?.created_at || item?.created_on || '';

const getEntityId = (item) =>
  item?.id ?? item?._id ?? item?.courseId ?? item?.course_id ?? item?.course_code ?? item?.code ?? item?.name;

export default function AddAdmin() {
  const [admins, setAdmins] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [faculties, setFaculties] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  const pushDebug = useCallback((label, payload) => {
    setDebugLogs((prev) => [{ ts: new Date().toLocaleString(), label, payload }, ...prev].slice(0, 200));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadingError('');

    try {
      const headers = getAuthHeaders();
      const [usersRes, coursesRes, studentsRes, facultiesRes] = await Promise.all([
        axios.get(API_ALL_USERS, { headers }),
        axios.get(`${API_COURSES}/get-all-courses`, { headers }),
        axios.get(`${API_STUDENTS}/get-all-students`, { headers }),
        axios.get(API_FACULTIES, { headers })
      ]);

      const allUsers = getResponseData(usersRes.data, ['data', 'users']);
      const baseCourses = getResponseData(coursesRes.data, ['courses', 'data']);
      const allStudents = getResponseData(studentsRes.data, ['students', 'data']);
      const allFaculties = getResponseData(facultiesRes.data, ['faculties', 'data']);

      const adminsOnly = safeArray(allUsers).filter((user) =>
        ['admin', 'super_admin'].includes(String(user.role || '').toLowerCase())
      );

      const enrichedCourses = await Promise.all(
        safeArray(baseCourses).map(async (course) => {
          const courseId = getEntityId(course);
          if (!courseId) return course;

          try {
            const [courseWithFacultiesRes, studentsByCourseRes] = await Promise.all([
              axios.get(getCourseWithFacultiesUrl(courseId), { headers }),
              axios.get(getStudentsByCourseUrl(courseId), { headers })
            ]);

            const courseWithFaculties =
              courseWithFacultiesRes.data?.course ||
              courseWithFacultiesRes.data?.data ||
              courseWithFacultiesRes.data ||
              {};

            const studentsByCourse = getResponseData(studentsByCourseRes.data, ['students', 'data']);

            return {
              ...course,
              ...courseWithFaculties,
              Faculties: safeArray(courseWithFaculties.Faculties || courseWithFaculties.faculties),
              CourseStudents: safeArray(studentsByCourse)
            };
          } catch (error) {
            pushDebug(`GET /courses/${courseId}/details`, {
              ok: false,
              error: getRequestErrorMessage(error)
            });

            return {
              ...course,
              Faculties: safeArray(course.Faculties || course.faculties),
              CourseStudents: safeArray(course.CourseStudents || course.students)
            };
          }
        })
      );

      setAdmins(adminsOnly);
      setCourses(enrichedCourses);
      setStudents(safeArray(allStudents));
      setFaculties(safeArray(allFaculties));

      pushDebug('GET /users/all-users', { ok: true, count: adminsOnly.length });
      pushDebug('GET /courses/get-all-courses', { ok: true, count: enrichedCourses.length });
      pushDebug('GET /students/get-all-students', { ok: true, count: safeArray(allStudents).length });
      pushDebug('GET /users/faculties', { ok: true, count: safeArray(allFaculties).length });
    } catch (error) {
      const message = getRequestErrorMessage(error);
      setLoadingError(message);
      pushDebug('FETCH admin dashboard data', { ok: false, error: message });
      setAdmins([]);
      setCourses([]);
      setStudents([]);
      setFaculties([]);
    } finally {
      setLoading(false);
    }
  }, [pushDebug]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAdd = useCallback(async () => {
    setAddError('');
    setSuccessMsg('');

    if (!form.name || !form.email || !form.phone || !form.password) {
      setAddError('All fields are required.');
      return;
    }

    setAdding(true);
    try {
      await axios.post(`${API_USERS}/create-admin`, form, { headers: getAuthHeaders() });
      setSuccessMsg('Admin created successfully.');
      pushDebug('POST /users/create-admin', { ok: true });
      setForm({ name: '', email: '', phone: '', password: '' });
      await fetchAll();
    } catch (error) {
      const message = getRequestErrorMessage(error);
      setAddError(message);
      pushDebug('POST /users/create-admin', { ok: false, error: message });
    } finally {
      setAdding(false);
    }
  }, [fetchAll, form, pushDebug]);

  const exportCSV = (rows, filename = 'export.csv') => {
    try {
      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      pushDebug('EXPORT admins csv', { ok: false, error: String(error?.message || error) });
    }
  };

  const courseCounts = useMemo(() => {
    const map = {};

    courses.forEach((course) => {
      const id = getEntityId(course);
      if (!id) return;

      map[String(id)] = {
        id: String(id),
        course,
        students: safeArray(course.CourseStudents).length,
        faculties: safeArray(course.Faculties).length
      };
    });

    students.forEach((student) => {
      const relatedIds = [student.courseId, student.course_id, student.course];
      relatedIds.forEach((courseId) => {
        if (courseId && map[String(courseId)] && map[String(courseId)].students === 0) {
          map[String(courseId)].students += 1;
        }
      });
    });

    faculties.forEach((faculty) => {
      const relatedIds = [faculty.courseId, faculty.course_id, faculty.course];
      relatedIds.forEach((courseId) => {
        if (courseId && map[String(courseId)] && map[String(courseId)].faculties === 0) {
          map[String(courseId)].faculties += 1;
        }
      });
    });

    return map;
  }, [courses, students, faculties]);

  const topCourses = useMemo(() => {
    const items = Object.values(courseCounts).map((entry) => ({
      id: entry.id,
      name: entry.course?.name || entry.course?.course_name || entry.id,
      students: entry.students || 0,
      faculties: entry.faculties || 0
    }));

    items.sort((first, second) => second.students - first.students || second.faculties - first.faculties);
    return items.slice(0, 8);
  }, [courseCounts]);

  const maxStudents = useMemo(
    () => Math.max(1, ...topCourses.map((course) => course.students || 0)),
    [topCourses]
  );

  return (
    <AdminLayout>
      <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-indigo-50 via-white to-cyan-50 pt-16">
        <div className="min-h-full p-4 md:p-8">
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/60 bg-white shadow-xl">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500" />
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white shadow-lg">
                <LayoutDashboard size={38} />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-black tracking-tight text-slate-800">Admin Dashboard</h1>
                <p className="mt-2 text-slate-500">Administrator management, course insights, and live data checks.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    exportCSV(
                      [['Name', 'Email', 'Phone', 'Role', 'Created'], ...admins.map((admin) => [
                        admin.name || '',
                        admin.email || '',
                        admin.phone || '',
                        admin.role || '',
                        getCreatedDate(admin)
                      ])],
                      `admins_${new Date().toISOString().slice(0, 10)}.csv`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  onClick={fetchAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {loadingError && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {loadingError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-4">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                <div className="border-b border-slate-100 bg-slate-50/80 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Create Admin</h2>
                      <p className="text-xs font-medium text-slate-500">Add new admin access</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  {addError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                      {addError}
                    </div>
                  )}
                  {successMsg && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                      {successMsg}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Full Name
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        placeholder="John Admin"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                        placeholder="admin@example.com"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(event) => setForm({ ...form, phone: event.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setForm({ name: '', email: '', phone: '', password: '' })}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 font-bold text-slate-600 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 py-2.5 font-bold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {adding ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                      Create Admin
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Activity size={20} className="text-indigo-500" />
                  System Overview
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-cyan-50 p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                        <School size={18} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-800">Total Courses</span>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{courses.length}</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Students</div>
                    <div className="mt-1 text-2xl font-black text-emerald-600">{students.length}</div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Faculties</div>
                    <div className="mt-1 text-2xl font-black text-amber-600">{faculties.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8 lg:col-span-8">
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50/80 p-6">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                      <GraduationCap size={20} className="text-violet-500" />
                      Top Courses
                    </h3>
                  </div>

                  <div className="max-h-[420px] space-y-3 overflow-y-auto p-4">
                    {loading ? (
                      <div className="flex justify-center py-12">
                        <RefreshCw className="animate-spin text-slate-300" />
                      </div>
                    ) : topCourses.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">No course data available</div>
                    ) : (
                      topCourses.map((course) => (
                        <div
                          key={course.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-indigo-200"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-black text-slate-800">{course.name}</h4>
                              <p className="mt-1 text-xs text-slate-500">
                                {course.faculties} faculties assigned
                              </p>
                            </div>
                            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                              {course.students} students
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                              style={{ width: `${Math.min(100, (course.students / maxStudents) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50/80 p-6">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                      <UserCog size={20} className="text-emerald-500" />
                      Admin List
                    </h3>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-4">
                    {admins.length === 0 ? (
                      <div className="py-10 text-center text-slate-400">No admin users found</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="pb-3 pl-2">Name</th>
                            <th className="pb-3">Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {admins.map((admin) => (
                            <tr key={admin.id}>
                              <td className="py-3 pl-2">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                    {(admin.name || 'A').slice(0, 1).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-700">{admin.name || 'Unnamed admin'}</div>
                                    <div className="text-[11px] text-slate-400">
                                      {new Date(getCreatedDate(admin) || Date.now()).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="text-xs font-medium text-slate-500">{admin.email || 'No email'}</div>
                                <div className="text-[11px] text-slate-400">{admin.phone || 'No phone'}</div>
                                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                                  {String(admin.role || 'admin').replace(/_/g, ' ')}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Terminal size={16} className="text-slate-400" />
                    System Logs
                  </h3>
                  <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                    {debugLogs.length} events
                  </span>
                </div>

                <div className="max-h-[220px] overflow-y-auto bg-slate-950 p-4 font-mono text-xs text-slate-300">
                  {debugLogs.length === 0 ? (
                    <div className="italic text-slate-500">No logs generated yet...</div>
                  ) : (
                    debugLogs.map((log, index) => (
                      <div key={`${log.ts}-${index}`} className="mb-2 border-b border-slate-800/70 pb-2 last:mb-0 last:border-0 last:pb-0">
                        <span className="mr-2 text-emerald-400">[{log.ts}]</span>
                        <span className="mr-2 font-bold text-cyan-400">{log.label}</span>
                        <span className="text-slate-400">
                          {typeof log.payload === 'object' ? JSON.stringify(log.payload) : String(log.payload)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
