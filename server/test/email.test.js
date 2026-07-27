const test = require('node:test');
const assert = require('node:assert/strict');
const { sendVerificationEmail } = require('../src/email');

test('logs the link instead of sending when no SMTP_HOST is configured', async () => {
  delete process.env.SMTP_HOST;
  await assert.doesNotReject(sendVerificationEmail('a@example.com', 'https://app.example.com/verify?ticket=abc'));
});

test('fails loudly instead of silently no-op-ing if SMTP_HOST is set but unimplemented', async () => {
  process.env.SMTP_HOST = 'smtp.example.com';
  await assert.rejects(sendVerificationEmail('a@example.com', 'https://app.example.com/verify?ticket=abc'));
  delete process.env.SMTP_HOST;
});
