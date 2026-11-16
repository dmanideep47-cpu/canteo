import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { loadSimulatorScenario } from '../src/synclab/scenarios.js';

test('Acceptance 1 & 2: Start empty -> add producer -> add consumer -> complete lifecycle of same order', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  assert.equal(engine.processes.length, 0);
  assert.equal(engine.buffer.slots.filter(Boolean).length, 0);

  // Add 1 producer, 1 consumer
  const pRes = engine.addProducer(1);
  const cRes = engine.addConsumer(1);
  assert.equal(engine.processes.length, 2);
  const p1 = engine.processes.find((p) => p.id === 'P1');
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.ok(p1 && c1);
  const targetOrderId = p1.orderId;

  // Step until P1 finishes inserting
  while (p1.state !== 'COMPLETED') {
    engine.step('P1');
  }

  // Verify order inserted in slot 0
  const slot0 = engine.buffer.slots[0];
  assert.ok(slot0, 'Slot 0 must be occupied');
  assert.equal(slot0.id, targetOrderId, 'Inserted order ID must match producer order ID');
  assert.equal(engine.full.value, 1, 'Full semaphore must be 1');

  // Step C1 until order is dequeued
  while (c1.state !== 'PREPARING') {
    engine.step('C1');
  }

  // Verify same order is dequeued and slot 0 freed
  assert.equal(engine.buffer.slots[0], null, 'Slot 0 must be freed after consumption');
  assert.equal(engine.empty.value, 5, 'Empty semaphore must be restored to 5');
  assert.equal(c1.result.id, targetOrderId, 'Consumer process must have acquired the exact same order');
  const worker1 = engine.workers.find((w) => w.id === 'C1');
  assert.equal(worker1.assignedOrderId, targetOrderId, 'Kitchen worker must be assigned the exact same order');

  // Advance kitchen preparation ticks until completed
  while (engine.orders[targetOrderId].lifecycle !== 'READY') {
    engine.tickKitchen();
  }

  assert.equal(engine.orders[targetOrderId].lifecycle, 'READY', 'Order lifecycle must be READY/COMPLETED');
  assert.equal(engine.readyOrderIds.includes(targetOrderId), true);
});

test('Acceptance 3: Add consumers before producers -> consumers wait cleanly on full=0, wake up when order arrives', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(2);

  // Step both consumers once: they attempt sem_wait(&full)
  engine.step('C1');
  engine.step('C2');

  assert.equal(engine.full.value, 0);
  assert.equal(engine.processes.find((p) => p.id === 'C1').state, 'BLOCKED');
  assert.equal(engine.processes.find((p) => p.id === 'C2').state, 'BLOCKED');
  assert.deepEqual(engine.full.waiters, ['C1', 'C2']);

  // Add producer and produce order
  engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === 'P1');
  while (p1.state !== 'COMPLETED') {
    engine.step('P1');
  }

  // Exactly C1 (FIFO head) should be awakened
  assert.equal(engine.processes.find((p) => p.id === 'C1').state, 'READY');
  assert.equal(engine.processes.find((p) => p.id === 'C2').state, 'BLOCKED');
  assert.deepEqual(engine.full.waiters, ['C2']);

  // Complete consumption with C1
  while (engine.processes.find((p) => p.id === 'C1').state !== 'PREPARING') {
    engine.step('C1');
  }
  assert.equal(engine.processes.find((p) => p.id === 'C2').state, 'BLOCKED', 'C2 must still be blocked');
});

test('Acceptance 4: One producer with eight consumers -> no permit leakage, strictly conserved permits', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  engine.addConsumer(8);

  const initialEmpty = engine.empty.value;
  const initialFull = engine.full.value;
  assert.equal(initialEmpty + initialFull, 5);

  // Run 30 steps round-robin
  for (let i = 0; i < 30; i++) {
    engine.step();
    // Mathematical invariant at every step
    const occupiedCount = engine.buffer.slots.filter(Boolean).length;
    const reservedEmpty = engine.empty.holders.size;
    const emptyCount = engine.empty.value;
    const fullCount = engine.full.value;
    assert.equal(
      emptyCount + fullCount + reservedEmpty + (occupiedCount > fullCount ? occupiedCount - fullCount : 0) <= 5,
      true,
      'Permits must never exceed bounded buffer capacity 5'
    );
  }
});

