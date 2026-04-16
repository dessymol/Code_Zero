import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Zap, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen lms-page-bg flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-8 shadow-lg">
          <Zap size={36} className="text-white" />
        </div>
        <div className="text-8xl font-black text-slate-200 mb-4 select-none">404</div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-amber-500" />
          <h1 className="text-xl font-bold text-slate-800">Page Not Found</h1>
        </div>
        <p className="text-slate-500 mb-8 text-sm">The page you're looking for doesn't exist or you don't have permission to view it.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="lms-btn-secondary gap-2"><ArrowLeft size={16} /> Go Back</button>
          <button onClick={() => navigate('/login')} className="lms-btn-primary gap-2"><Home size={16} /> Home</button>
        </div>
        <p className="mt-8 text-xs text-slate-400">CodeZero LMS · All rights reserved</p>
      </div>
    </div>
  );
}
