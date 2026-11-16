import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNormalFlowState,
  NORMAL_FLOW_SCHEDULE,
  stepSimulation,
  getStructuredTeachingExplanation,
} from '../src/logic/syncLabEngine.js';

test('Stage 2: Protected Normal Flow Execution & Educational Explanations', async (t) => {
  await t.test('1. initial state has empty buffer, empty=5, full=0, mutex=1, and initial explanation', () => {
    const state = createNormalFlowState();

    assert.strictEqual(state.capacity, 5);
    assert.strictEqual(state.empty, 5);
    assert.strictEqual(state.full, 0);
    assert.strictEqual(state.mutex, 1);
    assert.strictEqual(state.mutexOwner, null);
    assert.strictEqual(state.in, 0);
    assert.strictEqual(state.out, 0);
    assert.strictEqual(state.stepCounter, 0);
    assert.deepStrictEqual(state.slots, [null, null, null, null, null]);

    const explanation = getStructuredTeachingExplanation(state, null);
    assert.strictEqual(explanation.what, 'No instruction has executed yet.');
    assert.ok(explanation.why.includes('Buffer initialized'));
  });

  await t.test('2. one Next instruction commits exactly one instruction', () => {
    let state = createNormalFlowState();
    const targetThread = NORMAL_FLOW_SCHEDULE[0]; // 'P1'

    state = stepSimulation(state, targetThread, { strict: true });

    assert.strictEqual(state.stepCounter, 1);
    assert.strictEqual(state.events.length, 1);
    assert.strictEqual(state.events[0].type, 'ITEM_CREATED');
    assert.strictEqual(state.events[0].threadId, 'P1');
    assert.strictEqual(state.threads.P1.pc, 1);

    const explanation = getStructuredTeachingExplanation(state, state.events[0]);
    assert.ok(explanation.what.includes('P1 prepared local order token'));
    assert.ok(explanation.why.includes('private memory'));
  });

  await t.test('3. stepping through P1 insertion serializes under mutex lock and advances IN', () => {
    let state = createNormalFlowState();

    // Run P1's 8 instructions
    for (let i = 0; i < 8; i++) {
      state = stepSimulation(state, 'P1', { strict: true });
    }

    // Step 1: ITEM_CREATED
    // Step 2: WAIT_EMPTY -> empty = 4
    // Step 3: LOCK -> mutex = 0, owner = P1
    // Step 4: READ_IN -> targetSlot = 0
    // Step 5: WRITE_SLOT -> slot 0 has ticket A
    // Step 6: UPDATE_IN -> in = 1
    // Step 7: UNLOCK -> mutex = 1, owner = null
    // Step 8: SIGNAL_FULL -> full = 1

    assert.strictEqual(state.slots[0]?.id, 'A');
    assert.strictEqual(state.slots[1], null);
    assert.strictEqual(state.in, 1);
    assert.strictEqual(state.out, 0);
    assert.strictEqual(state.empty, 4);
    assert.strictEqual(state.full, 1);
    assert.strictEqual(state.mutex, 1);
    assert.strictEqual(state.mutexOwner, null);
  });

  await t.test('4. C1 acceptance claims ticket A from slot 0 under mutex and advances OUT', () => {
    let state = createNormalFlowState();
    for (let i = 0; i < 8; i++) {
      state = stepSimulation(state, 'P1', { strict: true });
    }

    // Run C1's 9 instructions
    for (let i = 0; i < 9; i++) {
      state = stepSimulation(state, 'C1', { strict: true });
    }

    // Slot 0 is now empty
    assert.strictEqual(state.slots[0], null);
    assert.strictEqual(state.in, 1);
    assert.strictEqual(state.out, 1);
    assert.strictEqual(state.empty, 5); // capacity released
    assert.strictEqual(state.full, 0);
    assert.strictEqual(state.mutex, 1);
    assert.strictEqual(state.mutexOwner, null);
    assert.deepStrictEqual(state.acceptedHistory, ['A']);
    assert.deepStrictEqual(state.consumedItems, ['A']);
  });

  await t.test('5. full 34-step schedule processes A and B and completes cleanly', () => {
    let state = createNormalFlowState();

    NORMAL_FLOW_SCHEDULE.forEach((tid) => {
      state = stepSimulation(state, tid, { strict: true });
    });

    assert.strictEqual(state.stepCounter, 34);
    assert.deepStrictEqual(state.slots, [null, null, null, null, null]);
    assert.strictEqual(state.in, 2);
    assert.strictEqual(state.out, 2);
    assert.strictEqual(state.empty, 5);
    assert.strictEqual(state.full, 0);
    assert.strictEqual(state.mutex, 1);
    assert.strictEqual(state.mutexOwner, null);
    assert.deepStrictEqual(state.acceptedHistory, ['A', 'B']);
    assert.deepStrictEqual(state.consumedItems, ['A', 'B']);

    const finalEvent = state.events[0];
    assert.strictEqual(finalEvent.type, 'ITEM_PROCESSED');
    const explanation = getStructuredTeachingExplanation(state, finalEvent);
    assert.ok(explanation.what.includes('C2 processed order B'));
    assert.ok(explanation.why.includes('outside the queue critical section'));
  });

  await t.test('6. manual stepping and batch play reach identical end states', () => {
    let manualState = createNormalFlowState();
    let batchState = createNormalFlowState();

    NORMAL_FLOW_SCHEDULE.forEach((tid) => {
      manualState = stepSimulation(manualState, tid, { strict: true });
    });

    NORMAL_FLOW_SCHEDULE.forEach((tid) => {
      batchState = stepSimulation(batchState, tid, { strict: true });
    });

    assert.deepStrictEqual(manualState.slots, batchState.slots);
    assert.strictEqual(manualState.in, batchState.in);
    assert.strictEqual(manualState.out, batchState.out);
    assert.strictEqual(manualState.empty, batchState.empty);
    assert.strictEqual(manualState.full, batchState.full);
    assert.deepStrictEqual(manualState.consumedItems, batchState.consumedItems);
  });
});

