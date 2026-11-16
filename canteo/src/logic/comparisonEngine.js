/**
 * Authoritative Comparison Engine for Canteo Sync Lab.
 *
 * Coordinates side-by-side "Without Mutex" vs "With Mutex" execution across:
 * 1. Shared Counter (Read-Compute-Write Lost Update experiment)
 * 2. Decomposed Bounded Buffer (Stale pointer slot collision experiment)
 *
 * Provides:
 * - Deterministic synchronized or independent dual-pane stepping
 * - Inspection receipts (before/after/delta/plain-text explanation)
 * - Turn and committed instruction counting
 * - "Pause at first fault" detection with causal trace
 * - Invariant verification evaluation for both panes
 */

import {
  createInitialCounterState,
  stepCounterSimulation,
  COUNTER_PRESETS,
  COUNTER_INSTRUCTIONS_WITHOUT_MUTEX,
  COUNTER_INSTRUCTIONS_WITH_MUTEX,
} from './counterEngine.js';

import {
  createInitialSyncState,
  stepSimulation,
  BUFFER_COMPARISON_PRESETS,
  evaluateDetailedInvariants,
  DECOMPOSED_PRODUCER_WITHOUT_MUTEX_INSTRUCTIONS,
  DECOMPOSED_PRODUCER_WITH_MUTEX_INSTRUCTIONS,
  CONSUMER_INSTRUCTIONS,
} from './syncLabEngine.js';

export const COMPARISON_EXPERIMENTS = {
  COUNTER: 'COUNTER',
  BUFFER: 'BUFFER',
};

/**
 * Creates initial dual-pane comparison state
 */
export function createInitialComparison(experimentType = COMPARISON_EXPERIMENTS.COUNTER, presetId = null, options = {}) {
  const pauseAtFirstFault = options.pauseAtFirstFault ?? true;

  if (experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
    const activePreset = COUNTER_PRESETS[presetId] || COUNTER_PRESETS.LOST_UPDATE;
    const initialShared = options.initialShared ?? 2;

    const leftState = createInitialCounterState({
      withMutex: false,
      initialShared,
    });

    const rightState = createInitialCounterState({
      withMutex: true,
      initialShared,
    });

    return {
      experimentType: COMPARISON_EXPERIMENTS.COUNTER,
      presetId: activePreset.id,
      schedule: [...activePreset.schedule],
      turnIndex: 0,
      pauseAtFirstFault,
      isFirstFaultPaused: false,
      leftState,
      rightState,
      leftCommittedCount: 0,
      rightCommittedCount: 0,
      history: [],
      firstFaultData: null,
      status: 'READY', // 'READY' | 'RUNNING' | 'PAUSED_FAULT' | 'COMPLETED'
    };
  }

  // Bounded Buffer Experiment
  const activePreset = BUFFER_COMPARISON_PRESETS[presetId] || BUFFER_COMPARISON_PRESETS.RACE_COLLISION;

  const leftState = createInitialSyncState({
    scenarioId: activePreset.id,
    withoutMutex: true,
    useDecomposedBuffer: true,
  });

  const rightState = createInitialSyncState({
    scenarioId: activePreset.id,
    withoutMutex: false,
    useDecomposedBuffer: true,
  });

  return {
    experimentType: COMPARISON_EXPERIMENTS.BUFFER,
    presetId: activePreset.id,
    schedule: [...activePreset.schedule],
    turnIndex: 0,
    pauseAtFirstFault,
    isFirstFaultPaused: false,
    leftState,
    rightState,
    leftCommittedCount: 0,
    rightCommittedCount: 0,
    history: [],
    firstFaultData: null,
    status: 'READY',
  };
}

/**
 * Builds an execution receipt describing what an instruction did
 */
