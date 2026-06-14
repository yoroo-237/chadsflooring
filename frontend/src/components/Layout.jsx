import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import SupportWidget from './SupportWidget';
import QuickAddModal from './QuickAddModal';
import { useApp } from '../context/AppContext';

const TOUR_STEPS = [
  { title: 'Welcome to the Shop', desc: 'Browse hundreds of products across multiple categories. Use the tabs above to explore.' },
  { title: 'Browse Categories', desc: 'Switch between Accessories, Carts, Flower, Edibles and more using the navigation tabs.' },
  { title: 'Make your first deposit', desc: 'Click your wallet balance in the header to top up. Choose XMR, BTC or ETH and send crypto to your address.' },
  { title: 'Filter Products', desc: 'Click the Filter button to narrow down products by brand, price range, and rating.' },
  { title: 'Search Products', desc: 'Use the search bar in the header to quickly find any product or brand by name.' },
  { title: 'Add to Cart', desc: 'Hover over any product card to reveal the quick-add button, then click to add it to your cart.' },
  { title: 'Save to Stash', desc: 'Click the heart icon on any product to save it to your Stash. Access your stash from the toolbar.' },
  { title: 'Sort & View Modes', desc: 'Use A-Z or Z-A to sort alphabetically. Toggle between grid and list view for different layouts.' },
  { title: 'Checkout', desc: "When ready, open your cart and click Checkout to complete your order. It's that simple!" },
];

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function Layout() {
  const { cartItems, removeFromCart, theme, setTheme, showToast, toasts } = useApp();
  const [cartOpen, setCartOpen] = useState(false);
  const [tourVisible, setTourVisible] = useState(true);
  const [tourStep, setTourStep] = useState(3);
  const navigate = useNavigate();
  const location = useLocation();

  const { search, setSearch } = useApp();

  // When search is set from a non-shop page, navigate to shop
  useEffect(() => {
    if (search && location.pathname !== '/') {
      navigate('/');
    }
  }, [search]);

  const handleCheckout = () => {
    setCartOpen(false);
    navigate('/cart');
  };

  const currentStep = TOUR_STEPS[tourStep - 1] || TOUR_STEPS[0];
  const isShopPage = location.pathname === '/';

  const ACCOUNT_ROUTES = ['/profile', '/rewards', '/wallet', '/credits', '/orders', '/team', '/settings', '/support'];
  const isAccountPage = ACCOUNT_ROUTES.some(r => location.pathname.startsWith(r));

  return (
    <div className={`app-layout${isAccountPage ? ' app-layout--account' : ''}`}>
      <Header
        cartCount={cartItems.length}
        onCartOpen={() => setCartOpen(true)}
        onShowToast={showToast}
      />

      <Outlet />

      <Footer theme={theme} onThemeChange={setTheme} />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
        onDeposit={() => { setCartOpen(false); navigate('/wallet'); }}
      />

      {/* Tour — only on shop page */}
      {tourVisible && isShopPage && (
        <div className="tour-popup">
          <div className="tour-close-wrap">
            <button className="tour-close" onClick={() => setTourVisible(false)}><XIcon /></button>
          </div>
          <div className="tour-body">
            <div className="tour-title">{currentStep.title}</div>
            <div className="tour-desc">{currentStep.desc}</div>
            <div className="tour-footer">
              <span className="tour-step">{tourStep} of {TOUR_STEPS.length}</span>
              <div className="tour-actions">
                <button
                  className="tour-btn-back"
                  onClick={() => setTourStep(s => Math.max(1, s - 1))}
                  disabled={tourStep === 1}
                >
                  Back
                </button>
                <button className="tour-btn-next" onClick={() => {
                  if (tourStep < TOUR_STEPS.length) setTourStep(s => s + 1);
                  else setTourVisible(false);
                }}>
                  {tourStep < TOUR_STEPS.length ? 'Next' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast${t.type ? ' ' + t.type : ''}`}>{t.msg}</div>
        ))}
      </div>

      {/* Floating support / chat widget */}
      <SupportWidget />

      {/* Quick-add product modal */}
      <QuickAddModal />
    </div>
  );
}
