import React, { useState } from 'react';
import AccountSidebar from '../components/AccountSidebar';
import { useApp } from '../context/AppContext';

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}
function RibbonIcon({ color = '#4D9CEB' }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/>
      <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>
      <path d="m9 8 2 2 4-4"/>
    </svg>
  );
}
function MedalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="6"/>
      <path d="M12 6.5 12.9 8.3 14.9 8.6 13.5 10 13.8 12 12 11.1 10.2 12 10.5 10 9.1 8.6 11.1 8.3z" fill="#fff" stroke="none"/>
      <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/>
    </svg>
  );
}
function ChevronIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function CECoin({ i }) {
  return <span className="ce-coin" style={{ marginLeft: i ? -10 : 0, zIndex: 5 - i }}>CE</span>;
}

const TIER_ROADMAP = [
  { name: 'Basic',     range: '$0 - $999',         cashback: '0.5%', color: '#2E7D5B' },
  { name: 'Preferred', range: '$1,000 - $1,999',   cashback: '1.0%', color: '#2F6FB0' },
  { name: 'Gold',      range: '$2,000 - $4,999',   cashback: '1.3%', color: '#D4A843' },
  { name: 'Platinum',  range: '$5,000 - $19,999',  cashback: '1.5%', color: '#E8E4DA' },
];

const AWARD_RULES = [
  'Tiers are awarded at the end of every month by the amount you spent that month',
  'If you meet the required spend of a tier early, your tier will be upgraded at the end of the day.',
  'If you spend less than your current tiers threshold for the month, your tier will be downgraded at the start of the following month.',
  'You must spend your current tiers threshold in order to keep it.',
];

export default function RewardsPage() {
  const { orders } = useApp();
  const [roadmapOpen, setRoadmapOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);

  const spent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const goal = 999;
  const remaining = Math.max(0, goal - spent);
  const pct = Math.min(100, (spent / goal) * 100);
  const points = Math.floor(spent * 0.5);

  const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <h3 className="account-page-title">Basic Tier</h3>

          <div className="rewards2-top">
            {/* Tier progress card */}
            <div className="rewards2-tier-card">
              <div className="rewards2-progress-rail">
                <div className="rewards2-progress-fill" style={{ height: `${pct}%` }} />
              </div>
              <button className="rewards2-info" aria-label="Tier info" onClick={() => setInfoOpen(true)}><InfoIcon /></button>
              <div className="rewards2-tier-body">
                <RibbonIcon />
                <span className="rewards2-tier-name">Basic Tier</span>
                <span className="rewards2-tier-amount">{fmt(spent)}</span>
                <span className="rewards2-tier-of">of {fmt(goal)} spent</span>
                <div className="rewards2-tier-pills">
                  <span className="rewards2-pill">{fmt(remaining)} until next tier</span>
                  <span className="rewards2-pill">24 days left</span>
                </div>
              </div>
            </div>

            {/* Your rewards card */}
            <div className="rewards2-rewards-card">
              <h4 className="rewards2-card-title">Your rewards</h4>
              <div className="rewards2-rewards-grid">
                <div className="rewards2-reward-box">
                  <div className="ce-coin-stack">
                    <CECoin i={0} /><CECoin i={1} />
                  </div>
                  <span className="rewards2-reward-value">P{points}</span>
                </div>
                <div className="rewards2-reward-box">
                  <span className="rewards2-dollar-coin">$</span>
                  <span className="rewards2-reward-value">0.5% Points Back</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tier Roadmap */}
          <div className="rewards2-roadmap">
            <div className="rewards2-roadmap-head">
              <span className="rewards2-roadmap-title">Tier Roadmap</span>
              <button className={`rewards2-roadmap-bar${roadmapOpen ? ' open' : ''}`} onClick={() => setRoadmapOpen(o => !o)}>
                <ChevronIcon open={roadmapOpen} />
              </button>
            </div>
            {roadmapOpen && (
              <div className="rewards2-roadmap-cards">
                {TIER_ROADMAP.map(t => {
                  const light = t.name === 'Platinum';
                  return (
                    <div key={t.name} className="rewards2-tier-tile">
                      <div className="rewards2-tier-tile-head" style={{ background: t.color, color: light ? '#252525' : '#fff' }}>
                        <MedalIcon />
                        <span>{t.name}</span>
                      </div>
                      <div className="rewards2-tier-tile-body">
                        <div className="rewards2-tier-tile-spend">Spend: {t.range}</div>
                        <div className="rewards2-tier-tile-cash">Cashback: {t.cashback}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Canna Point Activity */}
          <div className="rewards2-activity">
            <h4 className="rewards2-card-title">Canna Point Activity</h4>
            <div className="rewards2-table-wrap">
              <table className="rewards2-table">
                <thead>
                  <tr>
                    <th>From</th><th>To</th><th>Points</th><th>Rate</th><th>Info</th><th className="ta-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={6} className="rewards2-table-empty">No point activity yet.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Tier award Periods modal */}
      {infoOpen && (
        <div className="modal-overlay" onClick={() => setInfoOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setInfoOpen(false)}><CloseIcon /></button>
            <h3 className="modal-title">Tier award Periods</h3>
            <p className="modal-subtitle">The following is a breakdown of how tiers are awarded each month.</p>
            <ol className="modal-rules">
              {AWARD_RULES.map((r, i) => <li key={i}>{i + 1}. {r}</li>)}
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}
