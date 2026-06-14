import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

/* ─────────── Icons ─────────── */
function ChatBubbleIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function CloseIcon({ c = 'currentColor' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function CommunityIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function HeadsetIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}
function SmileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  );
}

const SITUATIONS = [
  'Missing/Wrong Items', 'Delayed Package', 'Website Bug',
  'Cancelled Order', 'Emergency Contact', 'Website Feature Request',
  'Deposit Issue', 'Product Requests', 'Missing Product Image',
];
const SUB_OPTIONS = ['Order', 'Deposit', 'Not related'];

export default function SupportWidget() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState(null); // null | 'situations' | 'sub' | 'chat'
  const [situation, setSituation] = useState(null);
  const [topic, setTopic] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages]);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const closeAll = () => { setStep(null); setMenuOpen(false); setSituation(null); };
  const openCommunity = () => { setMenuOpen(false); setTopic('Community Chat'); setMessages([]); setStep('chat'); };
  const openSituations = () => { setMenuOpen(false); setStep('situations'); };
  const pickSituation = (s) => { setSituation(s); setStep('sub'); };
  const pickSub = (opt) => { setTopic(`${situation} · ${opt}`); setMessages([]); setStep('chat'); };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    const now = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { from: 'me', text, time: now() }]);
    setDraft('');
    if (messages.length === 0) {
      api.post('/support/tickets', { subject: topic || 'Support request', category: situation || 'General', message: text }).catch(() => {});
    }
    setTimeout(() => {
      setMessages(m => [...m, { from: 'agent', text: 'Thanks for reaching out — a support agent will reply here shortly.', time: now() }]);
    }, 900);
  };

  return (
    <>
      {/* Situations — centered dark modal */}
      {step === 'situations' && (
        <div className="supw-modal-overlay" onClick={closeAll}>
          <div className="supw-modal" onClick={e => e.stopPropagation()}>
            <button className="supw-modal-close" onClick={closeAll} aria-label="Close"><CloseIcon /></button>
            <h2 className="supw-modal-title">Which one best describes your situation?</h2>
            <div className="supw-modal-grid">
              {SITUATIONS.map(s => (
                <button key={s} className="supw-modal-card" onClick={() => pickSituation(s)}>{s}</button>
              ))}
            </div>
            <button className="supw-modal-other" onClick={() => pickSituation('Other')}>Other</button>
          </div>
        </div>
      )}

      {/* Sub-question — centered dark modal */}
      {step === 'sub' && (
        <div className="supw-modal-overlay" onClick={closeAll}>
          <div className="supw-modal supw-modal--sub" onClick={e => e.stopPropagation()}>
            <button className="supw-modal-back" onClick={() => setStep('situations')} aria-label="Back"><BackIcon /></button>
            <button className="supw-modal-close" onClick={closeAll} aria-label="Close"><CloseIcon /></button>
            <h2 className="supw-modal-title">Is this related to an order or deposit?</h2>
            <div className="supw-modal-grid supw-modal-grid--3">
              {SUB_OPTIONS.map(o => (
                <button key={o} className="supw-modal-card" onClick={() => pickSub(o)}>{o}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat — right-side drawer */}
      {step === 'chat' && (
        <div className="supw-drawer" role="dialog" aria-label="Support chat">
          <div className="supw-drawer-head">
            <span className="supw-drawer-date">{today}</span>
            <button className="supw-drawer-close" onClick={closeAll} aria-label="Close"><CloseIcon /></button>
          </div>
          <div className="supw-drawer-thread" ref={threadRef}>
            <div className="supw-drawer-topic">{topic}</div>
            {messages.map((m, i) => (
              <div key={i} className={`supw-dmsg supw-dmsg--${m.from}`}>
                <div className="supw-dbubble">{m.text}</div>
                <div className="supw-dtime">{m.time}</div>
              </div>
            ))}
          </div>
          <form className="supw-drawer-composer" onSubmit={e => { e.preventDefault(); send(); }}>
            <input
              className="supw-drawer-input"
              placeholder="Write your message here..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <div className="supw-drawer-actions">
              <button type="button" className="supw-emoji-btn" aria-label="Emoji"><SmileIcon /></button>
              <button type="submit" className="supw-send-btn">Send</button>
            </div>
          </form>
        </div>
      )}

      {/* Channel menu box (above FAB) */}
      {menuOpen && (
        <div className="supw-menubox">
          <button className="supw-menubox-pill" onClick={openCommunity}>
            <CommunityIcon /> Community Chat
          </button>
          <button className="supw-menubox-pill" onClick={openSituations}>
            <HeadsetIcon /> Ask Support
          </button>
        </div>
      )}

      {/* Floating FAB (round) */}
      <button
        className={`support-widget-fab${menuOpen ? ' open' : ''}`}
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Support"
      >
        {menuOpen ? <CloseIcon c="#fff" /> : <ChatBubbleIcon />}
      </button>
    </>
  );
}
