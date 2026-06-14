import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function NewsPlaceholderIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

export default function NewsPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/content/news')
      .then(data => setArticles(data.articles || data.news || data || []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="main-content">
      <div className="page-container">
        <h1 className="page-title">News & Updates</h1>
        <p className="page-subtitle">Stay up to date with the latest products, events, and announcements.</p>

        {loading ? (
          <div className="empty-state"><p>Loading…</p></div>
        ) : articles.length === 0 ? (
          <div className="empty-state"><p>No articles yet. Check back soon.</p></div>
        ) : (
          <div className="news-grid">
            {articles.map(article => (
              <article key={article.id} className="news-card">
                <div className="news-card-image">
                  {article.image || article.imageUrl ? (
                    <img src={article.image || article.imageUrl} alt={article.title} onError={e => { e.target.parentElement.style.background = '#f0f4f8'; e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="news-card-image-placeholder"><NewsPlaceholderIcon /></div>
                  )}
                  {article.tag && (
                    <span className="news-tag" style={{ background: article.tagColor || '#607d8b' }}>{article.tag}</span>
                  )}
                </div>
                <div className="news-card-body">
                  <div className="news-meta">
                    <span className="news-category">{article.category || '—'}</span>
                    <span className="news-date">{article.date || (article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')}</span>
                  </div>
                  <h2 className="news-title">{article.title}</h2>
                  <p className="news-excerpt">{article.excerpt || article.body?.slice(0, 160) || ''}</p>
                  <button className="news-read-more">Read more →</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
