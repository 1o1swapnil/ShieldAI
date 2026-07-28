const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateOrReservedIp } = require('../src/classifier/collectors');

// getTlsCertIssuerOrg connects to whatever `domain` resolves to, and domain
// is attacker-influenced (reported by a device-token holder) — this guard
// is the only thing stopping it from being pointed at internal infrastructure.
test('flags private, loopback, link-local, and cloud-metadata IPv4 addresses', () => {
  assert.equal(isPrivateOrReservedIp('10.0.5.23'), true);
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true); // cloud metadata
  assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
  assert.equal(isPrivateOrReservedIp('172.31.255.255'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('100.64.0.1'), true); // CGNAT
  assert.equal(isPrivateOrReservedIp('0.0.0.0'), true);
});

test('does not flag ordinary public IPv4 addresses', () => {
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
  assert.equal(isPrivateOrReservedIp('172.15.255.255'), false); // just outside 172.16/12
  assert.equal(isPrivateOrReservedIp('172.32.0.1'), false); // just outside 172.16/12
});

test('flags IPv6 loopback, link-local, unique-local, and IPv4-mapped private addresses', () => {
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);
  assert.equal(isPrivateOrReservedIp('fd12:3456::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
});

test('does not flag an ordinary public IPv6 address', () => {
  assert.equal(isPrivateOrReservedIp('2606:4700:4700::1111'), false);
});

test('treats an unparseable value as unsafe by default', () => {
  assert.equal(isPrivateOrReservedIp('not-an-ip'), true);
});
