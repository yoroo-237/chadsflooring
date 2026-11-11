const { z } = require('zod');

const COINS = ['BTC', 'LTC', 'DOGE', 'ETH', 'XMR'];

const items = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      quantity:  z.number().int().positive(),
      optionId:  z.number().int().positive().optional(),
    })
  )
  .min(1, 'Cart is empty.');

// Optional on every order: a Telegram contact, delivery (a US address, or that address
// PGP-encrypted in the browser), a refund address
const delivery = z.union([
  z.object({ pgp: z.string().max(6000) }),
  z.object({
    name:   z.string().max(120),
    street: z.string().max(120),
    apt:    z.string().max(120).optional(),
    city:   z.string().max(120),
    state:  z.string().max(2),
    zip:    z.string().max(10),
  }),
]);
const optional = {
  telegram: z.string().max(64).optional(),
  delivery: delivery.optional(),
  refund:   z.object({ currency: z.enum(COINS), address: z.string().max(200) }).optional(),
};

const placeOrderSchema = z.object({
  items,
  // Pay from one holding only; omitted = largest holdings first.
  payCurrency: z.enum(COINS).optional(),
  ...optional,
});

// Paid straight in crypto from its own address
const payOrderSchema = z.object({
  items,
  coin: z.enum(COINS),
  ...optional,
});

module.exports = { placeOrderSchema, payOrderSchema };
