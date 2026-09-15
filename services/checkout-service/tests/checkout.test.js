const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTotal, createOrderToken, verifyOrderToken } = require('../src/checkout');

test('calculateTotal sums item prices and quantities', () => {
  assert.equal(calculateTotal([
    { productId: 1, price: 12.5, quantity: 2 },
    { productId: 2, price: 5, quantity: 3 },
  ]), 40);
});

test('checkout token round trips the user id', () => {
  const token = createOrderToken({ userId: 7 });
  assert.equal(verifyOrderToken(token).userId, 7);
});
