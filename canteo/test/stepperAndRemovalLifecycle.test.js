import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

test('Lifecycle 1. Addition at zero: creates exactly one process with correct initial properties', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  assert.equal(engine.processes.length, 0);
  assert.equal(engine.workers.length, 0);

  // Add 1 producer
  const pRes = engine.addProducer(1);
  assert.deepEqual(pRes.ids, ['P1']);
  assert.equal(engine.processes.length, 1);
  const p1 = engine.processes[0];
  assert.equal(p1.id, 'P1');
  assert.equal(p1.type, 'PRODUCER');
  assert.equal(p1.state, 'READY');
  assert.equal(p1.pc, 0);
  assert.equal(p1.stoppingRequested, false);

  // Add 1 consumer
  const cRes = engine.addConsumer(1);
  assert.deepEqual(cRes.ids, ['C1']);
  assert.equal(engine.processes.length, 2);
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.type, 'CONSUMER');
  assert.equal(c1.state, 'READY');
  assert.equal(c1.pc, 0);
  assert.equal(c1.stoppingRequested, false);
  assert.equal(engine.workers.length, 1);

  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 2. Repeated addition: generates unique, stable IDs without collision', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(3);
  engine.addConsumer(3);

  const producerIds = engine.processes.filter((p) => p.type === 'PRODUCER').map((p) => p.id);
  const consumerIds = engine.processes.filter((p) => p.type === 'CONSUMER').map((p) => p.id);

  assert.deepEqual(producerIds, ['P1', 'P2', 'P3']);
  assert.deepEqual(consumerIds, ['C1', 'C2', 'C3']);

  // Verify unique stable order IDs
  const orderIds = engine.processes.filter((p) => p.type === 'PRODUCER').map((p) => p.orderId);
  assert.deepEqual(orderIds, ['O01', 'O02', 'O03']);
  assert.equal(new Set(orderIds).size, 3);
  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 3. Removal at zero: safe failure without exceptions and count remains 0', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  assert.equal(engine.processes.length, 0);

  // Attempt removing from empty engine
  const resProducer = engine.removeProcess('PRODUCER');
  assert.equal(resProducer.success, false);
  assert.match(resProducer.reason, /No removable producer processes found/i);
  assert.equal(engine.processes.length, 0);

  const resConsumer = engine.removeProcess('CONSUMER');
  assert.equal(resConsumer.success, false);
  assert.match(resConsumer.reason, /No removable consumer processes found/i);
  assert.equal(engine.processes.length, 0);

  const resNull = engine.removeProcess(null);
  assert.equal(resNull.success, false);

  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 4. Waiting-process removal: consumer blocked on empty buffer spliced from wait queue', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(3); // C1, C2, C3

  // Step C1, C2, C3 so they block on sem_wait(&full)
  engine.step('C1');
  engine.step('C2');
  engine.step('C3');

  assert.deepEqual(engine.full.waiters, ['C1', 'C2', 'C3']);
  assert.equal(engine.full.value, 0);

  // Stepper removal policy prefers newest safely removable (C3)
  const res = engine.removeProcess('CONSUMER');
  assert.equal(res.success, true);
  assert.equal(res.graceful, false);
  assert.equal(res.processId, 'C3');

  // Verify C3 removed immediately and waiters spliced cleanly
  assert.deepEqual(engine.full.waiters, ['C1', 'C2']);
  assert.equal(engine.processes.some((p) => p.id === 'C3'), false);
  assert.equal(engine.workers.some((w) => w.id === 'C3'), false);
  assert.equal(engine.processes.length, 2);

  // Now publish 1 order via P1 and verify C1 (head of FIFO queue) is awakened
  engine.addProducer(1); // P1
  for (let i = 0; i < 6; i++) {
    engine.step('P1');
  }

  // After P1 posts full, C1 should have received permit and advanced
  assert.equal(engine.full.waiters.includes('C1'), false);
  assert.deepEqual(engine.full.waiters, ['C2']);
  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 5. Resource-owning graceful removal: completes cycle and retires cleanly', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1); // P1

  // Advance P1 into critical section:
  // pc=0: sem_wait(&empty) -> acquired
  // pc=1: pthread_mutex_lock(&mutex) -> acquired
  engine.step('P1');
  engine.step('P1');

  const p1 = engine.processes.find((p) => p.id === 'P1');
  assert.equal(p1.pc, 2);
  assert.equal(p1.permit, true);
  assert.equal(p1.acquiredMutex, true);
  assert.equal(engine.mutex.owner, 'P1');

  // Request removal while inside critical section
  const res = engine.removeProcess('PRODUCER');
  assert.equal(res.success, true);
  assert.equal(res.graceful, true);
  assert.equal(res.processId, 'P1');

  // Process must NOT disappear immediately
  assert.equal(engine.processes.length, 1);
  assert.equal(engine.processes[0].id, 'P1');
  assert.equal(engine.processes[0].stoppingRequested, true);

  // Finish critical section and signal instructions:
  // pc=2: insert
  // pc=3: advanceWrite
  // pc=4: unlock
  // pc=5: sem_post(&full)
  engine.step('P1'); // insert
  engine.step('P1'); // advanceWrite
  engine.step('P1'); // unlock
  assert.equal(engine.mutex.owner, null);

  engine.step('P1'); // sem_post(&full) -> cycle boundary reached

  // Now P1 should have safely retired and been removed
  assert.equal(engine.processes.length, 0);
  assert.equal(engine.buffer.occupancy, 1);
  assert.equal(engine.full.value, 1);
  assert.equal(engine.empty.value, 4);
  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 6. Repeated minus clicks: skips stopping, stops next candidate, disables at zero non-stopping', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(2); // C1, C2
  engine.addProducer(1); // P1

  // P1 produces 1 order into buffer
  for (let i = 0; i < 6; i++) engine.step('P1');
  assert.equal(engine.buffer.occupancy, 1);

  // C1 claims order and enters PREPARING
  for (let i = 0; i < 6; i++) engine.step('C1');
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'PREPARING');

  // C2 steps and blocks on sem_wait(&full) because buffer is now empty
  engine.step('C2');
  const c2 = engine.processes.find((p) => p.id === 'C2');
  assert.equal(c2.state, 'BLOCKED');
  assert.equal(c2.waitingFor, 'full');

  // Total consumers: 2 (C1 preparing, C2 blocked)
  assert.equal(engine.processes.filter((p) => p.type === 'CONSUMER').length, 2);

  // Click 1: Removal policy targets newest safely removable (C2, blocked without resources)
  const res1 = engine.removeProcess('CONSUMER');
  assert.equal(res1.success, true);
  assert.equal(res1.graceful, false);
  assert.equal(res1.processId, 'C2');
  assert.equal(engine.processes.filter((p) => p.type === 'CONSUMER').length, 1);

  // Click 2: Only C1 remains (preparing in kitchen). Needs graceful stop.
  const res2 = engine.removeProcess('CONSUMER');
  assert.equal(res2.success, true);
  assert.equal(res2.graceful, true);
  assert.equal(res2.processId, 'C1');
  // C1 still in processes list because it is finishing preparation
  assert.equal(engine.processes.filter((p) => p.type === 'CONSUMER').length, 1);
  assert.equal(engine.processes.find((p) => p.id === 'C1').stoppingRequested, true);

  // Click 3: All remaining consumers are stopping.
  const res3 = engine.removeProcess('CONSUMER');
  assert.equal(res3.success, false);
  assert.match(res3.reason, /No removable consumer processes found/i);

  // Now tick kitchen so C1 completes preparation
  while (engine.workers.some((w) => w.id === 'C1' && w.state === 'PREPARING')) {
    engine.tickKitchen();
  }

  // Once C1 finishes cooking, it retires
  assert.equal(engine.processes.filter((p) => p.type === 'CONSUMER').length, 0);
  assert.equal(engine.workers.some((w) => w.id === 'C1'), false);
  assert.equal(engine.assertInvariants(), true);
});

