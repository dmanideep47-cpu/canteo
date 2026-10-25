# Canteo — College Canteen Ordering & Live Queue Tracking

> A production-quality, mobile-first and desktop-responsive React application demonstrating Operating Systems synchronization and the Bounded-Buffer Producer-Consumer problem through an interactive college canteen ordering experience.

---

## 1. Project Overview & Problem Statement

In Operating Systems, the **Bounded-Buffer Producer-Consumer Problem** is a foundational concurrency paradigm. Multiple producer processes generate data units and insert them into a finite, shared memory buffer of size $N$, while consumer processes remove and process those units. Without proper synchronization mechanisms (counting semaphores and mutual exclusion locks):
- Producers might overwrite memory when the buffer is already full (buffer overflow).
- Consumers might read uninitialized memory or crash when the buffer is empty (buffer underflow).
- Concurrent processes might interleave reads and writes to shared memory without mutual exclusion, producing non-deterministic state corruption (**race conditions**).

**Canteo** grounds these theoretical principles inside a realistic college canteen application:
- **Students (Producers)** browse food items, curate a cart, and place orders into the canteen system.
- **The Kitchen Queue (Bounded Buffer)** holds a strictly constrained capacity of **5 orders** (`BUFFER_CAPACITY = 5`).
- **Kitchen Staff (Consumers)** retrieve orders, prepare them, mark them ready for collection at Counter 2, and record pickup.
- **Synchronization Semaphores (`empty`, `full`, `mutex`)** govern buffer access and enforce strict FIFO discipline.
- **Blocked Producers FIFO Queue**: When the buffer is full ($empty = 0$), excess student orders are queued in a deterministic FIFO blocked pool until a kitchen worker frees a slot.

---

## 2. Core Features

- **Craft Studio Editorial Landing Page**: Typography-driven, warm light theme (`#FAF7F2`), generous whitespace, Instrument Serif headlines, Inter body text, and JetBrains Mono labels.
- **Responsive Desktop & Mobile Layout**:
  - **Desktop ($\ge 1024\text{px}$)**: Centered `max-w-[1440px]` layout with a persistent 256px `DesktopSidebar` displaying navigation and real-time buffer semaphore counters, alongside a fluid content canvas.
  - **Mobile ($< 768\text{px}$)**: Full-width container with persistent `BottomNavigation` bar and thumb-friendly controls.
- **Dynamic Food Menu & Multi-Filter Search**: Combined real-time text query and category filtering across All, Breakfast, Meals, Snacks, and Beverages, with high-definition food photography via `SafeImage` fallback handling (`#F1EFEA`).
- **Cart Bottom Sheet**: Accessible modal sheet with real-time subtotal computation, quantity increment/decrement, and live buffer slot capacity indicator.
- **Live Order Timeline & Campus Schematic Map**: Vertical timeline tracking orders through 5 distinct lifecycle stages (`BLOCKED`, `WAITING`, `PREPARING`, `READY`, `COMPLETED`), coupled with an inline SVG schematic campus map.
- **Kitchen Dashboard**: Visualizes the 5 buffer slots, distinguishing queued orders from the active worker station, with dedicated controls for staff (`Take Next Order`, `Mark Ready`, `Confirm Pickup`).
- **Synchronization Lab**:
  - Live HUD for counting semaphores (`empty`, `full`) and critical section lock (`mutex`).
  - Interactive simulation triggers (`Simulate Student Order`, `Take Next Order`, `Simulate Queue Full`, `Reset All`).
  - Scrollable, color-coded, monospace event log with sequence numbers and exact semaphore snapshots.
- **Race Condition Laboratory**:
  - Interactive stepper demonstrating deterministic interleaving where concurrent staff access shared order state without a mutex, exposing stale-read clobbering.
  - Contrasting 6-step serialized execution enforcing mutual exclusion locks.

---

## 3. Technology Stack

