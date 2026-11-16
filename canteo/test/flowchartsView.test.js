import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRODUCER_FLOW_NODES,
  CONSUMER_FLOW_NODES,
  COMBINED_SYSTEM_NODES
} from '../src/synclab/flowchartData.js';

describe('Dedicated View 05: Restored Clean Synchronization Flowcharts Verification', () => {
  it('Producer flowchart contains complete lifecycle with clear decisions and critical section grouping', () => {
    const ids = PRODUCER_FLOW_NODES.map((n) => n.id);
    assert.deepEqual(ids, [
      'p_start',
      'p_create',
      'p_wait_empty',
      'p_blocked_empty',
      'p_wait_mutex',
      'p_blocked_mutex',
      'p_insert',
      'p_advance_write',
      'p_signal_mutex',
      'p_signal_full',
      'p_loop'
    ]);

    // Check decisions & wait operations
    const waitEmpty = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_wait_empty');
    assert.match(waitEmpty.op, /sem_wait\(&empty\)/);
    assert.ok(waitEmpty.blocking, 'waitEmpty must include blocking explanation');

    const blockedEmpty = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_blocked_empty');
    assert.ok(blockedEmpty);

    const waitMutex = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_wait_mutex');
    assert.match(waitMutex.op, /pthread_mutex_lock/);

    const blockedMutex = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_blocked_mutex');
    assert.ok(blockedMutex);

    // Check critical section operations inside mutual exclusion
    const insertNode = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_insert');
    assert.equal(insertNode.cs, 'inside');
    assert.match(insertNode.op, /buffer\[writePosition\]\s*=\s*order/);

    const advanceNode = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_advance_write');
    assert.equal(advanceNode.cs, 'inside');
    assert.match(advanceNode.op, /% 5/);

    // Check boundary releases and signals
    const signalMutex = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_signal_mutex');
    assert.equal(signalMutex.cs, 'boundary');
    const signalFull = PRODUCER_FLOW_NODES.find((n) => n.id === 'p_signal_full');
    assert.equal(signalFull.cs, 'outside');

    // Check all nodes have canteen analogies, plain meanings, and step numbers
    for (const node of PRODUCER_FLOW_NODES) {
      assert.ok(node.stepNumber, `${node.id} missing stepNumber`);
      assert.ok(node.meaning && node.meaning.length > 10, `${node.id} missing meaning`);
      assert.ok(node.canteen && node.canteen.length > 10, `${node.id} missing canteen analogy`);
      assert.ok(node.resource, `${node.id} missing resource`);
    }
  });

  it('Consumer flowchart matches persistent lifecycle: two stages with cooking and ready outside critical section', () => {
    const ids = CONSUMER_FLOW_NODES.map((n) => n.id);
    assert.deepEqual(ids, [
      'c_start',
      'c_wait_full',
      'c_blocked_full',
      'c_wait_mutex',
      'c_blocked_mutex',
      'c_remove',
      'c_advance_read',
      'c_signal_mutex',
      'c_signal_empty',
      'c_cook',
      'c_ready',
      'c_loop'
    ]);

    // Check wait operations
    const waitFull = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_wait_full');
    assert.match(waitFull.op, /sem_wait\(&full\)/);

    const waitMutex = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_wait_mutex');
    assert.match(waitMutex.op, /pthread_mutex_lock/);

    // Check critical section operations inside Stage A
    const removeNode = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_remove');
    assert.equal(removeNode.cs, 'inside');
    assert.equal(removeNode.stage, 'Stage A: Shared Queue Access');

    const advanceNode = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_advance_read');
    assert.equal(advanceNode.cs, 'inside');
    assert.match(advanceNode.op, /% 5/);
    assert.equal(advanceNode.stage, 'Stage A: Shared Queue Access');

    // Verify Stage B food preparation and ready marking are strictly OUTSIDE critical section
    const cookNode = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_cook');
    assert.equal(cookNode.cs, 'outside');
    assert.equal(cookNode.stage, 'Stage B: Independent Food Preparation');
    assert.match(cookNode.op, /outside critical section/i);

    const readyNode = CONSUMER_FLOW_NODES.find((n) => n.id === 'c_ready');
    assert.equal(readyNode.cs, 'outside');
    assert.equal(readyNode.stage, 'Stage B: Independent Food Preparation');
    assert.match(readyNode.op, /READY_FOR_PICKUP/);

    for (const node of CONSUMER_FLOW_NODES) {
      assert.ok(node.stepNumber, `${node.id} missing stepNumber`);
      assert.ok(node.stage, `${node.id} missing stage distinction`);
      assert.ok(node.meaning && node.meaning.length > 10, `${node.id} missing meaning`);
      assert.ok(node.canteen && node.canteen.length > 10, `${node.id} missing canteen analogy`);
    }
  });

  it('Combined system architecture includes 3 lanes, initial semaphores panel, and buffer primitives', () => {
    const ids = COMBINED_SYSTEM_NODES.map((n) => n.id);
    assert.deepEqual(ids, [
      'comb_producer',
      'comb_sem_empty',
      'comb_mutex',
      'comb_sem_full',
      'comb_buffer',
      'comb_consumer',
      'comb_prep_rack'
    ]);

    const semEmpty = COMBINED_SYSTEM_NODES.find((n) => n.id === 'comb_sem_empty');
    assert.match(semEmpty.op, /empty;\s*\/\/\s*Initial\s*=\s*5/);

    const semMutex = COMBINED_SYSTEM_NODES.find((n) => n.id === 'comb_mutex');
    assert.match(semMutex.op, /mutex;\s*\/\/\s*Initial\s*=\s*1/);

    const semFull = COMBINED_SYSTEM_NODES.find((n) => n.id === 'comb_sem_full');
    assert.match(semFull.op, /full;\s*\/\/\s*Initial\s*=\s*0/);

    const bufferNode = COMBINED_SYSTEM_NODES.find((n) => n.id === 'comb_buffer');
    assert.match(bufferNode.op, /buffer\[5\]/);
  });
});
