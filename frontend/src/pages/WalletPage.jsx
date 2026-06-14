import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import AccountSidebar from '../components/AccountSidebar';
import { api } from '../utils/api';

const CURRENCIES = [
  { key: 'BTC',  label: 'Bitcoin',  note: 'suggested fee: 4 sat/vb' },
  { key: 'DOGE', label: 'Dogecoin', note: '' },
  { key: 'LTC',  label: 'Litecoin', note: '' },
  { key: 'XMR',  label: 'Monero',   note: '' },
];

const STATUS_ICONS = {
  BTC: () => (
    <svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path d="M22.5 14.5c.4-2.5-1.5-3.8-4-4.7l.8-3.3-2-.5-.8 3.2-1.6-.4.8-3.2-2-.5-.8 3.2-3.3-.8-.5 2.1 1.4.4c.8.2 1 .7.9 1l-2.2 8.7c-.1.4-.5.8-1.2.6l-1.4-.3-.6 2.4 3.2.8-.8 3.3 2 .5.8-3.3 1.6.4-.8 3.2 2 .5.8-3.3c3.4.6 5.9.4 7-2.7.9-2.5-.1-3.9-1.8-4.8 1.3-.3 2.2-1.1 2.5-2.8z" fill="white"/></svg>
  ),
  DOGE: () => (
    <svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#C2A633"/><text x="7" y="21" fontSize="14" fill="white" fontWeight="bold">D</text></svg>
  ),
  LTC: () => (
    <svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#345D9D"/><path d="M13.5 20.5l1-4-1.5.5.5-2 1.5-.5 2-8h4l-1.5 6 1.5-.5-.5 2-1.5.5-1 4h7l-.5 2h-11l.5-2z" fill="white"/></svg>
  ),
  XMR: () => (
    <svg width="18" height="18" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#FF6600"/><path d="M16 8l-8 8v4h3v-4.5l5 5 5-5V20h3v-4l-8-8z" fill="white"/></svg>
  ),
};

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#43a047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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

const TABS = ['Credit Deposits', 'Credit History', 'Legacy Credit History'];

const DEPOSIT_TERMS = [
  'You agree you are at least 21 years of age and do not conduct business with under age minors.',
  'Send any amount to the address displayed on the next page.',
  'The amount received will be credited to your account based on the exchange rate at the time it confirms on the blockchain.',
  'The deposit is credited to your account at that time in USD.',
  'Meaning, if you send $50 in Bitcoin, at the time it confirms, you will receive $50 in store credit.',
  'If no transaction is received after 12 hours, this deposit will be cancelled.',
  'Do not reuse the deposit addresses, the system will not detect it. Send only ONE TRANSACTION to the address.',
  'Additional deposits will be permanently lost with no ability to recover.',
  'Do not send funds to a cancelled deposit address, the system will not detect it.',
  'Funds sent to the address of a cancelled deposit will be permanently lost with no ability to recover.',
];

