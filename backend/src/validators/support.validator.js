const { z } = require('zod');

const createTicketSchema = z.object({
  category: z.enum([
    'General', 'Order Issue', 'Payment', 'Shipping',
    'Product Question', 'Account', 'Technical', 'Other',
  ]),
  subject: z.string().min(1),
  message: z.string().min(10),
});

module.exports = { createTicketSchema };