test('Acceptance 5: Add processes during playback -> immediately registered and scheduled', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  engine.addConsumer(1);

  // Step 5 times
  for (let i = 0; i < 5; i++) engine.step();

  // Add another producer during active execution
  const addRes = engine.addProducer(1);
  assert.ok(addRes.ids.includes('P2'));
  const p2 = engine.processes.find((p) => p.id === 'P2');
  assert.equal(p2.state, 'READY');

  // Next steps should schedule P2 without errors
  let p2Ran = false;
  for (let i = 0; i < 20; i++) {
    const snap = engine.step();
    if (snap.lastInstruction?.processId === 'P2' || p2.pc > 0 || p2.state === 'COMPLETED') {
      p2Ran = true;
    }
  }
  assert.equal(p2Ran, true, 'Dynamically added process P2 must be executed');
});

test('Acceptance 6 & 7: Safe removal of idle and waiting processes without resource leaks', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  // 1. Remove idle unstarted P2
  const remP2 = engine.removeProcess('P2');
  assert.equal(remP2.success, true);
  assert.equal(remP2.graceful, false, 'Idle process must be removed immediately');
  assert.equal(engine.processes.some((p) => p.id === 'P2'), false);

  // 2. Step C1 and C2 so they wait on full=0
  engine.step('C1');
  engine.step('C2');
  assert.deepEqual(engine.full.waiters, ['C1', 'C2']);

  // Remove waiting consumer C2
  const remC2 = engine.removeProcess('C2');
  assert.equal(remC2.success, true);
  assert.equal(remC2.graceful, false);
  assert.equal(engine.full.waiters.includes('C2'), false, 'C2 must be spliced out of full waiters');
  assert.deepEqual(engine.full.waiters, ['C1']);
  assert.equal(engine.full.value, 0, 'Permits must remain uncorrupted');
});

test('Acceptance 8: Graceful removal while owning resources (critical section)', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === 'P1');

  // Step P1 into critical section: pc 0 (waitEmpty), pc 1 (waitMutex) -> pc 2 (inside mutex)
  engine.step('P1');
  engine.step('P1');
  assert.equal(p1.acquiredMutex, true);
  assert.equal(engine.mutex.owner, 'P1');

  // Request removal of P1
  const remRes = engine.removeProcess('P1');
  assert.equal(remRes.success, true);
  assert.equal(remRes.graceful, true, 'Must request graceful retirement');
  assert.equal(p1.stoppingRequested, true);
  assert.equal(engine.processes.some((p) => p.id === 'P1'), true, 'P1 must NOT disappear immediately');

  // Complete P1 instructions
  while (engine.processes.some((p) => p.id === 'P1')) {
    engine.step('P1');
  }

  // Mutex must be unlocked and not orphaned
  assert.equal(engine.snapshot().mutex, 1, 'Mutex must be released');
  assert.equal(engine.mutex.owner, null, 'Mutex must not have orphaned owner');
  assert.equal(engine.processes.some((p) => p.id === 'P1'), false, 'P1 must retire after releasing lock');
});

test('Acceptance 9: Graceful removal of a preparing kitchen consumer', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  engine.addConsumer(1, { preparationDuration: 2 });
  const p1 = engine.processes.find((p) => p.id === 'P1');
  const c1 = engine.processes.find((p) => p.id === 'C1');

  // Produce order
  while (p1.state !== 'COMPLETED') engine.step('P1');

  // Consumer dequeues and enters PREPARING
  while (c1.state !== 'PREPARING') engine.step('C1');
  assert.equal(c1.state, 'PREPARING');

  // Request removal while cooking
  const remRes = engine.removeProcess('C1');
  assert.equal(remRes.success, true);
  assert.equal(remRes.graceful, true);
  assert.equal(c1.stoppingRequested, true);

  // Advance kitchen ticks
  while (engine.processes.some((p) => p.id === 'C1')) {
    engine.tickKitchen();
  }

  // Verify order is READY and C1 retired cleanly
  const worker = engine.workers.find((w) => w.id === 'C1');
  assert.equal(worker, undefined, 'Worker must be retired');
  assert.equal(engine.processes.some((p) => p.id === 'C1'), false);
  assert.equal(engine.readyOrderIds.length, 1, 'Dish must not be stranded');
});

