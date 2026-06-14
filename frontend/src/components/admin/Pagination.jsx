import React from 'react';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  // Show max 7 page buttons
  let display = pages;
  if (totalPages > 7) {
    if (page <= 4) display = [...pages.slice(0, 5), '…', totalPages];
    else if (page >= totalPages - 3) display = [1, '…', ...pages.slice(totalPages - 5)];
    else display = [1, '…', page - 1, page, page + 1, '…', totalPages];
  }
  return (
    <div className="admin-pagination">
      <button className="admin-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {display.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="admin-page-info">…</span>
          : <button key={p} className={`admin-page-btn${page === p ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
      )}
      <button className="admin-page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}
