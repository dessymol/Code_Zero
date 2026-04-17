import React from 'react';
import { Zap } from 'lucide-react';

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-sm py-4 px-6 mt-8">
    <div className="lms-container flex flex-col sm:flex-row items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-slate-500">CodeZero LMS</span>
      </div>
      <p className="text-xs text-slate-400">
        &copy; {new Date().getFullYear()} ICTAK · All rights reserved
      </p>
      <p className="text-xs text-slate-400 hidden sm:block">
        Built with React · Node.js · MySQL
      </p>
    </div>
  </footer>
);

export default Footer;
