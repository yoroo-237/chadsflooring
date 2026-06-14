import React from 'react';

export default function StatCard({ icon, value, label, sub, trend, color = '#4361ee' }) {
  return (
    <div className="admin-stat-card" style={{ '--stat-color': color }}>
      {icon && <div className="admin-stat-icon">{icon}</div>}
      <div className="admin-stat-value">{value ?? '—'}</div>
      <div className="admin-stat-label">{label}</div>
      {sub   && <div className="admin-stat-sub">{sub}</div>}
      {trend != null && (
        <div className={`admin-stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}
