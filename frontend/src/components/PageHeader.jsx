import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Reusable page header with icon, title, subtitle, and action buttons.
 *
 * Props:
 *   icon        – Lucide icon component
 *   iconColor   – Tailwind bg class for icon container (e.g. "bg-blue-600")
 *   title       – Main heading text
 *   subtitle    – Supporting text beneath title
 *   onRefresh   – Optional callback; renders a Refresh button when provided
 *   refreshing  – Boolean; spins the refresh icon when true
 *   actions     – Optional ReactNode for extra action buttons (rendered alongside Refresh)
 *   className   – Optional extra class on the outer container
 */
export default function PageHeader({
  icon: Icon,
  iconColor = 'bg-blue-600',
  title,
  subtitle,
  onRefresh,
  refreshing = false,
  actions,
  className = '',
}) {
  return (
    <div className={`lms-card p-5 md:p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${className}`}>
      {Icon && (
        <div className={`w-11 h-11 rounded-xl ${iconColor} flex items-center justify-center shadow-sm shrink-0`}>
          <Icon size={21} className="text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>}
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {(onRefresh || actions) && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="lms-btn-secondary gap-1.5 h-9 px-3 text-sm"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
