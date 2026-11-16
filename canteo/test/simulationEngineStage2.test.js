import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialSyncState,
  stepSimulation,
  createUnsafeScheduleState,
  createProtectedScheduleState,
  evaluateSimulationInvariants,
  THREAD_STATUS,
} from '../src/logic/syncLabEngine.js';

test('Stage 2: Explicit Unsafe Schedule (14 steps) demonstrates duplicate pickup, stranded ticket, and pointer lag', () => {
  let state = createUnsafeScheduleState();
  assert.equal(state.withoutMutex, true);
  assert.equal(state.empty, 3);
  assert.equal(state.full, 2);
  assert.equal(state.in, 2);
  assert.equal(state.out, 0);
  assert.equal(state.slots[0]?.id, 'A');
  assert.equal(state.slots[1]?.id, 'B');

  // Step 1: C1 WAIT_FULL
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.full, 1);
  assert.equal(state.threads.C1.pc, 1); // Points to READ_OUT

  // Step 2: C2 WAIT_FULL
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.full, 0);
  assert.equal(state.threads.C2.pc, 1);

  // Step 3: C1 READ_OUT
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.threads.C1.locals.outSnapshot, 0);
  assert.equal(state.threads.C1.pc, 2); // Points to READ_ITEM

  // Step 4: C2 READ_OUT
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.threads.C2.locals.outSnapshot, 0);
  assert.equal(state.threads.C2.pc, 2);

  // Step 5: C1 READ_ITEM
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.threads.C1.locals.candidateItem?.id, 'A');
  assert.equal(state.threads.C1.pc, 3); // Points to COMMIT_CLAIM

  // Step 6: C2 READ_ITEM
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.threads.C2.locals.candidateItem?.id, 'A');
  assert.equal(state.threads.C2.pc, 3);

  // Step 7: C1 COMMIT_CLAIM
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.slots[0], null); // Cleared from buffer
  assert.deepEqual(state.acceptedHistory, ['A']);
  assert.equal(state.firstFault, null);
  assert.equal(state.pauseRequested, false);

  // Step 8: C2 COMMIT_CLAIM — Genuine Duplicate Claim Fault!
  state = stepSimulation(state, 'C2', { strict: true });
  assert.ok(state.firstFault, 'Expected first fault to be recorded at step 8');
  assert.ok(
    state.firstFault.type === 'DUPLICATE_CLAIM_FAULT' || state.firstFault.type === 'DUPLICATE_PICKUP',
    'Expected DUPLICATE_CLAIM_FAULT or DUPLICATE_PICKUP'
  );
  assert.equal(state.firstFault.step, 8);
  assert.equal(state.firstFault.threadId, 'C2');
  assert.equal(state.firstFault.candidateId || state.firstFault.ticketId, 'A');
  assert.equal(state.pauseRequested, true);
  assert.deepEqual(state.acceptedHistory, ['A', 'A']);

  // Explicit continuation past step 8 (steps 9 to 14):
  // Step 9: C1 UPDATE_OUT
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.out, 1);

  // Step 10: C2 UPDATE_OUT (stale-read: sets out = (0 + 1) % 5 = 1 again!)
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.out, 1); // Stale write! OUT remains 1 instead of advancing to 2!

  // Step 11: C1 SIGNAL_EMPTY
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.empty, 4);

  // Step 12: C2 SIGNAL_EMPTY
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.empty, 5);

  // Step 13: C1 PROCESS
  state = stepSimulation(state, 'C1', { strict: true });
  assert.deepEqual(state.processedHistory, ['A']);

  // Step 14: C2 PROCESS
  state = stepSimulation(state, 'C2', { strict: true });
  assert.deepEqual(state.processedHistory, ['A', 'A']);

  // Final settled verification:
  assert.equal(state.out, 1, 'OUT pointer should end at 1 instead of 2 due to lost pointer update');
  assert.equal(state.slots[1]?.id, 'B', 'Ticket B must remain stranded in slot 1');
  assert.equal(state.empty, 5);
  assert.equal(state.full, 0);

  // Invariant verification shows duplicate pickup and permit drift warning
  const inv = evaluateSimulationInvariants(state);
  assert.equal(inv.isValid, false);
  const dup = inv.violations.find((v) => v.type === 'DUPLICATE_PICKUP');
  assert.ok(dup, 'DUPLICATE_PICKUP violation should be reported');
});

