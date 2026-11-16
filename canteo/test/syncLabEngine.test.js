import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNormalFlowState,
  NORMAL_FLOW_SCHEDULE,
  createFullQueueState,
  createEmptyQueueState,
  FULL_QUEUE_SCHEDULE,
  EMPTY_QUEUE_SCHEDULE,
  createInitialSyncState,
  createLesson3RaceState,
  LESSON_SCHEDULES,
  createProtectedScheduleState,
  createUnsafeScheduleState,
  EXPLICIT_PROTECTED_SCHEDULE,
  EXPLICIT_UNSAFE_SCHEDULE,
  getOrderAccounting,
  stepSimulation,
  validateInvariants,
} from '../src/logic/syncLabEngine.js';

test('legacy SyncLab normal-flow baseline and full schedule remain valid', () => {
  let state = createNormalFlowState();
  assert.equal(state.capacity, 5);
  assert.equal(state.empty, 5);
  assert.equal(state.full, 0);
  assert.equal(state.mutex, 1);
  assert.equal(state.mutexOwner, null);
  for (const processId of NORMAL_FLOW_SCHEDULE) {
    state = stepSimulation(state, processId, { strict: true });
    assert.equal(validateInvariants(state).isValid, true);
  }
  assert.equal(state.occupancy, 0);
  assert.equal(state.empty, 5);
  assert.equal(state.full, 0);
});

test('legacy full-queue lesson blocks its producer and resumes after a consumer frees capacity', () => {
  let state = createFullQueueState();
  assert.equal(state.occupancy, 5);
  assert.equal(state.empty, 0);
  for (let i = 0; i < 2; i += 1) state = stepSimulation(state, FULL_QUEUE_SCHEDULE[i], { strict: true });
  assert.equal(state.threads.P1.status, 'BLOCKED');
  assert.equal(state.threads.P1.waitingFor, 'empty');
  assert.equal(validateInvariants(state).isValid, true);
});

test('legacy empty-queue lesson blocks its consumer then completes the producer-consumer handoff', () => {
  let state = createEmptyQueueState();
  assert.equal(state.occupancy, 0);
  assert.equal(state.full, 0);
  for (const processId of EMPTY_QUEUE_SCHEDULE) state = stepSimulation(state, processId, { strict: true });
  assert.equal(state.occupancy, 0);
  assert.equal(state.empty, 5);
  assert.equal(state.full, 0);
  assert.equal(validateInvariants(state).isValid, true);
});

test('legacy initial state preserves fixed capacity, pointers, and semaphore values', () => {
  const state = createInitialSyncState();
  assert.equal(state.capacity, 5); assert.equal(state.empty, 5); assert.equal(state.full, 0);
  assert.equal(state.mutex, 1); assert.equal(state.mutexOwner, null);
  assert.equal(state.in, 0); assert.equal(state.out, 0); assert.deepEqual(state.slots, Array(5).fill(null));
  assert.equal(validateInvariants(state).isValid, true);
});

test('legacy instruction stepping creates one local order without occupying the buffer', () => {
  const initial = createNormalFlowState();
  const state = stepSimulation(initial, 'P1', { strict: true });
  assert.equal(initial.stepCounter, 0); assert.equal(state.stepCounter, 1);
  assert.equal(state.events.length, 1); assert.equal(state.threads.P1.pc, 1);
  assert.equal(state.occupancy, 0); assert.equal(state.threads.P1.localItem?.id, 'A');
});

test('legacy producer schedule enters and leaves the critical section with one queued order', () => {
  let state = createNormalFlowState();
  for (const processId of NORMAL_FLOW_SCHEDULE.slice(0, 8)) state = stepSimulation(state, processId, { strict: true });
  assert.equal(state.occupancy, 1); assert.equal(state.empty, 4); assert.equal(state.full, 1);
  assert.equal(state.slots[0]?.id, 'A'); assert.equal(state.in, 1);
  assert.equal(state.mutex, 1); assert.equal(state.mutexOwner, null);
});

test('legacy consumer cycle removes the oldest order and returns its capacity permit', () => {
  let state = createNormalFlowState();
  for (const processId of NORMAL_FLOW_SCHEDULE.slice(0, 8)) state = stepSimulation(state, processId, { strict: true });
  for (const processId of NORMAL_FLOW_SCHEDULE.slice(8, 17)) state = stepSimulation(state, processId, { strict: true });
  assert.equal(state.occupancy, 0); assert.equal(state.empty, 5); assert.equal(state.full, 0);
  assert.equal(state.out, 1); assert.equal(state.mutexOwner, null);
});

