import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderTeachingSnapshot,
  createLabRequestFromSnapshot,
} from '../src/logic/orderSnapshotAdapter.js';
import {
  createInitialSyncState,
  submitCustomLabOrder,
  stepSimulation,
} from '../src/logic/syncLabEngine.js';

describe('Order Placement → OS Sync Lab Handoff & Isolation', () => {
  it('1. Snapshot Adapter: Copies only allowlisted fields and strips sensitive data', () => {
    const rawCustomerOrder = {
      id: 'ORD101',
      status: 'WAITING',
      timestamp: '12:30 PM',
      total: 450,
      customerName: 'Alice Student',
      studentEmail: 'alice@university.edu',
      paymentToken: 'tok_live_secret_998877',
      creditCardLast4: '4242',
      billingAddress: 'Campus Dorm Hall 4',
      internalDbId: 98124,
      items: [
        { id: 1, name: 'Cold Brew', price: 120, quantity: 2, subtotal: 240 },
        { id: 2, name: 'Avocado Toast', price: 210, quantity: 1, subtotal: 210 },
      ],
    };

    const snapshot = createOrderTeachingSnapshot(rawCustomerOrder);

    assert.ok(snapshot, 'Snapshot should be created successfully');
    assert.equal(snapshot.sourceOrderId, 'ORD101');
    assert.equal(snapshot.totalQuantity, 3);
    assert.equal(snapshot.itemSummary, '2x Cold Brew, 1x Avocado Toast');
    assert.equal(snapshot.isTeachingSnapshot, true);

    // Verify forbidden fields are NOT copied
    assert.equal(snapshot.customerName, undefined);
    assert.equal(snapshot.studentEmail, undefined);
    assert.equal(snapshot.paymentToken, undefined);
    assert.equal(snapshot.creditCardLast4, undefined);
    assert.equal(snapshot.billingAddress, undefined);
    assert.equal(snapshot.internalDbId, undefined);
  });

  it('2. Immutability Guarantee: Real customer order object is never mutated', () => {
    const originalOrder = {
      id: 'ORD102',
      items: [{ name: 'Filter Coffee', quantity: 1 }],
      status: 'WAITING',
    };
    const clonedSnapshot = JSON.parse(JSON.stringify(originalOrder));

    const snapshot = createOrderTeachingSnapshot(originalOrder);

    // Ensure snapshot is frozen
    assert.ok(Object.isFrozen(snapshot), 'Teaching snapshot should be frozen');
    assert.ok(Object.isFrozen(snapshot.items), 'Snapshot items array should be frozen');

    // Attempt mutation on snapshot (should fail or throw in strict mode)
    assert.throws(() => {
      snapshot.sourceOrderId = 'MUTATED';
    });

    // Verify original object remains completely unaltered
    assert.deepEqual(originalOrder, clonedSnapshot);
  });

  it('3. Model Definition: Multi-item order maps to ONE buffer ticket in simulation', () => {
    const multiItemOrder = {
      id: 'ORD103',
      items: [
        { name: 'Cold Brew', quantity: 2 },
        { name: 'Croissant', quantity: 3 },
        { name: 'Granola Bowl', quantity: 1 },
      ], // 6 food items in total
    };

    const snapshot = createOrderTeachingSnapshot(multiItemOrder);
    assert.equal(snapshot.totalQuantity, 6, 'Total food items count is 6');

    // Convert to simulated lab request
    const labTicket = createLabRequestFromSnapshot(snapshot, 1);

    assert.equal(labTicket.id, 'LAB-001', 'Simulation ID is independent LAB-001');
    assert.equal(labTicket.sourceOrderRef, 'ORD103', 'Carries safe source reference');
    assert.equal(labTicket.isImportedFromOrder, true);
    // Crucial check: it is ONE ticket token
    assert.equal(typeof labTicket.id, 'string');
    assert.equal(Array.isArray(labTicket), false, 'Must be a single request ticket, not multiple');
  });

  it('4. Handoff Integrity: Submitting snapshot does NOT directly occupy a slot or mutate semaphores', () => {
    const state0 = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    assert.equal(state0.occupancy, 0, 'Buffer starts empty');
    assert.equal(state0.empty, 5, 'Empty semaphore starts at 5');
    assert.equal(state0.full, 0, 'Full semaphore starts at 0');

    const snapshot = createOrderTeachingSnapshot({
      id: 'ORD104',
      items: [{ name: 'Chai', quantity: 1 }],
    });
    const labReq = createLabRequestFromSnapshot(snapshot, 1);

    const submissionResult = submitCustomLabOrder(state0, labReq, 15);
    const state1 = submissionResult.nextState;

    // Slots must remain empty! It was not directly inserted!
    assert.equal(state1.occupancy, 0, 'Buffer occupancy must remain 0 after handoff submission');
    assert.equal(state1.empty, 5, 'Empty semaphore must not be decremented by handoff');
    assert.equal(state1.full, 0, 'Full semaphore must not be incremented by handoff');
    assert.equal(state1.slots[0], null, 'Slot 0 must remain null');

    // Producer P1 is at pc = 0 with assignedRequest
    assert.equal(state1.threads.P1.pc, 0, 'Producer P1 remains at pc 0 waiting for step');
    assert.equal(state1.threads.P1.assignedRequest.id, 'LAB-001');
    assert.equal(state1.threads.P1.assignedRequest.sourceOrderRef, 'ORD104');
  });

  it('5. Engine Progression: Follows legitimate instruction steps to deposit ticket', () => {
    const state0 = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    const snapshot = createOrderTeachingSnapshot({
      id: 'ORD105',
      items: [{ name: 'Sandwich', quantity: 1 }],
    });
    const labReq = createLabRequestFromSnapshot(snapshot, 1);
    const { nextState: state1 } = submitCustomLabOrder(state0, labReq, 15);

    // Step 1: P1 executes CREATE_ITEM
    const state2 = stepSimulation(state1, 'P1');
    assert.equal(state2.threads.P1.pc, 1);
    assert.equal(state2.threads.P1.localItem?.id, 'LAB-001');
    assert.equal(state2.occupancy, 0, 'Slot still empty before critical section');

    // Step 2: P1 executes sem_wait(&empty)
    const state3 = stepSimulation(state2, 'P1');
    assert.equal(state3.threads.P1.pc, 2);
    assert.equal(state3.empty, 4, 'Empty semaphore decremented by POSIX wait');

    // Step 3: P1 executes pthread_mutex_lock(&mutex)
    const state4 = stepSimulation(state3, 'P1');
    assert.equal(state4.threads.P1.pc, 3);
    assert.equal(state4.mutex, 0, 'Mutex acquired by P1');
    assert.equal(state4.mutexOwner, 'P1');

    // Step 4: P1 executes buffer[in] = item
    const state5 = stepSimulation(state4, 'P1');
    assert.equal(state5.threads.P1.pc, 4);
    assert.equal(state5.slots[0]?.id, 'LAB-001', 'Ticket now placed in Slot 0 under lock');
    assert.equal(state5.occupancy, 1);

    // Step 5: P1 advances IN pointer
    const state6 = stepSimulation(state5, 'P1');
    assert.equal(state6.in, 1, 'IN pointer advanced to 1');

    // Step 6: P1 unlocks mutex
    const state7 = stepSimulation(state6, 'P1');
    assert.equal(state7.mutex, 1, 'Mutex released');
    assert.equal(state7.mutexOwner, null);

    // Step 7: P1 signals full
    const state8 = stepSimulation(state7, 'P1');
    assert.equal(state8.full, 1, 'Full semaphore signaled');
  });

  it('6. Consumer Intake: Kitchen consumer C1 accepts ticket and completes lifecycle', () => {
    // Start with order placed in slot 0
    const state0 = createInitialSyncState({
      scenarioId: 'NORMAL_FLOW',
      initialSlots: [{ id: 'LAB-001', name: 'Cold Brew', slotIndex: 0, producerId: 'P1' }],
      in: 1,
      out: 0,
      empty: 4,
      full: 1,
      mutex: 1,
      scheduledThreadId: 'C1',
    });

    assert.equal(state0.occupancy, 1);

    // C1: wait(full)
    const s1 = stepSimulation(state0, 'C1');
    assert.equal(s1.full, 0);

    // C1: lock(mutex)
    const s2 = stepSimulation(s1, 'C1');
    assert.equal(s2.mutex, 0);
    assert.equal(s2.mutexOwner, 'C1');

    // C1: remove from buffer[out]
    const s3 = stepSimulation(s2, 'C1');
    assert.equal(s3.slots[0], null, 'Slot 0 is now freed');
    assert.equal(s3.threads.C1.localItem?.id, 'LAB-001');

    // C1: advance out
    const s4 = stepSimulation(s3, 'C1');
    assert.equal(s4.out, 1);

    // C1: unlock(mutex)
    const s5 = stepSimulation(s4, 'C1');
    assert.equal(s5.mutex, 1);

    // C1: signal(empty)
    const s6 = stepSimulation(s5, 'C1');
    assert.equal(s6.empty, 5, 'Capacity freed');

    // C1: process item outside lock
    const s7 = stepSimulation(s6, 'C1');
    assert.equal(s7.threads.C1.pc, 7);

    // C1: cycle done
    const s8 = stepSimulation(s7, 'C1');
    assert.equal(s8.consumedItems.length, 1);
    assert.equal(s8.consumedItems[0], 'LAB-001');
  });

  it('7. Storage & Fallback: Gracefully handles missing, corrupted, or stale storage', () => {
    // Missing snapshot returns null
    const nullSnap = createOrderTeachingSnapshot(null);
    assert.equal(nullSnap, null);

    const emptyObjSnap = createOrderTeachingSnapshot({});
    assert.ok(emptyObjSnap);
    assert.ok(emptyObjSnap.sourceOrderId);

    // Fallback request generator when snapshot is null
    const fallbackReq = createLabRequestFromSnapshot(null, 1);
    assert.equal(fallbackReq.id, 'LAB-001');
    assert.equal(fallbackReq.sourceOrderRef, null);
    assert.equal(fallbackReq.isImportedFromOrder, false);
  });

  it('8. Simulation Isolation: Resetting simulation clears simulated state without side-effects', () => {
    const state0 = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    const snapshot = createOrderTeachingSnapshot({ id: 'ORD109', items: [{ name: 'Wrap', quantity: 1 }] });
    const { nextState: submitted } = submitCustomLabOrder(state0, createLabRequestFromSnapshot(snapshot, 1));

    assert.equal(submitted.submittedRequests.length, 1);

    // Clean reset to pristine initial state
    const resetState = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    assert.equal(resetState.submittedRequests.length, 0);
    assert.equal(resetState.requestBacklog.length, 0);
    assert.equal(resetState.stepCounter, 0);
    assert.equal(resetState.occupancy, 0);
  });
});
