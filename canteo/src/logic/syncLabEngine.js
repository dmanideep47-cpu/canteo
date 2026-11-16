/**
 * Deterministic Bounded-Buffer Synchronization Engine for Canteo Sync Lab.
 *
 * Implements an instruction-level simulator for:
 * - Counting semaphores (empty, full) with FIFO wait queues & direct permit transfer
 * - Mutual exclusion lock (mutex) with strict single-owner tracking
 * - Circular bounded buffer (capacity = 5) with IN and OUT pointer arithmetic
 * - Canonical producer and consumer instruction steps
 * - Invariant assertions and semantic execution event tracking
 */

export const BUFFER_CAPACITY = 5;

export const THREAD_STATUS = {
  READY: 'READY',
  RUNNING: 'RUNNING',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
};

export const THREAD_ROLE = {
  PRODUCER: 'PRODUCER',
  CONSUMER: 'CONSUMER',
};

export const PRODUCER_INSTRUCTIONS = [
  { step: 0, op: 'CREATE_ITEM', label: 'Create local order item' },
  { step: 1, op: 'WAIT_EMPTY', label: 'sem_wait(&empty) — request free buffer slot' },
  { step: 2, op: 'WAIT_MUTEX', label: 'pthread_mutex_lock(&mutex) — enter critical section' },
  { step: 3, op: 'INSERT_SLOT', label: 'buffer[in] = item — insert order into slot' },
  { step: 4, op: 'ADVANCE_IN', label: 'in = (in + 1) % CAPACITY — advance write pointer' },
  { step: 5, op: 'SIGNAL_MUTEX', label: 'pthread_mutex_unlock(&mutex) — leave critical section' },
  { step: 6, op: 'SIGNAL_FULL', label: 'sem_post(&full) — announce ready order' },
  { step: 7, op: 'CYCLE_DONE', label: 'Production cycle complete' },
];

// Decomposed Producer Instructions with Mutex (for Controlled Teaching & Comparison)
export const DECOMPOSED_PRODUCER_WITH_MUTEX_INSTRUCTIONS = [
  { step: 0, op: 'CREATE_ITEM', label: 'Create local order item', desc: 'Prepare order token in local register' },
  { step: 1, op: 'WAIT_EMPTY', label: 'sem_wait(&empty)', desc: 'Acquire capacity permit' },
  { step: 2, op: 'LOCK', label: 'pthread_mutex_lock(&mutex)', desc: 'Acquire mutex / enter critical section' },
  { step: 3, op: 'READ_IN', label: 'targetSlot = in', desc: 'Read shared IN pointer into thread-local target register' },
  { step: 4, op: 'WRITE_SLOT', label: 'buffer[targetSlot] = item', desc: 'Store order in target slot under lock' },
  { step: 5, op: 'UPDATE_IN', label: 'in = (in + 1) % CAPACITY', desc: 'Advance write pointer under lock' },
  { step: 6, op: 'UNLOCK', label: 'pthread_mutex_unlock(&mutex)', desc: 'Release mutex lock' },
  { step: 7, op: 'SIGNAL_FULL', label: 'sem_post(&full)', desc: 'Publish order permit' },
  { step: 8, op: 'CYCLE_DONE', label: 'Production cycle complete', desc: 'Cycle complete' },
];

// Decomposed Producer Instructions WITHOUT Mutex (permits stale-read race condition)
export const DECOMPOSED_PRODUCER_WITHOUT_MUTEX_INSTRUCTIONS = [
  { step: 0, op: 'CREATE_ITEM', label: 'Create local order item', desc: 'Prepare order token in local register' },
  { step: 1, op: 'WAIT_EMPTY', label: 'sem_wait(&empty)', desc: 'Acquire capacity permit' },
  { step: 2, op: 'READ_IN', label: 'targetSlot = in [UNPROTECTED]', desc: 'Read shared IN pointer into thread register without lock' },
  { step: 3, op: 'WRITE_SLOT', label: 'buffer[targetSlot] = item [UNPROTECTED]', desc: 'Write order into target slot without lock' },
  { step: 4, op: 'UPDATE_IN', label: 'in = (in + 1) % CAPACITY [UNPROTECTED]', desc: 'Advance write pointer without lock' },
  { step: 5, op: 'SIGNAL_FULL', label: 'sem_post(&full)', desc: 'Publish order permit' },
  { step: 6, op: 'CYCLE_DONE', label: 'Production cycle complete', desc: 'Cycle complete' },
];

// Decomposed Consumer Instructions with Mutex (Protected)
export const DECOMPOSED_CONSUMER_WITH_MUTEX_INSTRUCTIONS = [
  { step: 0, op: 'WAIT_FULL', label: 'sem_wait(&full)', desc: 'Wait for available order ticket' },
  { step: 1, op: 'LOCK', label: 'pthread_mutex_lock(&mutex)', desc: 'Acquire mutex / enter critical section' },
  { step: 2, op: 'READ_OUT', label: 'targetSlot = out', desc: 'Read shared OUT pointer into private target register' },
  { step: 3, op: 'READ_ITEM', label: 'candidate = buffer[targetSlot]', desc: 'Read ticket from target slot into private candidate register' },
  { step: 4, op: 'COMMIT_CLAIM', label: 'buffer[targetSlot] = null', desc: 'Remove ticket from buffer slot under mutex' },
  { step: 5, op: 'UPDATE_OUT', label: 'out = (out + 1) % CAPACITY', desc: 'Advance OUT read pointer under mutex' },
  { step: 6, op: 'UNLOCK', label: 'pthread_mutex_unlock(&mutex)', desc: 'Release mutex lock' },
  { step: 7, op: 'SIGNAL_EMPTY', label: 'sem_post(&empty)', desc: 'Announce freed buffer capacity' },
  { step: 8, op: 'PROCESS', label: 'Kitchen prepare order', desc: 'Cook and package meal outside critical section' },
  { step: 9, op: 'CYCLE_DONE', label: 'Consumption complete', desc: 'Cycle complete' },
];

// Decomposed Consumer Instructions WITHOUT Mutex (permits concurrent read/claim race on shared queue)
export const DECOMPOSED_CONSUMER_WITHOUT_MUTEX_INSTRUCTIONS = [
  { step: 0, op: 'WAIT_FULL', label: 'sem_wait(&full)', desc: 'Wait for available order ticket' },
  { step: 1, op: 'READ_OUT', label: 'targetSlot = out [UNPROTECTED]', desc: 'Read shared OUT without lock' },
  { step: 2, op: 'READ_ITEM', label: 'candidate = buffer[targetSlot] [UNPROTECTED]', desc: 'Read candidate ticket without lock' },
  { step: 3, op: 'COMMIT_CLAIM', label: 'buffer[targetSlot] = null [UNPROTECTED]', desc: 'Claim ticket from slot without lock' },
  { step: 4, op: 'UPDATE_OUT', label: 'out = (out + 1) % CAPACITY [UNPROTECTED]', desc: 'Advance OUT read pointer without lock' },
  { step: 5, op: 'SIGNAL_EMPTY', label: 'sem_post(&empty)', desc: 'Announce freed buffer capacity' },
  { step: 6, op: 'PROCESS', label: 'Kitchen prepare order', desc: 'Cook and package meal outside critical section' },
  { step: 7, op: 'CYCLE_DONE', label: 'Consumption complete', desc: 'Cycle complete' },
];

export const CONSUMER_INSTRUCTIONS = [
  { step: 0, op: 'WAIT_FULL', label: 'sem_wait(&full) — wait for available order' },
  { step: 1, op: 'WAIT_MUTEX', label: 'pthread_mutex_lock(&mutex) — enter critical section' },
  { step: 2, op: 'REMOVE_SLOT', label: 'item = buffer[out] — extract order from slot' },
  { step: 3, op: 'ADVANCE_OUT', label: 'out = (out + 1) % CAPACITY — advance read pointer' },
  { step: 4, op: 'SIGNAL_MUTEX', label: 'pthread_mutex_unlock(&mutex) — leave critical section' },
  { step: 5, op: 'SIGNAL_EMPTY', label: 'sem_post(&empty) — announce freed slot' },
  { step: 6, op: 'PROCESS_ITEM', label: 'Process / cook order outside critical section' },
  { step: 7, op: 'CYCLE_DONE', label: 'Consumption cycle complete' },
];

// Faulty consumer ordering that produces deadlock when buffer is empty
export const DEADLOCK_CONSUMER_INSTRUCTIONS = [
  { step: 0, op: 'WAIT_MUTEX', label: 'pthread_mutex_lock(&mutex) [FAULT: locked before wait(full)]' },
  { step: 1, op: 'WAIT_FULL', label: 'sem_wait(&full) — blocks while still holding mutex!' },
  { step: 2, op: 'REMOVE_SLOT', label: 'item = buffer[out]' },
  { step: 3, op: 'ADVANCE_OUT', label: 'out = (out + 1) % CAPACITY' },
  { step: 4, op: 'SIGNAL_MUTEX', label: 'pthread_mutex_unlock(&mutex)' },
  { step: 5, op: 'SIGNAL_EMPTY', label: 'sem_post(&empty)' },
  { step: 6, op: 'PROCESS_ITEM', label: 'Process order' },
  { step: 7, op: 'CYCLE_DONE', label: 'Done' },
];

export function createInitialSyncState(options = {}) {
  const capacity = options.capacity || BUFFER_CAPACITY;
  const initialSlots = options.initialSlots ? [...options.initialSlots] : Array(capacity).fill(null);
  const initialOccupancy = initialSlots.filter(Boolean).length;

  return {
    capacity,
    slots: initialSlots,
    in: options.in ?? (initialOccupancy % capacity),
    out: options.out ?? 0,
    occupancy: initialOccupancy,

    // POSIX Semaphores & Mutex
    empty: options.empty ?? (capacity - initialOccupancy),
    full: options.full ?? initialOccupancy,
    mutex: options.mutex ?? 1,
    mutexOwner: options.mutexOwner ?? null,

    // FIFO Wait Queues
    waitQueues: {
      empty: options.waitQueues?.empty ? [...options.waitQueues.empty] : [],
      full: options.waitQueues?.full ? [...options.waitQueues.full] : [],
      mutex: options.waitQueues?.mutex ? [...options.waitQueues.mutex] : [],
    },

    // Thread definitions
    threads: options.threads || {
      P1: {
        id: 'P1',
        name: 'Producer 1 (Student A)',
        role: THREAD_ROLE.PRODUCER,
        pc: 0,
        status: THREAD_STATUS.READY,
        localItem: null,
        waitingFor: null,
        waitingReason: null,
        nextItemNum: 1,
        cyclesCompleted: 0,
        locals: {
          candidateSlot: null,
          candidateItem: null,
          outSnapshot: null,
          inSnapshot: null,
          localItem: null,
        },
      },
      P2: {
        id: 'P2',
        name: 'Producer 2 (Student B)',
        role: THREAD_ROLE.PRODUCER,
        pc: 0,
        status: THREAD_STATUS.READY,
        localItem: null,
        waitingFor: null,
        waitingReason: null,
        nextItemNum: 101,
        cyclesCompleted: 0,
        locals: {
          candidateSlot: null,
          candidateItem: null,
          outSnapshot: null,
          inSnapshot: null,
          localItem: null,
        },
      },
      C1: {
        id: 'C1',
        name: 'Consumer 1 (Kitchen Staff)',
        role: THREAD_ROLE.CONSUMER,
        pc: 0,
        status: THREAD_STATUS.READY,
        localItem: null,
        candidateItem: null,
        claimedItem: null,
        targetSlot: undefined,
        waitingFor: null,
        waitingReason: null,
        cyclesCompleted: 0,
        locals: {
          candidateSlot: null,
          candidateItem: null,
          outSnapshot: null,
          inSnapshot: null,
          localItem: null,
        },
      },
      C2: {
        id: 'C2',
        name: 'Consumer 2 (Kitchen Staff)',
        role: THREAD_ROLE.CONSUMER,
        pc: 0,
        status: THREAD_STATUS.READY,
        localItem: null,
        candidateItem: null,
        claimedItem: null,
        targetSlot: undefined,
        waitingFor: null,
        waitingReason: null,
        cyclesCompleted: 0,
        locals: {
          candidateSlot: null,
          candidateItem: null,
          outSnapshot: null,
          inSnapshot: null,
          localItem: null,
        },
      },
    },

    schedulerMode: options.schedulerMode || 'ROUND_ROBIN', // 'ROUND_ROBIN' | 'MANUAL'
    scheduledThreadId: options.scheduledThreadId || 'P1',
    roundRobinIndex: 0,

    stepCounter: 0,
    events: [],
    producedItems: options.producedItems ? [...options.producedItems] : [],
    consumedItems: options.consumedItems ? [...options.consumedItems] : [],
    acceptedHistory: options.acceptedHistory ? [...options.acceptedHistory] : [],
    processedHistory: options.processedHistory ? [...options.processedHistory] : [],
    pendingReservations: options.pendingReservations || { empty: 0, full: 0 },
    baseline: options.baseline || null,
    pauseRequested: !!options.pauseRequested,

    isDeadlocked: false,
    deadlockReason: null,
    scenarioId: options.scenarioId || 'NORMAL_FLOW',
    useDeadlockConsumer: !!options.useDeadlockConsumer,
    scheduleHistory: options.scheduleHistory ? [...options.scheduleHistory] : [],
    withoutMutex: !!options.withoutMutex,
    useDecomposedBuffer: !!options.useDecomposedBuffer,
    useDecomposedConsumer: !!options.useDecomposedConsumer,
    displacedItems: options.displacedItems ? [...options.displacedItems] : [],
    firstFault: options.firstFault || null,

    // Workload & Multi-Order Backlog State
    useWorkloadQueue: !!options.useWorkloadQueue,
    requestBacklog: options.requestBacklog ? [...options.requestBacklog] : [],
    submittedRequests: options.submittedRequests ? [...options.submittedRequests] : [],
    isKitchenPaused: !!options.isKitchenPaused,
    nextRequestSeq: options.nextRequestSeq ?? 1,
  };
}

/**
 * Get active instructions set for a thread
 */
export function getThreadInstructions(thread, state) {
  if (thread.role === THREAD_ROLE.PRODUCER) {
    if (state?.withoutMutex && state?.useDecomposedBuffer) {
      return DECOMPOSED_PRODUCER_WITHOUT_MUTEX_INSTRUCTIONS;
    }
    if (state?.useDecomposedBuffer) {
      return DECOMPOSED_PRODUCER_WITH_MUTEX_INSTRUCTIONS;
    }
    return PRODUCER_INSTRUCTIONS;
  }
  if (state?.useDecomposedConsumer) {
    if (state?.withoutMutex) {
      return DECOMPOSED_CONSUMER_WITHOUT_MUTEX_INSTRUCTIONS;
    }
    return DECOMPOSED_CONSUMER_WITH_MUTEX_INSTRUCTIONS;
  }
  if (state?.useDeadlockConsumer) {
    return DEADLOCK_CONSUMER_INSTRUCTIONS;
  }
  return CONSUMER_INSTRUCTIONS;
}

/**
 * Record an event into the engine history
 */
