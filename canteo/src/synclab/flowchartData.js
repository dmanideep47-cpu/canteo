/**
 * Synchronization Flowcharts Data Model
 * Contains node definitions, coordinates, semantic metadata,
 * Canteo college canteen analogies, and POSIX instructions.
 *
 * Visual Node Grammars:
 * - terminal: Entry / exit / loop control
 * - box: Standard linear operational step
 * - wait_op: Synchronization check with side-channel blocking branch
 * - blocked: Sleep state suspended on wait queue
 * - inside: Protected critical section step
 */

export const PRODUCER_FLOW_NODES = [
  {
    id: 'p_start',
    stepNumber: '01',
    label: 'Student Producer Starts',
    sub: 'Thread initialization',
    shape: 'terminal',
    op: 'void* student_producer(void* arg)',
    meaning: 'The student process initializes and prepares to generate orders for the canteen.',
    resource: 'Student Thread Context',
    canteen: 'A student opens the Canteo app or approaches an order kiosk to place a food request.',
    cs: 'outside',
    blocking: 'Non-blocking process entry. Allocates thread stack.'
  },
  {
    id: 'p_create',
    stepNumber: '02',
    label: 'Create Student Order',
    sub: 'order = create_order()',
    shape: 'box',
    op: 'order_t order = create_student_order("Masala Dosa");',
    meaning: 'Generates a new order data packet in the producer’s private memory before touching any shared queues.',
    resource: 'Private Process Memory',
    canteen: 'The student picks Masala Dosa from the digital menu and confirms payment on their phone.',
    cs: 'outside',
    blocking: 'Non-blocking. Operates solely within private local stack memory.'
  },
  {
    id: 'p_wait_empty',
    stepNumber: '03',
    label: 'Acquire Empty Slot: wait(empty)',
    sub: 'sem_wait(&empty)',
    shape: 'wait_op',
    op: 'sem_wait(&empty);',
    meaning: 'Atomically checks counting semaphore empty. If empty > 0, decrements by 1 and claims permission to use one buffer bay. If empty == 0 (buffer saturated at capacity 5), the thread blocks until kitchen frees a slot.',
    resource: 'Counting Semaphore (empty)',
    canteen: 'The kiosk checks if the 5-ticket rack on the kitchen counter has a free peg. If all 5 pegs hold tickets, printing is halted.',
    cs: 'outside',
    blocking: 'Blocks when empty == 0 (buffer full). Awakened when a consumer calls sem_post(&empty).'
  },
  {
    id: 'p_blocked_empty',
    stepNumber: '03b',
    label: 'BLOCKED on empty',
    sub: 'Sleep in wait queue',
    shape: 'blocked',
    op: '// OS suspends thread in &empty wait queue',
    meaning: 'Thread enters a non-busy sleeping state in the OS wait queue. It consumes zero CPU cycles while waiting for a consumer to execute sem_post(&empty).',
    resource: 'OS Wait Queue (empty)',
    canteen: 'The student order waits in the kiosk buffer until a kitchen worker picks up an active order.',
    cs: 'outside',
    blocking: 'Suspended state. Thread yields processor slice until signaled by kitchen worker.'
  },
  {
    id: 'p_wait_mutex',
    stepNumber: '04',
    label: 'Acquire Queue Lock: wait(mutex)',
    sub: 'pthread_mutex_lock(&mutex)',
    shape: 'wait_op',
    op: 'pthread_mutex_lock(&mutex); // or sem_wait(&mutex)',
    meaning: 'Requests exclusive critical section ownership before modifying queue memory or write pointer. If another process owns the mutex, blocks in the FIFO mutex queue.',
    resource: 'Binary Semaphore (mutex = 1)',
    canteen: 'The student kiosk acquires permission to access the physical ticket rack so no one else touches it simultaneously.',
    cs: 'boundary',
    blocking: 'Blocks if mutex == 0 (lock held by another producer or consumer). Hands off in strict FIFO order.'
  },
  {
    id: 'p_blocked_mutex',
    stepNumber: '04b',
    label: 'WAITING on mutex',
    sub: 'Owner holds lock',
    shape: 'blocked',
    op: '// Suspended in mutex FIFO queue',
    meaning: 'Thread yields execution. Woken up in strict FIFO order when the current lock owner calls pthread_mutex_unlock(&mutex).',
    resource: 'Mutex FIFO Queue',
    canteen: 'The kiosk pauses for a fraction of a second while a kitchen worker finishes taking a ticket.',
    cs: 'outside',
    blocking: 'Suspended state. Woken up when previous critical section owner unlocks mutex.'
  },
  {
    id: 'p_insert',
    stepNumber: '05',
    label: 'Insert Order at write',
    sub: 'buffer[writePosition] = order',
    shape: 'box',
    op: 'buffer[writePosition] = order;',
    meaning: 'Deposits the order into the circular buffer slot indexed by writePosition. Protected exclusively by mutex to guarantee exactly-once write and prevent overwrite races.',
    resource: 'Shared Circular Buffer (buffer[write])',
    canteen: 'The Masala Dosa ticket is hung securely on peg #write in the kitchen rack.',
    cs: 'inside',
    blocking: 'Non-blocking execution inside protected critical section.'
  },
  {
    id: 'p_advance_write',
    stepNumber: '06',
    label: 'Advance Write Pointer',
    sub: 'write = (write + 1) mod 5',
    shape: 'box',
    op: 'writePosition = (writePosition + 1) % 5;',
    meaning: 'Advances the circular write index modulo 5. Index 4 wraps cleanly around to index 0, preventing buffer drift and maintaining bounded index integrity.',
    resource: 'Shared Pointer (writePosition)',
    canteen: 'The pointer moves to the next peg (0 through 4, then wraps back to 0).',
    cs: 'inside',
    blocking: 'Non-blocking atomic pointer arithmetic inside protected critical section.'
  },
  {
    id: 'p_signal_mutex',
    stepNumber: '07',
    label: 'Release Queue Lock: signal(mutex)',
    sub: 'pthread_mutex_unlock(&mutex)',
    shape: 'box',
    op: 'pthread_mutex_unlock(&mutex); // or sem_post(&mutex)',
    meaning: 'Exits critical section. Mutex value restores to 1. If processes are queued, hands off lock to the oldest waiting process immediately.',
    resource: 'Binary Semaphore (mutex)',
    canteen: 'The kiosk finishes modifying the rack and releases access for other kiosks or kitchen staff.',
    cs: 'boundary',
    blocking: 'Non-blocking. Unblocks next waiting thread in mutex queue.'
  },
  {
    id: 'p_signal_full',
    stepNumber: '08',
    label: 'Publish Order: signal(full)',
    sub: 'sem_post(&full)',
    shape: 'box',
    op: 'sem_post(&full);',
    meaning: 'Increments counting semaphore full by 1, notifying the kitchen that an order is ready to cook. If a kitchen consumer was sleeping on wait(full), wakes it immediately.',
    resource: 'Counting Semaphore (full)',
    canteen: 'The kitchen bell rings or buzzer chimes to notify kitchen staff of a freshly placed ticket.',
    cs: 'outside',
    blocking: 'Non-blocking. Wakes oldest consumer blocked on empty queue.'
  },
  {
    id: 'p_loop',
    stepNumber: '09',
    label: 'Repeat while running',
    sub: 'Continue to next order',
    shape: 'terminal',
    op: 'while (running) { ... }',
    meaning: 'The student producer loop continues for subsequent meal orders throughout the session.',
    resource: 'Producer Process Loop',
    canteen: 'The ordering system remains available for new student orders throughout canteen operating hours.',
    cs: 'outside',
    blocking: 'Non-blocking loop boundary.'
  }
];

