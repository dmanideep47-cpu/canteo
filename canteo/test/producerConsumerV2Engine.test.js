import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { CircularBuffer } from '../src/synclab/engine/CircularBuffer.js';
import { CountingSemaphore } from '../src/synclab/engine/CountingSemaphore.js';
import { Mutex } from '../src/synclab/engine/Mutex.js';
import { RaceConditionEngine } from '../src/synclab/engine/RaceConditionEngine.js';

function drain(engine, limit = 100) {
  for (let i = 0; i < limit && engine.snapshot().processes.some((p) => p.state === 'READY' || p.state === 'RUNNING'); i += 1) engine.step();
  return engine.snapshot();
}
function active(engine) { return engine.snapshot().processes.filter((p) => p.state !== 'COMPLETED'); }

test('initial state is an empty five-slot circular buffer with correct semaphores', () => {
  const e = new ProducerConsumerEngine(); const s = e.snapshot();
  assert.equal(s.capacity, 5); assert.deepEqual(s.slots, [null, null, null, null, null]);
  assert.equal(s.empty, 5); assert.equal(s.full, 0); assert.equal(s.mutex, 1); assert.equal(s.mutexOwner, null);
  assert.equal(s.writePosition, 0); assert.equal(s.readPosition, 0);
});
test('producer inserts an order and signals full', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(); const s = drain(e);
  assert.equal(s.occupancy, 1); assert.equal(s.slots[0].label, 'Order 01'); assert.equal(s.empty, 4); assert.equal(s.full, 1);
});
test('five producers fill capacity without overwrite', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(5); const s = drain(e);
  assert.equal(s.occupancy, 5); assert.equal(s.empty, 0); assert.equal(s.full, 5);
  assert.equal(new Set(s.slots.map((x) => x.id)).size, 5);
});
test('producer blocks when full and does not overwrite', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(5); drain(e); e.addProducer();
  let s = drain(e); assert.equal(s.empty, 0); assert.equal(s.occupancy, 5);
  assert.equal(active(e)[0].state, 'BLOCKED'); assert.equal(s.slots.length, 5);
});
test('consumer removes one order from read position and releases empty', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(); drain(e); e.addConsumer(); const s = drain(e);
  assert.equal(s.occupancy, 0); assert.equal(s.full, 0); assert.equal(s.empty, 5);
  assert.equal(s.processes.find((p) => p.type === 'CONSUMER').result.label, 'Order 01');
});
test('producer blocked on full wakes by FIFO permit handoff after a consume', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(5); drain(e); e.addProducer(2); drain(e);
  const waiting = e.snapshot().processes.filter((p) => p.state === 'BLOCKED'); assert.equal(waiting.length, 2);
  e.addConsumer(); drain(e); const s = e.snapshot();
  assert.equal(s.processes.find((p) => p.id === waiting[0].id).state, 'COMPLETED');
  assert.equal(s.processes.find((p) => p.id === waiting[1].id).state, 'BLOCKED');
  assert.equal(s.emptyWaiters[0], waiting[1].id); assert.equal(s.occupancy, 5);
  const firstProducerEvents = s.events.filter((event) => event.processId === waiting[0].id).map((event) => event.message);
  assert.ok(firstProducerEvents.some((message) => message.includes('woke from empty')));
  assert.ok(firstProducerEvents.some((message) => message.includes('inserted')));
  assert.equal(firstProducerEvents.filter((message) => message.includes('acquired one empty-slot permit')).length, 0, 'handoff must resume after wait without decrementing empty again');
});
test('consumer blocks on empty and does not consume nonexistent orders', () => {
  const e = new ProducerConsumerEngine(); e.addConsumer(); const s = drain(e);
  assert.equal(s.occupancy, 0); assert.equal(s.full, 0); assert.equal(s.processes[0].state, 'BLOCKED');
});
test('consumer waiting on empty wakes when producer publishes an order', () => {
  const e = new ProducerConsumerEngine(); e.addConsumer(); drain(e); const consumerId = e.snapshot().processes[0].id;
  e.addProducer(); drain(e); const s = drain(e);
  assert.equal(s.processes.find((p) => p.id === consumerId).state, 'COMPLETED'); assert.equal(s.occupancy, 0);
  assert.ok(s.events.some((event) => event.processId === consumerId && event.message.includes('woke from full')));
  assert.equal(s.events.filter((event) => event.processId === consumerId && event.message.includes('acquired one order permit')).length, 0);
});
test('FIFO consumer waiters resume one-by-one and never reserve the same order twice', () => {
  const e = new ProducerConsumerEngine(); e.addConsumer(2); drain(e);
  const [first, second] = e.snapshot().processes.map((p) => p.id);
  e.addProducer(); drain(e); const s = e.snapshot();
  assert.equal(s.processes.find((p) => p.id === first).state, 'COMPLETED');
  assert.equal(s.processes.find((p) => p.id === second).state, 'BLOCKED');
  assert.equal(s.fullWaiters[0], second);
  assert.equal(s.processes.find((p) => p.id === first).result.id, 'O01');
});
test('circular pointers wrap at modulo five without shifting slots', () => {
  const buffer = new CircularBuffer();
  for (let i = 0; i < 5; i += 1) buffer.insert({ id: i });
  assert.deepEqual([buffer.remove().position, buffer.remove().position], [0, 1]);
  assert.equal(buffer.insert({ id: 'wrap-1' }), 0); assert.equal(buffer.insert({ id: 'wrap-2' }), 1);
  assert.deepEqual(buffer.slots.slice(0, 2).map((x) => x.id), ['wrap-1', 'wrap-2']);
  assert.equal(buffer.writePosition, 2); assert.equal(buffer.readPosition, 2);
});
test('two producers serialize through the owned mutex and preserve both orders', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(2); const s = drain(e);
  assert.equal(s.occupancy, 2); assert.equal(new Set(s.slots.filter(Boolean).map((x) => x.id)).size, 2);
  assert.equal(s.mutexOwner, null); assert.ok(s.events.some((x) => x.message.includes('acquired mutex')));
  assert.ok(s.events.some((x) => x.message.includes('blocked on mutex')));
  assert.ok(s.events.some((x) => x.message.includes('released mutex;') && x.message.includes('now owns it')));
});
test('two consumers reserve and consume distinct orders under mutex', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(2); drain(e); e.addConsumer(2); const s = drain(e);
  const results = s.processes.filter((p) => p.type === 'CONSUMER').map((p) => p.result.id);
  assert.equal(new Set(results).size, 2); assert.equal(s.occupancy, 0);
});
test('semaphore values and permit conservation remain valid throughout scheduling', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(8); e.addConsumer(8);
  for (let i = 0; i < 120; i += 1) { const s = e.step(); assert.ok(s.empty >= 0 && s.full >= 0); assert.equal(s.empty + s.full + s.reservedEmpty + s.reservedFull, 5); assert.ok(s.occupancy <= 5); }
});
test('reserved producer and consumer permits are represented in conservation equation', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(); e.step();
  assert.equal(e.snapshot().reservedEmpty, 1); assert.equal(e.assertInvariants(), true);
  const f = new ProducerConsumerEngine(); f.addConsumer(); f.addProducer();
  // First ready consumer blocks, then producer proceeds until it has reserved the full permit.
  f.step(); f.runUntilBlocked();
  assert.ok(f.snapshot().reservedFull >= 0); assert.equal(f.assertInvariants(), true);
});
test('reset restores initial state and clears process history', () => {
  const e = new ProducerConsumerEngine(); e.addProducer(); drain(e); e.reset(); const s = e.snapshot();
  assert.equal(s.occupancy, 0); assert.equal(s.empty, 5); assert.equal(s.full, 0); assert.deepEqual(s.processes, []); assert.deepEqual(s.events, []);
});
test('pause preserves program position as READY and resume can continue at the next instruction', () => {
  const e = new ProducerConsumerEngine(); e.addProducer();
  e.step(); const running = e.snapshot().processes[0]; assert.equal(running.state, 'RUNNING'); assert.equal(running.pc, 1);
  e.pause(); const paused = e.snapshot().processes[0]; assert.equal(paused.state, 'READY'); assert.equal(paused.pc, 1);
  assert.ok(e.snapshot().events.some((event) => event.type === 'control' && event.message.includes('paused')));
  e.resume(); e.step(); const resumed = e.snapshot().processes[0]; assert.equal(resumed.pc, 2); assert.equal(resumed.acquiredMutex, true);
  assert.ok(e.snapshot().events.some((event) => event.type === 'control' && event.message.includes('resumed')));
});
test('execution history keeps every event and deterministic event sequence', () => {
  const e = new ProducerConsumerEngine();
  for (let i = 0; i < 6; i += 1) e.addProducer(20);
  drain(e);
  const s = e.snapshot();
  assert.ok(s.events.length > 100);
  assert.equal(s.events.at(-1).id, 1);
  assert.equal(new Set(s.events.map((event) => event.id)).size, s.events.length);
  const replay = new ProducerConsumerEngine();
  for (let i = 0; i < 6; i += 1) replay.addProducer(20);
  drain(replay);
  assert.deepEqual(replay.snapshot().events.map(({ id, message, type, processId }) => ({ id, message, type, processId })), s.events.map(({ id, message, type, processId }) => ({ id, message, type, processId })));
});
test('mutex enforces ownership and FIFO handoff', () => {
  const mutex = new Mutex(); assert.equal(mutex.acquire('A').acquired, true);
  assert.throws(() => mutex.acquire('A'), /already owns/);
  assert.equal(mutex.acquire('B').blocked, true); assert.equal(mutex.acquire('C').blocked, true);
  assert.throws(() => mutex.release('B')); assert.equal(mutex.release('A'), 'B'); assert.equal(mutex.owner, 'B');
  assert.equal(mutex.release('B'), 'C'); assert.equal(mutex.release('C'), null);
});
test('counting semaphore transfers a signaled permit to its FIFO waiter', () => {
  const sem = new CountingSemaphore('slots', 0); assert.equal(sem.wait('A').blocked, true); assert.equal(sem.wait('B').blocked, true);
  assert.equal(sem.signal().woken, 'A'); assert.equal(sem.value, 0); assert.equal(sem.signal().woken, 'B');
});

