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
});

module.exports = { placeOrderSchema };
