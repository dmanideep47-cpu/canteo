import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

test('Workflow & Removal: 1. Removing unstarted READY process removes it with zero resource leaks', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  assert.equal(engine.processes.length, 4);
  assert.equal(engine.workers.length, 2);

  // Remove P2 while it is READY at pc=0
  const resP2 = engine.removeProcess('P2');
  assert.equal(resP2.success, true);
  assert.equal(resP2.graceful, false);
  assert.equal(engine.processes.some((p) => p.id === 'P2'), false);
  assert.equal(engine.processes.length, 3);

  // Remove C2 while it is READY at pc=0
  const resC2 = engine.removeProcess('C2');
  assert.equal(resC2.success, true);
  assert.equal(resC2.graceful, false);
  assert.equal(engine.processes.some((p) => p.id === 'C2'), false);
  assert.equal(engine.workers.some((w) => w.id === 'C2'), false);
  assert.equal(engine.processes.length, 2);

  // Semaphores and invariants intact
  assert.equal(engine.empty.value, 5);
  assert.equal(engine.full.value, 0);
  assert.equal(engine.mutex.owner, null);
  assert.equal(engine.snapshot().mutex, 1);
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 2. Removing consumer waiting on full removes it from full.waiters without permit leaks', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(3);

  // Step C1, C2, C3 so they block on full
  engine.step('C1');
  engine.step('C2');
  engine.step('C3');

  assert.deepEqual(engine.full.waiters, ['C1', 'C2', 'C3']);
  assert.equal(engine.full.value, 0);

  // Remove C2 from middle of wait queue
  const res = engine.removeProcess('C2');
  assert.equal(res.success, true);
  assert.equal(res.graceful, false);
  assert.deepEqual(engine.full.waiters, ['C1', 'C3'], 'C2 safely spliced from waiters preserving FIFO order');
  assert.equal(engine.processes.some((p) => p.id === 'C2'), false);
  assert.equal(engine.workers.some((w) => w.id === 'C2'), false);

  // Now publish 1 order via P1 and ensure C1 (head) wakes up cleanly
  engine.addProducer(1);
  for (let i = 0; i < 6; i++) {
    engine.step('P1');
  }

  // C1 should have received the permit
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'READY', 'C1 awakened from full');
  assert.deepEqual(engine.full.waiters, ['C3'], 'Only C3 remains waiting');
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 3. Removing producer waiting on empty removes it from empty.waiters without permit leaks', () => {
  const engine = new ProducerConsumerEngine();
  // Fill buffer to 5
  engine.addProducer(5);
  engine.runUntilBlocked();
  assert.equal(engine.buffer.occupancy, 5);
  assert.equal(engine.empty.value, 0);

  // Add 6th and 7th producers that will block on empty
  engine.addProducer(2);
  engine.step('P6');
  engine.step('P7');

  assert.deepEqual(engine.empty.waiters, ['P6', 'P7']);

  // Remove P6
  const res = engine.removeProcess('P6');
  assert.equal(res.success, true);
  assert.equal(res.graceful, false);
  assert.deepEqual(engine.empty.waiters, ['P7'], 'P6 spliced from empty waiters');
  assert.equal(engine.processes.some((p) => p.id === 'P6'), false);

  // Add consumer to free a slot, P7 should wake
  const { ids: [consumerId] } = engine.addConsumer(1);
  for (let i = 0; i < 6; i++) {
    engine.step(consumerId);
  }
  const p7 = engine.processes.find((p) => p.id === 'P7');
  assert.equal(p7.state, 'READY', 'P7 awakened when slot freed');
  assert.equal(engine.empty.waiters.length, 0);
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 4. Graceful removal of process inside critical section completes cycle and retires cleanly', () => {
  const engine = new ProducerConsumerEngine();
  engine.addProducer(1);

  // Advance P1 into critical section: waitEmpty (pc=0 -> 1), waitMutex (pc=1 -> 2)
  engine.step('P1');
  engine.step('P1');
  const p1 = engine.processes.find((p) => p.id === 'P1');
  assert.equal(p1.acquiredMutex, true, 'P1 holds mutex');
  assert.equal(engine.mutex.owner, 'P1');

  // Request removal while holding mutex
  const res = engine.removeProcess('P1');
  assert.equal(res.success, true);
  assert.equal(res.graceful, true, 'Should be graceful retirement');
  assert.equal(p1.stoppingRequested, true);

  // Step through insert (pc=2 -> 3), advanceWrite (pc=3 -> 4), releaseMutex (pc=4 -> 5)
  engine.step('P1'); // insert
  engine.step('P1'); // advanceWrite
  engine.step('P1'); // releaseMutex
  assert.equal(p1.acquiredMutex, false, 'Mutex released');
  assert.equal(engine.mutex.owner, null);

  // Step signalFull (pc=5 -> complete cycle)
  engine.step('P1'); // signalFull -> cycle boundary
  assert.equal(engine.processes.some((p) => p.id === 'P1'), false, 'P1 retired after cycle completion');
  assert.equal(engine.buffer.occupancy, 1, 'Order was safely published');
  assert.equal(engine.empty.value, 4);
  assert.equal(engine.full.value, 1);
  assert.equal(engine.mutex.owner, null);
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 5. Graceful removal of preparing consumer finishes dish and retires worker', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  const { ids: [consumerId] } = engine.addConsumer(1);

  // Produce order
  for (let i = 0; i < 6; i++) {
    engine.step('P1');
  }
  assert.equal(engine.buffer.occupancy, 1);

  // Consume order: waitFull, waitMutex, readBuffer, advanceRead, releaseMutex, signalEmpty -> transitions to PREPARING
  for (let i = 0; i < 6; i++) {
    engine.step(consumerId);
  }
  const worker = engine.workers.find((w) => w.id === consumerId);
  assert.equal(worker.state, 'PREPARING');

  // Request removal during preparation
  const res = engine.removeProcess(consumerId);
  assert.equal(res.success, true);
  assert.equal(res.graceful, true);
  assert.equal(worker.stoppingRequested, true);

  // Tick kitchen through preparationDuration ticks to finish dish
  for (let t = 0; t < worker.preparationDuration; t++) {
    engine.tickKitchen();
  }

  // Worker and process should now have delivered dish and retired cleanly
  assert.equal(engine.workers.some((w) => w.id === consumerId), false, 'Worker retired at cycle completion');
  assert.equal(engine.processes.some((p) => p.id === consumerId), false, 'Process retired at cycle completion');
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 6. Continuous workload producer recycles order IDs without duplicate keys', () => {
  const engine = new ProducerConsumerEngine();
  engine.addProducer(1, { workloadMode: 'continuous' });
  const p1 = engine.processes.find((p) => p.id === 'P1');
  assert.equal(p1.workloadMode, 'continuous');

  const orderIds = [];

  // Cycle 1
  for (let i = 0; i < 6; i++) {
    engine.step('P1');
  }
  assert.equal(p1.state, 'READY', 'Continuous producer recycles to READY');
  assert.equal(p1.completedCount, 1);
  orderIds.push(p1.orderId);

  // Cycle 2
  for (let i = 0; i < 6; i++) {
    engine.step('P1');
  }
  assert.equal(p1.completedCount, 2);
  orderIds.push(p1.orderId);

  assert.equal(orderIds.length, 2);
  assert.notEqual(orderIds[0], orderIds[1], 'Each order ID must be unique');
  assert.equal(engine.buffer.occupancy, 2);
  assert.equal(engine.assertInvariants(), true);
});

test('Workflow & Removal: 7. Reset clears all state completely to pristine 0-process empty canvas', () => {
  const engine = new ProducerConsumerEngine();
  engine.addProducer(3);
  engine.addConsumer(2);
  engine.step();
  engine.step();

  engine.reset();
  const snap = engine.snapshot();
  assert.equal(snap.processes.length, 0);
  assert.equal(snap.occupancy, 0);
  assert.equal(snap.empty, 5);
  assert.equal(snap.full, 0);
  assert.equal(snap.mutex, 1);
  assert.equal(snap.mutexOwner, null);
  assert.equal(engine.assertInvariants(), true);
});
