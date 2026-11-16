import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

test('Multi-Consumer: 8 consumers on empty buffer all block on sem_wait(&full) in FIFO order without permit leaks', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(8);

  assert.equal(engine.processes.length, 8);
  assert.equal(engine.workers.length, 8);
  assert.equal(engine.full.value, 0);
  assert.equal(engine.empty.value, 5);

  // Step each consumer once through waitFull (pc=0)
  for (let i = 0; i < 8; i++) {
    const pId = `C${i + 1}`;
    engine.step(pId);
  }

  // All 8 consumers should be BLOCKED on full
  for (let i = 0; i < 8; i++) {
    const p = engine.processes.find((item) => item.id === `C${i + 1}`);
    assert.equal(p.state, 'BLOCKED', `${p.id} should be BLOCKED`);
    assert.equal(p.waitingFor, 'full', `${p.id} should be waiting for full`);
    assert.equal(p.pc, 1, `${p.id} pc should advance to 1 pending permit`);
  }

  // Verify FIFO waiters list
  assert.deepEqual(
    engine.full.waiters,
    ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
    'Waiters must be queued in exact FIFO order'
  );
  assert.equal(engine.full.holders.size, 0, 'No consumer should hold full permit');
  assert.equal(engine.full.value, 0, 'Full semaphore count must remain 0');
});

test('Multi-Consumer: 1 order published to 8 waiting consumers awakens exactly 1 consumer (FIFO head) without duplicate claims', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(8);

  // Block all 8 consumers on full
  for (let i = 0; i < 8; i++) {
    engine.step(`C${i + 1}`);
  }
  assert.equal(engine.full.waiters.length, 8);

  // Add 1 producer and run through all 6 instructions to publish 1 order
  engine.addProducer(1);
  const p1 = engine.processes.find((p) => p.id === 'P1');
  assert.ok(p1, 'P1 must be created');

  // Step P1: waitEmpty, waitMutex, insert, advanceWrite, releaseMutex, signalFull
  for (let s = 0; s < 6; s++) {
    engine.step('P1');
  }
  assert.equal(p1.state, 'COMPLETED');
  assert.equal(engine.buffer.occupancy, 1, 'Buffer must contain 1 published order');

  // After P1's signalFull:
  // Exactly C1 must be woken and transition to READY
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'READY', 'C1 must be READY');
  assert.equal(c1.waitingFor, null, 'C1 waitingFor must be cleared');
  assert.equal(c1.permit, true, 'C1 must hold full-order permit');
  assert.ok(engine.full.holders.has('C1'), 'C1 must be registered in full.holders');

  // Exactly 7 consumers remain blocked
  for (let i = 1; i < 8; i++) {
    const c = engine.processes.find((p) => p.id === `C${i + 1}`);
    assert.equal(c.state, 'BLOCKED', `${c.id} must remain BLOCKED`);
    assert.equal(c.waitingFor, 'full');
  }
  assert.deepEqual(
    engine.full.waiters,
    ['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
    'Waiters must retain C2..C8'
  );

  // Step C1 through: waitMutex, remove, advanceRead, releaseMutex, signalEmpty
  for (let s = 0; s < 5; s++) {
    engine.step('C1');
  }

  // C1 should now be PREPARING outside mutex, order removed
  assert.equal(c1.state, 'PREPARING');
  assert.equal(engine.buffer.occupancy, 0, 'Buffer occupancy must return to 0');
  assert.equal(engine.empty.value, 5, 'Empty slot must be restored');
  assert.equal(engine.full.holders.size, 0, 'Permit released after removal');

  // Verify other 7 consumers never received or removed the order
  for (let i = 1; i < 8; i++) {
    const c = engine.processes.find((p) => p.id === `C${i + 1}`);
    assert.equal(c.state, 'BLOCKED');
    assert.equal(c.result, null, `${c.id} must not have received any order`);
  }
});

