/**
 * Helper utilities for SyncLab Arena status messages, lifecycle summaries,
 * instruction parsing, and deterministic pseudo-random scheduling.
 */

/**
 * Derives a concise, accurate system status line near execution controls.
 * Adheres strictly to engine state without recommending additions when runnable threads exist.
 */
export function deriveSystemStatus({
  state,
  isPlaying = false,
  schedulingMode = 'roundRobin',
  selectedProcessId = null,
  integrityFailure = null,
}) {
  if (integrityFailure) {
    return {
      statusKey: 'FAILURE',
      badge: 'FAULT',
      badgeColor: 'danger',
      message: `Synchronization failure: ${integrityFailure.label || integrityFailure.invariant}.`,
    };
  }

  const processes = state?.processes || [];
  const workers = state?.workers || [];
  const emptyVal = typeof state?.empty === 'number' ? state.empty : (state?.empty?.value ?? 5);
  const fullVal = typeof state?.full === 'number' ? state.full : (state?.full?.value ?? 0);
  const mutexOwner = state?.mutexOwner ?? (state?.mutex === 0 ? state?.lastScheduledId : null);

  // 1. Empty session
  if (processes.length === 0) {
    return {
      statusKey: 'EMPTY',
      badge: 'IDLE',
      badgeColor: 'neutral',
      message: 'Empty session · Add a student producer or kitchen consumer.',
    };
  }

  // 2. All finite workloads completed
  const allCompleted = processes.length > 0 && processes.every((p) => p.state === 'COMPLETED');
  const activePrep = workers.filter((w) => w.state === 'PREPARING');
  if (allCompleted && activePrep.length === 0) {
    return {
      statusKey: 'COMPLETED',
      badge: 'FINISHED',
      badgeColor: 'success',
      message: 'All finite workloads completed.',
    };
  }

  // 3. Active kitchen preparation
  if (activePrep.length > 0) {
    const prepCount = activePrep.length;
    const orderPlural = prepCount === 1 ? 'order' : 'orders';
    return {
      statusKey: 'PREPARING',
      badge: 'PREPARING',
      badgeColor: 'warning',
      message: `Preparing ${prepCount} ${orderPlural}.`,
    };
  }

  // Count producers and runnable producers
  const producers = processes.filter((p) => p.type === 'PRODUCER');
  const runnableProducers = producers.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
  const consumers = processes.filter((p) => p.type === 'CONSUMER');
  const runnableConsumers = consumers.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
  const readyCandidates = processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');

  // 4. Waiting for capacity (buffer full, empty == 0)
  const waitingForCapacity = producers.some((p) => p.state === 'BLOCKED' && p.waitingFor === 'empty');
  if (emptyVal === 0 || (waitingForCapacity && emptyVal === 0)) {
    return {
      statusKey: 'WAITING_CAPACITY',
      badge: 'WAITING',
      badgeColor: 'warning',
      message: 'Waiting for capacity · Run a consumer.',
    };
  }

  // 5. Waiting for orders (buffer empty, full == 0)
  const consumersWaitingForOrders = consumers.some((p) => p.state === 'BLOCKED' && p.waitingFor === 'full');
  if (fullVal === 0 && (consumersWaitingForOrders || consumers.length > 0 && runnableConsumers.length === 0)) {
    if (producers.length === 0) {
      return {
        statusKey: 'WAITING_ORDERS_ADD',
        badge: 'WAITING',
        badgeColor: 'warning',
        message: 'Waiting for orders · Add or run a producer.',
      };
    }
    if (runnableProducers.length > 0) {
      if (!isPlaying) {
        return {
          statusKey: 'PAUSED_READY',
          badge: 'PAUSED',
          badgeColor: 'neutral',
          message: 'Paused · Press Play to execute ready processes.',
        };
      }
      return {
        statusKey: 'RUN_PRODUCER',
        badge: 'RUNNABLE',
        badgeColor: 'info',
        message: 'Waiting for orders · Run a producer.',
      };
    }
  }

  // 6. Mutex contention
  if (mutexOwner && processes.some((p) => p.state === 'WAITING' && p.waitingFor === 'mutex')) {
    const contendedCount = processes.filter((p) => p.state === 'WAITING' && p.waitingFor === 'mutex').length;
    return {
      statusKey: 'MUTEX_HELD',
      badge: 'LOCKED',
      badgeColor: 'warning',
      message: `Critical section held by ${mutexOwner} · ${contendedCount} thread(s) waiting.`,
    };
  }

  // 7. Paused with runnable processes
  if (!isPlaying) {
    if (readyCandidates.length > 0) {
      return {
        statusKey: 'PAUSED',
        badge: 'PAUSED',
        badgeColor: 'neutral',
        message: 'Paused · Press Play to execute ready processes.',
      };
    }
    return {
      statusKey: 'PAUSED_IDLE',
      badge: 'PAUSED',
      badgeColor: 'neutral',
      message: 'Paused · No runnable threads.',
    };
  }

  // 8. Actively playing
  return {
    statusKey: 'PLAYING',
    badge: 'PLAYING',
    badgeColor: 'success',
    message: `Running · ${schedulingMode === 'roundRobin' ? 'Round-Robin' : schedulingMode === 'random' ? 'Random' : 'Manual'} scheduling active.`,
  };
}

