import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

function createEngine() {
  return new ProducerConsumerEngine({ persistentConsumers: true });
}

function produceOrders(engine, count) {
  const { ids } = engine.addProducer(count);
  while (engine.processes.some((p) => ids.includes(p.id) && (p.state === 'READY' || p.state === 'RUNNING'))) {
    const ready = engine.processes.find((p) => ids.includes(p.id) && (p.state === 'READY' || p.state === 'RUNNING'));
    if (!ready) break;
    engine.step(ready.id);
  }
}

test('Test A: Two consumers and five orders (FIFO claim, distinct orders, pointer advances 0 -> 2)', () => {
  const engine = createEngine();
  produceOrders(engine, 5);

  const initSnap = engine.snapshot();
  assert.equal(initSnap.occupancy, 5);
  assert.equal(initSnap.readPosition, 0);
  assert.deepEqual(initSnap.slots.map((s) => s?.id), ['O01', 'O02', 'O03', 'O04', 'O05']);

  engine.addConsumer(2);

  // Step C1 through removal
  while (engine.processes.some((p) => p.id === 'C1' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C1');
  }

  const afterC1 = engine.snapshot();
  const c1Worker = afterC1.workers.find((w) => w.id === 'C1');
  assert.equal(c1Worker.assignedOrderId, 'O01');
  assert.equal(c1Worker.state, 'PREPARING');
  assert.equal(afterC1.readPosition, 1);
  assert.equal(afterC1.mutexOwner, null);

  // Step C2 through removal
  while (engine.processes.some((p) => p.id === 'C2' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C2');
  }

  const afterC2 = engine.snapshot();
  const c2Worker = afterC2.workers.find((w) => w.id === 'C2');
  assert.equal(c2Worker.assignedOrderId, 'O02');
  assert.equal(c2Worker.state, 'PREPARING');
  assert.equal(afterC2.readPosition, 2);
  assert.equal(afterC2.mutexOwner, null);

  // Remaining in buffer must be O03, O04, O05
  assert.deepEqual(afterC2.slots.filter(Boolean).map((s) => s.id), ['O03', 'O04', 'O05']);
  assert.equal(afterC2.occupancy, 3);
  assert.equal(afterC2.empty, 2);
  assert.equal(afterC2.full, 3);
  assert.equal(afterC2.integrity.passed, true);
});

test('Test B: Three consumers and five orders (C1, C2, C3 claim O01, O02, O03 and prepare independently)', () => {
  const engine = createEngine();
  produceOrders(engine, 5);
  engine.addConsumer(3);

  for (const cId of ['C1', 'C2', 'C3']) {
    while (engine.processes.some((p) => p.id === cId && p.pc < 6 && p.state !== 'PREPARING')) {
      engine.step(cId);
    }
  }

  const snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C1').assignedOrderId, 'O01');
  assert.equal(snap.workers.find((w) => w.id === 'C2').assignedOrderId, 'O02');
  assert.equal(snap.workers.find((w) => w.id === 'C3').assignedOrderId, 'O03');
  assert.ok(snap.workers.every((w) => w.state === 'PREPARING'));
  assert.deepEqual(snap.slots.filter(Boolean).map((s) => s.id), ['O04', 'O05']);
  assert.equal(snap.readPosition, 3);
  assert.equal(snap.mutexOwner, null);
  assert.equal(snap.integrity.passed, true);
});

test('Test C: Two consumers, only one order (one claims, second waits for full permit)', () => {
  const engine = createEngine();
  produceOrders(engine, 1);
  engine.addConsumer(2);

  // C1 claims
  while (engine.processes.some((p) => p.id === 'C1' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C1');
  }

  // C2 attempts to claim
  engine.step('C2'); // C2 executes wait(full)

  const snap = engine.snapshot();
  const c1Worker = snap.workers.find((w) => w.id === 'C1');
  const c2Worker = snap.workers.find((w) => w.id === 'C2');

  assert.equal(c1Worker.assignedOrderId, 'O01');
  assert.equal(c1Worker.state, 'PREPARING');
  assert.equal(c2Worker.state, 'WAITING_FOR_ORDER');
  assert.equal(c2Worker.assignedOrderId, null);
  assert.deepEqual(snap.fullWaiters, ['C2']);
  assert.equal(snap.occupancy, 0);
  assert.equal(snap.integrity.passed, true);
});

test('Test D: Reserved permit while waiting for mutex (mandatory stale-head & duplicate-removal check)', () => {
  const engine = createEngine();
  produceOrders(engine, 5);
  engine.addConsumer(2);

  // 1. C1 reserves full permit
  engine.step('C1'); // waitFull
  let snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C1').state, 'FULL_PERMIT_RESERVED');
  assert.equal(snap.full, 4);
  assert.equal(snap.reservedFull, 1);
  assert.equal(snap.occupancy, 5); // physical buffer unchanged

  // 2. C2 reserves another full permit
  engine.step('C2'); // waitFull
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C2').state, 'FULL_PERMIT_RESERVED');
  assert.equal(snap.full, 3);
  assert.equal(snap.reservedFull, 2);
  assert.equal(snap.occupancy, 5); // physical buffer unchanged (full + reservedFull = 3 + 2 = 5)

  // 3. C1 acquires mutex
  engine.step('C1'); // waitMutex -> acquired!
  snap = engine.snapshot();
  assert.equal(snap.mutexOwner, 'C1');
  assert.equal(snap.workers.find((w) => w.id === 'C1').state, 'CRITICAL_SECTION');

  // 4. C2 attempts waitMutex -> blocked!
  engine.step('C2'); // waitMutex -> blocks because C1 owns mutex!
  snap = engine.snapshot();
  assert.equal(snap.mutexOwner, 'C1');
  assert.deepEqual(snap.mutexWaiters, ['C2']);
  assert.equal(snap.workers.find((w) => w.id === 'C2').state, 'WAITING_FOR_MUTEX');

  // 5. C1 removes order (O01 at slot 0)
  engine.step('C1'); // remove(order)
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C1').state, 'ORDER_REMOVED');
  assert.equal(snap.workers.find((w) => w.id === 'C1').assignedOrderId, 'O01');
  assert.equal(snap.occupancy, 4);
  assert.equal(snap.slots[0], null);

  // 6. C1 advances read pointer
  engine.step('C1'); // advanceRead -> readPos becomes 1
  snap = engine.snapshot();
  assert.equal(snap.readPosition, 1);

  // 7. C1 releases mutex -> hands off mutex directly to waiting C2!
  engine.step('C1'); // releaseMutex
  snap = engine.snapshot();
  assert.equal(snap.mutexOwner, 'C2'); // C2 is the new owner!
  assert.equal(snap.workers.find((w) => w.id === 'C1').state, 'PREPARING');
  assert.equal(snap.workers.find((w) => w.id === 'C2').state, 'CRITICAL_SECTION');

  // C1 signals empty
  engine.step('C1'); // signalEmpty

  // 8. C2 (now owning mutex) executes remove(order).
  // CRITICAL CHECK: C2 MUST remove O02 at slot 1, NOT O01 again!
  engine.step('C2'); // remove(order)
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C2').assignedOrderId, 'O02');
  assert.equal(snap.workers.find((w) => w.id === 'C2').state, 'ORDER_REMOVED');
  assert.equal(snap.slots[1], null);
  assert.equal(snap.occupancy, 3);

  // 9. C2 advances read pointer to 2
  engine.step('C2'); // advanceRead
  snap = engine.snapshot();
  assert.equal(snap.readPosition, 2);

  // 10. C2 releases mutex
  engine.step('C2'); // releaseMutex
  engine.step('C2'); // signalEmpty
  snap = engine.snapshot();
  assert.equal(snap.mutexOwner, null);
  assert.equal(snap.workers.find((w) => w.id === 'C2').state, 'PREPARING');

  // Invariants hold completely
  assert.equal(snap.integrity.passed, true);
  assert.deepEqual(snap.slots.filter(Boolean).map((s) => s.id), ['O03', 'O04', 'O05']);
});

test('Test E: Circular buffer wraparound (O04 at slot 3, O05 at slot 4, O06 at slot 0)', () => {
  const engine = createEngine();
  // Fill buffer with 5 orders (O01..O05)
  produceOrders(engine, 5);
  engine.addConsumer(1);

  // Consume 3 orders (O01, O02, O03)
  for (let i = 0; i < 3; i++) {
    while (engine.processes.some((p) => p.id === 'C1' && p.pc < 6 && p.state !== 'PREPARING')) {
      engine.step('C1');
    }
    while (engine.workers.some((w) => w.id === 'C1' && w.state === 'PREPARING')) {
      engine.tickKitchen();
    }
  }

  // Produce O06 at slot 0 (writePosition wraps to 1)
  produceOrders(engine, 1);

  let snap = engine.snapshot();
  assert.equal(snap.readPosition, 3);
  assert.equal(snap.writePosition, 1);
  assert.equal(snap.slots[3]?.id, 'O04');
  assert.equal(snap.slots[4]?.id, 'O05');
  assert.equal(snap.slots[0]?.id, 'O06');
  assert.equal(snap.slots[1], null);
  assert.equal(snap.slots[2], null);

  // Add consumer C2
  engine.addConsumer(1);

  // Two consumers: C1 removes O04, C2 removes O05
  while (engine.processes.some((p) => p.id === 'C1' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C1');
  }
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C1').assignedOrderId, 'O04');
  assert.equal(snap.readPosition, 4);

  while (engine.processes.some((p) => p.id === 'C2' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C2');
  }
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C2').assignedOrderId, 'O05');
  assert.equal(snap.readPosition, 0); // wrapped around from 4 to 0!

  // O06 must remain in slot 0 awaiting next claim
  assert.equal(snap.slots[0]?.id, 'O06');
  assert.equal(snap.occupancy, 1);
  assert.equal(snap.integrity.passed, true);
});

test('Test F: Independent preparation (durations 3, 5, 2 ticks; C3 finishes first and can claim next)', () => {
  const engine = createEngine();
  produceOrders(engine, 5); // O01(3), O02(5), O03(2), O04(4), O05(3)
  engine.addConsumer(3);

  // C1, C2, C3 claim O01, O02, O03
  for (const cId of ['C1', 'C2', 'C3']) {
    while (engine.processes.some((p) => p.id === cId && p.pc < 6 && p.state !== 'PREPARING')) {
      engine.step(cId);
    }
  }

  let snap = engine.snapshot();
  assert.deepEqual(snap.workers.map((w) => w.assignedOrderId), ['O01', 'O02', 'O03']);
  assert.deepEqual(snap.workers.map((w) => w.preparationDuration), [3, 5, 2]);

  // Tick 1
  engine.tickKitchen();
  snap = engine.snapshot();
  assert.deepEqual(snap.workers.map((w) => w.preparationProgress), [1, 1, 1]);

  // Tick 2: C3 reaches 2/2 and finishes! Returns to IDLE
  engine.tickKitchen();
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C3').state, 'IDLE');
  assert.equal(snap.orders.find((o) => o.id === 'O03').lifecycle, 'READY');
  assert.deepEqual(snap.readyOrders.map((o) => o.id), ['O03']);
  assert.deepEqual(snap.workers.slice(0, 2).map((w) => w.preparationProgress), [2, 2]);

  // C3 is reused to claim O04 from slot 3
  while (engine.processes.some((p) => p.id === 'C3' && p.pc < 6 && p.state !== 'PREPARING')) {
    engine.step('C3');
  }
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C3').assignedOrderId, 'O04');
  assert.equal(snap.workers.find((w) => w.id === 'C3').state, 'PREPARING');

  // Tick 3: C1 reaches 3/3 and finishes O01!
  engine.tickKitchen();
  snap = engine.snapshot();
  assert.equal(snap.workers.find((w) => w.id === 'C1').state, 'IDLE');
  assert.equal(snap.orders.find((o) => o.id === 'O01').lifecycle, 'READY');

  assert.equal(snap.integrity.passed, true);
});
