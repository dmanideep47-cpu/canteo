/**
 * Deterministic Shared Counter Engine for Canteo Sync Lab.
 *
 * Implements an authoritative instruction-level read-modify-write transition engine
 * comparing unsynchronized concurrent execution (Lost Update race condition)
 * with mutex-serialized critical section protection.
 */

export const COUNTER_INSTRUCTIONS_WITHOUT_MUTEX = [
  { step: 0, op: 'READ', label: 'READ: local = shared', desc: 'Read shared counter into thread-local register' },
  { step: 1, op: 'COMPUTE', label: 'COMPUTE: local = local + 1', desc: 'Increment local register in private CPU register' },
  { step: 2, op: 'WRITE', label: 'WRITE: shared = local', desc: 'Write local register back to shared memory' },
];

export const COUNTER_INSTRUCTIONS_WITH_MUTEX = [
  { step: 0, op: 'LOCK', label: 'LOCK: pthread_mutex_lock(&mutex)', desc: 'Acquire binary mutex lock / enter critical section' },
  { step: 1, op: 'READ', label: 'READ: local = shared', desc: 'Read shared counter into thread-local register under lock' },
  { step: 2, op: 'COMPUTE', label: 'COMPUTE: local = local + 1', desc: 'Increment local register in private CPU register' },
  { step: 3, op: 'WRITE', label: 'WRITE: shared = local', desc: 'Write local register back to shared memory under lock' },
  { step: 4, op: 'UNLOCK', label: 'UNLOCK: pthread_mutex_unlock(&mutex)', desc: 'Release mutex lock / leave critical section' },
];

export function createInitialCounterState(options = {}) {
  const withMutex = options.withMutex ?? false;
  const initialShared = options.initialShared ?? 2;

  return {
    experimentType: 'SHARED_COUNTER',
    withMutex,
    shared: initialShared,
    initialShared,
    expectedFinal: initialShared + 2, // 2 threads each performing 1 increment
    mutex: 1, // 1 = free, 0 = locked
    mutexOwner: null,
    waitQueue: [],
    threads: {
      P1: {
        id: 'P1',
        name: 'Thread P1',
        pc: 0,
        status: 'READY', // 'READY' | 'RUNNING' | 'BLOCKED' | 'COMPLETED'
        localRead: null,
        localComputed: null,
        waitingFor: null,
        readStep: null,
      },
      P2: {
        id: 'P2',
        name: 'Thread P2',
        pc: 0,
        status: 'READY',
        localRead: null,
        localComputed: null,
        waitingFor: null,
        readStep: null,
      },
    },
    stepCounter: 0,
    committedInstructions: 0,
    events: [],
    scheduleHistory: [],
    isCompleted: false,
    firstFault: null, // Captures first divergence or lost update
  };
}

export function getCounterInstructions(withMutex) {
  return withMutex ? COUNTER_INSTRUCTIONS_WITH_MUTEX : COUNTER_INSTRUCTIONS_WITHOUT_MUTEX;
}

/**
 * Step single thread in Counter Engine
 */
