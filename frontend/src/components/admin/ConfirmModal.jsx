import React from 'react';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel, loading = false }) {
  return (
    <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="admin-modal">
        <div className="admin-modal-title">{title}</div>
        <div className="admin-modal-body">{message}</div>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={`admin-btn ${danger ? 'admin-btn-danger' : 'admin-btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
