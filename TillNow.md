# E-Commerce Microservices Project

This project is a full-stack e-commerce application built as a microservices architecture using Node.js, PostgreSQL, Redis, Kafka, and Docker. The goal is to simulate a realistic distributed commerce system where each domain is separated into independent services while still working together through API gateways and event-driven communication.

## Project Overview

The application includes:

- A React frontend for browsing products and interacting with the store
- Multiple backend microservices for authentication, products, cart, inventory, and checkout
- PostgreSQL primary-replica database setup for read/write separation
- Redis for cart storage
- Kafka for asynchronous inter-service communication
- NGINX as a single entry point for client requests
- Docker Compose for complete local orchestration

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Cache: Redis
- Messaging: Kafka
- Reverse Proxy: NGINX
- Containerization: Docker + Docker Compose

## Architecture

The system is structured into multiple independent services:

### 1. Frontend
- Built with React
- Provides the user interface for the store
- Accesses backend APIs through the NGINX gateway

### 2. Auth Service
- Handles user registration and login
- Validates credentials
- Generates and verifies JWT tokens
- Stores user data in PostgreSQL

### 3. Product Service
- Manages product listing, creation, update, and deletion
- Reads data from the PostgreSQL replica
- Writes to the primary database
- Publishes Kafka events when a product is created

### 4. Cart Service
- Stores and retrieves user carts using Redis
- Works with Kafka to handle cart-clearing events
- Keeps cart data fast and lightweight

### 5. Inventory Service
- Tracks stock levels and product reservations
- Consumes Kafka events from product creation and payment events
- Maintains inventory records and reservation logic
- Supports inventory read and update operations

### 6. Checkout Service
- Handles order creation and payment simulation
- Stores completed transactions in PostgreSQL
- Publishes success and cart-clear events after checkout

## Communication Flow

- The frontend talks to the application through NGINX on port 8080
- NGINX routes requests to the correct service
- Services communicate through HTTP APIs and Kafka topics
- Data is separated between primary and replica databases to improve read/write handling
- Kafka allows decoupled event-driven workflows across services

## Key Features Implemented

- User authentication with JWT
- Product management APIs
- Inventory management and stock reservation
- Cart storage with Redis
- Checkout and order creation flow
- Kafka-based eventing for product and payment workflows
- Dockerized development environment with a shared stack

## Database Setup

The project uses PostgreSQL in a primary-replica configuration:

- Primary database handles writes
- Replica database handles reads
- Replication is configured for product and inventory read operations
- Database initialization scripts are included in the project

## Messaging and Events

Kafka topics used in the project include:

- product-created
- payment-events
- clear-cart

These topics allow different services to react to events asynchronously, such as:

- product creation updating inventory
- payment actions triggering stock release or reservation updates
- cart clearing after successful checkout

## How to Run

Clone the repository and start the full stack with Docker Compose:

```bash
git clone <repository-url>
cd ecommerce-app
docker-compose up --build
```

Then access:

- Frontend: http://localhost:5173
- NGINX gateway: http://localhost:8080
- Auth service: http://localhost:5000
- Product service: http://localhost:5001
- Cart service: http://localhost:5002
- Inventory service: http://localhost:5003
- Checkout service: http://localhost:5004

## Current Status

The project is currently in an active development stage and includes the core microservice architecture with working local orchestration. The application demonstrates a realistic flow for:

- user signup/login
- product listing and management
- shopping cart logic
- stock tracking
- order checkout
- event-driven interaction between services

## What Is Still to Improve

Some areas are still evolving and can be improved before production:

- Real payment gateway integration
- More robust validation and error handling
- Better security configuration for production
- More comprehensive test coverage
- Observability with logging, traces, and monitoring
- CI/CD setup for automated deployment

## Conclusion

This project is a strong foundation for learning and practicing distributed systems, API design, event-driven communication, and microservice architecture. It provides a practical example of how multiple services can operate together in a containerized environment while remaining independently manageable.

## License

This project is for educational and learning purposes.
