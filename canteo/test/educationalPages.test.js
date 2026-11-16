import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  INITIAL_QUEUE_ORDERS,
  UNSAFE_STEPS,
  SAFE_STEPS,
  SCENARIO_1_STEPS,
  SCENARIO_2_STEPS,
  SCENARIO_3_STEPS,
  POSIX_PSEUDOCODE
} from '../src/synclab/educationalSchedules.js';

describe('Educational Page 03: Visual Race Laboratory', () => {
  it('Initial queue layout conforms to 5-slot specifications', () => {
    assert.equal(INITIAL_QUEUE_ORDERS.length, 5);
    assert.equal(INITIAL_QUEUE_ORDERS[0]?.id, 'O01');
    assert.equal(INITIAL_QUEUE_ORDERS[1]?.id, 'O02');
    assert.equal(INITIAL_QUEUE_ORDERS[2]?.id, 'O03');
    assert.equal(INITIAL_QUEUE_ORDERS[3], null);
    assert.equal(INITIAL_QUEUE_ORDERS[4], null);
  });

  it('Unsafe Schedule exhibits TOCTOU race: C2 reads stale head and duplicates C1 claim', () => {
    assert.equal(UNSAFE_STEPS.length, 5);

    // Step 1: C1 reads head at slot 0
    const s1 = UNSAFE_STEPS[0];
    assert.equal(s1.workerId, 'C1');
    assert.equal(s1.c1State.localRead, 'O01');
    assert.equal(s1.c1State.claimed, null);
    assert.equal(s1.readPosition, 0);

    // Step 2: C2 interleaves and reads slot 0 before C1 can commit
    const s2 = UNSAFE_STEPS[1];
    assert.equal(s2.workerId, 'C2');
    assert.equal(s2.c2State.localRead, 'O01');
    assert.equal(s2.c2State.isStale, true);
    assert.equal(s2.readPosition, 0);

    // Step 3: C1 claims O01 and advances pointer to 1
    const s3 = UNSAFE_STEPS[2];
    assert.equal(s3.workerId, 'C1');
    assert.equal(s3.c1State.claimed, 'O01');
    assert.equal(s3.readPosition, 1);

    // Step 4: C2 claims O01 from its stale read, ignoring advanced pointer
    const s4 = UNSAFE_STEPS[3];
    assert.equal(s4.workerId, 'C2');
    assert.equal(s4.c2State.claimed, 'O01');

    // Step 5: Duplicate claim fault verified
    const s5 = UNSAFE_STEPS[4];
    assert.equal(s5.c1State.claimed, 'O01');
    assert.equal(s5.c2State.claimed, 'O01');
    assert.equal(s5.c1State.claimed, s5.c2State.claimed, 'Both workers claimed the same order!');
    assert.equal(s5.concept, 'Duplicate Claim Fault (TOCTOU)');
  });

  it('Safe Schedule serializes critical section: C2 blocks until C1 finishes', () => {
    assert.equal(SAFE_STEPS.length, 5);

    // Step 1: C1 acquires mutex
    const s1 = SAFE_STEPS[0];
    assert.equal(s1.workerId, 'C1');
    assert.equal(s1.mutexOwner, 'C1');
    assert.equal(s1.c1State.localRead, 'O01');

    // Step 2: C2 attempts to enter, blocks on mutex
    const s2 = SAFE_STEPS[1];
    assert.equal(s2.workerId, 'C2');
    assert.equal(s2.mutexOwner, 'C1');
    assert.deepEqual(s2.mutexWaiters, ['C2']);
    assert.match(s2.c2State.action, /BLOCKED/);

    // Step 3: C1 claims O01, advances pointer, releases mutex
    const s3 = SAFE_STEPS[2];
    assert.equal(s3.workerId, 'C1');
    assert.equal(s3.c1State.claimed, 'O01');
    assert.equal(s3.readPosition, 1);
    assert.equal(s3.mutexOwner, null);

    // Step 4: C2 acquires mutex, reads fresh head at slot 1 (O02)
    const s4 = SAFE_STEPS[3];
    assert.equal(s4.workerId, 'C2');
    assert.equal(s4.mutexOwner, 'C2');
    assert.equal(s4.c2State.localRead, 'O02');

    // Step 5: C2 claims O02, advances pointer to 2, releases mutex
    const s5 = SAFE_STEPS[4];
    assert.equal(s5.c1State.claimed, 'O01');
    assert.equal(s5.c2State.claimed, 'O02');
    assert.notEqual(s5.c1State.claimed, s5.c2State.claimed, 'Workers claimed distinct orders!');
    assert.equal(s5.readPosition, 2);
    assert.equal(s5.mutexOwner, null);
  });
});

