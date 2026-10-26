# Canteo v3 — Full-Stack College Canteen Platform + Operating Systems Synchronization Lab

> A portfolio-quality, full-stack college canteen ordering platform coupled with an interactive Operating Systems concurrency lab demonstrating the Bounded-Buffer Producer-Consumer problem, counting semaphores, mutex mutual exclusion, race condition avoidance, and deadlock detection.

---

## 1. System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CANTEO FULL-STACK SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────────────────────────────────────────────────┐
 │               REACT FRONTEND (/canteo)                  │
 │  • React 19 + Vite 8 + Tailwind CSS v4                  │
 │  • Warm editorial design (#FAF7F2, Instrument Serif)     │
 │  • Local OS Sync Lab (Local Simulation Engine)           │
 │  • REST API Client with in-memory JWT bearer tokens      │
 │  • SockJS + STOMP WebSocket Live Queue Subscriptions     │
 └────────────────────────────┬─────────────────────────────┘
                              │ HTTP REST / STOMP WebSocket
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │               SPRING BOOT BACKEND (/backend)             │
 │  • Java 21 / 25, Spring Boot 3.4.3                       │
 │  • Spring Security with Stateless JWT Filters            │
 │  • Transactional Bounded Queue Service (Capacity = 5)    │
 │  • STOMP WebSocket Broker on /topic/queue                │
 │  • SQL Aggregation Analytics (Orders, Revenue, Wait)     │
 └────────────────────────────┬─────────────────────────────┘
                              │ JPA / Hibernate / Flyway
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │               DATABASE LAYER (PostgreSQL / H2)           │
 │  • Flyway Migrations (V1 init, V2 seed, V3 users)        │
 │  • Tables: menu_items, orders, order_items, users        │
 │  • BigDecimal monetary representation                    │
 │  • Atomic FIFO serialization locks                       │
 └──────────────────────────────────────────────────────────┘
```

---

## 2. Operating Systems Synchronization Lab vs Operational Platform

Canteo has two distinct identities:
1. **Practical Canteen Platform (Full-Stack Backend + Client)**:
   - Order entry, menu queries, atomic bounded buffer capacity checks (`capacity = 5`), JWT authentication (`STUDENT`, `STAFF`, `ADMIN`), live STOMP queue updates, and analytics.
2. **Interactive OS Simulator (Local Educational Lab)**:
   - Strictly local educational simulation inside the browser.
   - Models counting semaphores (`empty = 5`, `full = 0`), critical section mutual exclusion lock (`mutex = 1`), race conditions, deadlocks, and circular bounded buffer pointer arithmetic (`in = (in + 1) mod 5`, `out = (out + 1) mod 5`).
   - *Note: JavaScript is inherently single-threaded; the simulator models POSIX semaphore behavior for classroom education.*

---

## 3. Technology Stack

### Frontend (`/canteo`)
- **Framework**: React 19 (`useReducer`, `useState`, `useEffect`, `useContext`, `useCallback`, `useMemo`)
- **Build Tool**: Vite 8 with `@tailwindcss/vite`
- **Styling**: Tailwind CSS v4 (`#FAF7F2` warm cream, `#111111` deep ink, `#D97706` amber)
- **Typography**: Instrument Serif (headings), Inter (body), JetBrains Mono (IDs & logs)
- **Live Updates**: `@stomp/stompjs` + `sockjs-client`
- **Icons**: `lucide-react`
- **Test Runner**: Native Node.js Test Runner (`node:test`)

### Backend (`/backend`)
- **Runtime & Framework**: Java 21 / 25, Spring Boot 3.4.3, Maven
- **Security**: Spring Security 6, JJWT 0.12.6 (stateless HMAC-SHA256 tokens), BCrypt
- **Persistence**: Spring Data JPA, Hibernate ORM 6.6, Flyway Database Migrations
- **Database**: PostgreSQL (production) / H2 in-memory (standalone testing)
- **Real-Time**: Spring WebSocket with STOMP Simple In-Memory Broker
- **Testing**: JUnit 5, MockMvc, Spring Security Test, Concurrent ExecutorService suites

---

## 4. REST API Endpoint Specification

| Method | Endpoint | Access / Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user account; returns JWT token |
| `POST` | `/api/auth/login` | Public | Authenticate credentials; returns JWT token |
| `GET` | `/api/menu` | Public | List all available canteen menu items |
| `GET` | `/api/menu/{id}` | Public | Get single menu item details |
| `GET` | `/api/menu/categories` | Public | List distinct menu categories |
| `POST` | `/api/orders` | `STUDENT`, `STAFF`, `ADMIN` | Place new order; computes total from DB prices; returns 409 if 5 slots busy |
| `GET` | `/api/orders/{id}` | Authenticated | Get order details (Students restricted to own orders) |
| `GET` | `/api/orders` | Authenticated | List orders (Students get own history; Staff/Admin get all) |
| `PATCH` | `/api/orders/{id}/status` | `STAFF`, `ADMIN` | Advance order status (`ACCEPTED`, `PREPARING`, `READY`, `COMPLETED`) |
| `POST` | `/api/orders/{id}/pay` | Authenticated | Demo checkout marking order as `PAID` |
| `GET` | `/api/queue/status` | Public | Bounded buffer state: capacity (5), occupied, available slots |
| `GET` | `/api/analytics/summary` | `ADMIN`, `STAFF` | Orders today, revenue today, peak hour, avg wait time |
| `WS` | `/ws` (STOMP) | Public | WebSocket endpoint broadcasting on `/topic/queue` and `/topic/orders/{id}` |

---

## 5. Database Schema & Flyway Migrations

### Flyway Migrations
- **`V1__init.sql`**:
  - `menu_items`: `id`, `name`, `description`, `category`, `price`, `image_url`, `available`, `created_at`, `updated_at`.
  - `orders`: `id`, `order_number`, `status`, `total_amount`, `created_at`, `updated_at`.
  - `order_items`: `id`, `order_id` (FK), `menu_item_id` (FK), `quantity`, `unit_price_at_purchase`, `subtotal`.
- **`V2__seed_menu.sql`**:
  - Seeds 6 authentic South Indian canteen items (Masala Dosa ₹40, Meals Thali ₹60, Idli Vada ₹35, Samosa ₹20, Tea ₹10, Coffee ₹15) with verified 200 OK Unsplash photography.
- **`V3__users.sql`**:
  - `users`: `id`, `email`, `password_hash`, `name`, `role` (`STUDENT`, `STAFF`, `ADMIN`), timestamps.
  - Adds `user_id` foreign key to `orders` table.

---

## 6. Seed Credentials

Default seeded personas for grading and demonstration:
- **Student**: `student@canteo.edu` / `password123`
- **Kitchen Staff**: `staff@canteo.edu` / `password123`
- **Administrator**: `admin@canteo.edu` / `password123`

*(The frontend includes one-click persona switching in the top-right user menu.)*

---

## 7. OS Synchronization Principles Illustrated

1. **Counting Semaphores**:
   - `empty` (initialized to 5): Tracks available buffer slots. Producer executes `wait(empty)` before buffer insertion.
   - `full` (initialized to 0): Tracks filled buffer slots. Consumer executes `wait(full)` before removing an item.
2. **Mutual Exclusion Lock (`mutex`)**:
   - Binary semaphore initialized to 1. Protects the critical section during buffer array indexing (`in`, `out`) preventing race conditions.
3. **Circular Buffer Arithmetic**:
   - Insert: `buffer[in] = order; in = (in + 1) % 5;`
   - Remove: `order = buffer[out]; out = (out + 1) % 5;`
4. **Deadlock Demonstration**:
   - Case study contrasting canonical order (`wait(empty)` then `wait(mutex)`) with inverted order (`wait(mutex)` before `wait(empty)`). When the buffer is full, inverted ordering causes circular wait deadlock where the producer sleeps holding the lock, starving the consumer.

---

## 8. Run Instructions

### 1. Run Spring Boot Backend
```bash
cd backend
./mvnw spring-boot:run
```
*(Backend starts on port 8080 with H2 in-memory database by default. To connect to PostgreSQL, set environment variables `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`.)*

### 2. Run React Frontend
```bash
cd canteo
npm install
npm run dev
```
*(Open http://localhost:5173 to access the application.)*

### 3. Run Automated Tests
```bash
# Backend Test Suite (16/16 pass)
cd backend
./mvnw test

# Frontend Unit & Concurrency Tests (12/12 pass)
cd canteo
npm test
node --test test/deadlockDemoReducer.test.js
npm run lint
npm run build
```

---

## 9. Demo Workflow for Academic Grading

1. **Place Order**: Open Menu, select Masala Dosa + Coffee, submit order. Observe order total ₹55.00 calculated strictly by backend from database prices.
2. **Queue Capacity Enforcement**: Submit 5 orders. Attempt to place a 6th order. Observe HTTP 409 Conflict rejection.
3. **Live Kitchen Dashboard**: Open Kitchen screen. Observe real-time STOMP WebSocket updates reflecting queue occupancy. Advance order to `PREPARING` and `READY`.
4. **Order Tracking & Demo Checkout**: Switch to Orders screen. Observe live position indicator (e.g. "Slot 02 of 5"), estimated wait time ("6 min"), and click "Demo Checkout" to mark as `PAID`.
5. **Analytics Dashboard**: Switch persona to Administrator or Kitchen Staff. Open Analytics tab to view aggregated metrics: Orders today, Revenue today, Peak Hour, and Average Wait Time.
6. **OS Sync Lab**: Open Sync Lab. Run the Race Condition Laboratory and Deadlock Case Study to inspect step-by-step mutex serialization and circular wait resolution.

---

## 10. Known Limitations

- **Single JVM Node**: Concurrency locks use Java `synchronized` and `TransactionTemplate` inside a single JVM. Distributed deployments across multiple server nodes would require Redis distributed locks or PostgreSQL table-level advisory locks.
- **In-Memory Browser Simulation**: The visual Sync Lab in the frontend runs on React's event loop to model OS semaphore semantics safely without kernel privileges.

---

## 11. License

MIT License. Free for educational, academic, and portfolio demonstration.
