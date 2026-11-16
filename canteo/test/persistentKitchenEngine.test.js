import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

function create() { return new ProducerConsumerEngine({ persistentConsumers: true }); }
function run(engine, limit = 500) { engine.runUntilBlocked(limit); return engine.snapshot(); }
function assertHealthy(engine) {
  const state = engine.snapshot();
  assert.equal(state.integrity.passed, true, JSON.stringify(state.integrity.failure));
  assert.equal(state.empty + state.full + state.reservedEmpty + state.reservedFull, 5);
  assert.equal(state.mutexOwner, null);
  return state;
}
function claim(engine, count) {
  engine.addConsumer(count);
  for (let i = 0; i < 300 && (engine.snapshot().workers.filter((worker) => worker.assignedOrderId && worker.state === 'PREPARING').length < count || engine.snapshot().reservedEmpty > 0); i += 1) engine.stepNextInstruction();
  return assertHealthy(engine);
}

test('three persistent consumers claim three FIFO orders and prepare simultaneously outside mutex', () => {
  const engine = create(); engine.addProducer(5); run(engine);
  const state = claim(engine, 3);
  assert.deepEqual(state.workers.map((worker) => worker.assignedOrderId), ['O01', 'O02', 'O03']);
  assert.ok(state.workers.every((worker) => worker.state === 'PREPARING'));
  assert.deepEqual([state.empty, state.full, state.mutex], [3, 2, 1]);
  assert.deepEqual(state.slots.filter(Boolean).map((order) => order.id), ['O04', 'O05']);
  assert.equal(state.integrity.checks.find((check) => check.id === 'preparation-outside-mutex').status, 'PASS');
});

test('kitchen ticks advance each worker independently and return finished workers to IDLE', () => {
  const engine = create(); engine.addProducer(5); run(engine); claim(engine, 3);
  engine.tickKitchen();
  let state = assertHealthy(engine);
  assert.deepEqual(state.workers.map((worker) => worker.preparationProgress), [1, 1, 1]);
  assert.deepEqual(state.workers.map((worker) => worker.preparationDuration), [3, 5, 2]);
  engine.tickKitchen(); state = assertHealthy(engine);
  assert.equal(state.orders.find((order) => order.id === 'O03').lifecycle, 'READY');
  assert.equal(state.workers[2].state, 'IDLE');
  assert.deepEqual(state.workers.slice(0, 2).map((worker) => worker.preparationProgress), [2, 2]);
  assert.deepEqual(state.readyOrders.map((order) => order.id), ['O03']);
  run(engine);
  state = assertHealthy(engine);
  assert.equal(state.workers[2].assignedOrderId, 'O04');
  assert.deepEqual(state.workers.slice(0, 2).map((worker) => worker.preparationProgress), [2, 2]);
  assert.equal(engine.pickUpOrder('O03').success, true);
  assert.equal(engine.snapshot().orders.find((order) => order.id === 'O03').lifecycle, 'COMPLETED');
  assertHealthy(engine);
});

test('one persistent consumer prepares five orders sequentially in FIFO order', () => {
  const engine = create(); engine.addProducer(5); run(engine); claim(engine, 1);
  for (let i = 0; i < 100 && engine.snapshot().orders.some((order) => order.lifecycle === 'QUEUED' || order.lifecycle === 'PREPARING'); i += 1) {
    run(engine);
    if (engine.snapshot().workers.some((worker) => worker.state === 'PREPARING')) engine.tickKitchen();
    assertHealthy(engine);
  }
  const state = assertHealthy(engine);
  assert.deepEqual(state.events.filter((event) => event.type === 'remove').map((event) => event.orderId).reverse(), ['O01', 'O02', 'O03', 'O04', 'O05']);
  assert.equal(state.workers[0].state, 'IDLE');
  assert.ok(state.readyOrders.length === 5);
});

