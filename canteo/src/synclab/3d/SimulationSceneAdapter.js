/**
 * SimulationSceneAdapter.js
 * Pure JavaScript adapter for translating authoritative engine snapshots into 3D scene geometry,
 * process positions, slot statuses, and queue layouts.
 * 
 * Rules:
 * 1. Producers stay OUTSIDE the kitchen room. They approach the service hatch at Z=0 to submit orders.
 * 2. Consumers stay INSIDE the kitchen room at their own workstations (Z <= -1.5).
 * 3. Adding a consumer adds another consumer and workstation inside.
 * 4. Removing a consumer safely removes that consumer and workstation.
 * 5. Consumer workstations match the consumer count (not fixed to 3 or 5).
 * 6. Only the shared order queue has a fixed capacity of 5.
 * 7. Mutex ownership is associated with the shared counter access point at the hatch.
 */

export const QUEUE_CAPACITY = 5;

// Fixed 5-slot counter positions across the service hatch at Z = 0
export const COUNTER_SLOT_POSITIONS = [-3.2, -1.6, 0.0, 1.6, 3.2];
export const COUNTER_SLOT_Y = 0.35;
export const COUNTER_SLOT_Z = 0.0;

// Grid configuration for inside consumer workstations
export const WORKSTATION_GRID = {
  columns: 4,
  spacingX: 2.7,
  spacingZ: 2.3,
  firstRowZ: -2.8, // Distance behind the counter
  aisleZ: -1.2,    // Collection aisle behind counter
};

/**
 * Computes the dynamic kitchen room dimensions based on the consumer count.
 * Expands room depth for additional rows so workstations are never squeezed.
 */
export function computeRoomBounds(consumerCount = 2) {
  const count = Math.max(1, consumerCount);
  const rows = Math.ceil(count / WORKSTATION_GRID.columns);
  
  // Kitchen interior expands backwards into negative Z
  const interiorDepth = Math.max(5.5, 2.0 + rows * WORKSTATION_GRID.spacingZ + 0.8);
  const interiorWidth = Math.max(12.5, Math.min(4, count) * WORKSTATION_GRID.spacingX + 2.5);
  
  // Outside terrace extends into positive Z
  const terraceDepth = 5.2;

  return {
    width: interiorWidth,
    interiorDepth,
    terraceDepth,
    wallHeight: 0.95,       // Cutaway wall height for clean sightlines
    wallThickness: 0.15,
    hatchWidth: 8.0,        // Service hatch width along front wall
    hatchX: 0.0,
    hatchZ: 0.0,
    backWallZ: -interiorDepth,
    frontWallZ: 0.0,
    terraceEndZ: terraceDepth,
    numRows: rows,
  };
}

/**
 * Computes a stable workstation position for a consumer by its stable index.
 * Does not shift existing workstations when new consumers are appended.
 */
export function getWorkstationCoords(index, totalCount = 1) {
  const col = index % WORKSTATION_GRID.columns;
  const row = Math.floor(index / WORKSTATION_GRID.columns);
  
  // Center columns in current row
  const rowCount = Math.min(
    WORKSTATION_GRID.columns,
    totalCount - row * WORKSTATION_GRID.columns
  );
  const actualCols = Math.min(WORKSTATION_GRID.columns, totalCount);
  
  // Stable X based on column index centered around 0
  const x = (col - (WORKSTATION_GRID.columns - 1) / 2) * WORKSTATION_GRID.spacingX;
  const z = WORKSTATION_GRID.firstRowZ - row * WORKSTATION_GRID.spacingZ;
  
  return {
    position: [x, 0.35, z],
    row,
    col,
  };
}

/**
 * Transforms an engine snapshot into an authoritative 3D scene descriptor.
 * 
 * @param {Object} snapshot - Authoritative ProducerConsumerEngine snapshot
 * @param {Object} options - Configuration options (e.g. selectedProcessId, selectedSlotIndex)
 * @returns {Object} Scene descriptor ready for 3D rendering
 */