- **Framework**: React 19 (`useReducer`, `useState`, `useCallback`, `useMemo`, `useContext`, `useRef`)
- **Build Tool**: Vite 8 (Native ES Modules, Hot Module Replacement)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` plugin, `@import "tailwindcss";` in `src/styles/index.css`)
- **Icons**: `lucide-react`
- **State Management**: Pure in-memory React Reducer (`canteenReducer.js`) adhering to strict OS invariants with zero external state libraries.
- **Test Runner**: Native Node.js test runner (`node:test`, `node:assert/strict`)

---

## 4. Architecture and File Structure

### Text Architecture Diagram
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CANTEO SYNCHRONIZATION ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────────────────┘

       [ Student Producers ] ─── (Submits Food Order)
                 │
                 ▼
         wait(empty)  ──── If empty == 0? ───► [ Blocked Producers FIFO Pool ]
                 │                                        ▲
                 ▼ (empty > 0)                            │ (Admitted atomically
         wait(mutex)                                      │  in same transition)
                 │                                        │
                 ▼                                        │
    ┌─────────────────────────┐                           │
    │  CRITICAL SECTION (CS)  │                           │
    │  Enqueue Order -> Queue │                           │
    └─────────────────────────┘                           │
                 │                                        │
                 ▼                                        │
         signal(mutex)                                    │
                 │                                        │
                 ▼                                        │
          signal(full)                                    │
                 │                                        │
                 ▼                                        │
      ┌──────────────────────────────────────────────┐    │
      │  BOUNDED BUFFER (Slots 1..5, Capacity N = 5) │    │
      │  [ Slot 1 ] [ Slot 2 ] [ Slot 3 ] [ ... ]    │    │
      └──────────────────────────────────────────────┘    │
                 │                                        │
                 ▼                                        │
            wait(full)                                    │
                 │                                        │
                 ▼                                        │
            wait(mutex)                                   │
                 │                                        │
                 ▼                                        │
    ┌─────────────────────────┐                           │
    │  CRITICAL SECTION (CS)  │                           │
    │  Dequeue -> Worker Prep │ ──────────────────────────┘
    └─────────────────────────┘
                 │
                 ▼
           signal(mutex)
                 │
                 ▼
           signal(empty)
                 │
                 ▼
    [ Worker Station 1 (PREPARING) ]
                 │
                 ▼ (markReady)
    [ Counter 2 Pickup (READY) ]
                 │
                 ▼ (markCollected)
    [ History Archive (COMPLETED) ]
```

