const test = require('node:test');
const assert = require('node:assert/strict');

function freshEmailModule() {
  delete require.cache[require.resolve('../src/email')];
  return require('../src/email');
}

test('logs the link instead of sending when no SMTP_HOST is configured', async () => {
  delete process.env.SMTP_HOST;
  const { sendVerificationEmail } = freshEmailModule();
  await assert.doesNotReject(sendVerificationEmail('a@example.com', 'https://app.example.com/verify?ticket=abc'));
});

test('builds a real SMTP transporter from env vars once SMTP_HOST is set', () => {
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '2525';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASS = 'secret';
  const { getTransporter } = freshEmailModule();

  const transporter = getTransporter();
  assert.equal(transporter.options.host, 'smtp.example.com');
  assert.equal(transporter.options.port, 2525);
  assert.equal(transporter.options.secure, false);
  assert.deepEqual(transporter.options.auth, { user: 'user@example.com', pass: 'secret' });

  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

test('SMTP_SECURE=true switches to implicit TLS (port 465 style)', () => {
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_SECURE = 'true';
  const { getTransporter } = freshEmailModule();

  assert.equal(getTransporter().options.secure, true);

  delete process.env.SMTP_HOST;
  delete process.env.SMTP_SECURE;
});
