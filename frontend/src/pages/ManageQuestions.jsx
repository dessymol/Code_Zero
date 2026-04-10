import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, RefreshCw, Edit, Trash2, Code, Send,
  MessageCircle, Users, Award, FileText, CheckCircle,
  X, ChevronDown, Monitor, Search, Lock, Unlock, Hash
} from 'lucide-react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import FacultyNavbar from './FacultyNavbar';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

const LANGUAGES = [
  { id: 62, name: 'Java', color: '#f89820', icon: '☕' },
  { id: 71, name: 'Python', color: '#3776ab', icon: '🐍' },
  { id: 63, name: 'JavaScript', color: '#f7df1e', icon: '⚡' },
  { id: 54, name: 'C++', color: '#00599c', icon: '⚙️' },
  { id: 50, name: 'C', color: '#a8b9cc', icon: '🔧' },
  { id: 70, name: 'Python3', color: '#3776ab', icon: '🐍' },
];

// --- Reuseable Components ---

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

const ActionButton = ({ onClick, icon: Icon, label, variant = 'primary', disabled = false, size = 'normal', fullWidth = false }) => {
  const baseClass = "flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";
  const sizeClass = size === 'small' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const widthClass = fullWidth ? 'w-full' : '';
  const variants = {
    primary: "lms-btn-primary",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
    ghost: "bg-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50",
    danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseClass} ${sizeClass} ${widthClass} ${variants[variant]}`}>
      {Icon && <Icon size={size === 'small' ? 14 : 18} strokeWidth={2.5} />}
      {label}
    </button>
  );
};

export default function ManageQuestions() {
  const { courseId } = useParams();
  const token = localStorage.getItem('token') || '';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [batches, setBatches] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState({});

  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: '', description: '', sample_input: '', sample_output: '', language_id: LANGUAGES[0].id, score: 100,
  });
  const [saving, setSaving] = useState(false);

  const selectedBatchId = selectedTab === 0 ? null : batches[selectedTab - 1]?.id;
  const chatIndex = batches.length + 1;

  // --- Logic Helpers ---

  const getScore = (q) => {
    if (!q) return null;
    const candidates = [q.score, q.raw?.score, q.raw?.points, q.raw?.marks];
    for (const c of candidates) {
      if (c != null && !isNaN(c)) return Number(c);
    }
    return null;
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const bRes = await axios.get(`${API}/students/batches/${courseId}`, { headers }).catch(() => ({ data: { batches: [] } }));
      setBatches(bRes.data?.batches || []);

      let qRes;
      try { qRes = await axios.get(`${API}/questions/bank/${courseId}?includeBatches=1`, { headers }); }
      catch {
        try { qRes = await axios.get(`${API}/questions/course/${courseId}`, { headers }); }
        catch { qRes = { data: [] }; }
      }

      const raw = Array.isArray(qRes.data) ? qRes.data : (qRes.data?.questions || qRes.data?.data || []);
      const normalized = raw.map(q => {
        const r = q.question || q;
        return {
          id: r.id ?? r.question_id ?? r._id,
          title: r.title,
          description: r.description,
          sample_input: r.sample_input,
          sample_output: r.sample_output,
          language_id: r.language_id ?? r.languageId ?? LANGUAGES[0].id,
          language: r.language,
          score: r.score ?? r.points ?? r.marks ?? 100,
          raw: r,
          batch_states: q.batch_states || q.batchStates || {}
        };
      }).filter(Boolean);

      setQuestions(normalized);
      setSelectedTab(0);
    } catch (err) {
      console.error(err);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (courseId) fetchAll(); }, [courseId]);

  const handleToggle = async (questionId, batchId, currentEnabled) => {
    const key = `${questionId}_${batchId}`;
    setToggling(prev => ({ ...prev, [key]: true }));
    try {
      await axios.post(`${API}/questions/${questionId}/batch/${batchId}/toggle`, {}, { headers });
      setQuestions(prev => prev.map(q => {
        if (String(q.id) !== String(questionId)) return q;
        const bs = { ...q.batch_states };
        bs[batchId] = { ...bs[batchId], enabled: !currentEnabled, toggled_at: new Date().toISOString() };
        return { ...q, batch_states: bs };
      }));
    } catch {
      alert('Toggle failed');
    } finally {
      setToggling(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.language_id) return alert('Fill required fields');
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description,
        sample_input: form.sample_input, sample_output: form.sample_output,
        language_id: Number(form.language_id), score: Number(form.score),
        course_id: Number(courseId)
      };
      if (editing) {
        await axios.put(`${API}/questions/update/${editing}`, payload, { headers });
      } else {
        await axios.post(`${API}/questions/add`, payload, { headers });
      }
      setOpenDialog(false);
      setEditing(null);
      await fetchAll();
    } catch (e) { alert('Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete question?')) return;
    try {
      await axios.delete(`${API}/questions/delete/${id}`, { headers });
      await fetchAll();
    } catch { alert('Delete failed'); }
  };

  // --- Chat Logic ---
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket'], auth: token ? { token } : undefined });
    socketRef.current = s;
    s.on('newCourseMessage', (msg) => {
      if (selectedTab === chatIndex && String(msg.course_id || msg.courseId) === String(courseId)) {
        setChatMessages(prev => [...prev, msg].filter((v, i, a) => a.findIndex(t => (t.id === v.id) || (t.message === v.message && t.created_at === v.created_at)) === i));
      }
    });
    s.on('chatHistory', h => Array.isArray(h) && setChatMessages(h));
    return () => s.disconnect();
  }, [token, courseId, selectedTab, chatIndex]);

  useEffect(() => {
    if (selectedTab === chatIndex) {
      if (socketRef.current) socketRef.current.emit('joinCourse', courseId);
      axios.get(`${API}/chats/course/${courseId}/faculty`, { headers })
        .then(res => setChatMessages(res.data.messages || res.data.data || []))
        .catch(() => setChatMessages([]));
    } else {
      if (socketRef.current) socketRef.current.emit('leaveCourse', courseId);
    }
  }, [selectedTab, courseId, chatIndex]);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [chatMessages]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    try {
      await axios.post(`${API}/chats/course/${courseId}/faculty`, {
        message: chatInput, userId: storedUser.id, senderName: storedUser.name, senderRole: storedUser.role || 'faculty'
      }, { headers });
      setChatInput('');
    } catch { alert('Message failed'); }
  };

  // --- Render Helpers ---

  const getLangStyles = (lid) => {
    const l = LANGUAGES.find(x => x.id === Number(lid)) || LANGUAGES[0];
    return { color: l.color, name: l.name, icon: l.icon };
  };

  return (
    <div className="lms-page-bg min-h-screen">
      <FacultyNavbar />

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 mb-2">
              Question Management
            </h1>
            <p className="text-slate-500 font-medium">Create questions, manage batch access, and discuss with students.</p>
          </div>
          {selectedTab !== chatIndex && (
            <ActionButton
              label="New Question"
              icon={Plus}
              onClick={() => { setEditing(null); setForm({ title: '', description: '', sample_input: '', sample_output: '', language_id: LANGUAGES[0].id, score: 100 }); setOpenDialog(true); }}
            />
          )}
        </div>

        {/* Tabs Navigation */}
        <div className="flex overflow-x-auto pb-1 mb-8 gap-2 border-b border-slate-200 hide-scrollbar">
          <button
            onClick={() => setSelectedTab(0)}
            className={`px-4 py-2 rounded-t-xl font-bold whitespace-nowrap transition-all border-b-2 ${selectedTab === 0 ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-indigo-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-2">
              <Code size={18} /> All Questions <span className="text-xs bg-slate-200 px-1.5 py-0.5 rounded-full text-slate-600">{questions.length}</span>
            </div>
          </button>
          {batches.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setSelectedTab(i + 1)}
              className={`px-4 py-2 rounded-t-xl font-bold whitespace-nowrap transition-all border-b-2 ${selectedTab === i + 1 ? 'border-purple-500 text-purple-600 bg-purple-50/50' : 'border-transparent text-slate-500 hover:text-purple-500 hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-2">
                <Users size={18} /> {b.name} <span className="text-xs font-mono opacity-70">{b.code}</span>
              </div>
            </button>
          ))}
          <button
            onClick={() => setSelectedTab(chatIndex)}
            className={`px-4 py-2 rounded-t-xl font-bold whitespace-nowrap transition-all border-b-2 ${selectedTab === chatIndex ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-emerald-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-2">
              <MessageCircle size={18} /> Q&A Room
            </div>
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center items-center py-20"><RefreshCw className="animate-spin text-indigo-500" size={40} /></div>
        ) : selectedTab === chatIndex ? (
          /* Chat UI */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-[600px] flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><MessageCircle className="text-emerald-500" size={20} /> Course Discussion</h3>
              <span className="text-xs text-slate-400 font-mono">Live Socket Connection</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 lms-page-bg/30">
              {chatMessages.length === 0 && <div className="text-center text-slate-400 py-10 italic">No messages yet. Start the conversation!</div>}
              {chatMessages.map((m, i) => {
                const isMe = m.user_id === storedUser.id || m.senderName === storedUser.name;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                      {!isMe && <p className="text-xs font-bold text-indigo-500 mb-1">{m.senderName} <span className="opacity-50 font-normal">({m.senderRole})</span></p>}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(m.created_at || m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button onClick={sendMessage} className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors shadow-lg shadow-emerald-500/30"><Send size={20} /></button>
            </div>
          </div>
        ) : (
          /* Questions Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {questions.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">No questions found. Add one to get started.</div>}
            {questions.map((q) => {
              const { color, icon, name } = getLangStyles(q.language_id);
              const batchId = batches[selectedTab - 1]?.id;
              const bState = batchId ? (q.batch_states?.[batchId] || { enabled: false }) : null;
              const enabledCount = Object.values(q.batch_states || {}).filter(s => s.enabled).length;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={q.id}
                  className={`group relative bg-white rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col h-full ${batchId && bState?.enabled ? 'border-emerald-200 shadow-emerald-100' : 'border-slate-200 shadow-sm'}`}
                >
                  {/* Card Header */}
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner shrink-0" style={{ backgroundColor: `${color}15`, color }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{name}</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Award size={12} /> {q.score} pts
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 leading-tight line-clamp-2 mb-1" title={q.title}>{q.title}</h3>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 pb-4 flex-1">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3">
                      <p className="text-xs text-slate-600 line-clamp-3 font-medium">{q.description}</p>
                    </div>
                    {q.sample_input && (
                      <div className="mb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sample Input</span>
                        <code className="block bg-slate-900 text-slate-200 text-xs p-2 rounded-lg mt-1 font-mono truncate">{q.sample_input}</code>
                      </div>
                    )}
                  </div>

                  {/* Actions / Toggle */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center justify-between">
                    {selectedTab === 0 ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${enabledCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="text-xs font-bold text-slate-500">{enabledCount} batches active</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(q.id); setForm({ ...q, language_id: q.language_id }); setOpenDialog(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={16} /></button>
                          <button onClick={() => handleDelete(q.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${bState.enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {bState.enabled ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                          {bState.toggled_at && <span className="text-[10px] text-slate-400">{new Date(bState.toggled_at).toLocaleDateString()}</span>}
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!bState.enabled}
                            onChange={() => handleToggle(q.id, batchId, bState.enabled)}
                            disabled={toggling[`${q.id}_${batchId}`]}
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={openDialog} onClose={() => setOpenDialog(false)} title={editing ? "Edit Question" : "Add New Question"} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Question Title</label>
              <input className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Reverse a String" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Language</label>
              <select className="w-full px-4 py-2 border rounded-xl outline-none bg-white" value={form.language_id} onChange={e => setForm({ ...form, language_id: e.target.value })}>
                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Score Points</label>
              <input type="number" className="w-full px-4 py-2 border rounded-xl outline-none" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
              <textarea className="w-full px-4 py-2 border rounded-xl outline-none h-32" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Full problem statement..." />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Sample Input</label>
              <textarea className="w-full px-4 py-2 border rounded-xl outline-none font-mono text-sm bg-slate-50" value={form.sample_input} onChange={e => setForm({ ...form, sample_input: e.target.value })} rows={3} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Sample Output</label>
              <textarea className="w-full px-4 py-2 border rounded-xl outline-none font-mono text-sm bg-slate-50" value={form.sample_output} onChange={e => setForm({ ...form, sample_output: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <ActionButton label="Cancel" variant="secondary" onClick={() => setOpenDialog(false)} />
            <ActionButton label={saving ? "Saving..." : "Save Question"} onClick={handleSave} disabled={saving} />
          </div>
        </div>
      </Modal>

    </div>
  );
}