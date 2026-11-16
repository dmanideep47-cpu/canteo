import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFullQueueState,
  FULL_QUEUE_SCHEDULE,
  createEmptyQueueState,
  EMPTY_QUEUE_SCHEDULE,
  createNormalFlowState,
  NORMAL_FLOW_SCHEDULE,
  stepSimulation,
  getStructuredTeachingExplanation,
  THREAD_STATUS,
} from '../src/logic/syncLabEngine.js';

describe('Stage 3: Full Queue Scenario Verification', () => {
  it('1. Full Queue baseline is correctly initialized with 5 distinct preloaded tickets and empty=0', () => {
    const state = createFullQueueState();
    assert.equal(state.occupancy, 5);
    assert.equal(state.empty, 0);
    assert.equal(state.full, 5);
    assert.equal(state.mutex, 1);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.in, 0);
    assert.equal(state.out, 0);
    assert.equal(state.slots.length, 5);
    // All 5 slots must be occupied by distinct tickets
    const ids = state.slots.map((s) => s?.id);
    assert.equal(new Set(ids).size, 5);
    assert.equal(state.requestBacklog.length, 1);
    assert.equal(state.requestBacklog[0].id, 'ORD-6');
    assert.equal(state.setupNote, 'Five existing tickets are preloaded for this lesson.');
    assert.equal(state.events.length, 0, 'No fabricated events in initial baseline');
  });

  it('2. Producer P1 prepares extra ticket ORD-6 and blocks on sem_wait(&empty) without entering buffer', () => {
    let state = createFullQueueState();

    // Step 0: P1 CREATE_ITEM
    state = stepSimulation(state, 'P1', { strict: true });
    assert.equal(state.threads.P1.status, THREAD_STATUS.READY);
    assert.equal(state.threads.P1.pc, 1);
    assert.equal(state.threads.P1.localItem?.id, 'ORD-6');
    assert.equal(state.occupancy, 5);
    assert.equal(state.slots.length, 5);

    // Step 1: P1 WAIT_EMPTY
    state = stepSimulation(state, 'P1', { strict: true });
    assert.equal(state.threads.P1.status, THREAD_STATUS.BLOCKED);
    assert.equal(state.threads.P1.waitingFor, 'empty');
    assert.equal(state.threads.P1.pc, 1, 'PC remains halted at the incomplete wait');
    assert.deepEqual(state.waitQueues.empty, ['P1'], 'P1 enters empty wait queue');
    assert.equal(state.threads.P1.localItem?.id, 'ORD-6', 'Ticket ORD-6 remains outside buffer on student tablet');
    assert.equal(state.occupancy, 5);
    assert.equal(state.slots.length, 5, 'No sixth slot created');
    assert.equal(state.slots.every((s) => s.id !== 'ORD-6'), true, 'ORD-6 has not overwritten any occupied slot');

    // What/Why explanation agreement
    const expl = getStructuredTeachingExplanation(state, state.events[0]);
    assert.match(expl.what, /P1 tried to reserve capacity, but empty is 0/);
    assert.match(expl.why, /The five-slot buffer has no available capacity permit/);
  });

  it('3. Ticket removal and capacity release remain distinct (removal occurs under mutex, release occurs after)', () => {
    let state = createFullQueueState();
    // Step 0-1: P1 prepares ORD-6 and blocks
    state = stepSimulation(state, 'P1', { strict: true });
    state = stepSimulation(state, 'P1', { strict: true });

    // Step 2-5: C1 WAIT_FULL -> LOCK -> READ_OUT -> READ_ITEM
    state = stepSimulation(state, 'C1', { strict: true }); // WAIT_FULL
    state = stepSimulation(state, 'C1', { strict: true }); // LOCK
    state = stepSimulation(state, 'C1', { strict: true }); // READ_OUT
    state = stepSimulation(state, 'C1', { strict: true }); // READ_ITEM

    // Step 6: C1 COMMIT_CLAIM (ticket ORD-1 removed from slot 0)
    state = stepSimulation(state, 'C1', { strict: true });
    assert.equal(state.slots[0], null, 'Slot 0 is physically cleared on counter');
    assert.equal(state.occupancy, 4);
    assert.equal(state.empty, 0, 'Capacity permit empty is NOT yet released (still 0 while under mutex)');
    assert.equal(state.threads.P1.status, THREAD_STATUS.BLOCKED, 'P1 is still blocked');

    // Step 7-8: C1 UPDATE_OUT -> UNLOCK
    state = stepSimulation(state, 'C1', { strict: true });
    state = stepSimulation(state, 'C1', { strict: true });
    assert.equal(state.out, 1);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.empty, 0);
    assert.equal(state.threads.P1.status, THREAD_STATUS.BLOCKED, 'P1 is still blocked until SIGNAL_EMPTY');

    // Step 9: C1 SIGNAL_EMPTY
    state = stepSimulation(state, 'C1', { strict: true });
    assert.equal(state.threads.P1.status, THREAD_STATUS.READY, 'P1 is now woken');
    assert.equal(state.threads.P1.pc, 2, 'P1 PC advances from wait(1) to lock(2)');
    assert.equal(state.waitQueues.empty.length, 0);
    assert.equal(state.slots[0], null, 'Wake does NOT insert ticket: slot 0 remains empty');
    assert.equal(state.threads.P1.localItem?.id, 'ORD-6', 'Ticket ORD-6 still on P1 station');

    const wakeExpl = getStructuredTeachingExplanation(state, state.events[0]);
    assert.match(wakeExpl.what, /C1 released capacity and made P1 runnable/);
    assert.match(wakeExpl.why, /The waiting producer has received a permit.*has not inserted yet/);
  });

  it('4. Full 17-step schedule runs to completion and inserts ORD-6 cleanly into slot 0', () => {
    let state = createFullQueueState();
    for (let i = 0; i < FULL_QUEUE_SCHEDULE.length; i++) {
      const thread = FULL_QUEUE_SCHEDULE[i];
      state = stepSimulation(state, thread, { strict: true });
    }

    assert.equal(state.slots[0]?.id, 'ORD-6', 'ORD-6 inserted into slot 0');
    assert.equal(state.in, 1, 'IN advanced to 1');
    assert.equal(state.out, 1, 'OUT advanced to 1');
    assert.equal(state.occupancy, 5);
    assert.equal(state.empty, 0);
    assert.equal(state.full, 5);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.threads.P1.status, THREAD_STATUS.READY);
    assert.equal(state.threads.C1.status, THREAD_STATUS.READY);
  });
});

