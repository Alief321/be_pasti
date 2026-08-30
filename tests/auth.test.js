const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { signToken, verifyToken, sanitizeUser, hashPassword } = require('../utils/auth');

test('signToken and verifyToken round trip works', () => {
  const payload = { id: 1, email: 'admin@example.com', role: 'admin' };
  const token = signToken(payload);
  const decoded = verifyToken(token);

  assert.equal(decoded.id, payload.id);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.role, payload.role);
});

test('hashPassword uses SHA-256', () => {
  const plain = 'rahasia123';
  const expected = crypto.createHash('sha256').update(plain).digest('hex');

  assert.equal(hashPassword(plain), expected);
});

test('sanitizeUser strips password fields', () => {
  const safe = sanitizeUser({
    id: 1,
    email: 'user@example.com',
    password: 'secret',
    role: 'admin',
  });

  assert.deepEqual(safe, {
    id: 1,
    email: 'user@example.com',
    role: 'admin',
  });
});
