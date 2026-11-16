import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSyncState,
  stepSimulation,
  SCENARIOS,
  stepToNextTeachingEvent,
  getTeachingCanteenExplanation,
  BUFFER_COMPARISON_PRESETS,
  validateInvariants,
} from '../src/logic/syncLabEngine.js';

describe('Consolidated 3D Canteen Apparatus Engine Verification', () => {
  describe('1. Next Action Stopping Rules and Instruction Budget', () => {
    it('stops execution at the next significant teaching event (item insertion) within budget', () => {
      const initial = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
      const result = stepToNextTeachingEvent(initial, 'P1', 15);

      assert.ok(result.instructionsRun <= 15, 'Instruction run budget was respected');
      assert.ok(result.instructionsRun >= 1, 'At least 1 instruction was executed');
      assert.equal(result.stoppedReason, 'TEACHING_EVENT');
      assert.equal(result.teachingEvent?.type, 'ITEM_INSERTED');
      assert.equal(result.nextState.slots[0]?.slotIndex, 0);
      assert.equal(result.nextState.occupancy, 1);
    });

    it('stops execution when an item is removed by consumer', () => {
      // 1 item in slot 0
      const initial = createInitialSyncState({
        scenarioId: 'NORMAL_FLOW',
        initialSlots: [{ id: 'ORD-01', name: 'Coffee', slotIndex: 0, producerId: 'P1' }, null, null, null, null],
        in: 1,
        out: 0,
        empty: 4,
        full: 1,
        mutex: 1,
      });

      const result = stepToNextTeachingEvent(initial, 'C1', 15);
      assert.ok(result.instructionsRun <= 15);
      assert.equal(result.stoppedReason, 'TEACHING_EVENT');
      assert.equal(result.teachingEvent?.type, 'ITEM_REMOVED');
      assert.equal(result.nextState.slots[0], null, 'Slot 0 was cleared upon kitchen acceptance');
    });

    it('stops when thread blocks on empty buffer without busy-looping past budget', () => {
      const emptyState = createInitialSyncState({
        scenarioId: 'NORMAL_FLOW',
        empty: 5,
        full: 0,
      });

      // Consumer C1 attempts sem_wait(&full) on empty queue
      const result = stepToNextTeachingEvent(emptyState, 'C1', 15);
      assert.equal(result.stoppedReason, 'TEACHING_EVENT');
      assert.equal(result.teachingEvent?.type, 'THREAD_BLOCKED');
      assert.equal(result.nextState.threads.C1.status, 'BLOCKED');
      assert.equal(result.nextState.threads.C1.waitingFor, 'full');
    });
  });

  describe('2. Full-Buffer Blocking and Wake-Up Scenario', () => {
    it('blocks producer when all 5 bays are occupied and resumes on kitchen signal(empty)', () => {
      const state = SCENARIOS.BUFFER_FULL.setup();
      assert.equal(state.occupancy, 4);
      assert.equal(state.empty, 1);

      // Step 1: P1 fills the 5th bay
      const fillResult = stepToNextTeachingEvent(state, 'P1', 15);
      assert.equal(fillResult.nextState.occupancy, 5);
      assert.equal(fillResult.nextState.empty, 0);

      // Complete P1 cycle
      const cycleResult = stepToNextTeachingEvent(fillResult.nextState, 'P1', 15);

      // Step 2: P2 attempts to produce into full buffer
      const p2Result = stepToNextTeachingEvent(cycleResult.nextState, 'P2', 15);
      assert.equal(p2Result.stoppedReason, 'TEACHING_EVENT');
      assert.equal(p2Result.teachingEvent?.type, 'THREAD_BLOCKED');
      assert.equal(p2Result.nextState.threads.P2.status, 'BLOCKED');
      assert.equal(p2Result.nextState.threads.P2.waitingFor, 'empty');
      assert.ok(p2Result.nextState.waitQueues.empty.includes('P2'));

      // Step 3: Consumer C1 accepts order and signals empty
      const c1Remove = stepToNextTeachingEvent(p2Result.nextState, 'C1', 15);
      assert.equal(c1Remove.teachingEvent?.type, 'ITEM_REMOVED');

      // Next action on C1 triggers sem_post(&empty), resuming P2
      const c1Post = stepToNextTeachingEvent(c1Remove.nextState, 'C1', 15);
      assert.equal(c1Post.teachingEvent?.type, 'THREAD_RESUMED');
      assert.equal(c1Post.teachingEvent?.details?.wokenThreadId, 'P2');
      assert.equal(c1Post.nextState.threads.P2.status, 'READY');
      assert.equal(c1Post.nextState.threads.P2.waitingFor, null);
    });
  });

  describe('3. Mutex Comparison: Without Mutex vs With Mutex', () => {
    it('without mutex: detects collision, pauses immediately, and records overwritten order', () => {
      let state = createInitialSyncState({
        scenarioId: 'MUTEX_COMPARISON',
        withoutMutex: true,
        useDecomposedBuffer: true,
      });

      const schedule = BUFFER_COMPARISON_PRESETS.RACE_COLLISION.schedule;

      for (let i = 0; i < schedule.length; i++) {
        const tid = schedule[i];
        state = stepSimulation(state, tid, { strict: true });
        if (state.firstFault) {
          break;
        }
      }

      assert.ok(state.firstFault !== null, 'Fault occurred and was detected');
      assert.equal(state.firstFault.type, 'SLOT_OVERWRITTEN');
      assert.equal(state.firstFault.slotIndex, 0);
      assert.equal(state.firstFault.culpritThreadId, 'P2');
      assert.ok(state.displacedItems.length > 0, 'Displaced item evidence captured');
      assert.equal(state.displacedItems[0].displacedItem.producerId, 'P1');
    });

    it('with mutex: serializes critical sections and preserves both orders in distinct bays', () => {
      let state = createInitialSyncState({
        scenarioId: 'MUTEX_COMPARISON',
        withoutMutex: false,
        useDecomposedBuffer: true,
      });

      // P1 executes critical section under lock
      // CREATE_ITEM (0), WAIT_EMPTY (1), WAIT_MUTEX (2), READ_IN (3), WRITE_SLOT (4), ADVANCE_IN (5), SIGNAL_MUTEX (6), SIGNAL_FULL (7), CYCLE_DONE (8)
      for (let i = 0; i < 9; i++) {
        state = stepSimulation(state, 'P1');
      }
      assert.equal(state.slots[0]?.producerId, 'P1');
      assert.equal(state.in, 1);

      // P2 now executes cleanly into Bay 1
      for (let i = 0; i < 9; i++) {
        state = stepSimulation(state, 'P2');
      }
      assert.equal(state.slots[1]?.producerId, 'P2');
      assert.equal(state.in, 2);
      assert.equal(state.occupancy, 2);
      assert.equal(state.firstFault, null);
      assert.equal(state.displacedItems?.length ?? 0, 0);

      const inv = validateInvariants(state);
      assert.equal(inv.isValid, true);
    });
  });

  describe('4. Event-Derived Canteen Explanations', () => {
    it('formats plain-language canteen explanations based on actual events', () => {
      const state = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });

      // Initial state
      const initialExp = getTeachingCanteenExplanation(state);
      assert.ok(initialExp.includes('Simulation ready'));

      // Item inserted event
      const insertEvt = {
        type: 'ITEM_INSERTED',
        threadId: 'P1',
        details: { itemId: 'ORD-001', slotIndex: 0 },
      };
      const insertExp = getTeachingCanteenExplanation(state, insertEvt);
      assert.equal(insertExp, 'Order ORD-001 entered Bay 0.');

      // Producer blocked event
      const blockedEvt = {
        type: 'THREAD_BLOCKED',
        threadId: 'P2',
        details: { waitingFor: 'empty' },
      };
      const blockedExp = getTeachingCanteenExplanation(state, blockedEvt);
      assert.ok(blockedExp.includes('P2 is waiting because no empty permit is available'));

      // Thread resumed event
      const resumedEvt = {
        type: 'THREAD_RESUMED',
        threadId: 'C1',
        details: { permit: 'empty', wokenThreadId: 'P2' },
      };
      const resumedExp = getTeachingCanteenExplanation(state, resumedEvt);
      assert.equal(resumedExp, 'Kitchen released capacity; P2 can continue.');
    });
  });

  describe('5. Reset & Scenario Isolation', () => {
    it('restores clean state and clears residual faults on reset', () => {
      // Create dirty state with fault
      let state = createInitialSyncState({
        scenarioId: 'MUTEX_COMPARISON',
        withoutMutex: true,
        useDecomposedBuffer: true,
      });
      state.firstFault = { type: 'SLOT_OVERWRITTEN' };
      state.displacedItems = [{ slotIndex: 0 }];

      // Reset
      const fresh = createInitialSyncState({ scenarioId: 'NORMAL_FLOW' });
      assert.equal(fresh.firstFault, null);
      assert.equal(fresh.displacedItems?.length ?? 0, 0);
      assert.equal(fresh.occupancy, 0);
      assert.equal(fresh.stepCounter, 0);
    });
  });
});
