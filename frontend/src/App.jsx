import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminCourseSubmissions = lazy(() => import('./pages/AdminCourseSubmissions'));
const AdminQuestionBanks = lazy(() => import('./pages/AdminQuestionBanks'));
const StudentManagement = lazy(() => import('./pages/StudentManagement'));
const CourseManagement = lazy(() => import('./pages/CourseManagement'));
const FacultyManagement = lazy(() => import('./pages/FacultyManagement'));
const BatchManagement = lazy(() => import('./pages/BatchManagement'));
const ChatRoom = lazy(() => import('./pages/ChatRoom'));
const AdminAllotedFaculties = lazy(() => import('./pages/AdminAllotedFaculties'));
const AdminStudentAlloted = lazy(() => import('./pages/AdminStudentAlloted'));
const AdminProfile = lazy(() => import('./pages/AdminProfile'));
const AddAdmin = lazy(() => import('./pages/AddAdmin'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard'));
const FacultyViewCourses = lazy(() => import('./pages/FacultyViewCourses'));
const FacultyEvaluate = lazy(() => import('./pages/FacultyEvaluate'));
const ManageQuestions = lazy(() => import('./pages/ManageQuestions'));
const FacultyChatView = lazy(() => import('./pages/FacultyChatView'));
const FacultyReports = lazy(() => import('./pages/FacultyReports'));
const FacultyViewSubmissions = lazy(() => import('./pages/FacultyViewSubmissions'));
const FacultyProfile = lazy(() => import('./pages/FacultyProfile'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const StudentSubmissions = lazy(() => import('./pages/StudentSubmissions'));
const StudentScore = lazy(() => import('./pages/StudentScore'));
const CodingPage = lazy(() => import('./pages/Codingpage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Setup = lazy(() => import('./pages/Setup'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3000';

const RouteLoader = () => (
  <div className="min-h-screen w-full lms-page-bg flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 text-sm font-medium">Loading…</p>
    </div>
  </div>
);

const InitGate = ({ initialized, children }) => {
  const location = useLocation();
  if (!initialized && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  if (initialized && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [initState, setInitState] = useState({ loading: true, initialized: true });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/auth/status`, { cache: 'no-store' });
        const data = await res.json();
        if (mounted) {
          setInitState({ loading: false, initialized: !!data.initialized });
        }
      } catch {
        if (mounted) setInitState({ loading: false, initialized: true });
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  if (initState.loading) return <RouteLoader />;

  return (
    <Suspense fallback={<RouteLoader />}>
      <InitGate initialized={initState.initialized}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<AdminLogin />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/faculty/login" element={<AdminLogin />} />
          <Route path="/student/login" element={<AdminLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin-forgot-password" element={<ForgotPassword />} />
          <Route path="/faculty-forgot-password" element={<ForgotPassword />} />
          <Route path="/student-forgot-password" element={<ForgotPassword />} />
          <Route path="/setup" element={<Setup />} />

        {/* Admin Routes */}
        <Route path="/super-admin/dashboard" element={<ProtectedRoute roles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/course/:courseId/submissions" element={<ProtectedRoute roles={['admin']}><AdminCourseSubmissions /></ProtectedRoute>} />
          <Route path="/admin/question-banks" element={<ProtectedRoute roles={['admin']}><AdminQuestionBanks /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute roles={['admin']}><StudentManagement /></ProtectedRoute>} />
          <Route path="/admin/courses" element={<ProtectedRoute roles={['admin']}><CourseManagement /></ProtectedRoute>} />
          <Route path="/admin/faculties" element={<ProtectedRoute roles={['admin']}><FacultyManagement /></ProtectedRoute>} />
          <Route path="/admin/batches" element={<ProtectedRoute roles={['admin']}><BatchManagement /></ProtectedRoute>} />
          <Route path="/admin/chats" element={<ProtectedRoute roles={['admin']}><ChatRoom /></ProtectedRoute>} />
          <Route path="/admin/course/:courseId/chat" element={<ProtectedRoute roles={['admin']}><ChatRoom /></ProtectedRoute>} />
          <Route path="/admin/course/:courseId/faculties" element={<ProtectedRoute roles={['admin']}><AdminAllotedFaculties /></ProtectedRoute>} />
          <Route path="/admin/course/:courseId/students" element={<ProtectedRoute roles={['admin']}><AdminStudentAlloted /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']}><AdminProfile /></ProtectedRoute>} />
          <Route path="/admin/add-admin" element={<ProtectedRoute roles={['admin']}><AddAdmin /></ProtectedRoute>} />

          {/* Faculty Routes */}
          <Route path="/faculty/dashboard" element={<ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
          <Route path="/faculty/view-courses" element={<ProtectedRoute roles={['faculty']}><FacultyViewCourses /></ProtectedRoute>} />
          <Route path="/faculty/evaluate/:courseId" element={<ProtectedRoute roles={['faculty']}><FacultyEvaluate /></ProtectedRoute>} />
          <Route path="/faculty/view-courses/:courseId" element={<ProtectedRoute roles={['faculty']}><ManageQuestions /></ProtectedRoute>} />
          <Route path="/faculty/chats" element={<ProtectedRoute roles={['faculty']}><FacultyChatView /></ProtectedRoute>} />
          <Route path="/faculty/course/:courseId/chat" element={<ProtectedRoute roles={['faculty']}><FacultyChatView /></ProtectedRoute>} />
          <Route path="/faculty/reports" element={<ProtectedRoute roles={['faculty']}><FacultyReports /></ProtectedRoute>} />
          <Route path="/faculty/view-submissions" element={<ProtectedRoute roles={['faculty']}><FacultyViewSubmissions /></ProtectedRoute>} />
          <Route path="/faculty/profile" element={<ProtectedRoute roles={['faculty']}><FacultyProfile /></ProtectedRoute>} />

          {/* Student Routes */}
          <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/exam/:courseId" element={<ProtectedRoute roles={['student']}><CodingPage /></ProtectedRoute>} />
          <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfile /></ProtectedRoute>} />
          <Route path="/student/submissions" element={<ProtectedRoute roles={['student']}><StudentSubmissions /></ProtectedRoute>} />
          <Route path="/student/score" element={<ProtectedRoute roles={['student']}><StudentScore /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </InitGate>
    </Suspense>
  );
}

export default App;