describe('Stage 3: Empty Queue Scenario Verification', () => {
  it('1. Empty Queue baseline is initialized with empty buffer, empty=5, full=0', () => {
    const state = createEmptyQueueState();
    assert.equal(state.occupancy, 0);
    assert.equal(state.empty, 5);
    assert.equal(state.full, 0);
    assert.equal(state.mutex, 1);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.in, 0);
    assert.equal(state.out, 0);
    assert.equal(state.slots.every((s) => s === null), true);
    assert.equal(state.requestBacklog.length, 1);
    assert.equal(state.requestBacklog[0].id, 'ORD-1');
    assert.equal(state.setupNote, 'Buffer is initially empty.');
    assert.equal(state.events.length, 0);
  });

  it('2. Consumer C1 blocks on sem_wait(&full) without claiming or locking mutex', () => {
    let state = createEmptyQueueState();

    // Step 0: C1 WAIT_FULL
    state = stepSimulation(state, 'C1', { strict: true });
    assert.equal(state.threads.C1.status, THREAD_STATUS.BLOCKED);
    assert.equal(state.threads.C1.waitingFor, 'full');
    assert.equal(state.threads.C1.pc, 0, 'PC remains halted at wait(full)');
    assert.deepEqual(state.waitQueues.full, ['C1']);
    assert.equal(state.mutex, 1, 'Mutex was never acquired by waiting consumer');
    assert.equal(state.mutexOwner, null);
    assert.equal(state.threads.C1.claimedItem, null, 'No fake accepted ticket');

    const expl = getStructuredTeachingExplanation(state, state.events[0]);
    assert.match(expl.what, /C1 tried to reserve an order, but full is 0/);
    assert.match(expl.why, /The consumer waits rather than reading an empty queue/);
  });

  it('3. Ticket insertion and publication remain distinct; publication wakes C1 without immediate removal', () => {
    let state = createEmptyQueueState();
    // Step 0: C1 blocks
    state = stepSimulation(state, 'C1', { strict: true });

    // Step 1-7: P1 produces, acquires mutex, writes slot 0, updates in, unlocks mutex
    state = stepSimulation(state, 'P1', { strict: true }); // CREATE_ITEM
    state = stepSimulation(state, 'P1', { strict: true }); // WAIT_EMPTY
    state = stepSimulation(state, 'P1', { strict: true }); // LOCK
    state = stepSimulation(state, 'P1', { strict: true }); // READ_IN
    state = stepSimulation(state, 'P1', { strict: true }); // WRITE_SLOT (slot 0 gets ORD-1)
    state = stepSimulation(state, 'P1', { strict: true }); // UPDATE_IN (in = 1)
    state = stepSimulation(state, 'P1', { strict: true }); // UNLOCK

    assert.equal(state.slots[0]?.id, 'ORD-1', 'Ticket ORD-1 is inserted in slot 0');
    assert.equal(state.threads.C1.status, THREAD_STATUS.BLOCKED, 'C1 still blocked until publication');

    // Step 8: P1 SIGNAL_FULL
    state = stepSimulation(state, 'P1', { strict: true });
    assert.equal(state.threads.C1.status, THREAD_STATUS.READY, 'C1 is woken by SIGNAL_FULL');
    assert.equal(state.threads.C1.pc, 1, 'C1 PC advances to LOCK');
    assert.equal(state.waitQueues.full.length, 0);
    assert.equal(state.slots[0]?.id, 'ORD-1', 'Wake does NOT remove ticket: ORD-1 remains in slot 0');
    assert.equal(state.threads.C1.claimedItem, null, 'C1 has not claimed ticket yet');

    const pubExpl = getStructuredTeachingExplanation(state, state.events[0]);
    assert.match(pubExpl.what, /P1 published ticket ORD-1 and made C1 runnable/);
    assert.match(pubExpl.why, /An available-item permit was transferred to the waiting consumer/);
  });

  it('4. Full 17-step schedule runs to completion and C1 processes ORD-1', () => {
    let state = createEmptyQueueState();
    for (let i = 0; i < EMPTY_QUEUE_SCHEDULE.length; i++) {
      const thread = EMPTY_QUEUE_SCHEDULE[i];
      state = stepSimulation(state, thread, { strict: true });
    }

    assert.equal(state.slots[0], null, 'Slot 0 claimed and emptied');
    assert.equal(state.in, 1, 'IN advanced to 1');
    assert.equal(state.out, 1, 'OUT advanced to 1');
    assert.equal(state.occupancy, 0);
    assert.equal(state.empty, 5);
    assert.equal(state.full, 0);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.threads.P1.status, THREAD_STATUS.READY);
    assert.equal(state.threads.C1.status, THREAD_STATUS.READY);
  });
});

