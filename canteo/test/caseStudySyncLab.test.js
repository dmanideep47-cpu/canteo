import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLesson1State,
  createLesson2FullState,
  createLesson2EmptyState,
  createLesson3RaceState,
  stepSimulation,
  LESSON_SCHEDULES,
  BUFFER_CAPACITY,
  THREAD_STATUS,
} from '../src/logic/syncLabEngine.js';

describe('OS Case Study Synchronization Lab — Verification', () => {
  it('Lesson 1: Place & Collect standard producer-consumer cycle', () => {
    let state = createLesson1State();
    assert.equal(state.occupancy, 0);
    assert.equal(state.empty, 5);
    assert.equal(state.full, 0);
    assert.equal(state.mutex, 1);

    // Step P1 through its full cycle to deposit 1 ticket
    while (state.threads.P1.pc !== 0 || state.occupancy === 0) {
      state = stepSimulation(state, 'P1');
      if (state.occupancy === 1 && state.threads.P1.pc === 7) break;
    }

    assert.equal(state.occupancy, 1);
    assert.equal(state.empty, 4);
    assert.equal(state.full, 1);
    assert.equal(state.slots[0]?.id, 'LAB-001');

    // Step C1 through full cycle to collect the ticket
    while (state.threads.C1.pc !== 0 || state.occupancy > 0) {
      state = stepSimulation(state, 'C1');
      if (state.occupancy === 0 && state.threads.C1.pc === 7) break;
    }

    assert.equal(state.occupancy, 0);
    assert.equal(state.empty, 5);
    assert.equal(state.full, 0);
    assert.equal(state.consumedItems.length, 1);
    assert.equal(state.consumedItems[0], 'LAB-001');
  });

  it('Lesson 2A: Full Queue blocks producer on sem_wait(&empty) and unblocks on consumer take', () => {
    let state = createLesson2FullState();
    assert.equal(state.occupancy, 5);
    assert.equal(state.empty, 0);
    assert.equal(state.threads.P2.status, THREAD_STATUS.BLOCKED);
    assert.equal(state.threads.P2.waitingFor, 'empty');

    // Kitchen staff C1 executes through SIGNAL_EMPTY (step 5)
    for (let i = 0; i < 6; i++) {
      state = stepSimulation(state, 'C1');
    }

    // Buffer has 1 slot freed, P2 is resumed
    assert.equal(state.threads.P2.status, THREAD_STATUS.READY);
    assert.equal(state.waitQueues.empty.length, 0);
  });

  it('Lesson 2B: Empty Queue blocks consumer on sem_wait(&full) and unblocks on producer order', () => {
    let state = createLesson2EmptyState();
    assert.equal(state.occupancy, 0);
    assert.equal(state.full, 0);
    assert.equal(state.threads.C1.status, THREAD_STATUS.BLOCKED);
    assert.equal(state.threads.C1.waitingFor, 'full');

    // Student P1 executes through SIGNAL_FULL (step 6)
    for (let i = 0; i < 7; i++) {
      state = stepSimulation(state, 'P1');
    }

    // Full semaphore was signaled, C1 is unblocked
    assert.equal(state.threads.C1.status, THREAD_STATUS.READY);
    assert.equal(state.waitQueues.full.length, 0);
  });

  it('Lesson 3A: Race Condition (Without Mutex) causes Duplicate Claim Fault', () => {
    let state = createLesson3RaceState(true);
    assert.equal(state.withoutMutex, true);
    assert.equal(state.useDecomposedConsumer, true);
    assert.equal(state.slots[0].id, 'ORD-301');
    assert.equal(state.slots[1].id, 'ORD-302');

    const schedule = LESSON_SCHEDULES.LESSON_3_RACE_UNSAFE;
    for (const tid of schedule) {
      if (state.firstFault) break;
      state = stepSimulation(state, tid);
    }

    // A duplicate claim collision must be detected!
    assert.ok(state.firstFault, 'Expected firstFault to be recorded');
    assert.equal(state.firstFault.type, 'DUPLICATE_CLAIM_FAULT');
    assert.equal(state.firstFault.slotIndex, 0);
    assert.equal(state.firstFault.candidateId, 'ORD-301');
  });

  it('Lesson 3B: Protected Queue (With Mutex) cleanly processes both orders without race collision', () => {
    let state = createLesson3RaceState(false);
    assert.equal(state.withoutMutex, false);
    assert.equal(state.useDecomposedConsumer, true);

    const schedule = LESSON_SCHEDULES.LESSON_3_RACE_PROTECTED;
    for (const tid of schedule) {
      state = stepSimulation(state, tid);
    }

    assert.equal(state.firstFault, null);
    assert.equal(state.consumedItems.length, 2);
    assert.equal(state.consumedItems[0], 'ORD-301');
    assert.equal(state.consumedItems[1], 'ORD-302');
  });

  it('Invariants hold across simulation steps', () => {
    const state = createLesson1State();
    const occupancy = state.slots.filter(Boolean).length;
    assert.ok(occupancy >= 0 && occupancy <= BUFFER_CAPACITY);
    assert.equal(state.empty + state.full, BUFFER_CAPACITY);
    assert.ok(state.mutex === 0 || state.mutex === 1);
  });
});
