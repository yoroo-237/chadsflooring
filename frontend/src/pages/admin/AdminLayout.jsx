import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { decodeToken } from './utils/api';
import './admin.css';

const NAV = [
  { section: 'Overview' },
  { to: '/mario-dashboard',          icon: '📊', label: 'Dashboard',    end: true },
  { section: 'Commerce' },
  { to: '/mario-dashboard/orders',   icon: '📦', label: 'Orders' },
  { to: '/mario-dashboard/products', icon: '🛍️', label: 'Products' },
  { to: '/mario-dashboard/categories', icon: '🏷️', label: 'Categories' },
  { to: '/mario-dashboard/brands',   icon: '🔖', label: 'Brands' },
  { section: 'Users & Finance' },
  { to: '/mario-dashboard/users',    icon: '👥', label: 'Users' },
  { to: '/mario-dashboard/deposits', icon: '💳', label: 'Deposits' },
  { to: '/mario-dashboard/transactions', icon: '💰', label: 'Transactions' },
  { section: 'Support' },
  { to: '/mario-dashboard/support',  icon: '🎫', label: 'Support Tickets' },
  { to: '/mario-dashboard/reviews',  icon: '⭐', label: 'Reviews' },
  { section: 'Content' },
  { to: '/mario-dashboard/news',     icon: '📰', label: 'News' },
  { to: '/mario-dashboard/faq',      icon: '❓', label: 'FAQ' },
  { to: '/mario-dashboard/giveaways',icon: '🎁', label: 'Giveaways' },
  { section: 'System' },
  { to: '/mario-dashboard/analytics',    icon: '📈', label: 'Analytics' },
  { to: '/mario-dashboard/system-status',icon: '🔧', label: 'System Status' },
  { to: '/mario-dashboard/settings',     icon: '⚙️', label: 'Settings' },
];

function getAdminName() {
  try {
    const t = localStorage.getItem('token');
    if (!t) return 'Admin';
    const p = decodeToken(t);
    return p?.username || p?.email?.split('@')[0] || 'Admin';
  } catch { return 'Admin'; }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminName = getAdminName();

  const logout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="admin-sidebar-logo">
          <h2>🌿 Canna Express</h2>
          <span>Admin Dashboard</span>
        </div>
        <nav className="admin-nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={i} className="admin-nav-section">{item.section}</div>;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span>{item.icon}</span> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-sidebar-logout" onClick={logout}>
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <header className="admin-header">
          <button
            className="admin-header-icon-btn admin-sidebar-toggle-btn"
            onClick={() => setSidebarOpen(o => !o)}
          >
            ☰
          </button>
          <div className="admin-header-title"></div>
          <div className="admin-header-right">
            <div className="admin-user-chip">
              <div className="admin-avatar">{adminName[0]?.toUpperCase()}</div>
              <span className="admin-username">{adminName}</span>
            </div>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
