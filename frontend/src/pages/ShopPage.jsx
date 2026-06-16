import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CartDrawer from '../components/CartDrawer';
import FilterPanel from '../components/FilterPanel';
import CategoryNav from '../components/CategoryNav';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const HeartIcon = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

export default function ShopPage() {
  const { addToCart, openQuickAdd, wishedIds, toggleWish, search, activeCategory, setActiveCategory, normalizeProduct } = useApp();
  const navigate = useNavigate();

  const [filterOpen, setFilterOpen]   = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortOrder, setSortOrder]     = useState('none');
  const [viewMode, setViewMode]       = useState('grid');
  const [filters, setFilters]         = useState({});
  const [stashMode, setStashMode]     = useState(false);

  const [products, setProducts]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [brands, setBrands]           = useState([]);
  const [loading, setLoading]         = useState(true);

  const debounceRef = useRef(null);

  const fetchProducts = useCallback(async (overrides = {}) => {
    setLoading(true);
    const params = {};
    const cat = overrides.category !== undefined ? overrides.category : activeCategory;
    const q   = overrides.search   !== undefined ? overrides.search   : search;
    const stock = overrides.inStockOnly !== undefined ? overrides.inStockOnly : inStockOnly;
    const f = overrides.filters !== undefined ? overrides.filters : filters;

    if (cat)    params.category  = cat;
    if (q)      params.search    = q;
    if (stock)  params.inStock   = 'true';
    if (f.selectedBrands?.length) params.brands = f.selectedBrands.join(',');
    if (f.maxPrice) params.maxPrice = f.maxPrice;
    if (f.selectedRating && f.selectedRating !== 'Any') params.minRating = f.selectedRating;
    if (sortOrder !== 'none') params.sort = sortOrder === 'asc' ? 'name_asc' : 'name_desc';
    params.limit = 200;

    try {
      const data = await api.get('/products', params);
      const raw = data.products || data || [];
      setProducts(raw.map(normalizeProduct));
      setTotal(data.total || raw.length);
      if (data.brands) setBrands(data.brands);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search, inStockOnly, filters, sortOrder, normalizeProduct]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(), 300);
    return () => clearTimeout(debounceRef.current);
  }, [fetchProducts]);

  // Also load brands once on mount
  useEffect(() => {
    api.get('/brands').then(d => {
      if (d.brands) setBrands(d.brands.map(b => b.name || b));
    }).catch(() => {});
  }, []);

  const handleFilterApply = useCallback((f) => {
    setFilters(f);
    if (f.inStockOnly !== undefined) setInStockOnly(f.inStockOnly);
  }, []);

  const stashProducts = products.filter(p => wishedIds.has(p.id));
  const visibleProducts = stashMode ? stashProducts : products;
  const totalOptions = visibleProducts.reduce((sum, p) => sum + (p.options || 1), 0);

  return (
    <>
      <CategoryNav active={stashMode ? null : activeCategory} />

      <div className="shop-toolbar">
        <div className="shop-toolbar-inner">
          <div className="toolbar-left">
            <button className={`filter-btn${filterOpen ? ' active' : ''}`} onClick={() => setFilterOpen(true)}>
              <FilterIcon /> Filter
            </button>
            <span className="toolbar-count">
              {stashMode
                ? `${visibleProducts.length} stashed item${visibleProducts.length !== 1 ? 's' : ''}`
                : `${visibleProducts.length} products, with ${totalOptions} options`}
            </span>
          </div>
          <div className="toolbar-right">
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                <span className="toggle-slider" />
              </span>
              In stock only
            </label>

            <button
              className={`sort-btn${stashMode ? ' active stash-active' : ''}`}
              onClick={() => setStashMode(v => !v)}
              title={stashMode ? 'Back to shop' : 'View stash'}
            >
              <HeartIcon filled={stashMode} />
              Stash{wishedIds.size > 0 ? ` (${wishedIds.size})` : ''}
            </button>

            <button
              className={`sort-btn${sortOrder !== 'none' ? ' active' : ''}`}
              onClick={() => setSortOrder(o => o === 'none' ? 'asc' : o === 'asc' ? 'desc' : 'none')}
              title={sortOrder === 'asc' ? 'A→Z, click for Z→A' : sortOrder === 'desc' ? 'Z→A, click to clear' : 'Sort A→Z'}
            >
              <ChevronIcon /> {sortOrder === 'desc' ? 'Z - A' : 'A - Z'}
            </button>

            <button className={`sort-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <ListIcon /> List
            </button>
            <button className={`sort-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')}>
              <GridIcon /> Grid
            </button>
          </div>
        </div>
      </div>

      <main className="main-content">
        <div className="products-area">
          {loading ? (
            <div className="empty-state"><p>Loading products…</p></div>
          ) : visibleProducts.length === 0 ? (
            <div className="empty-state">
              {stashMode ? (
                <>
                  <div className="empty-state-icon">♡</div>
                  <h3>Your stash is empty</h3>
                  <p>Heart any product to save it here for later.</p>
                  <button className="filter-btn" style={{ marginTop: 12 }} onClick={() => setStashMode(false)}>
                    Back to Shop
                  </button>
                </>
              ) : (
                <>
                  <h3>No products found</h3>
                  <p>Try adjusting your filters or switching categories.</p>
                </>
              )}
            </div>
          ) : (
            <div className={`products-grid${viewMode === 'list' ? ' list-view' : ''}`}>
              {visibleProducts.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={openQuickAdd}
                  delay={Math.min(i * 40, 400)}
                  wished={wishedIds.has(product.id)}
                  onWishToggle={toggleWish}
                  onNavigate={() => navigate(`/product/${product.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <FilterPanel
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleFilterApply}
        brands={brands}
      />
    </>
  );
}
