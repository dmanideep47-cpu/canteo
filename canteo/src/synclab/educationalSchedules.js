/**
 * Deterministic Schedules and Data Models for:
 * 1. Visual Race Laboratory (Section 03)
 * 2. Interactive Synchronization Solution (Section 04)
 */

export const INITIAL_QUEUE_ORDERS = [
  { id: 'O01', name: 'Masala Dosa', producer: 'P1', pos: '0% 0%' },
  { id: 'O02', name: 'Idli & Sambar', producer: 'P2', pos: '50% 0%' },
  { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', pos: '100% 0%' },
  null,
  null
];

// 5-step deterministic Unsafe Schedule (Consumer Race without Mutex)
export const UNSAFE_STEPS = [
  {
    stepNumber: 1,
    title: 'C1 reads the queue head at slot 0',
    workerId: 'C1',
    activeAction: 'Reads slot 0',
    accessedSlot: 0,
    c1State: { action: 'Reading slot 0', localRead: 'O01', claimed: null, isStale: false },
    c2State: { action: 'Idle · waiting for order', localRead: null, claimed: null, isStale: false },
    readPosition: 0,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'IN_QUEUE' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C1 inspects slot 0 and reads order O01 as its candidate to claim. C1 has NOT locked the queue or advanced the read pointer yet.',
    concept: 'Unsynchronized Shared Read',
    sharedChange: 'Local observation only; shared buffer untouched'
  },
  {
    stepNumber: 2,
    title: 'C2 also reads slot 0 before C1 claims it',
    workerId: 'C2',
    activeAction: 'Reads slot 0',
    accessedSlot: 0,
    c1State: { action: 'Local read: O01 (pending claim)', localRead: 'O01', claimed: null, isStale: false },
    c2State: { action: 'Reading slot 0 (interleaved!)', localRead: 'O01', claimed: null, isStale: true },
    readPosition: 0,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'IN_QUEUE' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'Before C1 can claim O01, C2 checks the queue head. Because there is no mutex locking the head, C2 also reads slot 0 and gets O01! C2’s cached read is now dangerous.',
    concept: 'Race Window / Stale Read',
    sharedChange: 'C2 latches stale candidate O01 while readPosition remains 0'
  },
  {
    stepNumber: 3,
    title: 'C1 claims O01 and advances read pointer to 1',
    workerId: 'C1',
    activeAction: 'Claims O01, readPos -> 1',
    accessedSlot: 0,
    c1State: { action: 'CLAIMED O01 · Cooking in kitchen', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'Holds stale candidate O01', localRead: 'O01', claimed: null, isStale: true },
    readPosition: 1,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'CLAIMED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C1 finishes claiming O01 and advances the circular read pointer from 0 to 1. Slot 0 is now officially taken by C1, and slot 1 is the true new queue head.',
    concept: 'Desynchronized State Transition',
    sharedChange: 'readPosition advanced to 1, but C2 already committed to slot 0 locally'
  },
  {
    stepNumber: 4,
    title: 'C2 acts on its stale read and claims O01 as well!',
    workerId: 'C2',
    activeAction: 'Claims O01 (conflict!)',
    accessedSlot: 0,
    c1State: { action: 'Cooking O01', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'CLAIMED O01 (stale read collision!)', localRead: 'O01', claimed: 'O01', isStale: true },
    readPosition: 1,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'DUPLICATE_CLAIM' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C2 executes its claim using its previously read value (O01) instead of inspecting the current queue state. Both C1 and C2 now believe they own order O01!',
    concept: 'Time-of-Check to Time-of-Use (TOCTOU)',
    sharedChange: 'Two workers claimed the identical order O01'
  },
  {
    stepNumber: 5,
    title: 'Duplicate claim conflict: Both workers cook order O01',
    workerId: 'C1 & C2',
    activeAction: 'Conflict detected',
    accessedSlot: 0,
    c1State: { action: 'Cooking O01 (Masala Dosa)', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'Cooking O01 (Duplicate!)', localRead: 'O01', claimed: 'O01', isStale: true },
    readPosition: 1,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'DUPLICATE_CLAIM' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'The kitchen cooks two Masala Dosas for one student order! Meanwhile, order O02 at slot 1 was bypassed and sits unattended. This is a classic race condition caused by unsynchronized access.',
    concept: 'Duplicate Claim Fault (TOCTOU)',
    sharedChange: 'Kitchen resources wasted; order O02 stranded in queue'
  }
];

// 5-step deterministic Safe Schedule (With Mutex)
export const SAFE_STEPS = [
  {
    stepNumber: 1,
    title: 'C1 acquires mutex and locks the queue head',
    workerId: 'C1',
    activeAction: 'wait(mutex) -> Lock acquired',
    accessedSlot: 0,
    mutexOwner: 'C1',
    mutexWaiters: [],
    c1State: { action: 'Holds mutex · reading slot 0', localRead: 'O01', claimed: null, isStale: false },
    c2State: { action: 'Idle · waiting to claim', localRead: null, claimed: null, isStale: false },
    readPosition: 0,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'LOCKED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C1 calls wait(mutex). The mutex is available (1 -> 0), so C1 enters the critical section exclusively and inspects slot 0.',
    concept: 'Mutual Exclusion Acquisition',
    sharedChange: 'mutex value 1 -> 0, owned by C1'
  },
  {
    stepNumber: 2,
    title: 'C2 attempts to claim order, blocks on locked mutex',
    workerId: 'C2',
    activeAction: 'wait(mutex) -> BLOCKED',
    accessedSlot: null,
    mutexOwner: 'C1',
    mutexWaiters: ['C2'],
    c1State: { action: 'Inside critical section with O01', localRead: 'O01', claimed: null, isStale: false },
    c2State: { action: 'BLOCKED on mutex (waiting for C1)', localRead: null, claimed: null, isStale: false },
    readPosition: 0,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'LOCKED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C2 calls wait(mutex). Because C1 already holds the mutex, C2 cannot read or manipulate the queue. The OS blocks C2 in the FIFO mutex wait queue.',
    concept: 'Safe Serialization / Mutex Wait Queue',
    sharedChange: 'C2 suspended; critical section protected against concurrent read'
  },
  {
    stepNumber: 3,
    title: 'C1 dequeues O01, advances pointer, and releases mutex',
    workerId: 'C1',
    activeAction: 'Claims O01, signal(mutex)',
    accessedSlot: 0,
    mutexOwner: null,
    mutexWaiters: [],
    c1State: { action: 'CLAIMED O01 · Cooking in kitchen', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'Woken up by mutex release', localRead: null, claimed: null, isStale: false },
    readPosition: 1,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'CLAIMED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'IN_QUEUE' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C1 completes its critical section atomically: it claims O01, advances readPosition from 0 to 1, and calls signal(mutex). The mutex wakes up waiting worker C2.',
    concept: 'Atomic Critical Section Completion & Handoff',
    sharedChange: 'Slot 0 claimed, readPosition is 1, C2 unblocked'
  },
  {
    stepNumber: 4,
    title: 'C2 acquires mutex and reads fresh head at slot 1',
    workerId: 'C2',
    activeAction: 'wait(mutex) -> Lock acquired',
    accessedSlot: 1,
    mutexOwner: 'C2',
    mutexWaiters: [],
    c1State: { action: 'Cooking O01 outside lock', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'Holds mutex · reading slot 1', localRead: 'O02', claimed: null, isStale: false },
    readPosition: 1,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'CLAIMED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'LOCKED_BY_C2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'Now C2 enters the critical section exclusively. Because readPosition was already updated to 1, C2 reads order O02 (Idli & Sambar) instead of duplicating O01!',
    concept: 'Fresh State Observation under Mutex',
    sharedChange: 'C2 acquires mutex, reads true queue head at slot 1'
  },
  {
    stepNumber: 5,
    title: 'C2 claims O02 and releases mutex: Zero duplicate claims',
    workerId: 'C2',
    activeAction: 'Claims O02, signal(mutex)',
    accessedSlot: 1,
    mutexOwner: null,
    mutexWaiters: [],
    c1State: { action: 'Cooking O01 (Masala Dosa)', localRead: 'O01', claimed: 'O01', isStale: false },
    c2State: { action: 'Cooking O02 (Idli & Sambar)', localRead: 'O02', claimed: 'O02', isStale: false },
    readPosition: 2,
    queueState: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1', status: 'CLAIMED_BY_C1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2', status: 'CLAIMED_BY_C2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3', status: 'IN_QUEUE' },
      null,
      null
    ],
    explanation: 'C2 claims O02, advances readPosition to 2, and releases the mutex. Both workers are cooking separate, valid orders with zero waste and zero duplicate claims.',
    concept: 'Safe Serialized Execution Verified',
    sharedChange: 'C1 has O01, C2 has O02; readPosition is 2; queue invariants preserved'
  }
];