test('Multi-Consumer: 5 orders published to 8 consumers delivers exactly 5 distinct orders without duplicate claims', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(8);

  // Block all 8 consumers
  for (let i = 0; i < 8; i++) {
    engine.step(`C${i + 1}`);
  }

  // Add 5 producers
  engine.addProducer(5);

  // Run all 5 producers to completion
  for (let pIdx = 1; pIdx <= 5; pIdx++) {
    const pId = `P${pIdx}`;
    for (let s = 0; s < 6; s++) {
      engine.step(pId);
    }
  }

  assert.equal(engine.buffer.occupancy, 5, 'Buffer must be completely full (5 orders)');

  // Exactly 5 consumers (C1..C5) must be woken in FIFO order
  const wokenIds = engine.processes
    .filter((p) => p.type === 'CONSUMER' && p.state === 'READY')
    .map((p) => p.id);
  assert.deepEqual(wokenIds, ['C1', 'C2', 'C3', 'C4', 'C5']);

  // Consumers C6, C7, C8 remain blocked
  const blockedIds = engine.processes
    .filter((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED')
    .map((p) => p.id);
  assert.deepEqual(blockedIds, ['C6', 'C7', 'C8']);

  // Step C1 through C5 to remove all 5 orders
  for (let cIdx = 1; cIdx <= 5; cIdx++) {
    const cId = `C${cIdx}`;
    for (let s = 0; s < 5; s++) {
      engine.step(cId);
    }
  }

  assert.equal(engine.buffer.occupancy, 0, 'All 5 orders must be consumed');
  assert.equal(engine.empty.value, 5, 'All 5 empty slots restored');

  // Verify 5 distinct orders were assigned
  const claimedOrders = engine.processes
    .filter((p) => p.type === 'CONSUMER' && p.result)
    .map((p) => p.result.id);
  assert.equal(new Set(claimedOrders).size, 5, 'All 5 claimed orders must be distinct');
  assert.deepEqual(
    claimedOrders.sort(),
    ['O01', 'O02', 'O03', 'O04', 'O05'],
    'Orders O01..O05 must be claimed exactly once'
  );

  // C6, C7, C8 must still be BLOCKED with 0 orders
  for (const cId of ['C6', 'C7', 'C8']) {
    const c = engine.processes.find((p) => p.id === cId);
    assert.equal(c.state, 'BLOCKED');
    assert.equal(c.result, null);
  }
});

test('Multi-Consumer Dynamic Addition: adding consumers while running preserves FIFO order and unblocks without state reset', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(2); // C1, C2

  // C1, C2 block on full
  engine.step('C1');
  engine.step('C2');
  assert.deepEqual(engine.full.waiters, ['C1', 'C2']);

  // Dynamically add 3 more consumers (C3, C4, C5)
  const addResult = engine.addConsumer(3);
  assert.deepEqual(addResult.ids, ['C3', 'C4', 'C5']);

  // C3, C4, C5 start in READY state
  for (const id of ['C3', 'C4', 'C5']) {
    const c = engine.processes.find((p) => p.id === id);
    assert.equal(c.state, 'READY');
    assert.equal(c.pc, 0);
  }

  // Step C3, C4, C5 so they also block on full
  engine.step('C3');
  engine.step('C4');
  engine.step('C5');
  assert.deepEqual(
    engine.full.waiters,
    ['C1', 'C2', 'C3', 'C4', 'C5'],
    'Dynamic addition must append to FIFO waiters without disturbing existing queue'
  );

  // Now dynamically add 1 producer and run it
  engine.addProducer(1);
  for (let s = 0; s < 6; s++) {
    engine.step('P1');
  }

  // Oldest waiter C1 must be woken, C2..C5 remain in queue
  const c1 = engine.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'READY');
  assert.deepEqual(engine.full.waiters, ['C2', 'C3', 'C4', 'C5']);
});

test('Multi-Consumer Wraparound & Invariants: 4 producers and 8 consumers maintain E + F + in_flight = 5 invariant', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(4);
  engine.addConsumer(8);

  // Run 60 steps using engine's native round-robin scheduler
  for (let step = 0; step < 80; step++) {
    const ready = engine.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    if (ready.length > 0) {
      engine.step();
    } else {
      const preparing = engine.processes.filter((p) => p.state === 'PREPARING');
      if (preparing.length > 0) {
        engine.tickKitchen();
      } else {
        break;
      }
    }

    // Verify Invariant at every single step:
    // empty + occupancy + in_flight = 5 (capacity)
    const empty = engine.empty.value;
    const occupancy = engine.buffer.occupancy;
    const inFlightWait = engine.empty.holders.size; // producers holding empty permit before inserting
    assert.ok(
      empty + occupancy + inFlightWait <= 5,
      `Capacity exceeded: empty(${empty}) + occupancy(${occupancy}) + inFlight(${inFlightWait}) > 5`
    );

    // Mutual exclusion: at most 1 process holds mutex
    const mutexHolders = engine.processes.filter((p) => p.acquiredMutex);
    assert.ok(
      mutexHolders.length <= 1,
      `Mutual exclusion violated: ${mutexHolders.map((p) => p.id).join(', ')} simultaneously hold mutex`
    );
  }
});

