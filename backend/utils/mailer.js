// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const SMTP_USER = process.env.EMAIL_USER;
const SMTP_PASS = process.env.EMAIL_PASS;
const FROM = process.env.EMAIL_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);

// Warn when not configured
if (!SMTP_USER || !SMTP_PASS) {
  console.warn('Mailer disabled - missing EMAIL_USER or EMAIL_PASS in .env');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  // Uncomment the following for dev environments if needed:
  // tls: { rejectUnauthorized: false },
});

async function sendMail({ to, subject, html, text }) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('sendMail: mailer not configured; skipping send to', to);
    return { skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
    console.log(`Email sent to ${to}; id=${info.messageId}`);
    return { ok: true, info };
  } catch (err) {
    console.error('sendMail error', err);
    throw err;
  }
}

module.exports = { sendMail };
