import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const ToastContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const VARIANTS = {
  success: { icon: CheckCircle, bar: 'bg-emerald-500', icon_cls: 'text-emerald-500', bg: 'bg-white' },
  error:   { icon: AlertCircle, bar: 'bg-red-500',     icon_cls: 'text-red-500',     bg: 'bg-white' },
  info:    { icon: Info,         bar: 'bg-blue-500',    icon_cls: 'text-blue-600',    bg: 'bg-white' },
  warning: { icon: AlertTriangle, bar: 'bg-amber-500', icon_cls: 'text-amber-500',   bg: 'bg-white' },
};

const ToastItem = ({ id, message, type = 'success', onClose }) => {
  const v = VARIANTS[type] || VARIANTS.info;
  const Icon = v.icon;

  useEffect(() => {
    const t = setTimeout(() => onClose(id), 5000);
    return () => clearTimeout(t);
  }, [id, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.18 } }}
      className={`${v.bg} w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-3 pointer-events-auto`}
      style={{ borderLeft: `4px solid` }}
    >
      <div className={`h-1 w-full ${v.bar}`} />
      <div className="p-4 flex items-start gap-3">
        <Icon size={18} className={`${v.icon_cls} shrink-0 mt-0.5`} />
        <p className="text-sm font-semibold text-slate-800 flex-1 leading-relaxed">{message}</p>
        <button onClick={() => onClose(id)} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col items-end pointer-events-none z-[200] w-full sm:w-auto max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <ToastItem key={toast.id} {...toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
