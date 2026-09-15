const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
} = require('../src/auth');

test('hashPassword returns a hashed value that matches the original password', async () => {
  const password = 'Secret123!';
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await comparePassword(password, hash), true);
  assert.equal(await comparePassword('wrong-password', hash), false);
});

test('createToken and verifyToken round trip a user payload', () => {
  const payload = { userId: 42, email: 'test@example.com' };
  const token = createToken(payload);
  const decoded = verifyToken(token);

  assert.equal(decoded.userId, 42);
  assert.equal(decoded.email, 'test@example.com');
  assert.ok(decoded.iat);
});
