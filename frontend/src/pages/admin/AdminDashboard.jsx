import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';
import StatCard from '../../components/admin/StatCard';
import StatusBadge from '../../components/admin/StatusBadge';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

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
        <StatCard icon="💰" color="#4361ee" label="Total Revenue"
          value={loading ? <Skel w={80} h={24}/> : fmt(stats.revenue?.total ?? 0)}
          sub={loading ? undefined : `Today: ${fmt(stats.revenue?.today ?? 0)}`} />
        <StatCard icon="📦" color="#2196f3" label="Total Orders"
          value={loading ? <Skel w={60} h={24}/> : stats.orders?.total ?? 0}
          sub={loading ? undefined : `Today: ${stats.orders?.today ?? 0}`} />
        <StatCard icon="⏳" color="#ff9800" label="Pending Orders"
          value={loading ? <Skel w={50} h={24}/> : stats.orders?.pending ?? 0} />
        <StatCard icon="🚚" color="#9c27b0" label="Shipped Orders"
          value={loading ? <Skel w={50} h={24}/> : stats.orders?.shipped ?? 0} />
        <StatCard icon="👥" color="#43a047" label="Total Users"
          value={loading ? <Skel w={50} h={24}/> : stats.users?.total ?? 0} />
        <StatCard icon="🛍️" color="#1a1a2e" label="Products"
          value={loading ? <Skel w={50} h={24}/> : stats.products?.total ?? 0}
          sub={loading ? undefined : `Low stock: ${stats.products?.lowStock ?? 0}`} />
        <StatCard icon="🎫" color="#e53935" label="Open Tickets"
          value={loading ? <Skel w={50} h={24}/> : stats.tickets?.open ?? 0}
          sub={loading ? undefined : `Urgent: ${stats.tickets?.urgent ?? 0}`} />
        <StatCard icon="📅" color="#4361ee" label="Revenue This Month"
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
