import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AccountSidebar from '../components/AccountSidebar';
import { api } from '../utils/api';

const STATUS_COLORS = {
  processing: '#2196f3',
  Processing: '#2196f3',
  shipped: '#ff9800',
  Shipped: '#ff9800',
  delivered: '#43a047',
  Delivered: '#43a047',
  cancelled: '#e53935',
  Cancelled: '#e53935',
  refunded: '#9c27b0',
};

export default function OrdersPage() {
  const { orders: ctxOrders, setOrders, normalizeProduct } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders')
      .then(data => {
        const raw = data.orders || data || [];
        setOrders(raw);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setOrders]);

  const orders = ctxOrders;

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <h3 className="account-page-title">Orders</h3>

          {loading ? (
            <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="credits-table-wrap">
              <table className="credits-table">
                <thead>
                  <tr><th>Order #</th><th>Date</th><th>Status</th><th>Items</th><th>Total</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="credits-table-empty">
                      No orders yet.{' '}
                      <Link to="/" style={{ color: 'var(--primary)' }}>Start shopping →</Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(order => {
                const items    = order.items || order.orderItems || [];
                const total    = Number(order.total || order.totalAmount || 0);
                const status   = order.status || 'Processing';
                const statusColor = STATUS_COLORS[status] || '#6c757d';
                const date     = order.date || order.createdAt;
                return (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <div className="order-id">{order.id}</div>
                        <div className="order-date">{date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="order-total">${total.toFixed(2)}</div>
                        <span className="order-status" style={{ background: statusColor + '20', color: statusColor }}>
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="order-items-preview">
                      {items.map((item, i) => {
                        const product = item.product ? normalizeProduct(item.product) : item;
                        const image   = product.imageUrl || product.image || item.imageUrl || '';
                        const brand   = product.brand?.name || product.brand || item.brand || '';
                        const name    = product.name || item.name || '';
                        const price   = item.unitPrice || item.price;
                        const priceStr = price != null ? `$${Number(price).toFixed(2)}` : product.price || '';
                        return (
                          <div key={i} className="order-item-preview">
                            <img src={image} alt={name} className="order-item-img" onError={e => { e.target.style.opacity = '0'; }} />
                            <div className="order-item-info">
                              <div className="order-item-brand">{brand}</div>
                              <div className="order-item-name">{name}</div>
                              <div className="order-item-price">{priceStr}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(order.address || order.shippingAddress) && (
                      <div className="order-address">
                        <span className="order-address-label">Delivery:</span> {order.address || order.shippingAddress}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