export function buildExecutionReceipt(beforeState, afterState, threadId, experimentType, executed = true, reason = '') {
  const isCounter = experimentType === COMPARISON_EXPERIMENTS.COUNTER;
  const beforeThread = beforeState.threads[threadId];
  const afterThread = afterState.threads[threadId];
  const withMutex = isCounter ? beforeState.withMutex : !beforeState.withoutMutex;

  if (!executed) {
    const defaultReason = beforeThread?.status === 'BLOCKED'
      ? `Thread ${threadId} is blocked waiting on ${beforeThread?.waitingFor || 'mutex'}`
      : `Thread ${threadId} has completed routine or is ineligible`;

    return {
      step: afterState.stepCounter,
      threadId,
      op: 'INELIGIBLE_NOOP',
      label: `${threadId} (Ineligible / Blocked)`,
      desc: reason || defaultReason,
      deltas: [],
      explanation: `${threadId} did not commit an instruction this turn: ${reason || defaultReason}. No state changed in this pane.`,
      isFault: false,
      executed: false,
      withMutex,
      before: isCounter
        ? {
            shared: beforeState.shared,
            mutex: beforeState.mutex,
            mutexOwner: beforeState.mutexOwner,
            waitQueue: [...(beforeState.waitQueue || [])],
            thread: { ...beforeThread },
          }
        : {
            occupancy: beforeState.occupancy,
            in: beforeState.in,
            out: beforeState.out,
            empty: beforeState.empty,
            full: beforeState.full,
            mutex: beforeState.mutex,
            mutexOwner: beforeState.mutexOwner,
            thread: { ...beforeThread },
          },
      after: isCounter
        ? {
            shared: afterState.shared,
            mutex: afterState.mutex,
            mutexOwner: afterState.mutexOwner,
            waitQueue: [...(afterState.waitQueue || [])],
            thread: { ...afterThread },
          }
        : {
            occupancy: afterState.occupancy,
            in: afterState.in,
            out: afterState.out,
            empty: afterState.empty,
            full: afterState.full,
            mutex: afterState.mutex,
            mutexOwner: afterState.mutexOwner,
            thread: { ...afterThread },
          },
    };
  }

  if (isCounter) {
    const instructions = beforeState.withMutex
      ? COUNTER_INSTRUCTIONS_WITH_MUTEX
      : COUNTER_INSTRUCTIONS_WITHOUT_MUTEX;
    const instruction = instructions[beforeThread?.pc] || { op: 'UNKNOWN', label: 'Instruction' };

    const deltas = [];
    if (beforeState.shared !== afterState.shared) {
      deltas.push(`Shared Counter: ${beforeState.shared} → ${afterState.shared}`);
    }
    if (beforeThread?.localRead !== afterThread?.localRead) {
      deltas.push(`${threadId} Local Read: ${beforeThread?.localRead} → ${afterThread?.localRead}`);
    }
    if (beforeThread?.localComputed !== afterThread?.localComputed) {
      deltas.push(`${threadId} Local Computed: ${beforeThread?.localComputed} → ${afterThread?.localComputed}`);
    }
    if (beforeState.mutex !== afterState.mutex) {
      deltas.push(`Mutex Lock: ${beforeState.mutex === 1 ? 'Free (1)' : 'Locked (0)'} → ${afterState.mutex === 1 ? 'Free (1)' : 'Locked (0)'}`);
    }
    if (beforeThread?.status !== afterThread?.status) {
      deltas.push(`${threadId} Status: ${beforeThread?.status} → ${afterThread?.status}`);
    }

    let explanation = '';
    let isFault = false;

    if (instruction.op === 'READ') {
      explanation = `${threadId} copied shared counter (${beforeState.shared}) into its local register. ${
        beforeState.withMutex ? 'Protected by binary mutex lock.' : 'UNPROTECTED: other threads may read/write concurrently.'
      }`;
    } else if (instruction.op === 'COMPUTE') {
      explanation = `${threadId} incremented local register from ${beforeThread?.localRead} to ${afterThread?.localComputed} inside private CPU register.`;
    } else if (instruction.op === 'WRITE') {
      if (afterState.firstFault) {
        isFault = true;
        explanation = `LOST UPDATE FAULT: ${threadId} wrote ${afterThread?.localComputed} back to shared counter, overwriting previous value ${beforeState.shared} because ${threadId} read from stale state!`;
      } else {
        explanation = `${threadId} committed computed value ${afterThread?.localComputed} back into shared memory. Shared counter is now ${afterState.shared}.`;
      }
    } else if (instruction.op === 'LOCK') {
      if (afterThread?.status === 'BLOCKED') {
        explanation = `CONTENTION: ${threadId} tried to acquire mutex, but ${beforeState.mutexOwner} already owns it. ${threadId} blocked in wait queue.`;
      } else {
        explanation = `${threadId} acquired binary mutex lock. Exclusive critical section entered.`;
      }
    } else if (instruction.op === 'UNLOCK') {
      explanation = `${threadId} released mutex lock. Critical section vacated.`;
    }

    return {
      step: afterState.stepCounter,
      threadId,
      op: instruction.op,
      label: instruction.label,
      desc: instruction.desc,
      deltas,
      explanation,
      isFault,
      executed: true,
      withMutex: beforeState.withMutex,
      before: {
        shared: beforeState.shared,
        mutex: beforeState.mutex,
        mutexOwner: beforeState.mutexOwner,
        waitQueue: [...(beforeState.waitQueue || [])],
        thread: { ...beforeThread },
      },
      after: {
        shared: afterState.shared,
        mutex: afterState.mutex,
        mutexOwner: afterState.mutexOwner,
        waitQueue: [...(afterState.waitQueue || [])],
        thread: { ...afterThread },
      },
    };
  }

  // Bounded Buffer Receipt
  const instructions = beforeThread?.role === 'CONSUMER'
    ? CONSUMER_INSTRUCTIONS
    : (beforeState.withoutMutex
        ? DECOMPOSED_PRODUCER_WITHOUT_MUTEX_INSTRUCTIONS
        : DECOMPOSED_PRODUCER_WITH_MUTEX_INSTRUCTIONS);
  const instruction = instructions[beforeThread?.pc] || { op: 'UNKNOWN', label: 'Instruction' };

  const deltas = [];
  if (beforeState.occupancy !== afterState.occupancy) {
    deltas.push(`Occupancy: ${beforeState.occupancy} → ${afterState.occupancy}`);
  }
  if (beforeState.in !== afterState.in) {
    deltas.push(`IN Pointer: ${beforeState.in} → ${afterState.in}`);
  }
  if (beforeState.out !== afterState.out) {
    deltas.push(`OUT Pointer: ${beforeState.out} → ${afterState.out}`);
  }
  if (beforeState.empty !== afterState.empty) {
    deltas.push(`empty semaphore: ${beforeState.empty} → ${afterState.empty}`);
  }
  if (beforeState.full !== afterState.full) {
    deltas.push(`full semaphore: ${beforeState.full} → ${afterState.full}`);
  }
  if (beforeState.mutex !== afterState.mutex) {
    deltas.push(`Mutex: ${beforeState.mutex} → ${afterState.mutex}`);
  }
  if (beforeThread?.status !== afterThread?.status) {
    deltas.push(`${threadId} Status: ${beforeThread?.status} → ${afterThread?.status}`);
  }

  let explanation;
  let isFault = false;

  if (afterState.firstFault && (!beforeState.firstFault || afterState.displacedItems?.length > (beforeState.displacedItems?.length || 0))) {
    isFault = true;
    explanation = afterState.firstFault.explanation || 'RACE CONDITION COLLISION: Slot overwritten without consumer pickup!';
  } else if (instruction.op === 'READ_IN') {
    explanation = `${threadId} loaded shared IN pointer value (${afterThread?.targetSlot}) into its thread-private register targetSlot.`;
  } else if (instruction.op === 'WRITE_SLOT') {
    explanation = `${threadId} placed order token into Bay ${afterThread?.targetSlot ?? beforeState.in}.`;
  } else if (instruction.op === 'ADVANCE_IN') {
    explanation = `${threadId} advanced shared IN pointer: (${beforeState.in} + 1) % 5 = ${afterState.in}.`;
  } else if (instruction.op === 'WAIT_MUTEX') {
    if (afterThread?.status === 'BLOCKED') {
      explanation = `MUTEX CONTENTION: Mutex locked by ${beforeState.mutexOwner}. ${threadId} placed into waitQueues.mutex.`;
    } else {
      explanation = `${threadId} acquired mutex lock. Exclusive critical section entered.`;
    }
  } else if (instruction.op === 'SIGNAL_MUTEX') {
    explanation = `${threadId} released mutex lock. Critical section available for next waiting thread.`;
  } else {
    explanation = `${threadId} executed ${instruction.label}.`;
  }

  return {
    step: afterState.stepCounter,
    threadId,
    op: instruction.op,
    label: instruction.label,
    desc: instruction.desc,
    deltas,
    explanation,
    isFault,
    executed: true,
    withMutex: !beforeState.withoutMutex,
    before: {
      occupancy: beforeState.occupancy,
      in: beforeState.in,
      out: beforeState.out,
      empty: beforeState.empty,
      full: beforeState.full,
      mutex: beforeState.mutex,
      mutexOwner: beforeState.mutexOwner,
      thread: { ...beforeThread },
    },
    after: {
      occupancy: afterState.occupancy,
      in: afterState.in,
      out: afterState.out,
      empty: afterState.empty,
      full: afterState.full,
      mutex: afterState.mutex,
      mutexOwner: afterState.mutexOwner,
      thread: { ...afterThread },
    },
  };
}

