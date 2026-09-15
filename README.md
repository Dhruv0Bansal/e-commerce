# E-Commerce Microservices Project

A full-stack **e-commerce application built using a microservices architecture**.
The project is being developed incrementally to gain practical experience with distributed systems, backend services, databases, caching, messaging, and containerization.

## Tech Stack

* **Frontend:** React + Vite
* **Backend:** Node.js + Express
* **Database:** PostgreSQL
* **Caching / Fast Data Store:** Redis
* **Messaging:** Apache Kafka
* **Reverse Proxy:** NGINX
* **Containerization:** Docker + Docker Compose
* **Authentication:** JWT

## Services

### Auth Service

Responsible for:

* User registration
* User login
* Authentication
* JWT-based access control

### Product Service

Responsible for:

* Product management
* Creating products
* Updating products
* Deleting products
* Retrieving product information

### Cart Service

Responsible for:

* Managing shopping carts
* Adding and removing products
* Maintaining cart state

Redis is used for fast cart data access.

### Inventory Service

Responsible for:

* Product stock management
* Inventory updates
* Stock availability

### Checkout Service

Responsible for:

* Checkout processing
* Order creation
* Checkout-related service communication

## Infrastructure

### PostgreSQL

PostgreSQL is used as the primary persistent database for application data.

The project also uses a **primary-replica database setup** to explore database replication and read scalability.

### Redis

Redis provides fast-access storage for shopping cart data.

### Apache Kafka

Kafka is used for **asynchronous communication between services**.

This allows services to exchange events without requiring every interaction to happen through direct synchronous requests.

### NGINX

NGINX acts as the **entry point for the application** and routes incoming requests to the appropriate backend service.

### Docker

Each major component runs in a containerized environment.

Docker Compose is used to manage the complete application stack locally.

## Key Features

* Microservices-based backend architecture
* React-based frontend
* REST APIs
* JWT authentication
* Product management
* Shopping cart
* Inventory management
* Checkout and order processing
* Redis-based cart storage
* Kafka-based asynchronous communication
* PostgreSQL persistent storage
* PostgreSQL primary-replica setup
* NGINX reverse proxy
* Dockerized development environment
* Docker Compose orchestration

## Project Structure

```text
ecommerce-app/
│
├── frontend/
│
├── services/
│   ├── auth-service/
│   ├── product-service/
│   ├── cart-service/
│   ├── inventory-service/
│   └── checkout-service/
│
├── database/
├── nginx/
├── docker-compose.yml
├── README.md
└── TillNow.md
```

## Running the Project

### Prerequisites

Make sure the following are installed:

* Docker
* Docker Compose
* Git

### Clone the Repository

```bash
git clone https://github.com/Dhruv0Bansal/e-commerce.git
cd e-commerce
```

### Start the Application

```bash
docker-compose up --build
```

Once the containers are running, the application can be accessed through the configured frontend and gateway ports.

## Development Approach

The project is being developed incrementally.

The current implementation focuses on establishing the core e-commerce functionality and the underlying microservices infrastructure. Additional features and improvements will be added as development continues.

The architecture is designed to allow individual services to evolve independently without requiring the entire application to be redesigned.

## What This Project Demonstrates

This project provides practical experience with:

* Microservices architecture
* Service separation
* REST API development
* Authentication and authorization
* Database management
* Database replication
* Caching and fast data access
* Asynchronous messaging
* Reverse proxies
* Containerization
* Multi-service application orchestration
* Distributed application design

## Future Improvements

Planned improvements may include additional e-commerce functionality, stronger reliability mechanisms, improved observability, testing, performance improvements, and further infrastructure enhancements.

## Project Status

**Work in Progress 🚧**

The core architecture and major e-commerce services are currently implemented, with additional features planned for future development.

## Purpose

This project is primarily a learning and portfolio project focused on understanding how a real-world application can be designed using **microservices and distributed system concepts**.

It is being built incrementally to explore different technologies and architectural patterns in a practical environment.

## License

This project is for educational and portfolio purposes.