test('Stage 2: Explicit Protected Schedule (18 steps) preserves safety, serialization, and correct handoff', () => {
  let state = createProtectedScheduleState();
  assert.equal(state.withoutMutex, false);
  assert.equal(state.mutex, 1);
  assert.equal(state.mutexOwner, null);

  // Steps 1-3: C1 & C2 WAIT_FULL, C1 LOCK
  state = stepSimulation(state, 'C1', { strict: true }); // Step 1: C1 WAIT_FULL
  state = stepSimulation(state, 'C2', { strict: true }); // Step 2: C2 WAIT_FULL
  state = stepSimulation(state, 'C1', { strict: true }); // Step 3: C1 LOCK
  assert.equal(state.mutex, 0);
  assert.equal(state.mutexOwner, 'C1');

  // Step 4: C2 LOCK — becomes BLOCKED!
  state = stepSimulation(state, 'C2', { strict: true });
  assert.equal(state.threads.C2.status, THREAD_STATUS.BLOCKED);
  assert.equal(state.threads.C2.waitingReason, 'mutex');
  assert.equal(state.threads.C2.pc, 1); // Does NOT advance past LOCK!
  assert.deepEqual(state.waitQueues.mutex, ['C2']);

  // Steps 5-8: C1 critical section
  state = stepSimulation(state, 'C1', { strict: true }); // Step 5: READ_OUT (reads 0)
  state = stepSimulation(state, 'C1', { strict: true }); // Step 6: READ_ITEM (reads A)
  state = stepSimulation(state, 'C1', { strict: true }); // Step 7: COMMIT_CLAIM (claims A)
  state = stepSimulation(state, 'C1', { strict: true }); // Step 8: UPDATE_OUT (sets OUT = 1)
  assert.equal(state.out, 1);

  // Step 9: C1 UNLOCK — hands ownership to C2
  state = stepSimulation(state, 'C1', { strict: true });
  assert.equal(state.mutexOwner, 'C2', 'Ownership must be handed directly to waiting thread C2');
  assert.equal(state.threads.C2.status, THREAD_STATUS.READY);
  assert.equal(state.threads.C2.waitingReason, null);
  assert.equal(state.threads.C2.pc, 2, 'C2 PC must advance past LOCK to READ_OUT');
  assert.deepEqual(state.waitQueues.mutex, []);

  // Steps 10-14: C2 critical section
  state = stepSimulation(state, 'C2', { strict: true }); // Step 10: READ_OUT (reads updated OUT = 1)
  assert.equal(state.threads.C2.locals.outSnapshot, 1);
  state = stepSimulation(state, 'C2', { strict: true }); // Step 11: READ_ITEM (reads ticket B)
  assert.equal(state.threads.C2.locals.candidateItem?.id, 'B');
  state = stepSimulation(state, 'C2', { strict: true }); // Step 12: COMMIT_CLAIM (claims B)
  state = stepSimulation(state, 'C2', { strict: true }); // Step 13: UPDATE_OUT (sets OUT = 2)
  assert.equal(state.out, 2);
  state = stepSimulation(state, 'C2', { strict: true }); // Step 14: UNLOCK (releases lock)
  assert.equal(state.mutex, 1);
  assert.equal(state.mutexOwner, null);

  // Steps 15-18: Signals and processing
  state = stepSimulation(state, 'C1', { strict: true }); // Step 15: C1 SIGNAL_EMPTY
  state = stepSimulation(state, 'C2', { strict: true }); // Step 16: C2 SIGNAL_EMPTY
  state = stepSimulation(state, 'C1', { strict: true }); // Step 17: C1 PROCESS
  state = stepSimulation(state, 'C2', { strict: true }); // Step 18: C2 PROCESS

  // Final settled verification:
  assert.deepEqual(state.acceptedHistory, ['A', 'B']);
  assert.deepEqual(state.processedHistory, ['A', 'B']);
  assert.equal(state.out, 2);
  assert.equal(state.empty, 5);
  assert.equal(state.full, 0);
  assert.equal(state.slots.every((s) => s === null), true);
  assert.equal(state.firstFault, null);

  const inv = evaluateSimulationInvariants(state);
  assert.equal(inv.isValid, true);
  assert.equal(inv.violations.length, 0);
});

test('Stage 2: FIFO handoff with two waiters', () => {
  let state = createInitialSyncState();

  // P1 acquires mutex
  state = stepSimulation(state, 'P1'); // CREATE
  state = stepSimulation(state, 'P1'); // WAIT_EMPTY
  state = stepSimulation(state, 'P1'); // LOCK -> P1 owns mutex
  assert.equal(state.mutexOwner, 'P1');

  // P2 attempts LOCK -> blocks (queue: ['P2'])
  state = stepSimulation(state, 'P2'); // CREATE
  state = stepSimulation(state, 'P2'); // WAIT_EMPTY
  state = stepSimulation(state, 'P2'); // LOCK -> blocks
  assert.deepEqual(state.waitQueues.mutex, ['P2']);

  // C1 attempts LOCK -> blocks (queue: ['P2', 'C1'])
  state.full = 1; // permit available so C1 passes wait_full
  state = stepSimulation(state, 'C1'); // WAIT_FULL
  state = stepSimulation(state, 'C1'); // LOCK -> blocks
  assert.deepEqual(state.waitQueues.mutex, ['P2', 'C1']);

  // P1 completes critical section and executes UNLOCK
  state = stepSimulation(state, 'P1'); // WRITE_SLOT
  state = stepSimulation(state, 'P1'); // UPDATE_IN
  state = stepSimulation(state, 'P1'); // UNLOCK

  // FIFO order: P2 was first in queue, so P2 gets ownership!
  assert.equal(state.mutexOwner, 'P2');
  assert.deepEqual(state.waitQueues.mutex, ['C1']);
  assert.equal(state.threads.P2.status, THREAD_STATUS.READY);
  assert.equal(state.threads.C1.status, THREAD_STATUS.BLOCKED);
});

