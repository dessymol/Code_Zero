import React, { useEffect, useRef, useState } from 'react';
import { Send, RefreshCw, MessageCircle, Circle, Search, Hash } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import FacultyNavbar from './FacultyNavbar';

const API_BASE = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

export default function FacultyChatView() {
  const { courseId: urlCourseId } = useParams();

  // State
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState('');

  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const endRef = useRef(null);
  const socketRef = useRef(null);
  const chatContainerRef = useRef(null);

  const token = localStorage.getItem('token') || '';
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  // --- Utilities ---
  const messageKey = (m) => {
    if (!m) return '';
    if (m.id !== undefined && m.id !== null) return `id:${m.id}`;
    const uid = m.user_id ?? m.sender_id ?? m.userId ?? 'unknown';
    const txt = (m.message ?? m.msg ?? '').slice(0, 200);
    const t = m.created_at ?? m.createdAt ?? m.time ?? '';
    return `fallback:${uid}|${txt}|${t}`;
  };

  const appendMessageDedup = (msg) => {
    if (!msg) return;
    setMessages((prev) => {
      const setKeys = new Set(prev.map(messageKey));
      const k = messageKey(msg);
      if (setKeys.has(k)) return prev;
      return [...prev, msg];
    });
  };

  const formatMessageTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMs < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRandomColor = (name) => {
    const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500'];
    const idx = (name || '').length % colors.length;
    return colors[idx];
  };

  // --- Fetch Courses ---
  const fetchCoursesFromBackend = async (headers) => {
    const res = await axios.get(`${API_BASE}/api/courses/faculty-courses`, { headers });
    const d = res.data;
    if (Array.isArray(d?.courses)) return d.courses;
    if (Array.isArray(d)) return d;
    return [];
  };

  useEffect(() => {
    let cancelled = false;
    const loadCourses = async () => {
      setLoadingCourses(true);
      setCoursesError('');
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const raw = await fetchCoursesFromBackend(headers);
        if (cancelled) return;
        const normalized = (raw || []).map(c => ({
          course_id: c.id ?? c.course_id ?? c.courseId ?? null,
          course_name: c.name ?? c.course_name ?? c.title ?? '',
          course_code: c.course_code ?? c.code ?? c.courseCode ?? '',
        })).filter(Boolean);

        setCourses(normalized);

        if (urlCourseId) {
          const found = normalized.find(x => String(x.course_id) === String(urlCourseId));
          if (found) setSelectedCourse(found);
          else if (normalized.length > 0) setSelectedCourse(normalized[0]);
        } else if (normalized.length > 0) {
          setSelectedCourse(normalized[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setCourses([]);
          setCoursesError('Failed to load courses.');
        }
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    };

    loadCourses();
    return () => { cancelled = true; };
  }, [urlCourseId]);

  // --- Socket Logic ---
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = s;

    s.on('connect', () => {
      setIsConnected(true);
      if (selectedCourse?.course_id) {
        s.emit('joinCourse', selectedCourse.course_id);
      }
    });

    s.on('disconnect', () => setIsConnected(false));
    s.on('connect_error', () => setIsConnected(false));
    s.on('userCountUpdate', (count) => setOnlineUsers(count));

    s.on('chatHistory', (hist) => {
      if (Array.isArray(hist)) {
        setMessages((prev) => {
          const existing = new Set(prev.map(messageKey));
          const merged = [...prev];
          hist.forEach((m) => {
            if (!existing.has(messageKey(m))) merged.push(m);
          });
          return merged.sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0));
        });
      }
    });

    s.on('newCourseMessage', (msg) => appendMessageDedup(msg));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourse || !socketRef.current) return;
    if (socketRef.current.connected) {
      socketRef.current.emit('joinCourse', selectedCourse.course_id);
    }
  }, [selectedCourse]);

  // --- Load Messages ---
  useEffect(() => {
    if (!selectedCourse) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const loadMessages = async () => {
      setLoadingMessages(true);
      setMessagesError('');
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_BASE}/api/chats/course/${selectedCourse.course_id}/faculty`, { headers });
        if (!cancelled) {
          setMessages(Array.isArray(res.data.messages || res.data) ? (res.data.messages || res.data) : []);
        }
        if (socketRef.current?.connected) {
          socketRef.current.emit('joinCourse', selectedCourse.course_id);
        }
      } catch (err) {
        if (!cancelled) {
          setMessages([]);
          setMessagesError('Could not sync history.');
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
      if (socketRef.current?.connected) {
        socketRef.current.emit('leaveCourse', selectedCourse?.course_id);
      }
    };
  }, [selectedCourse?.course_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Send Message ---
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!selectedCourse) return;
    const txt = (input || '').trim();
    if (!txt) return;

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Optimistic append if socket is live
      if (socketRef.current?.connected) {
        socketRef.current.emit('sendMessage', {
          courseId: selectedCourse.course_id,
          message: txt,
          userId: storedUser.id,
          senderName: storedUser.name || 'Faculty',
          senderRole: storedUser.role || 'faculty'
        });
        setInput('');
      } else {
        // REST fallback
        const res = await axios.post(
          `${API_BASE}/api/chats/course/${selectedCourse.course_id}/faculty`,
          { message: txt },
          { headers }
        );
        const created = res.data.data ?? res.data.message ?? res.data;
        appendMessageDedup(created);
        setInput('');
      }
    } catch (err) {
      setMessagesError('Failed to send message.');
    }
  };

  const resolveSenderName = (m, isMe) => {
    if (isMe) return 'You';
    return m.sender_name || m.senderName || m.User?.name || m.user?.name || 'Unknown';
  };

  return (
    <>
      <FacultyNavbar />
      <div className="lms-page-bg min-h-screen pt-1 pb-12">
        <div className="lms-container">
          <div className="h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">

            {/* Top Header Bar */}
            <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">Course Chat</h1>
                  <p className="text-xs text-slate-500 font-medium">
                    {isConnected ? <span className="text-emerald-500 flex items-center gap-1"><Circle size={6} fill="currentColor" /> Live</span> : <span className="text-rose-500">Connecting...</span>}
                    {selectedCourse && ` - ${selectedCourse.course_name}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">

              {/* Sidebar - Course List */}
              <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-slate-700 mb-2 px-1">Courses</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search courses..."
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {loadingCourses ? (
                    <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                  ) : courses.map(course => (
                    <button
                      key={course.course_id}
                      onClick={() => setSelectedCourse(course)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${selectedCourse?.course_id === course.course_id
                          ? 'bg-white shadow-md border border-indigo-100'
                          : 'hover:bg-slate-200/50'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${selectedCourse?.course_id === course.course_id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                        }`}>
                        {course.course_code?.substring(0, 2) || <Hash size={16} />}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className={`font-bold text-sm truncate ${selectedCourse?.course_id === course.course_id ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {course.course_name}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono truncate">{course.course_code}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-slate-100/50 relative">

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar" ref={chatContainerRef}>
                  {loadingMessages ? (
                    <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-indigo-400" /></div>
                  ) : !selectedCourse ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <MessageCircle size={48} className="mb-4 opacity-50" />
                      <p>Select a course to start chatting</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <p>No messages yet. Be the first to say hello!</p>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const myId = String(storedUser.id || '');
                      const msgUserId = String(m.user_id ?? m.sender_id ?? m.userId ?? '');
                      const isMe = msgUserId && myId && msgUserId === myId;
                      const name = resolveSenderName(m, isMe);

                      return (
                        <div key={m.id || i} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isMe && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${getRandomColor(name)}`}>
                              {name[0]}
                            </div>
                          )}

                          <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                              {!isMe && <span className="text-xs font-bold text-slate-600">{name}</span>}
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                {formatMessageTime(m.created_at || m.createdAt)}
                              </span>
                            </div>

                            <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${isMe
                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                              }`}>
                              {m.message || m.msg}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {/* Input Area */}
                {selectedCourse && (
                  <div className="p-4 bg-white border-t border-slate-200">
                    <form onSubmit={handleSend} className="flex gap-2 items-end max-w-4xl mx-auto">
                      <div className="flex-1 bg-slate-100 rounded-2xl p-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                        <input
                          type="text"
                          value={input}
                          onChange={e => setInput(e.target.value)}
                          placeholder={`Message #${selectedCourse.course_name}...`}
                          className="w-full bg-transparent border-none focus:ring-0 px-3 py-1.5 text-slate-700 placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
                      >
                        <Send size={20} />
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