test('counting semaphore prevents a process from acquiring the same permit twice', () => {
  const sem = new CountingSemaphore('slots', 2, 2);
  assert.equal(sem.wait('A').acquired, true);
  assert.equal(sem.wait('A').alreadyHeld, true);
  assert.equal(sem.value, 1);
  assert.throws(() => sem.releasePermit('B'), /does not hold/);
  sem.releasePermit('A');
  assert.equal(sem.value, 1);
});

test('unsafe producer interleaving reproduces a lost order; protected lane preserves both', () => {
  const unsafe = new RaceConditionEngine(); unsafe.setProtected(false);
  unsafe.step(); assert.match(unsafe.snapshot().events[0].message, /P-A reads writePosition/);
  unsafe.step(); assert.match(unsafe.snapshot().events[1].message, /P-B reads writePosition/);
  const safe = new RaceConditionEngine(); safe.setProtected(true);
  assert.equal(safe.snapshot().processStates[0].state, 'READY');
  for (let i = 0; i < 3; i += 1) safe.step();
  assert.equal(safe.snapshot().processStates[0].state, 'RUNNING'); assert.equal(safe.snapshot().processStates[1].state, 'WAITING');
  safe.step(); assert.equal(safe.snapshot().processStates[0].state, 'COMPLETED'); assert.equal(safe.snapshot().processStates[1].state, 'RUNNING');
  safe.step();
  assert.equal(unsafe.snapshot().lostOrder, false); assert.equal(safe.snapshot().lostOrder, false); assert.equal(safe.snapshot().complete, true);
  unsafe.step(); unsafe.step(); unsafe.step();
  assert.equal(unsafe.snapshot().lostOrder, true);
  assert.match(unsafe.snapshot().events[3].message, /overwriting Order A/);
});
test('unsafe consumer interleaving reproduces duplicate consumption; protected lane serializes', () => {
  const unsafe = new RaceConditionEngine(); unsafe.selectScenario('consumer');
  unsafe.step(); unsafe.step(); unsafe.step(); unsafe.step();
  assert.equal(unsafe.snapshot().duplicateConsume, true); assert.match(unsafe.snapshot().events[3].message, /also removes Order A/);
  const safe = new RaceConditionEngine(); safe.selectScenario('consumer'); safe.setProtected(true);
  for (let i = 0; i < 5; i += 1) safe.step();
  assert.equal(safe.snapshot().duplicateConsume, false); assert.equal(safe.snapshot().complete, true);
  assert.match(safe.snapshot().events[4].message, /removes Order B at position 1/);
});