/**
 * Step a single turn for both panes simultaneously (Synchronized Stepping)
 */
export function stepComparisonTurn(compState, preferredThreadId = null) {
  if (!compState) {
    return compState;
  }

  const isLeftDone = compState.leftState.isCompleted || Object.values(compState.leftState.threads).every((t) => t.status === 'COMPLETED');
  const isRightDone = compState.rightState.isCompleted || Object.values(compState.rightState.threads).every((t) => t.status === 'COMPLETED');

  if (isLeftDone && isRightDone && !preferredThreadId) {
    return { ...compState, status: 'COMPLETED' };
  }

  // Determine thread for this comparison turn
  let scheduledThread = preferredThreadId;
  if (!scheduledThread) {
    if (compState.schedule && compState.turnIndex < compState.schedule.length) {
      scheduledThread = compState.schedule[compState.turnIndex];
    } else {
      // Pick first runnable thread
      const leftRunnable = Object.values(compState.leftState.threads).find((t) => t.status !== 'COMPLETED' && t.status !== 'BLOCKED')?.id;
      const rightRunnable = Object.values(compState.rightState.threads).find((t) => t.status !== 'COMPLETED' && t.status !== 'BLOCKED')?.id;
      scheduledThread = leftRunnable || rightRunnable || Object.keys(compState.leftState.threads)[compState.turnIndex % Object.keys(compState.leftState.threads).length];
    }
  }

  // 1. Step Left (Without Mutex)
  let nextLeftState;
  let leftExecuted;
  let leftReason = '';
  if (compState.experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
    const leftRes = stepCounterSimulation(compState.leftState, scheduledThread);
    nextLeftState = leftRes.nextState;
    leftExecuted = leftRes.executed;
    leftReason = leftRes.reason;
  } else {
    nextLeftState = stepSimulation(compState.leftState, scheduledThread, { strict: true });
    leftExecuted = nextLeftState.stepCounter > compState.leftState.stepCounter;
    if (!leftExecuted) {
      const th = compState.leftState.threads[scheduledThread];
      leftReason = th?.status === 'BLOCKED' ? `${scheduledThread} blocked on ${th.waitingFor}` : `${scheduledThread} completed routine`;
    }
  }

  // 2. Step Right (With Mutex)
  let nextRightState;
  let rightExecuted;
  let rightReason = '';
  if (compState.experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
    const rightRes = stepCounterSimulation(compState.rightState, scheduledThread);
    nextRightState = rightRes.nextState;
    rightExecuted = rightRes.executed;
    rightReason = rightRes.reason;
  } else {
    nextRightState = stepSimulation(compState.rightState, scheduledThread, { strict: true });
    rightExecuted = nextRightState.stepCounter > compState.rightState.stepCounter;
    if (!rightExecuted) {
      const th = compState.rightState.threads[scheduledThread];
      rightReason = th?.status === 'BLOCKED' ? `${scheduledThread} blocked on ${th.waitingFor}` : `${scheduledThread} completed routine`;
    }
  }

  const leftReceipt = buildExecutionReceipt(compState.leftState, nextLeftState, scheduledThread, compState.experimentType, leftExecuted, leftReason);
  const rightReceipt = buildExecutionReceipt(compState.rightState, nextRightState, scheduledThread, compState.experimentType, rightExecuted, rightReason);

  // Check if a first fault occurred on the left side
  const leftHadFaultBefore = Boolean(compState.leftState.firstFault);
  const leftHasFaultNow = Boolean(nextLeftState.firstFault);
  const newlyTriggeredFault = !leftHadFaultBefore && leftHasFaultNow;

  let isFirstFaultPaused = compState.isFirstFaultPaused;
  let firstFaultData = compState.firstFaultData;

  if (newlyTriggeredFault) {
    firstFaultData = {
      turnIndex: compState.turnIndex + 1,
      threadId: scheduledThread,
      fault: nextLeftState.firstFault,
      receipt: leftReceipt,
    };
    if (compState.pauseAtFirstFault) {
      isFirstFaultPaused = true;
    }
  }

  const nextTurnIndex = compState.turnIndex + 1;
  const nextIsLeftDone = nextLeftState.isCompleted || Object.values(nextLeftState.threads).every((t) => t.status === 'COMPLETED');
  const nextIsRightDone = nextRightState.isCompleted || Object.values(nextRightState.threads).every((t) => t.status === 'COMPLETED');
  const isScheduleFinished = compState.schedule && nextTurnIndex >= compState.schedule.length;

  let nextStatus = 'READY';
  if (isFirstFaultPaused) {
    nextStatus = 'PAUSED_FAULT';
  } else if (nextIsLeftDone && nextIsRightDone) {
    nextStatus = 'COMPLETED';
  } else if (isScheduleFinished && !preferredThreadId) {
    nextStatus = 'COMPLETED';
  }

  return {
    ...compState,
    turnIndex: nextTurnIndex,
    isFirstFaultPaused,
    firstFaultData,
    status: nextStatus,
    leftState: nextLeftState,
    rightState: nextRightState,
    leftCommittedCount: compState.leftCommittedCount + (leftExecuted ? 1 : 0),
    rightCommittedCount: compState.rightCommittedCount + (rightExecuted ? 1 : 0),
    history: [
      {
        turnIndex: nextTurnIndex,
        scheduledThread,
        leftReceipt,
        rightReceipt,
      },
      ...compState.history,
    ].slice(0, 50),
  };
}