### File Structure
```text
canteo/
├── public/
│   └── favicon.svg                  # Minimalist SVG favicon
├── src/
│   ├── app/
│   │   ├── App.jsx                  # Main application shell with responsive layout & single back nav
│   │   └── AppContext.jsx           # Context provider binding reducer state & memoized actions
│   ├── components/
│   │   ├── BottomNavigation.jsx     # Mobile persistent 4-tab bottom navigation
│   │   ├── CartSheet.jsx            # Animated modal bottom sheet with live cart controls
│   │   ├── CategoryChips.jsx        # Pill category filter chips
│   │   ├── EventLog.jsx             # Monospace scrollable timeline of OS operations
│   │   ├── FoodCard.jsx             # Product card with responsive photo, prep badge, and add button
│   │   ├── OrderTimeline.jsx        # Vertical lifecycle stepper & SVG schematic campus map
│   │   ├── QueueSlot.jsx            # Visual card for bounded buffer slots 1–5
│   │   ├── SafeImage.jsx            # Resilient image loader with skeleton shimmer and fallback
│   │   ├── SearchBar.jsx            # Real-time search input
│   │   ├── SemaphoreChip.jsx        # HUD displaying empty, full, and mutex states
│   │   └── Toast.jsx                # Floating accessible notification alerts
│   ├── data/
│   │   └── menuItems.js             # Initial food catalogue with verified Unsplash photography
│   ├── landing/
│   │   ├── LandingPage.jsx          # Editorial landing page container with 5 distinct sections
│   │   └── components/
│   │       ├── CaseStudyModal.jsx   # Architectural deep-dive case study modal
│   │       ├── CtaFooter.jsx        # Editorial footer call-to-action
│   │       ├── HeroSection.jsx      # 2-column desktop hero with Masala Dosa photography
│   │       ├── LineupSection.jsx    # Deep-linked cards for Menu, Orders, Kitchen, and Sync Lab
│   │       ├── Navbar.jsx           # Top editorial header with wordmark and quick links
│   │       ├── PrinciplesSection.jsx# 4 core engineering design principles
│   │       └── ShowcaseSection.jsx  # Interactive UI showcase gallery
│   ├── logic/
│   │   ├── canteenActions.js        # Action type constants and pure action creators
│   │   ├── canteenInvariants.js     # Runtime invariant validation function
│   │   ├── canteenReducer.js        # Pure authoritative reducer managing queue & semaphores
│   │   ├── raceConditionReducer.js  # Isolated reducer for the race condition simulation
│   │   └── useCanteenQueue.js       # Custom hook providing stable action dispatchers
│   ├── screens/
│   │   ├── KitchenScreen.jsx        # Consumer bounded buffer slots & worker prep station
│   │   ├── MenuScreen.jsx           # Producer order entry, search, categories, and cart
│   │   ├── OrdersScreen.jsx         # Live tracking, multi-order switcher, and SVG map
│   │   └── SyncLabScreen.jsx        # Educational semaphore HUD, controls, and race demo
│   ├── styles/
│   │   └── index.css                # Tailwind v4 import, custom color tokens, typography utilities
│   ├── App.jsx                      # Root re-export for external module compatibility
│   └── main.jsx                     # React root mount with StrictMode
├── test/
│   ├── canteenReducer.test.js       # Unit test suite verifying invariants & transitions
│   └── raceConditionReducer.test.js # Unit test suite verifying race demo logic
├── index.html                       # HTML5 entry with Google Fonts (Instrument Serif, Inter, JetBrains Mono)
├── package.json                     # Scripts and dependencies
└── vite.config.js                   # Vite config with @tailwindcss/vite
```

---

## 5. Synchronization Concepts & Semaphores

### Counting Semaphores
- **`empty` (Initial value = 5)**: Represents the count of free buffer slots. Before inserting an order, a producer decrements `empty` (`wait(empty)`). If `empty == 0`, the producer is blocked and queued into `blockedProducers`.
- **`full` (Initial value = 0)**: Represents the count of pending orders residing in the buffer. Before removing an order, a consumer decrements `full` (`wait(full)`). If `full == 0`, the consumer is blocked until an order arrives.
- **Buffer Invariant**: At all times, the system enforces:
  $$\text{empty} + \text{full} = 5 \quad \text{and} \quad 0 \le \text{queue.length} \le 5$$

### Mutual Exclusion (`mutex`)
- **`mutex` (Initial value = 1)**: Binary semaphore guarding access to the shared queue memory during insertions and removals.
- `1` indicates the critical section is unheld.
- `0` indicates a process is actively modifying queue state.
- **Educational Note**: The JavaScript runtime operates on a single-threaded synchronous event loop. The `mutex` is an educational model of lock acquisition and release, verifying that concurrent operations cannot interleave unsafely.

### Exact Semaphore Event Sequences
- **Producer (Order Submission)**:
  $$\text{wait}(\text{empty}) \longrightarrow \text{wait}(\text{mutex}) \longrightarrow \text{insert} \longrightarrow \text{signal}(\text{mutex}) \longrightarrow \text{signal}(\text{full})$$
- **Consumer (Kitchen Retrieval)**:
  $$\text{wait}(\text{full}) \longrightarrow \text{wait}(\text{mutex}) \longrightarrow \text{remove} \longrightarrow \text{signal}(\text{mutex}) \longrightarrow \text{signal}(\text{empty})$$

---

## 6. Order Lifecycle & Blocked Producer FIFO Semantics

An order progresses through five lifecycle stages:
1. **`BLOCKED`**: The student submitted the order, but the bounded queue was full (5/5 slots occupied). The order waits in a separate FIFO blocked queue.
2. **`WAITING`**: The order is actively occupying one of the 5 bounded buffer slots, waiting for kitchen pickup.
3. **`PREPARING`**: The consumer removed the order from the queue and kitchen staff is actively preparing it at Worker Station 1.
4. **`READY`**: Food preparation is complete. The order is waiting for student pickup at Counter 2.
5. **`COMPLETED`**: The student collected the food. The order is archived in history.