test('mixed producer and consumer workload preserves every committed order without overwrite or duplicate consumption', () => {
  const engine = new ProducerConsumerEngine();
  engine.addProducer(18);
  engine.addConsumer(18);
  for (let i = 0; i < 1000; i += 1) {
    const state = engine.step();
    assert.equal(engine.assertInvariants(), true);
    assert.ok(state.empty >= 0 && state.full >= 0);
    assert.ok(state.slots.filter(Boolean).length <= 5);
  }
  const state = engine.snapshot();
  const consumers = state.processes.filter((process) => process.type === 'CONSUMER' && process.result);
  assert.equal(new Set(consumers.map((process) => process.result.id)).size, consumers.length);
  assert.equal(state.processes.filter((process) => process.state !== 'COMPLETED').length, 0);
  assert.equal(state.empty + state.full, 5);
  assert.equal(state.mutexOwner, null);
  assert.equal(state.events.some((event) => event.message.includes('overwrit')), false);
});

test('buffer rejects overwriting occupied slots and semaphore rejects duplicate capacity', () => {
  const buffer = new CircularBuffer();
  buffer.writeCurrent({ id: 'occupied' });
  assert.throws(() => buffer.writeCurrent({ id: 'replacement' }), /overwrite occupied slot/);
  const semaphore = new CountingSemaphore('bounded', 1, 1);
  assert.throws(() => semaphore.signal(), /no permit available/);
  assert.equal(semaphore.value, 1);
});

