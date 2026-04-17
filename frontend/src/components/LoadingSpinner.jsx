import React from 'react';

/**
 * Centred loading spinner.
 * Props:
 *   color   – Tailwind border-t color (default 'border-blue-600')
 *   size    – 'sm' | 'md' | 'lg' (default 'md')
 *   message – Optional text shown below the spinner
 */
export default function LoadingSpinner({ color = 'border-blue-600', size = 'md', message }) {
  const sizes = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-3', lg: 'w-14 h-14 border-4' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${sizes[size]} rounded-full border-slate-200 ${color} animate-spin`} style={{ borderTopColor: 'currentColor', borderWidth: size === 'sm' ? 2 : size === 'md' ? 3 : 4 }} />
      {message && <p className="text-sm font-medium text-slate-500">{message}</p>}
    </div>
  );
}
