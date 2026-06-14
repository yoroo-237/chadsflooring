const { z } = require('zod');

const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity:  z.number().int().positive(),
        optionId:  z.number().int().positive().optional(),
      })
    )
    .min(1, 'Cart is empty.'),
  paymentMethod: z.enum(['XMR', 'BTC', 'ETH']),
  shipping: z.object({
    name:    z.string().min(1).max(255),
    email:   z.string().email(),
    address: z.string().min(1).max(500),
    city:    z.string().min(1).max(255),
    postal:  z.string().min(1).max(20),
    country: z.enum(['US', 'CA', 'UK', 'AU', 'DE', 'FR', 'Other']),
  }),
});

module.exports = { placeOrderSchema };
