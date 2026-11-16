import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import {
  calculateOccupancyChartGeometry,
  getEventAnnotation,
  getProcessDisplayState,
  generateStepCauseAndEffect,
  filterHistoricalSteps,
  MAX_HISTORY_SAMPLES,
  TRANSITION_KINDS,
} from '../src/synclab/executionHistory.js';

test('Execution Analysis — History Model & Engine Integration', async (t) => {
  await t.test('1. Initial sample on reset: sequence 0, kind init, capacity 5, occupancy 0', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    const snap = engine.snapshot();
    assert.ok(Array.isArray(snap.executionHistory));
    assert.equal(snap.executionHistory.length, 1);

    const initSample = snap.executionHistory[0];
    assert.equal(initSample.seq, 0);
    assert.equal(initSample.kind, TRANSITION_KINDS.INIT);
    assert.equal(initSample.occupancy, 0);
    assert.equal(initSample.capacity, 5);
    assert.equal(initSample.empty, 5);
    assert.equal(initSample.full, 0);
    assert.equal(initSample.mutexOwner, null);
    assert.equal(snap.historyTruncatedCount, 0);
  });

  await t.test('2. Process addition records process-added sample', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    engine.addConsumer(1);
    const snap = engine.snapshot();
    assert.equal(snap.executionHistory.length, 3); // init, addProducer, addConsumer

    const addP = snap.executionHistory[1];
    assert.equal(addP.seq, 1);
    assert.equal(addP.kind, TRANSITION_KINDS.PROCESS_ADDED);
    assert.equal(addP.processId, 'P1');

    const addC = snap.executionHistory[2];
    assert.equal(addC.seq, 2);
    assert.equal(addC.kind, TRANSITION_KINDS.PROCESS_ADDED);
    assert.equal(addC.processId, 'C1');
  });

  await t.test('3. Insertion execution tracks occupancy step-by-step', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    // P1: waitEmpty, waitMutex, insert, advanceWrite, releaseMutex, signalFull
    for (let i = 0; i < 6; i++) {
      engine.stepNextInstruction();
    }
    const snap = engine.snapshot();
    const insertSample = snap.executionHistory.find((s) => s.operation === 'insert(order)');
    assert.ok(insertSample, 'insert(order) step was captured');
    assert.equal(insertSample.occupancy, 1);
    assert.equal(insertSample.kind, TRANSITION_KINDS.EXECUTE);
    assert.equal(insertSample.processId, 'P1');
  });

  await t.test('4. Blocked consumer on empty queue records blocked transition', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addConsumer(1);
    // C1: waitFull on empty queue
    engine.stepNextInstruction();
    const snap = engine.snapshot();
    const blockedSample = snap.executionHistory.at(-1);
    assert.equal(blockedSample.kind, TRANSITION_KINDS.BLOCKED);
    assert.equal(blockedSample.processId, 'C1');
    assert.equal(blockedSample.operation, 'wait(full)');
    assert.equal(blockedSample.occupancy, 0);
  });

  await t.test('5. Step Process captures every intermediate instruction step', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    const historyBefore = engine.snapshot().executionHistory.length;
    // Step process should execute multiple instructions up to a boundary
    engine.stepNextProcess('P1');
    const historyAfter = engine.snapshot().executionHistory.length;
    assert.ok(historyAfter > historyBefore, 'Multiple intermediate instructions recorded');
    // Ensure all intermediate samples have monotonic sequence numbers
    const samples = engine.snapshot().executionHistory;
    for (let i = 1; i < samples.length; i++) {
      assert.equal(samples[i].seq, samples[i - 1].seq + 1);
    }
  });

  await t.test('6. Kitchen preparation tick records kitchen-tick sample', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    engine.addConsumer(1);
    // Run until producer produces and consumer dequeues and enters PREPARING
    while (engine.processes.some((p) => p.state === 'READY' || p.state === 'RUNNING')) {
      engine.stepNextInstruction();
    }
    const snapPrep = engine.snapshot();
    assert.ok(snapPrep.workers.some((w) => w.state === 'PREPARING'), 'Worker is preparing dish');

    // Advance kitchen tick
    engine.tickKitchen();
    const snapAfterTick = engine.snapshot();
    const tickSample = snapAfterTick.executionHistory.at(-1);
    assert.equal(tickSample.kind, TRANSITION_KINDS.TICK);
    assert.equal(tickSample.operation, 'Kitchen Preparation Tick');
  });

  await t.test('7. Reset isolation: increments sessionId, resets seq, clears old history', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(2);
    engine.stepNextInstruction();
    const firstSessionId = engine.snapshot().historySessionId;

    engine.reset();
    const resetSnap = engine.snapshot();
    assert.ok(resetSnap.historySessionId > firstSessionId, 'Session ID incremented');
    assert.equal(resetSnap.executionHistory.length, 1);
    assert.equal(resetSnap.executionHistory[0].seq, 0);
    assert.equal(resetSnap.executionHistory[0].kind, TRANSITION_KINDS.INIT);
  });

  await t.test('8. Retention policy truncates oldest beyond MAX_HISTORY_SAMPLES while preserving seq', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    // Add many producers and step repeatedly
    engine.addProducer(10);
    for (let i = 0; i < MAX_HISTORY_SAMPLES + 20; i++) {
      if (engine.processes.some((p) => p.state === 'READY' || p.state === 'RUNNING')) {
        engine.stepNextInstruction();
      } else if (engine.workers.some((w) => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        engine.addProducer(1);
      }
    }
    const snap = engine.snapshot();
    assert.equal(snap.executionHistory.length, MAX_HISTORY_SAMPLES, 'Capped at MAX_HISTORY_SAMPLES');
    assert.ok(snap.historyTruncatedCount > 0, 'Truncated count is greater than 0');
    // Global sequence must not restart at 0
    const firstRetained = snap.executionHistory[0];
    const lastRetained = snap.executionHistory.at(-1);
    assert.equal(firstRetained.seq, snap.historyTruncatedCount);
    assert.equal(lastRetained.seq, firstRetained.seq + MAX_HISTORY_SAMPLES - 1);
  });
});

