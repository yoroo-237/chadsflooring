import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function CategoryNav({ active }) {
  const navigate = useNavigate();
  const { categories, setActiveCategory } = useApp();
  const trackRef = useRef(null);

  const go = (item) => {
    if (item === 'explore') { navigate('/explore'); return; }
    if (item === 'rewards') { navigate('/rewards'); return; }
    setActiveCategory(item);
    navigate('/');
  };

  const isActive = (key) => String(active) === String(key);

  return (
    <nav className="catnav">
      <div className="catnav-inner" ref={trackRef}>
        <button
          className={`catnav-tab${isActive('explore') ? ' active' : ''}`}
          onClick={() => go('explore')}
        >
          Explore
        </button>

        {categories.filter(c => c.id !== '-1').map(cat => (
          <button
            key={cat.id}
            className={`catnav-tab${isActive(cat.slug) ? ' active' : ''}`}
            onClick={() => go(cat.slug)}
          >
            {cat.name || cat.label}
          </button>
        ))}

        <button
          className={`catnav-tab${isActive('rewards') ? ' active' : ''}`}
          onClick={() => go('rewards')}
        >
          Rewards
        </button>
      </div>
    </nav>
  );
}
