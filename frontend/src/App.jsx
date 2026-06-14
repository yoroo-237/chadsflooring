import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';

import ShopPage from './pages/ShopPage';
import ExplorePage from './pages/ExplorePage';
import ProductPage from './pages/ProductPage';
import CheckoutPage from './pages/CheckoutPage';
import OrdersPage from './pages/OrdersPage';
import CartPage from './pages/CartPage';
import ProfilePage from './pages/ProfilePage';
import SupportPage from './pages/SupportPage';
import FaqPage from './pages/FaqPage';
import ShippingPolicyPage from './pages/ShippingPolicyPage';
import NewsPage from './pages/NewsPage';
import GiveawayPage from './pages/GiveawayPage';
import SystemStatusPage from './pages/SystemStatusPage';
import SettingsPage from './pages/SettingsPage';
import RewardsPage from './pages/RewardsPage';
import WalletPage from './pages/WalletPage';
import NotFoundPage from './pages/NotFoundPage';
import TeamPage from './pages/TeamPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

import { AdminRoute } from './components/admin/AdminRoute';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductForm from './pages/admin/AdminProductForm';
import AdminCategories from './pages/admin/AdminCategories';
import AdminBrands from './pages/admin/AdminBrands';
import AdminUsers from './pages/admin/AdminUsers';
import AdminUserDetail from './pages/admin/AdminUserDetail';
import AdminDeposits from './pages/admin/AdminDeposits';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminSupport from './pages/admin/AdminSupport';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminReviews from './pages/admin/AdminReviews';
import AdminNews from './pages/admin/AdminNews';
import AdminFaq from './pages/admin/AdminFaq';
import AdminGiveaways from './pages/admin/AdminGiveaways';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import AdminSystemStatus from './pages/admin/AdminSystemStatus';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Admin dashboard — outside main layout, auth-gated */}
          <Route path="/mario-dashboard" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="brands" element={<AdminBrands />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="deposits" element={<AdminDeposits />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="support/:id" element={<AdminTicketDetail />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="faq" element={<AdminFaq />} />
            <Route path="giveaways" element={<AdminGiveaways />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="system-status" element={<AdminSystemStatus />} />
          </Route>

          {/* Login — outside main layout */}
          <Route path="/login" element={<LoginPage />} />

          {/* Main storefront */}
          <Route path="/" element={<Layout />}>
            <Route index element={<ShopPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route path="checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="cart" element={<CartPage />} />
            <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="shipping-policy" element={<ShippingPolicyPage />} />
            <Route path="news" element={<NewsPage />} />
            <Route path="giveaway" element={<GiveawayPage />} />
            <Route path="system-status" element={<SystemStatusPage />} />
            <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="rewards" element={<ProtectedRoute><RewardsPage /></ProtectedRoute>} />
            <Route path="wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
            <Route path="team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