function recordEvent(state, type, threadId, message, details = {}) {
  const event = {
    id: `EVT-${state.stepCounter + 1}-${Date.now().toString().slice(-4)}`,
    step: state.stepCounter + 1,
    type,
    threadId,
    message,
    timestamp: new Date().toLocaleTimeString(),
    details: { ...details },
    ...details,
  };
  return [event, ...state.events.slice(0, 49)];
}

/**
 * Helper to get list of runnable thread IDs
 */
export function getRunnableThreadIds(state) {
  return Object.values(state.threads)
    .filter((t) => {
      if (t.status !== THREAD_STATUS.READY && t.status !== THREAD_STATUS.RUNNING) {
        return false;
      }
      // If kitchen is paused, consumer C1 is paused at cycle boundary (pc === 0)
      if (state.isKitchenPaused && t.role === THREAD_ROLE.CONSUMER && t.pc === 0) {
        return false;
      }
      // If in workload mode, producer at pc === 0 with no assigned request and empty backlog is idle
      if (
        state.useWorkloadQueue &&
        t.role === THREAD_ROLE.PRODUCER &&
        t.pc === 0 &&
        !t.assignedRequest &&
        (!state.requestBacklog || state.requestBacklog.length === 0)
      ) {
        return false;
      }
      return true;
    })
    .map((t) => t.id);
}

/**
 * Deterministic Round-Robin scheduler
 */
export function selectNextRunnableThread(state, preferredId = null) {
  const runnable = getRunnableThreadIds(state);
  if (runnable.length === 0) return null;
  if (preferredId && runnable.includes(preferredId)) return preferredId;

  const threadIds = Object.keys(state.threads);
  const startIdx = (state.roundRobinIndex + 1) % threadIds.length;

  for (let i = 0; i < threadIds.length; i++) {
    const candidateId = threadIds[(startIdx + i) % threadIds.length];
    if (runnable.includes(candidateId)) {
      return candidateId;
    }
  }
  return runnable[0];
}

/**
 * Check if the current state is deadlocked
 */
export function checkDeadlock(state) {
  const runnable = getRunnableThreadIds(state);
  if (runnable.length > 0) {
    return { isDeadlocked: false, reason: null };
  }

  // All non-completed threads are blocked
  const activeThreads = Object.values(state.threads).filter(
    (t) => t.status !== THREAD_STATUS.COMPLETED
  );
  if (activeThreads.length === 0) {
    return { isDeadlocked: false, reason: 'All threads completed.' };
  }

  // Detect circular wait / inverted wait dependency
  const hasThreadHoldingMutexWaitingForFull = activeThreads.some(
    (t) => state.mutexOwner === t.id && t.waitingFor === 'full'
  );
  const hasThreadWaitingForMutex = activeThreads.some((t) => t.waitingFor === 'mutex');

  if (hasThreadHoldingMutexWaitingForFull && hasThreadWaitingForMutex) {
    return {
      isDeadlocked: true,
      reason:
        'DEADLOCK: Consumer holds mutex while blocked waiting on full. Producer cannot enter critical section to post full.',
    };
  }

  return { isDeadlocked: false, reason: 'Threads suspended waiting for work.' };
}

/**
 * Single deterministic instruction transition
 */
