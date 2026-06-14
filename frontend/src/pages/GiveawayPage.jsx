import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

function useCountdown(endDate) {
  const calc = () => {
    if (!endDate) return { d: 0, h: 0, m: 0, s: 0 };
    const diff = new Date(endDate) - new Date();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const iv = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(iv);
  }, [endDate]);
  return time;
}

function GiveawayCard({ giveaway }) {
  const { showToast } = useApp();
  const [entered, setEntered] = useState(false);
  const [entering, setEntering] = useState(false);
  const countdown = useCountdown(giveaway.endsAt || giveaway.endDate);
  const fmt = n => String(n).padStart(2, '0');

  const gradientStyle = giveaway.gradientFrom
    ? `linear-gradient(${giveaway.gradientAngle ?? 135}deg, ${giveaway.gradientFrom}, ${giveaway.gradientTo})`
    : giveaway.color || 'linear-gradient(135deg, #4361ee, #7c3aed)';

  const handleEnter = async () => {
    setEntering(true);
    try {
      await api.post(`/content/giveaways/${giveaway.id}/enter`, {});
      setEntered(true);
      showToast('You have entered the giveaway! Good luck! 🎉', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to enter', 'error');
    } finally {
      setEntering(false);
    }
  };

  const prizes = giveaway.prizes || [];
  const entryCount = giveaway._count?.entries ?? giveaway.entryCount ?? giveaway.entries ?? 0;
  const winners = giveaway.winnersCount ?? giveaway.winners ?? 1;

  return (
    <div className="giveaway-card">
      <div className="giveaway-header" style={{ background: gradientStyle }}>
        {giveaway.badge && <div className="giveaway-badge">{giveaway.badge}</div>}
        <h2 className="giveaway-title">{giveaway.title}</h2>
        {giveaway.value && <div className="giveaway-value">Prize Value: {giveaway.value}</div>}
      </div>
      <div className="giveaway-body">
        <p className="giveaway-desc">{giveaway.description}</p>

        {prizes.length > 0 && (
          <div className="giveaway-prizes">
            {prizes.map((p, i) => (
              <div key={i} className="giveaway-prize">
                <span className="giveaway-prize-rank">{['🥇', '🥈', '🥉'][i] || '🏅'}</span>
                <span>{p}</span>
              </div>
            ))}
          </div>
        )}

        {(giveaway.endsAt || giveaway.endDate) && (
          <div className="giveaway-countdown">
            <div className="countdown-label">Ends in</div>
            <div className="countdown-timer">
              <div className="countdown-seg"><span className="countdown-num">{fmt(countdown.d)}</span><span className="countdown-unit">days</span></div>
              <span className="countdown-colon">:</span>
              <div className="countdown-seg"><span className="countdown-num">{fmt(countdown.h)}</span><span className="countdown-unit">hrs</span></div>
              <span className="countdown-colon">:</span>
              <div className="countdown-seg"><span className="countdown-num">{fmt(countdown.m)}</span><span className="countdown-unit">min</span></div>
              <span className="countdown-colon">:</span>
              <div className="countdown-seg"><span className="countdown-num">{fmt(countdown.s)}</span><span className="countdown-unit">sec</span></div>
            </div>
          </div>
        )}

        <div className="giveaway-meta">
          <span>👥 {Number(entryCount).toLocaleString()} entries</span>
          <span>🎟 {winners} winner{winners > 1 ? 's' : ''}</span>
        </div>

        <button
          className={`giveaway-enter-btn${entered ? ' entered' : ''}`}
          onClick={handleEnter}
          disabled={entered || entering}
        >
          {entered ? '✓ Entered!' : entering ? 'Entering…' : 'Enter Giveaway'}
        </button>
      </div>
    </div>
  );
}

export default function GiveawayPage() {
  const [giveaways, setGiveaways] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get('/content/giveaways')
      .then(data => setGiveaways(data.giveaways || data || []))
      .catch(() => setGiveaways([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="main-content">
      <div className="page-container">
        <h1 className="page-title">Giveaways</h1>
        <p className="page-subtitle">Enter our active giveaways for a chance to win free products and store credits!</p>

        {loading ? (
          <div className="empty-state"><p>Loading giveaways…</p></div>
        ) : giveaways.length === 0 ? (
          <div className="empty-state"><p>No active giveaways at this time. Check back soon!</p></div>
        ) : (
          <div className="giveaway-grid">
            {giveaways.map(g => <GiveawayCard key={g.id} giveaway={g} />)}
          </div>
        )}

        <div className="giveaway-rules">
          <h3>How It Works</h3>
          <ol className="giveaway-steps">
            <li>Click "Enter Giveaway" on any active draw</li>
            <li>Each account gets one entry per giveaway</li>
            <li>Winners are selected randomly at the end of the draw period</li>
            <li>Winners are notified via email and announced on our News page</li>
            <li>Prizes are shipped within 5 business days of winner confirmation</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