export const SCENARIO_1_STEPS = [
  {
    step: 1,
    actor: 'P1',
    op: 'P1 creates order',
    code: 'order_t order = create_order("Masala Dosa");',
    empty: 5,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'P1', step: 'create' },
    producerState: { state: 'RUNNING', action: 'Created O01 (Masala Dosa) · ready to reserve slot' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'Student producer P1 prepares a new digital food order (O01: Masala Dosa). The bounded buffer currently has 5 empty slots and 0 ready orders.',
    concept: 'Initial Invariant: empty=5, full=0, mutex=1'
  },
  {
    step: 2,
    actor: 'P1',
    op: 'wait(empty)',
    code: 'sem_wait(&empty); // Decrements empty (5 -> 4)',
    empty: 4,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'P1', step: 'waitEmpty' },
    producerState: { state: 'RUNNING', action: 'Slot permit reserved! (empty=4)' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'P1 calls wait(empty). Because empty is 5 (> 0), P1 successfully decrements empty to 4 without blocking, reserving one slot in the queue.',
    concept: 'Counting Semaphore: Slot Capacity Reservation'
  },
  {
    step: 3,
    actor: 'P1',
    op: 'wait(mutex)',
    code: 'sem_wait(&mutex); // Enters critical section (mutex 1 -> 0)',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'P1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'P1', step: 'waitMutex' },
    producerState: { state: 'RUNNING', action: 'Acquired mutex · inside critical section' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'P1 acquires the binary mutex lock. Now P1 has exclusive access to modify the shared queue and its pointer.',
    concept: 'Mutual Exclusion: Critical Section Protection'
  },
  {
    step: 4,
    actor: 'P1',
    op: 'buffer[write] = order',
    code: 'buffer[write] = order; // Writes O01 to slot 0',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'P1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'P1', step: 'insert' },
    producerState: { state: 'RUNNING', action: 'Writing order O01 to buffer[0]' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'Inside the critical section, P1 deposits the Masala Dosa into buffer[0]. No consumer or other producer can interfere during this write.',
    concept: 'Shared Resource Access under Lock'
  },
  {
    step: 5,
    actor: 'P1',
    op: 'write = (write + 1) % 5',
    code: 'write = (write + 1) % 5; // Pointer: 0 -> 1',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'P1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'P1', step: 'advanceWrite' },
    producerState: { state: 'RUNNING', action: 'Advanced write pointer: 0 -> 1' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'P1 updates the circular write index to 1. The modulo arithmetic ensures circular wrap-around once index 4 is reached.',
    concept: 'Circular Buffer Pointer Maintenance'
  },
  {
    step: 6,
    actor: 'P1',
    op: 'signal(mutex)',
    code: 'sem_post(&mutex); // Leaves critical section (mutex 0 -> 1)',
    empty: 4,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'P1', step: 'signalMutex' },
    producerState: { state: 'RUNNING', action: 'Released mutex · left critical section' },
    consumerState: { state: 'IDLE', action: 'Waiting for orders' },
    explanation: 'P1 releases the mutex lock. The critical section is now open for other processes.',
    concept: 'Critical Section Exit Protocol'
  },
  {
    step: 7,
    actor: 'P1',
    op: 'signal(full)',
    code: 'sem_post(&full); // Increments full (0 -> 1)',
    empty: 4,
    full: 1,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'P1', step: 'signalFull' },
    producerState: { state: 'COMPLETE', action: 'Order submitted! Full permit posted.' },
    consumerState: { state: 'READY', action: 'New order ready to claim! (full=1)' },
    explanation: 'P1 signals the full semaphore, incrementing it from 0 to 1. This publishes the order to the kitchen. Any waiting kitchen consumer would be woken here.',
    concept: 'Semaphore Signaling / Resource Publication'
  },
  {
    step: 8,
    actor: 'C1',
    op: 'wait(full)',
    code: 'sem_wait(&full); // Decrements full (1 -> 0)',
    empty: 4,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'C1', step: 'waitFull' },
    producerState: { state: 'IDLE', action: 'Order placed' },
    consumerState: { state: 'RUNNING', action: 'Order permit reserved! (full=0)' },
    explanation: 'Kitchen consumer C1 calls wait(full). Since full is 1, C1 decrements it to 0 without blocking, claiming the right to consume one order.',
    concept: 'Consumer Resource Acquisition'
  },
  {
    step: 9,
    actor: 'C1',
    op: 'wait(mutex)',
    code: 'sem_wait(&mutex); // Enters critical section (mutex 1 -> 0)',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'C1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'C1', step: 'waitMutex' },
    producerState: { state: 'IDLE', action: 'Order placed' },
    consumerState: { state: 'RUNNING', action: 'Acquired mutex · inside critical section' },
    explanation: 'C1 acquires the mutex to enter the critical section. Only C1 can read or modify the shared buffer right now.',
    concept: 'Mutual Exclusion Serialization'
  },
  {
    step: 10,
    actor: 'C1',
    op: 'order = buffer[read]',
    code: 'order = buffer[read]; // Removes O01 from slot 0',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'C1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'remove' },
    producerState: { state: 'IDLE', action: 'Order placed' },
    consumerState: { state: 'RUNNING', action: 'Dequeued O01 (Masala Dosa) from buffer[0]' },
    explanation: 'C1 removes order O01 from buffer[0]. The slot in the buffer is now cleared.',
    concept: 'Protected Dequeue Operation'
  },
  {
    step: 11,
    actor: 'C1',
    op: 'read = (read + 1) % 5',
    code: 'read = (read + 1) % 5; // Pointer: 0 -> 1',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'C1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'advanceRead' },
    producerState: { state: 'IDLE', action: 'Order placed' },
    consumerState: { state: 'RUNNING', action: 'Advanced read pointer: 0 -> 1' },
    explanation: 'C1 advances the circular read pointer from 0 to 1, matching the write position (both pointers now at index 1, representing an empty queue).',
    concept: 'Circular Read Pointer Update'
  },
  {
    step: 12,
    actor: 'C1',
    op: 'signal(mutex)',
    code: 'sem_post(&mutex); // Leaves critical section (mutex 0 -> 1)',
    empty: 4,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'signalMutex' },
    producerState: { state: 'IDLE', action: 'Order placed' },
    consumerState: { state: 'RUNNING', action: 'Released mutex · left critical section' },
    explanation: 'C1 exits the critical section and releases the mutex lock.',
    concept: 'Release Lock Before Long-Running Work'
  },
  {
    step: 13,
    actor: 'C1',
    op: 'signal(empty) & Cook Food',
    code: 'sem_post(&empty); // Increments empty (4 -> 5)\nprepare_food(order); // Long task done OUTSIDE lock!',
    empty: 5,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'cook' },
    producerState: { state: 'IDLE', action: 'Can place next order' },
    consumerState: { state: 'COOKING', action: 'Preparing Masala Dosa outside critical section!' },
    explanation: 'C1 signals empty (restoring 5 available slots) and cooks the Masala Dosa OUTSIDE the critical section. Crucial OS principle: never hold locks during slow operations!',
    concept: 'Cooking Outside Critical Section (Concurrency Maximization)'
  }
];