test('Execution Analysis — Chart Geometry & Stepped Rendering', async (t) => {
  await t.test('1. Empty samples returns empty geometry without errors', () => {
    const geo = calculateOccupancyChartGeometry({ samples: [] });
    assert.equal(geo.hasData, false);
    assert.equal(geo.linePath, '');
    assert.equal(geo.points.length, 0);
  });

  await t.test('2. Single sample renders intentional baseline point without broken path', () => {
    const sample = { seq: 0, occupancy: 2, capacity: 5 };
    const geo = calculateOccupancyChartGeometry({
      samples: [sample],
      width: 500,
      height: 200,
      minSeq: 0,
      maxSeq: 0,
    });
    assert.equal(geo.hasData, true);
    assert.equal(geo.points.length, 1);
    assert.ok(geo.linePath.startsWith('M'));
  });

  await t.test('3. Multiple samples generate discrete horizontal/vertical steps (never curves)', () => {
    const samples = [
      { seq: 0, occupancy: 0, capacity: 5 },
      { seq: 1, occupancy: 1, capacity: 5 },
      { seq: 2, occupancy: 1, capacity: 5 },
      { seq: 3, occupancy: 0, capacity: 5 },
    ];
    const geo = calculateOccupancyChartGeometry({
      samples,
      width: 400,
      height: 150,
      minSeq: 0,
      maxSeq: 3,
    });
    assert.equal(geo.hasData, true);
    assert.equal(geo.points.length, 4);
    // Path contains H and V commands for step-after rendering
    assert.ok(geo.linePath.includes('H') && geo.linePath.includes('V'));
    assert.ok(!geo.linePath.includes('C') && !geo.linePath.includes('S'), 'No bezier curves');
  });

  await t.test('4. Event annotations accurately identify insert, remove, and blocked transitions', () => {
    const insertSample = { kind: 'execute', operation: 'insert(order)', orderId: 'O01', occupancy: 1, capacity: 5 };
    const removeSample = { kind: 'execute', operation: 'remove(order)', orderId: 'O01', occupancy: 0, capacity: 5 };
    const blockedProd = { kind: 'blocked', operation: 'wait(empty)', occupancy: 5, capacity: 5 };
    const blockedCons = { kind: 'blocked', operation: 'wait(full)', occupancy: 0, capacity: 5 };

    assert.equal(getEventAnnotation(insertSample)?.type, 'insert');
    assert.equal(getEventAnnotation(removeSample)?.type, 'remove');
    assert.equal(getEventAnnotation(blockedProd)?.type, 'blocked-producer');
    assert.equal(getEventAnnotation(blockedCons)?.type, 'blocked-consumer');
  });
});

