export const MAX_HISTORY_SAMPLES = 200;

export const TRANSITION_KINDS = {
  INIT: 'init',
  EXECUTE: 'execute',
  BLOCKED: 'blocked',
  WAKE: 'wake',
  TICK: 'kitchen-tick',
  PROCESS_ADDED: 'process-added',
  PROCESS_REMOVED: 'process-removed',
  PROCESS_STOPPING: 'process-stopping',
};

/**
 * Extracts a compact, read-only execution sample from the engine.
 * Never deep-copies unnecessary DOM or large objects.
 */
export function extractSampleFromEngine(engine, kind, details = {}) {
  const capacity = engine.buffer?.capacity ?? 5;
  const occupancy = engine.buffer?.occupancy ?? 0;
  const readPosition = engine.buffer?.readPosition ?? 0;
  const writePosition = engine.buffer?.writePosition ?? 0;
  const mutexOwner = engine.mutex?.owner ?? null;
  const emptyVal = engine.empty?.value ?? 0;
  const fullVal = engine.full?.value ?? 0;
  const reservedEmpty = engine.reservedEmpty ?? 0;
  const reservedFull = engine.reservedFull ?? 0;

  const processes = (engine.processes || []).map((p) => ({
    id: p.id,
    type: p.type,
    state: p.state,
    pc: p.pc,
    waitingFor: p.waitingFor,
    permit: Boolean(p.permit),
    acquiredMutex: Boolean(p.acquiredMutex),
    orderId: p.orderId ?? null,
  }));

  const workers = (engine.workers || []).map((w) => ({
    id: w.id,
    state: w.state,
    assignedOrderId: w.assignedOrderId ?? null,
    foodName: w.foodName ?? null,
    progress: w.preparationProgress ?? 0,
    duration: w.preparationDuration ?? 0,
    remainingSteps: w.remainingSteps ?? 0,
  }));

  // Identify any causal wakeup that occurred in this transition step
  let wokenProcess = details.wokenProcess ?? null;
  let wokenResource = details.wokenResource ?? null;
  if (!wokenProcess && engine.events && engine.events.length) {
    const recentWake = engine.events.slice(0, 8).find((e) => e.type === 'wake');
    if (recentWake) {
      wokenProcess = recentWake.processId ?? null;
      wokenResource = recentWake.resource ?? null;
    }
  }

  const variableChanges = details.variableChanges
    ? {
        before: { ...details.variableChanges.before },
        after: { ...details.variableChanges.after },
      }
    : engine.variableChanges
    ? {
        before: { ...engine.variableChanges.before },
        after: { ...engine.variableChanges.after },
      }
    : null;

  return {
    sessionId: engine.sessionId ?? 1,
    seq: engine.stepSequence ?? 0,
    kind,
    processId: details.processId ?? null,
    operation: details.operation ?? engine.currentOperation ?? 'Operation',
    instructionOp: details.instructionOp ?? null,
    orderId: details.orderId ?? null,
    occupancy,
    capacity,
    readPosition,
    writePosition,
    mutexOwner,
    empty: emptyVal,
    full: fullVal,
    reservedEmpty,
    reservedFull,
    wokenProcess,
    wokenResource,
    variableChanges,
    processes,
    workers,
    eventMessage: details.eventMessage ?? engine.currentOperation ?? '',
  };
}

/**
 * Categorizes the operation or event into an annotation type for markers.
 * Restrained: only highlights meaningful transitions (insert, remove, blocked).
 */
