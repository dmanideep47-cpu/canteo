import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

test('Ordinary Workflow 1: Producer-only insertion records order ID in buffer and event log', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.reset();
  assert.equal(engine.processes.length, 0);

  // Add 1 student producer
  const { ids: [p1Id] } = engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === p1Id);
  assert.equal(p1.id, 'P1');
  const expectedOrderId = p1.orderId;
  assert.ok(expectedOrderId);

  // Run all instructions for P1 (waitEmpty, waitMutex, insert, advanceWrite, releaseMutex, signalFull)
  for (let i = 0; i < 6; i++) {
    engine.step(p1Id);
  }

  // 1. Verify buffer occupancy
  assert.equal(engine.buffer.occupancy, 1);
  assert.equal(engine.buffer.slots[0].id, expectedOrderId);

  // 2. Verify recorded insertion event with the EXACT order ID
  const insertEvent = engine.events.find((e) => e.type === 'insert');
  assert.ok(insertEvent, 'Insert event must be recorded');
  assert.equal(insertEvent.orderId, expectedOrderId);
  assert.equal(insertEvent.slot, 0);
  assert.equal(insertEvent.processId, 'P1');

  // Producer is completed
  assert.equal(p1.state, 'COMPLETED');
  assert.equal(engine.assertInvariants(), true);
});

test('Ordinary Workflow 2: Producer and consumer completing the same order ID (insert -> collect -> prep)', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.reset();

  // Add 1 producer and 1 consumer
  const { ids: [p1Id] } = engine.addProducer(1);
  const { ids: [c1Id] } = engine.addConsumer(1);
  const orderId = engine.processes.find((p) => p.id === p1Id).orderId;

  // Step through simulation using automatic round-robin scheduler
  for (let step = 0; step < 25; step++) {
    const ready = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    const prep = engine.workers.filter((w) => w.state === 'PREPARING');
    if (ready.length > 0) {
      engine.step();
    } else if (prep.length > 0) {
      engine.tickKitchen();
    } else {
      break;
    }
  }

  // 1. Verify recorded insertion of orderId
  const insertEvent = engine.events.find((e) => e.type === 'insert');
  assert.ok(insertEvent, 'Insert event must exist');
  assert.equal(insertEvent.orderId, orderId);

  // 2. Verify recorded collection (removal) of the SAME orderId by C1
  const removeEvent = engine.events.find((e) => e.type === 'remove');
  assert.ok(removeEvent, 'Remove event must exist');
  assert.equal(removeEvent.orderId, orderId, 'Consumer must collect the exact order inserted');
  assert.equal(removeEvent.processId, c1Id);

  // 3. Verify kitchen preparation completed
  const orderReadyEvent = engine.events.find((e) => e.type === 'order-ready');
  assert.ok(orderReadyEvent, 'Order ready event must exist');
  assert.equal(orderReadyEvent.orderId, orderId);
  assert.equal(engine.orders[orderId].lifecycle, 'READY');

  // Buffer returned to empty
  assert.equal(engine.buffer.occupancy, 0);
  assert.equal(engine.assertInvariants(), true);
});