test('Execution Analysis — Process Timeline State Derivation', async (t) => {
  await t.test('1. Critical section exclusive access is correctly distinguished from preparation', () => {
    const procCS = { id: 'P1', type: 'PRODUCER', state: 'RUNNING', acquiredMutex: true };
    const workerCS = null;
    const stateCS = getProcessDisplayState(procCS, workerCS, 'P1');
    assert.equal(stateCS.stateKey, 'CRITICAL_SECTION');
    assert.equal(stateCS.tone, 'gold');
    assert.equal(stateCS.isMutexOwner, true);

    const procPrep = { id: 'C1', type: 'CONSUMER', state: 'PREPARING', acquiredMutex: false };
    const workerPrep = { state: 'PREPARING', assignedOrderId: 'O01', progress: 1, duration: 3 };
    const statePrep = getProcessDisplayState(procPrep, workerPrep, null);
    assert.equal(statePrep.stateKey, 'PREPARING');
    assert.equal(statePrep.tone, 'teal');
    assert.equal(statePrep.isPreparing, true);
    assert.equal(statePrep.isMutexOwner, undefined);
  });

  await t.test('2. Semaphore blocked states derived honestly from waitingFor', () => {
    const procEmpty = { id: 'P2', type: 'PRODUCER', state: 'BLOCKED', waitingFor: 'empty' };
    assert.equal(getProcessDisplayState(procEmpty, null, null).stateKey, 'WAITING_EMPTY');

    const procFull = { id: 'C2', type: 'CONSUMER', state: 'BLOCKED', waitingFor: 'full' };
    assert.equal(getProcessDisplayState(procFull, null, null).stateKey, 'WAITING_FULL');

    const procMutex = { id: 'P1', type: 'PRODUCER', state: 'WAITING', waitingFor: 'mutex' };
    assert.equal(getProcessDisplayState(procMutex, null, 'C1').stateKey, 'WAITING_MUTEX');
  });

  await t.test('3. Runnable READY is distinguished from actively RUNNING', () => {
    const procRunning = { id: 'P1', type: 'PRODUCER', state: 'RUNNING' };
    const stateRunning = getProcessDisplayState(procRunning, null, null);
    assert.equal(stateRunning.stateKey, 'RUNNING');
    assert.equal(stateRunning.badge, 'RUN');

    const procReady = { id: 'P1', type: 'PRODUCER', state: 'READY' };
    const stateReady = getProcessDisplayState(procReady, null, null);
    assert.equal(stateReady.stateKey, 'READY');
    assert.equal(stateReady.badge, 'READY');
  });

  await t.test('4. Persistent consumer IDLE is distinguished from completed producer', () => {
    const workerIdle = { id: 'C1', state: 'IDLE' };
    const procConsumer = { id: 'C1', type: 'CONSUMER', state: 'READY' };
    const stateIdle = getProcessDisplayState(procConsumer, workerIdle, null);
    assert.equal(stateIdle.stateKey, 'IDLE');
    assert.equal(stateIdle.badge, 'IDLE');

    const procCompleted = { id: 'P1', type: 'PRODUCER', state: 'COMPLETED' };
    const stateCompleted = getProcessDisplayState(procCompleted, null, null);
    assert.equal(stateCompleted.stateKey, 'COMPLETED');
    assert.equal(stateCompleted.badge, 'DONE');
  });
});