/**
 * Step only one specified pane ('left' | 'right') independently
 */
export function stepSinglePane(compState, pane, threadId) {
  if (!compState || !['left', 'right'].includes(pane)) return compState;

  if (pane === 'left') {
    let nextLeftState;
    let leftExecuted;
    let leftReason = '';
    if (compState.experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
      const res = stepCounterSimulation(compState.leftState, threadId);
      nextLeftState = res.nextState;
      leftExecuted = res.executed;
      leftReason = res.reason;
    } else {
      nextLeftState = stepSimulation(compState.leftState, threadId, { strict: true });
      leftExecuted = nextLeftState.stepCounter > compState.leftState.stepCounter;
      if (!leftExecuted) {
        const th = compState.leftState.threads[threadId];
        leftReason = th?.status === 'BLOCKED' ? `${threadId} blocked on ${th.waitingFor}` : `${threadId} completed routine`;
      }
    }

    const receipt = buildExecutionReceipt(compState.leftState, nextLeftState, threadId, compState.experimentType, leftExecuted, leftReason);

    return {
      ...compState,
      leftState: nextLeftState,
      leftCommittedCount: compState.leftCommittedCount + (leftExecuted ? 1 : 0),
      history: [
        {
          turnIndex: compState.turnIndex,
          scheduledThread: threadId,
          leftReceipt: receipt,
          rightReceipt: null,
        },
        ...compState.history,
      ].slice(0, 50),
    };
  }

  // Right pane
  let nextRightState;
  let rightExecuted;
  let rightReason = '';
  if (compState.experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
    const res = stepCounterSimulation(compState.rightState, threadId);
    nextRightState = res.nextState;
    rightExecuted = res.executed;
    rightReason = res.reason;
  } else {
    nextRightState = stepSimulation(compState.rightState, threadId, { strict: true });
    rightExecuted = nextRightState.stepCounter > compState.rightState.stepCounter;
    if (!rightExecuted) {
      const th = compState.rightState.threads[threadId];
      rightReason = th?.status === 'BLOCKED' ? `${threadId} blocked on ${th.waitingFor}` : `${threadId} completed routine`;
    }
  }

  const receipt = buildExecutionReceipt(compState.rightState, nextRightState, threadId, compState.experimentType, rightExecuted, rightReason);

  return {
    ...compState,
    rightState: nextRightState,
    rightCommittedCount: compState.rightCommittedCount + (rightExecuted ? 1 : 0),
    history: [
      {
        turnIndex: compState.turnIndex,
        scheduledThread: threadId,
        leftReceipt: null,
        rightReceipt: receipt,
      },
      ...compState.history,
    ].slice(0, 50),
  };
}