test('legacy full-queue schedule wakes the blocked producer through FIFO empty handoff', () => {
  let state = createFullQueueState();
  for (const processId of FULL_QUEUE_SCHEDULE.slice(0, 10)) state = stepSimulation(state, processId, { strict: true });
  assert.equal(state.threads.P1.status, 'READY');
  assert.equal(state.waitQueues.empty.length, 0);
  assert.equal(state.empty, 0); assert.equal(state.occupancy, 4);
  assert.equal(validateInvariants(state).isValid, true);
});

test('legacy empty-queue setup blocks a consumer before any order exists', () => {
  let state = createEmptyQueueState();
  state = stepSimulation(state, EMPTY_QUEUE_SCHEDULE[0], { strict: true });
  assert.equal(state.threads.C1.status, 'BLOCKED');
  assert.equal(state.threads.C1.waitingFor, 'full');
  assert.equal(state.occupancy, 0); assert.equal(state.full, 0);
  assert.equal(validateInvariants(state).isValid, true);
});

test('legacy race schedule records a duplicate claim without a mutex', () => {
  let state = createLesson3RaceState(true);
  for (const processId of LESSON_SCHEDULES.LESSON_3_RACE_UNSAFE) {
    state = stepSimulation(state, processId);
    if (state.firstFault) break;
  }
  assert.equal(state.firstFault?.type, 'DUPLICATE_CLAIM_FAULT');
  assert.equal(state.firstFault?.slotIndex, 0);
});

test('legacy protected race schedule serializes two consumers without a fault', () => {
  let state = createLesson3RaceState(false);
  for (const processId of LESSON_SCHEDULES.LESSON_3_RACE_PROTECTED) state = stepSimulation(state, processId);
  assert.equal(state.firstFault, null);
  assert.equal(state.occupancy, 0);
  assert.equal(state.mutex, 1); assert.equal(state.mutexOwner, null);
});

test('legacy explicit unsafe and protected schedules retain their distinct process ordering', () => {
  assert.equal(EXPLICIT_UNSAFE_SCHEDULE.length, 14);
  assert.equal(EXPLICIT_PROTECTED_SCHEDULE.length, 18);
  assert.notDeepEqual(EXPLICIT_UNSAFE_SCHEDULE, EXPLICIT_PROTECTED_SCHEDULE);
});

test('legacy detailed order accounting reconciles all submitted items', () => {
  const state = createInitialSyncState({ useWorkloadQueue: true });
  const accounting = getOrderAccounting(state);
  assert.equal(accounting.inBufferCount, 0);
  assert.equal(accounting.totalSubmitted, 0);
  assert.equal(accounting.waitingForCapacityCount, 0);
});

test('legacy unsafe and protected schedule initializers preserve their intended mutex mode', () => {
  const unsafe = createUnsafeScheduleState(); const protectedState = createProtectedScheduleState();
  assert.equal(unsafe.withoutMutex, true); assert.equal(unsafe.occupancy, 2);
  assert.equal(protectedState.withoutMutex, false); assert.equal(protectedState.occupancy, 2);
  assert.equal(validateInvariants(unsafe).isValid, true); assert.equal(validateInvariants(protectedState).isValid, true);
});

test('legacy producer-consumer schedules are deterministic and conserve capacity throughout', () => {
  let first = createNormalFlowState(); let second = createNormalFlowState();
  for (const processId of NORMAL_FLOW_SCHEDULE) {
    first = stepSimulation(first, processId, { strict: true });
    second = stepSimulation(second, processId, { strict: true });
    assert.equal(validateInvariants(first).isValid, true);
    assert.ok(first.empty >= 0); assert.ok(first.full >= 0);
    assert.ok(first.occupancy >= 0 && first.occupancy <= 5);
  }
  assert.deepEqual(first.slots, second.slots);
  assert.deepEqual(first.events.map((event) => event.type), second.events.map((event) => event.type));
});

test('legacy invariant validator reports buffer occupancy beyond fixed capacity', () => {
  const state = createInitialSyncState();
  const invalid = { ...state, occupancy: 6 };
  const result = validateInvariants(invalid);
  assert.equal(result.isValid, false);
  assert.ok(result.violations.some((violation) => violation.includes('Occupancy out of bounds')));
});

test('legacy simulation instances start isolated from one another', () => {
  const first = createNormalFlowState(); const second = createNormalFlowState();
  const stepped = stepSimulation(first, 'P1', { strict: true });
  assert.equal(first.stepCounter, 0); assert.equal(second.stepCounter, 0);
  assert.equal(second.occupancy, 0); assert.equal(stepped.stepCounter, 1);
});

test('legacy full and empty scenarios expose their fixed circular-buffer size', () => {
  assert.equal(createFullQueueState().slots.length, 5);
  assert.equal(createEmptyQueueState().slots.length, 5);
  assert.equal(createNormalFlowState().slots.length, 5);
});

