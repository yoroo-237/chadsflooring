const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middlewares/errorHandler');
const authRoutes       = require('./routes/auth.routes');
const productsRoutes   = require('./routes/products.routes');
const categoriesRoutes = require('./routes/categories.routes');
const brandsRoutes     = require('./routes/brands.routes');
const ordersRoutes        = require('./routes/orders.routes');
const walletRoutes        = require('./routes/wallet.routes');
const webhooksRoutes      = require('./routes/webhooks.routes');
const profileRoutes       = require('./routes/profile.routes');
const apiKeysRoutes       = require('./routes/apiKeys.routes');
const wishlistRoutes      = require('./routes/wishlist.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const supportRoutes       = require('./routes/support.routes');
const contentRoutes       = require('./routes/content.routes');
const adminRoutes         = require('./routes/admin.routes');
const teamRoutes          = require('./routes/team.routes');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing
app.use(express.json());

// Serve local uploads (avatar fallback when Cloudinary not configured)
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// HTTP logging
app.use(morgan('dev'));

// Global rate limit: 300 req / 15 min
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
}));

// Auth rate limit: 10 req / 15 min
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth',       authRoutes);
app.use('/api/products',   productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/brands',     brandsRoutes);
app.use('/api/orders',        ordersRoutes);
app.use('/api/wallet',        walletRoutes);
app.use('/api/webhooks',      webhooksRoutes);
app.use('/api/profile',       profileRoutes);
app.use('/api/api-keys',      apiKeysRoutes);
app.use('/api/wishlist',      wishlistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/support',       supportRoutes);
app.use('/api/content',       contentRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/team',          teamRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