### Atomic Blocked Producer Admission
When kitchen staff takes an order (`TAKE_ORDER`) while `blockedProducers` is non-empty:
1. The consumer dequeues the oldest waiting order from the buffer (`full--`, `empty++`).
2. In the **exact same reducer transition**, the oldest blocked producer is shifted out of `blockedProducers` and appended to the queue (`empty--`, `full++`).
3. Two distinct log entries are produced: the consumer removal followed by the blocked producer admission.
4. The queue remains at capacity (5/5), preserving FIFO ordering without temporary illegal states.

---

## 7. Race Condition Mechanics

In the **Sync Lab**, a dedicated laboratory contrasts unsynchronized concurrency against mutual exclusion using a shared resource `ORD101 (WAITING)`:

### Without Mutex (Stale Read Conflict)
1. **Step 1**: Staff A reads `ORD101` as `WAITING`.
2. **Step 2**: Staff B reads `ORD101` as `WAITING` concurrently before Staff A commits.
3. **Step 3**: Staff A updates the status in memory to `PREPARING`.
4. **Step 4**: Staff B writes `READY` based on its stale read, clobbering Staff A's transition.
5. **Result**: Red warning badge: *"Race condition detected: inconsistent order status."*

### With Mutex (Serialized Execution)
1. **Step 1**: Staff A acquires `mutex` lock.
2. **Step 2**: Staff A verifies `WAITING` and updates to `PREPARING`.
3. **Step 3**: Staff A releases `mutex` lock.
4. **Step 4**: Staff B acquires `mutex` lock.
5. **Step 5**: Staff B reads verified `PREPARING` state and updates to `READY`.
6. **Step 6**: Staff B releases `mutex` lock.
7. **Result**: Green success badge: *"Mutual exclusion enforced. Valid state transitions preserved."*

---

## 8. Food Photography & Image Verification

All images use real Unsplash food photography and load through the resilient `SafeImage` component. If offline or if network access is restricted, the component gracefully renders a warm `#F1EFEA` placeholder with the food title:

| Item | Image URL ID | Resolution | Aspect Ratio | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Masala Dosa** | `photo-1668236543090-82eba5ee5976` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |
| **South Indian Meals** | `photo-1610057099443-fde8c4d50f91` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |
| **Idli Vada Combo** | `photo-1589301760014-d929f3979dbc` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |
| **Samosa Plate** | `photo-1601050690597-df0568f70950` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |
| **Masala Chai** | `photo-1576092768241-dec231879fc3` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |
| **Filter Coffee** | `photo-1514432324607-a09d9b4aefdd` | 800 × 600 | 4:3 | Verified / SafeImage Fallback |

---

## 9. Installation & Setup

### Prerequisites
- Node.js (v18.0.0 or higher recommended, Node 20+ tested)
- npm (v9.0.0 or higher)

### Setup Commands
```bash
# Navigate to the project directory
cd canteo

# Install dependencies
npm install

# Run the development server
npm run dev

# Run unit tests
npm test

# Build for production
npm run build
```

---

## 10. Manual Verification & Test Instructions

### Scenario 1: Test Queue-Full & Blocked Producers
1. Open the **Menu** tab (`/app?tab=menu`).
2. Add items to the cart and place orders until 5 orders have been submitted.
3. Observe the queue slot badge in the header changes from `5/5 slots available` to `0/5 slots available`.
4. Attempt to place a 6th order.
5. Verify the red notification banner appears: *"Buffer full: order waiting for a free slot."*
6. Switch to the **Kitchen** tab. Confirm that 5 orders occupy the buffer slots and the 6th order appears in the **Blocked Producers FIFO Queue**.

