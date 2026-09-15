const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5001;
const SERVICE_NAME = 'product-service';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const primaryPool = new Pool({ connectionString: process.env.PRIMARY_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce' });
const replicaPool = new Pool({ connectionString: process.env.REPLICA_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ecommerce' });
const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 20, initialRetryTime: 1000 },
});
const producer = kafka.producer();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: SERVICE_NAME, message: 'Product service is running', health: '/health', api: '/api/product' });
});

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
  await primaryPool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function publishProductCreated(product) {
  await producer.send({
    topic: 'product-created',
    messages: [{ key: String(product.id), value: JSON.stringify({ type: 'PRODUCT_CREATED', product }) }],
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/product', async (req, res) => {
  try {
    const result = await replicaPool.query('SELECT id, name, description, price, created_at, updated_at FROM products ORDER BY id');
    return res.json({ products: result.rows });
  } catch (error) {
    console.error('List products error:', error.message);
    return res.status(500).json({ error: 'Failed to list products' });
  }
});

app.get('/api/product/:id', async (req, res) => {
  try {
    const result = await replicaPool.query('SELECT id, name, description, price, created_at, updated_at FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    return res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error.message);
    return res.status(500).json({ error: 'Failed to get product' });
  }
});

app.post('/api/product', requireToken, async (req, res) => {
  const { name, description = '', price } = req.body || {};
  if (!name || price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'name and a non-negative price are required' });
  try {
    const result = await primaryPool.query('INSERT INTO products (name, description, price) VALUES ($1, $2, $3) RETURNING id, name, description, price, created_at, updated_at', [name, description, price]);
    const product = result.rows[0];
    await publishProductCreated(product);
    return res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error.message);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/product/:id', requireToken, async (req, res) => {
  const { name, description, price } = req.body || {};
  if (!name || description === undefined || price === undefined || Number.isNaN(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'name, description, and a non-negative price are required' });
  try {
    const result = await primaryPool.query('UPDATE products SET name = $1, description = $2, price = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, description, price, created_at, updated_at', [name, description, price, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    return res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Update product error:', error.message);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/product/:id', requireToken, async (req, res) => {
  try {
    const result = await primaryPool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    return res.status(204).send();
  } catch (error) {
    console.error('Delete product error:', error.message);
    return res.status(500).json({ error: 'Failed to delete product' });
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