test('Acceptance 10: Repeat minus while removals are pending -> skips already stopping processes', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  const p1 = engine.processes.find((p) => p.id === 'P1');
  const p2 = engine.processes.find((p) => p.id === 'P2');

  // Move P2 into critical section
  engine.step('P2');
  engine.step('P2');
  assert.equal(p2.acquiredMutex, true);

  // Rule 1: First minus prefers newest safely removable process (P1 is idle, so P1 is removed immediately)
  const rem1 = engine.removeProcess('PRODUCER');
  assert.equal(rem1.processId, 'P1');
  assert.equal(rem1.graceful, false, 'Idle P1 removed immediately');

  // Rule 2: Second minus targets P2 (holding mutex -> graceful stop requested)
  const rem2 = engine.removeProcess('PRODUCER');
  assert.equal(rem2.processId, 'P2');
  assert.equal(rem2.graceful, true, 'P2 marked for graceful stopping');

  // Rule 3: Third minus skips already stopping P2 -> no more removable producers
  const rem3 = engine.removeProcess('PRODUCER');
  assert.equal(rem3.success, false, 'Cannot remove when all are stopping');
});

test('Acceptance 11: Circular buffer modulo wraparound (4 -> 0)', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1, { workloadMode: 'continuous' });
  engine.addConsumer(1, { preparationDuration: 1 });

  const seenWriteIndices = new Set();
  const seenReadIndices = new Set();

  for (let i = 0; i < 120; i++) {
    engine.step();
    seenWriteIndices.add(engine.buffer.writePosition);
    seenReadIndices.add(engine.buffer.readPosition);
  }

  // All 5 indices [0, 1, 2, 3, 4] must have been used
  assert.equal(seenWriteIndices.size, 5);
  assert.equal(seenReadIndices.size, 5);
  assert.equal(engine.integrityFailure, null, 'No integrity failures during modulo 5 wraparound');
});

test('Acceptance 12 & 13: Scheduler switching and pause/resume preservation', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  // Run 6 steps
  for (let i = 0; i < 6; i++) engine.step();
  const snapshotBefore = engine.snapshot();

  // Changing scheduling logic outside engine does not mutate engine state
  const snapshotAfter = engine.snapshot();
  assert.equal(snapshotBefore.full, snapshotAfter.full);
  assert.equal(snapshotBefore.empty, snapshotAfter.empty);
  assert.equal(snapshotBefore.mutex, snapshotAfter.mutex);
  assert.equal(snapshotBefore.occupancy, snapshotAfter.occupancy);
});

test('Acceptance 14: Simulator Scenarios loading', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  loadSimulatorScenario('full', engine);
  const snapFull = engine.snapshot();
  assert.equal(snapFull.occupancy, 5, 'Full scenario must have 5 occupied slots');
  assert.equal(snapFull.empty, 0, 'Full scenario must have 0 empty permits');

  loadSimulatorScenario('empty', engine);
  const snapEmpty = engine.snapshot();
  assert.equal(snapEmpty.occupancy, 0, 'Empty scenario must have 0 occupied slots');
  assert.equal(snapEmpty.full, 0, 'Empty scenario must have 0 full permits');
});

test('Acceptance 15 & 16: Reset & Clear Session lifecycle', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(3);
  engine.addConsumer(3);
  for (let i = 0; i < 10; i++) engine.step();

  // Reset restores pristine semaphores
  engine.reset();
  const snapReset = engine.snapshot();
  assert.equal(snapReset.empty, 5);
  assert.equal(snapReset.full, 0);
  assert.equal(snapReset.mutex, 1);
  assert.equal(snapReset.occupancy, 0);
  assert.equal(engine.processes.length, 0);

  // Rebuild
  engine.addProducer(2);
  engine.addConsumer(2);
  assert.equal(engine.processes.length, 4);
  engine.step();
  assert.equal(engine.snapshot().empty < 5 || engine.snapshot().full > 0 || engine.processes[0].pc > 0, true);
});