export const SCENARIO_2_STEPS = [
  {
    step: 1,
    actor: 'P6',
    op: 'Queue Full: 5/5 Slots Occupied',
    code: '// Buffer is completely full:\n// empty == 0, full == 5',
    empty: 0,
    full: 5,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'P6', step: 'create' },
    producerState: { state: 'READY', action: 'P6 wants to submit 6th order (Noodle Bowl)' },
    consumerState: { state: 'IDLE', action: 'Kitchen preparing other dishes' },
    explanation: 'All 5 buffer slots are occupied. The empty semaphore is at 0. Student P6 attempts to place a 6th order.',
    concept: 'Bounded Buffer Boundary: Saturated Capacity'
  },
  {
    step: 2,
    actor: 'P6',
    op: 'P6 calls wait(empty) -> BLOCKED!',
    code: 'sem_wait(&empty); // empty is 0 -> P6 BLOCKED in OS wait queue',
    empty: 0,
    full: 5,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: ['P6'],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'P6', step: 'waitEmpty' },
    producerState: { state: 'BLOCKED', action: 'BLOCKED on wait(empty) · waiting for kitchen to free a slot' },
    consumerState: { state: 'IDLE', action: 'Must consume order to unblock P6' },
    explanation: 'Because empty is 0, the OS puts P6 into sleep state and queues it in the "waiters on empty" list. P6 does NOT spin or burn CPU.',
    concept: 'Semaphore Blocking: Process Sleep on Resource Exhaustion'
  },
  {
    step: 3,
    actor: 'C1',
    op: 'Kitchen C1 consumes order O01',
    code: 'sem_wait(&full); sem_wait(&mutex);\norder = buffer[read]; read = (read + 1) % 5;\nsem_post(&mutex);',
    empty: 0,
    full: 4,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: ['P6'],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 1,
    slots: [
      null,
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'C1', step: 'remove' },
    producerState: { state: 'BLOCKED', action: 'Still waiting on empty semaphore' },
    consumerState: { state: 'RUNNING', action: 'Dequeued O01 · about to signal empty' },
    explanation: 'Kitchen worker C1 dequeues order O01 from slot 0 and advances the read pointer. Slot 0 is now vacated, but P6 is not woken until C1 signals empty.',
    concept: 'Slot Liberation Prior to Handoff Signal'
  },
  {
    step: 4,
    actor: 'C1',
    op: 'C1 signals empty -> P6 Woken Up!',
    code: 'sem_post(&empty); // Wakes oldest waiting producer (P6)',
    empty: 1,
    full: 4,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 1,
    slots: [
      null,
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'C1', step: 'signalEmpty' },
    producerState: { state: 'READY', action: 'Woken up by C1 signal! Ready to insert order.' },
    consumerState: { state: 'COOKING', action: 'Preparing O01 in kitchen' },
    explanation: 'C1 calls sem_post(&empty). The OS wakes up blocked producer P6 and moves it from the wait queue back to the READY state.',
    concept: 'Resource Handoff: FIFO Wakeup on Signal'
  },
  {
    step: 5,
    actor: 'P6',
    op: 'P6 inserts O06 into newly freed slot 0',
    code: 'sem_wait(&mutex);\nbuffer[write] = order; write = (write + 1) % 5;',
    empty: 0,
    full: 4,
    mutex: 0,
    mutexOwner: 'P6',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [
      { id: 'O06', name: 'Noodle Bowl', producer: 'P6' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'P6', step: 'insert' },
    producerState: { state: 'RUNNING', action: 'Inserted O06 into slot 0 · writePos -> 1' },
    consumerState: { state: 'COOKING', action: 'Preparing O01' },
    explanation: 'P6 acquires the mutex and successfully inserts its Noodle Bowl (O06) into slot 0. Bounded queue never exceeded 5 items.',
    concept: 'Safe Admission & Capacity Conservation'
  },
  {
    step: 6,
    actor: 'P6',
    op: 'P6 signals mutex and full: Queue is full again',
    code: 'sem_post(&mutex); sem_post(&full);',
    empty: 0,
    full: 5,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [
      { id: 'O06', name: 'Noodle Bowl', producer: 'P6' },
      { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
      { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
      { id: 'O04', name: 'Samosa', producer: 'P4' },
      { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
    ],
    activeFlow: { actor: 'P6', step: 'signalFull' },
    producerState: { state: 'COMPLETE', action: 'Order admitted cleanly without buffer overflow!' },
    consumerState: { state: 'COOKING', action: 'Preparing O01' },
    explanation: 'P6 signals the full semaphore, restoring full to 5 and empty to 0. Capacity was strictly conserved at 5 throughout.',
    concept: 'Invariants Preserved: empty + full = 5'
  }
];

export const SCENARIO_3_STEPS = [
  {
    step: 1,
    actor: 'C1',
    op: 'Queue Empty: 0 Orders Ready',
    code: '// Buffer is empty:\n// empty == 5, full == 0',
    empty: 5,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'request' },
    producerState: { state: 'IDLE', action: 'No student placing orders' },
    consumerState: { state: 'READY', action: 'Kitchen worker C1 ready to cook next order' },
    explanation: 'The queue has 0 orders (full=0). Kitchen worker C1 is ready and calls wait(full) to claim work.',
    concept: 'Empty Buffer Condition: Underflow Prevention'
  },
  {
    step: 2,
    actor: 'C1',
    op: 'C1 calls wait(full) -> BLOCKED!',
    code: 'sem_wait(&full); // full is 0 -> C1 BLOCKED in OS wait queue',
    empty: 5,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: ['C1'],
    waitersMutex: [],
    writePos: 0,
    readPos: 0,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'waitFull' },
    producerState: { state: 'IDLE', action: 'No student placing orders' },
    consumerState: { state: 'BLOCKED', action: 'BLOCKED on wait(full) · sleeping until student submits order' },
    explanation: 'Because full is 0, the OS blocks C1. Instead of reading an empty array slot or crashing with undefined data, C1 safely sleeps.',
    concept: 'Underflow Prevention: Consumer Blocking'
  },
  {
    step: 3,
    actor: 'P1',
    op: 'Student P1 places order and signals full -> C1 Woken!',
    code: 'sem_wait(&empty); sem_wait(&mutex);\nbuffer[0] = order; write = 1;\nsem_post(&mutex);\nsem_post(&full); // Wakes waiting consumer C1!',
    empty: 4,
    full: 1,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 0,
    slots: [
      { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
      null, null, null, null
    ],
    activeFlow: { actor: 'P1', step: 'signalFull' },
    producerState: { state: 'COMPLETE', action: 'Submitted O01 (Masala Dosa) · woke C1' },
    consumerState: { state: 'READY', action: 'Woken up by P1! Ready to dequeue O01.' },
    explanation: 'Student P1 places order O01 into slot 0 and calls sem_post(&full). The OS immediately wakes up blocked worker C1.',
    concept: 'Consumer Wakeup on Order Publication'
  },
  {
    step: 4,
    actor: 'C1',
    op: 'C1 acquires mutex and dequeues O01',
    code: 'sem_wait(&mutex); // Enters CS\norder = buffer[read]; read = (read + 1) % 5;',
    empty: 4,
    full: 0,
    mutex: 0,
    mutexOwner: 'C1',
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'remove' },
    producerState: { state: 'IDLE', action: 'Order being processed' },
    consumerState: { state: 'RUNNING', action: 'Acquired mutex · dequeued O01 from slot 0' },
    explanation: 'C1 acquires the mutex, safely takes order O01 from slot 0, and advances readPosition to 1.',
    concept: 'Synchronized Consumption'
  },
  {
    step: 5,
    actor: 'C1',
    op: 'C1 signals empty and cooks Masala Dosa outside lock',
    code: 'sem_post(&mutex); sem_post(&empty);\nprepare_food(order); // Long task done OUTSIDE lock!',
    empty: 5,
    full: 0,
    mutex: 1,
    mutexOwner: null,
    waitersEmpty: [],
    waitersFull: [],
    waitersMutex: [],
    writePos: 1,
    readPos: 1,
    slots: [null, null, null, null, null],
    activeFlow: { actor: 'C1', step: 'cook' },
    producerState: { state: 'IDLE', action: 'Buffer empty, ready for next order' },
    consumerState: { state: 'COOKING', action: 'Preparing Masala Dosa outside critical section!' },
    explanation: 'C1 signals empty (returning the slot permit to students) and cooks the food outside the lock. The cycle completes smoothly.',
    concept: 'Safe Completion & Lock-Free Food Preparation'
  }
];

export const POSIX_PSEUDOCODE = {
  producer: `// POSIX C Producer Implementation (Student Process)
#include <semaphore.h>
#include <pthread.h>

extern sem_t empty;  // Counting semaphore: initial = N (5)
extern sem_t full;   // Counting semaphore: initial = 0
extern sem_t mutex;  // Binary semaphore: initial = 1

void* student_producer(void* arg) {
    while (1) {
        order_t order = create_student_order();

        // 1. Wait for an available slot in the bounded queue
        sem_wait(&empty);

        // 2. Enter critical section (exclusive buffer access)
        sem_wait(&mutex);

        // CRITICAL SECTION START
        buffer[write_index] = order;
        write_index = (write_index + 1) % BUFFER_SIZE;
        // CRITICAL SECTION END

        // 3. Exit critical section
        sem_post(&mutex);

        // 4. Signal that a new item is available for kitchen
        sem_post(&full);
    }
    return NULL;
}`,
  consumer: `// POSIX C Consumer Implementation (Kitchen Worker)
#include <semaphore.h>
#include <pthread.h>

extern sem_t empty;  // Counting semaphore: initial = N (5)
extern sem_t full;   // Counting semaphore: initial = 0
extern sem_t mutex;  // Binary semaphore: initial = 1

void* kitchen_consumer(void* arg) {
    while (1) {
        // 1. Wait for an available order in the bounded queue
        sem_wait(&full);

        // 2. Enter critical section (exclusive buffer access)
        sem_wait(&mutex);

        // CRITICAL SECTION START
        order_t order = buffer[read_index];
        read_index = (read_index + 1) % BUFFER_SIZE;
        // CRITICAL SECTION END

        // 3. Exit critical section
        sem_post(&mutex);

        // 4. Signal that a buffer slot has been freed
        sem_post(&empty);

        // 5. Cook and assemble order OUTSIDE critical section!
        // Never hold mutex during long-running preparation!
        prepare_and_cook_order(order);
    }
    return NULL;
}`
};
