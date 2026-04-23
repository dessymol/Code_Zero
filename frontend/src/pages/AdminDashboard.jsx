import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Search,
  RefreshCw,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Users,
  GraduationCap,
  User,
  TrendingUp,
  FileText,
  BarChart2,
  LayoutDashboard,
  X
} from 'lucide-react';

const API_BASE = 'http://localhost:3000/api';
const API_STUDENTS = 'http://localhost:3000/api/students';

const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function MiniDonut({ data, height = 120 }) {
  return (
    <div style={{ width: '100%', height: height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={Math.max(28, Math.floor(height * 0.28))}
            outerRadius={Math.max(48, Math.floor(height * 0.45))}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ title, value, icon, color, onClick, loading = false, subtitle }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-5 cursor-pointer h-full min-h-[132px] border border-slate-200 bg-white shadow-sm group"
      style={{
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div className="relative z-10 flex justify-between items-start h-full">
        <div className="flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-500">
            {title}
          </h3>
          <div
            className="text-4xl md:text-5xl font-bold mb-1"
            style={{
              color,
            }}
          >
            {loading ? '...' : value}
          </div>
          {subtitle && (
            <span className="text-xs md:text-sm font-medium text-slate-500 tracking-wide block">
              {subtitle}
            </span>
          )}
        </div>

        <div
          className="p-3 rounded-xl border border-slate-200 bg-slate-50"
          style={{
            color
          }}
        >
          {React.cloneElement(icon, {
            size: 28,
            color,
          })}
        </div>
      </div>
    </motion.div>
  );
}

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-4xl' }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm overflow-hidden" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className={`bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden border border-slate-200`}
        >
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">
                {title}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {children}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="lms-btn-secondary"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  // State declarations
  const [dashboardData, setDashboardData] = useState({
    courses: [],
    totalCourses: 0,
    totalFaculty: 0,
    totalStudents: 0
  });

  const [activeCourses, setActiveCourses] = useState([]);
  const [facultiesList, setFacultiesList] = useState([]);
  const [courseCounts, setCourseCounts] = useState({});
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Dialog states
  const [openCoursesDialog, setOpenCoursesDialog] = useState(false);
  const [openFacultiesDialog, setOpenFacultiesDialog] = useState(false);
  const [openStudentsDialog, setOpenStudentsDialog] = useState(false);

  // Students dialog states
  const [activeCoursesForStudents, setActiveCoursesForStudents] = useState([]);
  const [studentCourseId, setStudentCourseId] = useState('');
  const [batchNames, setBatchNames] = useState([]);
  const [batchCodesForName, setBatchCodesForName] = useState([]);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedBatchCode, setSelectedBatchCode] = useState('');
  const [studentsForDialog, setStudentsForDialog] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [batchListForCourse, setBatchListForCourse] = useState([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [sortKey, setSortKey] = useState('students');
  const [courseBarData, setCourseBarData] = useState([]);
  const [selectedCourseForBatches, setSelectedCourseForBatches] = useState(null);
  const [batchesDetailed, setBatchesDetailed] = useState([]);
  const [loadingBatchesDetailed, setLoadingBatchesDetailed] = useState(false);
  const [anchorElMenu, setAnchorElMenu] = useState(null); // Not typically used in Tailwind dropdowns the same way, but kept for logic if needed

  // Chart data states
  const [activeInactiveData, setActiveInactiveData] = useState([]);
  const [facultyPieData, setFacultyPieData] = useState([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoadingSummary(true);
      try {
        const [coursesRes, activeCoursesRes, facultyRes, studentsRes] = await Promise.all([
          axios.get(`${API_BASE}/courses/getActiveandInactiveCourses`),
          axios.get(`${API_BASE}/courses/get-all-courses`),
          axios.get(`${API_BASE}/v1/users/faculties`),
          axios.get(`${API_STUDENTS}/get-all-students`)
        ]);

        const allCourses = coursesRes.data?.courses || [];
        const active = activeCoursesRes.data?.courses || [];
        const faculties = facultyRes.data?.faculties || [];
        const students = studentsRes.data?.students || [];

        setDashboardData({
          courses: allCourses,
          totalCourses: allCourses.length,
          totalFaculty: faculties.length,
          totalStudents: students.length
        });

        setActiveCourses(Array.isArray(active) ? active : []);
        setFacultiesList(Array.isArray(faculties) ? faculties : []);

        const initialCounts = {};
        allCourses.forEach((c) => {
          initialCounts[c.id] = { facultyCount: 0, batchCount: 0, studentCount: 0, loading: true };
        });
        setCourseCounts(initialCounts);

        await Promise.all(allCourses.map(c => fetchCountsForCourse(c)));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchData();
  }, []);

  // Fetch counts for courses
  const fetchCountsForCourse = async (course) => {
    const cid = course.id;

    let facultyCount = 0;
    try {
      const res = await axios.get(`${API_BASE}/courses/${cid}/faculties`);
      const facs = res.data?.faculties ?? res.data ?? [];
      facultyCount = Array.isArray(facs) ? facs.length : 0;
    } catch (e) {
      facultyCount = 0;
    }

    let batchCount = 0;
    try {
      const bRes = await axios.get(`${API_STUDENTS}/batches/${cid}`);
      const batches = bRes.data?.batches || [];
      batchCount = batches.length;
    } catch (e) {
      batchCount = 0;
    }

    let studentCount = 0;
    try {
      const sc = await axios.get(`${API_STUDENTS}/by-course/${cid}`);
      const arr = sc.data?.students || [];
      studentCount = Array.isArray(arr) ? arr.length : 0;
    } catch (e) {
      studentCount = 0;
    }

    setCourseCounts(prev => ({
      ...prev,
      [cid]: {
        facultyCount,
        batchCount,
        studentCount,
        loading: false
      }
    }));
  };

  // Derive chart data
  useEffect(() => {
    const courses = dashboardData.courses || [];
    const arr = courses.map(c => ({
      id: c.id,
      name: c.name || c.title || c.course_code || `#${c.id}`,
      students: (courseCounts[c.id]?.studentCount) ?? 0,
      batches: (courseCounts[c.id]?.batchCount) ?? 0,
      faculties: (courseCounts[c.id]?.facultyCount) ?? 0,
      code: c.course_code || c.code || ''
    }));

    arr.sort((a, b) => {
      if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '');
      return (b[sortKey] || 0) - (a[sortKey] || 0);
    });

    setCourseBarData(arr);
    if (!selectedCourseForBatches && arr.length > 0) {
      setSelectedCourseForBatches(arr[0]);
    }

    const activeIds = new Set((activeCourses || []).map(x => x.id));
    let activeStudents = 0;
    let activeBatches = 0;
    let inactiveStudents = 0;
    let inactiveBatches = 0;
    let assignedSum = 0;

    for (const c of courses) {
      const cid = c.id;
      const counts = courseCounts[cid] || { studentCount: 0, batchCount: 0, facultyCount: 0 };
      const s = counts.studentCount || 0;
      const b = counts.batchCount || 0;
      const f = counts.facultyCount || 0;
      assignedSum += f;

      const isActive = typeof c.is_active === 'boolean' ? c.is_active : activeIds.has(cid);
      if (isActive) {
        activeStudents += s;
        activeBatches += b;
      } else {
        inactiveStudents += s;
        inactiveBatches += b;
      }
    }

    setActiveInactiveData([
      { name: 'Active', students: activeStudents, batches: activeBatches },
      { name: 'Inactive', students: inactiveStudents, batches: inactiveBatches }
    ]);

    const totalFaculty = dashboardData.totalFaculty || 0;
    const assignedUniqueEstimate = Math.min(totalFaculty, Math.round(assignedSum));
    const unassigned = Math.max(0, totalFaculty - assignedUniqueEstimate);
    setFacultyPieData([
      { name: 'Assigned', value: assignedUniqueEstimate },
      { name: 'Unassigned', value: unassigned }
    ]);
  }, [dashboardData.courses, courseCounts, activeCourses, dashboardData.totalFaculty, sortKey]);

  // Dialog handlers
  const openAllCourses = () => setOpenCoursesDialog(true);
  const openAllFaculties = () => setOpenFacultiesDialog(true);

  const openAllStudents = async () => {
    setStudentCourseId('');
    setBatchNames([]);
    setBatchCodesForName([]);
    setSelectedBatchName('');
    setSelectedBatchCode('');
    setStudentsForDialog([]);
    setBatchListForCourse([]);

    setOpenStudentsDialog(true);
    try {
      const res = await axios.get(`${API_BASE}/courses/get-all-courses`);
      const activeCourses = res.data?.courses || [];
      setActiveCoursesForStudents(Array.isArray(activeCourses) ? activeCourses : []);
    } catch (err) {
      console.error('Error fetching active courses for students dialog', err);
      setActiveCoursesForStudents([]);
    }
  };

  const goToCourseFaculties = (courseId) => navigate(`/admin/course/${courseId}/faculties`);
  const goToCourseStudents = (courseId) => navigate(`/admin/course/${courseId}/students`);
  const goToCourseSubmissions = (courseId) => navigate(`/admin/course/${courseId}/submissions`);

  const loadBatchesForStudentCourse = async (cid) => {
    if (!cid) {
      setBatchListForCourse([]);
      setBatchNames([]);
      setBatchCodesForName([]);
      return;
    }
    try {
      const res = await axios.get(`${API_STUDENTS}/batches/${cid}`);
      const arr = res.data?.batches || [];
      const batches = Array.isArray(arr) ? arr : [];
      setBatchListForCourse(batches);
      const names = Array.from(new Set(batches.map(b => b.name || '').filter(Boolean)));
      setBatchNames(names);
      setBatchCodesForName([]);
      setSelectedBatchName('');
      setSelectedBatchCode('');
      setStudentsForDialog([]);
    } catch (err) {
      console.error('loadBatchesForStudentCourse', err);
      setBatchListForCourse([]);
      setBatchNames([]);
      setBatchCodesForName([]);
    }
  };

  const onStudentCourseChange = async (cid) => {
    setStudentCourseId(cid);
    setStudentsForDialog([]);
    setSelectedBatchName('');
    setSelectedBatchCode('');
    setBatchCodesForName([]);
    await loadBatchesForStudentCourse(cid);

    if (cid) {
      await loadStudentsForCourse(cid, '');
    }
  };

  const fetchStudentsForBatchId = async (batch) => {
    if (!batch || !batch.id) return [];
    try {
      const res = await axios.get(`${API_STUDENTS}/batch/${batch.id}`);
      const arr = res.data?.students || [];
      const withBatch = arr.map((s) => {
        const existingBatches = Array.isArray(s.batches) ? s.batches.slice() : (Array.isArray(s.Batch) ? s.Batch.slice() : []);
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

  const loadStudentsForCourse = async (cid, batchIdParam = '') => {
    if (!cid) {
      setStudentsForDialog([]);
      return;
    }
    setStudentsLoading(true);
    try {
      if (batchIdParam) {
        const batch = batchListForCourse.find(b => String(b.id) === String(batchIdParam)) || { id: batchIdParam, name: '', code: '' };
        const studentsForBatch = await fetchStudentsForBatchId(batch);
        setStudentsForDialog(studentsForBatch);
        return;
      }

      if (selectedBatchName) {
        const matching = batchListForCourse.filter(b => (b.name || '') === selectedBatchName);
        if (matching.length === 0) {
          setStudentsForDialog([]);
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
        setStudentsForDialog(Array.from(map.values()));
        return;
      }

      try {
        const res = await axios.get(`${API_STUDENTS}/by-course/${cid}`);
        const arr = res.data?.students || [];
        const normalized = (Array.isArray(arr) ? arr : []).map(s => {
          const batchesFromResp = s.batches || s.Batches || [];
          return { ...s, batches: Array.isArray(batchesFromResp) ? batchesFromResp : [] };
        });
        setStudentsForDialog(normalized);
        return;
      } catch (err) {
        console.warn('by-course fallback, fetching per-batch', err);
      }

      if (batchListForCourse.length > 0) {
        const allArrays = await Promise.all(batchListForCourse.map(b => fetchStudentsForBatchId(b)));
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
        setStudentsForDialog(Array.from(map.values()));
        return;
      }

      setStudentsForDialog([]);
    } catch (err) {
      console.error('loadStudentsForCourse', err);
      setStudentsForDialog([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBatchName) {
      setBatchCodesForName([]);
      setSelectedBatchCode('');
      if (studentCourseId) loadStudentsForCourse(studentCourseId, '');
      return;
    }
    const codes = batchListForCourse.filter(b => (b.name || '') === selectedBatchName).map(b => ({ id: b.id, code: b.code }));
    codes.sort((a, b) => (a.code || '').toLowerCase().localeCompare((b.code || '').toLowerCase()));
    setBatchCodesForName(codes);
    setSelectedBatchCode('');
    if (studentCourseId) loadStudentsForCourse(studentCourseId, '');
  }, [selectedBatchName, batchListForCourse]);

  useEffect(() => {
    if (!selectedBatchCode || !studentCourseId) {
      if (studentCourseId) loadStudentsForCourse(studentCourseId, '');
      return;
    }
    const found = batchListForCourse.find(b => (b.code || '') === selectedBatchCode && ((selectedBatchName ? (b.name || '') === selectedBatchName : true)));
    const id = found?.id || '';
    if (id) {
      loadStudentsForCourse(studentCourseId, id);
    } else {
      loadStudentsForCourse(studentCourseId, '');
    }
  }, [selectedBatchCode]);

  // Batches detailed loader
  const loadBatchesDetailed = async (course) => {
    if (!course || !course.id) {
      setBatchesDetailed([]);
      return;
    }
    setLoadingBatchesDetailed(true);
    try {
      const res = await axios.get(`${API_STUDENTS}/batches/${course.id}`);
      const batches = res.data?.batches || [];
      const detailed = await Promise.all(batches.map(async (b) => {
        try {
          const sres = await axios.get(`${API_STUDENTS}/batch/${b.id}`);
          const students = sres.data?.students || [];
          return { ...b, studentCount: Array.isArray(students) ? students.length : 0, studentsList: Array.isArray(students) ? students : [], _open: false };
        } catch (err) {
          return { ...b, studentCount: 0, studentsList: [], _open: false };
        }
      }));
      setBatchesDetailed(detailed);
    } catch (err) {
      console.error('loadBatchesDetailed error', err);
      setBatchesDetailed([]);
    } finally {
      setLoadingBatchesDetailed(false);
    }
  };

  useEffect(() => {
    if (selectedCourseForBatches && selectedCourseForBatches.id) {
      loadBatchesDetailed(selectedCourseForBatches);
    } else if (courseBarData.length > 0) {
      setSelectedCourseForBatches(courseBarData[0]);
      loadBatchesDetailed(courseBarData[0]);
    } else {
      setBatchesDetailed([]);
    }
  }, [selectedCourseForBatches, courseBarData]);

  // Active-only left list
  const activeCourseIds = new Set((activeCourses || []).map(c => c.id));
  const filteredCourses = (courseBarData || [])
    .filter(c => activeCourseIds.has(c.id))
    .filter(c => {
      if (filterCourseId && String(c.id) !== String(filterCourseId)) return false;
      if (!searchQuery) return true;
      const q = (searchQuery || '').toLowerCase();
      return (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q);
    });

  const renderAssignedBatches = (s) => {
    const batches = s.batches || s.Batches || s.StudentBatches || [];
    if (!Array.isArray(batches) || batches.length === 0) return '-';
    return (
      <div className="flex flex-wrap gap-1">
        {batches.map((b, i) => {
          const label = `${b.code || b.name || ''}${b.name ? ` - ${b.name}` : ''}`.trim();
          return (
            <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
              {label}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <AdminLayout disableScroll={true}>
      <div className="fixed inset-0 top-16 overflow-auto lms-page-bg">
        <div className="lms-container py-6 md:py-8 min-h-full">

          {/* Header Card */}
          <div className="relative mb-8 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 md:p-7 relative z-10 flex flex-col md:flex-row items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <LayoutDashboard size={32} className="text-blue-700" />
              </div>

              <div className="text-center md:text-left flex-1">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                  Admin Dashboard
                </h1>
                <p className="text-slate-500 text-base md:text-lg">
                  Real-time analytics and management overview
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setLoadingSummary(true);
                    try {
                      const [coursesRes, activeCoursesRes, facultyRes, studentsRes] = await Promise.all([
                        axios.get(`${API_BASE}/courses/getActiveandInactiveCourses`),
                        axios.get(`${API_BASE}/courses/get-all-courses`),
                        axios.get(`${API_BASE}/v1/users/faculties`),
                        axios.get(`${API_STUDENTS}/get-all-students`)
                      ]);

                      const allCourses = coursesRes.data?.courses || [];
                      const active = activeCoursesRes.data?.courses || [];
                      const faculties = facultyRes.data?.faculties || [];
                      const students = studentsRes.data?.students || [];

                      setDashboardData({
                        courses: allCourses,
                        totalCourses: allCourses.length,
                        totalFaculty: faculties.length,
                        totalStudents: students.length
                      });
                      setActiveCourses(Array.isArray(active) ? active : []);
                      setFacultiesList(Array.isArray(faculties) ? faculties : []);
                    } catch (e) {
                      console.error('refresh dashboard error', e);
                    } finally {
                      setLoadingSummary(false);
                    }
                  }}
                  className="lms-btn-primary flex items-center gap-2"
                >
                  <RefreshCw size={18} className={loadingSummary ? 'animate-spin' : ''} />
                  <span>Refresh Data</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Total Courses"
              value={dashboardData.totalCourses}
              icon={<GraduationCap />}
              color="#6366f1"
              onClick={openAllCourses}
              loading={loadingSummary}
              subtitle="Active & Inactive"
            />
            <StatCard
              title="Total Faculty"
              value={dashboardData.totalFaculty}
              icon={<User />}
              color="#ec4899"
              onClick={openAllFaculties}
              loading={loadingSummary}
              subtitle="Teaching Staff"
            />
            <StatCard
              title="Total Students"
              value={dashboardData.totalStudents}
              icon={<Users />}
              color="#0ea5e9"
              onClick={openAllStudents}
              loading={loadingSummary}
              subtitle="Enrolled Learners"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left Column: Active Courses */}
            <div className="xl:col-span-1 space-y-6">
              {/* Filter Card */}
              <div className="lms-card p-5">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search courses..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <select
                      value={filterCourseId}
                      onChange={(e) => setFilterCourseId(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-medium text-slate-700 appearance-none cursor-pointer"
                    >
                      <option value="">All Courses</option>
                      {(dashboardData.courses || []).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.course_code || c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>

              {/* Active Courses List */}
              <div className="lms-card overflow-hidden flex flex-col max-h-[800px]">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Active Courses</h3>
                      <p className="text-sm text-slate-500 font-medium">Manage course activities</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {loadingSummary ? (
                    <div className="py-10 text-center text-slate-400">Loading courses...</div>
                  ) : filteredCourses.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 flex flex-col items-center">
                      <GraduationCap size={48} className="mb-3 opacity-20" />
                      <p>No active courses found</p>
                    </div>
                  ) : (
                    filteredCourses.map((course, idx) => {
                      const counts = courseCounts[course.id] || { facultyCount: 0, batchCount: 0, studentCount: 0, loading: true };
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={course.id}
                          className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0"
                              style={{ background: COLORS[idx % COLORS.length] }}
                            >
                              {(course.name || 'C').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-800 truncate mb-0.5">{course.name}</h4>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                {course.code || course.course_code || 'No code'}
                              </p>

                              <div className="flex flex-wrap gap-2 mb-4">
                                <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100">
                                  {counts.loading ? '...' : counts.facultyCount} Fac
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-100">
                                  {counts.loading ? '...' : counts.batchCount} Bat
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100">
                                  {counts.loading ? '...' : counts.studentCount} Stu
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => goToCourseFaculties(course.id)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  Faculty
                                </button>
                                <button
                                  onClick={() => goToCourseStudents(course.id)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-cyan-200 text-cyan-600 hover:bg-cyan-50 transition-colors"
                                >
                                  Students
                                </button>
                                <button
                                  onClick={() => goToCourseSubmissions(course.id)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                                >
                                  Subs
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Middle Column: Analytics */}
            <div className="xl:col-span-1 space-y-6">
              {/* Active vs Inactive */}
              <div className="lms-card p-6 flex flex-col h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-600">
                    <BarChart2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Course Analytics</h3>
                    <p className="text-sm text-slate-500 font-medium">Active vs Inactive</p>
                  </div>
                </div>

                <div className="flex-1 w-full min-h-0">
                  {activeInactiveData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeInactiveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} stroke="#64748b" tick={{ fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#64748b" tick={{ fontWeight: 600 }} />
                        <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
                        <Bar dataKey="students" name="Students" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30} />
                        <Bar dataKey="batches" name="Batches" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">Loading chart...</div>
                  )}
                </div>
              </div>

              {/* Faculty Allocation */}
              <div className="lms-card p-6 flex flex-col h-[400px]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                    <User size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Faculty Allocation</h3>
                    <p className="text-sm text-slate-500 font-medium">Assignment Overview</p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 flex-1">
                  <div className="w-full md:w-1/2 h-[180px]">
                    <MiniDonut data={facultyPieData} height={180} />
                  </div>
                  <div className="w-full md:w-1/2 space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Assigned</h4>
                      <div className="text-3xl font-black text-emerald-500">
                        {facultyPieData[0]?.value || 0}
                        <span className="text-lg text-slate-400 ml-1 font-bold">/ {dashboardData.totalFaculty}</span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Unassigned</h4>
                      <div className="text-3xl font-black text-pink-500">
                        {facultyPieData[1]?.value || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Batches & Directory */}
            <div className="xl:col-span-1 space-y-6">
              {/* Course Batches */}
              <div className="lms-card p-6 flex flex-col h-[500px]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Course Batches</h3>
                    <p className="text-sm text-slate-500 font-medium">Student groups</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <select
                      value={selectedCourseForBatches?.id || ''}
                      onChange={(e) => {
                        const found = courseBarData.find((x) => String(x.id) === String(e.target.value));
                        if (found) setSelectedCourseForBatches(found);
                      }}
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                    >
                      {courseBarData.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                <div className="flex-1 bg-white/50 rounded-xl border border-slate-100 overflow-hidden relative">
                  {loadingBatchesDetailed ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Loading batches...</div>
                  ) : batchesDetailed.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">No batches found</div>
                  ) : (
                    <div className="overflow-y-auto h-full p-2 space-y-2 custom-scrollbar">
                      {batchesDetailed.map((b) => (
                        <div key={b.id} className="bg-white p-3 rounded-xl border border-slate-100 hover:border-orange-200 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-bold text-slate-800 text-sm">{b.name}</h5>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100">
                              {b.code}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-500">{b.studentCount} Students</span>
                            <button
                              onClick={() => setBatchesDetailed(prev => prev.map(x => x.id === b.id ? { ...x, _open: !x._open } : x))}
                              className="text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1"
                            >
                              {b._open ? 'Hide' : 'View'} <ChevronDown size={12} className={`transform transition-transform ${b._open ? 'rotate-180' : ''}`} />
                            </button>
                          </div>

                          <AnimatePresence>
                            {b._open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-3 pt-3 border-t border-dashed border-slate-200 overflow-hidden"
                              >
                                {b.studentsList.length === 0 ? (
                                  <p className="text-center text-xs text-slate-400 italic">No students</p>
                                ) : (
                                  <div className="space-y-1 max-h-[150px] overflow-y-auto custom-scrollbar-thin">
                                    {b.studentsList.map((s, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs px-2 py-1 hover:bg-slate-50 rounded">
                                        <span className="text-slate-600 font-medium truncate max-w-[70%]">{s.name}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Faculty Directory Mini */}
              <div className="lms-card p-6 flex flex-col h-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-pink-100 text-pink-600">
                      <User size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Faculty</h3>
                  </div>
                  <button onClick={openAllFaculties} className="text-xs font-bold text-pink-600 hover:text-pink-700">View All</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {facultiesList.slice(0, 10).map((f, i) => (
                    <div key={i} onClick={() => navigate(`/admin/faculty/${f.id}`)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-pink-100 group">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md"
                        style={{ background: COLORS[i % COLORS.length] }}
                      >
                        {(f.name || 'F').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-700 group-hover:text-pink-600 transition-colors truncate">{f.name || f.fullname}</div>
                        <div className="text-[10px] font-medium text-slate-400 truncate">{f.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ALL COURSES MODAL */}
      <Modal isOpen={openCoursesDialog} onClose={() => setOpenCoursesDialog(false)} title="All Courses Overview" maxWidth="max-w-6xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">#</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Course Name</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Code</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Description</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(dashboardData.courses || []).map((c, i) => (
                <tr key={c.id || i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 text-sm font-bold text-gray-400">{i + 1}</td>
                  <td className="p-4 text-sm font-bold text-gray-800">{c.name}</td>
                  <td className="p-4 text-sm font-medium text-gray-600">{c.course_code || c.code || '-'}</td>
                  <td className="p-4 text-sm font-medium text-gray-500 max-w-xs truncate">{c.description || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${c.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ALL FACULTY MODAL */}
      <Modal isOpen={openFacultiesDialog} onClose={() => setOpenFacultiesDialog(false)} title="All Faculty Overview" maxWidth="max-w-6xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">#</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Name</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Email</th>
                <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(facultiesList || []).map((f, i) => (
                <tr key={f.id || i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 text-sm font-bold text-gray-400">{i + 1}</td>
                  <td className="p-4 text-sm font-bold text-gray-800">{f.name || f.fullname}</td>
                  <td className="p-4 text-sm font-medium text-gray-600">{f.email || '-'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${f.is_active !== false ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {f.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ALL STUDENTS MODAL */}
      <Modal isOpen={openStudentsDialog} onClose={() => setOpenStudentsDialog(false)} title="Students Overview" maxWidth="max-w-6xl">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Course</label>
              <div className="relative">
                <select
                  value={studentCourseId}
                  onChange={(e) => onStudentCourseChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm font-bold text-gray-700 appearance-none cursor-pointer"
                >
                  <option value="">All Courses</option>
                  {(activeCoursesForStudents || []).map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} - {course.course_code}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batch Name</label>
              <div className="relative">
                <select
                  value={selectedBatchName}
                  onChange={(e) => setSelectedBatchName(e.target.value)}
                  disabled={!studentCourseId}
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm font-bold text-gray-700 appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">All Batches</option>
                  {(batchNames || []).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Batch Code</label>
              <div className="relative">
                <select
                  value={selectedBatchCode}
                  onChange={(e) => setSelectedBatchCode(e.target.value)}
                  disabled={!selectedBatchName}
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-sm font-bold text-gray-700 appearance-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">All Codes</option>
                  {(batchCodesForName || []).map(b => (
                    <option key={b.code} value={b.code}>{b.code}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-gray-100 pt-4">
            {studentsLoading ? (
              <div className="py-10 text-center text-gray-400">Loading students...</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">#</th>
                    <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Student Name</th>
                    <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Email</th>
                    <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">ID</th>
                    <th className="p-4 text-xs font-black uppercase text-gray-500 tracking-wider">Batches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(studentsForDialog || []).map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm font-bold text-gray-400">{i + 1}</td>
                      <td className="p-4 text-sm font-bold text-gray-800">{s.name || s.student_name || 'Unnamed'}</td>
                      <td className="p-4 text-sm font-medium text-gray-600">{s.email || '-'}</td>
                      <td className="p-4 text-sm font-medium text-gray-500">{s.id || '-'}</td>
                      <td className="p-4">
                        {renderAssignedBatches(s)}
                      </td>
                    </tr>
                  ))}
                  {(studentsForDialog || []).length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">No students found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>

    </AdminLayout>
  );
}
