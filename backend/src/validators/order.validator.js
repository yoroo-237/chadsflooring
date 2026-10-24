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
  // Pay from one holding only; omitted = largest holdings first.
  payCurrency: z.enum(['BTC', 'LTC', 'DOGE', 'ETH', 'XMR']).optional(),
});

module.exports = { placeOrderSchema };
