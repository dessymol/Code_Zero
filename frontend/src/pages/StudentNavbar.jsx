// src/pages/StudentNavbar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, ClipboardList, Trophy, User, LogOut, Zap } from 'lucide-react';
import { clearSession } from '../utils/auth';

const navItems = [
  { label: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
  { label: 'Submissions', path: '/student/submissions', icon: ClipboardList },
  { label: 'Scores', path: '/student/score', icon: Trophy },
  { label: 'Profile', path: '/student/profile', icon: User },
];

export default function StudentNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [studentName, setStudentName] = useState('Student');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('studentData');
      if (raw) {
        const parsed = JSON.parse(raw);
        const name = parsed?.name ?? parsed?.fullName ?? '';
        if (name) setStudentName(name.trim());
      }
    } catch {}
  }, []);

  const initials = studentName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const isMatch = (p) => location.pathname.startsWith(p);

  return (
    <nav className="w-full z-50 relative" style={{ background: 'linear-gradient(90deg, #065f46 0%, #059669 60%, #047857 100%)', boxShadow: '0 4px 20px rgba(5, 150, 105, 0.3)' }}>
      <div className="lms-container flex items-center justify-between py-2.5 gap-4">
        <button onClick={() => navigate('/student/dashboard')} className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-base font-bold text-white group-hover:text-emerald-100 transition-colors hidden sm:block">CodeZero LMS</span>
          <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15 text-white/90 border border-white/20 uppercase tracking-wider">Student</span>
        </button>

        <div className="hidden lg:flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1.5 border border-white/15">
          {navItems.map(({ label, path, icon: Icon }) => (
            <button key={path} onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${isMatch(path) ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/12'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/25 border border-white/40 flex items-center justify-center text-white font-bold text-xs">{initials}</div>
            <span className="text-white/90 text-sm font-medium hidden md:block max-w-[100px] truncate">{studentName.split(' ')[0]}</span>
            <ChevronDown size={14} className={`text-white/70 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl z-20 overflow-hidden border border-slate-200 animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                  <p className="text-xs text-slate-500 font-medium">Student Portal</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{studentName}</p>
                </div>
                <div className="py-1.5">
                  <button onClick={() => { setMenuOpen(false); navigate('/student/profile'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"><User size={15} /> Profile</button>
                  <div className="my-1.5 border-t border-slate-100" />
                  <button onClick={() => { clearSession(); setMenuOpen(false); navigate('/login'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"><LogOut size={15} /> Sign Out</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="lg:hidden lms-container flex gap-1.5 pb-2.5 overflow-x-auto scrollbar-none">
        {navItems.map(({ label, path, icon: Icon }) => (
          <button key={path} onClick={() => navigate(path)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isMatch(path) ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/85 bg-white/10 hover:bg-white/20'}`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}
