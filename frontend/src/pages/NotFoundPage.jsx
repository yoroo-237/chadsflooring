import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="main-content">
      <div className="page-container">
        <div className="not-found">
          <div className="not-found-code">404</div>
          <h1 className="not-found-title">Page Not Found</h1>
          <p className="not-found-desc">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="not-found-actions">
            <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
            <Link to="/" className="btn-primary">Back to Shop</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