export function stepSimulation(prevState, requestedThreadId = null, options = {}) {
  if (prevState.isDeadlocked) {
    return prevState;
  }

  // Choose thread to run
  let targetThreadId = requestedThreadId;

  // If requested thread is paused at cycle boundary, guard against execution
  if (targetThreadId && prevState.threads[targetThreadId]) {
    const reqThread = prevState.threads[targetThreadId];
    if (prevState.isKitchenPaused && reqThread.role === THREAD_ROLE.CONSUMER && reqThread.pc === 0) {
      return prevState;
    }
  }

  if (options.strict && targetThreadId) {
    const requestedThread = prevState.threads[targetThreadId];
    if (
      !requestedThread ||
      requestedThread.status === THREAD_STATUS.BLOCKED ||
      requestedThread.status === THREAD_STATUS.COMPLETED
    ) {
      // In strict execution mode, ineligible/blocked thread cannot execute and does not hijack another thread
      return prevState;
    }
  } else if (!targetThreadId || prevState.threads[targetThreadId]?.status === THREAD_STATUS.BLOCKED) {
    targetThreadId = selectNextRunnableThread(prevState, prevState.scheduledThreadId);
  }

  if (!targetThreadId) {
    const deadlockCheck = checkDeadlock(prevState);
    if (deadlockCheck.isDeadlocked) {
      return {
        ...prevState,
        isDeadlocked: true,
        deadlockReason: deadlockCheck.reason,
        events: recordEvent(
          prevState,
          'DEADLOCK_DETECTED',
          'KERNEL',
          deadlockCheck.reason
        ),
      };
    }
    return prevState; // No runnable threads
  }

  const thread = { ...prevState.threads[targetThreadId] };
  const instructions = getThreadInstructions(thread, prevState);
  const currentInstruction = instructions[thread.pc];

  if (!currentInstruction) {
    return prevState;
  }

  // Clone mutable state structures
  const nextSlots = [...prevState.slots];
  const nextDisplacedItems = [...(prevState.displacedItems || [])];
  let nextFirstFault = prevState.firstFault || null;
  const nextWaitQueues = {
    empty: [...prevState.waitQueues.empty],
    full: [...prevState.waitQueues.full],
    mutex: [...prevState.waitQueues.mutex],
  };
  const nextThreads = { ...prevState.threads };
  const nextRequestBacklog = [...(prevState.requestBacklog || [])];
  let nextEmpty = prevState.empty;
  let nextFull = prevState.full;
  let nextMutex = prevState.mutex;
  let nextMutexOwner = prevState.mutexOwner;
  let nextIn = prevState.in;
  let nextOut = prevState.out;
  let nextOccupancy = prevState.occupancy;
  let newEvents = prevState.events;
  const nextProduced = [...prevState.producedItems];
  const nextConsumed = [...prevState.consumedItems];
  const nextAcceptedHistory = [...(prevState.acceptedHistory || [])];
  const nextProcessedHistory = [...(prevState.processedHistory || [])];
  let nextPauseRequested = prevState.pauseRequested || false;

  const op = currentInstruction.op;

  // -------------------------------------------------------------
  // PRODUCER LOGIC
  // -------------------------------------------------------------
  if (thread.role === THREAD_ROLE.PRODUCER) {
    switch (op) {
      case 'CREATE_ITEM': {
        let req = thread.assignedRequest;
        if (!req && nextRequestBacklog.length > 0) {
          req = nextRequestBacklog.shift();
        }

        let item;
        if (req) {
          item = {
            id: req.id,
            name: req.name,
            producerId: thread.id,
            createdStep: prevState.stepCounter + 1,
            submittedStep: req.submittedStep,
          };
          thread.assignedRequest = null;
        } else {
          const itemId = `${thread.id}-ORD-${String(thread.nextItemNum).padStart(3, '0')}`;
          const itemNames = ['Avocado Toast', 'Cold Brew', 'Masala Dosa', 'Paneer Bowl', 'Filter Coffee'];
          const chosenName = itemNames[(thread.nextItemNum - 1) % itemNames.length];
          item = {
            id: itemId,
            name: chosenName,
            producerId: thread.id,
            createdStep: prevState.stepCounter + 1,
          };
          thread.nextItemNum += 1;
        }

        thread.localItem = item;
        thread.pc = 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'ITEM_CREATED',
          thread.id,
          `${thread.name} prepared local order token [${item.id} (${item.name})]`,
          { itemId: item.id }
        );
        break;
      }

      case 'WAIT_EMPTY': {
        if (nextEmpty > 0) {
          nextEmpty -= 1;
          thread.pc = 2;
          thread.status = THREAD_STATUS.READY;
          thread.waitingReason = null;
          thread.waitingFor = null;
          newEvents = recordEvent(
            prevState,
            'PERMIT_ACQUIRED',
            thread.id,
            `${thread.id} successfully acquired empty permit. (empty = ${nextEmpty})`,
            { permit: 'empty', remaining: nextEmpty }
          );
        } else {
          // Block thread
          thread.status = THREAD_STATUS.BLOCKED;
          thread.waitingReason = 'empty';
          thread.waitingFor = 'empty';
          nextWaitQueues.empty.push(thread.id);
          newEvents = recordEvent(
            prevState,
            'THREAD_BLOCKED',
            thread.id,
            `Buffer saturated (empty = 0). ${thread.id} blocked on sem_wait(&empty).`,
            { waitingFor: 'empty' }
          );
        }
        break;
      }

      case 'LOCK':
      case 'WAIT_MUTEX': {
        if (prevState.withoutMutex) {
          thread.pc += 1;
          thread.status = THREAD_STATUS.READY;
          break;
        }
        if (nextMutex === 1) {
          nextMutex = 0;
          nextMutexOwner = thread.id;
          thread.pc = prevState.useDecomposedBuffer ? thread.pc + 1 : 3;
          thread.status = THREAD_STATUS.READY;
          thread.waitingReason = null;
          thread.waitingFor = null;
          newEvents = recordEvent(
            prevState,
            'MUTEX_ACQUIRED',
            thread.id,
            `${thread.id} acquired mutex lock and entered critical section.`,
            { owner: thread.id }
          );
        } else {
          // Block on mutex
          thread.status = THREAD_STATUS.BLOCKED;
          thread.waitingReason = 'mutex';
          thread.waitingFor = 'mutex';
          nextWaitQueues.mutex.push(thread.id);
          newEvents = recordEvent(
            prevState,
            'THREAD_BLOCKED',
            thread.id,
            `Mutex is locked by ${nextMutexOwner}. ${thread.id} blocked on pthread_mutex_lock(&mutex).`,
            { waitingFor: 'mutex', owner: nextMutexOwner }
          );
        }
        break;
      }

      case 'READ_IN': {
        thread.targetSlot = nextIn;
        thread.locals = thread.locals || {};
        thread.locals.inSnapshot = nextIn;
        thread.locals.candidateSlot = nextIn;
        thread.readInStep = prevState.stepCounter + 1;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'READ_POINTER',
          thread.id,
          `${thread.id} read shared IN pointer (${nextIn}) into thread-local target register.`,
          { targetSlot: nextIn, pointer: 'IN' }
        );
        break;
      }

      case 'WRITE_SLOT': {
        const targetSlot = thread.targetSlot ?? nextIn;
        const isOccupied = nextSlots[targetSlot] !== null;

        if (isOccupied) {
          // Unsafe collision: slot is already occupied!
          const displaced = nextSlots[targetSlot];
          nextDisplacedItems.push({
            item: displaced,
            displacedItem: displaced,
            slotIndex: targetSlot,
            overwrittenBy: thread.localItem,
            culpritThreadId: thread.id,
            step: prevState.stepCounter + 1,
            staleReadStep: thread.readInStep,
          });
          nextFirstFault = nextFirstFault || {
            step: prevState.stepCounter + 1,
            type: 'SLOT_OVERWRITTEN',
            slotIndex: targetSlot,
            displacedItem: displaced,
            culpritItem: thread.localItem,
            culpritThreadId: thread.id,
            staleReadStep: thread.readInStep,
            explanation: `Collision Fault: ${thread.id} wrote ${thread.localItem?.id} into slot ${targetSlot} using stale target index read at step #${thread.readInStep}. Earlier order ${displaced.id} was overwritten!`,
          };
          newEvents = recordEvent(
            prevState,
            'ITEM_OVERWRITTEN',
            thread.id,
            `RACE OVERWRITE: ${thread.id} inserted ${thread.localItem?.id} into slot [${targetSlot}], overwriting previous order ${displaced.id}!`,
            {
              slotIndex: targetSlot,
              itemId: thread.localItem?.id,
              displacedItemId: displaced.id,
              staleReadStep: thread.readInStep,
              isFault: true,
            }
          );
        } else {
          nextOccupancy += 1;
          newEvents = recordEvent(
            prevState,
            'ITEM_INSERTED',
            thread.id,
            `${thread.id} inserted ${thread.localItem?.id} into buffer slot [${targetSlot}]. Occupancy = ${nextOccupancy}/5`,
            { slotIndex: targetSlot, itemId: thread.localItem?.id }
          );
        }

        nextSlots[targetSlot] = {
          ...thread.localItem,
          slotIndex: targetSlot,
          insertedStep: prevState.stepCounter + 1,
        };
        nextProduced.push(thread.localItem.id);
        thread.localItem = null;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        break;
      }

      case 'INSERT_SLOT': {
        if (!prevState.withoutMutex && nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to insert item without holding mutex!`);
        }
        if (nextSlots[nextIn] !== null) {
          throw new Error(`Buffer slot ${nextIn} is already occupied! Overwrite detected!`);
        }
        nextSlots[nextIn] = {
          ...thread.localItem,
          slotIndex: nextIn,
          insertedStep: prevState.stepCounter + 1,
        };
        nextOccupancy += 1;
        nextProduced.push(thread.localItem.id);
        const insertedId = thread.localItem.id;
        thread.localItem = null;
        thread.pc = 4;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'ITEM_INSERTED',
          thread.id,
          `${thread.id} inserted ${insertedId} into buffer slot [${nextIn}]. Occupancy = ${nextOccupancy}/5`,
          { slotIndex: nextIn, itemId: insertedId }
        );
        break;
      }

      case 'UPDATE_IN':
      case 'ADVANCE_IN': {
        if (!prevState.withoutMutex && !prevState.useDecomposedBuffer && nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to advance IN without holding mutex!`);
        }
        if (prevState.useDecomposedBuffer && !prevState.withoutMutex && nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to advance IN without holding mutex!`);
        }
        const prevIn = nextIn;
        const snap = (prevState.useDecomposedBuffer && prevState.withoutMutex && thread.locals?.inSnapshot !== undefined)
          ? thread.locals.inSnapshot
          : nextIn;
        nextIn = (snap + 1) % prevState.capacity;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'POINTER_ADVANCED',
          thread.id,
          `${thread.id} advanced IN pointer: (${prevIn} + 1) % ${prevState.capacity} → ${nextIn}`,
          { pointer: 'IN', from: prevIn, to: nextIn }
        );
        break;
      }

      case 'UNLOCK':
      case 'SIGNAL_MUTEX': {
        if (nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to unlock mutex but does not own it!`);
        }
        thread.pc = prevState.useDecomposedBuffer ? 7 : 6;
        thread.status = THREAD_STATUS.READY;

        if (nextWaitQueues.mutex.length > 0) {
          const wokenId = nextWaitQueues.mutex.shift();
          const wokenThread = { ...nextThreads[wokenId] };
          wokenThread.status = THREAD_STATUS.READY;
          wokenThread.waitingFor = null;
          wokenThread.waitingReason = null;
          // Direct handover of mutex lock to oldest waiting thread
          nextMutexOwner = wokenId;
          nextMutex = 0;
          // Advance woken thread's PC past WAIT_MUTEX
          wokenThread.pc += 1;
          nextThreads[wokenId] = wokenThread;

          newEvents = recordEvent(
            prevState,
            'MUTEX_TRANSFERRED',
            thread.id,
            `${thread.id} released mutex. Ownership directly transferred to waiting thread ${wokenId}.`,
            { transferredTo: wokenId }
          );
        } else {
          nextMutex = 1;
          nextMutexOwner = null;
          newEvents = recordEvent(
            prevState,
            'MUTEX_RELEASED',
            thread.id,
            `${thread.id} released mutex. Mutex lock is now FREE (1).`,
            { owner: null }
          );
        }
        break;
      }

      case 'SIGNAL_FULL': {
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;

        if (nextWaitQueues.full.length > 0) {
          // Direct permit transfer to oldest waiting consumer
          const wokenId = nextWaitQueues.full.shift();
          const wokenThread = { ...nextThreads[wokenId] };
          wokenThread.status = THREAD_STATUS.READY;
          wokenThread.waitingFor = null;
          wokenThread.waitingReason = null;
          wokenThread.pc += 1; // Wait succeeded!
          nextThreads[wokenId] = wokenThread;

          newEvents = recordEvent(
            prevState,
            'THREAD_RESUMED',
            thread.id,
            `${thread.id} signaled sem_post(&full). Permit handed directly to waiting consumer ${wokenId}.`,
            { wokenThreadId: wokenId, permit: 'full' }
          );
        } else {
          nextFull += 1;
          newEvents = recordEvent(
            prevState,
            'PERMIT_SIGNALED',
            thread.id,
            `${thread.id} signaled sem_post(&full). (full = ${nextFull})`,
            { permit: 'full', count: nextFull }
          );
        }
        break;
      }

      case 'CYCLE_DONE': {
        thread.cyclesCompleted += 1;
        thread.pc = 0;
        thread.status = THREAD_STATUS.READY;

        // If in workload mode and backlog has orders, assign next order immediately
        if (nextRequestBacklog.length > 0) {
          thread.assignedRequest = nextRequestBacklog.shift();
        }

        newEvents = recordEvent(
          prevState,
          'CYCLE_COMPLETED',
          thread.id,
          `${thread.id} completed full production cycle (#${thread.cyclesCompleted}). Ready for next iteration.`
        );
        break;
      }

      default:
        break;
    }
  }

  // -------------------------------------------------------------
  // CONSUMER LOGIC
  // -------------------------------------------------------------
  if (thread.role === THREAD_ROLE.CONSUMER) {
    switch (op) {
      case 'WAIT_FULL': {
        if (nextFull > 0) {
          nextFull -= 1;
          thread.pc = 1;
          thread.status = THREAD_STATUS.READY;
          thread.waitingReason = null;
          thread.waitingFor = null;
          newEvents = recordEvent(
            prevState,
            'PERMIT_ACQUIRED',
            thread.id,
            `${thread.id} successfully acquired full permit. (full = ${nextFull})`,
            { permit: 'full', remaining: nextFull }
          );
        } else {
          // Block consumer
          thread.status = THREAD_STATUS.BLOCKED;
          thread.waitingReason = 'full';
          thread.waitingFor = 'full';
          nextWaitQueues.full.push(thread.id);
          newEvents = recordEvent(
            prevState,
            'THREAD_BLOCKED',
            thread.id,
            `Buffer empty (full = 0). ${thread.id} blocked on sem_wait(&full).`,
            { waitingFor: 'full' }
          );
        }
        break;
      }

      case 'READ_OUT': {
        thread.locals = thread.locals || {};
        thread.locals.outSnapshot = nextOut;
        thread.locals.candidateSlot = nextOut;
        thread.targetSlot = nextOut;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'READ_OUT',
          thread.id,
          `${thread.id} read shared OUT pointer = ${nextOut} into local targetSlot register.`,
          { targetSlot: nextOut, outSnapshot: nextOut }
        );
        break;
      }

      case 'READ_ITEM':
      case 'READ_TICKET': {
        const slotIdx = (thread.locals?.candidateSlot !== undefined)
          ? thread.locals.candidateSlot
          : (thread.targetSlot !== undefined ? thread.targetSlot : nextOut);
        const candidate = nextSlots[slotIdx];
        thread.locals = thread.locals || {};
        thread.locals.candidateItem = candidate;
        thread.candidateItem = candidate;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'READ_ITEM',
          thread.id,
          `${thread.id} read ticket from slot [${slotIdx}]: ${candidate ? candidate.id : 'empty'}.`,
          { slotIndex: slotIdx, candidateId: candidate?.id }
        );
        break;
      }

      case 'COMMIT_CLAIM':
      case 'CLAIM_TICKET': {
        const targetSlot = (thread.locals?.candidateSlot !== undefined)
          ? thread.locals.candidateSlot
          : (thread.targetSlot !== undefined ? thread.targetSlot : nextOut);
        const candidate = thread.locals?.candidateItem || thread.candidateItem || nextSlots[targetSlot];
        const candidateId = candidate?.id;

        // Detect race condition in unprotected setting
        if (prevState.withoutMutex) {
          const alreadyClaimed = candidateId && (nextAcceptedHistory.includes(candidateId) || nextConsumed.includes(candidateId));

          if (alreadyClaimed) {
            const faultMsg = `RACE FAULT: ${thread.id} attempted duplicate claim on ticket ${candidateId} from Slot ${targetSlot}! Another staff member already claimed it because both read OUT=${targetSlot} without mutex protection.`;
            nextFirstFault = nextFirstFault || {
              type: 'DUPLICATE_CLAIM_FAULT',
              invariant: 'DUPLICATE_PICKUP',
              step: prevState.stepCounter + 1,
              threadId: thread.id,
              slotIndex: targetSlot,
              ticketId: candidateId,
              candidateId,
              message: faultMsg,
            };
            nextPauseRequested = true;
            newEvents = recordEvent(
              { ...prevState, events: newEvents },
              'RACE_FAULT',
              thread.id,
              faultMsg,
              { slotIndex: targetSlot, candidateId, faultType: 'DUPLICATE_CLAIM_FAULT', isFault: true }
            );
          }
        } else if (nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to claim ticket without holding mutex!`);
        }

        const claimed = candidate || nextSlots[targetSlot];
        if (claimed) {
          nextAcceptedHistory.push(claimed.id);
        }
        if (nextSlots[targetSlot]) {
          nextSlots[targetSlot] = null;
          nextOccupancy -= 1;
        }
        thread.locals = thread.locals || {};
        thread.locals.localItem = claimed;
        thread.localItem = claimed;
        thread.pc += 1;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          { ...prevState, events: newEvents },
          'ITEM_REMOVED',
          thread.id,
          `${thread.id} accepted ticket ${claimed ? claimed.id : 'order'} from slot [${targetSlot}]. Occupancy = ${nextOccupancy}/5`,
          { slotIndex: targetSlot, itemId: claimed?.id }
        );
        break;
      }

      case 'LOCK':
      case 'WAIT_MUTEX': {
        if (prevState.withoutMutex) {
          thread.pc += 1;
          thread.status = THREAD_STATUS.READY;
          break;
        }
        if (nextMutex === 1) {
          nextMutex = 0;
          nextMutexOwner = thread.id;
          thread.pc += 1;
          thread.status = THREAD_STATUS.READY;
          thread.waitingReason = null;
          thread.waitingFor = null;
          newEvents = recordEvent(
            prevState,
            'MUTEX_ACQUIRED',
            thread.id,
            `${thread.id} acquired mutex lock and entered critical section.`,
            { owner: thread.id }
          );
        } else {
          thread.status = THREAD_STATUS.BLOCKED;
          thread.waitingReason = 'mutex';
          thread.waitingFor = 'mutex';
          nextWaitQueues.mutex.push(thread.id);
          newEvents = recordEvent(
            prevState,
            'THREAD_BLOCKED',
            thread.id,
            `Mutex locked by ${nextMutexOwner}. ${thread.id} blocked waiting for mutex.`,
            { waitingFor: 'mutex', owner: nextMutexOwner }
          );
        }
        break;
      }

      case 'REMOVE_SLOT': {
        if (nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to remove item without holding mutex!`);
        }
        if (nextSlots[nextOut] === null) {
          throw new Error(`Buffer slot ${nextOut} is empty! Invalid removal attempt!`);
        }
        const removedItem = nextSlots[nextOut];
        nextSlots[nextOut] = null;
        nextOccupancy -= 1;
        thread.localItem = removedItem;
        nextAcceptedHistory.push(removedItem.id);
        nextConsumed.push(removedItem.id);

        thread.pc = prevState.useDeadlockConsumer ? 3 : 3;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'ITEM_REMOVED',
          thread.id,
          `${thread.id} extracted ${removedItem.id} from slot [${nextOut}]. Occupancy = ${nextOccupancy}/5`,
          { slotIndex: nextOut, itemId: removedItem.id }
        );
        break;
      }

      case 'UPDATE_OUT':
      case 'ADVANCE_OUT': {
        if (!prevState.withoutMutex && nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to advance OUT without holding mutex!`);
        }
        const prevOut = nextOut;
        const snap = (prevState.useDecomposedConsumer && prevState.withoutMutex && thread.locals?.outSnapshot !== undefined)
          ? thread.locals.outSnapshot
          : nextOut;
        nextOut = (snap + 1) % prevState.capacity;
        thread.pc = prevState.useDecomposedConsumer ? thread.pc + 1 : 4;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'POINTER_ADVANCED',
          thread.id,
          `${thread.id} advanced OUT pointer: (${prevOut} + 1) % ${prevState.capacity} → ${nextOut}`,
          { pointer: 'OUT', from: prevOut, to: nextOut }
        );
        break;
      }

      case 'UNLOCK':
      case 'SIGNAL_MUTEX': {
        if (nextMutexOwner !== thread.id) {
          throw new Error(`Thread ${thread.id} attempted to unlock mutex but does not own it!`);
        }
        thread.pc = prevState.useDecomposedConsumer ? thread.pc + 1 : 5;
        thread.status = THREAD_STATUS.READY;

        newEvents = recordEvent(
          prevState,
          'MUTEX_RELEASED',
          thread.id,
          `${thread.id} released mutex. Mutex lock is now FREE (1).`,
          { owner: null, releasedBy: thread.id }
        );

        if (nextWaitQueues.mutex.length > 0) {
          const wokenId = nextWaitQueues.mutex.shift();
          const wokenThread = { ...nextThreads[wokenId] };
          wokenThread.status = THREAD_STATUS.READY;
          wokenThread.waitingFor = null;
          wokenThread.waitingReason = null;
          nextMutexOwner = wokenId;
          nextMutex = 0;
          wokenThread.pc += 1;
          nextThreads[wokenId] = wokenThread;

          newEvents = recordEvent(
            prevState,
            'MUTEX_TRANSFERRED',
            thread.id,
            `${thread.id} released mutex. Ownership directly transferred to waiting thread ${wokenId}.`,
            { transferredTo: wokenId }
          );
        } else {
          nextMutex = 1;
          nextMutexOwner = null;
        }
        break;
      }

      case 'SIGNAL_EMPTY': {
        thread.pc = prevState.useDecomposedConsumer ? thread.pc + 1 : 6;
        thread.status = THREAD_STATUS.READY;

        newEvents = recordEvent(
          prevState,
          'PERMIT_SIGNALED',
          thread.id,
          `${thread.id} signaled sem_post(&empty).`,
          { permit: 'empty' }
        );

        if (nextWaitQueues.empty.length > 0) {
          const wokenId = nextWaitQueues.empty.shift();
          const wokenThread = { ...nextThreads[wokenId] };
          wokenThread.status = THREAD_STATUS.READY;
          wokenThread.waitingFor = null;
          wokenThread.waitingReason = null;
          wokenThread.pc += 1; // Wait succeeded!
          nextThreads[wokenId] = wokenThread;

          newEvents = recordEvent(
            prevState,
            'THREAD_RESUMED',
            thread.id,
            `${thread.id} signaled sem_post(&empty). Permit handed directly to waiting producer ${wokenId}.`,
            { wokenThreadId: wokenId, permit: 'empty' }
          );
        } else {
          nextEmpty += 1;
        }
        break;
      }

      case 'PROCESS':
      case 'PROCESS_ITEM': {
        const item = thread.locals?.localItem || thread.locals?.candidateItem || thread.localItem;
        if (item) {
          nextProcessedHistory.push(item.id);
          if (prevState.useDecomposedConsumer && !nextConsumed.includes(item.id)) {
            nextConsumed.push(item.id);
          }
        }
        thread.localItem = null;
        if (thread.locals) {
          thread.locals.localItem = null;
        }
        if (prevState.useDecomposedConsumer) {
          thread.pc = (thread.pc + 1 >= getThreadInstructions(thread, prevState).length) ? 0 : thread.pc + 1;
          if (thread.pc === 0) {
            thread.cyclesCompleted += 1;
          }
        } else {
          thread.pc = 7;
        }
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'ITEM_PROCESSED',
          thread.id,
          `${thread.id} processed order ${item?.id || 'token'} outside critical section.`
        );
        break;
      }

      case 'CYCLE_DONE': {
        thread.cyclesCompleted += 1;
        thread.pc = 0;
        thread.candidateItem = null;
        thread.targetSlot = undefined;
        thread.status = THREAD_STATUS.READY;
        newEvents = recordEvent(
          prevState,
          'CYCLE_COMPLETED',
          thread.id,
          `${thread.id} completed full consumption cycle (#${thread.cyclesCompleted}). Ready for next iteration.`
        );
        break;
      }

      default:
        break;
    }
  }

  nextThreads[thread.id] = thread;

  // Compute next scheduled thread
  const threadKeys = Object.keys(nextThreads);
  const nextRoundRobinIndex = (prevState.roundRobinIndex + 1) % threadKeys.length;
  const nextScheduledId = selectNextRunnableThread(
    {
      ...prevState,
      threads: nextThreads,
      roundRobinIndex: nextRoundRobinIndex,
    },
    null
  );

  const intermediateState = {
    ...prevState,
    slots: nextSlots,
    in: nextIn,
    out: nextOut,
    occupancy: nextOccupancy,
    empty: nextEmpty,
    full: nextFull,
    mutex: nextMutex,
    mutexOwner: nextMutexOwner,
    waitQueues: nextWaitQueues,
    threads: nextThreads,
    roundRobinIndex: nextRoundRobinIndex,
    scheduledThreadId: nextScheduledId,
    stepCounter: prevState.stepCounter + 1,
    events: newEvents,
    producedItems: nextProduced,
    consumedItems: nextConsumed,
    acceptedHistory: nextAcceptedHistory,
    processedHistory: nextProcessedHistory,
    pauseRequested: nextPauseRequested,
    displacedItems: nextDisplacedItems,
    firstFault: nextFirstFault,
    scheduleHistory: [...(prevState.scheduleHistory || []), targetThreadId],
    requestBacklog: nextRequestBacklog,
  };

  const deadlockResult = checkDeadlock(intermediateState);
  if (deadlockResult.isDeadlocked) {
    return {
      ...intermediateState,
      isDeadlocked: true,
      deadlockReason: deadlockResult.reason,
      events: recordEvent(
        intermediateState,
        'DEADLOCK_DETECTED',
        'KERNEL',
        deadlockResult.reason
      ),
    };
  }

  return intermediateState;
}

/**
 * Invariant Validation Checker
 *
 * Verifies bounded buffer invariants without falsifying intermediate states:
 * 1. Occupancy is between 0 and CAPACITY.
 * 2. Actual slot count matches occupancy.
 * 3. Mutex is either 0 (with exactly 1 owner) or 1 (with null owner).
 * 4. Slots are never overwritten or read out-of-order.
 * 5. Blocked threads are recorded in their respective wait queues.
 */
