# E-Commerce Microservices — Steps 1-8

## What's included

```
ecommerce-app/
├── docker-compose.yml       # orchestrates every container
├── nginx/
│   └── nginx.conf           # single entry point, routes /api/* to services
├── frontend/                # React + Vite
└── services/
    ├── auth-service/        # :5000, PostgreSQL-backed JWT auth
    ├── product-service/     # :5001, CRUD + Kafka events
    ├── cart-service/        # :5002
    ├── inventory-service/   # :5003
    └── checkout-service/    # :5004, PostgreSQL orders + Kafka events
```

Each service is an independent Express app with:
- `package.json` — its own dependencies (microservices don't share a node_modules)
- `src/index.js` — service routes and a `/health` endpoint
- `Dockerfile` — builds and runs the service in its own container

The database layer includes a PostgreSQL primary on `:5432` for writes and a
streaming replica on `:5433` for product reads. Kafka runs in single-node KRaft
mode for the `product-created`, `payment-events`, and `clear-cart` topics. Redis
stores carts with a 24-hour TTL.

## Why this structure

- **One repo, many services (monorepo)**: easier to manage at this stage than juggling 6 separate repos. You can split later if teams/deploys need it.
- **Nginx as single entry point**: the browser only ever talks to `localhost:8080`. Nginx decides which service handles `/api/product`, `/api/cart`, etc. This avoids CORS issues and hides internal service topology from the client.
- **Docker Compose networking**: services refer to each other by name (`http://product-service:5001`) — Compose provides internal DNS, no hardcoded IPs.
- **Volumes mounted for dev**: your local code changes reflect live in the container (via nodemon), without rebuilding the image every time.

## How to run

```bash
cd ecommerce-app
docker-compose up --build
```

Then visit:
- Frontend: http://localhost:5173 (direct) or http://localhost:8080 (through Nginx)
- Any service health check: http://localhost:5000/health, :5001/health, etc.

Register or log in through `/api/user/register` and `/api/user/login` to get a
JWT. Product listing reads from the replica; product creation, updates, and
deletes require `Authorization: Bearer <token>` and write to the primary.
Creation also publishes a `PRODUCT_CREATED` message to the `product-created` Kafka topic.

Inventory consumes product-created events to seed zero-quantity records and
payment-events timeout/failure events to release reserved stock. Inventory
listing reads from the replica; stock adjustments and reservations write to the
primary.

Inventory endpoints:

```text
GET  /api/inventory
GET  /api/inventory/:productId
POST /api/inventory/:productId/adjust
POST /api/inventory/:productId/reserve
```

The adjustment and reservation endpoints require a JWT. A payment timeout is
published to `payment-events` with `type: PAYMENT_TIMEOUT`, `productId`, and
`quantity`; the inventory consumer releases the reservation.

Checkout endpoints:

```text
GET  /api/checkout
POST /api/checkout
```

Checkout requires a JWT and an `items` array. It records a paid order in the
primary database, publishes `PAYMENT_COMPLETED`, and publishes `CLEAR_CART` so
the cart service removes the user's cart.

## What's NOT in this step yet
- Payment provider integration is simulated; use a real provider before production.
- Checkout does not yet reserve inventory transactionally before payment.

## Database notes

The replica is bootstrapped with `pg_basebackup` from the primary on its first
start. If you change the replication bootstrap settings during development,
remove the `postgres_primary_data` and `postgres_replica_data` volumes before
starting again so PostgreSQL runs its initialization scripts.
