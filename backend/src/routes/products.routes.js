const { Router } = require('express');
const { requireAuth, requireAdmin, requireApiKey, optionalAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createProductSchema, updateProductSchema, reviewSchema, stockSchema } = require('../validators/product.validator');
const ctrl = require('../controllers/products.controller');

const router = Router();

// Public — optional auth to apply markupPct
router.get('/',          optionalAuth, ctrl.list);
router.get('/scrape',    requireApiKey, ctrl.scrape);
router.get('/:id',       optionalAuth, ctrl.getOne);
router.get('/:id/reviews', ctrl.listReviews);

// Authenticated user
router.post('/:id/reviews', requireAuth, validate(reviewSchema), ctrl.createReview);

// Admin
router.post('/',               requireAuth, requireAdmin, validate(createProductSchema), ctrl.create);
router.put('/:id',             requireAuth, requireAdmin, validate(updateProductSchema), ctrl.update);
router.delete('/:id',          requireAuth, requireAdmin, ctrl.remove);
router.patch('/:id/stock',     requireAuth, requireAdmin, validate(stockSchema), ctrl.patchStock);

module.exports = router;
