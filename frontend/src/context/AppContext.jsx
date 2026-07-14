import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, logout as doLogout } from '../utils/api';

const AppContext = createContext(null);

function normalizeProduct(p) {
  if (!p) return p;
  return {
    ...p,
    price: p.price != null ? `$${Number(p.price).toFixed(2)}` : '$0.00',
    image: p.imageUrl || p.image || '',
    brand: p.brand?.name || p.brand || '',
    brandSlug: p.brand?.slug || p.brandSlug || '',
    category: String(p.category?.id || p.categoryId || p.category || ''),
    categoryName: p.category?.name || p.categoryName || '',
  };
}

export function AppProvider({ children }) {
  const [cartItems, setCartItems]       = useState([]);
  const [wishedIds, setWishedIds]       = useState(new Set());
  const [quickAddItem, setQuickAddItem] = useState(null);
  const [theme, setTheme]               = useState(
    (typeof window !== 'undefined' && window.__FORCE_THEME) || 'dark'
  );
  const [activeCategory, setActiveCategory] = useState('');
  const [toasts, setToasts]             = useState([]);
  const [orders, setOrders]             = useState([]);
  const [search, setSearch]             = useState('');
  const [user, setUser]                 = useState(null);
  const [balance, setBalance]           = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [deposits, setDeposits]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [products, setProducts]         = useState([]);
  const [settings, setSettings]         = useState({});
  const [loadingAuth, setLoadingAuth]   = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadUserData = useCallback(async () => {
    const [profileData, walletData, catsData, settingsData] = await Promise.all([
      api.get('/profile').catch(() => null),
      api.get('/wallet').catch(() => null),
      api.get('/categories').catch(() => null),
      api.get('/content/settings').catch(() => null),
    ]);
    if (profileData) setUser(profileData.user || profileData);
    if (walletData?.balance != null) setBalance(Number(walletData.balance));
    const cats = catsData?.categories ?? (Array.isArray(catsData) ? catsData : null);
    if (cats) setCategories(cats);
    const sett = settingsData?.settings ?? settingsData;
    if (sett && typeof sett === 'object') setSettings(sett);
  }, []);

  const login = useCallback(async (username, password) => {
    const base = (process.env.REACT_APP_API_URL || 'http://localhost:4000').replace(/\/api\/?$/, '');
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');
    localStorage.setItem('token', data.data.token);
    if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    await loadUserData();
    return data.data;
  }, [loadUserData]);

  // Load user profile + balance + categories on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoadingAuth(false); return; }
    loadUserData().finally(() => setLoadingAuth(false));
  }, []);

  const showToast = useCallback((msg, type = '') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  const addToCart = useCallback((product) => {
    setCartItems(prev => [...prev, product]);
    showToast(`${product.name} added to cart`, 'success');
  }, [showToast]);

  const removeFromCart = useCallback((index) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const openQuickAdd  = useCallback((product) => setQuickAddItem(product), []);
  const closeQuickAdd = useCallback(() => setQuickAddItem(null), []);

  const addManyToCart = useCallback((product, qty) => {
    setCartItems(prev => [...prev, ...Array.from({ length: qty }, () => product)]);
    showToast(`${product.name} added to cart`, 'success');
  }, [showToast]);

  const placeOrder = useCallback(async (formData) => {
    const grouped = cartItems.reduce((acc, item) => {
      const id = item.id;
      if (!acc[id]) acc[id] = { productId: id, quantity: 0 };
      acc[id].quantity++;
      return acc;
    }, {});
    const items = Object.values(grouped);
    const body = {
      items,
      paymentMethod: formData?.payment || 'XMR',
      shipping: {
        name:    formData?.name    || '',
        email:   formData?.email   || '',
        address: formData?.address || '',
        city:    formData?.city    || '',
        postal:  formData?.postal  || '',
        country: formData?.country || 'US',
      },
    };
    const data = await api.post('/orders', body);
    const order = data.order || data;
    setOrders(prev => [order, ...prev]);
    setCartItems([]);
    if (data.newBalance != null) setBalance(Number(data.newBalance));
    showToast('Order placed successfully!', 'success');
    return order;
  }, [cartItems, showToast]);

  const refreshBalance = useCallback(async () => {
    const data = await api.get('/wallet/balance').catch(() => null);
    if (data?.balance != null) setBalance(Number(data.balance));
  }, []);

  const refreshDeposits = useCallback(async () => {
    const data = await api.get('/wallet/deposits').catch(() => null);
    if (data) setDeposits(data.deposits ?? (Array.isArray(data) ? data : []));
  }, []);

  const refreshTransactions = useCallback(async () => {
    const data = await api.get('/wallet/transactions').catch(() => null);
    if (data) setTransactions(data.transactions ?? (Array.isArray(data) ? data : []));
  }, []);

  const toggleWish = useCallback((id) => {
    setWishedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast('Removed from stash', '');
      } else {
        next.add(id);
        showToast('Added to stash', 'info');
      }
      return next;
    });
  }, [showToast]);

  const logout = useCallback(() => {
    api.post('/auth/logout', {}).catch(() => {});
    doLogout();
  }, []);

  // profile is exposed as both `user` and `profile` for backward compat
  const profile = user ? {
    name: user.username || user.name || 'User',
    email: user.email || '',
    bio: user.bio || '',
    avatar: user.avatar || user.avatarUrl || '',
  } : { name: 'Guest User', email: '', bio: '', avatar: '' };

  return (
    <AppContext.Provider value={{
      cartItems, addToCart, removeFromCart, clearCart,
      quickAddItem, openQuickAdd, closeQuickAdd, addManyToCart,
      wishedIds, toggleWish,
      theme, setTheme,
      toasts, showToast,
      orders, setOrders, placeOrder,
      search, setSearch,
      user, setUser,
      profile, setProfile: (p) => setUser(u => ({ ...u, ...p })),
      balance, setBalance, refreshBalance,
      transactions, setTransactions, refreshTransactions,
      deposits, setDeposits, refreshDeposits,
      products, setProducts,
      categories, setCategories,
      settings,
      activeCategory, setActiveCategory,
      loadingAuth,
      login, loadUserData,
      logout,
      normalizeProduct,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
