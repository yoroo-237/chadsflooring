import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';
import StatCard from '../../components/admin/StatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

function IconRevenue() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-3-7h2a1 1 0 0 1 0 2H9a1 1 0 0 0 0 2h6"/>
    </svg>
  );
}
function IconBox() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconTruck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconBag() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
function IconTicket() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const PIE_COLORS = { processing: '#2196f3', shipped: '#ff9800', delivered: '#43a047', cancelled: '#e53935' };
const fmt = n => `$${Number(n).toFixed(2)}`;

function Skel({ w = '100%', h = 16 }) {
  return <span className="admin-skel" style={{ width: w, height: h, display: 'block', borderRadius: 6 }} />;
}

export default function AdminDashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState(null);

  useEffect(() => {
    adminFetch('/admin/dashboard')
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (err) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#e53935' }}>{err}</div>
  );

  const stats = data?.stats || {};
  const pieData = data?.charts?.ordersStatusChart
    ? Object.entries(data.charts.ordersStatusChart).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Overview of your store</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="admin-stat-grid">
        <StatCard icon={<IconRevenue />} color="#4361ee" label="Total Revenue"
          value={loading ? <Skel w={80} h={24}/> : fmt(stats.revenue?.total ?? 0)}
          sub={loading ? undefined : `Today: ${fmt(stats.revenue?.today ?? 0)}`} />
        <StatCard icon={<IconBox />} color="#2196f3" label="Total Orders"
          value={loading ? <Skel w={60} h={24}/> : stats.orders?.total ?? 0}
          sub={loading ? undefined : `Today: ${stats.orders?.today ?? 0}`} />
        <StatCard icon={<IconClock />} color="#ff9800" label="Pending Orders"
          value={loading ? <Skel w={50} h={24}/> : stats.orders?.pending ?? 0} />
        <StatCard icon={<IconTruck />} color="#9c27b0" label="Shipped Orders"
          value={loading ? <Skel w={50} h={24}/> : stats.orders?.shipped ?? 0} />
        <StatCard icon={<IconUsers />} color="#43a047" label="Total Users"
          value={loading ? <Skel w={50} h={24}/> : stats.users?.total ?? 0} />
        <StatCard icon={<IconBag />} color="#1a1a2e" label="Products"
          value={loading ? <Skel w={50} h={24}/> : stats.products?.total ?? 0}
          sub={loading ? undefined : `Low stock: ${stats.products?.lowStock ?? 0}`} />
        <StatCard icon={<IconTicket />} color="#e53935" label="Open Tickets"
          value={loading ? <Skel w={50} h={24}/> : stats.tickets?.open ?? 0}
          sub={loading ? undefined : `Urgent: ${stats.tickets?.urgent ?? 0}`} />
        <StatCard icon={<IconCalendar />} color="#4361ee" label="Revenue This Month"
          value={loading ? <Skel w={80} h={24}/> : fmt(stats.revenue?.thisMonth ?? 0)} />
      </div>

      {/* Charts row 1 */}
      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <div className="admin-chart-wrap">
          <div className="admin-chart-title">Revenue — Last 30 Days</div>
          {loading
            ? <Skel w="100%" h={200} />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data?.charts?.revenueChart || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={v => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#4361ee" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>
        <div className="admin-chart-wrap">
          <div className="admin-chart-title">Orders by Status</div>
          {loading
            ? <Skel w="100%" h={200} />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#6c757d'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        <div className="admin-chart-wrap">
          <div className="admin-chart-title">Top 5 Products</div>
          {loading
            ? <Skel w="100%" h={180} />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart layout="vertical" data={data?.charts?.topProducts || []} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} tickLine={false} axisLine={false}
                    tickFormatter={v => v?.length > 14 ? v.slice(0, 14) + '…' : v} />
                  <Tooltip formatter={v => [v, 'Units sold']} />
                  <Bar dataKey="sold" fill="#4361ee" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
        <div className="admin-chart-wrap">
          <div className="admin-chart-title">New Users — Last 7 Days</div>
          {loading
            ? <Skel w="100%" h={180} />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.charts?.newUsersChart || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={v => [v, 'New users']} />
                  <Bar dataKey="count" fill="#43a047" radius={[4, 4, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Tables row */}
      <div className="admin-grid-2">
        {/* Recent orders */}
        <div className="admin-card">
          <div className="admin-card-title">Recent Orders</div>
          <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Total</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}><td colSpan={4}><Skel w="100%" h={14} /></td></tr>
                  ))
                  : (data?.recentOrders || []).length === 0
                    ? <tr><td colSpan={4} className="admin-table-empty">No orders yet</td></tr>
                    : (data?.recentOrders || []).map(o => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>#{o.orderNumber}</td>
                        <td>{o.user?.username || o.user?.email || '—'}</td>
                        <td>{fmt(o.total)}</td>
                        <td><StatusBadge status={o.status} /></td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Low stock */}
        <div className="admin-card">
          <div className="admin-card-title">Low Stock Products</div>
          <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Stock</th></tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}><td colSpan={2}><Skel w="100%" h={14} /></td></tr>
                  ))
                  : (data?.lowStockProducts || []).length === 0
                    ? <tr><td colSpan={2} className="admin-table-empty">All products stocked</td></tr>
                    : (data?.lowStockProducts || []).map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td style={{ color: p.stock === 0 ? '#e53935' : '#ff9800', fontWeight: 700 }}>{p.stock}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
