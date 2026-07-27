// No real mail provider is wired up. Logs the verification link to stdout
// instead of pretending to send it — the same pattern most frameworks use
// for a dev-mode mailer (Rails' letter_opener, Django's console backend).
// Swap the body of sendVerificationEmail for a real provider (SES,
// SendGrid, Postmark, ...) before a real pilot; the SMTP_HOST check below
// fails loudly instead of silently no-op'ing if someone assumes it's wired.
async function sendVerificationEmail(to, link) {
  if (process.env.SMTP_HOST) {
    throw new Error('SMTP_HOST is set but real email sending is not implemented — wire up a provider in src/email.js');
  }
  console.log(`[dev-mailer] verification link for ${to}: ${link}`);
}

module.exports = { sendVerificationEmail };
