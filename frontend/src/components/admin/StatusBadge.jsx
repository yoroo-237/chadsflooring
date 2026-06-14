import React from 'react';

const COLORS = {
  // orders
  processing: { bg: 'rgba(33,150,243,.12)', color: '#2196f3' },
  shipped:    { bg: 'rgba(255,152,0,.12)',  color: '#ff9800' },
  delivered:  { bg: 'rgba(67,160,71,.12)', color: '#43a047' },
  cancelled:  { bg: 'rgba(229,57,53,.12)', color: '#e53935' },
  pending:    { bg: 'rgba(255,152,0,.12)',  color: '#ff9800' },
  refunded:   { bg: 'rgba(156,39,176,.12)', color: '#9c27b0' },
  // support tickets
  open:        { bg: 'rgba(33,150,243,.12)', color: '#2196f3' },
  in_progress: { bg: 'rgba(255,152,0,.12)',  color: '#ff9800' },
  resolved:    { bg: 'rgba(67,160,71,.12)', color: '#43a047' },
  closed:      { bg: 'rgba(108,117,125,.12)', color: '#6c757d' },
  // deposits / users / team
  active:    { bg: 'rgba(67,160,71,.12)', color: '#43a047' },
  inactive:  { bg: 'rgba(108,117,125,.12)', color: '#6c757d' },
  confirmed: { bg: 'rgba(67,160,71,.12)', color: '#43a047' },
  rejected:  { bg: 'rgba(229,57,53,.12)', color: '#e53935' },
  // priority
  urgent: { bg: 'rgba(229,57,53,.12)', color: '#e53935' },
  high:   { bg: 'rgba(255,152,0,.12)',  color: '#ff9800' },
  normal: { bg: 'rgba(33,150,243,.12)', color: '#2196f3' },
  low:    { bg: 'rgba(108,117,125,.12)', color: '#6c757d' },
  // published / draft
  published: { bg: 'rgba(67,160,71,.12)', color: '#43a047' },
  draft:     { bg: 'rgba(108,117,125,.12)', color: '#6c757d' },
};

export default function StatusBadge({ status, label }) {
  const key = (status || '').toLowerCase();
  const style = COLORS[key] || { bg: 'rgba(108,117,125,.12)', color: '#6c757d' };
  return (
    <span className="admin-badge" style={{ background: style.bg, color: style.color }}>
      {label ?? status}
    </span>
  );
}