describe('Educational Page 04: Interactive Synchronization Solution', () => {
  it('Scenario 1: Normal Order Journey satisfies full semaphore cycle and cooking outside lock', () => {
    assert.equal(SCENARIO_1_STEPS.length, 13);

    // Initial state invariants
    const s1 = SCENARIO_1_STEPS[0];
    assert.equal(s1.empty, 5);
    assert.equal(s1.full, 0);
    assert.equal(s1.mutex, 1);
    assert.equal(s1.writePos, 0);
    assert.equal(s1.readPos, 0);

    // Producer wait(empty)
    const s2 = SCENARIO_1_STEPS[1];
    assert.equal(s2.empty, 4);

    // Producer wait(mutex)
    const s3 = SCENARIO_1_STEPS[2];
    assert.equal(s3.mutexOwner, 'P1');

    // Producer inserts into slot 0
    const s4 = SCENARIO_1_STEPS[3];
    assert.equal(s4.slots[0]?.id, 'O01');

    // Producer advances writePos to 1
    const s5 = SCENARIO_1_STEPS[4];
    assert.equal(s5.writePos, 1);

    // Producer signal(mutex) and signal(full)
    const s6 = SCENARIO_1_STEPS[5];
    assert.equal(s6.mutexOwner, null);
    const s7 = SCENARIO_1_STEPS[6];
    assert.equal(s7.full, 1);

    // Consumer removes from slot 0
    const s10 = SCENARIO_1_STEPS[9];
    assert.equal(s10.slots[0], null);

    // Consumer advances readPos to 1
    const s11 = SCENARIO_1_STEPS[10];
    assert.equal(s11.readPos, 1);

    // Consumer signal(mutex) and signal(empty)
    const s12 = SCENARIO_1_STEPS[11];
    assert.equal(s12.mutexOwner, null);
    const s13 = SCENARIO_1_STEPS[12];
    assert.equal(s13.empty, 5);
    assert.equal(s13.full, 0);

    // Food preparation outside lock
    assert.match(s13.consumerState.action, /Preparing.*outside critical section/);
    assert.equal(s13.mutexOwner, null, 'Cooking must never hold the critical section lock!');
  });

  it('Scenario 2: Queue Full blocks Producer P6 until Consumer signals empty slot', () => {
    assert.equal(SCENARIO_2_STEPS.length, 6);

    // Step 1: Initial full queue
    const s1 = SCENARIO_2_STEPS[0];
    assert.equal(s1.empty, 0);
    assert.equal(s1.full, 5);

    // Step 2: P6 executes wait(empty) and BLOCKS
    const s2 = SCENARIO_2_STEPS[1];
    assert.equal(s2.empty, 0);
    assert.deepEqual(s2.waitersEmpty, ['P6']);
    assert.equal(s2.producerState.state, 'BLOCKED');

    // Step 3: Consumer C1 removes slot 0
    const s3 = SCENARIO_2_STEPS[2];
    assert.equal(s3.slots[0], null);

    // Step 4: Consumer signals empty -> wakes P6
    const s4 = SCENARIO_2_STEPS[3];
    assert.deepEqual(s4.waitersEmpty, []);
    assert.equal(s4.producerState.state, 'READY');

    // Step 5: P6 inserts O06 into slot 0
    const s5 = SCENARIO_2_STEPS[4];
    assert.equal(s5.slots[0]?.id, 'O06');
    assert.equal(s5.producerState.state, 'RUNNING');

    // Step 6: P6 leaves critical section, signals full
    const s6 = SCENARIO_2_STEPS[5];
    assert.equal(s6.mutexOwner, null);
    assert.equal(s6.full, 5);
    assert.equal(s6.empty, 0);
  });

  it('Scenario 3: Queue Empty blocks Consumer C1 until Producer signals order', () => {
    assert.equal(SCENARIO_3_STEPS.length, 5);

    // Step 1: Initial empty queue
    const s1 = SCENARIO_3_STEPS[0];
    assert.equal(s1.empty, 5);
    assert.equal(s1.full, 0);

    // Step 2: C1 executes wait(full) and BLOCKS
    const s2 = SCENARIO_3_STEPS[1];
    assert.equal(s2.full, 0);
    assert.deepEqual(s2.waitersFull, ['C1']);
    assert.equal(s2.consumerState.state, 'BLOCKED');

    // Step 3: Producer P1 places order and signals full -> wakes C1
    const s3 = SCENARIO_3_STEPS[2];
    assert.deepEqual(s3.waitersFull, []);
    assert.equal(s3.consumerState.state, 'READY');
    assert.equal(s3.slots[0]?.id, 'O01');

    // Step 4: C1 acquires mutex and removes O01
    const s4 = SCENARIO_3_STEPS[3];
    assert.equal(s4.mutexOwner, 'C1');
    assert.equal(s4.slots[0], null);

    // Step 5: C1 signals empty, releases mutex, begins cooking outside lock
    const s5 = SCENARIO_3_STEPS[4];
    assert.equal(s5.mutexOwner, null);
    assert.equal(s5.empty, 5);
    assert.equal(s5.full, 0);
    assert.match(s5.consumerState.action, /Preparing.*outside critical section/);
  });

  it('POSIX C Pseudocode drawer contains valid semaphore coordination logic', () => {
    assert.match(POSIX_PSEUDOCODE.producer, /sem_wait\(&empty\);/);
    assert.match(POSIX_PSEUDOCODE.producer, /sem_wait\(&mutex\);/);
    assert.match(POSIX_PSEUDOCODE.producer, /sem_post\(&mutex\);/);
    assert.match(POSIX_PSEUDOCODE.producer, /sem_post\(&full\);/);

    assert.match(POSIX_PSEUDOCODE.consumer, /sem_wait\(&full\);/);
    assert.match(POSIX_PSEUDOCODE.consumer, /sem_wait\(&mutex\);/);
    assert.match(POSIX_PSEUDOCODE.consumer, /sem_post\(&mutex\);/);
    assert.match(POSIX_PSEUDOCODE.consumer, /sem_post\(&empty\);/);
    assert.match(POSIX_PSEUDOCODE.consumer, /OUTSIDE critical section/i);
  });
});
