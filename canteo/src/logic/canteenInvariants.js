export const BUFFER_CAPACITY = 5;

/**
 * Validates system-wide invariants for the bounded-buffer canteen queue.
 * @param {Object} state - The current canteen reducer state.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInvariants(state) {
  const errors = [];

  // Invariant 1: queue.length <= BUFFER_CAPACITY
  if (state.queue.length > BUFFER_CAPACITY) {
    errors.push(`Invariant Violation: queue.length (${state.queue.length}) > ${BUFFER_CAPACITY}`);
  }

  // Invariant 2: empty === BUFFER_CAPACITY - queue.length
  if (state.empty !== BUFFER_CAPACITY - state.queue.length) {
    errors.push(`Invariant Violation: empty (${state.empty}) !== ${BUFFER_CAPACITY} - queue.length (${state.queue.length})`);
  }

  // Invariant 3: full === queue.length
  if (state.full !== state.queue.length) {
    errors.push(`Invariant Violation: full (${state.full}) !== queue.length (${state.queue.length})`);
  }

  // Invariant 4: empty + full === BUFFER_CAPACITY
  if (state.empty + state.full !== BUFFER_CAPACITY) {
    errors.push(`Invariant Violation: empty (${state.empty}) + full (${state.full}) !== ${BUFFER_CAPACITY}`);
  }

  // Invariant 5: non-negative semaphore counters
  if (state.empty < 0 || state.full < 0) {
    errors.push(`Invariant Violation: Semaphore counter negative (empty: ${state.empty}, full: ${state.full})`);
  }

  // Invariant 6: mutex binary state
  if (state.mutex !== 0 && state.mutex !== 1) {
    errors.push(`Invariant Violation: Mutex must be binary (current: ${state.mutex})`);
  }

  // Invariant 7: Unique order IDs across all partitions
  const seenIds = new Map();
  const checkCollection = (items, collectionName) => {
    if (!items) return;
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
      if (item && item.id) {
        if (seenIds.has(item.id)) {
          errors.push(
            `Invariant Violation: Duplicate order ID "${item.id}" in "${collectionName}" and "${seenIds.get(item.id)}"`
          );
        } else {
          seenIds.set(item.id, collectionName);
        }
      }
    }
  };

  checkCollection(state.queue, 'queue');
  checkCollection(state.blockedProducers, 'blockedProducers');
  if (state.activeOrder) {
    checkCollection(state.activeOrder, 'activeOrder');
  }
  checkCollection(state.readyOrders, 'readyOrders');
  checkCollection(state.history, 'history');

  return {
    valid: errors.length === 0,
    errors,
  };
}