test('Execution Analysis — Cause and Effect Narrative & Accounting', async (t) => {
  await t.test('1. Remove transition explains removal and states pointer will advance in next step', () => {
    const sample = {
      seq: 18,
      kind: 'execute',
      processId: 'C1',
      operation: 'remove(order)',
      instructionOp: 'remove',
      orderId: 'O01',
      occupancy: 4,
      capacity: 5,
      readPosition: 0,
      writePosition: 4,
      mutexOwner: 'C1',
      empty: 0,
      full: 4,
      reservedEmpty: 1,
      reservedFull: 0,
      variableChanges: {
        before: { occupancy: 5, readPosition: 0, writePosition: 4, mutexOwner: 'C1', empty: 0, full: 5 },
        after: { occupancy: 4, readPosition: 0, writePosition: 4, mutexOwner: 'C1', empty: 0, full: 4 },
      },
    };

    const res = generateStepCauseAndEffect(sample);
    assert.ok(res.headline.includes('C1 REMOVED O01'));
    assert.equal(res.queueItem.text, '5 → 4 orders');
    assert.equal(res.queueItem.changed, true);
    // Read pointer must NOT claim it advanced during remove
    assert.ok(res.pointerItem.text.includes('advances in next instruction'));
    assert.equal(res.pointerItem.changed, false);
    assert.ok(res.explanation.includes('read pointer remains at slot 0 and will advance modulo 5 in the next instruction'));
    // Permit conservation
    assert.equal(res.accounting.isConserved, true);
    assert.equal(res.accounting.equation, '0 + 4 + 1 + 0 = 5');
  });

  await t.test('2. Advance read pointer transition explains modulo-5 advance without faking removal', () => {
    const sample = {
      seq: 19,
      kind: 'execute',
      processId: 'C1',
      operation: 'read = (read + 1) % 5',
      instructionOp: 'advanceread',
      orderId: null,
      occupancy: 4,
      capacity: 5,
      readPosition: 1,
      writePosition: 4,
      mutexOwner: 'C1',
      empty: 0,
      full: 4,
      reservedEmpty: 1,
      reservedFull: 0,
      variableChanges: {
        before: { occupancy: 4, readPosition: 0, writePosition: 4, mutexOwner: 'C1', empty: 0, full: 4 },
        after: { occupancy: 4, readPosition: 1, writePosition: 4, mutexOwner: 'C1', empty: 0, full: 4 },
      },
    };

    const res = generateStepCauseAndEffect(sample);
    assert.ok(res.headline.includes('ADVANCED READ POINTER'));
    assert.equal(res.pointerItem.changed, true);
    assert.ok(res.pointerItem.text.includes('0 → 1'));
    assert.equal(res.queueItem.changed, false);
    assert.ok(res.explanation.includes('advanced the circular read pointer modulo 5'));
  });

  await t.test('3. Mutex release with causal handoff clearly describes awakened waiter', () => {
    const sample = {
      seq: 20,
      kind: 'execute',
      processId: 'C1',
      operation: 'signal(mutex)',
      instructionOp: 'releasemutex',
      wokenProcess: 'C2',
      wokenResource: 'mutex',
      occupancy: 4,
      capacity: 5,
      readPosition: 1,
      writePosition: 4,
      mutexOwner: 'C2',
      empty: 0,
      full: 4,
      reservedEmpty: 1,
      reservedFull: 0,
    };

    const res = generateStepCauseAndEffect(sample);
    assert.ok(res.headline.includes('RELEASED MUTEX'));
    assert.ok(res.explanation.includes('Ownership passed directly to FIFO waiter C2'));
    assert.equal(res.wokenProcess, 'C2');
  });
});

test('Execution Analysis — Event Filtering for Navigation', async (t) => {
  const samples = [
    { seq: 0, kind: 'init', operation: 'Queue initialized' },
    { seq: 1, kind: 'execute', operation: 'insert(order)', instructionOp: 'insert' },
    { seq: 2, kind: 'execute', operation: 'write = (write + 1) % 5', instructionOp: 'advancewrite' },
    { seq: 3, kind: 'blocked', operation: 'wait(empty)', instructionOp: 'waitempty' },
    { seq: 4, kind: 'execute', operation: 'signal(mutex)', instructionOp: 'releasemutex' },
    { seq: 5, kind: 'kitchen-tick', operation: 'Kitchen Preparation Tick' },
  ];

  await t.test('1. Filter all returns all sequence numbers', () => {
    const all = filterHistoricalSteps(samples, 'all');
    assert.deepEqual(all, [0, 1, 2, 3, 4, 5]);
  });

  await t.test('2. Filter queue returns only insert and remove', () => {
    const queue = filterHistoricalSteps(samples, 'queue');
    assert.deepEqual(queue, [1]);
  });

  await t.test('3. Filter blocked returns blocked transitions', () => {
    const blocked = filterHistoricalSteps(samples, 'blocked');
    assert.deepEqual(blocked, [3]);
  });

  await t.test('4. Filter mutex returns mutex operations', () => {
    const mutex = filterHistoricalSteps(samples, 'mutex');
    assert.deepEqual(mutex, [4]);
  });

  await t.test('5. Filter kitchen returns kitchen ticks', () => {
    const kitchen = filterHistoricalSteps(samples, 'kitchen');
    assert.deepEqual(kitchen, [5]);
  });
});