export function getEventAnnotation(sample) {
  if (!sample) return null;
  const op = String(sample.operation || '').toLowerCase();
  const msg = String(sample.eventMessage || '').toLowerCase();
  const instructionOp = String(sample.instructionOp || '').toLowerCase();

  if (sample.kind === 'blocked') {
    if (instructionOp.includes('empty') || op.includes('empty') || msg.includes('empty')) {
      return { type: 'blocked-producer', label: 'Producer blocked on wait(empty)', tone: 'amber' };
    }
    if (instructionOp.includes('full') || op.includes('full') || msg.includes('full')) {
      return { type: 'blocked-consumer', label: 'Consumer blocked on wait(full)', tone: 'amber' };
    }
    if (instructionOp.includes('mutex') || op.includes('mutex') || msg.includes('mutex')) {
      return { type: 'blocked-mutex', label: 'Blocked on mutex contention', tone: 'orange' };
    }
    return { type: 'blocked', label: 'Thread blocked', tone: 'amber' };
  }

  if (instructionOp === 'insert' || op.includes('insert') || msg.includes('inserted')) {
    return { type: 'insert', label: `Order inserted (${sample.orderId || 'order'})`, tone: 'green' };
  }

  if (instructionOp === 'remove' || op.includes('remove') || msg.includes('removed')) {
    return { type: 'remove', label: `Order removed (${sample.orderId || 'order'})`, tone: 'teal' };
  }

  if (sample.kind === 'kitchen-tick') {
    return { type: 'tick', label: 'Kitchen preparation tick', tone: 'blue' };
  }

  if (instructionOp === 'waitmutex' && sample.mutexOwner === sample.processId) {
    return { type: 'mutex-acquire', label: `${sample.processId} acquired mutex lock`, tone: 'gold' };
  }

  if (instructionOp === 'releasemutex') {
    return { type: 'mutex-release', label: `${sample.processId} released mutex lock`, tone: 'gold-subtle' };
  }

  return null;
}

/**
 * Derives process state for a single process at a sample.
 * Strictly separates runnable from actively executing, idle from completed,
 * distinct wait reasons, and mutex ownership from kitchen preparation.
 */
export function getProcessDisplayState(process, worker, mutexOwner) {
  if (!process) {
    return { stateKey: 'UNCREATED', label: 'Not created', tone: 'inactive', badge: '—' };
  }

  // Consumer cooking in parallel outside mutex
  if (process.type === 'CONSUMER' && worker?.state === 'PREPARING') {
    return {
      stateKey: 'PREPARING',
      label: `Cooking dish outside mutex (${worker.progress}/${worker.duration} ticks)`,
      tone: 'teal',
      badge: 'COOK',
      isPreparing: true,
      orderId: worker.assignedOrderId,
    };
  }

  // Mutex owner inside Critical Section
  if (mutexOwner === process.id || process.acquiredMutex) {
    return {
      stateKey: 'CRITICAL_SECTION',
      label: 'In Critical Section (Exclusive Mutex Owner)',
      tone: 'gold',
      badge: 'LOCK',
      isMutexOwner: true,
    };
  }

  // Blocked on mutex
  if (process.waitingFor === 'mutex' || worker?.state === 'WAITING_FOR_MUTEX') {
    return {
      stateKey: 'WAITING_MUTEX',
      label: `Waiting for mutex (${mutexOwner ? `held by ${mutexOwner}` : 'locked'})`,
      tone: 'orange',
      badge: 'WAIT',
    };
  }

  // Blocked on empty permit (buffer full)
  if (process.waitingFor === 'empty') {
    return {
      stateKey: 'WAITING_EMPTY',
      label: 'Blocked on wait(empty) — buffer full',
      tone: 'amber',
      badge: 'WAIT',
    };
  }

  // Blocked on full permit (buffer empty)
  if (process.waitingFor === 'full' || worker?.state === 'WAITING_FOR_ORDER') {
    return {
      stateKey: 'WAITING_FULL',
      label: 'Blocked on wait(full) — buffer empty',
      tone: 'amber-dark',
      badge: 'WAIT',
    };
  }

  // Actively executing current instruction
  if (process.state === 'RUNNING') {
    return {
      stateKey: 'RUNNING',
      label: 'Executing instruction',
      tone: 'green-bright',
      badge: 'RUN',
    };
  }

  // Persistent consumer workstation idle awaiting next order
  if (worker?.state === 'IDLE') {
    return {
      stateKey: 'IDLE',
      label: 'Workstation idle (awaiting order)',
      tone: 'slate',
      badge: 'IDLE',
    };
  }

  // Ready / runnable in scheduler
  if (process.state === 'READY') {
    return {
      stateKey: 'READY',
      label: 'Ready / Runnable in scheduler',
      tone: 'green-subtle',
      badge: 'READY',
    };
  }

  // Finished student producer
  if (process.state === 'COMPLETED') {
    return {
      stateKey: 'COMPLETED',
      label: 'Producer completed lifecycle',
      tone: 'neutral',
      badge: 'DONE',
    };
  }

  return {
    stateKey: 'OTHER',
    label: process.state,
    tone: 'grey',
    badge: '—',
  };
}

