import React from 'react';
import { Zap, Shield } from 'lucide-react';
import ICTLogo from '../assets/ICT-Logo.png';



export default function AuthShell({ title = 'Sign In', subtitle = 'Enter your credentials to continue.', children, portalLabel }) {
  return (
    <div className="min-h-screen w-full flex overflow-hidden" style={{
      background: 'radial-gradient(ellipse at 0% 0%, #dbeafe 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, #ede9fe 0%, transparent 50%), #f0f4ff'
    }}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] p-10 xl:p-14"
        style={{ background: 'linear-gradient(145deg, #1e3a8a 0%, #2563eb 50%, #7c3aed 100%)' }}>
        <div>
          
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">CodeZero LMS</span>
          </div>
          <img src={ICTLogo} alt="ict LOGO" className="h-20 opacity-90 gap-3 mb-12" />
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
            Empowering<br />
            <span className="text-blue-200">Education</span> Through<br />
            Technology
          </h2>
          <p className="text-blue-200 text-base leading-relaxed mb-10">
            A comprehensive learning management system built for ICT ACADEMY OF KERALA.
          </p>
          
          
        </div>
        <div className="flex items-center gap-2 text-blue-300 text-xs font-medium">
          <Shield size={14} />
          <span>Secure · Encrypted · Trusted</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}>
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">CodeZero LMS</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header bar */}
            <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={ICTLogo} alt="ICT Logo" className="h-7 w-auto" />
                <span className="text-sm font-semibold text-slate-600 hidden sm:block">ICTAK</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', borderColor: 'rgba(37,99,235,0.2)' }}>
                {portalLabel || 'LMS Portal'}
              </span>
            </div>

            <div className="p-8">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">{title}</h2>
              <p className="text-slate-500 text-sm mb-6">{subtitle}</p>
              {children}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            © 2025 CodeZero Learning Management System · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