export function stepCounterSimulation(prevState, threadId) {
  if (!prevState.threads[threadId]) {
    return {
      nextState: prevState,
      executed: false,
      reason: `Unknown thread ID: ${threadId}`,
      events: [],
    };
  }

  const thread = { ...prevState.threads[threadId] };

  // Guard: thread cannot execute if blocked or completed
  if (thread.status === 'COMPLETED') {
    return {
      nextState: prevState,
      executed: false,
      reason: `${thread.id} has completed its routine.`,
      events: [],
    };
  }
  if (thread.status === 'BLOCKED') {
    return {
      nextState: prevState,
      executed: false,
      reason: `${thread.id} is blocked waiting on ${thread.waitingFor}.`,
      events: [],
    };
  }

  const instructions = getCounterInstructions(prevState.withMutex);
  const currentInst = instructions[thread.pc];
  if (!currentInst) {
    return {
      nextState: prevState,
      executed: false,
      reason: `No remaining instructions for ${thread.id}.`,
      events: [],
    };
  }

  const nextThreads = { ...prevState.threads };
  let nextShared = prevState.shared;
  let nextMutex = prevState.mutex;
  let nextMutexOwner = prevState.mutexOwner;
  const nextWaitQueue = [...prevState.waitQueue];
  const stepNumber = prevState.stepCounter + 1;
  const newEvents = [];
  let faultOccurred = null;

  const pcBefore = thread.pc;
  const beforeSnapshot = {
    shared: prevState.shared,
    localRead: thread.localRead,
    localComputed: thread.localComputed,
    mutex: prevState.mutex,
    mutexOwner: prevState.mutexOwner,
    status: thread.status,
  };

  if (!prevState.withMutex) {
    // -------------------------------------------------------------
    // WITHOUT MUTEX EXECUTION PATH (Unsynchronized read-modify-write)
    // -------------------------------------------------------------
    switch (currentInst.op) {
      case 'READ': {
        thread.localRead = prevState.shared;
        thread.readStep = stepNumber;
        thread.pc = 1;
        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'READ',
          threadId: thread.id,
          instruction: currentInst.label,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, localRead: thread.localRead },
          explanation: `${thread.id} read shared counter (${prevState.shared}) into local register.`,
        });
        break;
      }
      case 'COMPUTE': {
        thread.localComputed = (thread.localRead ?? prevState.shared) + 1;
        thread.pc = 2;
        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'COMPUTE',
          threadId: thread.id,
          instruction: currentInst.label,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, localComputed: thread.localComputed },
          explanation: `${thread.id} computed local increment: ${thread.localRead} + 1 = ${thread.localComputed}.`,
        });
        break;
      }
      case 'WRITE': {
        const prevSharedVal = nextShared;
        nextShared = thread.localComputed ?? (prevState.shared + 1);
        thread.pc = 3;
        thread.status = 'COMPLETED';

        // Check if an earlier write was overwritten with a stale read
        const otherThreadId = thread.id === 'P1' ? 'P2' : 'P1';
        const otherThread = prevState.threads[otherThreadId];
        const isClobbering = otherThread?.status === 'COMPLETED' && nextShared <= prevSharedVal;

        if (isClobbering && !prevState.firstFault) {
          faultOccurred = {
            step: stepNumber,
            type: 'LOST_UPDATE',
            culpritThreadId: thread.id,
            victimThreadId: otherThreadId,
            staleReadValue: thread.localRead,
            overwrittenValue: prevSharedVal,
            writtenValue: nextShared,
            explanation: `Lost Update: ${thread.id} committed ${nextShared} using stale read (${thread.localRead}), clobbering ${otherThreadId}'s earlier update to ${prevSharedVal}!`,
          };
        }

        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'WRITE',
          threadId: thread.id,
          instruction: currentInst.label,
          isLostUpdate: isClobbering,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, shared: nextShared, status: 'COMPLETED' },
          explanation: isClobbering
            ? `CLOBBERING WRITE: ${thread.id} wrote ${nextShared} back to shared memory, overwriting earlier update!`
            : `${thread.id} committed ${nextShared} to shared memory. Routine complete.`,
        });
        break;
      }
      default:
        break;
    }
  } else {
    // -------------------------------------------------------------
    // WITH MUTEX EXECUTION PATH (Protected critical section)
    // -------------------------------------------------------------
    switch (currentInst.op) {
      case 'LOCK': {
        if (nextMutex === 1) {
          nextMutex = 0;
          nextMutexOwner = thread.id;
          thread.pc = 1;
          newEvents.push({
            id: `EVT-CTR-${stepNumber}`,
            step: stepNumber,
            type: 'LOCK_ACQUIRED',
            threadId: thread.id,
            instruction: currentInst.label,
            pcBefore,
            pcAfter: thread.pc,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, mutex: 0, mutexOwner: thread.id },
            explanation: `${thread.id} acquired mutex lock and entered exclusive critical section.`,
          });
        } else {
          // Mutex is held by peer -> Thread blocks!
          thread.status = 'BLOCKED';
          thread.waitingFor = 'mutex';
          nextWaitQueue.push(thread.id);
          newEvents.push({
            id: `EVT-CTR-${stepNumber}`,
            step: stepNumber,
            type: 'THREAD_BLOCKED',
            threadId: thread.id,
            instruction: currentInst.label,
            pcBefore,
            pcAfter: thread.pc,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, status: 'BLOCKED' },
            explanation: `Mutex locked by ${nextMutexOwner}. ${thread.id} blocked and queued in waitQueue.`,
          });
        }
        break;
      }
      case 'READ': {
        thread.localRead = prevState.shared;
        thread.readStep = stepNumber;
        thread.pc = 2;
        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'READ',
          threadId: thread.id,
          instruction: currentInst.label,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, localRead: thread.localRead },
          explanation: `${thread.id} read shared counter (${prevState.shared}) inside critical section.`,
        });
        break;
      }
      case 'COMPUTE': {
        thread.localComputed = (thread.localRead ?? prevState.shared) + 1;
        thread.pc = 3;
        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'COMPUTE',
          threadId: thread.id,
          instruction: currentInst.label,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, localComputed: thread.localComputed },
          explanation: `${thread.id} computed local increment: ${thread.localRead} + 1 = ${thread.localComputed}.`,
        });
        break;
      }
      case 'WRITE': {
        nextShared = thread.localComputed ?? (prevState.shared + 1);
        thread.pc = 4;
        newEvents.push({
          id: `EVT-CTR-${stepNumber}`,
          step: stepNumber,
          type: 'WRITE',
          threadId: thread.id,
          instruction: currentInst.label,
          pcBefore,
          pcAfter: thread.pc,
          before: beforeSnapshot,
          after: { ...beforeSnapshot, shared: nextShared },
          explanation: `${thread.id} committed ${nextShared} to shared memory inside critical section.`,
        });
        break;
      }
      case 'UNLOCK': {
        thread.pc = 5;
        thread.status = 'COMPLETED';

        if (nextWaitQueue.length > 0) {
          const wokenId = nextWaitQueue.shift();
          const wokenThread = { ...nextThreads[wokenId] };
          wokenThread.status = 'READY';
          wokenThread.waitingFor = null;
          wokenThread.pc = 1; // Advanced past LOCK!
          nextMutexOwner = wokenId;
          nextMutex = 0;
          nextThreads[wokenId] = wokenThread;

          newEvents.push({
            id: `EVT-CTR-${stepNumber}`,
            step: stepNumber,
            type: 'MUTEX_TRANSFERRED',
            threadId: thread.id,
            instruction: currentInst.label,
            pcBefore,
            pcAfter: thread.pc,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, mutexOwner: wokenId, status: 'COMPLETED' },
            explanation: `${thread.id} released mutex. Ownership transferred directly to waiting ${wokenId}.`,
          });
        } else {
          nextMutex = 1;
          nextMutexOwner = null;
          newEvents.push({
            id: `EVT-CTR-${stepNumber}`,
            step: stepNumber,
            type: 'UNLOCK',
            threadId: thread.id,
            instruction: currentInst.label,
            pcBefore,
            pcAfter: thread.pc,
            before: beforeSnapshot,
            after: { ...beforeSnapshot, mutex: 1, mutexOwner: null, status: 'COMPLETED' },
            explanation: `${thread.id} released mutex. Mutex lock is now FREE (1).`,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  nextThreads[thread.id] = thread;
  const allCompleted = Object.values(nextThreads).every((t) => t.status === 'COMPLETED');

  // If both completed and result doesn't equal expected, record fault if not already captured
  if (allCompleted && nextShared !== prevState.expectedFinal && !faultOccurred && !prevState.firstFault) {
    faultOccurred = {
      step: stepNumber,
      type: 'INCORRECT_FINAL_VALUE',
      expected: prevState.expectedFinal,
      actual: nextShared,
      explanation: `Execution completed with lost update: Expected final value ${prevState.expectedFinal}, but actual value is ${nextShared}.`,
    };
  }

  const nextState = {
    ...prevState,
    shared: nextShared,
    mutex: nextMutex,
    mutexOwner: nextMutexOwner,
    waitQueue: nextWaitQueue,
    threads: nextThreads,
    stepCounter: stepNumber,
    committedInstructions: prevState.committedInstructions + 1,
    events: [...newEvents, ...prevState.events].slice(0, 50),
    scheduleHistory: [...prevState.scheduleHistory, thread.id],
    isCompleted: allCompleted,
    firstFault: faultOccurred || prevState.firstFault,
  };

  return {
    nextState,
    executed: true,
    events: newEvents,
    faultOccurred,
  };
}

/**
 * Unified Transition Interface for Counter Engine:
 * transition(previousState, command) => { nextState, events, outcome }
 */
export function transitionCounter(prevState, command) {
  if (!command) {
    return { nextState: prevState, events: [], outcome: { executed: false, reason: 'Empty command' } };
  }

  switch (command.type) {
    case 'STEP_THREAD': {
      const result = stepCounterSimulation(prevState, command.threadId);
      return {
        nextState: result.nextState,
        events: result.events,
        outcome: {
          executed: result.executed,
          reason: result.reason,
          faultOccurred: result.faultOccurred,
        },
      };
    }
    case 'RESET': {
      const fresh = createInitialCounterState({
        withMutex: command.withMutex ?? prevState.withMutex,
        initialShared: command.initialShared ?? 2,
      });
      return {
        nextState: fresh,
        events: [],
        outcome: { executed: true, reset: true },
      };
    }
    default:
      return { nextState: prevState, events: [], outcome: { executed: false, reason: 'Unknown command' } };
  }
}

/**
 * Presets for Shared Counter
 */
export const COUNTER_PRESETS = {
  LOST_UPDATE: {
    id: 'LOST_UPDATE',
    name: 'Lost Update (Race Failure)',
    withMutex: false,
    description: 'Demonstrates stale-read clobbering. P1 and P2 both read 2 before either writes back. Final result is 3 (lost update).',
    schedule: ['P1', 'P2', 'P1', 'P2', 'P1', 'P2'],
    expectedOutcome: 'Final counter is 3 (1 update lost).',
    teachingNote: 'Because reads interleave before writes, P2 computes 3 based on the stale value 2 and overwrites P1\'s update.',
  },
  SERIALIZED_UNLOCKED: {
    id: 'SERIALIZED_UNLOCKED',
    name: 'Unlocked Serialized (Safe by Chance)',
    withMutex: false,
    description: 'Demonstrates that removing mutual exclusion permits a race, but does not guarantee every schedule fails.',
    schedule: ['P1', 'P1', 'P1', 'P2', 'P2', 'P2'],
    expectedOutcome: 'Final counter is 4 (Correct).',
    teachingNote: 'Because P1 runs to completion before P2 reads, P2 reads the fresh updated value 3. The absence of mutex did not fail here.',
  },
  PROTECTED: {
    id: 'PROTECTED',
    name: 'Mutex Protected (Guaranteed Math)',
    withMutex: true,
    description: 'Critical section serialization. P1 locks mutex. When P2 attempts entry, P2 is blocked until P1 commits and unlocks.',
    schedule: ['P1', 'P2', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2'],
    expectedOutcome: 'Final counter is 4 (Correct and protected).',
    teachingNote: 'Binary mutex lock guarantees mutual exclusion. P2 cannot read stale state because it is blocked in waitQueue until P1 unlocks.',
  },
};

/**
 * Evaluates live invariant checks on counter state
 */
export function validateCounterInvariants(state) {
  const violations = [];

  // Mutex consistency
  if (state.withMutex) {
    if (state.mutex === 1 && state.mutexOwner !== null) {
      violations.push(`Mutex marked free (1) but registered owner is ${state.mutexOwner}.`);
    }
    if (state.mutex === 0 && !state.mutexOwner) {
      violations.push('Mutex marked locked (0) but has null owner.');
    }
  }

  // Final correctness check when completed
  if (state.isCompleted && state.shared !== state.expectedFinal) {
    violations.push(
      `Lost update detected: Final counter is ${state.shared}, but expected mathematical result is ${state.expectedFinal}.`
    );
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