export function computeSceneState(snapshot, options = {}) {
  if (!snapshot) {
    const room = computeRoomBounds(2);
    return {
      room,
      slots: [],
      counterAccess: { isLocked: false, ownerId: null, ownerType: null, label: 'Counter Free (Mutex Available)' },
      workstations: [],
      tokens: [],
      completedOrders: [],
      waitingSummary: { capacityWaiters: [], orderWaiters: [], mutexWaiters: [] },
      counts: { capacity: 5, occupiedSlots: 0, producers: 0, consumers: 0, preparing: 0, completed: 0 },
    };
  }

  const {
    selectedProcessId = null,
    selectedSlotIndex = null,
  } = options;

  const rawSlots = snapshot.slots ?? [];
  const readPos = snapshot.readPosition ?? 0;
  const writePos = snapshot.writePosition ?? 0;
  const mutexOwner = snapshot.mutexOwner ?? null;
  const isMutexLocked = Boolean(mutexOwner) || snapshot.mutex === 0;

  const emptyWaiters = snapshot.emptyWaiters ?? [];
  const fullWaiters = snapshot.fullWaiters ?? [];
  const mutexWaiters = snapshot.mutexWaiters ?? [];

  const processes = snapshot.processes ?? [];
  const workers = snapshot.workers ?? [];
  const allOrders = snapshot.orders ?? [];
  const completedOrders = snapshot.completedOrders ?? [];

  const producerProcesses = processes.filter((p) => p.type === 'PRODUCER');
  const consumerProcesses = processes.filter((p) => p.type === 'CONSUMER');

  // Compute room boundaries based on actual consumer count
  const room = computeRoomBounds(consumerProcesses.length);

  // -------------------------------------------------------------
  // 1. SHARED 5-SLOT COUNTER AT SERVICE HATCH (Z = 0)
  // -------------------------------------------------------------
  const slots = [];
  for (let i = 0; i < QUEUE_CAPACITY; i++) {
    const rawItem = rawSlots[i] ?? null;
    const x = COUNTER_SLOT_POSITIONS[i] ?? (i * 1.6 - 3.2);
    const isOccupied = Boolean(rawItem);
    const isWrite = writePos === i;
    const isRead = readPos === i;
    const isSelected = selectedSlotIndex === i;

    slots.push({
      index: i,
      position: [x, COUNTER_SLOT_Y, COUNTER_SLOT_Z],
      isOccupied,
      item: isOccupied
        ? {
            id: rawItem.id || `ORD-${i}`,
            foodName: rawItem.foodName || rawItem.label || 'Order',
            producer: rawItem.producer || null,
            lifecycle: rawItem.lifecycle || 'QUEUED',
          }
        : null,
      isWritePointer: isWrite,
      isReadPointer: isRead,
      isSelected,
    });
  }

  // -------------------------------------------------------------
  // 2. COUNTER ACCESS & MUTEX INDICATOR (At Service Hatch)
  // -------------------------------------------------------------
  const mutexOwnerProc = mutexOwner ? processes.find((p) => p.id === mutexOwner) : null;
  const mutexOwnerType = mutexOwnerProc?.type ?? null;

  const counterAccess = {
    isLocked: isMutexLocked,
    ownerId: mutexOwner,
    ownerType: mutexOwnerType,
    state: isMutexLocked ? 'LOCKED' : 'OPEN',
    label: isMutexLocked
      ? (mutexOwnerType === 'PRODUCER'
          ? `Order Submission: ${mutexOwner}`
          : `Order Collection: ${mutexOwner}`)
      : 'Counter Free (Mutex Available)',
    position: [0.0, 1.35, 0.0],
  };

  // -------------------------------------------------------------
  // 3. DYNAMIC CONSUMER WORKSTATIONS (Inside the kitchen)
  // One workstation per consumer process, stably assigned by index.
  // -------------------------------------------------------------
  const workstations = consumerProcesses.map((proc, index) => {
    const coords = getWorkstationCoords(index, consumerProcesses.length);
    const worker = workers.find((w) => w.id === proc.id);
    const isPreparing = proc.state === 'PREPARING';
    const isWaitingOrder = fullWaiters.includes(proc.id);
    const isWaitingMutex = mutexWaiters.includes(proc.id);
    const isAccessingCounter = mutexOwner === proc.id;
    const isStopping = Boolean(proc.isStopping || proc.gracefulStopRequested);

    // Preparation progress derivation
    const orderId = worker?.assignedOrderId || proc.result?.id || proc.orderId;
    const orderData = orderId ? allOrders.find((o) => o.id === orderId) : null;
    const duration = worker?.preparationDuration || orderData?.preparationDuration || 3;
    const progress = worker?.preparationProgress ?? orderData?.preparationProgress ?? 0;
    const percent = Math.min(100, Math.round((progress / Math.max(1, duration)) * 100));

    let statusText = 'Waiting for an order';
    if (isAccessingCounter) {
      statusText = `Collecting from Slot [${readPos}]`;
    } else if (isWaitingMutex) {
      statusText = 'Waiting for counter access';
    } else if (isPreparing) {
      statusText = `Preparing: ${worker?.foodName || orderData?.foodName || proc.foodName || 'Meal'} (${percent}%)`;
    } else if (isStopping) {
      statusText = 'Stopping after current operation';
    } else if (proc.state === 'READY') {
      statusText = 'Kitchen Worker Ready';
    }

    return {
      id: `workstation-${proc.id}`,
      consumerId: proc.id,
      index,
      position: coords.position,
      row: coords.row,
      col: coords.col,
      isOccupied: true,
      isPreparing,
      isStopping,
      statusText,
      assignedProcess: {
        id: proc.id,
        state: proc.state,
        orderId,
        foodName: worker?.foodName || orderData?.foodName || proc.foodName || null,
        progress,
        duration,
        percent,
      },
    };
  });

  // -------------------------------------------------------------
  // 4. PROCESS TOKENS & 3D SPATIAL COORDINATES
  // Strictly enforce:
  // - Producers stay outside (Z >= 0.5)
  // - Consumers stay inside (Z <= -0.5)
  // -------------------------------------------------------------
  const tokens = [];

  // ------------------ CONSUMER TOKENS (INSIDE) ------------------
  consumerProcesses.forEach((proc, index) => {
    const ws = workstations[index];
    const isMutex = mutexOwner === proc.id;
    const isWaitingMutex = mutexWaiters.includes(proc.id);
    const isPreparing = proc.state === 'PREPARING';
    const isStopping = Boolean(proc.isStopping || proc.gracefulStopRequested);

    let tokenPosition;
    let rotationY = 0; // Facing south towards counter by default
    let zone;
    let stateLabel;

    if (isMutex) {
      // Collecting from counter inside the kitchen at read position
      const slotX = COUNTER_SLOT_POSITIONS[readPos] ?? 0;
      tokenPosition = [slotX, 0.35, -0.9];
      rotationY = 0; // Facing the counter
      zone = 'COUNTER_INSIDE';
      stateLabel = `Collecting from Slot [${readPos}]`;
    } else if (isWaitingMutex) {
      // Waiting in collection aisle behind counter for mutex access
      const queueIndex = mutexWaiters.indexOf(proc.id);
      const slotX = COUNTER_SLOT_POSITIONS[readPos] ?? 0;
      tokenPosition = [slotX + (queueIndex + 1) * 0.9, 0.35, WORKSTATION_GRID.aisleZ];
      rotationY = 0;
      zone = 'COLLECTION_AISLE';
      stateLabel = 'Waiting for counter access';
    } else if (isPreparing) {
      // At their dedicated workstation cooking
      tokenPosition = [ws.position[0], 0.35, ws.position[2] - 0.45];
      rotationY = 0;
      zone = 'WORKSTATION';
      stateLabel = ws.statusText;
    } else {
      // Idle / waiting for an order at their workstation
      tokenPosition = [ws.position[0], 0.35, ws.position[2] - 0.45];
      rotationY = 0;
      zone = 'WORKSTATION';
      stateLabel = isStopping ? 'Stopping after current operation' : 'Waiting for an order';
    }

    tokens.push({
      id: proc.id,
      type: 'CONSUMER',
      role: 'Kitchen Worker',
      state: proc.state || 'READY',
      stateLabel,
      zone,
      position: tokenPosition,
      rotationY,
      isMutexOwner: isMutex,
      isSelected: selectedProcessId === proc.id,
      foodName: ws.assignedProcess?.foodName || null,
      orderId: ws.assignedProcess?.orderId || null,
      workstationId: ws.id,
    });
  });

  // ------------------ PRODUCER TOKENS (OUTSIDE) ------------------
  producerProcesses.forEach((proc, index) => {
    const isMutex = mutexOwner === proc.id;
    const isWaitingMutex = mutexWaiters.includes(proc.id);
    const isWaitingEmpty = emptyWaiters.includes(proc.id);
    const isFinished = proc.state === 'FINISHED';

    let tokenPosition;
    let rotationY = Math.PI; // Facing north towards counter by default
    let zone;
    let stateLabel;

    if (isMutex) {
      // Submitting order at the outside service hatch in front of write slot
      const slotX = COUNTER_SLOT_POSITIONS[writePos] ?? 0;
      tokenPosition = [slotX, 0.35, 0.9];
      rotationY = Math.PI; // Facing counter
      zone = 'SERVICE_HATCH_OUTSIDE';
      stateLabel = `Submitting Order to Slot [${writePos}]`;
    } else if (isWaitingMutex) {
      // Lineup right in front of the hatch waiting for mutex
      const queueIndex = mutexWaiters.indexOf(proc.id);
      tokenPosition = [-1.5 - queueIndex * 1.1, 0.35, 2.0];
      rotationY = Math.PI * 0.9;
      zone = 'HATCH_QUEUE_OUTSIDE';
      stateLabel = queueIndex === 0 ? 'Next for Service Hatch' : `Queue Position #${queueIndex + 1}`;
    } else if (isWaitingEmpty) {
      // Blocked on buffer capacity: outside terrace wait bay
      const queueIndex = emptyWaiters.indexOf(proc.id);
      const col = queueIndex % 3;
      const row = Math.floor(queueIndex / 3);
      tokenPosition = [-5.0 - col * 1.1, 0.35, 3.2 + row * 1.0];
      rotationY = Math.PI * 0.8;
      zone = 'CAPACITY_WAIT_OUTSIDE';
      stateLabel = 'Waiting for Capacity (Buffer Full)';
    } else if (isFinished) {
      // Moving along outside exit path to the right
      tokenPosition = [4.5 + index * 1.0, 0.35, 2.6];
      rotationY = -Math.PI / 2; // Walking east
      zone = 'EXIT_PATH_OUTSIDE';
      stateLabel = 'Order Submitted · Exiting';
    } else {
      // Approaching lineup on outside terrace
      tokenPosition = [-2.8 - index * 1.1, 0.35, 2.6];
      rotationY = Math.PI;
      zone = 'APPROACH_LINE_OUTSIDE';
      stateLabel = 'Student Ready';
    }

    tokens.push({
      id: proc.id,
      type: 'PRODUCER',
      role: 'Student Producer',
      state: proc.state || 'READY',
      stateLabel,
      zone,
      position: tokenPosition,
      rotationY,
      isMutexOwner: isMutex,
      isSelected: selectedProcessId === proc.id,
      foodName: proc.foodName || null,
      orderId: proc.orderId || null,
      workstationId: null,
    });
  });

  // -------------------------------------------------------------
  // 5. SUMMARY COUNTS & SEMANTICS
  // -------------------------------------------------------------
  const occupiedCount = slots.filter((s) => s.isOccupied).length;
  const preparingCount = consumerProcesses.filter((p) => p.state === 'PREPARING').length;

  return {
    room,
    slots,
    counterAccess,
    workstations,
    tokens,
    completedOrders: completedOrders.slice(-5).reverse(),
    waitingSummary: {
      capacityWaiters: [...emptyWaiters],
      orderWaiters: [...fullWaiters],
      mutexWaiters: [...mutexWaiters],
    },
    counts: {
      capacity: QUEUE_CAPACITY,
      occupiedSlots: occupiedCount,
      freeSlots: Math.max(0, QUEUE_CAPACITY - occupiedCount),
      producers: producerProcesses.length,
      consumers: consumerProcesses.length,
      workstationCount: workstations.length,
      preparing: preparingCount,
      completed: completedOrders.length,
    },
  };
}
