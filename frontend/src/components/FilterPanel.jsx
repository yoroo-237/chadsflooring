import React, { useState } from 'react';

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

const RATINGS = ['5 Stars', '4+ Stars', '3+ Stars', 'Any'];

export default function FilterPanel({ isOpen, onClose, onApply, brands = [] }) {
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedRating, setSelectedRating] = useState('Any');
  const [maxPrice, setMaxPrice] = useState(200);
  const [inStockOnly, setInStockOnly] = useState(true);

  const toggleBrand = b => setSelectedBrands(prev =>
    prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
  );

  const handleApply = () => {
    onApply({ selectedBrands, selectedRating, maxPrice, inStockOnly });
    onClose();
  };

  const handleReset = () => {
    setSelectedBrands([]);
    setSelectedRating('Any');
    setMaxPrice(200);
    setInStockOnly(true);
    onApply({ selectedBrands: [], selectedRating: 'Any', maxPrice: 200, inStockOnly: true });
  };

  return (
    <>
      <div className={`filter-overlay${isOpen ? ' open' : ''}`} onClick={onClose} />
      <div className={`filter-panel${isOpen ? ' open' : ''}`}>
        <div className="filter-header">
          <h3>Filters</h3>
          <button className="filter-close" onClick={onClose}><XIcon /></button>
        </div>
        <div className="filter-body">
          {/* Availability */}
          <div className="filter-section">
            <h4>Availability</h4>
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              In stock only
            </label>
          </div>

          {/* Brand */}
          {brands.length > 0 && (
            <div className="filter-section">
              <h4>Brand {selectedBrands.length > 0 && `(${selectedBrands.length})`}</h4>
              <div className="filter-chips">
                {brands.map(b => (
                  <div
                    key={b}
                    className={`filter-chip${selectedBrands.includes(b) ? ' active' : ''}`}
                    onClick={() => toggleBrand(b)}
                  >
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating */}
          <div className="filter-section">
            <h4>Rating</h4>
            <div className="filter-chips">
              {RATINGS.map(r => (
                <div
                  key={r}
                  className={`filter-chip${selectedRating === r ? ' active' : ''}`}
                  onClick={() => setSelectedRating(r)}
                >
                  {r}
                </div>
              ))}
            </div>
          </div>

          {/* Max price */}
          <div className="filter-section">
            <h4>Max Price: ${maxPrice}{maxPrice === 200 ? '+' : ''}</h4>
            <div className="range-slider">
              <input
                type="range"
                min="0" max="200" step="5"
                value={maxPrice}
                onChange={e => setMaxPrice(Number(e.target.value))}
              />
              <div className="range-labels"><span>$0</span><span>$200+</span></div>
            </div>
          </div>
        </div>
        <div className="filter-footer">
          <button className="btn-reset" onClick={handleReset}>Reset</button>
          <button className="btn-apply" onClick={handleApply}>Apply Filters</button>
        </div>
      </div>
    </>
  );
}
