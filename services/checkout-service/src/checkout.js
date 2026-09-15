const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function calculateTotal(items) {
  return Number(items.reduce((total, item) => total + Number(item.price) * item.quantity, 0).toFixed(2));
}

function createOrderToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function verifyOrderToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { calculateTotal, createOrderToken, verifyOrderToken };