export function validateInvariants(state) {
  const violations = [];

  if (state.occupancy < 0 || state.occupancy > state.capacity) {
    violations.push(`Occupancy out of bounds: ${state.occupancy} (capacity = ${state.capacity})`);
  }

  const actualOccupied = state.slots.filter(Boolean).length;
  if (actualOccupied !== state.occupancy) {
    violations.push(`Occupancy count mismatch: declared ${state.occupancy}, actual ${actualOccupied}`);
  }

  if (state.mutex === 1 && state.mutexOwner !== null) {
    violations.push(`Mutex is marked free (1) but has owner ${state.mutexOwner}`);
  }

  if (state.mutex === 0 && state.mutexOwner === null) {
    violations.push('Mutex is marked locked (0) but has no registered owner');
  }

  if (state.in < 0 || state.in >= state.capacity) {
    violations.push(`IN pointer ${state.in} out of bounds [0, ${state.capacity - 1}]`);
  }

  if (state.out < 0 || state.out >= state.capacity) {
    violations.push(`OUT pointer ${state.out} out of bounds [0, ${state.capacity - 1}]`);
  }

  for (const [id, thread] of Object.entries(state.threads)) {
    if (thread.status === THREAD_STATUS.BLOCKED) {
      const queue = state.waitQueues[thread.waitingFor];
      if (!queue || !queue.includes(id)) {
        violations.push(`Blocked thread ${id} waiting on ${thread.waitingFor} is not in waitQueue`);
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Stage 2 Canonical Invariants Evaluator
 * Evaluates:
 * - DUPLICATE_PICKUP (Second committed acceptance of one ticket)
 * - LOST_ORDER (Unconsumed buffered ticket overwritten)
 * - PERMIT_MISMATCH (Reservation/publication-aware count equality at settled boundaries)
 * - POINTER_LAG (Account for offsets and pending pointer updates)
 * - MUTUAL_EXCLUSION_BROKEN (Validate protected access and ownership)
 * - Progress State (Completed, Waiting, Paused, Blocked, Deadlock)
 */
export function evaluateSimulationInvariants(state) {
  const violations = [];
  const warnings = [];

  // 1. DUPLICATE_PICKUP: Second committed acceptance of one ticket
  if (state.acceptedHistory && state.acceptedHistory.length > 0) {
    const counts = {};
    for (const id of state.acceptedHistory) {
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > 1) {
        violations.push({
          type: 'DUPLICATE_PICKUP',
          ticketId: id,
          count: counts[id],
          message: `DUPLICATE_PICKUP: Ticket ${id} committed for acceptance ${counts[id]} times!`,
        });
      }
    }
  }

  // 2. LOST_ORDER: Unconsumed buffered ticket overwritten
  if (state.displacedItems && state.displacedItems.length > 0) {
    for (const d of state.displacedItems) {
      violations.push({
        type: 'LOST_ORDER',
        ticketId: d.item?.id || d.displacedItem?.id,
        slotIndex: d.slotIndex,
        overwrittenBy: d.overwrittenBy?.id,
        message: `LOST_ORDER: Ticket ${d.item?.id || d.displacedItem?.id} was overwritten before being consumed!`,
      });
    }
  }

  // 3. PERMIT_MISMATCH: Evaluated at settled boundary
  const actualOccupied = (state.slots || []).filter(Boolean).length;
  const activeThreads = Object.values(state.threads || {}).filter(
    (t) => t.status === THREAD_STATUS.RUNNING || (t.pc > 0 && t.status === THREAD_STATUS.READY)
  );
  const isSettled = activeThreads.length === 0;

  if (isSettled && !state.withoutMutex) {
    if (state.empty + state.full !== state.capacity) {
      violations.push({
        type: 'PERMIT_MISMATCH',
        message: `PERMIT_MISMATCH: Semaphore sum (empty=${state.empty} + full=${state.full}) !== capacity (${state.capacity}) at settled boundary!`,
      });
    }
    if (state.capacity - actualOccupied !== state.empty) {
      violations.push({
        type: 'PERMIT_MISMATCH',
        message: `PERMIT_MISMATCH: Empty permits (${state.empty}) !== empty buffer slots (${state.capacity - actualOccupied}) at settled boundary!`,
      });
    }
  } else if (isSettled && state.withoutMutex) {
    if (state.capacity - actualOccupied !== state.empty) {
      warnings.push({
        type: 'PERMIT_MISMATCH',
        message: `PERMIT_MISMATCH (Unsafe Drift): Empty permits (${state.empty}) do not match actual empty buffer slots (${state.capacity - actualOccupied}).`,
      });
    }
  }

  // 4. POINTER_LAG & Bounds
  if (state.in < 0 || state.in >= state.capacity) {
    violations.push({
      type: 'POINTER_OUT_OF_BOUNDS',
      message: `IN pointer (${state.in}) is out of bounds [0, ${state.capacity - 1}].`,
    });
  }
  if (state.out < 0 || state.out >= state.capacity) {
    violations.push({
      type: 'POINTER_OUT_OF_BOUNDS',
      message: `OUT pointer (${state.out}) is out of bounds [0, ${state.capacity - 1}].`,
    });
  }

  // 5. MUTUAL_EXCLUSION_BROKEN: Validate protected access and ownership
  if (!state.withoutMutex) {
    if (state.mutex === 1 && state.mutexOwner !== null) {
      violations.push({
        type: 'MUTUAL_EXCLUSION_BROKEN',
        message: `MUTUAL_EXCLUSION_BROKEN: Mutex is free (1) but has registered owner ${state.mutexOwner}.`,
      });
    }
    if (state.mutex === 0 && state.mutexOwner === null) {
      violations.push({
        type: 'MUTUAL_EXCLUSION_BROKEN',
        message: 'MUTUAL_EXCLUSION_BROKEN: Mutex is locked (0) but has no registered owner.',
      });
    }
  }

  // 6. PROGRESS Classification
  const deadlock = checkDeadlock(state);
  let progressState = 'READY';
  if (deadlock.isDeadlocked) {
    progressState = 'DEADLOCK';
  } else if (state.pauseRequested) {
    progressState = 'PAUSED';
  } else if (isSettled) {
    progressState = 'COMPLETED';
  } else if (getRunnableThreadIds(state).length === 0) {
    progressState = 'BLOCKED';
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    progressState,
    isSettled,
  };
}

/**
 * Scenario Initializers
 */
export const SCENARIOS = {
  NORMAL_FLOW: {
    id: 'NORMAL_FLOW',
    name: 'Scenario A: Normal Flow',
    objective: 'Producers insert items while consumer processes them in FIFO order under mutex protection.',
    description: 'Producers prepare items, acquire empty & mutex permits, insert into circular buffer, and post full.',
    observations: [
      'Producer prepares local order token in its private register.',
      'Producer decrements empty permit and acquires the binary mutex lock.',
      'Item is placed at slots[in], and in pointer increments: (in + 1) % 5.',
      'Mutex is unlocked and full semaphore is signaled (full++).',
      'Consumer waits on full, acquires mutex, consumes at slots[out], and signals empty.',
    ],
    checkCompletion: (state) => {
      const isComplete = state.producedItems.length >= 1 && state.consumedItems.length >= 1;
      return {
        isComplete,
        summary: isComplete
          ? 'Completed: At least 1 item was safely produced and consumed under mutex protection.'
          : `In Progress: Produced ${state.producedItems.length}, Consumed ${state.consumedItems.length}.`,
      };
    },
    setup: () => createInitialSyncState({ scenarioId: 'NORMAL_FLOW' }),
  },
  BUFFER_FULL: {
    id: 'BUFFER_FULL',
    name: 'Scenario B: Buffer Full Saturated',
    objective: 'Fill all 5 slots. Observe producer block on sem_wait(&empty). Consumer then frees a slot.',
    description: 'Buffer starts with 4 items. P1 produces 5th item, filling buffer. P2 tries 6th item and suspends.',
    observations: [
      'Initial state has 4 items in buffer with empty = 1 and in = 4.',
      'P1 completes a production cycle, filling all 5 slots (occupancy = 5, empty = 0).',
      'P2 attempts sem_wait(&empty) and suspends with status BLOCKED in waitQueues.empty.',
      'C1 consumes an order from slot 0 and signals sem_post(&empty).',
      'P2 is directly woken up (status READY) with permit transfer and resumes execution.',
    ],
    checkCompletion: (state) => {
      const hasBlocked = state.events.some(
        (e) => e.type === 'THREAD_BLOCKED' && e.details?.waitingFor === 'empty'
      );
      const hasResumed = state.events.some(
        (e) => e.type === 'THREAD_RESUMED' && e.details?.permit === 'empty'
      );
      const isComplete = hasBlocked && hasResumed;
      return {
        isComplete,
        summary: isComplete
          ? 'Completed: Producer successfully blocked on full buffer and resumed when consumer freed capacity.'
          : hasBlocked
            ? 'Producer is BLOCKED waiting on empty. Step consumer C1 to release capacity!'
            : 'Step producer P1 to fill the buffer, then step P2 to demonstrate blocking.',
      };
    },
    setup: () => {
      // 4 pre-filled slots
      const prefilledSlots = [
        { id: 'INIT-ORD-01', name: 'Avocado Toast', slotIndex: 0, producerId: 'P1' },
        { id: 'INIT-ORD-02', name: 'Cold Brew', slotIndex: 1, producerId: 'P1' },
        { id: 'INIT-ORD-03', name: 'Masala Dosa', slotIndex: 2, producerId: 'P2' },
        { id: 'INIT-ORD-04', name: 'Paneer Bowl', slotIndex: 3, producerId: 'P2' },
        null,
      ];
      return createInitialSyncState({
        scenarioId: 'BUFFER_FULL',
        initialSlots: prefilledSlots,
        in: 4,
        out: 0,
        empty: 1,
        full: 4,
        mutex: 1,
      });
    },
  },
  BUFFER_EMPTY: {
    id: 'BUFFER_EMPTY',
    name: 'Scenario C: Buffer Empty Blocking',
    objective: 'Start with 0 items. Consumer attempts to take and blocks on sem_wait(&full). Producer then wakes it.',
    description: 'C1 executes first, sees full = 0, and suspends in waitQueue. P1 then produces and wakes C1 directly.',
    observations: [
      'Initial state has empty = 5, full = 0, and 0 orders in slots.',
      'Consumer C1 calls sem_wait(&full) and suspends with status BLOCKED.',
      'C1 enters waitQueues.full without busy-looping.',
      'Producer P1 creates and publishes an order, calling sem_post(&full).',
      'C1 receives the permit directly and transitions back to READY to enter critical section.',
    ],
    checkCompletion: (state) => {
      const hasBlocked = state.events.some(
        (e) => e.type === 'THREAD_BLOCKED' && e.details?.waitingFor === 'full'
      );
      const hasResumed = state.events.some(
        (e) => e.type === 'THREAD_RESUMED' && e.details?.permit === 'full'
      );
      const isComplete = hasBlocked && hasResumed;
      return {
        isComplete,
        summary: isComplete
          ? 'Completed: Consumer blocked on empty queue and successfully resumed when order was posted.'
          : hasBlocked
            ? 'Consumer is BLOCKED waiting on full. Step producer P1 to produce an order!'
            : 'Step consumer C1 to demonstrate blocking on empty buffer.',
      };
    },
    setup: () => {
      const state = createInitialSyncState({ scenarioId: 'BUFFER_EMPTY' });
      state.scheduledThreadId = 'C1';
      return state;
    },
  },
  CIRCULAR_WRAP: {
    id: 'CIRCULAR_WRAP',
    name: 'Scenario D: Circular Wraparound',
    objective: 'Demonstrate pointer arithmetic in = (in + 1) % 5 and out = (out + 1) % 5 crossing slot 4 to 0.',
    description: 'Pointers start at slot 4. Consecutive production and consumption demonstrate smooth wraparound.',
    observations: [
      'Initial state has out = 4 pointing to slot 4, and in = 0.',
      'Consumer extracts item from slot 4; pointer updates: (4 + 1) % 5 = 0.',
      'Producer inserts into slot 0, advancing in to 1.',
      'FIFO sequence is strictly maintained across the boundary.',
    ],
    checkCompletion: (state) => {
      const hasWrapped = state.events.some(
        (e) => e.type === 'POINTER_ADVANCED' && e.details?.from === 4 && e.details?.to === 0
      );
      return {
        isComplete: hasWrapped,
        summary: hasWrapped
          ? 'Completed: Successfully demonstrated pointer wraparound (slot 4 → slot 0) with FIFO integrity.'
          : 'Step consumer C1 to consume slot 4 and observe out pointer wrap to 0.',
      };
    },
    setup: () => {
      const prefilled = [
        null,
        null,
        null,
        null,
        { id: 'WRAP-ORD-01', name: 'Filter Coffee', slotIndex: 4, producerId: 'P1' },
      ];
      return createInitialSyncState({
        scenarioId: 'CIRCULAR_WRAP',
        initialSlots: prefilled,
        in: 0,
        out: 4,
        empty: 4,
        full: 1,
        mutex: 1,
      });
    },
  },
  DEADLOCK_DEMO: {
    id: 'DEADLOCK_DEMO',
    name: 'Scenario E: Deadlock Demonstration',
    objective: 'Demonstrate deadlock when consumer locks mutex before waiting on full with an empty buffer.',
    description: 'Faulty consumer locks mutex, then blocks on empty buffer. Producer cannot enter critical section.',
    observations: [
      'Faulty consumer inverts lock order: pthread_mutex_lock(&mutex) is called before sem_wait(&full).',
      'Because buffer is empty (full = 0), consumer blocks while holding the mutex lock.',
      'Producer P1 calls sem_wait(&empty) (succeeds) and then calls pthread_mutex_lock(&mutex).',
      'P1 blocks on mutex because C1 holds it. C1 cannot proceed because P1 cannot post full.',
      'Mutual Circular Wait: System halts in confirmed Deadlock state.',
    ],
    checkCompletion: (state) => {
      const isComplete = state.isDeadlocked === true;
      return {
        isComplete,
        summary: isComplete
          ? 'Completed: System entered deadlock due to inverted locking order holding mutex during wait(full).'
          : 'Step C1 to lock mutex and block on full, then step P1 to observe deadlock.',
      };
    },
    setup: () => {
      const state = createInitialSyncState({
        scenarioId: 'DEADLOCK_DEMO',
        useDeadlockConsumer: true,
        threads: {
          P1: {
            id: 'P1',
            name: 'Producer 1 (Student)',
            role: THREAD_ROLE.PRODUCER,
            pc: 0,
            status: THREAD_STATUS.READY,
            localItem: null,
            waitingFor: null,
            nextItemNum: 1,
            cyclesCompleted: 0,
          },
          C1: {
            id: 'C1',
            name: 'Consumer 1 (Faulty Kitchen)',
            role: THREAD_ROLE.CONSUMER,
            pc: 0,
            status: THREAD_STATUS.READY,
            localItem: null,
            waitingFor: null,
            cyclesCompleted: 0,
          },
        },
      });
      state.scheduledThreadId = 'C1';
      return state;
    },
  },
};

/**
 * Guided Demonstration Chapters for Presentation Mode
 */
export const GUIDED_CHAPTERS = [
  {
    chapter: 1,
    title: '1. Produce One Order',
    objective: 'Student P1 prepares an order, decrements empty (5 → 4), acquires mutex, inserts tray into Bay 0, and signals full (0 → 1).',
    scenarioId: 'NORMAL_FLOW',
    targetSteps: 7,
    keyObservation: 'Notice how the order token is created in local register memory first, then placed into Bay 0 under mutex lock.',
    setup: () => SCENARIOS.NORMAL_FLOW.setup(),
  },
  {
    chapter: 2,
    title: '2. Consume One Order',
    objective: 'Kitchen C1 acquires full (1 → 0), locks mutex, removes from Bay 0, and signals empty (4 → 5).',
    scenarioId: 'NORMAL_FLOW',
    targetSteps: 7,
    keyObservation: 'Removing the tray from the bay releases the shared buffer slot immediately. Food preparation occurs outside the shared buffer.',
    setup: () => {
      let s = SCENARIOS.NORMAL_FLOW.setup();
      for (let i = 0; i < 7; i++) s = stepSimulation(s, 'P1');
      s.scheduledThreadId = 'C1';
      return s;
    },
  },
  {
    chapter: 3,
    title: '3. Fill the Entire Buffer',
    objective: 'Fill all 5 bays (occupancy = 5, empty = 0, full = 5). Observe all bays occupied without overflow.',
    scenarioId: 'BUFFER_FULL',
    targetSteps: 7,
    keyObservation: 'When all 5 bays are occupied, empty reaches 0. No new orders can enter without blocking.',
    setup: () => SCENARIOS.BUFFER_FULL.setup(),
  },
  {
    chapter: 4,
    title: '4. Block Producer on Saturated Buffer',
    objective: 'With buffer saturated (empty = 0), P2 executes sem_wait(&empty) and suspends into the FIFO wait queue.',
    scenarioId: 'BUFFER_FULL',
    targetSteps: 2,
    keyObservation: 'P2 turns amber with status BLOCKED. Notice P2 does NOT busy-loop: its program counter halts at wait(empty).',
    setup: () => {
      let s = SCENARIOS.BUFFER_FULL.setup();
      for (let i = 0; i < 7; i++) s = stepSimulation(s, 'P1');
      s.scheduledThreadId = 'P2';
      return s;
    },
  },
  {
    chapter: 5,
    title: '5. Free Capacity & Direct Wakeup',
    objective: 'Kitchen C1 consumes an order from Bay 0. When signaling sem_post(&empty), permit is transferred directly to P2.',
    scenarioId: 'BUFFER_FULL',
    targetSteps: 6,
    keyObservation: 'Direct permit transfer: P2 transitions to READY with PC advanced without re-executing wait(empty)!',
    setup: () => {
      let s = SCENARIOS.BUFFER_FULL.setup();
      for (let i = 0; i < 7; i++) s = stepSimulation(s, 'P1');
      s = stepSimulation(s, 'P2');
      s = stepSimulation(s, 'P2');
      s.scheduledThreadId = 'C1';
      return s;
    },
  },
  {
    chapter: 6,
    title: '6. Circular Modulo Wraparound',
    objective: 'Observe pointer arithmetic in = (4 + 1) % 5 = 0 and out = (4 + 1) % 5 = 0 wrapping from Bay 4 back to Bay 0.',
    scenarioId: 'CIRCULAR_WRAP',
    targetSteps: 4,
    keyObservation: 'The return track connects Bay 4 back to Bay 0, demonstrating FIFO circular ring buffer memory.',
    setup: () => SCENARIOS.CIRCULAR_WRAP.setup(),
  },
];

/**
 * Three Interactive Guided Challenges for SOLVE Mode
 */
export const CHALLENGES = {
  CHALLENGE_A: {
    id: 'CHALLENGE_A',
    name: 'Challenge A',
    title: 'Challenge A: Wake the Producer',
    objective: 'The buffer is 100% saturated (all 5 bays full) and Producer P2 is BLOCKED on sem_wait(&empty). Dispatch Consumer C1 through its consumption cycle until it frees a slot with sem_post(&empty), observing direct permit transfer that wakes P2.',
    startingConditions: 'Buffer saturated (empty = 0, full = 5). P2 is suspended with status BLOCKED in waitQueues.empty.',
    hint: 'Select Consumer C1 in the manual dispatcher and step through its instructions. Once C1 calls sem_post(&empty), P2 will receive the capacity permit directly and transition back to READY.',
    setup: () => {
      let s = SCENARIOS.BUFFER_FULL.setup();
      for (let i = 0; i < 7; i++) s = stepSimulation(s, 'P1');
      s = stepSimulation(s, 'P2'); // CREATE_ITEM
      s = stepSimulation(s, 'P2'); // WAIT_EMPTY -> BLOCKED!
      s.scheduledThreadId = 'C1';
      s.scenarioId = 'CHALLENGE_A';
      return s;
    },
    checkCompletion: (state) => {
      const hasWokenP2 = state.events.some(
        (e) => e.type === 'THREAD_RESUMED' && e.details?.wokenThreadId === 'P2' && e.details?.permit === 'empty'
      );
      return {
        isComplete: hasWokenP2,
        summary: hasWokenP2
          ? 'Challenge Solved! C1 signaled sem_post(&empty) and capacity was transferred directly to P2 (status is now READY).'
          : 'In Progress: Producer P2 is BLOCKED waiting on empty. Step Consumer C1 until it executes sem_post(&empty).',
      };
    },
  },
  CHALLENGE_B: {
    id: 'CHALLENGE_B',
    name: 'Challenge B',
    title: 'Challenge B: Wrap Without Losing Orders',
    objective: 'Pointers are near the physical end of the circular buffer (IN=4, OUT=3). Execute production and consumption across the boundary, observing (in + 1) % 5 wrapping from Bay 4 to Bay 0 while maintaining strict FIFO order and 0 invariant violations.',
    startingConditions: 'Slots 0..2 empty, Slot 3 occupied, Slot 4 empty. IN=4, OUT=3.',
    hint: 'Step Producer P1 to place an order in Bay 4 and advance IN to 0. Then step Consumer C1 to take from Bay 3 (advancing OUT to 4) and then from Bay 4 (advancing OUT to 0).',
    setup: () => {
      const prefilled = [
        null,
        null,
        null,
        { id: 'INIT-ORD-03', name: 'Masala Dosa', slotIndex: 3, producerId: 'P1' },
        null,
      ];
      const s = createInitialSyncState({
        scenarioId: 'CHALLENGE_B',
        initialSlots: prefilled,
        in: 4,
        out: 3,
        empty: 4,
        full: 1,
        mutex: 1,
      });
      s.scheduledThreadId = 'P1';
      return s;
    },
    checkCompletion: (state) => {
      const inWrapped = state.events.some(
        (e) => e.type === 'POINTER_ADVANCED' && e.details?.pointer === 'IN' && e.details?.from === 4 && e.details?.to === 0
      );
      const outAdvanced = state.events.some(
        (e) => e.type === 'POINTER_ADVANCED' && e.details?.pointer === 'OUT' && e.details?.from === 3 && e.details?.to === 4
      );
      const inv = validateInvariants(state);
      const isComplete = inWrapped && outAdvanced && inv.isValid;
      return {
        isComplete,
        summary: isComplete
          ? 'Challenge Solved! IN pointer wrapped from Bay 4 to Bay 0 with zero slot clobbering and valid FIFO invariants.'
          : inWrapped
            ? 'IN pointer wrapped to 0! Now step Consumer C1 to advance OUT past Bay 3.'
            : 'Step Producer P1 to insert into Bay 4 and advance IN to 0.',
      };
    },
  },
  CHALLENGE_C: {
    id: 'CHALLENGE_C',
    name: 'Challenge C',
    title: 'Challenge C: Repair the Lost Update',
    objective: 'Inspect an unsynchronized read-modify-write race condition that clobbers the shared order count (final result 3 instead of 4). Enable mutex serialization to serialize the critical section, run the trace, and verify the correct mathematical outcome (4).',
    startingConditions: 'Shared counter = 2. P1 and P2 both attempt increment (+1 each). Unsynchronized execution causes lost update.',
    hint: 'Toggle the Mutex Protection switch to ON. Observe how P1 holds the mutex lock throughout its read-compute-write cycle, forcing P2 to wait until P1 writes back.',
    setup: () => createInitialSyncState({ scenarioId: 'CHALLENGE_C' }),
    checkCompletion: (hasMutex, finalValue) => {
      const isComplete = hasMutex === true && finalValue === 4;
      return {
        isComplete,
        summary: isComplete
          ? 'Challenge Solved! Mutex protection serialized the critical sections, achieving mathematical correctness (final count = 4).'
          : 'In Progress: Enable Mutex Protection and play the interleaved sequence to verify the final value reaches 4.',
      };
    },
  },
};

/**
 * Deterministic Schedule Replayer
 * Runs from the specified initial state and steps through scheduleArray deterministically.
 */
export function replaySchedule(initialState, scheduleArray, upToStep = scheduleArray.length) {
  let s = { ...initialState };
  const maxStep = Math.min(scheduleArray.length, Math.max(0, upToStep));
  for (let i = 0; i < maxStep; i++) {
    const threadId = scheduleArray[i];
    s = stepSimulation(s, threadId);
  }
  return s;
}

/**
 * Validate imported schedule JSON against versioned schema
 */
export function validateScheduleExport(json) {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'Input must be a valid JSON object' };
  }
  if (json.version !== 1) {
    return { valid: false, error: 'Unsupported export version. Expected version: 1' };
  }
  if (!json.scenarioId || (!SCENARIOS[json.scenarioId] && !CHALLENGES[json.scenarioId])) {
    return { valid: false, error: `Invalid or unknown scenarioId: ${json.scenarioId}` };
  }
  if (!Array.isArray(json.schedule)) {
    return { valid: false, error: 'Schedule must be an array of thread IDs' };
  }
  const allowedThreads = ['P1', 'P2', 'C1'];
  for (const tid of json.schedule) {
    if (!allowedThreads.includes(tid)) {
      return { valid: false, error: `Invalid thread ID in schedule: ${tid}` };
    }
  }
  return { valid: true };
}

/**
 * Generate human-readable live explanation from latest structured event
 */
export function generateEventExplanation(event, state) {
  if (!event) {
    return {
      category: 'SYSTEM READY',
      text: 'Simulation initialized. Ready to execute synchronization instructions.',
      type: 'neutral',
    };
  }

  switch (event.type) {
    case 'ITEM_CREATED':
      return {
        category: 'ITEM PREPARED',
        text: `${event.threadId} prepared local order token [${event.details?.itemId || 'token'}] in thread-private register.`,
        type: 'info',
      };
    case 'PERMIT_ACQUIRED':
      if (event.details?.permit === 'empty') {
        return {
          category: 'CAPACITY RESERVED',
          text: `${event.threadId} reserved 1 empty permit. (Available empty permits: ${event.details?.remaining}).`,
          type: 'success',
        };
      }
      return {
        category: 'ORDER ACQUIRED',
        text: `${event.threadId} acquired 1 full permit to consume. (Available orders: ${event.details?.remaining}).`,
        type: 'success',
      };
    case 'MUTEX_ACQUIRED':
      return {
        category: 'CRITICAL SECTION ENTERED',
        text: `${event.threadId} acquired binary mutex lock and entered exclusive critical section.`,
        type: 'success',
      };
    case 'THREAD_BLOCKED':
      if (event.details?.waitingFor === 'empty') {
        return {
          category: 'PRODUCER SUSPENDED',
          text: `Buffer is saturated (empty = 0). ${event.threadId} blocked in waitQueues.empty awaiting consumer release.`,
          type: 'warning',
          blockingResource: 'empty',
        };
      }
      if (event.details?.waitingFor === 'full') {
        return {
          category: 'CONSUMER SUSPENDED',
          text: `Buffer is empty (full = 0). ${event.threadId} blocked in waitQueues.full awaiting producer order.`,
          type: 'warning',
          blockingResource: 'full',
        };
      }
      return {
        category: 'MUTEX CONTENTION',
        text: `Critical section occupied by ${event.details?.owner || 'another thread'}. ${event.threadId} queued in waitQueues.mutex.`,
        type: 'warning',
        blockingResource: 'mutex',
      };
    case 'ITEM_INSERTED':
      return {
        category: 'ORDER STORED',
        text: `Order ${event.details?.itemId || ''} placed into Bay ${event.details?.slotIndex}. Buffer occupancy is now ${state?.occupancy ?? '?'}/5.`,
        type: 'info',
      };
    case 'READ_POINTER':
      return {
        category: 'POINTER READ',
        text: `${event.threadId} read shared ${event.details?.pointer || 'IN'} pointer (value: ${event.details?.targetSlot}) into private register targetSlot.`,
        type: 'info',
      };
    case 'ITEM_OVERWRITTEN':
      return {
        category: 'RACE OVERWRITE FAULT',
        text: `CRITICAL FAULT: ${event.threadId} wrote order ${event.details?.itemId || ''} into Bay ${event.details?.slotIndex}, overwriting existing order ${event.details?.displacedItemId || ''}! Stale index was read at step #${event.details?.staleReadStep}.`,
        type: 'error',
      };
    case 'ITEM_REMOVED':
      return {
        category: 'ORDER EXTRACTED',
        text: `Order ${event.details?.itemId || ''} removed from Bay ${event.details?.slotIndex} by ${event.threadId}.`,
        type: 'info',
      };
    case 'POINTER_ADVANCED':
      return {
        category: 'POINTER ADVANCED',
        text: `${event.details?.pointer} pointer stepped: (${event.details?.from} + 1) % 5 = ${event.details?.to}${event.details?.from === 4 && event.details?.to === 0 ? ' (circular wrap)' : ''}.`,
        type: 'info',
      };
    case 'MUTEX_RELEASED':
      return {
        category: 'CRITICAL SECTION EXITED',
        text: `${event.threadId} released mutex lock. Mutex is now FREE (1).`,
        type: 'neutral',
      };
    case 'MUTEX_TRANSFERRED':
      return {
        category: 'DIRECT MUTEX HANDOVER',
        text: `${event.threadId} released mutex; ownership transferred directly to waiting thread ${event.details?.transferredTo}.`,
        type: 'success',
      };
    case 'THREAD_RESUMED':
      return {
        category: 'THREAD WOKEN',
        text: `${event.threadId} signaled sem_post(&${event.details?.permit}). Permit handed directly to ${event.details?.wokenThreadId} (now READY).`,
        type: 'success',
        wokenThreadId: event.details?.wokenThreadId,
      };
    case 'PERMIT_SIGNALED':
      return {
        category: 'CAPACITY SIGNALED',
        text: `${event.threadId} incremented ${event.details?.permit} semaphore. (${event.details?.permit} count = ${event.details?.count}).`,
        type: 'info',
      };
    case 'DEADLOCK_DETECTED':
      return {
        category: 'DEADLOCK FAULT',
        text: 'DEADLOCK: Mutual wait dependency. Consumer holds mutex waiting for full; Producer holds empty waiting for mutex.',
        type: 'error',
      };
    default:
      return {
        category: 'EXECUTION EVENT',
        text: event.message || 'Execution stepped.',
        type: 'info',
      };
  }
}

/**
 * Evaluate detailed, structured live invariants for verification panel
 */
export function evaluateDetailedInvariants(state) {
  if (!state) return [];
  const results = [];

  // 1. Mutual Exclusion
  const threadsInCriticalSection = Object.values(state.threads || {}).filter((t) => {
    if (state.useDecomposedBuffer) {
      if (!state.withoutMutex) {
        return (t.role === 'PRODUCER' && t.pc >= 3 && t.pc <= 6) ||
               (t.role === 'CONSUMER' && t.pc >= 2 && t.pc <= 4);
      }
      return (t.role === 'PRODUCER' && t.pc >= 2 && t.pc <= 5) ||
             (t.role === 'CONSUMER' && t.pc >= 1 && t.pc <= 4);
    }
    return t.id === state.mutexOwner;
  });

  let mutexStatus;
  if (state.withoutMutex) {
    mutexStatus = threadsInCriticalSection.length > 1 ? 'VIOLATION' : 'WARN';
  } else {
    mutexStatus = (state.mutex === 1 ? state.mutexOwner === null : state.mutexOwner !== null) ? 'PASS' : 'VIOLATION';
  }

  results.push({
    id: 'MUTUAL_EXCLUSION',
    name: 'Mutual Exclusion',
    formula: 'Mutex Owner ≤ 1 ∧ CS Concurrency ≤ 1',
    status: mutexStatus,
    description: state.withoutMutex
      ? (threadsInCriticalSection.length > 1
          ? `VIOLATION: Multiple threads (${threadsInCriticalSection.map((t) => t.id).join(', ')}) simultaneously accessing buffer data without mutex!`
          : 'WARNING: Mutex protection is disabled. Threads access shared buffer pointers unsynchronized.')
      : (state.mutexOwner
          ? `PASS: Single owner [${state.mutexOwner}] holds binary lock. Contending threads wait.`
          : 'PASS: Mutex unlocked (1), available for acquisition.'),
  });

  // 2. Buffer Capacity Bounds
  const validOccupancy = state.occupancy >= 0 && state.occupancy <= state.capacity;
  const actualItemsCount = (state.slots || []).filter(Boolean).length;
  const countMatches = actualItemsCount === state.occupancy;
  results.push({
    id: 'CAPACITY_BOUNDS',
    name: 'Bounded Capacity',
    formula: '0 ≤ occupancy ≤ Buffer Capacity (5)',
    status: (validOccupancy && countMatches) ? 'PASS' : 'VIOLATION',
    description: (validOccupancy && countMatches)
      ? `PASS: Current occupancy is ${state.occupancy}/${state.capacity} with ${state.empty} empty slots and ${state.full} available items.`
      : `VIOLATION: Buffer occupancy corrupted! Declared ${state.occupancy}, actual ${actualItemsCount}.`,
  });

  // 3. No Item Overwritten / Data Integrity
  const hasDisplaced = state.displacedItems && state.displacedItems.length > 0;
  results.push({
    id: 'DATA_INTEGRITY',
    name: 'No Lost / Overwritten Items',
    formula: 'displacedItems.length === 0',
    status: hasDisplaced ? 'VIOLATION' : 'PASS',
    description: hasDisplaced
      ? `VIOLATION: ${state.displacedItems.length} order item(s) permanently overwritten due to race condition! Lost item: ${state.displacedItems[0].displacedItem?.id || 'order'} in Bay ${state.displacedItems[0].slotIndex}.`
      : 'PASS: All orders placed retain dedicated buffer bays until consumer extracts them.',
  });

  // 4. Semaphore Conservation Law
  const semaphoreSum = state.empty + state.full;
  const isSemValid = (state.withoutMutex || state.displacedItems?.length > 0)
    ? true
    : semaphoreSum <= state.capacity;
  results.push({
    id: 'SEMAPHORE_CONSERVATION',
    name: 'Counting Semaphore Invariant',
    formula: 'empty + full ≤ capacity (permits conserved)',
    status: isSemValid ? 'PASS' : 'WARN',
    description: `empty=${state.empty}, full=${state.full} (Sum: ${semaphoreSum}/${state.capacity}). Waiting producers: ${state.waitQueues?.empty?.length || 0}, Waiting consumers: ${state.waitQueues?.full?.length || 0}.`,
  });

  // 5. Freedom from Deadlock
  const isDeadlocked = state.deadlock === true;
  results.push({
    id: 'NO_DEADLOCK',
    name: 'Liveness / No Deadlock',
    formula: '¬(Hold & Wait circular dependency)',
    status: isDeadlocked ? 'VIOLATION' : 'PASS',
    description: isDeadlocked
      ? 'VIOLATION: Circular wait detected! System halted in deadlock.'
      : 'PASS: Active runnable threads present or permits cleanly flow through FIFO queues.',
  });

  return results;
}

/**
 * Presets for Bounded Buffer Mutex Comparison
 */
export const BUFFER_COMPARISON_PRESETS = {
  RACE_COLLISION: {
    id: 'RACE_COLLISION',
    name: 'Interleaved Collision (Lost Order)',
    description: 'P1 and P2 both read IN = 0 without mutex protection. P1 writes to slot 0 and advances IN. P2 then writes to slot 0 with its stale pointer, clobbering P1\'s order!',
    expectedWithoutMutex: 'FAULT: Bay 0 overwritten; order P1 displaced and lost.',
    expectedWithMutex: 'SAFE: Mutex serializes P1 and P2; P1 fills Bay 0, P2 fills Bay 1.',
    schedule: ['P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P1', 'P1', 'P2', 'P2'],
  },
  SERIALIZED_UNLOCKED: {
    id: 'SERIALIZED_UNLOCKED',
    name: 'Serialized by Chance (Unlocked)',
    description: 'P1 executes its entire cycle before P2 begins. Even without a mutex, no race occurs because scheduling serialized them by luck.',
    expectedWithoutMutex: 'SAFE BY LUCK: Both orders stored without collision.',
    expectedWithMutex: 'SAFE: Mutex serializes orders with formal safety guarantee.',
    schedule: ['P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2'],
  },
  CONSUMER_PRODUCER_SYNC: {
    id: 'CONSUMER_PRODUCER_SYNC',
    name: 'Producer-Consumer Handshake',
    description: 'P1 produces into Bay 0, signals full, and C1 consumes from Bay 0, maintaining FIFO synchronization.',
    expectedWithoutMutex: 'Potentially erratic pointer progression.',
    expectedWithMutex: 'Strict FIFO production and consumption with verified permit transfer.',
    schedule: ['P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'C1', 'C1', 'C1', 'C1', 'C1', 'C1', 'C1'],
  },
};

/**
 * Executes instructions in a bounded budget until the next significant teaching event.
 * Stopping conditions:
 * - An order item enters a bay (ITEM_INSERTED)
 * - An order item is accepted by the kitchen (ITEM_REMOVED)
 * - A thread blocks (THREAD_BLOCKED)
 * - A waiting thread resumes (THREAD_RESUMED)
 * - An overwrite collision occurs (ITEM_OVERWRITTEN / firstFault)
 * - A full cycle completes (CYCLE_COMPLETED)
 * - Deadlock occurs (DEADLOCK_DETECTED)
 * - No runnable thread or state change (NO_PROGRESS)
 */
export function stepToNextTeachingEvent(initialState, scheduledThreadId = null, maxInstructions = 15) {
  let currentState = initialState;
  let instructionsRun = 0;
  let stoppedReason = 'COMPLETED_ACTION';
  let teachingEvent = null;

  while (instructionsRun < maxInstructions) {
    if (currentState.isDeadlocked) {
      stoppedReason = 'DEADLOCKED';
      break;
    }
    if (currentState.firstFault) {
      stoppedReason = 'FAULT_DETECTED';
      break;
    }

    const prevCounter = currentState.stepCounter;
    const nextState = stepSimulation(currentState, scheduledThreadId);

    // If step counter did not advance, thread was ineligible or blocked
    if (nextState.stepCounter === prevCounter) {
      stoppedReason = 'NO_PROGRESS';
      break;
    }

    instructionsRun++;
    currentState = nextState;

    const newestEvent = currentState.events[0];
    if (newestEvent) {
      const type = newestEvent.type;
      if (
        type === 'ITEM_INSERTED' ||
        type === 'ITEM_REMOVED' ||
        type === 'ITEM_OVERWRITTEN' ||
        type === 'THREAD_BLOCKED' ||
        type === 'THREAD_RESUMED' ||
        type === 'CYCLE_COMPLETED' ||
        type === 'DEADLOCK_DETECTED' ||
        currentState.firstFault
      ) {
        teachingEvent = newestEvent;
        stoppedReason = 'TEACHING_EVENT';
        break;
      }
    }
  }

  return {
    nextState: currentState,
    instructionsRun,
    stoppedReason,
    teachingEvent,
  };
}

/**
 * Formats a single short canteen-model explanation derived from real engine state.
 */
export function getTeachingCanteenExplanation(state, teachingEvent = null) {
  if (state.firstFault) {
    const f = state.firstFault;
    if (f.type === 'DUPLICATE_CLAIM_FAULT') {
      return `Duplicate Claim Collision: ${f.threadId || f.culpritThreadId} attempted duplicate claim on ticket ${f.candidateId || 'ticket'} from Slot ${f.slotIndex}! Stale read occurred without mutex.`;
    }
    return `Collision: ${f.culpritThreadId} overwrote ${f.displacedItem?.id || 'order'} in Bay ${f.slotIndex} using a stale read. One order was lost!`;
  }

  const evt = teachingEvent || state.events[0];
  if (!evt) {
    return 'Simulation ready. Click Next Action or Play to observe order coordination.';
  }

  switch (evt.type) {
    case 'ITEM_INSERTED': {
      const slot = evt.details?.slotIndex ?? state.in;
      return `Order ${evt.details?.itemId || 'token'} entered Bay ${slot}.`;
    }
    case 'ITEM_REMOVED': {
      const slot = evt.details?.slotIndex ?? state.out;
      return `Kitchen accepted order ${evt.details?.itemId || 'token'} from Bay ${slot} (cooking occurs outside critical section).`;
    }
    case 'ITEM_OVERWRITTEN': {
      return `Collision: ${evt.threadId} overwrote ${evt.details?.displacedItemId || 'order'} in Bay ${evt.details?.slotIndex} without mutex!`;
    }
    case 'THREAD_BLOCKED': {
      const waiting = evt.details?.waitingFor;
      if (waiting === 'empty') {
        return `${evt.threadId} is waiting because no empty permit is available (all 5 bays are full).`;
      }
      if (waiting === 'full') {
        return `${evt.threadId} is waiting because the queue has no published orders.`;
      }
      return `${evt.threadId} is waiting because the mutex is held by ${state.mutexOwner}.`;
    }
    case 'THREAD_RESUMED': {
      const permit = evt.details?.permit;
      if (permit === 'empty') {
        return `Kitchen released capacity; ${evt.details?.wokenThreadId || 'Producer'} can continue.`;
      }
      return `New order published; ${evt.details?.wokenThreadId || 'Consumer'} can continue.`;
    }
    case 'MUTEX_ACQUIRED':
      return `${evt.threadId} owns the mutex while changing the shared queue.`;
    case 'MUTEX_RELEASED':
      return `${evt.threadId} released the mutex. Access is free for the next operation.`;
    case 'MUTEX_TRANSFERRED':
      return `${evt.threadId} released the mutex; ownership handed directly to waiting thread ${evt.details?.transferredTo}.`;
    case 'PERMIT_ACQUIRED':
      if (evt.details?.permit === 'empty') {
        return `${evt.threadId} reserved one space in the queue.`;
      }
      return `${evt.threadId} acquired an available order to process.`;
    case 'ITEM_CREATED':
      return `${evt.threadId} prepared a new local order token.`;
    case 'REQUEST_SUBMITTED':
      return `${evt.message} Awaiting assignment to student producer.`;
    case 'POINTER_ADVANCED':
      return `${evt.threadId} advanced the ${evt.details?.pointer} pointer to Bay ${evt.details?.to}.`;
    case 'CYCLE_COMPLETED':
      return `${evt.threadId} finished its current transfer cycle.`;
    case 'DEADLOCK_DETECTED':
      return 'System halted in deadlock! Circular wait detected.';
    default:
      return evt.message || 'Instruction executed.';
  }
}

export const LAB_ORDER_NAMES = [
  'Avocado Toast',
  'Cold Brew',
  'Masala Dosa',
  'Paneer Bowl',
  'Filter Coffee',
  'Bagel & Cream Cheese',
  'Chai Latte',
  'Matcha Scone',
  'Croissant',
  'Berry Parfait',
  'Mango Lassi',
  'Samosa Plate',
  'Espresso',
  'Flat White',
  'Granola Bowl',
];

/**
 * Submits simulated lab orders into the producer workload backlog.
 * Bounded by maxSubmissionLimit (default: 15) to prevent unbounded memory growth.
 */
export function submitLabOrders(prevState, count = 1, maxSubmissionLimit = 15) {
  const currentTotal = prevState.submittedRequests?.length || 0;
  const allowed = Math.max(0, Math.min(count, maxSubmissionLimit - currentTotal));
  if (allowed === 0) {
    return {
      nextState: prevState,
      added: 0,
      limitReached: currentTotal >= maxSubmissionLimit,
    };
  }

  let nextSeq = prevState.nextRequestSeq || (currentTotal + 1);
  const newRequests = [];
  for (let i = 0; i < allowed; i++) {
    const id = `LAB-${String(nextSeq).padStart(3, '0')}`;
    const name = LAB_ORDER_NAMES[(nextSeq - 1) % LAB_ORDER_NAMES.length];
    newRequests.push({
      id,
      name,
      seq: nextSeq,
      submittedStep: prevState.stepCounter + 1,
    });
    nextSeq++;
  }

  const nextBacklog = [...(prevState.requestBacklog || []), ...newRequests];
  const nextSubmitted = [...(prevState.submittedRequests || []), ...newRequests];

  // Assign immediately to idle producers at pc === 0 if they don't have assignedRequest or localItem
  const nextThreads = { ...prevState.threads };
  for (const tid of ['P1', 'P2']) {
    const thread = { ...nextThreads[tid] };
    if (
      thread.role === THREAD_ROLE.PRODUCER &&
      thread.pc === 0 &&
      !thread.assignedRequest &&
      !thread.localItem &&
      nextBacklog.length > 0
    ) {
      thread.assignedRequest = nextBacklog.shift();
      nextThreads[tid] = thread;
    }
  }

  const newEvents = recordEvent(
    prevState,
    'REQUEST_SUBMITTED',
    'STUDENT',
    allowed === 1
      ? `Simulated order ${newRequests[0].id} (${newRequests[0].name}) submitted to backlog.`
      : `${allowed} simulated orders submitted to backlog (${newRequests[0].id}..${newRequests[newRequests.length - 1].id}).`,
    { count: allowed, requests: newRequests }
  );

  return {
    nextState: {
      ...prevState,
      useWorkloadQueue: true,
      requestBacklog: nextBacklog,
      submittedRequests: nextSubmitted,
      nextRequestSeq: nextSeq,
      threads: nextThreads,
      events: newEvents,
    },
    added: allowed,
    limitReached: (currentTotal + allowed) >= maxSubmissionLimit,
  };
}

/**
 * Submits a custom lab order (e.g. adapted from a real customer order snapshot)
 * into the producer workload backlog.
 */
export function submitCustomLabOrder(prevState, customRequest, maxSubmissionLimit = 15) {
  const currentTotal = prevState.submittedRequests?.length || 0;
  if (currentTotal >= maxSubmissionLimit || !customRequest) {
    return {
      nextState: prevState,
      added: 0,
      limitReached: currentTotal >= maxSubmissionLimit,
    };
  }

  const nextSeq = customRequest.seq || (prevState.nextRequestSeq || (currentTotal + 1));
  const newRequest = {
    ...customRequest,
    id: customRequest.id || `LAB-${String(nextSeq).padStart(3, '0')}`,
    name: customRequest.name || 'Order Ticket',
    seq: nextSeq,
    submittedStep: prevState.stepCounter + 1,
  };

  const nextBacklog = [...(prevState.requestBacklog || []), newRequest];
  const nextSubmitted = [...(prevState.submittedRequests || []), newRequest];

  // Assign immediately to idle producers at pc === 0 if they don't have assignedRequest or localItem
  const nextThreads = { ...prevState.threads };
  for (const tid of ['P1', 'P2']) {
    const thread = { ...nextThreads[tid] };
    if (
      thread.role === THREAD_ROLE.PRODUCER &&
      thread.pc === 0 &&
      !thread.assignedRequest &&
      !thread.localItem &&
      nextBacklog.length > 0
    ) {
      thread.assignedRequest = nextBacklog.shift();
      nextThreads[tid] = thread;
    }
  }

  const sourceMsg = newRequest.sourceOrderRef ? ` (adapted from order ${newRequest.sourceOrderRef})` : '';
  const newEvents = recordEvent(
    prevState,
    'REQUEST_SUBMITTED',
    'STUDENT',
    `Simulated order ${newRequest.id} ("${newRequest.name}")${sourceMsg} submitted to backlog.`,
    { count: 1, requests: [newRequest] }
  );

  return {
    nextState: {
      ...prevState,
      useWorkloadQueue: true,
      requestBacklog: nextBacklog,
      submittedRequests: nextSubmitted,
      nextRequestSeq: Math.max(nextSeq + 1, prevState.nextRequestSeq || 1),
      threads: nextThreads,
      events: newEvents,
    },
    added: 1,
    limitReached: (currentTotal + 1) >= maxSubmissionLimit,
  };
}

/**
 * Initializes the "Try 6 Orders" demonstration:
 * Sets up a clean buffer (0/5 occupancy), kitchen paused, and 6 submitted requests.
 */
export function setupSixOrderDemonstration() {
  const initial = createInitialSyncState({
    scenarioId: 'NORMAL_FLOW',
    useWorkloadQueue: true,
    isKitchenPaused: true,
    empty: 5,
    full: 0,
    mutex: 1,
  });

  const submission = submitLabOrders(initial, 6, 15);
  return submission.nextState;
}

/**
 * Precise 4-location order accounting:
 * Every created order exists in exactly ONE mutually exclusive location:
 * 1. Awaiting assignment (in requestBacklog)
 * 2. Held by a producer (in thread.assignedRequest or thread.localItem)
 * 3. Inside buffer (in slots 0..4)
 * 4. Accepted by kitchen (in consumedItems)
 */
export function getOrderAccounting(state) {
  const awaiting = state.requestBacklog || [];

  const heldByProducers = [];
  for (const tid of ['P1', 'P2']) {
    const thread = state.threads[tid];
    if (thread?.localItem) {
      heldByProducers.push({
        ...thread.localItem,
        producerId: tid,
        isBlocked: thread.status === THREAD_STATUS.BLOCKED,
        waitingFor: thread.waitingFor,
      });
    } else if (thread?.assignedRequest) {
      heldByProducers.push({
        ...thread.assignedRequest,
        producerId: tid,
        isBlocked: false,
        waitingFor: null,
      });
    }
  }

  const waitingForCapacity = heldByProducers.filter((o) => o.isBlocked && o.waitingFor === 'empty');
  const inBuffer = (state.slots || []).filter(Boolean);
  const kitchenAccepted = state.consumedItems || [];

  const totalSubmitted = awaiting.length + heldByProducers.length + inBuffer.length + kitchenAccepted.length;

  return {
    awaiting,
    awaitingCount: awaiting.length,
    heldByProducers,
    heldCount: heldByProducers.length,
    waitingForCapacity,
    waitingForCapacityCount: waitingForCapacity.length,
    inBuffer,
    inBufferCount: inBuffer.length,
    kitchenAccepted,
    kitchenAcceptedCount: kitchenAccepted.length,
    totalSubmitted,
  };
}

export const LESSON_CONFIGS = {
  LESSON_1: {
    id: 'LESSON_1',
    title: '1. Place & Collect Orders',
    subtitle: 'Observe standard producer-consumer coordination with counting semaphores and mutex protection.',
    description: 'Students submit order tickets into the 5-slot counter. Kitchen staff collect and prepare tickets in FIFO sequence.',
  },
  LESSON_2_FULL: {
    id: 'LESSON_2_FULL',
    title: '2A. Full Queue (Overflow Protection)',
    subtitle: 'Queue is full (5/5). Producers must block on sem_wait(&empty) until kitchen staff releases capacity.',
    description: 'Counter has all 5 ticket clips filled. Student P2 is waiting for capacity. Kitchen staff C1 collecting an order signals empty and unblocks P2.',
  },
  LESSON_2_EMPTY: {
    id: 'LESSON_2_EMPTY',
    title: '2B. Empty Queue (Underflow Protection)',
    subtitle: 'Queue is empty (0/5). Kitchen staff must block on sem_wait(&full) until a student places an order.',
    description: 'Counter has 0 tickets. Kitchen staff C1 is waiting for orders. Student P1 placing an order signals full and unblocks C1.',
  },
  LESSON_3_RACE_UNSAFE: {
    id: 'LESSON_3_RACE_UNSAFE',
    title: '3A. Race Condition (Without Mutex)',
    subtitle: 'Multiple kitchen staff read the same ticket index simultaneously without mutual exclusion.',
    description: 'C1 and C2 both read OUT = 0 before either advances the pointer. Both claim the same order ticket! One order is duplicate-claimed and the second is left abandoned in the queue.',
  },
  LESSON_3_RACE_PROTECTED: {
    id: 'LESSON_3_RACE_PROTECTED',
    title: '3B. Protected Queue (With Mutex)',
    subtitle: 'Kitchen staff acquire pthread_mutex_lock before reading and claiming orders.',
    description: 'C1 acquires the lock, claims Order 1, advances OUT to 1, and unlocks. C2 then acquires the lock and safely claims Order 2 without collision.',
  },
  LESSON_3_SPLIT_COMPARISON: {
    id: 'LESSON_3_SPLIT_COMPARISON',
    title: '3. Split-Screen Comparison',
    subtitle: 'Without Queue Mutex (Left) vs With Queue Mutex (Right). Counting semaphores enabled.',
    description: 'Side-by-side comparison: un-mutexed vs protected critical sections on identical N=5 bounded buffers.',
  },
};

export const LESSON_SCHEDULES = {
  // Explicit Unsafe Schedule (14 steps):
  // 1: C1 WAIT_FULL, 2: C2 WAIT_FULL, 3: C1 READ_OUT, 4: C2 READ_OUT, 5: C1 READ_ITEM, 6: C2 READ_ITEM,
  // 7: C1 COMMIT_CLAIM, 8: C2 COMMIT_CLAIM (fault!), 9: C1 UPDATE_OUT, 10: C2 UPDATE_OUT,
  // 11: C1 SIGNAL_EMPTY, 12: C2 SIGNAL_EMPTY, 13: C1 PROCESS, 14: C2 PROCESS
  LESSON_3_RACE_UNSAFE: ['C1', 'C2', 'C1', 'C2', 'C1', 'C2', 'C1', 'C2', 'C1', 'C2', 'C1', 'C2', 'C1', 'C2'],

  // Explicit Protected Schedule (18 steps):
  // 1: C1 WAIT_FULL, 2: C2 WAIT_FULL, 3: C1 LOCK, 4: C2 LOCK (blocks!), 5: C1 READ_OUT, 6: C1 READ_ITEM,
  // 7: C1 COMMIT_CLAIM, 8: C1 UPDATE_OUT, 9: C1 UNLOCK (wakes C2), 10: C2 READ_OUT, 11: C2 READ_ITEM,
  // 12: C2 COMMIT_CLAIM, 13: C2 UPDATE_OUT, 14: C2 UNLOCK, 15: C1 SIGNAL_EMPTY, 16: C2 SIGNAL_EMPTY,
  // 17: C1 PROCESS, 18: C2 PROCESS
  LESSON_3_RACE_PROTECTED: ['C1', 'C2', 'C1', 'C2', 'C1', 'C1', 'C1', 'C1', 'C1', 'C2', 'C2', 'C2', 'C2', 'C2', 'C1', 'C2', 'C1', 'C2'],
};

export const EXPLICIT_UNSAFE_SCHEDULE = LESSON_SCHEDULES.LESSON_3_RACE_UNSAFE;
export const EXPLICIT_PROTECTED_SCHEDULE = LESSON_SCHEDULES.LESSON_3_RACE_PROTECTED;

export function createUnsafeScheduleState() {
  const state = createInitialSyncState({
    capacity: 5,
    withoutMutex: true,
    useDecomposedConsumer: true,
  });

  const ticketA = { id: 'A', name: 'Order A' };
  const ticketB = { id: 'B', name: 'Order B' };
  state.slots[0] = ticketA;
  state.slots[1] = ticketB;
  state.in = 2;
  state.out = 0;
  state.occupancy = 2;
  state.empty = 3;
  state.full = 2;
  state.mutex = 1;
  state.mutexOwner = null;
  state.acceptedHistory = [];
  state.processedHistory = [];
  state.pendingReservations = { empty: 0, full: 0 };
  state.baseline = {
    in: 2,
    out: 0,
    empty: 3,
    full: 2,
    slots: ['A', 'B', null, null, null],
  };

  return state;
}

export function createProtectedScheduleState() {
  const state = createInitialSyncState({
    capacity: 5,
    withoutMutex: false,
    useDecomposedConsumer: true,
  });

  const ticketA = { id: 'A', name: 'Order A' };
  const ticketB = { id: 'B', name: 'Order B' };
  state.slots[0] = ticketA;
  state.slots[1] = ticketB;
  state.in = 2;
  state.out = 0;
  state.occupancy = 2;
  state.empty = 3;
  state.full = 2;
  state.mutex = 1;
  state.mutexOwner = null;
  state.acceptedHistory = [];
  state.processedHistory = [];
  state.pendingReservations = { empty: 0, full: 0 };
  state.baseline = {
    in: 2,
    out: 0,
    empty: 3,
    full: 2,
    slots: ['A', 'B', null, null, null],
  };

  return state;
}

export function createLesson1State() {
  const initial = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useWorkloadQueue: true,
  });
  const submission = submitLabOrders(initial, 3, 15);
  return submission.nextState;
}

