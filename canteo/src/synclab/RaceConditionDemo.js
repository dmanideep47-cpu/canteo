export const RACE_ORDERS = [
  { id: 'O01', name: 'Masala Dosa', crop: [0, 0] },
  { id: 'O02', name: 'Idli & Sambar', crop: [1, 0] },
  { id: 'O03', name: 'Vegetable Sandwich', crop: [2, 0] },
];

export const RACE_STEP_COUNTS = { unsafe: 4, safe: 6 };

export function createRaceState(mode = 'unsafe') {
  return {
    mode,
    step: 0,
    orders: [...RACE_ORDERS, null, null].map((order) => order && { ...order, claimedBy: [] }),
    readPosition: 0,
    mutexOwner: null,
    mutexWaiter: null,
    workers: {
      C1: { action: 'Waiting for an order', localRead: null, assigned: null, stale: false },
      C2: { action: 'Waiting for an order', localRead: null, assigned: null, stale: false },
    },
    last: null,
  };
}

function claimOrder(state, workerId, orderId) {
  const order = state.orders.find((item) => item?.id === orderId);
  if (!order) return state;
  order.claimedBy.push(workerId);
  const conflict = order.claimedBy.length > 1;
  state.workers[workerId] = {
    ...state.workers[workerId],
    action: conflict ? 'Assigned the same ticket as C1' : `Assigned ${orderId}`,
    assigned: order,
    stale: conflict,
  };
  if (!conflict) state.readPosition = (state.readPosition + 1) % state.orders.length;
}

export function stepRaceState(previous) {
  if (previous.step >= RACE_STEP_COUNTS[previous.mode]) return previous;
  const state = {
    ...previous,
    step: previous.step + 1,
    orders: previous.orders.map((order) => order && { ...order, claimedBy: [...order.claimedBy] }),
    workers: { C1: { ...previous.workers.C1 }, C2: { ...previous.workers.C2 } },
  };
  const { step, mode } = state;
  let actor;
  let slot = null;
  let explanation;
  let detail;

  if (mode === 'unsafe') {
    if (step === 1 || step === 2) {
      actor = step === 1 ? 'C1' : 'C2';
      slot = state.readPosition;
      const order = state.orders[slot];
      state.workers[actor] = { ...state.workers[actor], action: `Read slot ${slot}`, localRead: order?.id ?? null };
      explanation = `${actor} reads ${order?.id ?? 'an empty slot'} at the queue head. The shared pointer has not moved.`;
      detail = `${actor}.localRead = queue[${slot}]`;
    } else if (step === 3) {
      actor = 'C1';
      slot = state.readPosition;
      const order = state.orders[slot];
      claimOrder(state, actor, order?.id);
      const currentHead = state.orders[state.readPosition]?.id ?? null;
      const c2ReadIsStale = state.workers.C2.localRead !== null && state.workers.C2.localRead !== currentHead;
      state.workers.C2 = { ...state.workers.C2, stale: c2ReadIsStale, action: c2ReadIsStale ? 'Earlier read is now stale' : state.workers.C2.action };
      explanation = `C1 assigns ${order?.id} and advances the shared read pointer to slot ${state.readPosition}. C2 still holds its earlier local value.`;
      detail = `claim(${order?.id}); readPosition = ${state.readPosition}`;
    } else {
      actor = 'C2';
      const orderId = state.workers.C2.localRead;
      slot = state.orders.findIndex((item) => item?.id === orderId);
      claimOrder(state, actor, orderId);
      explanation = `C2 uses its saved value ${orderId ?? '∅'} after the shared pointer changed to slot ${slot}. The model records two assignments to one ticket; it does not remove the ticket twice.`;
      detail = `C2.localRead = ${orderId ?? '∅'}; current head = ${state.orders[slot]?.id ?? 'empty'}`;
    }
  } else if (step === 1) {
    actor = 'C1'; state.mutexOwner = 'C1'; state.workers.C1.action = 'Acquired mutex';
    explanation = 'C1 acquires the mutex and enters the queue’s protected section.';
    detail = 'wait(mutex) → acquired';
  } else if (step === 2) {
    actor = 'C2'; state.mutexWaiter = 'C2'; state.workers.C2.action = 'Waiting for C1 to release mutex';
    explanation = 'C2 attempts to enter while C1 owns the mutex, so C2 waits without reading the queue.';
    detail = 'wait(mutex) → blocked';
  } else if (step === 3) {
    actor = 'C1'; slot = state.readPosition;
    const order = state.orders[slot];
    state.workers.C1 = { ...state.workers.C1, action: `Assigned ${order?.id}`, localRead: order?.id ?? null, assigned: order };
    if (order) order.claimedBy.push('C1');
    state.readPosition = (state.readPosition + 1) % state.orders.length;
    state.mutexOwner = null; state.workers.C1.action = `Assigned ${order?.id}; released mutex`;
    explanation = `C1 assigns ${order?.id}, advances the shared head, then releases the mutex.`;
    detail = `claim(${order?.id}); signal(mutex)`;
  } else if (step === 4) {
    actor = 'C2'; state.mutexOwner = 'C2'; state.mutexWaiter = null; state.workers.C2.action = 'Acquired mutex after waiting';
    explanation = 'After C1 releases the lock, C2 proceeds and acquires the mutex.';
    detail = 'C2 resumes → wait(mutex) succeeds';
  } else if (step === 5) {
    actor = 'C2'; slot = state.readPosition;
    const order = state.orders[slot];
    state.workers.C2 = { ...state.workers.C2, action: `Read current head at slot ${slot}`, localRead: order?.id ?? null };
    explanation = `C2 reads the updated queue head at slot ${slot}: ${order?.id ?? 'empty'}.`;
    detail = `C2.localRead = queue[${slot}]`;
  } else {
    actor = 'C2'; slot = state.readPosition;
    const orderId = state.workers.C2.localRead;
    claimOrder(state, actor, orderId);
    state.workers.C2.action = `Assigned ${orderId}; released mutex`;
    state.readPosition = (state.readPosition + 1) % state.orders.length;
    state.mutexOwner = null;
    explanation = `C2 assigns ${orderId} and releases the mutex. C1 and C2 hold distinct FIFO orders.`;
    detail = `claim(${orderId}); signal(mutex)`;
  }
  state.last = { step, actor, slot, explanation, detail };
  return state;
}

export function getRaceOutcome(state) {
  if (state.step < RACE_STEP_COUNTS[state.mode]) return null;
  const first = state.workers.C1.assigned?.id ?? null;
  const second = state.workers.C2.assigned?.id ?? null;
  return { first, second, conflict: Boolean(first && first === second) };
}