test('two consumers and one order result in one assignment and one blocked waiter', () => {
  const engine = create(); engine.addProducer(); run(engine); claim(engine, 1); engine.addConsumer();
  const state = run(engine);
  assert.equal(state.workers.filter((worker) => worker.assignedOrderId).length, 1);
  assert.equal(state.workers.find((worker) => worker.state === 'WAITING_FOR_ORDER').id, 'C2');
  assert.deepEqual(state.fullWaiters, ['C2']);
  assertHealthy(engine);
});

test('empty queue blocks every worker and a producer wakes only the FIFO consumer', () => {
  const engine = create(); engine.addConsumer(3); run(engine);
  assert.deepEqual(engine.snapshot().workers.map((worker) => worker.state), Array(3).fill('WAITING_FOR_ORDER'));
  engine.addProducer(); run(engine);
  const state = assertHealthy(engine);
  assert.deepEqual(state.workers.map((worker) => worker.assignedOrderId), ['O01', null, null]);
  assert.deepEqual(state.fullWaiters, ['C2', 'C3']);
});

test('full buffer blocks producer and dequeue hands empty permit to that producer', () => {
  const engine = create(); engine.addProducer(5); run(engine); engine.addProducer(); run(engine);
  assert.deepEqual(engine.snapshot().emptyWaiters, ['P6']);
  engine.addConsumer(); run(engine);
  const state = assertHealthy(engine);
  assert.equal(state.processes.find((process) => process.id === 'P6').permit, false);
  assert.ok(state.slots.filter(Boolean).length <= 5);
  assert.equal(state.orders.find((order) => order.id === 'O06').lifecycle, 'QUEUED');
  assert.ok(state.events.some((event) => event.message.includes('empty signaled; permit transferred to waiting P6')));
});

test('a persistent worker can complete one order and claim the next FIFO order', () => {
  const engine = create(); engine.addProducer(4); run(engine); claim(engine, 1);
  for (let i = 0; i < 3; i += 1) engine.tickKitchen();
  let state = assertHealthy(engine);
  assert.equal(state.workers[0].state, 'IDLE');
  run(engine);
  state = assertHealthy(engine);
  assert.equal(state.workers[0].assignedOrderId, 'O02');
  assert.equal(state.orders.find((order) => order.id === 'O02').lifecycle, 'PREPARING');
});

test('reset clears all workstation, order, permit and preparation state', () => {
  const engine = create(); engine.addProducer(3); run(engine); claim(engine, 2); engine.tickKitchen();
  const state = engine.reset();
  assert.deepEqual(state.workers, []); assert.deepEqual(state.orders, []); assert.deepEqual(state.readyOrders, []);
  assert.deepEqual([state.empty, state.full, state.mutex, state.occupancy], [5, 0, 1, 0]);
  assertHealthy(engine);
});

test('pause and resume preserve instruction counter and permits', () => {
  const engine = create(); const { ids } = engine.addProducer();
  engine.stepNextInstruction(ids[0]);
  const before = engine.snapshot().processes[0];
  engine.pause(); engine.resume();
  assert.equal(engine.snapshot().processes[0].pc, before.pc);
  assertHealthy(engine);
});

test('mixed producers and persistent consumers preserve unique committed order lifecycle', () => {
  const engine = create(); engine.addProducer(12); engine.addConsumer(3);
  for (let i = 0; i < 250 && engine.snapshot().orders.some((order) => order.lifecycle === 'CREATED' || order.lifecycle === 'QUEUED' || order.lifecycle === 'PREPARING'); i += 1) {
    run(engine);
    if (engine.snapshot().workers.some((worker) => worker.state === 'PREPARING')) engine.tickKitchen();
    assertHealthy(engine);
  }
  const state = assertHealthy(engine);
  assert.equal(state.orders.length, 12);
  assert.ok(state.orders.every((order) => ['READY', 'COMPLETED'].includes(order.lifecycle)));
  assert.equal(new Set(state.events.filter((event) => event.type === 'remove').map((event) => event.orderId)).size, 12);
  assert.equal(state.occupancy, 0);
  for (const order of state.readyOrders) assert.equal(engine.pickUpOrder(order.id).success, true);
  assert.ok(engine.snapshot().completedOrders.length >= 1);
  assertHealthy(engine);
});