export function createLesson2FullState() {
  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useWorkloadQueue: true,
  });
  const fullOrders = [
    { id: 'ORD-201', name: 'Masala Dosa', label: 'Order #201: Masala Dosa', seq: 1 },
    { id: 'ORD-202', name: 'Filter Coffee', label: 'Order #202: Filter Coffee', seq: 2 },
    { id: 'ORD-203', name: 'Veg Thali', label: 'Order #203: Veg Thali', seq: 3 },
    { id: 'ORD-204', name: 'Samosa Plate', label: 'Order #204: Samosa Plate', seq: 4 },
    { id: 'ORD-205', name: 'Mango Lassi', label: 'Order #205: Mango Lassi', seq: 5 },
  ];
  state.slots = [...fullOrders];
  state.in = 0;
  state.out = 0;
  state.occupancy = 5;
  state.empty = 0;
  state.full = 5;

  const p2Order = { id: 'ORD-206', name: 'Chai Latte', seq: 6 };
  state.threads.P2.localItem = p2Order;
  state.threads.P2.pc = 1;
  state.threads.P2.status = THREAD_STATUS.BLOCKED;
  state.threads.P2.waitingFor = 'empty';
  state.waitQueues.empty = ['P2'];
  state.submittedRequests = [...fullOrders, p2Order];
  state.nextRequestSeq = 7;

  state.events = recordEvent(
    state,
    'THREAD_BLOCKED',
    'P2',
    'P2 (Student) is blocked on sem_wait(&empty): all 5 ticket holders on the counter are full!',
    { waitingFor: 'empty', orderId: p2Order.id }
  );

  return state;
}