### Scenario 2: Test Blocked Producer Admission
1. With the buffer at full capacity (5/5) and 1 order blocked, navigate to the **Kitchen** tab.
2. Click **Take Next Order**.
3. Observe that the oldest order is transferred to the **Worker Station** (`PREPARING`), and the blocked order is atomically admitted into the queue.
4. Verify the buffer remains at 5/5 capacity and the blocked producers list becomes empty.
5. In **Sync Lab**, inspect the event log to confirm two sequential entries: consumer retrieval followed by blocked producer admission.

### Scenario 3: Test Consumer Blocking on Empty Queue
1. In **Sync Lab**, click **Reset All**. Semaphores reset to `empty: 5`, `full: 0`, `mutex: 1`.
2. Navigate to the **Kitchen** tab.
3. Click **Take Next Order** when no orders exist.
4. Observe the toast notification: *"Buffer empty: consumer blocked."*
5. Inspect the event log in **Sync Lab** to verify the blocked consumer operation is logged with invariant validation.

### Scenario 4: Test Race Condition Demonstration
1. Navigate to the **Sync Lab** tab.
2. Scroll to the **Race Condition Demonstration** section.
3. Click **Run Without Mutex**. Watch the 4-step execution trace and observe the red collision alert: *"Race condition detected: inconsistent order status."*
4. Click **Run With Mutex**. Watch the 6-step serialized locking trace and observe the green success banner: *"Mutual exclusion enforced. Valid state transitions preserved."*

### Scenario 5: Resetting the Simulator
1. Click the **Reset All** button in the header of **Sync Lab**.
2. All semaphores reset to `empty: 5`, `full: 0`, `mutex: 1`.
3. The queue, blocked producers, worker station, and history are wiped cleanly, and the order counter restarts at `ORD101`.

### Scenario 6: Full Order Lifecycle & Counter 2 Pickup
1. Place an order for **Masala Dosa** from the **Menu** tab.
2. Switch to **Orders** tab to observe the order in `WAITING` status on the vertical timeline.
3. Switch to **Kitchen** and click **Take Next Order** (moves to `PREPARING`).
4. Click **Mark Ready**. Observe the green alert banner: *"Your food is ready — collect at Counter 2."*
5. Click **Confirm Student Pickup**. The order transitions to `COMPLETED` and moves to Past Orders history.

---

## 11. Screenshots

| Screen | View | Description |
| :--- | :--- | :--- |
| **Landing Page** | Desktop / Mobile | *`[Placeholder: Editorial Landing Page — Hero with Masala Dosa, Lineup cards, Principles, Showcase]`* |
| **Menu Screen** | Desktop / Mobile | *`[Placeholder: Menu Screen — 3-column food grid, search filter, category chips, floating cart bar]`* |
| **Cart Sheet** | Mobile Modal | *`[Placeholder: Cart Modal — Item list, price subtotals, queue capacity notice, place order action]`* |
| **Orders & Tracking** | Desktop / Mobile | *`[Placeholder: Orders Screen — Campus schematic map, live vertical lifecycle timeline, active switcher]`* |
| **Kitchen Dashboard** | Desktop / Mobile | *`[Placeholder: Kitchen Dashboard — 5 buffer slots, single active worker station, semaphore HUD]`* |
| **Sync Lab** | Desktop / Mobile | *`[Placeholder: Sync Lab — Counting semaphores, simulation triggers, live event log, race lab]`* |

---

## 12. Limitations of an In-Memory Simulation

- **Single-Threaded JavaScript Runtime**: All React reducer transitions run synchronously on the browser's JavaScript event loop. The mutex locks and counting semaphores are educational simulations representing how an OS kernel or Java thread pool (`java.util.concurrent.Semaphore`) operates.
- **In-Memory State**: State is preserved during the browser session but resets upon hard refresh. No external database or network backend is utilized.

---

## 13. Future Enhancements

- **Multi-Worker Kitchen**: Expand the kitchen model to support multiple concurrent worker stations with individual queue locks.
- **Priority Scheduling**: Implement priority queues with aging to demonstrate priority inversion and avoidance algorithms.
- **Web Workers Simulation**: Offload consumer and producer processes to dedicated Web Workers communicating via `SharedArrayBuffer` and `Atomics`.

---

## 14. License

Distributed under the MIT License. Free for academic and educational portfolio use.
