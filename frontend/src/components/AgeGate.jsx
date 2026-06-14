import React from 'react';

export default function AgeGate({ onYes, onNo }) {
  return (
    <div className="age-gate-overlay">
      <div className="age-gate-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #4361ee)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <h1 className="age-gate-title">Age Verification</h1>
        <p className="age-gate-desc">
          You must be <strong>21 years or older</strong> to enter this website.<br />
          By clicking "I am 21+" you confirm you meet the minimum age requirement.
        </p>
        <div className="age-gate-actions">
          <button className="age-gate-btn age-gate-btn--no" onClick={onNo}>
            Under 21 — Exit
          </button>
          <button className="age-gate-btn age-gate-btn--yes" onClick={onYes}>
            I am 21+ — Enter
          </button>
        </div>
      </div>
    </div>
  );
}