export const CONSUMER_FLOW_NODES = [
  {
    id: 'c_start',
    stepNumber: '01',
    label: 'Kitchen Consumer Starts',
    sub: 'Worker initialization',
    shape: 'terminal',
    op: 'void* kitchen_consumer(void* arg)',
    meaning: 'The kitchen worker thread initializes and enters its polling/consumption lifecycle.',
    resource: 'Kitchen Worker Thread Context',
    canteen: 'A chef arrives at the cooking line and prepares to accept student order tickets.',
    cs: 'outside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Non-blocking thread initialization.'
  },
  {
    id: 'c_wait_full',
    stepNumber: '02',
    label: 'Acquire Order Permit: wait(full)',
    sub: 'sem_wait(&full)',
    shape: 'wait_op',
    op: 'sem_wait(&full);',
    meaning: 'Atomically checks counting semaphore full. If full > 0, decrements by 1 and claims permission to take an order. If full == 0 (buffer empty), blocks until a student deposits an order.',
    resource: 'Counting Semaphore (full)',
    canteen: 'The chef checks if any tickets are hanging on the rack. If 0 tickets, the chef rests instead of busy-checking.',
    cs: 'outside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Blocks when full == 0 (queue empty). Awakened when producer calls sem_post(&full).'
  },
  {
    id: 'c_blocked_full',
    stepNumber: '02b',
    label: 'BLOCKED on full',
    sub: 'Sleep in wait queue',
    shape: 'blocked',
    op: '// OS suspends thread in &full wait queue',
    meaning: 'Thread enters sleeping state in the OS wait queue. Prevents queue underflow and eliminates wasteful CPU busy-waiting.',
    resource: 'OS Wait Queue (full)',
    canteen: 'The chef rests at the counter until a student order buzzer sounds.',
    cs: 'outside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Suspended state. Consumes zero CPU cycles until order is published.'
  },
  {
    id: 'c_wait_mutex',
    stepNumber: '03',
    label: 'Acquire Queue Lock: wait(mutex)',
    sub: 'pthread_mutex_lock(&mutex)',
    shape: 'wait_op',
    op: 'pthread_mutex_lock(&mutex); // or sem_wait(&mutex)',
    meaning: 'Requests exclusive lock on the circular buffer. Prevents two workers from claiming the same ticket at the same time.',
    resource: 'Binary Semaphore (mutex = 1)',
    canteen: 'The chef ensures no other worker or kiosk is currently reaching for the ticket rack.',
    cs: 'boundary',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Blocks if mutex == 0. Ensures single-owner buffer mutation.'
  },
  {
    id: 'c_blocked_mutex',
    stepNumber: '03b',
    label: 'WAITING on mutex',
    sub: 'Owner holds lock',
    shape: 'blocked',
    op: '// Suspended in mutex FIFO queue',
    meaning: 'Thread yields execution until the other worker or student finishes modifying the queue.',
    resource: 'Mutex FIFO Queue',
    canteen: 'Chef pauses for an instant while another cook finishes taking a ticket from the rack.',
    cs: 'outside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Suspended state until released by previous critical section owner.'
  },
  {
    id: 'c_remove',
    stepNumber: '04',
    label: 'Remove Order at read',
    sub: 'order = buffer[readPosition]',
    shape: 'box',
    op: 'order_t order = buffer[readPosition]; buffer[readPosition] = NULL;',
    meaning: 'Pulls the order from the circular buffer slot at readPosition. Executed under mutex lock so no other consumer can pull or corrupt the same order.',
    resource: 'Shared Circular Buffer (buffer[read])',
    canteen: 'Chef takes the ticket off the peg at slot #read.',
    cs: 'inside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Non-blocking order removal inside critical section.'
  },
  {
    id: 'c_advance_read',
    stepNumber: '05',
    label: 'Advance Read Pointer',
    sub: 'read = (read + 1) mod 5',
    shape: 'box',
    op: 'readPosition = (readPosition + 1) % 5;',
    meaning: 'Advances the circular read index modulo 5. Slot 4 wraps smoothly to slot 0.',
    resource: 'Shared Pointer (readPosition)',
    canteen: 'The read marker advances to point to the next incoming order slot.',
    cs: 'inside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Non-blocking pointer increment inside critical section.'
  },
  {
    id: 'c_signal_mutex',
    stepNumber: '06',
    label: 'Release Queue Lock: signal(mutex)',
    sub: 'pthread_mutex_unlock(&mutex)',
    shape: 'box',
    op: 'pthread_mutex_unlock(&mutex); // or sem_post(&mutex)',
    meaning: 'Releases the mutex lock immediately after updating the queue. The lock is NEVER held while cooking! Essential rule of concurrent systems.',
    resource: 'Binary Semaphore (mutex)',
    canteen: 'Chef steps away from the ticket rack, leaving it completely free for other cooks and students.',
    cs: 'boundary',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Non-blocking. Unlocks queue for all other threads.'
  },
  {
    id: 'c_signal_empty',
    stepNumber: '07',
    label: 'Signal Empty Slot: signal(empty)',
    sub: 'sem_post(&empty)',
    shape: 'box',
    op: 'sem_post(&empty);',
    meaning: 'Increments counting semaphore empty by 1. If any student was blocked on a saturated queue, wakes the oldest student.',
    resource: 'Counting Semaphore (empty)',
    canteen: 'The empty peg is now available for students to place new orders.',
    cs: 'outside',
    stage: 'Stage A: Shared Queue Access',
    blocking: 'Non-blocking. Wakes oldest producer blocked on full queue.'
  },
  {
    id: 'c_cook',
    stepNumber: '08',
    label: 'Cook Food Outside Lock!',
    sub: 'prepare_dish(order) · Lock-free',
    shape: 'box',
    op: 'cook_food(order); // CRITICAL: Done outside critical section',
    meaning: 'Slow food preparation runs with ZERO locks held! Other consumers and producers can freely use the queue while cooking occurs.',
    resource: 'Kitchen Stove / Workstation (Private)',
    canteen: 'Chef fries the Masala Dosa on the griddle. Concurrency is maximized because the ticket rack is not blocked.',
    cs: 'outside',
    stage: 'Stage B: Independent Food Preparation',
    blocking: 'Independent non-blocking operation outside critical section.'
  },
  {
    id: 'c_ready',
    stepNumber: '09',
    label: 'Mark Order Ready',
    sub: 'Move to pickup counter',
    shape: 'box',
    op: 'order.status = READY_FOR_PICKUP;',
    meaning: 'Cooked meal is placed on the pickup counter and the student receives a collection notification.',
    resource: 'Pickup Counter Rack',
    canteen: 'Masala Dosa is placed on the ready rack under heat lamps; student token is called on the display board.',
    cs: 'outside',
    stage: 'Stage B: Independent Food Preparation',
    blocking: 'Non-blocking completion outside critical section.'
  },
  {
    id: 'c_loop',
    stepNumber: '10',
    label: 'Repeat while running',
    sub: 'Continue to next order',
    shape: 'terminal',
    op: 'while (running) { ... }',
    meaning: 'Consumer loop repeats to claim subsequent orders.',
    resource: 'Kitchen Worker Process Loop',
    canteen: 'Chef returns to check for the next ticket or rests until the next buzzer chime.',
    cs: 'outside',
    stage: 'Stage B: Independent Food Preparation',
    blocking: 'Non-blocking loop boundary.'
  }
];