export default function WalletPage() {
  const { balance, setBalance, deposits, setDeposits, transactions, setTransactions, showToast } = useApp();
  const [selectedCurrency, setSelectedCurrency] = useState('DOGE');
  const [activeTab, setActiveTab]   = useState(0);
  const [copied, setCopied]         = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [agreed, setAgreed]         = useState(false);
  const [currentDeposit, setCurrentDeposit] = useState(null);
  const [creating, setCreating]     = useState(false);

  useEffect(() => {
    api.get('/wallet/balance').then(d => { if (d?.balance != null) setBalance(Number(d.balance)); }).catch(() => {});
    api.get('/wallet/deposits').then(d => setDeposits(d.deposits || d || [])).catch(() => {});
    api.get('/wallet/transactions').then(d => setTransactions(d.transactions || d || [])).catch(() => {});
  }, [setBalance, setDeposits, setTransactions]);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCreateDeposit = async () => {
    setCreating(true);
    try {
      const data = await api.post('/wallet/deposit', { currency: selectedCurrency });
      const dep = data.deposit || data;
      setCurrentDeposit(dep);
      setDeposits(prev => [dep, ...prev]);
      setModalOpen(false);
      setAgreed(false);
      showToast('Deposit address generated', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to create deposit', 'error');
    } finally {
      setCreating(false);
    }
  };

  const depositAddress = currentDeposit?.address || '';

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <h3 className="account-page-title">Credits</h3>

          <div className="credits-top-grid">
            {/* Available Credits card */}
            <div className="credits-balance-card">
              <h4 className="credits-card-heading">Available Credits</h4>
              <div className="credits-balance-body">
                <div className="credits-balance-graphic">
                  <svg width="120" height="86" viewBox="0 0 236 168" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="8" width="220" height="152" rx="16" fill="#E8F4FF" stroke="#0171E3" strokeWidth="1.5"/>
                    <circle cx="118" cy="84" r="40" fill="#0171E3" opacity="0.12"/>
                    <circle cx="118" cy="84" r="24" fill="#0171E3" opacity="0.2"/>
                    <path d="M108 84l6 6 12-12" stroke="#0171E3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="28" y="28" width="60" height="8" rx="4" fill="#0171E3" opacity="0.2"/>
                    <rect x="28" y="44" width="40" height="6" rx="3" fill="#0171E3" opacity="0.12"/>
                    <rect x="148" y="128" width="60" height="8" rx="4" fill="#0171E3" opacity="0.2"/>
                  </svg>
                </div>
                <h2 className="credits-balance-amount">${Number(balance).toFixed(2)}</h2>
              </div>
            </div>

            {/* Load Credits card */}
            <div className="credits-load-card">
              <div className="credits-load-header">
                <h4 className="credits-card-heading">Load Credits</h4>
                <button className="credits-walkthrough-btn"><MapIcon /> Guided walkthrough</button>
              </div>

              <p className="credits-load-subtitle">
                The deposit is credited to your account based on the exchange rate at the time in USD.
              </p>

              <div className="credits-currency-list">
                {CURRENCIES.map(c => (
                  <label key={c.key} className={`credits-currency-row${selectedCurrency === c.key ? ' selected' : ''}`}>
                    <input type="radio" name="currency" value={c.key} checked={selectedCurrency === c.key} onChange={() => setSelectedCurrency(c.key)} className="credits-radio" />
                    <span className="credits-currency-icon">{React.createElement(STATUS_ICONS[c.key])}</span>
                    <span className="credits-currency-info">
                      <span className="credits-currency-name">{c.label}</span>
                      <span className="credits-currency-ticker">
                        ({c.key}){c.note && <span className="credits-currency-note"> · {c.note}</span>}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="credits-status-section">
                <span className="credits-status-label">System status</span>
                <div className="credits-status-list">
                  {CURRENCIES.map(c => (
                    <div key={c.key} className="credits-status-item">
                      {React.createElement(STATUS_ICONS[c.key])}
                      <CheckCircleIcon />
                    </div>
                  ))}
                </div>
              </div>

              <button className="credits-new-deposit-btn" onClick={() => setModalOpen(true)}>
                New Deposit
              </button>

              {currentDeposit && depositAddress && (
                <div className="credits-address-section">
                  <div className="credits-address-label">Your {currentDeposit.currency || selectedCurrency} deposit address</div>
                  <div className="credits-address-row">
                    <code className="credits-address-code">{depositAddress}</code>
                    <button className={`credits-copy-btn${copied ? ' copied' : ''}`} onClick={() => handleCopy(depositAddress)}>
                      {copied ? '✓' : <CopyIcon />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs + table */}
          <div className="credits-history-section">
            <div className="credits-tabs">
              {TABS.map((tab, i) => (
                <button key={tab} className={`credits-tab${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="credits-table-wrap">
              {activeTab === 0 && (
                <table className="credits-table">
                  <thead>
                    <tr><th>Id</th><th>Status</th><th>Currency</th><th>Address</th><th>Created</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {deposits.length === 0 ? (
                      <tr><td colSpan={6} className="credits-table-empty">No deposits yet.</td></tr>
                    ) : deposits.map(dep => (
                      <tr key={dep.id}>
                        <td className="credits-table-id">{String(dep.id).slice(-8)}</td>
                        <td>
                          <span className={`credits-status-badge ${dep.status || 'pending'}`}>
                            {dep.status || 'pending'}
                          </span>
                        </td>
                        <td>{dep.currency}</td>
                        <td className="credits-table-addr">{dep.address ? dep.address.slice(0, 14) + '…' : '—'}</td>
                        <td>{dep.createdAt ? new Date(dep.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td><button className="credits-details-btn" onClick={() => dep.address && handleCopy(dep.address)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 1 && (
                <table className="credits-table">
                  <thead>
                    <tr><th>Id</th><th>Type</th><th>Amount</th><th>Date</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={5} className="credits-table-empty">No credit history yet.</td></tr>
                    ) : transactions.map(txn => (
                      <tr key={txn.id}>
                        <td className="credits-table-id">{String(txn.id).slice(-8)}</td>
                        <td>{txn.type}</td>
                        <td style={{ color: Number(txn.amount) >= 0 ? '#43a047' : '#e53935', fontWeight: 600 }}>
                          {Number(txn.amount) >= 0 ? '+' : ''}${Math.abs(Number(txn.amount)).toFixed(2)}
                        </td>
                        <td>{txn.createdAt || txn.date ? new Date(txn.createdAt || txn.date).toLocaleDateString() : '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{txn.note || txn.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 2 && (
                <div className="credits-table-empty">No legacy credit history.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deposits terms modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalOpen(false)}><CloseIcon /></button>
            <h3 className="modal-title">Deposits</h3>
            <p className="modal-subtitle">Please be aware of the following before starting a new deposit.</p>
            <ol className="deposit-terms">
              {DEPOSIT_TERMS.map((t, i) => <li key={i}>{i + 1}. {t}</li>)}
            </ol>
            <label className="deposit-agree">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              <span>By checking this box, you agree to the above terms</span>
            </label>
            <button className="deposit-create-btn" disabled={!agreed || creating} onClick={handleCreateDeposit}>
              {creating ? 'Creating…' : 'Create Deposit'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
