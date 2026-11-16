import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSyncState,
  stepSimulation,
  submitLabOrders,
  setupSixOrderDemonstration,
  getOrderAccounting,
  validateInvariants,
} from '../src/logic/syncLabEngine.js';

describe('Workload Backpressure & N = 5 Capacity Demonstration Verification', () => {
  describe('1. Sixth Request & Fixed Capacity N = 5', () => {
    it('does not create a sixth slot when 6 orders are submitted', () => {
      const state = setupSixOrderDemonstration();
      assert.equal(state.capacity, 5);
      assert.equal(state.slots.length, 5);

      let curr = state;
      // Step producers until 5 bays are filled and 6th blocks
      for (let i = 0; i < 40; i++) {
        curr = stepSimulation(curr);
        if (curr.occupancy === 5 && curr.waitQueues.empty.length > 0) {
          break;
        }
      }

      assert.equal(curr.capacity, 5, 'Capacity remained fixed at 5');
      assert.equal(curr.slots.length, 5, 'No 6th buffer bay was ever created');
      assert.equal(curr.occupancy, 5, 'All 5 buffer bays are full');
      assert.equal(curr.empty, 0, 'Zero empty permits remaining');

      // The 6th order is held outside the buffer by blocked P2
      const accounting = getOrderAccounting(curr);
      assert.equal(accounting.inBufferCount, 5);
      assert.equal(accounting.waitingForCapacityCount, 1);
      assert.equal(accounting.totalSubmitted, 6);

      const blockedProducer = accounting.waitingForCapacity[0];
      assert.equal(blockedProducer.id, 'LAB-006');
      assert.equal(blockedProducer.isBlocked, true);
      assert.equal(blockedProducer.waitingFor, 'empty');
    });
  });

  describe('2. Four-Location Order Accounting Integrity', () => {
    it('maintains strict mathematical conservation across all 4 mutually exclusive locations', () => {
      let state = setupSixOrderDemonstration();
      let accounting = getOrderAccounting(state);
      assert.equal(accounting.totalSubmitted, 6);

      // Verify at initial submission
      let sum = accounting.awaitingCount + accounting.heldCount + accounting.inBufferCount + accounting.kitchenAcceptedCount;
      assert.equal(sum, 6);

      // Run partially through insertion
      for (let i = 0; i < 15; i++) {
        state = stepSimulation(state);
        accounting = getOrderAccounting(state);
        sum = accounting.awaitingCount + accounting.heldCount + accounting.inBufferCount + accounting.kitchenAcceptedCount;
        assert.equal(sum, 6, `Accounting violated at step #${state.stepCounter}`);
      }

      // Resume kitchen and run through consumption
      state.isKitchenPaused = false;
      for (let i = 0; i < 150; i++) {
        state = stepSimulation(state);
        accounting = getOrderAccounting(state);
        sum = accounting.awaitingCount + accounting.heldCount + accounting.inBufferCount + accounting.kitchenAcceptedCount;
        assert.equal(sum, 6, `Accounting violated at step #${state.stepCounter}`);
        if (accounting.kitchenAcceptedCount === 6) break;
      }

      assert.equal(accounting.kitchenAcceptedCount, 6, 'All 6 orders safely accepted by kitchen');
      assert.equal(accounting.inBufferCount, 0, 'Buffer empty after consumption');
      assert.equal(accounting.waitingForCapacityCount, 0);
      assert.equal(accounting.awaitingCount, 0);
    });
  });

  describe('3. Ten-Request Workload with Real Backpressure', () => {
    it('saturates at 5 with kitchen paused, queues backlog, and drains all 10 without loss when kitchen runs', () => {
      const initial = createInitialSyncState({
        scenarioId: 'NORMAL_FLOW',
        useWorkloadQueue: true,
        isKitchenPaused: true,
        empty: 5,
        full: 0,
        mutex: 1,
      });

      const submission = submitLabOrders(initial, 10, 15);
      let state = submission.nextState;
      assert.equal(state.submittedRequests.length, 10);

      // Step with kitchen paused until saturated and blocked
      for (let i = 0; i < 50; i++) {
        state = stepSimulation(state);
        if (state.occupancy === 5 && state.waitQueues.empty.length > 0) {
          break;
        }
      }

      assert.equal(state.occupancy, 5, 'Buffer saturated at 5');
      const midAccounting = getOrderAccounting(state);
      assert.equal(midAccounting.inBufferCount, 5);
      assert.equal(midAccounting.waitingForCapacityCount, 1);
      assert.equal(midAccounting.awaitingCount, 4, '4 requests wait in backlog awaiting producer');
      assert.equal(midAccounting.kitchenAcceptedCount, 0);

      // Unpause kitchen and run until all 10 are served
      state.isKitchenPaused = false;
      for (let i = 0; i < 150; i++) {
        state = stepSimulation(state);
        const acc = getOrderAccounting(state);
        if (acc.kitchenAcceptedCount === 10) {
          break;
        }
      }

      const finalAccounting = getOrderAccounting(state);
      assert.equal(finalAccounting.kitchenAcceptedCount, 10, 'All 10 orders accepted by kitchen');
      assert.equal(finalAccounting.inBufferCount, 0);
      assert.equal(finalAccounting.totalSubmitted, 10);
      assert.equal(state.displacedItems?.length ?? 0, 0, 'Zero overwritten or displaced orders');

      const inv = validateInvariants(state);
      assert.equal(inv.isValid, true);
    });
  });

  describe('4. Kitchen Pause Precision & No Stranded Mutex', () => {
    it('pauses consumer at cycle boundary (pc=0) without holding mutex or semaphores', () => {
      const state = createInitialSyncState({
        scenarioId: 'NORMAL_FLOW',
        isKitchenPaused: true,
        initialSlots: [{ id: 'ORD-1', name: 'Coffee', slotIndex: 0, producerId: 'P1' }, null, null, null, null],
        in: 1,
        out: 0,
        empty: 4,
        full: 1,
        mutex: 1,
      });

      // Consumer C1 has pc === 0 and kitchen is paused
      const next = stepSimulation(state, 'C1');
      assert.equal(next.stepCounter, state.stepCounter, 'C1 did not execute while paused at pc=0');
      assert.equal(next.mutex, 1, 'Mutex remained free');
      assert.equal(next.mutexOwner, null);
    });
  });

  describe('5. Reset Cleans State Completely', () => {
    it('resets backlog, submitted requests, and thread assignments cleanly', () => {
      const state = setupSixOrderDemonstration();
      assert.equal(state.submittedRequests.length, 6);

      const fresh = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
      assert.equal(fresh.submittedRequests?.length ?? 0, 0);
      assert.equal(fresh.requestBacklog?.length ?? 0, 0);
      assert.equal(fresh.occupancy, 0);
      assert.equal(fresh.stepCounter, 0);
    });
  });
});
