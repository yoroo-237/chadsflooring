import React from 'react';
import { decodeToken } from '../../pages/admin/utils/api';

// Gates the super admin panel specifically — a plain 'admin' passes AdminRoute
// (the outer guard) but should not see this page at all.
export function SuperAdminRoute({ children }) {
  const token = localStorage.getItem('token');
  const role  = token ? decodeToken(token)?.role : null;

  if (role !== 'superadmin') {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Super admin access required</div>
        <div style={{ color: '#6c757d', fontSize: 14, marginTop: 4 }}>
          This section is restricted to super admin accounts.
        </div>
      </div>
    );
  }
  return children;
}