export const COMBINED_SYSTEM_NODES = [
  {
    id: 'comb_producer',
    stepNumber: 'Lane 1',
    label: 'Student Producers Lane',
    sub: 'Place orders into queue',
    op: 'P1 .. Pn (Producers)',
    meaning: 'Students generate digital orders and reserve slots using wait(empty) and wait(mutex).',
    resource: 'Student Kiosks / Mobile Apps',
    canteen: 'Campus students submitting orders for lunch.',
    cs: 'outside',
    blocking: 'Independent client processes generating concurrent submissions.'
  },
  {
    id: 'comb_sem_empty',
    stepNumber: 'Counting Sem',
    label: 'Semaphore: empty = 5',
    sub: 'Available slot permits',
    op: 'sem_t empty; // Initial = 5',
    meaning: 'Counting semaphore tracking available queue slots. Prevents buffer overflow. Initialized to capacity N=5.',
    resource: 'Counting Semaphore (empty = 5)',
    canteen: 'Number of empty ticket pegs currently available on the counter rack.',
    cs: 'outside',
    blocking: 'Producers block when empty == 0; consumers increment via sem_post(&empty).'
  },
  {
    id: 'comb_mutex',
    stepNumber: 'Binary Sem',
    label: 'Mutex Lock = 1',
    sub: 'Mutual exclusion lock',
    op: 'pthread_mutex_t mutex; // Initial = 1',
    meaning: 'Binary lock serializing all insertions and removals. Guarantees that only ONE process modifies pointers or buffer slots at any time.',
    resource: 'Binary Semaphore (mutex = 1)',
    canteen: 'Single-access latch on the physical order board.',
    cs: 'boundary',
    blocking: 'Provides mutual exclusion. Threads block if lock is already claimed.'
  },
  {
    id: 'comb_sem_full',
    stepNumber: 'Counting Sem',
    label: 'Semaphore: full = 0',
    sub: 'Available order permits',
    op: 'sem_t full; // Initial = 0',
    meaning: 'Counting semaphore tracking orders waiting for kitchen preparation. Prevents buffer underflow. Initialized to 0.',
    resource: 'Counting Semaphore (full = 0)',
    canteen: 'Number of active orders waiting to be picked up by kitchen chefs.',
    cs: 'outside',
    blocking: 'Consumers block when full == 0; producers increment via sem_post(&full).'
  },
  {
    id: 'comb_buffer',
    stepNumber: 'Lane 2',
    label: 'Shared 5-Slot Circular Buffer',
    sub: 'readPosition & writePosition',
    op: 'Order buffer[5]; int readPos = 0, writePos = 0;',
    meaning: 'Shared memory array of capacity 5 with circular modulo arithmetic (idx = (idx + 1) % 5).',
    resource: 'Shared Bounded Memory Buffer',
    canteen: '5 numbered order slots behind the canteen counter.',
    cs: 'inside',
    blocking: 'Protected resource. Direct access restricted to threads holding mutex.'
  },
  {
    id: 'comb_consumer',
    stepNumber: 'Lane 3',
    label: 'Kitchen Consumers Lane',
    sub: 'Claim orders from queue',
    op: 'C1 .. Cm (Consumers)',
    meaning: 'Kitchen staff workers wait for orders using wait(full) and wait(mutex), remove tickets, and cook food outside the lock.',
    resource: 'Kitchen Preparation Staff',
    canteen: 'Canteen cooks preparing meals to order.',
    cs: 'outside',
    blocking: 'Worker processes running concurrently.'
  },
  {
    id: 'comb_prep_rack',
    stepNumber: 'Lane 3 (Prep)',
    label: 'Cooking & Pickup Rack',
    sub: 'Food preparation outside lock',
    op: 'cook_food(order); ready_shelf.push(order);',
    meaning: 'Food cooking and order assembly executed strictly OUTSIDE the critical section. Crucial for maximum concurrency.',
    resource: 'Kitchen Stoves & Pickup Shelves',
    canteen: 'Food cooking on stoves and plated hot meals waiting on the pickup counter.',
    cs: 'outside',
    blocking: 'Non-blocking concurrent preparation. Never holds queue mutex.'
  }
];
