import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import {
  deriveSystemStatus,
  deriveLastEventDetails,
  deriveSessionSummary,
  filterRecentLifecycleEvents,
  createMulberry32,
} from '../src/synclab/arena/simulatorStatusHelper.js';

test('Status Messages 1. Empty session status', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });

  assert.equal(status.statusKey, 'EMPTY');
  assert.equal(status.badge, 'IDLE');
  assert.equal(status.message, 'Empty session · Add a student producer or kitchen consumer.');
});

test('Status Messages 2. Paused with runnable processes does NOT recommend adding a producer', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  // Both P1 and P2 are READY. empty=5, full=0.
  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });

  // Must state Paused · Press Play, and must NOT recommend adding a producer
  assert.equal(status.statusKey, 'PAUSED');
  assert.equal(status.badge, 'PAUSED');
  assert.equal(status.message, 'Paused · Press Play to execute ready processes.');
  assert.equal(status.message.includes('Add or run a producer'), false);
});

test('Status Messages 3. Waiting for orders when 0 producers exist', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(2);

  // Consumers step and block on empty buffer (full === 0)
  engine.step('C1');
  engine.step('C2');

  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });
  assert.equal(status.statusKey, 'WAITING_ORDERS_ADD');
  assert.equal(status.badge, 'WAITING');
  assert.equal(status.message, 'Waiting for orders · Add or run a producer.');
});

test('Status Messages 4. Waiting for capacity when buffer is full', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(6);

  // Fill buffer with 5 orders; 6th producer blocks on empty
  for (let p = 1; p <= 5; p++) {
    for (let step = 0; step < 6; step++) {
      engine.step(`P${p}`);
    }
  }
  engine.step('P6'); // blocks on sem_wait(&empty)

  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });
  assert.equal(status.statusKey, 'WAITING_CAPACITY');
  assert.equal(status.badge, 'WAITING');
  assert.equal(status.message, 'Waiting for capacity · Run a consumer.');
});

test('Status Messages 5. Preparing orders in kitchen', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(2);
  engine.addConsumer(2);

  // P1 produces 1 order
  for (let s = 0; s < 6; s++) engine.step('P1');

  // C1 claims order and enters PREPARING
  for (let s = 0; s < 6; s++) engine.step('C1');

  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });
  assert.equal(status.statusKey, 'PREPARING');
  assert.equal(status.badge, 'PREPARING');
  assert.equal(status.message, 'Preparing 1 order.');
});

test('Status Messages 6. All finite workloads completed', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1, { workloadMode: 'single' });

  // P1 produces and completes
  for (let s = 0; s < 6; s++) engine.step('P1');
  assert.equal(engine.processes[0].state, 'COMPLETED');

  const status = deriveSystemStatus({ state: engine.snapshot(), isPlaying: false });
  assert.equal(status.statusKey, 'COMPLETED');
  assert.equal(status.badge, 'FINISHED');
  assert.equal(status.message, 'All finite workloads completed.');
});

test('Event Communication 1. Structured Last Event details (Who, What, Changed)', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);

  // Step 1: P1 executes wait(empty)
  engine.step('P1');
  const details1 = deriveLastEventDetails(engine.snapshot());
  assert.equal(details1.processId, 'P1');
  assert.match(details1.action, /wait\(empty\)/i);
  assert.match(details1.changed, /empty 5→4/i);

  // Step 2: P1 acquires mutex
  engine.step('P1');
  const details2 = deriveLastEventDetails(engine.snapshot());
  assert.equal(details2.processId, 'P1');
  assert.match(details2.action, /wait\(mutex\)/i);
  assert.match(details2.changed, /mutex 1→0/i);
});

test('Session Summary 1. Real lifecycle derivation and collection is NOT completed', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1, { preparationDuration: 2 });
  engine.addConsumer(1);

  // Initial
  let summary = deriveSessionSummary(engine.events, Object.values(engine.orders));
  assert.deepEqual(summary, { produced: 0, collected: 0, completed: 0 });

  // 1. P1 produces order into buffer
  for (let s = 0; s < 6; s++) engine.step('P1');
  summary = deriveSessionSummary(engine.events, Object.values(engine.orders));
  assert.equal(summary.produced, 1);
  assert.equal(summary.collected, 0);
  assert.equal(summary.completed, 0);

  // 2. C1 collects order into kitchen (enters PREPARING)
  for (let s = 0; s < 6; s++) engine.step('C1');
  summary = deriveSessionSummary(engine.events, Object.values(engine.orders));
  assert.equal(summary.produced, 1);
  assert.equal(summary.collected, 1);
  // CRITICAL: Collection must NOT count as completion
  assert.equal(summary.completed, 0, 'Collection must not count as preparation completion');

  // 3. Advance kitchen preparation ticks (2 ticks)
  engine.tickKitchen();
  summary = deriveSessionSummary(engine.events, Object.values(engine.orders));
  assert.equal(summary.completed, 0); // progress 1/2

  engine.tickKitchen(); // progress 2/2 -> Order lifecycle becomes READY
  summary = deriveSessionSummary(engine.events, Object.values(engine.orders));
  assert.equal(summary.produced, 1);
  assert.equal(summary.collected, 1);
  assert.equal(summary.completed, 1, 'Completed only after kitchen prep completes');
});

test('Recent Activity Filtering. Captures meaningful lifecycle categories bounded to maxCount', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1);
  engine.addConsumer(1);

  for (let s = 0; s < 6; s++) engine.step('P1'); // insert
  for (let s = 0; s < 6; s++) engine.step('C1'); // remove
  engine.removeProcess('C1'); // stopping requested

  const recent = filterRecentLifecycleEvents(engine.events, 6);
  assert.ok(recent.length > 0 && recent.length <= 6);

  const categories = recent.map((r) => r.category);
  assert.ok(categories.includes('ORDER_INSERTED') || categories.includes('ORDER_COLLECTED') || categories.includes('REMOVAL_REQUESTED') || categories.includes('PROCESS_CREATED'));
});

test('Deterministic Scheduling. Mulberry32 PRNG produces identical reproducible sequences', () => {
  const prngA = createMulberry32(42);
  const prngB = createMulberry32(42);

  const seqA = Array.from({ length: 10 }, () => prngA());
  const seqB = Array.from({ length: 10 }, () => prngB());

  assert.deepEqual(seqA, seqB, 'Identical seed must yield identical pseudo-random sequence');
});

test('Waiting-to-Running Transitions. Signal wakes waiting threads cleanly', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(1); // C1

  // C1 steps and blocks on sem_wait(&full)
  engine.step('C1');
  assert.equal(engine.processes.find((p) => p.id === 'C1').state, 'BLOCKED');
  assert.deepEqual(engine.full.waiters, ['C1']);

  // P1 added and completes insertion (posts full)
  engine.addProducer(1); // P1
  for (let s = 0; s < 6; s++) engine.step('P1');

  // C1 must now be unblocked and ready to step
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'READY');
  assert.equal(engine.full.waiters.includes('C1'), false);
  assert.equal(engine.assertInvariants(), true);
});