test('Ordinary Workflow 3: Consumer first (blocks on empty), followed by a producer waking it', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.reset();

  // 1. Add consumer first
  const { ids: [c1Id] } = engine.addConsumer(1);
  const c1 = engine.processes.find((p) => p.id === c1Id);

  // Step C1 once: executes wait(full)
  engine.step(c1Id);
  assert.equal(c1.state, 'BLOCKED', 'Consumer must block when queue is empty');
  assert.equal(c1.waitingFor, 'full');
  assert.deepEqual(engine.full.waiters, [c1Id]);

  // 2. Add producer while consumer is blocked
  const { ids: [p1Id] } = engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === p1Id);
  const orderId = p1.orderId;

  // Step P1 through its full cycle
  for (let i = 0; i < 6; i++) {
    engine.step(p1Id);
  }

  // P1 completed, C1 awakened to READY
  assert.equal(p1.state, 'COMPLETED');
  assert.equal(c1.state, 'READY', 'Consumer must be awakened by producer signal(full)');
  assert.equal(c1.waitingFor, null);

  // Step C1 through removal and kitchen ticks
  for (let i = 0; i < 6; i++) {
    engine.step(c1Id);
  }
  const worker = engine.workers.find((w) => w.id === c1Id);
  assert.equal(worker.state, 'PREPARING');
  assert.equal(worker.assignedOrderId, orderId);

  // Finish preparation
  for (let t = 0; t < worker.preparationDuration; t++) {
    engine.tickKitchen();
  }

  assert.equal(engine.orders[orderId].lifecycle, 'READY');
  const removeEvent = engine.events.find((e) => e.type === 'remove');
  assert.equal(removeEvent.orderId, orderId);
  assert.equal(engine.assertInvariants(), true);
});

test('Ordinary Workflow 4: Dynamic process creation during simulation execution', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.reset();

  // Start with only 1 producer
  const { ids: [p1Id] } = engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === p1Id);
  const order1Id = p1.orderId;

  // Step producer halfway into critical section (waitEmpty, waitMutex, insert)
  engine.step(p1Id);
  engine.step(p1Id);
  engine.step(p1Id);
  assert.equal(engine.buffer.occupancy, 1);

  // Dynamically add a consumer midway through simulation
  const { ids: [c1Id] } = engine.addConsumer(1);
  assert.equal(engine.processes.length, 2);

  // Continue stepping using round-robin scheduler
  for (let i = 0; i < 20; i++) {
    const ready = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    const prep = engine.workers.filter((w) => w.state === 'PREPARING');
    if (ready.length > 0) {
      engine.step();
    } else if (prep.length > 0) {
      engine.tickKitchen();
    } else {
      break;
    }
  }

  // The dynamically added consumer must have collected order1Id
  const removeEvent = engine.events.find((e) => e.type === 'remove');
  assert.ok(removeEvent);
  assert.equal(removeEvent.orderId, order1Id);
  assert.equal(removeEvent.processId, c1Id);
  assert.equal(engine.assertInvariants(), true);
});

test('Ordinary Workflow 5: Reset followed by a fresh working session maintains clean state', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });

  // Session 1: run workload
  engine.addProducer(2);
  engine.addConsumer(1);
  for (let i = 0; i < 15; i++) {
    const ready = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    if (ready.length > 0) engine.step();
  }

  // Reset to empty
  engine.reset();
  const snap1 = engine.snapshot();
  assert.equal(snap1.processes.length, 0);
  assert.equal(snap1.workers.length, 0);
  assert.equal(snap1.occupancy, 0);
  assert.equal(snap1.empty, 5);
  assert.equal(snap1.full, 0);
  assert.equal(snap1.mutex, 1);

  // Session 2: fresh run
  const { ids: [p1Id] } = engine.addProducer(1);
  const { ids: [c1Id] } = engine.addConsumer(1);
  const p1 = engine.processes.find((p) => p.id === p1Id);
  const freshOrderId = p1.orderId;

  // Run Session 2 to completion
  for (let i = 0; i < 25; i++) {
    const ready = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    const prep = engine.workers.filter((w) => w.state === 'PREPARING');
    if (ready.length > 0) {
      engine.step();
    } else if (prep.length > 0) {
      engine.tickKitchen();
    } else {
      break;
    }
  }

  const insertEvent = engine.events.find((e) => e.type === 'insert');
  const removeEvent = engine.events.find((e) => e.type === 'remove');
  assert.equal(insertEvent.orderId, freshOrderId);
  assert.equal(removeEvent.orderId, freshOrderId);
  assert.equal(engine.orders[freshOrderId].lifecycle, 'READY');
  assert.equal(engine.assertInvariants(), true);
});

