const nodemailer = require('nodemailer');

// No SMTP_HOST configured -> logs the link to stdout instead of sending,
// same pattern most frameworks use for a dev-mode mailer (Rails'
// letter_opener, Django's console backend). Set SMTP_HOST (+ SMTP_PORT,
// SMTP_USER, SMTP_PASS, SMTP_FROM) to send for real.
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false (STARTTLS) otherwise
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function send({ to, subject, text }) {
  if (!process.env.SMTP_HOST) {
    console.log(`[dev-mailer] ${subject} for ${to}: ${text}`);
    return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'ShieldAI <no-reply@shieldai.local>',
    to,
    subject,
    text,
  });
}

async function sendVerificationEmail(to, link) {
  await send({
    to,
    subject: 'Verify your ShieldAI email',
    text: `Click the link below to verify your email address:\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
  });
}

async function sendPasswordResetEmail(to, link) {
  await send({
    to,
    subject: 'Reset your ShieldAI password',
    text: `Click the link below to choose a new password. This link expires in 1 hour and can only be used once:\n\n${link}\n\nIf you didn't request this, you can safely ignore this email — your password won't change.`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, getTransporter };
