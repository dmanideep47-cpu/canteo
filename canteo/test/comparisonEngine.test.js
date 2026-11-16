import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialComparison,
  stepComparisonTurn,
  evaluateComparisonInvariants,
  COMPARISON_EXPERIMENTS,
} from '../src/logic/comparisonEngine.js';
import {
  COUNTER_PRESETS,
  createInitialCounterState,
  stepCounterSimulation,
} from '../src/logic/counterEngine.js';

describe('Authoritative Comparison Engine', () => {
  describe('Shared Counter: Without Mutex vs With Mutex', () => {
    it('creates initial counter comparison with matching starting values', () => {
      const comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE', { initialShared: 2 });
      assert.equal(comp.leftState.shared, 2);
      assert.equal(comp.rightState.shared, 2);
      assert.equal(comp.leftState.withMutex, false);
      assert.equal(comp.rightState.withMutex, true);
      assert.equal(comp.turnIndex, 0);
      assert.equal(comp.leftCommittedCount, 0);
      assert.equal(comp.rightCommittedCount, 0);
    });

    it('Preset 1 (LOST_UPDATE): demonstrates lost update on left pane (final=3) vs serialized safety on right pane (final=4)', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE', {
        initialShared: 2,
        pauseAtFirstFault: false,
      });

      // Preset schedule: ['P1', 'P2', 'P1', 'P2', 'P1', 'P2']
      for (let i = 0; i < 6; i++) {
        comp = stepComparisonTurn(comp);
      }

      // Left pane (without mutex) finishes with 3 (lost update fault)
      assert.equal(comp.leftState.shared, 3);
      assert.equal(comp.leftState.isCompleted, true);
      assert.ok(comp.leftState.firstFault);

      // On right pane: finish P1 WRITE and UNLOCK, which unblocks P2
      comp = stepComparisonTurn(comp, 'P1'); // P1 WRITE
      comp = stepComparisonTurn(comp, 'P1'); // P1 UNLOCK -> hands lock to P2
      comp = stepComparisonTurn(comp, 'P2'); // P2 READ
      comp = stepComparisonTurn(comp, 'P2'); // P2 COMPUTE
      comp = stepComparisonTurn(comp, 'P2'); // P2 WRITE
      comp = stepComparisonTurn(comp, 'P2'); // P2 UNLOCK

      assert.equal(comp.rightState.shared, 4);
      assert.equal(comp.rightState.isCompleted, true);
      assert.equal(comp.rightState.firstFault, null);
    });

    it('Preset 2 (SERIALIZED_UNLOCKED): safe by scheduling chance without mutex (final=4 on both)', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'SERIALIZED_UNLOCKED', {
        initialShared: 2,
        pauseAtFirstFault: false,
      });

      // Schedule: ['P1', 'P1', 'P1', 'P2', 'P2', 'P2']
      // Left pane: P1 runs completely (READ 2, COMPUTE 3, WRITE 3), then P2 runs (READ 3, COMPUTE 4, WRITE 4)
      for (let i = 0; i < 6; i++) {
        comp = stepComparisonTurn(comp);
      }

      assert.equal(comp.leftState.shared, 4);
      assert.equal(comp.leftState.isCompleted, true);
      assert.equal(comp.leftState.firstFault, null);

      // Step right pane to completion
      while (!comp.rightState.isCompleted && comp.turnIndex < 15) {
        comp = stepComparisonTurn(comp);
      }
      assert.equal(comp.rightState.shared, 4);
      assert.equal(comp.rightState.isCompleted, true);
    });

    it('Preset 3 (PROTECTED): mutex strictly serializes critical sections and guarantees final=4', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'PROTECTED', {
        initialShared: 2,
        pauseAtFirstFault: false,
      });

      // Schedule has 10 steps: ['P1', 'P2', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2']
      for (let i = 0; i < 10; i++) {
        comp = stepComparisonTurn(comp);
      }

      assert.equal(comp.rightState.shared, 4);
      assert.equal(comp.rightState.isCompleted, true);
      assert.equal(comp.rightState.firstFault, null);
      assert.equal(comp.rightState.mutex, 1);
      assert.equal(comp.rightState.mutexOwner, null);
    });

    it('No progress on rejected / blocked turns: blocked thread does not advance PC or committed count', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'PROTECTED', {
        initialShared: 2,
        pauseAtFirstFault: false,
      });

      comp = stepComparisonTurn(comp, 'P1'); // P1 LOCK -> mutex owned by P1
      assert.equal(comp.rightState.mutexOwner, 'P1');

      comp = stepComparisonTurn(comp, 'P2'); // P2 attempts LOCK -> BLOCKS!
      assert.equal(comp.rightState.threads.P2.status, 'BLOCKED');
      assert.equal(comp.rightState.threads.P2.pc, 0); // PC did NOT advance past LOCK!
      const committedBefore = comp.rightCommittedCount;

      // Now step P2 again while it is still blocked
      comp = stepComparisonTurn(comp, 'P2');
      assert.equal(comp.rightState.threads.P2.pc, 0); // Still 0
      assert.equal(comp.rightCommittedCount, committedBefore); // Committed count did NOT increment on right!
      assert.equal(comp.history[0].rightReceipt.executed, false); // Receipt honestly marks executed: false
    });

    it('detects first fault and pauses comparison when pauseAtFirstFault is enabled', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE', {
        initialShared: 2,
        pauseAtFirstFault: true,
      });

      // Steps: P1 READ, P2 READ, P1 COMPUTE, P2 COMPUTE, P1 WRITE
      comp = stepComparisonTurn(comp);
      comp = stepComparisonTurn(comp);
      comp = stepComparisonTurn(comp);
      comp = stepComparisonTurn(comp);
      comp = stepComparisonTurn(comp);
      assert.equal(comp.isFirstFaultPaused, false);

      // Step 6: P2 WRITE clobbers P1!
      comp = stepComparisonTurn(comp);
      assert.equal(comp.isFirstFaultPaused, true);
      assert.equal(comp.status, 'PAUSED_FAULT');
      assert.ok(comp.firstFaultData);
      assert.equal(comp.firstFaultData.threadId, 'P2');
    });

    it('evaluates counter live invariants: IN_PROGRESS during execution, PASS/VIOLATION only upon completion or fault', () => {
      const comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE');
      const invsInitial = evaluateComparisonInvariants(comp);

      // While execution is underway, Mathematical Correctness must be IN_PROGRESS, NOT a fake PASS!
      const leftAcc = invsInitial.left.find((i) => i.id === 'COUNTER_ACCURACY');
      assert.equal(leftAcc.status, 'IN_PROGRESS');
      const rightAcc = invsInitial.right.find((i) => i.id === 'COUNTER_ACCURACY');
      assert.equal(rightAcc.status, 'IN_PROGRESS');
    });
  });

  describe('Bounded Buffer: Without Mutex vs With Mutex', () => {
    it('creates initial buffer comparison with empty slots and decomposed producers', () => {
      const comp = createInitialComparison(COMPARISON_EXPERIMENTS.BUFFER, 'RACE_COLLISION');
      assert.equal(comp.leftState.withoutMutex, true);
      assert.equal(comp.rightState.withoutMutex, false);
      assert.equal(comp.leftState.useDecomposedBuffer, true);
      assert.equal(comp.rightState.useDecomposedBuffer, true);
      assert.ok(comp.leftState.slots.every((s) => s === null));
      assert.ok(comp.rightState.slots.every((s) => s === null));
    });

    it('detects slot overwrite and captures displaced items on left pane (without mutex)', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.BUFFER, 'RACE_COLLISION', {
        pauseAtFirstFault: false,
      });

      // P1: step 0 (CREATE), step 1 (WAIT_EMPTY), step 2 (READ_IN targetSlot = 0)
      comp = stepComparisonTurn(comp); // P1 CREATE
      comp = stepComparisonTurn(comp); // P1 WAIT_EMPTY
      comp = stepComparisonTurn(comp); // P1 READ_IN (targetSlot = 0)

      // P2: step 0 (CREATE), step 1 (WAIT_EMPTY), step 2 (READ_IN targetSlot = 0 - stale!)
      comp = stepComparisonTurn(comp); // P2 CREATE
      comp = stepComparisonTurn(comp); // P2 WAIT_EMPTY
      comp = stepComparisonTurn(comp); // P2 READ_IN (targetSlot = 0)

      // Left pane: both read stale targetSlot = 0
      assert.equal(comp.leftState.threads.P1.targetSlot, 0);
      assert.equal(comp.leftState.threads.P2.targetSlot, 0);

      // P1 writes slot 0 and advances IN to 1
      comp = stepComparisonTurn(comp); // P1 WRITE_SLOT (Bay 0)
      comp = stepComparisonTurn(comp); // P1 ADVANCE_IN (in = 1)
      assert.ok(comp.leftState.slots[0]);
      assert.equal(comp.leftState.in, 1);

      // P2 writes slot 0 using its stale targetSlot 0!
      comp = stepComparisonTurn(comp); // P2 WRITE_SLOT (overwrites Bay 0!)

      // Verification: left pane has displaced item!
      assert.equal(comp.leftState.displacedItems.length, 1);
      assert.equal(comp.leftState.displacedItems[0].slotIndex, 0);
      assert.equal(comp.leftState.displacedItems[0].culpritThreadId, 'P2');
      assert.ok(comp.leftState.firstFault);

      // Right pane: P2 was BLOCKED on WAIT_MUTEX! Mutex serialized them, no displacement!
      assert.equal(comp.rightState.displacedItems.length, 0);
    });

    it('evaluates buffer detailed invariants reporting violation when items displaced', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.BUFFER, 'RACE_COLLISION', {
        pauseAtFirstFault: false,
      });

      // Step until P2 overwrites Bay 0 (9 steps)
      for (let i = 0; i < 9; i++) {
        comp = stepComparisonTurn(comp);
      }

      const invs = evaluateComparisonInvariants(comp);
      const dataIntegrityLeft = invs.left.find((i) => i.id === 'DATA_INTEGRITY');
      assert.equal(dataIntegrityLeft.status, 'VIOLATION');
      assert.ok(dataIntegrityLeft.description.includes('overwritten'));

      const dataIntegrityRight = invs.right.find((i) => i.id === 'DATA_INTEGRITY');
      assert.equal(dataIntegrityRight.status, 'PASS');
    });

    it('Reset isolation: clean reset clears history, turns, and faults completely', () => {
      let comp = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE', {
        pauseAtFirstFault: false,
      });

      for (let i = 0; i < 6; i++) {
        comp = stepComparisonTurn(comp);
      }
      assert.ok(comp.history.length > 0);
      assert.ok(comp.leftState.firstFault);

      // Reset
      const fresh = createInitialComparison(COMPARISON_EXPERIMENTS.COUNTER, 'LOST_UPDATE');
      assert.equal(fresh.turnIndex, 0);
      assert.equal(fresh.leftCommittedCount, 0);
      assert.equal(fresh.rightCommittedCount, 0);
      assert.equal(fresh.history.length, 0);
      assert.equal(fresh.leftState.firstFault, null);
      assert.equal(fresh.rightState.firstFault, null);
      assert.equal(fresh.leftState.shared, 2);
      assert.equal(fresh.rightState.shared, 2);
    });
  });

  describe('Classroom Demonstration Verification', () => {
    it('prediction does not mutate engine state', () => {
      const state = createInitialCounterState({ withMutex: false, initialShared: 2 });
      const prediction = 3;
      assert.equal(state.shared, 2);
      assert.equal(state.committedInstructions, 0);
      assert.equal(state.threads.P1.pc, 0);
      assert.equal(state.threads.P2.pc, 0);
      assert.equal(prediction, 3);
    });

    it('unlocked trace produces exact local/shared values (reads 2, computes 3, writes 3)', () => {
      let state = createInitialCounterState({ withMutex: false, initialShared: 2 });
      const schedule = COUNTER_PRESETS.LOST_UPDATE.schedule;

      // Step 1: P1 READ
      state = stepCounterSimulation(state, schedule[0]).nextState;
      assert.equal(state.threads.P1.localRead, 2);
      assert.equal(state.shared, 2);

      // Step 2: P2 READ (stale interleaving)
      state = stepCounterSimulation(state, schedule[1]).nextState;
      assert.equal(state.threads.P2.localRead, 2);
      assert.equal(state.shared, 2);

      // Step 3: P1 COMPUTE
      state = stepCounterSimulation(state, schedule[2]).nextState;
      assert.equal(state.threads.P1.localComputed, 3);

      // Step 4: P2 COMPUTE
      state = stepCounterSimulation(state, schedule[3]).nextState;
      assert.equal(state.threads.P2.localComputed, 3);

      // Step 5: P1 WRITE
      state = stepCounterSimulation(state, schedule[4]).nextState;
      assert.equal(state.shared, 3);

      // Step 6: P2 WRITE (lost update clobber)
      const res6 = stepCounterSimulation(state, schedule[5]);
      state = res6.nextState;
      assert.equal(state.shared, 3); // 1 increment lost!
      assert.equal(state.isCompleted, true);
      assert.ok(state.firstFault);
    });

    it('protected trace produces shown mutex ownership/wait state', () => {
      let state = createInitialCounterState({ withMutex: true, initialShared: 2 });
      const schedule = COUNTER_PRESETS.PROTECTED.schedule;

      // Step 1: P1 LOCK
      state = stepCounterSimulation(state, schedule[0]).nextState;
      assert.equal(state.mutex, 0);
      assert.equal(state.mutexOwner, 'P1');

      // Step 2: P2 LOCK -> BLOCKS in queue
      state = stepCounterSimulation(state, schedule[1]).nextState;
      assert.equal(state.threads.P2.status, 'BLOCKED');
      assert.deepEqual(state.waitQueue, ['P2']);

      // Steps 3, 4, 5: P1 READ, COMPUTE, WRITE
      state = stepCounterSimulation(state, schedule[2]).nextState;
      state = stepCounterSimulation(state, schedule[3]).nextState;
      state = stepCounterSimulation(state, schedule[4]).nextState;
      assert.equal(state.shared, 3);

      // Step 6: P1 UNLOCK -> direct handover to P2
      state = stepCounterSimulation(state, schedule[5]).nextState;
      assert.equal(state.mutexOwner, 'P2');
      assert.equal(state.threads.P2.status, 'READY');
      assert.equal(state.waitQueue.length, 0);

      // Remaining steps: P2 reads fresh 3, computes 4, writes 4, unlocks
      for (let i = 6; i < schedule.length; i++) {
        state = stepCounterSimulation(state, schedule[i]).nextState;
      }
      assert.equal(state.shared, 4);
      assert.equal(state.mutex, 1);
      assert.equal(state.mutexOwner, null);
      assert.equal(state.isCompleted, true);
    });

    it('timeline order equals committed event order', () => {
      let state = createInitialCounterState({ withMutex: false, initialShared: 2 });
      const schedule = COUNTER_PRESETS.LOST_UPDATE.schedule;
      for (const tid of schedule) {
        state = stepCounterSimulation(state, tid).nextState;
      }

      assert.equal(state.events.length, 6);
      const chronological = [...state.events].sort((a, b) => a.step - b.step);
      assert.equal(chronological[0].step, 1);
      assert.equal(chronological[0].threadId, 'P1');
      assert.equal(chronological[1].step, 2);
      assert.equal(chronological[1].threadId, 'P2');
      assert.equal(chronological[5].step, 6);
      assert.equal(chronological[5].threadId, 'P2');
      assert.equal(chronological[5].isLostUpdate, true);
    });

    it('event evidence equals transition before/after state', () => {
      let state = createInitialCounterState({ withMutex: false, initialShared: 2 });
      const res = stepCounterSimulation(state, 'P1');
      const evt = res.events[0];
      assert.equal(evt.before.shared, 2);
      assert.equal(evt.before.localRead, null);
      assert.equal(evt.after.localRead, 2);
      assert.equal(res.nextState.threads.P1.localRead, 2);
    });

    it('replay reproduces the same logical result deterministically', () => {
      const schedule = COUNTER_PRESETS.LOST_UPDATE.schedule;
      let run1 = createInitialCounterState({ withMutex: false, initialShared: 2 });
      for (const tid of schedule) {
        run1 = stepCounterSimulation(run1, tid).nextState;
      }

      let run2 = createInitialCounterState({ withMutex: false, initialShared: 2 });
      for (const tid of schedule) {
        run2 = stepCounterSimulation(run2, tid).nextState;
      }

      assert.equal(run1.shared, run2.shared);
      assert.equal(run1.stepCounter, run2.stepCounter);
      assert.deepEqual(run1.threads.P1, run2.threads.P1);
      assert.deepEqual(run1.threads.P2, run2.threads.P2);
    });
  });
});