test('Lifecycle 7. Dynamic addition and removal during playback: scheduler advances without fault', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  // Simulate 15 playback steps
  for (let s = 0; s < 15; s++) {
    // Dynamically add a producer at step 5
    if (s === 5) {
      engine.addProducer(1);
    }
    // Dynamically remove a consumer at step 8
    if (s === 8) {
      engine.removeProcess('CONSUMER');
    }
    // Round-robin step
    const candidates = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    if (candidates.length > 0) {
      engine.step();
    } else {
      const prep = engine.workers.filter((w) => w.state === 'PREPARING');
      if (prep.length > 0) {
        engine.tickKitchen();
      }
    }
    assert.equal(engine.assertInvariants(), true);
  }
});

test('Lifecycle 8. Reset during pending removal: completely cleans stopping flags and restores pristine state', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  engine.step('P1'); // pc=0 -> pc=1 (holds empty permit)

  // Request graceful removal
  engine.removeProcess('P1');
  assert.equal(engine.processes[0].stoppingRequested, true);

  // Perform reset
  engine.reset();

  assert.equal(engine.processes.length, 0);
  assert.equal(engine.workers.length, 0);
  assert.equal(engine.empty.value, 5);
  assert.equal(engine.full.value, 0);
  assert.equal(engine.mutex.owner, null);
  assert.equal(engine.reservedEmpty, 0);
  assert.equal(engine.reservedFull, 0);
  assert.equal(engine.buffer.occupancy, 0);
  assert.equal(engine.lastScheduledId, null);
  assert.equal(engine.assertInvariants(), true);
});

