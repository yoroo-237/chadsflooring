const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

function generateTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Rules mirror exactly what SettingsPage.jsx checks in the frontend
function validatePasswordStrength(password) {
  const rules = {
    notEmpty:  password.length > 0,
    noSpaces:  !password.includes(' '),
    minLength: password.length >= 8,
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    hasNumber: /\d/.test(password),
    hasUpper:  /[A-Z]/.test(password),
    hasLower:  /[a-z]/.test(password),
  };
  const score = Object.values(rules).filter(Boolean).length;
  return { score, rules, isValid: score >= 5 };
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateTokens,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generatePasswordResetToken,
};
