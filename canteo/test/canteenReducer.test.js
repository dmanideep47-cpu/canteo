import test from 'node:test';
import assert from 'node:assert';
import { canteenReducer, INITIAL_STATE } from '../src/logic/canteenReducer.js';
import {
  placeOrderAction,
  takeOrderAction,
  markReadyAction,
  markCollectedAction,
  resetAction,
} from '../src/logic/canteenActions.js';
import { validateInvariants } from '../src/logic/canteenInvariants.js';

test('1. Initial State & Invariants: empty = 5, full = 0, mutex = 1', () => {
  const state = INITIAL_STATE;
  assert.strictEqual(state.empty, 5, 'Initial empty must be 5');
  assert.strictEqual(state.full, 0, 'Initial full must be 0');
  assert.strictEqual(state.mutex, 1, 'Initial mutex must be 1');
  assert.strictEqual(state.queue.length, 0, 'Initial queue must be empty');
  assert.strictEqual(state.blockedProducers.length, 0, 'Initial blocked producers must be 0');
  assert.strictEqual(state.activeOrder, null, 'Initial active worker must be null');

  const inv = validateInvariants(state);
  assert.strictEqual(inv.valid, true, `Initial invariants invalid: ${inv.errors.join(', ')}`);
});

test('2. Bounded Buffer Capacity: 5 accepted orders fill buffer (empty=0, full=5)', () => {
  let state = INITIAL_STATE;
  const orders = [
    { id: 'ORD101', items: [{ name: 'Masala Dosa', price: 40, quantity: 1 }], total: 40 },
    { id: 'ORD102', items: [{ name: 'Tea', price: 10, quantity: 2 }], total: 20 },
    { id: 'ORD103', items: [{ name: 'Meals Thali', price: 60, quantity: 1 }], total: 60 },
    { id: 'ORD104', items: [{ name: 'Idli Vada', price: 35, quantity: 1 }], total: 35 },
    { id: 'ORD105', items: [{ name: 'Coffee', price: 15, quantity: 1 }], total: 15 },
  ];

  for (let i = 0; i < orders.length; i++) {
    state = canteenReducer(state, placeOrderAction(orders[i]));
    assert.strictEqual(state.queue.length, i + 1);
    assert.strictEqual(state.empty, 5 - (i + 1));
    assert.strictEqual(state.full, i + 1);
    const inv = validateInvariants(state);
    assert.strictEqual(inv.valid, true, `Invariants failed at order ${i + 1}: ${inv.errors.join(', ')}`);
  }

  assert.strictEqual(state.empty, 0);
  assert.strictEqual(state.full, 5);
  assert.strictEqual(state.queue.length, 5);
});

test('3. Blocked Producer: 6th submission blocked in FIFO order without buffer overflow', () => {
  let state = INITIAL_STATE;
  const orders = [
    { id: 'ORD101', items: [{ name: 'Masala Dosa', price: 40, quantity: 1 }], total: 40 },
    { id: 'ORD102', items: [{ name: 'Tea', price: 10, quantity: 2 }], total: 20 },
    { id: 'ORD103', items: [{ name: 'Meals Thali', price: 60, quantity: 1 }], total: 60 },
    { id: 'ORD104', items: [{ name: 'Idli Vada', price: 35, quantity: 1 }], total: 35 },
    { id: 'ORD105', items: [{ name: 'Coffee', price: 15, quantity: 1 }], total: 15 },
  ];
  for (const o of orders) {
    state = canteenReducer(state, placeOrderAction(o));
  }

  const order6 = { id: 'ORD106', items: [{ name: 'Samosa', price: 20, quantity: 2 }], total: 40 };
  state = canteenReducer(state, placeOrderAction(order6));

  assert.strictEqual(state.queue.length, 5, 'Queue length must not exceed 5');
  assert.strictEqual(state.empty, 0, 'Empty must remain 0');
  assert.strictEqual(state.full, 5, 'Full must remain 5');
  assert.strictEqual(state.blockedProducers.length, 1, 'Blocked producers must hold ORD106');
  assert.strictEqual(state.blockedProducers[0].id, 'ORD106');
  assert.strictEqual(state.blockedProducers[0].status, 'BLOCKED');

  const inv = validateInvariants(state);
  assert.strictEqual(inv.valid, true, `Invariants failed on blocked producer: ${inv.errors.join(', ')}`);
});

