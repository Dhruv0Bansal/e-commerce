const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5003;
const SERVICE_NAME = 'inventory-service';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const primaryPool = new Pool({ connectionString: process.env.PRIMARY_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce' });
const replicaPool = new Pool({ connectionString: process.env.REPLICA_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ecommerce' });
const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 20, initialRetryTime: 1000 },
});
const consumer = kafka.consumer({ groupId: 'inventory-service' });

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
  await primaryPool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      product_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

async function seedProduct(product) {
  await primaryPool.query(
    'INSERT INTO inventory (product_id, quantity) VALUES ($1, 0) ON CONFLICT (product_id) DO NOTHING',
    [product.id]
  );
}

async function releaseReservation(event) {
  if (!event.productId || !event.quantity) return;
  await primaryPool.query(
    `UPDATE inventory
     SET quantity = quantity + $1,
         reserved_quantity = GREATEST(reserved_quantity - $1, 0),
         updated_at = NOW()
     WHERE product_id = $2`,
    [event.quantity, event.productId]
  );
}

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['product-created', 'payment-events'], fromBeginning: true });
  consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString());
      if (topic === 'product-created' && event.type === 'PRODUCT_CREATED') await seedProduct(event.product);
      if (topic === 'payment-events' && ['PAYMENT_TIMEOUT', 'PAYMENT_FAILED'].includes(event.type)) await releaseReservation(event);
    },
  }).catch((error) => {
    console.error('Inventory consumer error:', error.message);
    process.exit(1);
  });
}

app.get('/', (req, res) => {
  res.json({ service: SERVICE_NAME, message: 'Inventory service is running', health: '/health', api: '/api/inventory' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/inventory', (req, res) => {
  replicaPool.query('SELECT product_id, quantity, reserved_quantity, updated_at FROM inventory ORDER BY product_id')
    .then((result) => res.json({ inventory: result.rows }))
    .catch((error) => {
      console.error('List inventory error:', error.message);
      res.status(500).json({ error: 'Failed to list inventory' });
    });
});

app.get('/api/inventory/:productId', async (req, res) => {
  try {
    const result = await replicaPool.query('SELECT product_id, quantity, reserved_quantity, updated_at FROM inventory WHERE product_id = $1', [req.params.productId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Inventory record not found' });
    return res.json({ inventory: result.rows[0] });
  } catch (error) {
    console.error('Get inventory error:', error.message);
    return res.status(500).json({ error: 'Failed to get inventory' });
  }
});

app.post('/api/inventory/:productId/adjust', requireToken, async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity === 0) return res.status(400).json({ error: 'quantity must be a non-zero integer' });
  try {
    const result = await primaryPool.query(
      `UPDATE inventory SET quantity = quantity + $1, updated_at = NOW()
       WHERE product_id = $2 AND quantity + $1 >= 0
       RETURNING product_id, quantity, reserved_quantity, updated_at`,
      [quantity, req.params.productId]
    );
    if (result.rows.length === 0) return res.status(409).json({ error: 'Inventory record not found or quantity would be negative' });
    return res.json({ inventory: result.rows[0] });
  } catch (error) {
    console.error('Adjust inventory error:', error.message);
    return res.status(500).json({ error: 'Failed to adjust inventory' });
  }
});

app.post('/api/inventory/:productId/reserve', requireToken, async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be a positive integer' });
  try {
    const result = await primaryPool.query(
      `UPDATE inventory SET quantity = quantity - $1, reserved_quantity = reserved_quantity + $1, updated_at = NOW()
       WHERE product_id = $2 AND quantity >= $1
       RETURNING product_id, quantity, reserved_quantity, updated_at`,
      [quantity, req.params.productId]
    );
    if (result.rows.length === 0) return res.status(409).json({ error: 'Insufficient inventory or record not found' });
    return res.status(201).json({ inventory: result.rows[0] });
  } catch (error) {
    console.error('Reserve inventory error:', error.message);
    return res.status(500).json({ error: 'Failed to reserve inventory' });
  }
});

async function start() {
  await initializeDatabase();
  await startConsumer();
  app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));
}

start().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error.message);
  process.exit(1);
});
