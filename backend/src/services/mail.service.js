const nodemailer = require('nodemailer');

const SMTP_CONFIGURED = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = SMTP_CONFIGURED
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

async function sendMail(to, subject, html) {
  if (!transporter) {
    console.log(`[mail] SMTP not configured — would have sent to ${to}: ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: `"Canna Express" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

async function sendPasswordResetEmail(email, resetToken) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = `
    <h2>Reset your password</h2>
    <p>Click the link below to reset your password. It expires in 1 hour.</p>
    <a href="${url}">${url}</a>
    <p>If you didn't request this, you can ignore this email.</p>
  `;
  await sendMail(email, 'Reset your Canna Express password', html);
}

async function sendWelcomeEmail(email, username) {
  const html = `
    <h2>Welcome to Canna Express, ${username}!</h2>
    <p>Your account has been created successfully.</p>
    <a href="${process.env.FRONTEND_URL}">Start shopping</a>
  `;
  await sendMail(email, 'Welcome to Canna Express', html);
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail };
