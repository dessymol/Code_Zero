import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const Pagination = ({ currentPage, totalItems, itemsPerPage, onPageChange, className = '' }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const startItem = Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1);
  const endItem = Math.min(totalItems, currentPage * itemsPerPage);

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) range.unshift('...');
    if (currentPage + delta < totalPages - 1) range.push('...');

    range.unshift(1);
    if (totalPages !== 1) range.push(totalPages);

    return range;
  };

  const PageBtn = ({ page, active, disabled, children, title }) => (
    <button
      onClick={() => !disabled && typeof page === 'number' && onPageChange(page)}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : disabled
          ? 'text-slate-300 cursor-not-allowed'
          : typeof page !== 'number'
          ? 'text-slate-400 cursor-default'
          : 'text-slate-600 hover:bg-slate-100 hover:text-blue-700'
      }`}
    >
      {children || page}
    </button>
  );

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50/50 ${className}`}>
      <p className="text-sm text-slate-500 order-2 sm:order-1">
        Showing <span className="font-bold text-slate-700">{startItem}–{endItem}</span> of{' '}
        <span className="font-bold text-slate-700">{totalItems}</span>
      </p>
      <nav className="flex items-center gap-1 order-1 sm:order-2">
        <PageBtn page={1} disabled={currentPage === 1} title="First page">
          <ChevronsLeft size={14} />
        </PageBtn>
        <PageBtn page={currentPage - 1} disabled={currentPage === 1} title="Previous page">
          <ChevronLeft size={14} />
        </PageBtn>
        {getVisiblePages().map((page, i) => (
          <PageBtn key={i} page={page} active={page === currentPage}>
            {page === '...' ? '…' : page}
          </PageBtn>
        ))}
        <PageBtn page={currentPage + 1} disabled={currentPage === totalPages} title="Next page">
          <ChevronRight size={14} />
        </PageBtn>
        <PageBtn page={totalPages} disabled={currentPage === totalPages} title="Last page">
          <ChevronsRight size={14} />
        </PageBtn>
      </nav>
    </div>
  );
};

export default Pagination;