test('Execution Analysis — Invariant Accounting & Causality Across Transitions', async (t) => {
  await t.test('1. Permit conservation holds at every step of producer-consumer lifecycle', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    engine.addConsumer(1);

    // Step through producer instructions (waitEmpty, waitMutex, insert, advanceWrite, releaseMutex, signalFull)
    for (let i = 0; i < 6; i++) {
      engine.stepNextInstruction();
    }
    // Step through consumer instructions (waitFull, waitMutex, remove, advanceRead, releaseMutex, signalEmpty)
    for (let i = 0; i < 6; i++) {
      engine.stepNextInstruction();
    }
    // Advance kitchen tick
    engine.tickKitchen();

    const history = engine.snapshot().executionHistory;
    assert.ok(history.length >= 13, 'Sufficient steps recorded');

    for (const sample of history) {
      const sum = sample.empty + sample.full + sample.reservedEmpty + sample.reservedFull;
      assert.equal(sum, sample.capacity, `Invariant violated at step ${sample.seq}: ${sum} !== ${sample.capacity}`);
      assert.equal(sample.occupancy, sample.full + sample.reservedFull, `Buffer full conservation violated at step ${sample.seq}`);
    }
  });

  await t.test('2. Saturated queue producer block preserves conservation and records cause', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    // Fill buffer with 5 producers
    engine.addProducer(5);
    for (let i = 0; i < 30; i++) {
      if (engine.processes.some((p) => p.type === 'PRODUCER' && (p.state === 'READY' || p.state === 'RUNNING'))) {
        engine.stepNextInstruction();
      }
    }
    assert.equal(engine.snapshot().occupancy, 5, 'Buffer saturated at 5 orders');

    // 6th producer blocks on wait(empty)
    engine.addProducer(1);
    engine.stepNextInstruction();
    const snap = engine.snapshot();
    const lastSample = snap.executionHistory.at(-1);

    assert.equal(lastSample.kind, TRANSITION_KINDS.BLOCKED);
    assert.equal(lastSample.occupancy, 5);
    assert.equal(lastSample.empty, 0);

    const narrative = generateStepCauseAndEffect(lastSample);
    assert.ok(narrative.headline.includes('BLOCKED ON WAIT(EMPTY)'));
    assert.equal(narrative.accounting.isConserved, true);
    assert.ok(narrative.explanation.includes('entered BLOCKED state and will be awakened in FIFO order'));
  });

  await t.test('3. Signal empty awakens waiting producer and transfers permit directly', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    // Fill buffer
    engine.addProducer(5);
    for (let i = 0; i < 30; i++) {
      if (engine.processes.some((p) => p.type === 'PRODUCER' && (p.state === 'READY' || p.state === 'RUNNING'))) {
        engine.stepNextInstruction();
      }
    }
    // P6 blocks on empty
    engine.addProducer(1);
    engine.stepNextInstruction();
    const p6 = engine.processes.find((p) => p.id === 'P6');
    assert.equal(p6.state, 'BLOCKED');
    assert.equal(p6.waitingFor, 'empty');

    // Add consumer C1 to dequeue and signal empty
    engine.addConsumer(1);
    // Step C1 through: waitFull, waitMutex, remove, advanceRead, releaseMutex, signalEmpty
    for (let i = 0; i < 6; i++) {
      engine.stepNextInstruction();
    }

    const snap = engine.snapshot();
    assert.equal(p6.state, 'READY', 'P6 was awakened to READY by signal(empty)');

    // The signalEmpty sample captures the causal wakeup
    const signalSample = snap.executionHistory.find((s) => String(s.instructionOp).toLowerCase() === 'signalempty');
    assert.ok(signalSample, 'signalEmpty sample was recorded');
    assert.equal(signalSample.wokenProcess, 'P6');

    const narrative = generateStepCauseAndEffect(signalSample);
    assert.ok(narrative.explanation.includes('Oldest waiting producer P6 received the free slot permit directly and woke to READY'));
    assert.equal(narrative.wokenProcess, 'P6');
  });

  await t.test('4. Cautious factual explanation when no process is awakened on release/signal', () => {
    const sample = {
      seq: 10,
      kind: 'execute',
      processId: 'P1',
      operation: 'signal(empty)',
      instructionOp: 'signalempty',
      wokenProcess: null,
      wokenResource: null,
      occupancy: 2,
      capacity: 5,
      readPosition: 0,
      writePosition: 2,
      mutexOwner: null,
      empty: 3,
      full: 2,
      reservedEmpty: 0,
      reservedFull: 0,
    };
    const narrative = generateStepCauseAndEffect(sample);
    assert.ok(narrative.explanation.includes('The available empty semaphore count increased by 1 (now 3)'));
    assert.equal(narrative.wokenProcess, null);
  });
});

