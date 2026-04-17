import React from 'react';
import { InboxIcon } from 'lucide-react';

/**
 * Reusable empty state display.
 *
 * Props:
 *   icon     – Lucide icon component (defaults to InboxIcon)
 *   title    – Main message
 *   subtitle – Supporting description
 *   action   – Optional ReactNode (e.g. a CTA button)
 *   compact  – Boolean; reduces padding for use inside cards
 */
export default function EmptyState({ icon: Icon = InboxIcon, title = 'Nothing here yet', subtitle, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-12 px-4' : 'py-20 px-6'}`}>
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 max-w-xs mb-5">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
