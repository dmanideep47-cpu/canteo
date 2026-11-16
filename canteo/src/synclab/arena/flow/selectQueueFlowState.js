/**
 * Pure selector that transforms an engine snapshot and event history into
 * a structured view model for the Live Queue Flow visualization.
 *
 * Adheres strictly to authoritative engine state:
 * - Derives logical FIFO order starting from readPosition forward across modulo-5 slots.
 * - Extracts actual semaphore wait queues without fabricating queue order.
 * - Separates buffer orders from waiting processes.
 * - Tracks active concurrent kitchen preparations with real tick progression.
 * - Derives bounded recently completed orders.
 */

export function selectQueueFlowState(snapshot, isPlaying = false) {
  if (!snapshot) {
    return {
      isLive: false,
      playbackStatus: 'Idle',
      isEntirelyEmpty: true,
      activeStageKey: null,
      activeOrderId: null,
      producers: [],
      producerWaiters: [],
      bufferFifoOrders: [],
      bufferOccupancy: { occupied: 0, capacity: 5, readPosition: 0, writePosition: 0, free: 5 },
      consumerWaiters: [],
      consumerMutexWaiters: [],
      preparingAssignments: [],
      completedOrders: [],
      completedTotal: 0,
      latestExplanation: 'Ready · Start the simulation or step an instruction to watch orders flow through the system.',
      latestShortExplanation: 'Ready to execute ready processes.',
      latestTechnicalDetails: '',
      hasProducers: false,
      hasConsumers: false,
    };
  }

  const capacity = snapshot.capacity ?? 5;
  const readPos = Number.isInteger(snapshot.readPosition) ? snapshot.readPosition : 0;
  const writePos = Number.isInteger(snapshot.writePosition) ? snapshot.writePosition : 0;
  const slots = snapshot.slots || [];
  const processes = snapshot.processes || [];
  const workers = snapshot.workers || [];
  const allOrders = snapshot.orders || [];
  const events = snapshot.events || [];
  const emptyWaiters = snapshot.emptyWaiters || [];
  const fullWaiters = snapshot.fullWaiters || [];
  const mutexWaiters = snapshot.mutexWaiters || [];
  const mutexOwner = snapshot.mutexOwner ?? null;

  // --------------------------------------------------------------------------
  // 1. PRODUCER REQUESTS STAGE
  // --------------------------------------------------------------------------
  const rawProducers = processes.filter((p) => p.type === 'PRODUCER');
  const producers = rawProducers.map((p) => {
    const isStopping = Boolean(p.stoppingRequested);
    const isBlockedOnEmpty = (p.state === 'BLOCKED' || p.state === 'WAITING') && p.waitingFor === 'empty';
    const isBlockedOnMutex = (p.state === 'WAITING' || p.state === 'BLOCKED') && p.waitingFor === 'mutex';
    const isProducing = p.state === 'RUNNING' || (p.pc > 0 && p.pc < 5 && p.permit);
    const isCompleted = p.state === 'COMPLETED';

    let stateKey = 'READY';
    let stateLabel = 'Ready to execute';
    let badgeTone = 'ready';

    if (isStopping) {
      stateKey = 'STOPPING';
      stateLabel = 'Stopping after cycle';
      badgeTone = 'stopping';
    } else if (isBlockedOnEmpty) {
      stateKey = 'WAITING_CAPACITY';
      stateLabel = 'Waiting for capacity';
      badgeTone = 'waiting';
    } else if (isBlockedOnMutex) {
      stateKey = 'WAITING_MUTEX';
      stateLabel = 'Waiting for mutex';
      badgeTone = 'mutex';
    } else if (isProducing) {
      stateKey = 'PRODUCING';
      stateLabel = p.acquiredMutex ? 'In critical section' : 'Producing';
      badgeTone = 'producing';
    } else if (isCompleted) {
      stateKey = 'COMPLETED';
      stateLabel = 'Completed';
      badgeTone = 'completed';
    }

    const waitQueueIndex = emptyWaiters.indexOf(p.id);

    return {
      id: p.id,
      type: 'PRODUCER',
      stateKey,
      stateLabel,
      badgeTone,
      orderId: p.orderId || p.order || null,
      foodName: p.foodName || null,
      permit: Boolean(p.permit),
      acquiredMutex: Boolean(p.acquiredMutex),
      pc: p.pc ?? 0,
      stoppingRequested: isStopping,
      waitQueueIndex: waitQueueIndex !== -1 ? waitQueueIndex + 1 : null,
    };
  });

  // --------------------------------------------------------------------------
  // 2. SHARED BUFFER · LOGICAL FIFO EXTRACTION
  // --------------------------------------------------------------------------
  const bufferFifoOrders = [];
  for (let offset = 0; offset < capacity; offset += 1) {
    const physicalSlotIndex = (readPos + offset) % capacity;
    const slot = slots[physicalSlotIndex];
    if (slot && slot.id) {
      const isNextToCollect = bufferFifoOrders.length === 0;
      bufferFifoOrders.push({
        id: slot.id,
        label: slot.label || slot.id,
        foodName: slot.foodName || 'Canteen Meal',
        producer: slot.producer || 'Producer',
        lifecycle: slot.lifecycle || 'QUEUED',
        physicalSlotIndex,
        logicalOrderIndex: bufferFifoOrders.length + 1,
        isNextToCollect,
      });
    }
  }

  const occupiedCount = bufferFifoOrders.length;
  const bufferOccupancy = {
    occupied: occupiedCount,
    capacity,
    readPosition: readPos,
    writePosition: writePos,
    free: Math.max(0, capacity - occupiedCount),
  };

  // --------------------------------------------------------------------------
  // 3. CONSUMER WAITING LANES
  // --------------------------------------------------------------------------
  // A. Waiting for orders on sem_wait(&full) in authoritative FIFO order
  const consumerWaiters = fullWaiters.map((id, index) => {
    const proc = processes.find((p) => p.id === id);
    return {
      id,
      queuePosition: index + 1,
      waitingFor: 'full',
      label: 'Waiting for an order',
      isStopping: Boolean(proc?.stoppingRequested),
    };
  });

  // B. Waiting for mutex lock after reserving full-order permit
  const consumerMutexWaiters = mutexWaiters
    .filter((id) => {
      const proc = processes.find((p) => p.id === id);
      return proc && proc.type === 'CONSUMER' && proc.permit;
    })
    .map((id) => {
      const proc = processes.find((p) => p.id === id);
      return {
        id,
        waitingFor: 'mutex',
        label: 'Item permit reserved · Waiting for mutex',
        isStopping: Boolean(proc?.stoppingRequested),
      };
    });

  // --------------------------------------------------------------------------
  // 4. KITCHEN PREPARATION STAGE
  // --------------------------------------------------------------------------
  const preparingAssignments = [];
  const consumerWorkers = workers.filter((w) => {
    const proc = processes.find((p) => p.id === w.id);
    return w.state === 'PREPARING' || proc?.state === 'PREPARING';
  });

  for (const worker of consumerWorkers) {
    const proc = processes.find((p) => p.id === worker.id);
    const orderId = worker.assignedOrderId || proc?.result?.id;
    const orderData = allOrders.find((o) => o.id === orderId);

    const duration = worker.preparationDuration || orderData?.preparationDuration || 3;
    const progress = worker.preparationProgress ?? orderData?.preparationProgress ?? 0;
    const remaining = worker.remainingSteps ?? Math.max(0, duration - progress);
    const foodName = worker.foodName || orderData?.foodName || proc?.result?.foodName || 'Meal';
    const percent = Math.min(100, Math.round((progress / Math.max(1, duration)) * 100));

    preparingAssignments.push({
      workerId: worker.id,
      orderId,
      foodName,
      duration,
      progress,
      remainingSteps: remaining,
      progressPercent: percent,
      isStopping: Boolean(worker.stoppingRequested || proc?.stoppingRequested),
    });
  }

  // --------------------------------------------------------------------------
  // 5. RECENTLY COMPLETED ORDERS (Bounded to latest 5, most recent first)
  // --------------------------------------------------------------------------
  const completedList = [];
  const seenCompletedIds = new Set();

  // Inspect authoritative completedOrderIds or completedOrders from snapshot
  const rawCompleted = snapshot.completedOrders || [];
  const rawReady = snapshot.readyOrders || [];

  // 1. Include finished orders from snapshot (reversed for most recent first)
  for (const ord of [...rawCompleted].reverse()) {
    if (ord && ord.id && !seenCompletedIds.has(ord.id)) {
      seenCompletedIds.add(ord.id);
      completedList.push({
        id: ord.id,
        label: ord.label || ord.id,
        foodName: ord.foodName || 'Meal',
        producer: ord.producer || null,
        lifecycle: ord.lifecycle || 'COMPLETED',
        completedBy: ord.completedBy || null,
        statusText: 'Handed over to student',
      });
    }
  }

  // 2. Also check ready orders (finished cooking outside mutex, awaiting pickup)
  for (const ord of [...rawReady].reverse()) {
    if (ord && ord.id && !seenCompletedIds.has(ord.id)) {
      seenCompletedIds.add(ord.id);
      completedList.push({
        id: ord.id,
        label: ord.label || ord.id,
        foodName: ord.foodName || 'Meal',
        producer: ord.producer || null,
        lifecycle: 'READY',
        completedBy: ord.completedBy || null,
        statusText: 'Ready for student pickup',
      });
    }
  }

  // 3. Inspect recent completion events to enrich worker identity
  for (const ev of events) {
    if ((ev.type === 'order-completed' || ev.type === 'order-ready') && ev.orderId) {
      const existing = completedList.find((c) => c.id === ev.orderId);
      if (existing && !existing.completedBy && ev.processId) {
        existing.completedBy = ev.processId;
      } else if (!existing && !seenCompletedIds.has(ev.orderId)) {
        seenCompletedIds.add(ev.orderId);
        completedList.push({
          id: ev.orderId,
          label: ev.orderId,
          foodName: ev.foodName || 'Meal',
          producer: null,
          lifecycle: ev.type === 'order-ready' ? 'READY' : 'COMPLETED',
          completedBy: ev.processId || null,
          statusText: ev.type === 'order-ready' ? 'Ready for pickup' : 'Completed',
        });
      }
    }
    if (completedList.length >= 5) break;
  }

  const boundedCompleted = completedList.slice(0, 5);

  // Authoritatively derive total completed count for the session
  const completedOrderIds = new Set();
  for (const ev of events) {
    if (ev.type === 'order-completed' && ev.orderId) {
      completedOrderIds.add(ev.orderId);
    }
    if (ev.type === 'kitchen-tick' && ev.progressAfter && ev.preparationDuration) {
      if (ev.progressAfter >= ev.preparationDuration && ev.orderId) {
        completedOrderIds.add(ev.orderId);
      }
    }
  }
  for (const o of allOrders) {
    if (o.lifecycle === 'READY' || o.lifecycle === 'COMPLETED') {
      completedOrderIds.add(o.id);
    }
  }
  for (const o of rawCompleted) {
    if (o && o.id) completedOrderIds.add(o.id);
  }
  for (const o of rawReady) {
    if (o && o.id) completedOrderIds.add(o.id);
  }
  const completedTotal = completedOrderIds.size;

  // --------------------------------------------------------------------------
  // 6. QUIET EVENT EXPLANATION & TECHNICAL DETAILS
  // --------------------------------------------------------------------------
  let latestExplanation = 'Ready · Start the simulation or step an instruction to watch orders flow through the system.';
  let latestShortExplanation = 'Ready to execute ready processes.';
  let latestTechnicalDetails = '';

  // Prefer the specific lifecycle event (insert, remove, blocked, pointer, etc.) over generic instruction wrapper
  const latestEvent = events.find((ev) => ev.type !== 'instruction' && ev.type !== 'transition') || events[0];
  if (latestEvent) {
    const pid = latestEvent.processId || latestEvent.causedBy || 'System';
    const msg = latestEvent.message || '';
    const orderId = latestEvent.orderId || 'an order';
    const slotStr = Number.isInteger(latestEvent.slot) ? `slot ${latestEvent.slot}` : 'buffer';

    if (latestEvent.type === 'insert') {
      latestShortExplanation = `${pid} inserted ${orderId} into ${slotStr}.`;
      latestTechnicalDetails = `Order joined the back of the FIFO queue. Write pointer is at [${writePos}].`;
      latestExplanation = `${pid} inserted ${orderId} into ${slotStr}. The order joined the back of the FIFO queue.`;
    } else if (latestEvent.type === 'remove') {
      latestShortExplanation = `${pid} collected ${orderId} from ${slotStr}.`;
      latestTechnicalDetails = `The read pointer advances to the next order. Consumer is preparing outside the mutex lock.`;
      latestExplanation = `${pid} collected ${orderId} from ${slotStr}. The read pointer advances to the next order.`;
    } else if (latestEvent.type === 'pointer') {
      if (latestEvent.operation === 'advanceWrite') {
        latestShortExplanation = `${pid} advanced write pointer.`;
        latestTechnicalDetails = `Modulo 5 arithmetic (in = (in + 1) % 5) wraps slot 4 back to slot 0.`;
        latestExplanation = `${pid} advanced write pointer (in = (in + 1) % 5). Modulo 5 wraps slot 4 back to slot 0.`;
      } else if (latestEvent.operation === 'advanceRead') {
        latestShortExplanation = `${pid} advanced read pointer.`;
        latestTechnicalDetails = `Next collection will read from (out = (out + 1) % 5).`;
        latestExplanation = `${pid} advanced read pointer (out = (out + 1) % 5). Next collection will read from the next slot.`;
      } else {
        latestShortExplanation = msg;
        latestTechnicalDetails = '';
        latestExplanation = msg;
      }
    } else if (latestEvent.type === 'blocked') {
      if (latestEvent.operation === 'empty' || msg.includes('empty')) {
        latestShortExplanation = `${pid} is waiting for buffer capacity.`;
        latestTechnicalDetails = `Buffer is full (5/5); sem_wait(&empty) blocks until a kitchen consumer frees a slot.`;
        latestExplanation = `${pid} is waiting for buffer capacity. Buffer is full (5/5); wait(empty) blocks until a kitchen consumer frees a slot.`;
      } else if (latestEvent.operation === 'full' || msg.includes('full')) {
        latestShortExplanation = `${pid} is waiting for an order.`;
        latestTechnicalDetails = `Buffer is empty (0/5); sem_wait(&full) blocks until a student producer inserts an order.`;
        latestExplanation = `${pid} is waiting for an order. Buffer is empty (0/5); wait(full) blocks until a student producer inserts an order.`;
      } else if (latestEvent.operation === 'mutex' || msg.includes('mutex')) {
        const ownerStr = mutexOwner ? `held by ${mutexOwner}` : 'currently locked';
        latestShortExplanation = `${pid} is waiting for buffer access.`;
        latestTechnicalDetails = `The mutual exclusion lock is ${ownerStr}.`;
        latestExplanation = `${pid} is waiting for buffer access. The mutual exclusion lock is ${ownerStr}.`;
      } else {
        latestShortExplanation = msg;
        latestTechnicalDetails = '';
        latestExplanation = msg;
      }
    } else if (latestEvent.type === 'kitchen-start') {
      latestShortExplanation = `${pid} started preparing ${orderId}.`;
      latestTechnicalDetails = `Cooking in kitchen workstation outside the mutex lock.`;
      latestExplanation = `${pid} started cooking ${orderId} in the kitchen workstation outside the mutex lock.`;
    } else if (latestEvent.type === 'kitchen-tick') {
      latestShortExplanation = `Kitchen tick advanced.`;
      latestTechnicalDetails = `Active orders cooked outside the mutex lock.`;
      latestExplanation = `Kitchen tick advanced: active orders cooked outside the mutex lock.`;
    } else if (latestEvent.type === 'order-ready') {
      latestShortExplanation = `${orderId} finished cooking.`;
      latestTechnicalDetails = `Ready for student pickup.`;
      latestExplanation = `${orderId} finished cooking and is ready for student pickup.`;
    } else if (latestEvent.type === 'order-completed') {
      latestShortExplanation = `${orderId} completed and handed over.`;
      latestTechnicalDetails = `Delivered to student and marked COMPLETED.`;
      latestExplanation = `${orderId} was delivered to the student and marked COMPLETED.`;
    } else if (latestEvent.type === 'semaphore') {
      latestShortExplanation = msg;
      latestTechnicalDetails = '';
      latestExplanation = msg;
    } else if (latestEvent.type === 'critical') {
      latestShortExplanation = msg;
      latestTechnicalDetails = '';
      latestExplanation = msg;
    } else if (latestEvent.type === 'process-stopping') {
      latestShortExplanation = `${pid} marked to stop gracefully.`;
      latestTechnicalDetails = `Retires cleanly after current cycle completes without corrupting state.`;
      latestExplanation = `${pid} owns resources; marked to retire gracefully after its current cycle completes.`;
    } else if (latestEvent.type === 'process-removed') {
      latestShortExplanation = `${pid} safely removed.`;
      latestTechnicalDetails = `Removed without permit leaks or orphaned locks.`;
      latestExplanation = `${pid} safely removed from the simulation without corrupting queue state.`;
    } else if (msg) {
      latestShortExplanation = msg;
      latestTechnicalDetails = '';
      latestExplanation = msg;
    }
  }

  // --------------------------------------------------------------------------
  // 7. ACTIVE EVENT TARGET & PRODUCER WAITERS
  // --------------------------------------------------------------------------
  const producerWaiters = emptyWaiters.map((id, index) => {
    const proc = processes.find((p) => p.id === id);
    return {
      id,
      queuePosition: index + 1,
      waitingFor: 'empty',
      label: 'Waiting for capacity',
      isStopping: Boolean(proc?.stoppingRequested),
    };
  });

  let activeStageKey = null;
  let activeOrderId = null;
  if (latestEvent) {
    activeOrderId = latestEvent.orderId || null;
    if (latestEvent.type === 'insert' || latestEvent.type === 'pointer') {
      activeStageKey = 'queue';
    } else if (latestEvent.type === 'remove' || latestEvent.type === 'kitchen-start' || latestEvent.type === 'kitchen-tick') {
      activeStageKey = 'prepare';
    } else if (latestEvent.type === 'order-ready' || latestEvent.type === 'order-completed') {
      activeStageKey = 'complete';
    } else if (latestEvent.type === 'blocked') {
      if (latestEvent.operation === 'empty' || latestEvent.message?.includes('empty')) activeStageKey = 'produce';
      else activeStageKey = 'queue';
    }
  }

  // Derive real playback status (Live / Paused / Idle)
  let playbackStatus = 'Paused';
  const isEntirelyEmpty =
    rawProducers.length === 0 &&
    processes.filter((p) => p.type === 'CONSUMER').length === 0 &&
    occupiedCount === 0 &&
    preparingAssignments.length === 0 &&
    completedTotal === 0;

  if (isPlaying) {
    playbackStatus = 'Live';
  } else if (isEntirelyEmpty) {
    playbackStatus = 'Idle';
  }

  return {
    isLive: Boolean(isPlaying),
    playbackStatus,
    isEntirelyEmpty,
    activeStageKey,
    activeOrderId,
    producers,
    producerWaiters,
    bufferFifoOrders,
    bufferOccupancy,
    consumerWaiters,
    consumerMutexWaiters,
    preparingAssignments,
    completedOrders: boundedCompleted,
    completedTotal,
    latestExplanation,
    latestShortExplanation,
    latestTechnicalDetails,
    hasProducers: rawProducers.length > 0,
    hasConsumers: processes.some((p) => p.type === 'CONSUMER'),
  };
}
