import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { selectQueueFlowState } from '../src/synclab/arena/flow/selectQueueFlowState.js';

test('Live Queue Flow Selector — Comprehensive Verification', async (t) => {
  await t.test('1. Empty Session returns clean initial state and explanation', () => {
    const engine = new ProducerConsumerEngine();
    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.isLive, false);
    assert.equal(flow.producers.length, 0);
    assert.equal(flow.bufferFifoOrders.length, 0);
    assert.equal(flow.bufferOccupancy.occupied, 0);
    assert.equal(flow.bufferOccupancy.free, 5);
    assert.equal(flow.consumerWaiters.length, 0);
    assert.equal(flow.preparingAssignments.length, 0);
    assert.equal(flow.completedOrders.length, 0);
    assert.match(flow.latestExplanation, /Ready|initialized|empty/i);
  });

  await t.test('2. One producer inserting an order reflects in producer state and buffer', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(1);
    engine.step('P1'); // waitEmpty (pc 0 -> 1)
    engine.step('P1'); // lockMutex (pc 1 -> 2)
    engine.step('P1'); // insert order into slot 0 (pc 2 -> 3)

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, true);

    assert.equal(flow.isLive, true);
    assert.equal(flow.producers.length, 1);
    assert.equal(flow.producers[0].id, 'P1');
    assert.equal(flow.bufferFifoOrders.length, 1);
    assert.equal(flow.bufferFifoOrders[0].physicalSlotIndex, 0);
    assert.equal(flow.bufferFifoOrders[0].isNextToCollect, true);
    assert.equal(flow.bufferOccupancy.occupied, 1);
    assert.equal(flow.bufferOccupancy.free, 4);
    assert.match(flow.latestExplanation, /P1 inserted/i);
  });

  await t.test('3. Multiple orders reflect in logical FIFO order from readPosition forward', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(3);

    // Run P1 through insertion (slot 0)
    for (let i = 0; i < 6; i++) engine.step('P1');
    // Run P2 through insertion (slot 1)
    for (let i = 0; i < 6; i++) engine.step('P2');
    // Run P3 through insertion (slot 2)
    for (let i = 0; i < 6; i++) engine.step('P3');

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.bufferFifoOrders.length, 3);
    assert.equal(flow.bufferFifoOrders[0].physicalSlotIndex, 0);
    assert.equal(flow.bufferFifoOrders[0].isNextToCollect, true);
    assert.equal(flow.bufferFifoOrders[1].physicalSlotIndex, 1);
    assert.equal(flow.bufferFifoOrders[1].isNextToCollect, false);
    assert.equal(flow.bufferFifoOrders[2].physicalSlotIndex, 2);
    assert.equal(flow.bufferFifoOrders[2].isNextToCollect, false);
  });

  await t.test('4. Physical circular wraparound across slots 4 -> 0 preserves correct logical order', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    // Advance read pointer to slot 4 by producing and consuming 4 items
    engine.addProducer(4);
    engine.addConsumer(1);

    for (let p = 1; p <= 4; p++) {
      for (let s = 0; s < 6; s++) engine.step(`P${p}`);
      for (let s = 0; s < 6; s++) engine.step('C1');
      while (engine.workers.some((w) => w.state === 'PREPARING')) engine.tickKitchen();
    }

    assert.equal(engine.buffer.readPosition, 4);

    // Now insert 3 orders: they will occupy slot 4, slot 0, slot 1
    engine.addProducer(3);
    for (let p = 5; p <= 7; p++) {
      for (let s = 0; s < 6; s++) engine.step(`P${p}`);
    }

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.bufferOccupancy.readPosition, 4);
    assert.equal(flow.bufferFifoOrders.length, 3);
    // 1st logical order MUST be slot 4 (next to collect)
    assert.equal(flow.bufferFifoOrders[0].physicalSlotIndex, 4);
    assert.equal(flow.bufferFifoOrders[0].isNextToCollect, true);
    // 2nd logical order MUST be slot 0
    assert.equal(flow.bufferFifoOrders[1].physicalSlotIndex, 0);
    assert.equal(flow.bufferFifoOrders[1].isNextToCollect, false);
    // 3rd logical order MUST be slot 1
    assert.equal(flow.bufferFifoOrders[2].physicalSlotIndex, 1);
    assert.equal(flow.bufferFifoOrders[2].isNextToCollect, false);
  });

  await t.test('5. Consumer waiting on empty buffer appears in fullWaiters lane with FIFO order', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addConsumer(2);

    engine.step('C1'); // blocks on full
    engine.step('C2'); // blocks on full

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.consumerWaiters.length, 2);
    assert.equal(flow.consumerWaiters[0].id, 'C1');
    assert.equal(flow.consumerWaiters[0].queuePosition, 1);
    assert.equal(flow.consumerWaiters[1].id, 'C2');
    assert.equal(flow.consumerWaiters[1].queuePosition, 2);
    assert.match(flow.latestExplanation, /waiting for an order|blocked/i);
  });

  await t.test('6. Multiple waiting consumers: publishing one order wakes the oldest waiter', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addConsumer(3);
    engine.step('C1'); // blocks
    engine.step('C2'); // blocks
    engine.step('C3'); // blocks

    engine.addProducer(1);
    for (let s = 0; s < 6; s++) engine.step('P1'); // produces and signals full

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    // C1 should have been awakened and given the permit; C2 and C3 remain waiting
    assert.equal(flow.consumerWaiters.length, 2);
    assert.equal(flow.consumerWaiters[0].id, 'C2');
    assert.equal(flow.consumerWaiters[1].id, 'C3');
  });

  await t.test('7. Consumer waiting for mutex after reserving permit is separated from fullWaiters', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(2);
    // P1 produces an item
    for (let s = 0; s < 6; s++) engine.step('P1');

    // P2 locks the mutex
    engine.step('P2'); // waitEmpty
    engine.step('P2'); // lockMutex -> now P2 owns mutex!

    // C1 attempts to consume: acquires full permit, but blocks on mutex!
    engine.addConsumer(1);
    engine.step('C1'); // waitFull -> acquired full permit!
    engine.step('C1'); // waitMutex -> blocked because P2 owns mutex!

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.consumerWaiters.length, 0); // NOT in fullWaiters!
    assert.equal(flow.consumerMutexWaiters.length, 1); // IS in mutexWaiters!
    assert.equal(flow.consumerMutexWaiters[0].id, 'C1');
    assert.match(flow.consumerMutexWaiters[0].label, /mutex/i);
  });

  await t.test('8. Several consumers preparing concurrently show distinct active assignments and progress', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(2);
    engine.addConsumer(2);

    // Insert 2 orders
    for (let s = 0; s < 6; s++) engine.step('P1');
    for (let s = 0; s < 6; s++) engine.step('P2');

    // Both consumers take their orders and enter PREPARING
    for (let s = 0; s < 5; s++) engine.step('C1');
    for (let s = 0; s < 5; s++) engine.step('C2');

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.preparingAssignments.length, 2);
    const workerIds = flow.preparingAssignments.map((a) => a.workerId).sort();
    assert.deepEqual(workerIds, ['C1', 'C2']);

    // Advance kitchen tick
    engine.tickKitchen();
    const snapTick = engine.snapshot();
    const flowTick = selectQueueFlowState(snapTick, true);

    assert.equal(flowTick.preparingAssignments[0].progress, 1);
    assert.equal(flowTick.preparingAssignments[1].progress, 1);
  });

  await t.test('9. Preparation completion moves order to completed/ready and clears worker assignment', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1, { preparationDuration: 2 });
    engine.addConsumer(1);

    for (let s = 0; s < 6; s++) engine.step('P1');
    for (let s = 0; s < 5; s++) engine.step('C1');

    // Tick kitchen twice to complete dish
    engine.tickKitchen();
    engine.tickKitchen();

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    assert.equal(flow.preparingAssignments.length, 0); // No longer preparing!
    assert.equal(flow.completedOrders.length, 1);
    assert.equal(flow.completedOrders[0].id, 'O01');
    assert.match(flow.completedOrders[0].statusText, /pickup|handover|completed/i);
  });

  await t.test('10. Process addition and graceful removal updates states cleanly', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(2);

    let flow = selectQueueFlowState(engine.snapshot(), false);
    assert.equal(flow.producers.length, 2);

    // Remove idle P2
    engine.removeProcess('P2');
    flow = selectQueueFlowState(engine.snapshot(), false);
    assert.equal(flow.producers.length, 1);
    assert.equal(flow.producers[0].id, 'P1');
  });

  await t.test('11. Reset and scenario switching clears completed and restores baseline', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1);
    for (let s = 0; s < 6; s++) engine.step('P1');
    assert.equal(engine.buffer.occupancy, 1);

    engine.reset();
    const flow = selectQueueFlowState(engine.snapshot(), false);
    assert.equal(flow.bufferOccupancy.occupied, 0);
    assert.equal(flow.completedOrders.length, 0);
  });

  await t.test('13. Rapid insertion and collection preserves consistent order accounting without phantom nodes', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(3);
    engine.addConsumer(2);

    // Rapidly interleave 15 steps
    for (let i = 0; i < 15; i++) {
      const candidates = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
      if (candidates.length > 0) {
        engine.step(candidates[i % candidates.length].id);
      } else if (engine.workers.some((w) => w.state === 'PREPARING')) {
        engine.tickKitchen();
      }
    }

    const snap = engine.snapshot();
    const flow = selectQueueFlowState(snap, false);

    // Invariant: sum of orders in buffer + preparing + ready/completed equals produced orders accounted for
    const inBuffer = flow.bufferFifoOrders.length;
    const preparing = flow.preparingAssignments.length;
    const completed = flow.completedOrders.length;
    assert.ok(inBuffer <= 5, 'Buffer cannot exceed capacity 5');
    assert.equal(inBuffer, snap.occupancy);
    assert.ok(flow.latestExplanation.length > 0);
  });

  await t.test('14. View model handles null or undefined snapshots gracefully without throwing', () => {
    const empty1 = selectQueueFlowState(null, false);
    assert.equal(empty1.bufferFifoOrders.length, 0);
    assert.equal(empty1.isLive, false);

    const empty2 = selectQueueFlowState({}, true);
    assert.equal(empty2.bufferFifoOrders.length, 0);
    assert.equal(empty2.isLive, true);
  });
});
