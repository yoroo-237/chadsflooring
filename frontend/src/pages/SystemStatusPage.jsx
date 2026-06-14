import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const STATUS_META = {
  operational:          { label: 'Operational',     color: '#43a047' },
  degraded_performance: { label: 'Degraded',        color: '#ff9800' },
  partial_outage:       { label: 'Partial Outage',  color: '#e53935' },
  major_outage:         { label: 'Major Outage',    color: '#b71c1c' },
  maintenance:          { label: 'Maintenance',     color: '#9c27b0' },
  degraded:             { label: 'Degraded',        color: '#ff9800' },
  outage:               { label: 'Outage',          color: '#e53935' },
};

function PulseDot({ color }) {
  return (
    <span className="status-dot" style={{ '--dot-color': color }}>
      <span className="status-dot-inner" />
    </span>
  );
}

const STATIC_SERVICES = [
  { name: 'Website',          desc: 'Main storefront and navigation',       status: 'operational' },
  { name: 'API',              desc: 'Product and order REST API',           status: 'operational' },
  { name: 'Payment Processing', desc: 'Crypto payment gateway',            status: 'operational' },
  { name: 'Order Management', desc: 'Order creation and tracking system',   status: 'operational' },
  { name: 'Support System',   desc: 'Ticket submission and management',     status: 'operational' },
  { name: 'CDN / Media',      desc: 'Product images and static assets',     status: 'operational' },
];

export default function SystemStatusPage() {
  const [components, setComponents] = useState({});
  const [incidents, setIncidents]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [now, setNow]               = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/content/system-status').catch(() => null),
      api.get('/content/system-status/incidents').catch(() => null),
    ]).then(([statusData, incData]) => {
      if (statusData) {
        const st = statusData.systemStatus || statusData;
        setComponents(st.components || {});
      }
      if (incData) {
        setIncidents(incData.incidents || incData || []);
      }
    }).finally(() => setLoading(false));
  }, []);

  const services = Object.keys(components).length > 0
    ? Object.entries(components).map(([key, status]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        desc: '',
        status,
      }))
    : STATIC_SERVICES;

  const allOk = services.every(s => s.status === 'operational');

  return (
    <main className="main-content">
      <div className="page-container page-container--narrow">
        <h1 className="page-title">System Status</h1>
        <p className="page-subtitle">Real-time status of all services. Last updated: {now.toLocaleTimeString()}</p>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <>
            <div className={`status-banner${allOk ? ' ok' : ' issue'}`}>
              <PulseDot color={allOk ? '#43a047' : '#ff9800'} />
              <div>
                <div className="status-banner-title">{allOk ? 'All Systems Operational' : 'Some Systems Affected'}</div>
                <div className="status-banner-sub">{allOk ? 'No incidents reported at this time.' : 'We are investigating issues. Check below for details.'}</div>
              </div>
            </div>

            <div className="services-list">
              {services.map(service => {
                const meta = STATUS_META[service.status] || STATUS_META.operational;
                return (
                  <div key={service.name} className="service-row">
                    <div className="service-info">
                      <div className="service-name">{service.name}</div>
                      {service.desc && <div className="service-desc">{service.desc}</div>}
                    </div>
                    <div className="service-right">
                      <span className="service-status-badge" style={{ color: meta.color, background: meta.color + '18' }}>
                        <PulseDot color={meta.color} />
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {incidents.length > 0 && (
              <div className="incidents-section">
                <h2 className="section-title">Recent Incidents</h2>
                {incidents.map((inc, i) => (
                  <div key={inc.id || i} className="incident-card">
                    <div className="incident-header">
                      <span className="incident-date">{inc.dateLabel || (inc.createdAt ? new Date(inc.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')}</span>
                      <span className={`incident-status ${inc.status}`}>{inc.status}</span>
                    </div>
                    <div className="incident-title">{inc.title}</div>
                    {inc.description && <p className="incident-desc">{inc.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