test('4. Atomic FIFO Admission: TAKE_ORDER frees slot and admits oldest blocked producer in same transition', () => {
  let state = INITIAL_STATE;
  const orders = [
    { id: 'ORD101', items: [{ name: 'Masala Dosa', price: 40, quantity: 1 }], total: 40 },
    { id: 'ORD102', items: [{ name: 'Tea', price: 10, quantity: 2 }], total: 20 },
    { id: 'ORD103', items: [{ name: 'Meals Thali', price: 60, quantity: 1 }], total: 60 },
    { id: 'ORD104', items: [{ name: 'Idli Vada', price: 35, quantity: 1 }], total: 35 },
    { id: 'ORD105', items: [{ name: 'Coffee', price: 15, quantity: 1 }], total: 15 },
    { id: 'ORD106', items: [{ name: 'Samosa', price: 20, quantity: 2 }], total: 40 },
  ];
  for (const o of orders) {
    state = canteenReducer(state, placeOrderAction(o));
  }

  // Consumer takes order
  state = canteenReducer(state, takeOrderAction());

  assert.ok(state.activeOrder, 'Active worker must have an order');
  assert.strictEqual(state.activeOrder.id, 'ORD101');
  assert.strictEqual(state.activeOrder.status, 'PREPARING');

  // ORD106 from blockedProducers admitted atomically into queue
  assert.strictEqual(state.blockedProducers.length, 0, 'Blocked list must be empty after admission');
  assert.strictEqual(state.queue.length, 5, 'Queue remains at 5 because ORD106 was admitted');
  assert.strictEqual(state.queue[4].id, 'ORD106');
  assert.strictEqual(state.queue[4].status, 'WAITING');

  assert.strictEqual(state.empty, 0);
  assert.strictEqual(state.full, 5);

  const inv = validateInvariants(state);
  assert.strictEqual(inv.valid, true, `Invariants failed on take_order + admission: ${inv.errors.join(', ')}`);
});

test('5. Single Worker Constraint: Worker cannot take 2nd order while preparing active order', () => {
  let state = INITIAL_STATE;
  state = canteenReducer(state, placeOrderAction({ id: 'ORD101', items: [], total: 40 }));
  state = canteenReducer(state, placeOrderAction({ id: 'ORD102', items: [], total: 20 }));

  // First take order
  state = canteenReducer(state, takeOrderAction());
  assert.strictEqual(state.activeOrder.id, 'ORD101');

  // Attempt second take order while busy
  const stateBefore = state;
  state = canteenReducer(state, takeOrderAction());
  assert.strictEqual(state.activeOrder.id, 'ORD101', 'Worker must still only prepare ORD101');
  assert.strictEqual(state.queue.length, stateBefore.queue.length, 'Queue must not be mutated');
});

test('6. Order Lifecycle Progression: WAITING -> PREPARING -> READY -> COMPLETED', () => {
  let state = INITIAL_STATE;
  state = canteenReducer(state, placeOrderAction({ id: 'ORD101', items: [{ name: 'Masala Dosa', price: 40, quantity: 1 }], total: 40 }));
  assert.strictEqual(state.queue[0].status, 'WAITING');

  // Worker takes order
  state = canteenReducer(state, takeOrderAction());
  assert.strictEqual(state.activeOrder.status, 'PREPARING');

  // Mark ready
  state = canteenReducer(state, markReadyAction('ORD101'));
  assert.strictEqual(state.activeOrder, null);
  assert.strictEqual(state.readyOrders.length, 1);
  assert.strictEqual(state.readyOrders[0].status, 'READY');

  // Mark collected
  state = canteenReducer(state, markCollectedAction('ORD101'));
  assert.strictEqual(state.readyOrders.length, 0);
  assert.strictEqual(state.history.length, 1);
  assert.strictEqual(state.history[0].status, 'COMPLETED');

  const inv = validateInvariants(state);
  assert.strictEqual(inv.valid, true);
});

test('7. Consumer Blocking on Empty Queue: Consumer blocks cleanly when full === 0', () => {
  let emptyState = INITIAL_STATE;
  emptyState = canteenReducer(emptyState, takeOrderAction());
  assert.strictEqual(emptyState.full, 0);
  assert.strictEqual(emptyState.empty, 5);
  assert.strictEqual(emptyState.activeOrder, null);
  const lastEvent = emptyState.events[0];
  assert.strictEqual(lastEvent.result, 'blocked');
  assert.ok(lastEvent.description.includes('Consumer waiting'));
});

test('8. Reset State: Restores pristine semaphores (empty=5, full=0, mutex=1, ORD101)', () => {
  let state = INITIAL_STATE;
  state = canteenReducer(state, placeOrderAction({ id: 'ORD101', items: [], total: 40 }));
  state = canteenReducer(state, takeOrderAction());
  state = canteenReducer(state, resetAction());

  assert.strictEqual(state.queue.length, 0);
  assert.strictEqual(state.blockedProducers.length, 0);
  assert.strictEqual(state.activeOrder, null);
  assert.strictEqual(state.readyOrders.length, 0);
  assert.strictEqual(state.history.length, 0);
  assert.strictEqual(state.empty, 5);
  assert.strictEqual(state.full, 0);
  assert.strictEqual(state.mutex, 1);
  assert.strictEqual(state.nextOrderNumber, 101);

  const inv = validateInvariants(state);
  assert.strictEqual(inv.valid, true);
});
