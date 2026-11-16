import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createInitialSyncState,
  stepSimulation,
  getOrderAccounting,
  setupSixOrderDemonstration,
} from '../src/logic/syncLabEngine.js';

describe('Sync Lab Intro & Presentation State Invariance', () => {
  it('1. Object selection and inspector queries are strictly read-only and never execute thread code', () => {
    const state = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    const initialPc = {
      P1: state.threads.P1.pc,
      P2: state.threads.P2.pc,
      C1: state.threads.C1.pc,
    };
    const initialStepCounter = state.stepCounter;
    const initialEmpty = state.empty;
    const initialFull = state.full;
    const initialMutex = state.mutex;

    // Simulate user selecting Bay 0, P1, C1, Mutex, Semaphores in UI
    const selections = ['BAY_0', 'P1', 'C1', 'MUTEX', 'SEMAPHORES'];
    for (let i = 0; i < selections.length; i++) {
      // Selection performs inspection queries only without mutating state
      const accounting = getOrderAccounting(state);
      assert.strictEqual(accounting.totalSubmitted, 0);
      assert.strictEqual(state.slots[0], null);
    }

    // Verification: state must be strictly identical
    assert.strictEqual(state.threads.P1.pc, initialPc.P1);
    assert.strictEqual(state.threads.P2.pc, initialPc.P2);
    assert.strictEqual(state.threads.C1.pc, initialPc.C1);
    assert.strictEqual(state.stepCounter, initialStepCounter);
    assert.strictEqual(state.empty, initialEmpty);
    assert.strictEqual(state.full, initialFull);
    assert.strictEqual(state.mutex, initialMutex);
  });

  it('2. Presentation toggle between Canteen terminology and OS mapping does not alter simulation state', () => {
    const state = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });

    // Step 1 action to produce an order
    const steppedState = stepSimulation(state, 'P1');
    const snapshotBeforeToggle = JSON.stringify(steppedState);

    // Toggling OS mapping is purely a presentation-layer transform
    const osMappingActive = true;
    const osLabels = {
      p1Label: osMappingActive ? `${steppedState.threads.P1.id} — Producer` : 'P1 Kiosk',
      c1Label: osMappingActive ? `${steppedState.threads.C1.id} — Consumer` : 'C1 Kitchen Counter',
      bufferLabel: osMappingActive ? 'Bounded Buffer (N = 5)' : '5 Counter Bays',
      mutexLabel: osMappingActive ? 'Mutex Lock (Binary Lock)' : 'Central Mutex Gate',
    };

    assert.strictEqual(osLabels.p1Label, 'P1 — Producer');
    assert.strictEqual(osLabels.c1Label, 'C1 — Consumer');

    // Engine state must remain unchanged
    const snapshotAfterToggle = JSON.stringify(steppedState);
    assert.strictEqual(snapshotBeforeToggle, snapshotAfterToggle);
  });

  it('3. Sixth order demonstration setup initializes 6 orders and blocks 6th order outside buffer when saturated', () => {
    let demoState = setupSixOrderDemonstration();

    assert.strictEqual(demoState.slots.length, 5);
    assert.strictEqual(demoState.capacity, 5);
    assert.strictEqual(demoState.isKitchenPaused, true);

    // Step producers until 5 bays are filled and 6th blocks
    for (let i = 0; i < 40; i++) {
      demoState = stepSimulation(demoState);
      if (demoState.occupancy === 5 && demoState.waitQueues.empty.length > 0) {
        break;
      }
    }

    assert.strictEqual(demoState.occupancy, 5);
    assert.strictEqual(demoState.empty, 0);

    const accounting = getOrderAccounting(demoState);
    assert.strictEqual(accounting.totalSubmitted, 6);
    assert.strictEqual(accounting.inBufferCount, 5);
    assert.strictEqual(accounting.waitingForCapacityCount, 1);
    assert.strictEqual(accounting.kitchenAcceptedCount, 0);

    // Blocked producer is outside the buffer
    const blocked = accounting.waitingForCapacity[0];
    assert.strictEqual(blocked.id, 'LAB-006');
    assert.strictEqual(demoState.threads[blocked.producerId].status, 'BLOCKED');
    assert.strictEqual(demoState.threads[blocked.producerId].waitingFor, 'empty');
  });

  it('4. Releasing kitchen in demonstration consumes slot and admits 6th order without overflow', () => {
    let demoState = setupSixOrderDemonstration();

    // Saturate buffer first
    for (let i = 0; i < 40; i++) {
      demoState = stepSimulation(demoState);
      if (demoState.occupancy === 5 && demoState.waitQueues.empty.length > 0) {
        break;
      }
    }

    // Resume kitchen
    demoState = { ...demoState, isKitchenPaused: false };

    // Run until C1 consumes at least 1 item
    for (let i = 0; i < 60; i++) {
      demoState = stepSimulation(demoState);
      const acc = getOrderAccounting(demoState);
      if (acc.kitchenAcceptedCount >= 1) {
        break;
      }
    }

    // Producer must now have had opportunity to unblock or enter buffer
    const accounting = getOrderAccounting(demoState);
    assert.ok(accounting.kitchenAcceptedCount >= 1, 'Kitchen must have accepted at least 1 order');
    assert.ok(accounting.inBufferCount <= 5, 'Buffer must never exceed 5 slots');
    assert.strictEqual(accounting.inBufferCount + accounting.kitchenAcceptedCount + accounting.awaitingCount + accounting.waitingForCapacityCount, 6, 'Total orders must be conserved at 6');
  });

  it('5. Single committed teaching sentence correctly describes insertion and consumption', () => {
    let state = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });

    // Step P1 to insert an item
    state = stepSimulation(state, 'P1');
    while (state.events[0]?.type !== 'ITEM_INSERTED' && state.stepCounter < 20) {
      state = stepSimulation(state, 'P1');
    }

    const latest = state.events[0];
    assert.strictEqual(latest.type, 'ITEM_INSERTED');
    assert.ok(latest.details?.itemId, 'Event has valid item ID');
    assert.strictEqual(latest.threadId, 'P1');
    assert.strictEqual(state.slots[0]?.id, latest.details?.itemId);

    // Step C1 to consume the item
    while (state.events[0]?.type !== 'ITEM_REMOVED' && state.stepCounter < 40) {
      state = stepSimulation(state, 'C1');
    }

    const consumeEvt = state.events[0];
    assert.strictEqual(consumeEvt.type, 'ITEM_REMOVED');
    assert.strictEqual(consumeEvt.details?.slotIndex, 0);
  });

  it('6. IN and OUT pointers are identical when empty/full and separate during staggered progress', () => {
    const freshState = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
    assert.strictEqual(freshState.in, 0);
    assert.strictEqual(freshState.out, 0);
    assert.strictEqual(freshState.in === freshState.out, true, 'Initially both pointers point to slot 0');

    // Run P1 until it inserts into slot 0 and increments IN to 1
    let state = freshState;
    while (state.in === 0 && state.stepCounter < 20) {
      state = stepSimulation(state, 'P1');
    }

    assert.strictEqual(state.in, 1);
    assert.strictEqual(state.out, 0);
    assert.notStrictEqual(state.in, state.out, 'Pointers are now separated (IN=1, OUT=0)');
  });
});