test('safe and unsafe race histories expose exact shared-state before and after values', () => {
  const unsafe = new RaceConditionEngine();
  unsafe.stepProcess('A');
  unsafe.stepProcess('B');
  unsafe.stepProcess('A');
  unsafe.stepProcess('B');
  const lostUpdate = unsafe.snapshot();
  assert.equal(lostUpdate.interactiveEvents.at(-1).sharedBefore, 0);
  assert.equal(lostUpdate.interactiveEvents.at(-1).sharedAfter, 0);
  assert.equal(lostUpdate.overwritten.length, 1);

  const safe = new RaceConditionEngine();
  safe.setProtected(true);
  safe.stepProcess('A');
  const blocked = safe.stepProcess('B').interactiveEvents.at(-1);
  assert.equal(blocked.outcome, 'BLOCKED');
  assert.equal(blocked.mutexOwnerBefore, 'A');
  for (let i = 0; i < 3; i += 1) safe.stepProcess('A');
  for (let i = 0; i < 3; i += 1) safe.stepProcess('B');
  const protectedState = safe.snapshot();
  assert.equal(protectedState.overwritten.length, 0);
  assert.equal(new Set(protectedState.buffer.filter(Boolean).map((item) => item.id)).size, 2);
  assert.ok(protectedState.interactiveEvents.every((event) => event.mutexOwnerBefore === null || event.process === event.mutexOwnerBefore || event.outcome === 'BLOCKED'));
});

