const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');
const { calculateTotal } = require('./checkout');

const app = express();
const PORT = process.env.PORT || 5004;
const SERVICE_NAME = 'checkout-service';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce' });
const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 20, initialRetryTime: 1000 },
});
const producer = kafka.producer();

app.use(cors());
app.use(express.json());

function requireToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      items JSONB NOT NULL,
      total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
      status VARCHAR(30) NOT NULL DEFAULT 'PAID',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function publishEvent(topic, event, key) {
  await producer.send({
    topic,
    messages: [{ key: String(key), value: JSON.stringify(event) }],
  });
}

app.get('/', (req, res) => {
  res.json({ service: SERVICE_NAME, message: 'Checkout service is running', health: '/health', api: '/api/checkout' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/checkout', requireToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, items, total, status, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
      [req.user.userId]
    );
    return res.json({ orders: result.rows });
  } catch (error) {
    console.error('List orders error:', error.message);
    return res.status(500).json({ error: 'Failed to list orders' });
  }
});

app.post('/api/checkout', requireToken, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const validItems = items.every((item) => (
    Number.isInteger(Number(item.productId)) &&
    Number(item.productId) > 0 &&
    Number.isInteger(Number(item.quantity)) &&
    Number(item.quantity) > 0 &&
    Number.isFinite(Number(item.price)) &&
    Number(item.price) >= 0
  ));

  if (items.length === 0 || !validItems) {
    return res.status(400).json({ error: 'items with productId, positive quantity, and price are required' });
  }

  const total = calculateTotal(items);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO orders (user_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING id, user_id, items, total, status, created_at',
      [req.user.userId, JSON.stringify(items), total, 'PAID']
    );
    await client.query('COMMIT');

    const order = result.rows[0];
    await publishEvent('payment-events', {
      type: 'PAYMENT_COMPLETED',
      userId: req.user.userId,
      orderId: order.id,
      total,
    }, req.user.userId);
    await publishEvent('clear-cart', {
      type: 'CLEAR_CART',
      userId: req.user.userId,
      orderId: order.id,
    }, req.user.userId);

    return res.status(201).json({ order });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error.message);
    return res.status(500).json({ error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

async function start() {
  await initializeDatabase();
  await producer.connect();
  app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));
}

start().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error.message);
  process.exit(1);
});