describe('Stage 3: Normal Flow Regression & Invariant Accounting', () => {
  it('1. Normal Flow continues to execute all 34 steps deterministically without regression', () => {
    let state = createNormalFlowState();
    for (let i = 0; i < NORMAL_FLOW_SCHEDULE.length; i++) {
      state = stepSimulation(state, NORMAL_FLOW_SCHEDULE[i], { strict: true });
    }

    assert.equal(state.in, 2);
    assert.equal(state.out, 2);
    assert.equal(state.occupancy, 0);
    assert.equal(state.empty, 5);
    assert.equal(state.full, 0);
    assert.equal(state.mutexOwner, null);
    assert.equal(state.slots.every((s) => s === null), true);
  });

  it('2. Direct permit handoff guarantees unique wait queue membership and prevents double-enqueue', () => {
    let fullState = createFullQueueState();
    fullState = stepSimulation(fullState, 'P1', { strict: true }); // CREATE_ITEM
    fullState = stepSimulation(fullState, 'P1', { strict: true }); // WAIT_EMPTY -> blocks
    assert.equal(fullState.waitQueues.empty.filter((id) => id === 'P1').length, 1);

    // Stepping P1 again while blocked in strict mode is a no-op
    const noOpState = stepSimulation(fullState, 'P1', { strict: true });
    assert.equal(noOpState.waitQueues.empty.filter((id) => id === 'P1').length, 1);
  });
});