/**
 * Derives a structured communication for the last executed event:
 * 1. Which process acted.
 * 2. What completed or blocked.
 * 3. What changed.
 */
export function deriveLastEventDetails(state) {
  if (!state) return null;

  const events = state.events || [];
  const latestEvent = events[0];
  const lastInstruction = state.lastInstruction;
  const variableChanges = state.variableChanges;

  if (!latestEvent && !lastInstruction) {
    return {
      processId: null,
      action: 'Session initialized',
      changed: 'Buffer empty (5 free slots, mutex unlocked)',
      summaryText: 'Session initialized · Buffer empty, semaphores ready.',
    };
  }

  // 1. Process who acted
  const processId = latestEvent?.processId || latestEvent?.causedBy || lastInstruction?.processId || 'System';

  // 2. What completed or blocked
  let action = latestEvent?.message || lastInstruction?.instruction?.label || 'Executed instruction';
  if (latestEvent?.type === 'insert') {
    action = `inserted ${latestEvent.orderId || 'order'} into slot [${latestEvent.slot ?? 0}]`;
  } else if (latestEvent?.type === 'remove') {
    action = `collected ${latestEvent.orderId || 'order'} from slot [${latestEvent.slot ?? 0}]`;
  } else if (latestEvent?.type === 'blocked') {
    action = `blocked on ${latestEvent.operation || latestEvent.message}`;
  } else if (latestEvent?.type === 'kitchen-tick') {
    action = `advanced kitchen preparation (${latestEvent.progressAfter}/${latestEvent.preparationDuration})`;
  } else if (latestEvent?.type === 'order-completed') {
    action = `completed handover of ${latestEvent.orderId}`;
  } else if (latestEvent?.type === 'process-stopping') {
    action = 'marked for graceful stop after current cycle';
  } else if (latestEvent?.type === 'process-removed') {
    action = 'safely removed from simulation';
  }

  // Normalize so process ID isn't duplicated when prepended in summaryText
  if (action && processId && action.startsWith(`${processId} `)) {
    action = action.slice(processId.length + 1);
  }

  // 3. What changed
  const changes = [];
  if (variableChanges?.before && variableChanges?.after) {
    const { before, after } = variableChanges;
    if (before.empty !== after.empty) changes.push(`empty ${before.empty}→${after.empty}`);
    if (before.full !== after.full) changes.push(`full ${before.full}→${after.full}`);
    if (before.mutex !== after.mutex) changes.push(`mutex ${before.mutex ? '1' : '0'}→${after.mutex ? '1' : '0'}`);
    if (before.occupancy !== after.occupancy) changes.push(`occ ${before.occupancy}→${after.occupancy}/5`);
    if (before.writePosition !== after.writePosition) changes.push(`in [${before.writePosition}]→[${after.writePosition}]`);
    if (before.readPosition !== after.readPosition) changes.push(`out [${before.readPosition}]→[${after.readPosition}]`);
  }

  const changed = changes.length > 0 ? changes.join(', ') : (latestEvent?.explanation || 'State updated');

  return {
    processId,
    action,
    changed,
    summaryText: `${processId} ${action} · ${changed}`,
  };
}

/**
 * Derives session summary counts:
 * Produced · Collected · Completed
 * Directly derived from real lifecycle events and order states.
 * Guarantees collection is NOT counted as completion.
 */