/**
 * Evaluates live invariants for both panes
 */
export function evaluateComparisonInvariants(compState) {
  if (!compState) return { left: [], right: [] };

  if (compState.experimentType === COMPARISON_EXPERIMENTS.COUNTER) {
    const leftCompleted = compState.leftState.isCompleted;
    const rightCompleted = compState.rightState.isCompleted;
    const leftFault = Boolean(compState.leftState.firstFault);
    const rightFault = Boolean(compState.rightState.firstFault);

    let leftStatus = 'IN_PROGRESS';
    let leftDesc = `Execution underway (Shared: ${compState.leftState.shared}, Target: ${compState.leftState.expectedFinal}). Evaluated upon completion.`;
    if (leftFault) {
      leftStatus = 'VIOLATION';
      leftDesc = `VIOLATION: Race condition clobbered counter. Result is ${compState.leftState.shared} instead of ${compState.leftState.expectedFinal}.`;
    } else if (leftCompleted) {
      leftStatus = compState.leftState.shared === compState.leftState.expectedFinal ? 'PASS' : 'VIOLATION';
      leftDesc = compState.leftState.shared === compState.leftState.expectedFinal
        ? `PASS: Routine complete. Workload produced expected value ${compState.leftState.shared}.`
        : `VIOLATION: Lost update occurred. Result is ${compState.leftState.shared} instead of ${compState.leftState.expectedFinal}.`;
    }

    let rightStatus = 'IN_PROGRESS';
    let rightDesc = `Execution underway (Shared: ${compState.rightState.shared}, Target: ${compState.rightState.expectedFinal}). Protected by mutex.`;
    if (rightFault) {
      rightStatus = 'VIOLATION';
      rightDesc = 'VIOLATION: Mutex protection failure detected.';
    } else if (rightCompleted) {
      rightStatus = compState.rightState.shared === compState.rightState.expectedFinal ? 'PASS' : 'VIOLATION';
      rightDesc = compState.rightState.shared === compState.rightState.expectedFinal
        ? `PASS: Routine complete. Mutex serialization guaranteed mathematical target ${compState.rightState.shared}.`
        : `VIOLATION: Invariant broken. Final counter is ${compState.rightState.shared} instead of ${compState.rightState.expectedFinal}.`;
    }

    const isRightMutexHealthy = compState.rightState.mutex === 1
      ? compState.rightState.mutexOwner === null
      : compState.rightState.mutexOwner !== null;

    const leftItems = [
      {
        id: 'COUNTER_ACCURACY',
        name: 'Mathematical Correctness',
        formula: 'finalShared === initialShared + 2',
        status: leftStatus,
        description: leftDesc,
      },
      {
        id: 'MUTEX_ISOLATION',
        name: 'Mutual Exclusion Enforcement',
        formula: 'Mutex Active',
        status: 'WARN',
        description: 'Disabled: Threads execute read-compute-write without critical section locking.',
      },
    ];

    const rightItems = [
      {
        id: 'COUNTER_ACCURACY',
        name: 'Mathematical Correctness',
        formula: 'finalShared === initialShared + 2',
        status: rightStatus,
        description: rightDesc,
      },
      {
        id: 'MUTEX_ISOLATION',
        name: 'Mutual Exclusion Enforcement',
        formula: 'Mutex Active & Owner Valid',
        status: isRightMutexHealthy ? 'PASS' : 'VIOLATION',
        description: compState.rightState.mutexOwner
          ? `PASS: Critical section locked exclusively by [${compState.rightState.mutexOwner}]. Contender queued.`
          : 'PASS: Mutex free (1). Critical section ready for next acquisition.',
      },
    ];

    return { left: leftItems, right: rightItems };
  }

  // Bounded buffer invariants
  return {
    left: evaluateDetailedInvariants(compState.leftState),
    right: evaluateDetailedInvariants(compState.rightState),
  };
}