/**
 * Builds stepped path coordinates and points for SVG rendering.
 * Horizontal axis measures discrete execution steps.
 */
export function calculateOccupancyChartGeometry({
  samples = [],
  width = 760,
  height = 185,
  padding = { top: 28, right: 32, bottom: 42, left: 56 },
  capacity = 5,
  minSeq = 0,
  maxSeq = 0,
}) {
  if (!samples.length) {
    return {
      hasData: false,
      linePath: '',
      areaPath: '',
      points: [],
      xScale: () => 0,
      yScale: () => 0,
      chartWidth: 0,
      chartHeight: 0,
      yBottom: 0,
    };
  }

  const chartWidth = Math.max(50, width - padding.left - padding.right);
  const chartHeight = Math.max(50, height - padding.top - padding.bottom);
  const totalSteps = Math.max(1, maxSeq - minSeq);

  const xScale = (seq) => padding.left + ((seq - minSeq) / totalSteps) * chartWidth;
  const yScale = (occ) => padding.top + chartHeight - (Math.max(0, Math.min(capacity, occ)) / capacity) * chartHeight;
  const yBottom = padding.top + chartHeight;

  const points = samples.map((sample) => {
    const x = xScale(sample.seq);
    const y = yScale(sample.occupancy);
    const annotation = getEventAnnotation(sample);
    return {
      seq: sample.seq,
      x,
      y,
      occupancy: sample.occupancy,
      sample,
      annotation,
    };
  });

  let linePath;
  let areaPath;

  if (points.length === 1) {
    const p = points[0];
    linePath = `M ${p.x - 12} ${p.y} L ${p.x + 12} ${p.y}`;
    areaPath = '';
  } else {
    // Stepped path: M x0 y0 H x1 V y1 H x2 V y2 ...
    linePath = `M ${points[0].x} ${points[0].y}`;
    areaPath = `M ${points[0].x} ${yBottom} L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      // Step-after: stay at prev.y until curr.x, then transition vertically to curr.y
      linePath += ` H ${curr.x} V ${curr.y}`;
      areaPath += ` H ${curr.x} V ${curr.y}`;
    }

    const last = points[points.length - 1];
    areaPath += ` L ${last.x} ${yBottom} Z`;
  }

  return {
    hasData: true,
    linePath,
    areaPath,
    points,
    xScale,
    yScale,
    yBottom,
    chartWidth,
    chartHeight,
  };
}

/**
 * Generates clear, two-level educational cause-and-effect summary for a selected step.
 * Strictly avoids fictional combined actions and accurately reflects intermediate states.
 */
export function generateStepCauseAndEffect(sample, prevSample = null) {
  if (!sample) return null;

  const pBefore = sample.variableChanges?.before ?? (prevSample ? {
    occupancy: prevSample.occupancy,
    readPosition: prevSample.readPosition,
    writePosition: prevSample.writePosition,
    mutexOwner: prevSample.mutexOwner,
    empty: prevSample.empty,
    full: prevSample.full,
    reservedEmpty: prevSample.reservedEmpty,
    reservedFull: prevSample.reservedFull,
  } : null);

  const pAfter = sample.variableChanges?.after ?? {
    occupancy: sample.occupancy,
    readPosition: sample.readPosition,
    writePosition: sample.writePosition,
    mutexOwner: sample.mutexOwner,
    empty: sample.empty,
    full: sample.full,
    reservedEmpty: sample.reservedEmpty,
    reservedFull: sample.reservedFull,
  };

  const procId = sample.processId || 'System';
  const isProducer = sample.processes?.find((p) => p.id === procId)?.type === 'PRODUCER' || procId.startsWith('P');
  const isConsumer = sample.processes?.find((p) => p.id === procId)?.type === 'CONSUMER' || procId.startsWith('C');
  const actorRole = procId === 'System' ? 'System' : isProducer ? 'Student Producer' : isConsumer ? 'Kitchen Worker' : 'Process';

  const op = String(sample.operation || '').toLowerCase();
  const instructionOp = String(sample.instructionOp || '').toLowerCase();

  // Primary Headline
  let headline = `STEP #${sample.seq} · ${sample.operation}`;
  let whatHappened = sample.operation;

  if (instructionOp === 'insert' || op.includes('insert')) {
    headline = `STEP #${sample.seq} · ${procId} INSERTED ${sample.orderId || 'ORDER'}`;
    whatHappened = `Inserted ${sample.orderId || 'order'} into queue slot ${sample.writePosition}`;
  } else if (instructionOp === 'advancewrite') {
    headline = `STEP #${sample.seq} · ${procId} ADVANCED WRITE POINTER`;
    whatHappened = `Advanced write pointer from slot ${pBefore?.writePosition ?? sample.writePosition} to slot ${sample.writePosition} (mod 5)`;
  } else if (instructionOp === 'remove' || op.includes('remove')) {
    headline = `STEP #${sample.seq} · ${procId} REMOVED ${sample.orderId || 'ORDER'}`;
    whatHappened = `Removed ${sample.orderId || 'order'} from queue slot ${sample.readPosition}`;
  } else if (instructionOp === 'advanceread') {
    headline = `STEP #${sample.seq} · ${procId} ADVANCED READ POINTER`;
    whatHappened = `Advanced read pointer from slot ${pBefore?.readPosition ?? sample.readPosition} to slot ${sample.readPosition} (mod 5)`;
  } else if (instructionOp === 'waitempty') {
    if (sample.kind === 'blocked') {
      headline = `STEP #${sample.seq} · ${procId} BLOCKED ON WAIT(EMPTY)`;
      whatHappened = `Attempted wait(empty) but buffer was full (${sample.occupancy}/${sample.capacity} orders)`;
    } else {
      headline = `STEP #${sample.seq} · ${procId} ACQUIRED EMPTY-SLOT PERMIT`;
      whatHappened = `Acquired empty permit; reserved slot for insertion (empty is now ${sample.empty})`;
    }
  } else if (instructionOp === 'waitfull') {
    if (sample.kind === 'blocked') {
      headline = `STEP #${sample.seq} · ${procId} BLOCKED ON WAIT(FULL)`;
      whatHappened = `Attempted wait(full) but buffer was empty (0/${sample.capacity} orders)`;
    } else {
      headline = `STEP #${sample.seq} · ${procId} ACQUIRED FULL-ORDER PERMIT`;
      whatHappened = `Acquired full permit; reserved order for removal (full is now ${sample.full})`;
    }
  } else if (instructionOp === 'waitmutex') {
    if (sample.kind === 'blocked') {
      headline = `STEP #${sample.seq} · ${procId} BLOCKED ON MUTEX`;
      whatHappened = `Blocked on mutex held by ${sample.mutexOwner || 'another thread'}`;
    } else {
      headline = `STEP #${sample.seq} · ${procId} ACQUIRED MUTEX LOCK`;
      whatHappened = `Acquired mutex lock; entered Critical Section`;
    }
  } else if (instructionOp === 'releasemutex') {
    headline = `STEP #${sample.seq} · ${procId} RELEASED MUTEX LOCK`;
    whatHappened = `Released mutex lock; exited Critical Section`;
  } else if (instructionOp === 'signalfull') {
    headline = `STEP #${sample.seq} · ${procId} SIGNALED FULL`;
    whatHappened = `Signaled full semaphore; published order to consumers`;
  } else if (instructionOp === 'signalempty') {
    headline = `STEP #${sample.seq} · ${procId} SIGNALED EMPTY`;
    whatHappened = `Signaled empty semaphore; freed slot for producers`;
  } else if (sample.kind === 'kitchen-tick') {
    headline = `STEP #${sample.seq} · KITCHEN PREPARATION TICK`;
    whatHappened = `Kitchen workstation progressed dish cooking by 1 tick outside mutex`;
  } else if (sample.kind === 'init') {
    headline = `STEP #${sample.seq} · QUEUE INITIALIZED`;
    whatHappened = `Initialized pristine bounded buffer (capacity 5, empty 5, full 0, mutex 1)`;
  } else if (sample.kind === 'process-added') {
    headline = `STEP #${sample.seq} · ${procId} ADDED TO SCHEDULER`;
    whatHappened = `${procId} (${actorRole}) created and placed into READY state`;
  }

  // Accurate What Changed Items (only true recorded before/after deltas)
  const occupancyChanged = pBefore && pBefore.occupancy !== pAfter.occupancy;
  const queueItem = {
    label: 'Queue Occupancy',
    text: occupancyChanged
      ? `${pBefore.occupancy} → ${pAfter.occupancy} orders`
      : `${pAfter.occupancy} / ${sample.capacity} orders`,
    changed: Boolean(occupancyChanged),
  };

  const readChanged = pBefore && pBefore.readPosition !== pAfter.readPosition;
  const writeChanged = pBefore && pBefore.writePosition !== pAfter.writePosition;

  let pointerItem;
  if (instructionOp === 'remove') {
    pointerItem = {
      label: 'Read Pointer',
      text: `Slot ${sample.readPosition} (advances in next instruction)`,
      changed: false,
    };
  } else if (instructionOp === 'insert') {
    pointerItem = {
      label: 'Write Pointer',
      text: `Slot ${sample.writePosition} (advances in next instruction)`,
      changed: false,
    };
  } else if (readChanged) {
    pointerItem = {
      label: 'Read Pointer',
      text: `Slot ${pBefore.readPosition} → ${pAfter.readPosition} (mod 5)`,
      changed: true,
    };
  } else if (writeChanged) {
    pointerItem = {
      label: 'Write Pointer',
      text: `Slot ${pBefore.writePosition} → ${pAfter.writePosition} (mod 5)`,
      changed: true,
    };
  } else {
    pointerItem = {
      label: 'Pointers',
      text: `Read: Slot ${sample.readPosition} · Write: Slot ${sample.writePosition}`,
      changed: false,
    };
  }

  const mutexChanged = pBefore && pBefore.mutexOwner !== pAfter.mutexOwner;
  const mutexItem = {
    label: 'Mutex Lock',
    text: sample.mutexOwner
      ? `Held by ${sample.mutexOwner}`
      : mutexChanged && pBefore?.mutexOwner
      ? `${pBefore.mutexOwner} released → Free`
      : 'Free (unlocked)',
    changed: Boolean(mutexChanged),
  };

  // Educational Cause-and-Effect Narrative
  let explanation;
  if (instructionOp === 'remove') {
    explanation = `${procId} removed ${sample.orderId || 'the order'} from queue slot ${sample.readPosition}. The order enters workstation preparation outside the queue. The circular read pointer remains at slot ${sample.readPosition} and will advance modulo 5 in the next instruction while the mutex is held. Preparation is an independent stage.`;
  } else if (instructionOp === 'advanceread') {
    explanation = `${procId} advanced the circular read pointer modulo 5 (from slot ${pBefore?.readPosition ?? 0} to slot ${sample.readPosition}). The order was already removed in the previous instruction. The slot is now vacated and available for future producer insertions.`;
  } else if (instructionOp === 'insert') {
    explanation = `${procId} inserted ${sample.orderId || 'the order'} into queue slot ${sample.writePosition} while holding exclusive mutex ownership. The circular write pointer remains at slot ${sample.writePosition} and will advance modulo 5 in the next instruction.`;
  } else if (instructionOp === 'advancewrite') {
    explanation = `${procId} advanced the circular write pointer modulo 5 (from slot ${pBefore?.writePosition ?? 0} to slot ${sample.writePosition}). The order was placed in the slot during the previous instruction.`;
  } else if (instructionOp === 'waitempty') {
    if (sample.kind === 'blocked') {
      explanation = `${procId} called wait(empty) to reserve a free queue slot, but all ${sample.capacity} slots are occupied (empty = 0). ${procId} entered BLOCKED state and will be awakened in FIFO order when a consumer dequeues an order and signals empty.`;
    } else {
      explanation = `${procId} acquired one empty permit (empty decremented to ${sample.empty}). Capacity is reserved before requesting the queue mutex.`;
    }
  } else if (instructionOp === 'waitfull') {
    if (sample.kind === 'blocked') {
      explanation = `${procId} called wait(full) to claim an order, but the queue has 0 orders (full = 0). ${procId} entered BLOCKED state and will be awakened in FIFO order when a producer inserts an order and signals full.`;
    } else {
      explanation = `${procId} acquired one full permit (full decremented to ${sample.full}). An order is reserved before requesting the queue mutex.`;
    }
  } else if (instructionOp === 'waitmutex') {
    if (sample.kind === 'blocked') {
      explanation = `${procId} called wait(mutex), but the lock is currently held by ${sample.mutexOwner || 'another thread'}. ${procId} entered WAITING state on the mutex FIFO queue.`;
    } else {
      explanation = `${procId} acquired the mutex lock and entered the Critical Section. No other process can access the shared queue buffer until ${procId} releases the lock.`;
    }
  } else if (instructionOp === 'releasemutex') {
    if (sample.wokenProcess) {
      explanation = `${procId} released the mutex. Ownership passed directly to FIFO waiter ${sample.wokenProcess}, waking it to READY without unlocking.`;
    } else {
      explanation = `${procId} released the mutex and exited the Critical Section. The lock is now free for any future process.`;
    }
  } else if (instructionOp === 'signalempty') {
    if (sample.wokenProcess) {
      explanation = `${procId} signaled empty. Oldest waiting producer ${sample.wokenProcess} received the free slot permit directly and woke to READY.`;
    } else {
      explanation = `${procId} signaled empty. The available empty semaphore count increased by 1 (now ${sample.empty}).`;
    }
  } else if (instructionOp === 'signalfull') {
    if (sample.wokenProcess) {
      explanation = `${procId} signaled full. Oldest waiting consumer ${sample.wokenProcess} received the published order permit directly and woke to READY.`;
    } else {
      explanation = `${procId} signaled full. The available full semaphore count increased by 1 (now ${sample.full}).`;
    }
  } else if (sample.kind === 'kitchen-tick') {
    explanation = 'Kitchen preparation advanced by 1 tick for cooking workstations outside the queue mutex. Multiple workers cook concurrently on independent workstations without blocking queue access.';
  } else if (sample.kind === 'init') {
    explanation = 'Simulation engine initialized with an empty 5-slot circular buffer, empty = 5, full = 0, and mutex = 1.';
  } else if (sample.kind === 'process-added') {
    explanation = `${procId} joined the scheduler queue as a ${actorRole}. It is in READY state awaiting its turn to execute synchronization instructions.`;
  } else {
    explanation = sample.eventMessage || sample.operation;
  }

  // Permit Conservation Accounting & Invariant Breakdown (Requirement 8)
  const sumPermits = sample.empty + sample.full + sample.reservedEmpty + sample.reservedFull;
  const isConserved = sumPermits === sample.capacity;
  const bufferConservation = sample.occupancy === sample.full + sample.reservedFull;

  const accounting = {
    empty: sample.empty,
    full: sample.full,
    reservedEmpty: sample.reservedEmpty,
    reservedFull: sample.reservedFull,
    capacity: sample.capacity,
    sum: sumPermits,
    isConserved,
    bufferConservation,
    equation: `${sample.empty} + ${sample.full} + ${sample.reservedEmpty} + ${sample.reservedFull} = ${sample.capacity}`,
  };

  return {
    headline,
    whoActed: procId,
    actorRole,
    whatHappened,
    queueItem,
    pointerItem,
    mutexItem,
    explanation,
    wokenProcess: sample.wokenProcess,
    wokenResource: sample.wokenResource,
    accounting,
  };
}

/**
 * Filter historical steps by meaningful category for focused navigation.
 * Purely drives navigation; never erases occupancy or timeline data.
 */
export function filterHistoricalSteps(samples, filterType) {
  if (!samples || !samples.length) return [];
  if (filterType === 'all') return samples.map((s) => s.seq);

  return samples
    .filter((s) => {
      const annot = getEventAnnotation(s);
      const annotType = annot?.type || '';
      const op = String(s.operation || '').toLowerCase();
      const instructionOp = String(s.instructionOp || '').toLowerCase();

      if (filterType === 'queue') {
        return (
          annotType === 'insert' ||
          annotType === 'remove' ||
          instructionOp === 'insert' ||
          instructionOp === 'remove'
        );
      }
      if (filterType === 'blocked') {
        return s.kind === 'blocked' || annotType.startsWith('blocked');
      }
      if (filterType === 'mutex') {
        return (
          instructionOp === 'waitmutex' ||
          instructionOp === 'releasemutex' ||
          op.includes('mutex') ||
          annotType.includes('mutex')
        );
      }
      if (filterType === 'kitchen') {
        return s.kind === 'kitchen-tick' || op.includes('kitchen') || op.includes('prep');
      }
      return true;
    })
    .map((s) => s.seq);
}
