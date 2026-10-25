import test from 'node:test';
import assert from 'node:assert';
import {
  raceConditionReducer,
  INITIAL_RACE_STATE,
  RACE_DEMO_ACTIONS,
  WITHOUT_MUTEX_STEPS,
  WITH_MUTEX_STEPS,
} from '../src/logic/raceConditionReducer.js';

test('Race Demo 1: Unsynchronized execution demonstrates stale-read race condition', () => {
  let state = raceConditionReducer(INITIAL_RACE_STATE, {
    type: RACE_DEMO_ACTIONS.START_WITHOUT_MUTEX,
  });
  assert.strictEqual(state.mode, 'WITHOUT_MUTEX');
  assert.strictEqual(state.isRunning, true);

  for (let i = 0; i < WITHOUT_MUTEX_STEPS.length; i++) {
    state = raceConditionReducer(state, {
      type: RACE_DEMO_ACTIONS.STEP_WITHOUT_MUTEX,
      payload: { index: i },
    });
  }

  assert.strictEqual(state.isFinished, true);
  assert.strictEqual(state.outcomeType, 'error');
  assert.ok(state.outcomeMessage.includes('Race condition detected'));
  assert.strictEqual(state.orderState, 'READY');
});

test('Race Demo 2: Mutex serialization guarantees valid lifecycle transitions without stale clobbering', () => {
  let state = raceConditionReducer(INITIAL_RACE_STATE, {
    type: RACE_DEMO_ACTIONS.START_WITH_MUTEX,
  });
  assert.strictEqual(state.mode, 'WITH_MUTEX');
  assert.strictEqual(state.isRunning, true);

  for (let i = 0; i < WITH_MUTEX_STEPS.length; i++) {
    state = raceConditionReducer(state, {
      type: RACE_DEMO_ACTIONS.STEP_WITH_MUTEX,
      payload: { index: i },
    });
  }

  assert.strictEqual(state.isFinished, true);
  assert.strictEqual(state.outcomeType, 'success');
  assert.ok(state.outcomeMessage.includes('Mutual exclusion enforced'));
  assert.strictEqual(state.orderState, 'READY');
  assert.strictEqual(state.mutexHolder, 'None (Lock: Unlocked)');
});
