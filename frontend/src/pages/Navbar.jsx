// src/pages/Navbar.jsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, Users, BookOpen, Layers, GraduationCap, MessageSquare, UserPlus, LogOut, User, Zap, ShieldCheck } from 'lucide-react';
import { clearSession } from '../utils/auth';

const navItems = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Faculty', path: '/admin/faculties', icon: Users },
  { label: 'Courses', path: '/admin/courses', icon: BookOpen, activePaths: ['/admin/course', '/admin/question-banks'] },
  { label: 'Batches', path: '/admin/batches', icon: Layers },
  { label: 'Students', path: '/admin/students', icon: GraduationCap },
  { label: 'Chat', path: '/admin/chats', icon: MessageSquare },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('adminData') || '{}'); }
    catch { return {}; }
  })();

  const displayName = stored.name || stored.email || 'Admin';
  const role = stored.role || 'admin';
  const initials = displayName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const isSuperAdmin = role === 'super_admin';

  const fullNavItems = isSuperAdmin
    ? [
        { label: 'Super', path: '/super-admin/dashboard', icon: ShieldCheck },
        { label: 'Admins', path: '/admin/add-admin', icon: UserPlus }
      ]
    : navItems;

  const isItemActive = (item) => {
    const paths = item.activePaths || [item.path];
    return paths.some(p => location.pathname.startsWith(p));
  };

  return (
    <>
      <nav className="w-full lms-nav z-50 relative">
        <div className="lms-container flex items-center justify-between py-2.5 gap-4">
          <button onClick={() => navigate(isSuperAdmin ? '/super-admin/dashboard' : '/admin/dashboard')} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-white group-hover:text-blue-100 transition-colors hidden sm:block">CodeZero LMS</span>
            <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/15 text-white/90 border border-white/20 uppercase tracking-wider">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1.5 border border-white/15">
            {fullNavItems.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/12'}`}>
                  <Icon size={14} />{item.label}
                </button>
              );
            })}
          </div>

          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors border border-transparent hover:border-white/15">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/30 to-white/15 border border-white/40 flex items-center justify-center text-white font-bold text-xs">{initials}</div>
              <span className="text-white/90 text-sm font-medium hidden md:block max-w-[100px] truncate">{displayName.split(' ')[0]}</span>
              <ChevronDown size={14} className={`text-white/70 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl z-20 overflow-hidden border border-slate-200 animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                    <p className="text-xs text-slate-500 font-medium">Signed in as</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
                  </div>
                  <div className="py-1.5">
                    <button onClick={() => { setMenuOpen(false); navigate('/admin/profile'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"><User size={15} /> View Profile</button>
                    <button onClick={() => { setMenuOpen(false); navigate('/admin/add-admin'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"><UserPlus size={15} /> Add Admin</button>
                    <div className="my-1.5 border-t border-slate-100" />
                    <button onClick={() => { setMenuOpen(false); clearSession(); navigate('/login'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"><LogOut size={15} /> Sign Out</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="lg:hidden lms-container flex gap-1.5 pb-2.5 overflow-x-auto scrollbar-none">
          {fullNavItems.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-white/85 bg-white/10 hover:bg-white/20'}`}>
                <Icon size={12} />{item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
export default Navbar;