export function createLesson2EmptyState() {
  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useWorkloadQueue: true,
  });
  state.occupancy = 0;
  state.empty = 5;
  state.full = 0;
  state.threads.C1.pc = 1;
  state.threads.C1.status = THREAD_STATUS.BLOCKED;
  state.threads.C1.waitingFor = 'full';
  state.waitQueues.full = ['C1'];

  const p1Order = { id: 'ORD-210', name: 'Avocado Toast', seq: 1 };
  state.requestBacklog = [p1Order];
  state.submittedRequests = [p1Order];
  state.nextRequestSeq = 2;
  state.threads.P1.assignedRequest = p1Order;

  state.events = recordEvent(
    state,
    'THREAD_BLOCKED',
    'C1',
    'C1 (Kitchen staff) is blocked on sem_wait(&full): the shared counter has no order tickets!',
    { waitingFor: 'full' }
  );

  return state;
}

export function createLesson3RaceState(withoutMutex = true) {
  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex,
    useDecomposedConsumer: true,
  });

  const raceOrders = [
    { id: 'ORD-301', name: 'Paneer Biryani', label: 'Order #301: Paneer Biryani', seq: 1 },
    { id: 'ORD-302', name: 'Cold Brew', label: 'Order #302: Cold Brew', seq: 2 },
  ];
  state.slots[0] = raceOrders[0];
  state.slots[1] = raceOrders[1];
  state.in = 2;
  state.out = 0;
  state.occupancy = 2;
  state.empty = 3;
  state.full = 2;
  state.submittedRequests = [...raceOrders];
  state.nextRequestSeq = 3;

  const modeName = withoutMutex ? 'UNSAFE (No Mutex)' : 'PROTECTED (With Mutex)';
  state.events = recordEvent(
    state,
    'MUTEX_CONFIGURED',
    'SYSTEM',
    `Lesson 3 initialized: ${modeName}. Two orders (ORD-301 and ORD-302) are queued at slot 0 and 1.`,
    { withoutMutex }
  );

  return state;
}

