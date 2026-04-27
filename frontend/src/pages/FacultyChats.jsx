import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, MessageSquare, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';
import FacultyNavbar from './FacultyNavbar';

const API = 'http://localhost:3000/api';
const ACCENTS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

export default function FacultyChats() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/courses/faculty-courses`, { headers });
      const assignedCourses = Array.isArray(res.data?.courses) ? res.data.courses : [];
      const chatCards = await Promise.all(
        assignedCourses.map(async (course) => {
          try {
            const chatRes = await axios.get(`${API}/chats/course/${course.id}/faculty`, { headers });
            const payload = chatRes.data || {};
            const messages = Array.isArray(payload.messages)
              ? payload.messages
              : Array.isArray(payload.chats)
                ? payload.chats
                : Array.isArray(payload.data)
                  ? payload.data
                  : [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

            return {
              id: course.id,
              name: course.name || `Course ${course.id}`,
              code: course.course_code || course.code || '',
              messageCount: messages.length,
              lastMessage: lastMessage?.message || lastMessage?.text || 'No messages yet',
              lastTimestamp: lastMessage?.created_at || lastMessage?.createdAt || null,
            };
          } catch (error) {
            return {
              id: course.id,
              name: course.name || `Course ${course.id}`,
              code: course.course_code || course.code || '',
              messageCount: 0,
              lastMessage: 'Unable to load messages right now',
              lastTimestamp: null,
            };
          }
        })
      );

      setCourses(chatCards);
    } catch (error) {
      console.error('FacultyChats fetch error', error?.response?.data || error.message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  return (
    <>
      <FacultyNavbar />
      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container py-6">
          <div className="lms-card p-5 mb-6 border-l-4 border-l-blue-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
                <MessageSquare size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">Course Chats</h1>
                <p className="text-sm text-slate-500">Open a course conversation with admin</p>
              </div>
              <button
                onClick={fetchChats}
                disabled={loading}
                className="lms-btn-secondary gap-2 h-9 px-3 text-sm shrink-0"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="lms-card flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm font-medium">Loading chats...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="lms-card flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <BookOpen size={28} className="text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">No Courses Available</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                You do not have any assigned courses yet, so there are no chat rooms to open.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                >
                  <div className="h-1.5" style={{ background: ACCENTS[index % ACCENTS.length] }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                          style={{ background: ACCENTS[index % ACCENTS.length] }}
                        >
                          <MessageSquare size={18} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-800 text-base truncate">{course.name}</h3>
                          <p className="text-xs text-slate-500 font-medium">
                            {course.code || 'No course code'}
                          </p>
                        </div>
                      </div>
                      <span className="lms-badge lms-badge-blue text-xs">
                        {course.messageCount} msgs
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 mb-4 min-h-[84px]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                        Latest Message
                      </p>
                      <p className="text-sm text-slate-600 line-clamp-3">
                        {course.lastMessage}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {course.lastTimestamp
                          ? new Date(course.lastTimestamp).toLocaleString()
                          : 'No activity yet'}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/faculty/course/${course.id}/chat`)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                      style={{ background: ACCENTS[index % ACCENTS.length] }}
                    >
                      Open Chat
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