export function deriveSessionSummary(events = [], orders = []) {
  // 1. Produced: Number of distinct orders inserted into the buffer
  const insertedOrderIds = new Set();
  for (const ev of events) {
    if ((ev.operation === 'insert' || ev.type === 'insert') && ev.orderId) {
      insertedOrderIds.add(ev.orderId);
    }
  }
  for (const o of orders) {
    if (o.lifecycle && o.lifecycle !== 'CREATED') {
      insertedOrderIds.add(o.id);
    }
  }
  const produced = insertedOrderIds.size;

  // 2. Collected: Number of orders dequeued by consumers from the buffer
  const collectedOrderIds = new Set();
  for (const ev of events) {
    if ((ev.operation === 'remove' || ev.type === 'remove') && ev.orderId) {
      collectedOrderIds.add(ev.orderId);
    }
  }
  for (const o of orders) {
    if (['PREPARING', 'READY', 'COMPLETED'].includes(o.lifecycle)) {
      collectedOrderIds.add(o.id);
    }
  }
  const collected = collectedOrderIds.size;

  // 3. Completed: Orders whose kitchen preparation has actually finished (READY or COMPLETED)
  // NEVER count collection as completion!
  const completedOrderIds = new Set();
  for (const ev of events) {
    if (ev.type === 'order-completed') {
      if (ev.orderId) completedOrderIds.add(ev.orderId);
    }
    if (ev.type === 'kitchen-tick' && ev.progressAfter && ev.preparationDuration) {
      if (ev.progressAfter >= ev.preparationDuration && ev.orderId) {
        completedOrderIds.add(ev.orderId);
      }
    }
  }
  for (const o of orders) {
    if (o.lifecycle === 'READY' || o.lifecycle === 'COMPLETED') {
      completedOrderIds.add(o.id);
    }
  }
  const completed = completedOrderIds.size;

  return {
    produced,
    collected,
    completed,
  };
}

/**
 * Filters recorded events to meaningful user-facing lifecycle events for Recent Activity:
 * - Process created
 * - Order inserted
 * - Order collected
 * - Preparation completed
 * - Removal requested
 * - Process removed
 */
export function filterRecentLifecycleEvents(events = [], maxCount = 8) {
  const result = [];

  for (const ev of events) {
    let category = null;
    let label = null;
    let iconKind = 'info';

    if (ev.type === 'process' || ev.operation?.includes('Created') || ev.message?.includes('created as a')) {
      category = 'PROCESS_CREATED';
      label = 'Process created';
      iconKind = 'user-plus';
    } else if (ev.operation === 'insert' || ev.type === 'insert') {
      category = 'ORDER_INSERTED';
      label = 'Order inserted';
      iconKind = 'plus-circle';
    } else if (ev.operation === 'remove' || ev.type === 'remove') {
      category = 'ORDER_COLLECTED';
      label = 'Order collected';
      iconKind = 'arrow-down-circle';
    } else if (ev.type === 'order-completed' || (ev.type === 'kitchen-tick' && ev.progressAfter >= ev.preparationDuration)) {
      category = 'PREPARATION_COMPLETED';
      label = 'Preparation completed';
      iconKind = 'check-circle';
    } else if (ev.type === 'process-stopping') {
      category = 'REMOVAL_REQUESTED';
      label = 'Removal requested';
      iconKind = 'clock';
    } else if (ev.type === 'process-removed' || ev.type === 'process-retired') {
      category = 'PROCESS_REMOVED';
      label = 'Process removed';
      iconKind = 'trash-2';
    } else if (ev.type === 'blocked') {
      category = 'PROCESS_BLOCKED';
      label = 'Process blocked';
      iconKind = 'alert-triangle';
    }

    if (category) {
      result.push({
        id: ev.id || `${ev.step}-${result.length}`,
        step: ev.step,
        category,
        label,
        iconKind,
        processId: ev.processId || ev.causedBy || '—',
        orderId: ev.orderId || null,
        message: ev.message,
        variablesBefore: ev.variablesBefore,
        variablesAfter: ev.variablesAfter,
      });
    }

    if (result.length >= maxCount) break;
  }

  return result;
}

/**
 * Mulberry32 seeded pseudo-random number generator for deterministic random scheduling.
 */
export function createMulberry32(seed = 1337) {
  let a = seed >>> 0;
  return function nextRandom() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
