const { z } = require('zod');

const registerSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(8),
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username required'),
  password: z.string().min(1, 'Password required'),
});

const resetSchema = z.object({
  token:    z.string(),
  password: z.string().min(8),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword:     z.string(),
});

module.exports = {
  registerSchema,
  loginSchema,
  resetSchema,
  changePasswordSchema,
};
