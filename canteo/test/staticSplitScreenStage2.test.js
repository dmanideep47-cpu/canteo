import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticSplitScreenStates, LESSON_CONFIGS } from '../src/logic/syncLabEngine.js';

test('Stage 2 Static Split-Screen: State Isolation and Invariants', async (t) => {
  await t.test('1. returns independent leftState and rightState objects', () => {
    const { leftState, rightState } = createStaticSplitScreenStates();

    assert.ok(leftState, 'leftState should exist');
    assert.ok(rightState, 'rightState should exist');
    assert.notStrictEqual(leftState, rightState, 'leftState and rightState must be distinct objects');
    assert.notStrictEqual(leftState.slots, rightState.slots, 'slots arrays must be distinct');
    assert.notStrictEqual(leftState.semaphores, rightState.semaphores, 'semaphores objects must be distinct');
    assert.notStrictEqual(leftState.threads, rightState.threads, 'threads collections must be distinct');
  });

  await t.test('2. both sides share identical initial buffer state and semaphores', () => {
    const { leftState, rightState } = createStaticSplitScreenStates();

    // Capacity N = 5
    assert.strictEqual(leftState.slots.length, 5);
    assert.strictEqual(rightState.slots.length, 5);

    // Initial buffer: Order A in slot 0, Order B in slot 1, rest empty
    assert.strictEqual(leftState.slots[0].id, 'A');
    assert.strictEqual(leftState.slots[1].id, 'B');
    assert.strictEqual(leftState.slots[2], null);
    assert.strictEqual(leftState.slots[3], null);
    assert.strictEqual(leftState.slots[4], null);

    assert.strictEqual(rightState.slots[0].id, 'A');
    assert.strictEqual(rightState.slots[1].id, 'B');
    assert.strictEqual(rightState.slots[2], null);
    assert.strictEqual(rightState.slots[3], null);
    assert.strictEqual(rightState.slots[4], null);

    // Pointers: IN = 2, OUT = 0
    assert.strictEqual(leftState.in, 2);
    assert.strictEqual(leftState.out, 0);
    assert.strictEqual(rightState.in, 2);
    assert.strictEqual(rightState.out, 0);

    // Semaphores: empty = 3, full = 2 (checked both on top-level and semaphores object)
    assert.strictEqual(leftState.empty, 3);
    assert.strictEqual(leftState.full, 2);
    assert.strictEqual(rightState.empty, 3);
    assert.strictEqual(rightState.full, 2);

    assert.strictEqual(leftState.semaphores.empty.value, 3);
    assert.strictEqual(leftState.semaphores.full.value, 2);
    assert.strictEqual(rightState.semaphores.empty.value, 3);
    assert.strictEqual(rightState.semaphores.full.value, 2);
  });

  await t.test('3. distinct mutex configuration between left (without mutex) and right (with mutex)', () => {
    const { leftState, rightState } = createStaticSplitScreenStates();

    // Left pane: Without Queue Mutex
    assert.strictEqual(leftState.withoutMutex, true);
    assert.strictEqual(leftState.mutexOwner, null);

    // Right pane: With Queue Mutex (available, owner null)
    assert.strictEqual(rightState.withoutMutex, false);
    const rightMutexVal = typeof rightState.mutex === 'object' ? rightState.mutex.value : rightState.mutex;
    assert.strictEqual(rightMutexVal, 1);
    assert.strictEqual(rightState.mutexOwner, null);
  });

  await t.test('4. deep isolation: mutations on leftState do not pollute rightState', () => {
    const { leftState, rightState } = createStaticSplitScreenStates();

    leftState.slots[0] = { id: 'MUTATED' };
    leftState.in = 4;
    leftState.semaphores.empty.value = 1;

    assert.strictEqual(rightState.slots[0].id, 'A');
    assert.strictEqual(rightState.in, 2);
    assert.strictEqual(rightState.semaphores.empty.value, 3);
  });

  await t.test('5. LESSON_3_SPLIT_COMPARISON is registered in LESSON_CONFIGS', () => {
    const config = LESSON_CONFIGS.LESSON_3_SPLIT_COMPARISON;
    assert.ok(config, 'LESSON_3_SPLIT_COMPARISON must be defined in LESSON_CONFIGS');
    assert.strictEqual(config.id, 'LESSON_3_SPLIT_COMPARISON');
    assert.ok(config.title.includes('Comparison'));
  });
});