/**
 * Creates two completely independent static states for Stage 2 Split-Screen 3D visual acceptance:
 * Left: Without Queue Mutex (withoutMutex = true)
 * Right: With Queue Mutex (withoutMutex = false, mutex = 1, mutexOwner = null)
 * Both start with:
 * - slots = [ { id: 'A', name: 'Order A', slotIndex: 0 }, { id: 'B', name: 'Order B', slotIndex: 1 }, null, null, null ]
 * - IN = 2, OUT = 0
 * - empty = 3, full = 2
 * - occupancy = 2
 * - capacity = 5
 * No shared mutable arrays, objects, or queues. No instructions executed.
 */
export function createStaticSplitScreenStates() {
  const leftState = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: true,
    useDecomposedBuffer: true,
    useDecomposedConsumer: true,
  });
  leftState.slots = [
    { id: 'A', name: 'Order A', slotIndex: 0 },
    { id: 'B', name: 'Order B', slotIndex: 1 },
    null,
    null,
    null,
  ];
  leftState.in = 2;
  leftState.out = 0;
  leftState.occupancy = 2;
  leftState.empty = 3;
  leftState.full = 2;
  leftState.mutex = 1;
  leftState.mutexOwner = null;
  leftState.semaphores = {
    empty: { value: 3 },
    full: { value: 2 },
    mutex: { value: 1 },
  };
  leftState.events = [];
  leftState.firstFault = null;
  leftState.pauseRequested = false;

  const rightState = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useDecomposedBuffer: true,
    useDecomposedConsumer: true,
  });
  rightState.slots = [
    { id: 'A', name: 'Order A', slotIndex: 0 },
    { id: 'B', name: 'Order B', slotIndex: 1 },
    null,
    null,
    null,
  ];
  rightState.in = 2;
  rightState.out = 0;
  rightState.occupancy = 2;
  rightState.empty = 3;
  rightState.full = 2;
  rightState.mutex = 1;
  rightState.mutexOwner = null;
  rightState.semaphores = {
    empty: { value: 3 },
    full: { value: 2 },
    mutex: { value: 1 },
  };
  rightState.events = [];
  rightState.firstFault = null;
  rightState.pauseRequested = false;

  return { leftState, rightState };
}

