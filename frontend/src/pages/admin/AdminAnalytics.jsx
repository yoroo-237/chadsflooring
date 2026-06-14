import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

const fmt = n => `$${Number(n || 0).toFixed(2)}`;
const fmtK = n => { const v = Number(n || 0); return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`; };

const PIE_COLORS   = { processing: '#2196f3', shipped: '#ff9800', delivered: '#43a047', cancelled: '#e53935', refunded: '#9c27b0' };
const CRYPTO_COLORS = { BTC: '#f7931a', ETH: '#627eea', DOGE: '#c2a633', LTC: '#345d9d', XMR: '#ff6600', USD: '#4361ee' };
const CAT_COLORS   = ['#4361ee', '#43a047', '#ff9800', '#e53935', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

const PERIODS = [
  { label: '7 days',  value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: '1 year',  value: '1y' },
];

function Skel({ h = 220 }) {
  return <span className="admin-skel" style={{ width: '100%', height: h, display: 'block', borderRadius: 8 }} />;
}

function ChartWrap({ title, children, loading, h = 220 }) {
  return (
    <div className="admin-chart-wrap">
      <div className="admin-chart-title">{title}</div>
      {loading ? <Skel h={h} /> : children}
    </div>
  );
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30d');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    setLoading(true); setErr(null);
    adminFetch(`/admin/analytics?period=${period}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, [period]);

  const summary   = data?.summary   || {};
  const revChart  = data?.revenueChart  || [];
  const ordChart  = data?.ordersChart   || [];
  const usrChart  = data?.newUsersChart || [];
  const walletFlow = data?.walletFlow   || [];
  const topProducts = data?.topProducts || [];
  const topCats    = data?.topCategories || [];
  const depositsByCur = data?.depositsByCurrency || [];
  const ordersByStatus = data?.ordersStatusChart
    ? Object.entries(data.ordersStatusChart).map(([name, value]) => ({ name, value }))
    : [];
  const revenueByMethod = data?.revenueByMethod || [];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-subtitle">Revenue, orders and user insights</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.value}
              className={`admin-btn admin-btn-sm ${period === p.value ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
              onClick={() => setPeriod(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 16 }}>{err}</div>}

      {/* Summary stats */}
      {!loading && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <div className="admin-stat-card" style={{ '--stat-color': '#4361ee' }}>
            <div className="admin-stat-value">{fmtK(summary.revenue)}</div>
            <div className="admin-stat-label">Revenue</div>
          </div>
          <div className="admin-stat-card" style={{ '--stat-color': '#2196f3' }}>
            <div className="admin-stat-value">{summary.orders ?? 0}</div>
            <div className="admin-stat-label">Orders</div>
          </div>
          <div className="admin-stat-card" style={{ '--stat-color': '#43a047' }}>
            <div className="admin-stat-value">{summary.newUsers ?? 0}</div>
            <div className="admin-stat-label">New Users</div>
          </div>
          <div className="admin-stat-card" style={{ '--stat-color': '#ff9800' }}>
            <div className="admin-stat-value">{fmtK(summary.avgOrderValue)}</div>
            <div className="admin-stat-label">Avg Order</div>
          </div>
          <div className="admin-stat-card" style={{ '--stat-color': '#9c27b0' }}>
            <div className="admin-stat-value">{fmtK(summary.totalDeposits)}</div>
            <div className="admin-stat-label">Deposits</div>
          </div>
        </div>
      )}

      {/* Row 1: Revenue + New Users */}
      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <ChartWrap title="Revenue Over Time" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtK} width={50} />
              <Tooltip formatter={v => [fmt(v), 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrap>

        <ChartWrap title="New Users Over Time" loading={loading}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={usrChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={35} />
              <Tooltip formatter={v => [v, 'New users']} />
              <Line type="monotone" dataKey="count" stroke="#43a047" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrap>
      </div>

      {/* Row 2: Donut orders by status + Bar revenue by method */}
      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <ChartWrap title="Orders by Status" loading={loading}>
          {ordersByStatus.length === 0
            ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 40 }}>No data</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name" paddingAngle={2}>
                    {ordersByStatus.map(e => <Cell key={e.name} fill={PIE_COLORS[e.name] || '#6c757d'} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </ChartWrap>

        <ChartWrap title="Revenue by Payment Method" loading={loading}>
          {revenueByMethod.length === 0
            ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 40 }}>No data</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueByMethod} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="method" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtK} width={50} />
                  <Tooltip formatter={v => [fmt(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={24}>
                    {revenueByMethod.map((e, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartWrap>
      </div>

      {/* Row 3: Top 10 products table */}
      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-card-title">Top 10 Products by Revenue</div>
        {loading
          ? <Skel h={200} />
          : topProducts.length === 0
            ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 30 }}>No data</div>
            : (
              <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
                <table className="admin-table">
                  <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Revenue</th><th>Units Sold</th></tr></thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.id || i}>
                        <td style={{ color: '#6c757d', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ color: '#6c757d' }}>{p.category || '—'}</td>
                        <td style={{ fontWeight: 700, color: '#43a047' }}>{fmt(p.revenue)}</td>
                        <td>{p.sold ?? p.quantity ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Row 4: Top categories + Deposits by currency */}
      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <ChartWrap title="Revenue by Category" loading={loading} h={200}>
          {topCats.length === 0
            ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 30 }}>No data</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart layout="vertical" data={topCats} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} tickLine={false} axisLine={false}
                    tickFormatter={v => v?.length > 12 ? v.slice(0, 12) + '…' : v} />
                  <Tooltip formatter={v => [fmt(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={16}>
                    {topCats.map((e, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </ChartWrap>

        <ChartWrap title="Deposits by Currency" loading={loading} h={200}>
          {depositsByCur.length === 0
            ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 30 }}>No data</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={depositsByCur} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="currency" paddingAngle={2}>
                    {depositsByCur.map(e => <Cell key={e.currency} fill={CRYPTO_COLORS[e.currency] || '#6c757d'} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [fmt(v), n]} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </ChartWrap>
      </div>

      {/* Row 5: Wallet flow area chart */}
      <ChartWrap title="Wallet Flow — Deposits vs Purchases" loading={loading} h={240}>
        {walletFlow.length === 0
          ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 40 }}>No data</div>
          : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={walletFlow} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#43a047" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#43a047" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e53935" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e53935" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => v?.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmtK} width={50} />
                <Tooltip formatter={v => [fmt(v)]} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="deposits"  stroke="#43a047" strokeWidth={2} fill="url(#gradDeposits)"  dot={false} />
                <Area type="monotone" dataKey="purchases" stroke="#e53935" strokeWidth={2} fill="url(#gradPurchases)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )
        }
      </ChartWrap>
    </div>
  );
}
