import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

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
                    <div className="news-card-image-placeholder">📰</div>
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