test('Stage 2: Owner-only mutex release throws error when non-owner unlocks', () => {
  let state = createInitialSyncState({ useDecomposedBuffer: true });
  state = stepSimulation(state, 'P1'); // CREATE
  state = stepSimulation(state, 'P1'); // WAIT_EMPTY
  state = stepSimulation(state, 'P1'); // LOCK -> P1 owns mutex
  assert.equal(state.mutexOwner, 'P1');

  // P2 attempts UNLOCK -> must throw!
  assert.throws(() => {
    state.threads.P2.pc = 6; // pointing to UNLOCK in decomposed producer
    stepSimulation(state, 'P2');
  }, /attempted to unlock mutex but does not own it/);
});

test('Stage 2: Full queue blocks producer and unblocks on consumer take without double acquisition', () => {
  let state = createInitialSyncState({ capacity: 5, useDecomposedBuffer: true, useDecomposedConsumer: true });
  // Pre-fill 5 slots
  for (let i = 0; i < 5; i++) {
    state.slots[i] = { id: `ITEM-${i}` };
  }
  state.occupancy = 5;
  state.empty = 0;
  state.full = 5;
  state.in = 0;

  // P1 creates item and executes WAIT_EMPTY -> blocks!
  state = stepSimulation(state, 'P1'); // CREATE
  state = stepSimulation(state, 'P1'); // WAIT_EMPTY -> blocks
  assert.equal(state.threads.P1.status, THREAD_STATUS.BLOCKED);
  assert.equal(state.threads.P1.pc, 1); // PC does not advance
  assert.deepEqual(state.waitQueues.empty, ['P1']);

  // C1 consumes 1 item and signals empty
  state = stepSimulation(state, 'C1'); // WAIT_FULL
  state = stepSimulation(state, 'C1'); // LOCK
  state = stepSimulation(state, 'C1'); // READ_OUT
  state = stepSimulation(state, 'C1'); // READ_ITEM
  state = stepSimulation(state, 'C1'); // COMMIT_CLAIM
  state = stepSimulation(state, 'C1'); // UPDATE_OUT
  state = stepSimulation(state, 'C1'); // UNLOCK
  state = stepSimulation(state, 'C1'); // SIGNAL_EMPTY -> wakes P1 directly!

  assert.equal(state.threads.P1.status, THREAD_STATUS.READY);
  assert.equal(state.threads.P1.waitingReason, null);
  assert.equal(state.threads.P1.pc, 2); // Advanced past WAIT_EMPTY!
  assert.deepEqual(state.waitQueues.empty, []);

  // P1 now proceeds through LOCK and WRITE_SLOT without re-waiting
  state = stepSimulation(state, 'P1'); // LOCK
  assert.equal(state.mutexOwner, 'P1');
  state = stepSimulation(state, 'P1'); // READ_IN
  state = stepSimulation(state, 'P1'); // WRITE_SLOT
  assert.ok(state.slots[0]);
});

test('Stage 2: Empty queue blocks consumer and unblocks on producer publication', () => {
  let state = createInitialSyncState({ capacity: 5, useDecomposedBuffer: true, useDecomposedConsumer: true });
  state.empty = 5;
  state.full = 0;

  // C1 executes WAIT_FULL -> blocks!
  state = stepSimulation(state, 'C1');
  assert.equal(state.threads.C1.status, THREAD_STATUS.BLOCKED);
  assert.equal(state.threads.C1.waitingReason, 'full');
  assert.equal(state.threads.C1.pc, 0); // PC does not advance
  assert.deepEqual(state.waitQueues.full, ['C1']);

  // P1 produces 1 item and signals full
  for (let i = 0; i < 8; i++) {
    state = stepSimulation(state, 'P1');
  }

  // C1 was directly handed the permit and unblocked
  assert.equal(state.threads.C1.status, THREAD_STATUS.READY);
  assert.equal(state.threads.C1.waitingReason, null);
  assert.equal(state.threads.C1.pc, 1); // Advanced past WAIT_FULL!
  assert.deepEqual(state.waitQueues.full, []);
});

test('Stage 2: Circular wraparound from slot 4 to slot 0', () => {
  let state = createInitialSyncState({ capacity: 5, useDecomposedConsumer: true });
  state.in = 4;
  state.out = 4;
  state.slots[4] = { id: 'WRAP-4' };
  state.occupancy = 1;
  state.empty = 4;
  state.full = 1;

  // C1 consumes from slot 4
  state = stepSimulation(state, 'C1'); // WAIT_FULL
  state = stepSimulation(state, 'C1'); // LOCK
  state = stepSimulation(state, 'C1'); // READ_OUT
  state = stepSimulation(state, 'C1'); // READ_ITEM
  state = stepSimulation(state, 'C1'); // COMMIT_CLAIM
  state = stepSimulation(state, 'C1'); // UPDATE_OUT -> wraps to 0!
  assert.equal(state.out, 0, '(4 + 1) % 5 must equal 0');
});
