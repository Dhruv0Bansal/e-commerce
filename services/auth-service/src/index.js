const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const {
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;
const SERVICE_NAME = 'auth-service';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce';

const pool = new Pool({ connectionString: DATABASE_URL });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: SERVICE_NAME, message: 'Auth service is running', health: '/health', api: '/api/user' });
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME });
});

app.get('/api/user', (req, res) => {
  res.json({
    service: SERVICE_NAME,
    message: 'Auth service is live',
    endpoints: ['/api/user/register', '/api/user/login', '/api/user/me'],
  });
});

app.post('/api/user/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return sendError(res, 400, 'name, email, and password are required');
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return sendError(res, 409, 'User already exists');
    }

    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = createToken({ userId: user.id, email: user.email, name: user.name });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error.message);
    return sendError(res, 500, 'Failed to register user');
  }
});

app.post('/api/user/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return sendError(res, 400, 'email and password are required');
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) {
      return sendError(res, 401, 'Invalid email or password');
    }

    const token = createToken({ userId: user.id, email: user.email, name: user.name });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return sendError(res, 500, 'Failed to log in');
  }
});

app.get('/api/user/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return sendError(res, 401, 'Missing bearer token');
  }

  try {
    const decoded = verifyToken(token);
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
    const user = result.rows[0];

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return res.json({ user });
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return sendError(res, 401, 'Invalid or expired token');
  }
});

app.listen(PORT, async () => {
  console.log(`${SERVICE_NAME} listening on port ${PORT}`);
  await initializeDatabase();
});
