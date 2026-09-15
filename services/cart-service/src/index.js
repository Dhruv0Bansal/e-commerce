const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Kafka } = require('kafkajs');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 5002;
const SERVICE_NAME = 'cart-service';
const CART_TTL_SECONDS = 24 * 60 * 60;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: { retries: 20, initialRetryTime: 1000 },
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'cart-service' });

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

function cartKey(userId) {
  return `cart:${userId}`;
}

async function readCart(userId) {
  const value = await redis.get(cartKey(userId));
  return value ? JSON.parse(value) : { userId, items: [], updatedAt: null };
}

async function writeCart(cart) {
  cart.updatedAt = new Date().toISOString();
  await redis.set(cartKey(cart.userId), JSON.stringify(cart), { EX: CART_TTL_SECONDS });
  return cart;
}

async function startClearCartConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'clear-cart', fromBeginning: false });
  consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      if (event.type === 'CLEAR_CART' && event.userId) await redis.del(cartKey(event.userId));
    },
  }).catch((error) => {
    console.error('Cart consumer error:', error.message);
    process.exit(1);
  });
}

app.get('/', (req, res) => {
  res.json({ service: SERVICE_NAME, message: 'Cart service is running', health: '/health', api: '/api/cart' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/cart', requireToken, async (req, res) => {
  try {
    return res.json({ cart: await readCart(req.user.userId) });
  } catch (error) {
    console.error('Get cart error:', error.message);
    return res.status(500).json({ error: 'Failed to get cart' });
  }
});

app.post('/api/cart/items', requireToken, async (req, res) => {
  const { productId, name = '', price = 0, quantity } = req.body || {};
  const parsedProductId = Number(productId);
  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0 || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return res.status(400).json({ error: 'productId and a positive integer quantity are required' });
  try {
    const cart = await readCart(req.user.userId);
    const existing = cart.items.find((item) => item.productId === parsedProductId);
    if (existing) {
      existing.quantity += parsedQuantity;
      existing.name = name || existing.name;
      existing.price = price;
    } else {
      cart.items.push({ productId: parsedProductId, name, price, quantity: parsedQuantity });
    }
    return res.status(201).json({ cart: await writeCart(cart) });
  } catch (error) {
    console.error('Add cart item error:', error.message);
    return res.status(500).json({ error: 'Failed to add cart item' });
  }
});

app.put('/api/cart/items/:productId', requireToken, async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'quantity must be a positive integer' });
  try {
    const cart = await readCart(req.user.userId);
    const item = cart.items.find((entry) => entry.productId === Number(req.params.productId));
    if (!item) return res.status(404).json({ error: 'Cart item not found' });
    item.quantity = quantity;
    return res.json({ cart: await writeCart(cart) });
  } catch (error) {
    console.error('Update cart item error:', error.message);
    return res.status(500).json({ error: 'Failed to update cart item' });
  }
});

app.delete('/api/cart/items/:productId', requireToken, async (req, res) => {
  try {
    const cart = await readCart(req.user.userId);
    const initialLength = cart.items.length;
    cart.items = cart.items.filter((entry) => entry.productId !== Number(req.params.productId));
    if (cart.items.length === initialLength) return res.status(404).json({ error: 'Cart item not found' });
    return res.json({ cart: await writeCart(cart) });
  } catch (error) {
    console.error('Delete cart item error:', error.message);
    return res.status(500).json({ error: 'Failed to delete cart item' });
  }
});

app.delete('/api/cart', requireToken, async (req, res) => {
  await redis.del(cartKey(req.user.userId));
  return res.status(204).send();
});

app.post('/api/cart/reserve', requireToken, async (req, res) => {
  try {
    const cart = await readCart(req.user.userId);
    if (cart.items.length === 0) return res.status(400).json({ error: 'Cannot reserve an empty cart' });
    await producer.send({
      topic: 'payment-events',
      messages: [{ key: String(req.user.userId), value: JSON.stringify({ type: 'RESERVATION_CREATED', userId: req.user.userId, cart }) }],
    });
    return res.status(202).json({ message: 'Reservation requested', cart });
  } catch (error) {
    console.error('Reserve cart error:', error.message);
    return res.status(500).json({ error: 'Failed to request reservation' });
  }
});

async function start() {
  await redis.connect();
  await producer.connect();
  await startClearCartConsumer();
  app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));
}

start().catch((error) => {
  console.error(`${SERVICE_NAME} failed to start:`, error.message);
  process.exit(1);
});