/**
 * 34-Step Deterministic Normal Flow Schedule:
 * P1 (8 instructions: A prepared, buffered in slot 0, IN=1, full=1)
 * -> C1 (9 instructions: A claimed, OUT=1, empty=5, A processed)
 * -> P2 (8 instructions: B prepared, buffered in slot 1, IN=2, full=1)
 * -> C2 (9 instructions: B claimed, OUT=2, empty=5, B processed)
 */
export const NORMAL_FLOW_SCHEDULE = [
  'P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P1', 'P1',
  'C1', 'C1', 'C1', 'C1', 'C1', 'C1', 'C1', 'C1', 'C1',
  'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2',
  'C2', 'C2', 'C2', 'C2', 'C2', 'C2', 'C2', 'C2', 'C2',
];

/**
 * Clean Normal Flow baseline initializer (Capacity N=5, empty=5, full=0, empty buffer)
 */
export function createNormalFlowState() {
  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useDecomposedBuffer: true,
    useDecomposedConsumer: true,
    empty: BUFFER_CAPACITY,
    full: 0,
    initialSlots: Array(BUFFER_CAPACITY).fill(null),
    in: 0,
    out: 0,
  });

  state.requestBacklog = [
    { id: 'A', name: 'Order A', submittedStep: 0 },
    { id: 'B', name: 'Order B', submittedStep: 0 },
  ];
  state.events = [];
  state.scheduledThreadId = 'P1';
  return state;
}

/**
 * 17-Step Full Queue Schedule:
 * P1 prepares extra ticket ORD-6 -> P1 WAIT_EMPTY blocks (empty is 0)
 * -> C1 claims OUT ticket (slot 0) under mutex and signals empty
 * -> Capacity permit handed to P1, waking P1 (P1 status: READY)
 * -> P1 acquires mutex and inserts ORD-6 into slot 0 under mutex
 * -> C1 processes order outside critical section.
 */
export const FULL_QUEUE_SCHEDULE = [
  'P1', // Step 0: CREATE_ITEM (prepares extra ticket ORD-6)
  'P1', // Step 1: WAIT_EMPTY -> BLOCKS! (empty is 0)
  'C1', // Step 2: WAIT_FULL (full: 5 -> 4)
  'C1', // Step 3: LOCK (acquires mutex key)
  'C1', // Step 4: READ_OUT (targetSlot = 0)
  'C1', // Step 5: READ_ITEM (reads ORD-1)
  'C1', // Step 6: COMMIT_CLAIM (removes ORD-1 from slot 0)
  'C1', // Step 7: UPDATE_OUT (out: 0 -> 1)
  'C1', // Step 8: UNLOCK (releases mutex key)
  'C1', // Step 9: SIGNAL_EMPTY (hands off empty permit to P1; wakes P1)
  'P1', // Step 10: LOCK (acquires mutex key)
  'P1', // Step 11: READ_IN (targetSlot = 0)
  'P1', // Step 12: WRITE_SLOT (inserts ORD-6 into slot 0)
  'P1', // Step 13: UPDATE_IN (in: 0 -> 1)
  'P1', // Step 14: UNLOCK (releases mutex key)
  'P1', // Step 15: SIGNAL_FULL (full: 4 -> 5)
  'C1', // Step 16: PROCESS (cooks ORD-1)
];

/**
 * Full Queue baseline initializer:
 * Preloaded with 5 distinct tickets in slots 0-4, empty=0, full=5.
 * Mutex free, in=0, out=0. Extra request ORD-6 assigned in backlog.
 */
export function createFullQueueState() {
  const fullOrders = [
    { id: 'ORD-1', name: 'Masala Dosa', label: 'Order #1: Masala Dosa' },
    { id: 'ORD-2', name: 'Filter Coffee', label: 'Order #2: Filter Coffee' },
    { id: 'ORD-3', name: 'Veg Thali', label: 'Order #3: Veg Thali' },
    { id: 'ORD-4', name: 'Samosa Plate', label: 'Order #4: Samosa Plate' },
    { id: 'ORD-5', name: 'Mango Lassi', label: 'Order #5: Mango Lassi' },
  ];

  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useDecomposedBuffer: true,
    useDecomposedConsumer: true,
    empty: 0,
    full: 5,
    initialSlots: [...fullOrders],
    in: 0,
    out: 0,
  });

  state.occupancy = 5;
  state.empty = 0;
  state.full = 5;
  state.slots = [...fullOrders];
  state.in = 0;
  state.out = 0;

  state.requestBacklog = [
    { id: 'ORD-6', name: 'Chai Latte', label: 'Order #6: Chai Latte' },
  ];

  state.setupNote = 'Five existing tickets are preloaded for this lesson.';
  state.events = [];
  state.scheduledThreadId = 'P1';
  return state;
}

/**
 * 17-Step Empty Queue Schedule:
 * C1 WAIT_FULL blocks (full is 0)
 * -> P1 produces and inserts ORD-1 into slot 0 under mutex, then signals full
 * -> Available-item permit handed to C1, waking C1 (C1 status: READY)
 * -> C1 acquires mutex and accepts ORD-1 from slot 0
 * -> C1 releases mutex and processes order outside critical section.
 */
export const EMPTY_QUEUE_SCHEDULE = [
  'C1', // Step 0: WAIT_FULL -> BLOCKS! (full is 0)
  'P1', // Step 1: CREATE_ITEM (prepares ORD-1)
  'P1', // Step 2: WAIT_EMPTY (empty: 5 -> 4)
  'P1', // Step 3: LOCK (acquires mutex key)
  'P1', // Step 4: READ_IN (targetSlot = 0)
  'P1', // Step 5: WRITE_SLOT (inserts ORD-1 into slot 0)
  'P1', // Step 6: UPDATE_IN (in: 0 -> 1)
  'P1', // Step 7: UNLOCK (releases mutex key)
  'P1', // Step 8: SIGNAL_FULL (hands off full permit to C1; wakes C1)
  'C1', // Step 9: LOCK (acquires mutex key)
  'C1', // Step 10: READ_OUT (targetSlot = 0)
  'C1', // Step 11: READ_ITEM (reads ORD-1)
  'C1', // Step 12: COMMIT_CLAIM (removes ORD-1 from slot 0)
  'C1', // Step 13: UPDATE_OUT (out: 0 -> 1)
  'C1', // Step 14: UNLOCK (releases mutex key)
  'C1', // Step 15: SIGNAL_EMPTY (empty: 4 -> 5)
  'C1', // Step 16: PROCESS (cooks ORD-1)
];

/**
 * Empty Queue baseline initializer:
 * Empty buffer (capacity N=5, slots all null), empty=5, full=0.
 * Mutex free, in=0, out=0. One request ORD-1 in backlog.
 */
export function createEmptyQueueState() {
  const state = createInitialSyncState({
    capacity: BUFFER_CAPACITY,
    withoutMutex: false,
    useDecomposedBuffer: true,
    useDecomposedConsumer: true,
    empty: BUFFER_CAPACITY,
    full: 0,
    initialSlots: Array(BUFFER_CAPACITY).fill(null),
    in: 0,
    out: 0,
  });

  state.occupancy = 0;
  state.empty = 5;
  state.full = 0;
  state.slots = Array(BUFFER_CAPACITY).fill(null);
  state.in = 0;
  state.out = 0;

  state.requestBacklog = [
    { id: 'ORD-1', name: 'Masala Dosa', label: 'Order #1: Masala Dosa' },
  ];

  state.setupNote = 'Buffer is initially empty.';
  state.events = [];
  state.scheduledThreadId = 'C1';
  return state;
}

/**
 * Structured What / Why educational explanation generator
 * Consumes committed engine events with actual IDs and values.
 */
export function getStructuredTeachingExplanation(state, lastEvent = null) {
  if (!lastEvent || !state || state.stepCounter === 0) {
    if (state?.setupNote) {
      return {
        what: 'Lesson setup initialized.',
        why: state.setupNote,
      };
    }
    return {
      what: 'No instruction has executed yet.',
      why: 'Buffer initialized with capacity N=5, empty=5, and full=0. Ready to begin normal execution.',
    };
  }

  const { type, threadId, details = {}, message } = lastEvent;

  switch (type) {
    case 'ITEM_CREATED': {
      const ticketId = details.itemId || 'ticket';
      return {
        what: `${threadId} prepared local order token [${ticketId}].`,
        why: 'The producer creates the order token in private memory before requesting shared buffer resources.',
      };
    }

    case 'PERMIT_ACQUIRED': {
      if (details.permit === 'empty') {
        const remaining = details.remaining !== undefined ? details.remaining : state.empty;
        const prev = remaining + 1;
        return {
          what: `${threadId} reserved capacity: empty changed from ${prev} to ${remaining}.`,
          why: 'A producer needs an available capacity permit (empty > 0) before inserting an order.',
        };
      }
      const remaining = details.remaining !== undefined ? details.remaining : state.full;
      const prev = remaining + 1;
      return {
        what: `${threadId} acquired an available order permit: full changed from ${prev} to ${remaining}.`,
        why: 'A consumer must wait until at least one order is published (full > 0) before accessing the queue.',
      };
    }

    case 'MUTEX_ACQUIRED': {
      return {
        what: `${threadId} acquired the queue mutex.`,
        why: 'Mutual exclusion ensures only one thread accesses shared buffer pointers and slots at a time.',
      };
    }

    case 'READ_POINTER': {
      const targetSlot = details.targetSlot !== undefined ? details.targetSlot : state.in;
      return {
        what: `${threadId} copied IN = ${targetSlot} into its local target register.`,
        why: 'This local register identifies where the producer will write its ticket inside the critical section.',
      };
    }

    case 'READ_OUT': {
      const targetSlot = details.targetSlot !== undefined ? details.targetSlot : state.out;
      return {
        what: `${threadId} copied OUT = ${targetSlot} into its local target register.`,
        why: 'This local register identifies where the consumer will read its ticket inside the critical section.',
      };
    }

    case 'READ_ITEM': {
      const slotIdx = details.slotIndex !== undefined ? details.slotIndex : 0;
      const candidateId = details.candidateId || 'ticket';
      return {
        what: `${threadId} read ticket from slot [${slotIdx}]: ${candidateId}.`,
        why: 'The consumer inspects the ticket in the target slot under mutex protection.',
      };
    }

    case 'ITEM_INSERTED': {
      const ticketId = details.itemId || 'ticket';
      const slotIdx = details.slotIndex !== undefined ? details.slotIndex : state.in;
      return {
        what: `${threadId} inserted ${ticketId} into slot ${slotIdx}.`,
        why: 'The ticket now occupies a shared buffer slot; it becomes available when published.',
      };
    }

    case 'ITEM_REMOVED': {
      const ticketId = details.itemId || 'ticket';
      const slotIdx = details.slotIndex !== undefined ? details.slotIndex : state.out;
      return {
        what: `${threadId} accepted ${ticketId} from slot ${slotIdx}.`,
        why: 'The order has left the shared buffer and now belongs exclusively to kitchen staff.',
      };
    }

    case 'POINTER_ADVANCED': {
      if (details.pointer === 'IN') {
        return {
          what: `${threadId} advanced IN from ${details.from} to ${details.to}.`,
          why: 'The next producer insertion will target the next circular buffer slot.',
        };
      }
      return {
        what: `${threadId} advanced OUT from ${details.from} to ${details.to}.`,
        why: 'The next consumer removal will target the next circular buffer slot.',
      };
    }

    case 'MUTEX_RELEASED': {
      return {
        what: `${threadId} released the queue mutex (lock is now free).`,
        why: 'Exiting the critical section allows other waiting threads to acquire the lock.',
      };
    }

    case 'PERMIT_SIGNALED': {
      if (details.permit === 'full') {
        const count = details.count !== undefined ? details.count : state.full;
        const prev = count - 1;
        return {
          what: `${threadId} published an available ticket: full changed from ${prev} to ${count}.`,
          why: 'A consumer can now obtain the corresponding full permit and accept the meal order.',
        };
      }
      const count = details.count !== undefined ? details.count : state.empty;
      const prev = count - 1;
      return {
        what: `${threadId} released one capacity permit: empty changed from ${prev} to ${count}.`,
        why: 'Producers can now reuse the released capacity to buffer subsequent orders.',
      };
    }

    case 'ITEM_PROCESSED': {
      const ticketId = details.itemId || (threadId === 'C1' ? 'A' : 'B');
      return {
        what: `${threadId} processed order ${ticketId}.`,
        why: 'Cooking and packaging occur outside the queue critical section to maximize concurrency.',
      };
    }

    case 'THREAD_BLOCKED': {
      const reason = details.waitingFor || 'resource';
      if (reason === 'empty') {
        return {
          what: `${threadId} tried to reserve capacity, but empty is 0. ${threadId} is now waiting.`,
          why: `The five-slot buffer has no available capacity permit. ${threadId} keeps its ticket outside the buffer.`,
        };
      }
      if (reason === 'full') {
        return {
          what: `${threadId} tried to reserve an order, but full is 0. ${threadId} is now waiting.`,
          why: 'The consumer waits rather than reading an empty queue.',
        };
      }
      return {
        what: `${threadId} blocked waiting for mutex lock.`,
        why: 'Only one thread can enter the queue critical section at a time; others wait in the mutex wait queue.',
      };
    }

    case 'THREAD_RESUMED': {
      const woken = details.wokenThreadId || 'thread';
      if (details.permit === 'empty') {
        return {
          what: `${threadId} released capacity and made ${woken} runnable.`,
          why: 'The waiting producer has received a permit. Its next instruction runs later; it has not inserted yet.',
        };
      }
      const ticketId = details.itemId || (threadId === 'P1' ? 'ORD-1' : 'ticket');
      return {
        what: `${threadId} published ticket ${ticketId} and made ${woken} runnable.`,
        why: 'An available-item permit was transferred to the waiting consumer.',
      };
    }

    case 'CYCLE_COMPLETED': {
      return {
        what: `${threadId} completed its full cycle.`,
        why: 'The thread is ready for the next customer request or order processing cycle.',
      };
    }

    default:
      return {
        what: message || `${threadId} executed instruction.`,
        why: 'Authoritative state transition committed by simulation engine.',
      };
  }
}


