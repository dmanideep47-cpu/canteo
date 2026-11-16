/**
 * CANTEO SYNCLAB — CLASSROOM EXPERIMENT WORKBENCH
 * 
 * Formal definitions for the six classroom experiments (A–F)
 * and the manual scheduling challenge.
 */

export const EXPERIMENT_STATUS = {
  NOT_RUN: 'Not run',
  IN_PROGRESS: 'In progress',
  OBSERVED: 'Observed',
  FAILED: 'Failed',
  INCONCLUSIVE: 'Inconclusive',
};

function matchesOp(sample, op) {
  if (!sample) return false;
  return sample.instructionOp === op || sample.operation === op || sample.lastInstruction?.op === op;
}

function findOpSample(history, op, processId = null) {
  return history.find((s) => matchesOp(s, op) && (!processId || s.processId === processId || s.lastInstruction?.processId === processId));
}

function findOpEvent(state, op, processId = null) {
  return (state?.events || []).find((e) => e.operation === op && (!processId || e.processId === processId));
}

export const CLASSROOM_EXPERIMENTS = [
  {
    id: 'full-buffer',
    letter: 'A',
    title: 'Experiment A · Full Buffer Backpressure',
    objective: 'Explain producer blocking under buffer saturation.',
    concept: 'Producer Backpressure & sem_wait(&empty)',
    setupDescription: 'Capacity 5. Five queued orders fill the buffer (empty=0, full=5). One additional producer (P6) is ready to submit. A kitchen consumer (C1) is available to free a slot.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addProducer(5);
      engine.runUntilBlocked();
      engine.addProducer(1); // P6 ready to attempt wait(empty)
      engine.addConsumer(1); // C1 available to free a slot
      engine.clearHistory('Experiment A: Full Buffer loaded');
    },
    prediction: {
      question: 'What must happen before the waiting producer (P6) can continue into the buffer?',
      options: [
        { id: 'opt-a', text: 'A consumer must remove an order and call signal(empty) to return a free slot permit.', correct: true },
        { id: 'opt-b', text: 'The mutex is unlocked so P6 can immediately write without waiting for a slot.', correct: false },
        { id: 'opt-c', text: 'The circular buffer automatically expands beyond capacity 5.', correct: false },
        { id: 'opt-d', text: 'P6 will overwrite the oldest unread order at the write position.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'Under bounded-buffer synchronization, the empty semaphore counts vacant slots. When empty reaches 0, any producer calling wait(empty) blocks. It cannot resume until a consumer calls signal(empty). Even after waking, waking places P6 in the READY state; P6 must acquire the mutex before inserting.',
    },
    guideSteps: [
      'Click "Step Instruction" or "Step Process" on Producer P6 to observe it execute wait(empty) with empty=0 and enter the BLOCKED state.',
      'Click "Step Process" on Consumer C1 to remove an order, advance the read pointer, release the mutex, and execute signal(empty).',
      'Observe signal(empty) unblock P6 from BLOCKED to READY (signaling makes P6 eligible to run, not immediately running).',
      'Step Producer P6 to completion: observe it acquire the mutex and safely insert its order into the freed slot.',
    ],
    checks: [
      {
        id: 'check-p6-blocked',
        label: '1. Producer Block on Full Buffer',
        expected: 'Producer P6 attempts wait(empty) when empty == 0 and enters the BLOCKED state.',
        evaluate: (state, history) => {
          const blockSample = history.find((s) => s.processes?.some((p) => p.id === 'P6' && p.state === 'BLOCKED' && p.waitingFor === 'empty'));
          const blockEvent = state.events?.find((e) => e.processId === 'P6' && (e.operation === 'waitEmpty' || e.type === 'blocked') && (e.transition?.to === 'BLOCKED' || e.message?.toLowerCase().includes('blocked')));
          if (blockSample || blockEvent) {
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${blockSample?.seq ?? blockEvent?.step ?? 'recorded'}: P6 called wait(empty) with empty=0; entered BLOCKED state waiting for a free slot.`,
              stepSeq: blockSample?.seq ?? blockEvent?.step ?? null,
            };
          }
          const p6 = state.processes?.find((p) => p.id === 'P6');
          if (p6 && p6.pc === 0) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'P6 is READY at pc=0. Advance P6 to observe the blocked transition.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Producer blocking has not yet been executed.', stepSeq: null };
        },
      },
      {
        id: 'check-c1-removal',
        label: '2. Consumer Removal & Slot Signaling',
        expected: 'Consumer C1 removes an order (occupancy 5 → 4) and calls signal(empty) to return a permit.',
        evaluate: (state, history) => {
          const removalSample = history.find((s) => (s.instructionOp === 'remove' || s.operation === 'remove') && (s.processId === 'C1' || !s.processId));
          const removalEvent = state.events?.find((e) => e.processId === 'C1' && e.operation === 'remove');
          if (removalSample || removalEvent) {
            const seq = removalSample?.seq ?? removalEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: C1 removed order from slot 0; buffer occupancy decreased from 5 to 4.`,
              stepSeq: seq,
            };
          }
          const c1 = state.processes?.find((p) => p.id === 'C1');
          if (c1 && c1.pc > 0) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'C1 has begun execution but has not yet completed removal.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Consumer C1 has not yet removed an order.', stepSeq: null };
        },
      },
      {
        id: 'check-p6-unblocked',
        label: '3. Producer Unblocked to Eligible State',
        expected: 'signal(empty) awakens P6 to READY with an empty permit held (waking grants eligibility, not immediate CPU execution).',
        evaluate: (state, history) => {
          const wakeSample = history.find((s) => s.wokenProcess === 'P6' || (s.processes?.some((p) => p.id === 'P6' && (p.state === 'READY' || p.state === 'RUNNING') && p.permit)));
          const wakeEvent = state.events?.find((e) => (e.processId === 'P6' || e.resource === 'empty') && (e.type === 'wake' || e.message?.includes('woke P6') || (e.transition?.to === 'READY' && e.processId === 'P6')));
          if (wakeSample || wakeEvent) {
            const seq = wakeSample?.seq ?? wakeEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: P6 transitioned from BLOCKED to READY. Note: Waking grants eligibility; process still must be scheduled.`,
              stepSeq: seq,
            };
          }
          const removalDone = state.events?.some((e) => e.processId === 'C1' && e.operation === 'remove');
          if (removalDone) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Slot freed. Advance C1 to execute signal(empty) and wake P6.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'P6 is still waiting for a slot permit.', stepSeq: null };
        },
      },
      {
        id: 'check-p6-insertion',
        label: '4. Producer Completes Insertion',
        expected: 'Producer P6 acquires mutex and writes its order into the freed slot.',
        evaluate: (state, history) => {
          const insertSample = history.find((s) => (s.instructionOp === 'insert' || s.operation === 'insert') && s.processId === 'P6');
          const insertEvent = state.events?.find((e) => e.processId === 'P6' && e.operation === 'insert');
          if (insertSample || insertEvent) {
            const seq = insertSample?.seq ?? insertEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: P6 acquired mutex and successfully inserted order into freed slot 0.`,
              stepSeq: seq,
            };
          }
          const p6 = state.processes?.find((p) => p.id === 'P6');
          if (p6 && (p6.state === 'READY' || p6.state === 'RUNNING') && p6.permit) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'P6 is unblocked and holding its permit. Step P6 to complete insertion.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'P6 has not completed insertion yet.', stepSeq: null };
        },
      },
    ],
    takeaway: 'When a bounded buffer is full (empty=0), producers block on sem_wait(&empty). They cannot resume until a consumer calls sem_post(&empty). Signaling moves the blocked process to the READY queue; execution only resumes when scheduled.',
  },

  {
    id: 'empty-buffer',
    letter: 'B',
    title: 'Experiment B · Empty Buffer Consumer Blocking',
    objective: 'Explain consumer blocking under empty queue conditions.',
    concept: 'Consumer Starvation Prevention & sem_wait(&full)',
    setupDescription: 'Empty queue (occupancy 0, full=0, empty=5). One kitchen consumer (C1) is requesting an order. One student producer (P1) is available to submit.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addConsumer(1); // C1 ready at pc=0
      engine.addProducer(1); // P1 ready at pc=0
      engine.clearHistory('Experiment B: Empty Buffer loaded');
    },
    prediction: {
      question: 'What prevents Consumer C1 from reading an empty slot when queue occupancy is 0?',
      options: [
        { id: 'opt-a', text: 'wait(full) blocks C1 because full == 0, preventing queue underflow before reading.', correct: true },
        { id: 'opt-b', text: 'The circular read pointer cannot move when at index 0.', correct: false },
        { id: 'opt-c', text: 'The mutex prevents all consumers from entering the kitchen.', correct: false },
        { id: 'opt-d', text: 'C1 reads a null order and crashes the simulation.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'The semaphore "full" tracks available published items. When full is 0, any consumer executing wait(full) blocks cleanly, preventing premature or invalid reads from empty buffer slots.',
    },
    guideSteps: [
      'Step Consumer C1: Observe it execute wait(full) with full=0 and transition to BLOCKED waiting on semaphore full.',
      'Step Producer P1: Observe P1 acquire empty permit, acquire mutex, insert order into slot 0, advance write pointer, release mutex, and call signal(full).',
      'Observe signal(full) wake Consumer C1 from BLOCKED to READY.',
      'Step Consumer C1 to completion: C1 acquires mutex, removes the order from slot 0, and begins kitchen preparation.',
    ],
    checks: [
      {
        id: 'check-c1-blocked',
        label: '1. Consumer Block on Empty Buffer',
        expected: 'Consumer C1 calls wait(full) when full == 0 and blocks cleanly.',
        evaluate: (state, history) => {
          const blockSample = history.find((s) => s.processes?.some((p) => p.id === 'C1' && p.state === 'BLOCKED' && p.waitingFor === 'full'));
          const blockEvent = state.events?.find((e) => e.processId === 'C1' && (e.operation === 'waitFull' || e.type === 'blocked') && (e.transition?.to === 'BLOCKED' || e.message?.toLowerCase().includes('blocked')));
          if (blockSample || blockEvent) {
            const seq = blockSample?.seq ?? blockEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq}: C1 called wait(full) with full=0; blocked without attempting an invalid read.`,
              stepSeq: seq,
            };
          }
          const c1 = state.processes?.find((p) => p.id === 'C1');
          if (c1 && c1.pc === 0) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'C1 is READY. Step C1 to observe the wait(full) block.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Consumer blocking has not yet occurred.', stepSeq: null };
        },
      },
      {
        id: 'check-p1-publish',
        label: '2. Producer Insert & Signal Full',
        expected: 'Producer P1 safely inserts an order into slot 0 and calls signal(full).',
        evaluate: (state, history) => {
          const insertSample = findOpSample(history, 'insert', 'P1');
          const insertEvent = findOpEvent(state, 'insert', 'P1');
          if (insertSample || insertEvent) {
            const seq = insertSample?.seq ?? insertEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: P1 inserted order into slot 0 and signaled full availability.`,
              stepSeq: seq,
            };
          }
          const p1 = state.processes?.find((p) => p.id === 'P1');
          if (p1 && p1.pc > 0) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'P1 is stepping instructions. Continue until insertion is complete.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'P1 has not yet inserted an order.', stepSeq: null };
        },
      },
      {
        id: 'check-c1-dequeue',
        label: '3. Consumer Wake & Order Removal',
        expected: 'Consumer C1 unblocks, acquires mutex, removes the order from slot 0, and begins preparation.',
        evaluate: (state, history) => {
          const removeSample = findOpSample(history, 'remove', 'C1');
          const removeEvent = findOpEvent(state, 'remove', 'C1');
          if (removeSample || removeEvent) {
            const seq = removeSample?.seq ?? removeEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: C1 woke, acquired mutex, and safely dequeued the published order.`,
              stepSeq: seq,
            };
          }
          const c1 = state.processes?.find((p) => p.id === 'C1');
          if (c1 && (c1.state === 'READY' || c1.state === 'RUNNING') && c1.permit) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'C1 is unblocked. Step C1 to complete order removal.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Order removal has not occurred yet.', stepSeq: null };
        },
      },
    ],
    takeaway: 'Consumers block on sem_wait(&full) whenever the buffer is empty (full=0). Underflow is structurally impossible because no process can reach the removal instruction without holding a valid item permit.',
  },

  {
    id: 'two-consumers',
    letter: 'C',
    title: 'Experiment C · Exactly-Once Order Removal',
    objective: 'Demonstrate exactly-once order removal under competing consumers.',
    concept: 'Permit Conservation & Race Prevention',
    setupDescription: 'Buffer has exactly 1 queued order (full=1, empty=4). Two kitchen consumers (C1 and C2) are both ready to take an order.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addProducer(1);
      engine.runUntilBlocked(); // 1 order in slot 0, full=1, empty=4
      engine.addConsumer(2); // C1 and C2 ready
      engine.clearHistory('Experiment C: Two Consumers, One Order loaded');
    },
    prediction: {
      question: 'Can both consumers remove this single order from the queue?',
      options: [
        { id: 'opt-a', text: 'No. Exactly one consumer receives the single full permit; the second blocks on wait(full).', correct: true },
        { id: 'opt-b', text: 'Yes. Both consumers can read the same slot if they execute concurrently.', correct: false },
        { id: 'opt-c', text: 'Yes. The mutex duplicates the order so both kitchen workers get a copy.', correct: false },
        { id: 'opt-d', text: 'Both consumers block permanently in a deadlock.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'Because full == 1, exactly one call to wait(full) succeeds and decrements full to 0. Whichever consumer executes wait(full) first claims the sole item permit. The second consumer finds full == 0 and blocks cleanly without touching the shared buffer.',
    },
    guideSteps: [
      'Step either consumer (e.g. C1 or C2): observe it successfully execute wait(full) and decrement full from 1 to 0.',
      'Step the competing consumer: observe it execute wait(full) with full=0 and block in FIFO order.',
      'Complete the first consumer: observe it acquire the mutex, remove the single order, advance read pointer, and release the mutex.',
      'Verify that only one order was removed, the buffer occupancy is 0, and no duplicate consumption occurred.',
    ],
    checks: [
      {
        id: 'check-single-permit',
        label: '1. Exactly One Full Permit Granted',
        expected: 'One consumer claims the sole item permit (full 1 → 0), leaving 0 permits available.',
        evaluate: (state, history) => {
          const permitSample = history.find((s) => s.full === 0 && s.reservedFull === 1);
          const permitHolders = state.processes?.filter((p) => p.type === 'CONSUMER' && (p.permit || p.result));
          if (permitHolders && permitHolders.length >= 1) {
            const winner = permitHolders[0].id;
            const seq = permitSample?.seq ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: ${winner} claimed the single full permit. Full count decremented to 0.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Step either consumer to claim the available permit.', stepSeq: null };
        },
      },
      {
        id: 'check-second-consumer-blocks',
        label: '2. Competing Consumer Blocks',
        expected: 'The second consumer attempts wait(full) with full == 0 and is blocked.',
        evaluate: (state, history) => {
          const blockedConsumer = state.processes?.find((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED' && p.waitingFor === 'full');
          const blockSample = history.find((s) => s.processes?.some((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED' && p.waitingFor === 'full'));
          if (blockedConsumer || blockSample) {
            const loser = blockedConsumer?.id ?? blockSample?.processes?.find((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED')?.id ?? 'Second consumer';
            const seq = blockSample?.seq ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: ${loser} blocked on wait(full). Cannot proceed because full == 0.`,
              stepSeq: seq,
            };
          }
          const activeConsumers = state.processes?.filter((p) => p.type === 'CONSUMER');
          if (activeConsumers.some((p) => p.permit)) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'One consumer holds permit. Step the other consumer to demonstrate blocking.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Neither consumer has stepped yet.', stepSeq: null };
        },
      },
      {
        id: 'check-exactly-once-removal',
        label: '3. Exactly-Once Order Removal',
        expected: 'Exactly one order is removed; buffer occupancy becomes 0; order integrity passes.',
        evaluate: (state, history) => {
          const removalSamples = history.filter((s) => s.instructionOp === 'remove');
          const removalEvents = (state.events || []).filter((e) => e.type === 'remove');
          const count = removalSamples.length > 0 ? removalSamples.length : removalEvents.length;
          if (count === 1 && state.occupancy === 0 && (state.integrity?.passed ?? true)) {
            const seq = removalSamples[0]?.seq ?? removalEvents[0]?.step ?? null;
            const proc = removalSamples[0]?.processId ?? removalEvents[0]?.processId ?? 'Consumer';
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Exactly one order removed by ${proc}. Zero duplicates. Invariants pass.`,
              stepSeq: seq,
            };
          }
          if (count > 1) {
            return { status: EXPERIMENT_STATUS.FAILED, evidenceText: 'Violation: Multiple removals occurred for a single order.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Complete the winning consumer to finalize order removal.', stepSeq: null };
        },
      },
    ],
    takeaway: 'Semaphore permits are conserved integer tokens. In a two-consumer competition for one order, only one can acquire the single full permit. The other blocks cleanly at wait(full), preventing duplicate claims.',
  },

  {
    id: 'mutex-contention',
    letter: 'D',
    title: 'Experiment D · Mutex Contention vs Semaphore Permits',
    objective: 'Distinguish semaphore counting permits from critical section mutual exclusion.',
    concept: 'Mutex Serialization & FIFO Wait Queuing',
    setupDescription: 'At least 2 available orders (occupancy 2, full=2, empty=3). Two consumers (C1 and C2) both have available work.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addProducer(2);
      engine.runUntilBlocked(); // 2 orders in slots 0 and 1, full=2
      engine.addConsumer(2); // C1 and C2 ready
      engine.clearHistory('Experiment D: Mutex Contention loaded');
    },
    prediction: {
      question: 'If both C1 and C2 successfully acquire full permits, can they modify the buffer pointers at the same time?',
      options: [
        { id: 'opt-a', text: 'No. The mutex serializes buffer access; only one consumer can hold the mutex at any instant.', correct: true },
        { id: 'opt-b', text: 'Yes. Holding a full permit bypasses the mutex lock entirely.', correct: false },
        { id: 'opt-c', text: 'Yes. Consumers do not need mutual exclusion because they only read.', correct: false },
        { id: 'opt-d', text: 'No. The second consumer is killed by the OS kernel.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'A semaphore permit only guarantees item availability. It does NOT protect shared pointer variables. Mutual exclusion (the mutex) is required to ensure only one thread at a time enters the critical section to read/advance readPosition.',
    },
    guideSteps: [
      'Step Consumer C1 one instruction to execute wait(full) — C1 obtains permit #1 (pc moves to waitMutex).',
      'Step Consumer C2 one instruction to execute wait(full) — C2 obtains permit #2 (pc moves to waitMutex). Both hold full permits!',
      'Step Consumer C1 one instruction to execute wait(mutex) — C1 acquires mutex (mutex: 1 → 0, owner: C1).',
      'Step Consumer C2 one instruction to execute wait(mutex) — Mutex contention! C2 blocks and is enqueued in the mutex wait queue.',
      'Step C1 through remove, advanceRead, and releaseMutex — observe mutex handoff to C2, which then safely completes its own removal.',
    ],
    checks: [
      {
        id: 'check-both-permits',
        label: '1. Both Consumers Hold Full Permits',
        expected: 'Both C1 and C2 successfully acquire full permits and advance to wait(mutex).',
        evaluate: (state, history) => {
          const bothSample = history.find((s) => {
            const c1 = s.processes?.find((p) => p.id === 'C1');
            const c2 = s.processes?.find((p) => p.id === 'C2');
            return c1 && c2 && c1.permit && c2.permit;
          });
          const c1 = state.processes?.find((p) => p.id === 'C1');
          const c2 = state.processes?.find((p) => p.id === 'C2');
          if (bothSample || (c1 && c2 && (c1.permit || c1.pc >= 1) && (c2.permit || c2.pc >= 1))) {
            const seq = bothSample?.seq ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Both C1 and C2 hold item permits simultaneously (reservedFull=2).`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Step both C1 and C2 through wait(full) to acquire permits.', stepSeq: null };
        },
      },
      {
        id: 'check-mutex-waiter',
        label: '2. Mutex Contention & Waiter Enqueuing',
        expected: 'One consumer owns the mutex; the second consumer attempts wait(mutex) and blocks in the FIFO mutex queue.',
        evaluate: (state, history) => {
          const contentionSample = history.find((s) => s.mutexOwner !== null && s.processes?.some((p) => p.waitingFor === 'mutex'));
          const contentionEvent = state.events?.find((e) => e.message?.toLowerCase().includes('blocked on mutex') || (e.operation === 'waitMutex' && e.transition?.to === 'WAITING'));
          if (contentionSample || contentionEvent) {
            const owner = contentionSample?.mutexOwner ?? 'C1';
            const waiter = contentionSample?.processes?.find((p) => p.waitingFor === 'mutex')?.id ?? 'C2';
            const seq = contentionSample?.seq ?? contentionEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq}: Mutex contention observed! ${owner} owns mutex; ${waiter} blocked in FIFO mutex queue.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Acquire mutex with one consumer, then step the other to trigger contention.', stepSeq: null };
        },
      },
      {
        id: 'check-serialized-removals',
        label: '3. Serialized Removals & Pointer Protection',
        expected: 'Both consumers complete protected removals in sequence; readPosition increments safely without collision.',
        evaluate: (state, history) => {
          const removalEvents = (state.events || []).filter((e) => e.operation === 'remove');
          const removalSamples = history.filter((s) => matchesOp(s, 'remove'));
          const count = Math.max(removalEvents.length, removalSamples.length);
          if (count >= 2 && (state.integrity?.passed ?? true)) {
            const seq = removalSamples[removalSamples.length - 1]?.seq ?? removalEvents[0]?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Two distinct orders dequeued via serialized critical sections. Invariants strictly hold.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Complete both consumers to verify serialized pointer advancement.', stepSeq: null };
        },
      },
    ],
    takeaway: 'Holding an item permit does NOT grant safe queue access. Item permits regulate capacity, while the mutex serializes pointer manipulation so that concurrent consumers never collide on readPosition.',
  },

  {
    id: 'wraparound',
    letter: 'E',
    title: 'Experiment E · Circular-Buffer Wraparound & Modulo Indexing',
    objective: 'Explain modulo indexing and FIFO preservation across buffer wrap.',
    concept: 'Circular Modulo Indexing ((index + 1) % N)',
    setupDescription: 'Buffer loaded with 4 orders in slots 0..3 (writePosition=4). One consumer (C1) and two producers (P5, P6) are ready to demonstrate slot reuse and modulo wraparound.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addProducer(4);
      engine.runUntilBlocked(); // 4 orders in slots 0, 1, 2, 3; writePosition = 4
      engine.addConsumer(1); // C1 ready to consume slot 0
      engine.addProducer(2); // P5 and P6 ready to insert and wrap around
      engine.clearHistory('Experiment E: Circular Wraparound loaded');
    },
    prediction: {
      question: 'When writePosition is at slot 4 (the last slot), what is its next index after inserting an order?',
      options: [
        { id: 'opt-a', text: 'Slot 0, because (4 + 1) mod 5 == 0 wraps back to the head of the circular buffer.', correct: true },
        { id: 'opt-b', text: 'Slot 5, extending the array indefinitely.', correct: false },
        { id: 'opt-c', text: 'Slot 4 again, overwriting the same position.', correct: false },
        { id: 'opt-d', text: 'An out-of-bounds index exception is thrown.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'In a bounded circular buffer of size N=5, indices wrap modulo 5: (4 + 1) % 5 = 0. Once a slot is consumed, it becomes free for reuse by subsequent producers without shifting elements in memory.',
    },
    guideSteps: [
      'Step Producer P5 to write into slot 4 and observe writePosition advance from 4 to 0 modulo 5.',
      'Step Consumer C1 to dequeue the order from slot 0, freeing slot 0.',
      'Step Producer P6 to insert into slot 0 — observe slot 0 being successfully reused!',
      'Verify that all orders are consumed in strict FIFO sequence without loss or duplication.',
    ],
    checks: [
      {
        id: 'check-slot-4-write',
        label: '1. Order Written to Buffer Boundary (Slot 4)',
        expected: 'Producer P5 writes order into slot 4.',
        evaluate: (state, history) => {
          const slot4Event = (state.events || []).find((e) => e.operation === 'insert' && (e.slot === 4 || e.message?.includes('slot 4') || e.variablesBefore?.writePosition === 4));
          const slot4Sample = history.find((s) => matchesOp(s, 'insert') && (s.writePosition === 4 || s.details?.slot === 4));
          if (slot4Sample || slot4Event) {
            const seq = slot4Sample?.seq ?? slot4Event?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: P5 inserted order into boundary slot 4.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Step Producer P5 to insert into slot 4.', stepSeq: null };
        },
      },
      {
        id: 'check-modulo-wrap',
        label: '2. Modulo-5 Pointer Wraparound (4 → 0)',
        expected: 'advanceWrite advances writePosition from 4 to 0 modulo 5.',
        evaluate: (state, history) => {
          const wrapSample = history.find((s) => matchesOp(s, 'advanceWrite') && (s.variableChanges?.before?.writePosition === 4 && s.variableChanges?.after?.writePosition === 0));
          const wrapEvent = (state.events || []).find((e) => e.operation === 'advanceWrite' && (e.message?.includes('from 4 to 0') || (e.variablesBefore?.writePosition === 4 && e.variablesAfter?.writePosition === 0)));
          if (wrapSample || wrapEvent) {
            const seq = wrapSample?.seq ?? wrapEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: advanceWrite executed modulo five: (4 + 1) % 5 = 0. Pointer wrapped to slot 0.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Step P5 through advanceWrite to observe wraparound.', stepSeq: null };
        },
      },
      {
        id: 'check-slot-reuse',
        label: '3. Safe Slot Reuse & FIFO Preservation',
        expected: 'Slot 0 is freed by consumer and safely reused by subsequent producer with strict FIFO preservation.',
        evaluate: (state, history) => {
          const removeFound = (state.events || []).some((e) => e.operation === 'remove') || history.some((s) => matchesOp(s, 'remove'));
          const insertEvents = (state.events || []).filter((e) => e.operation === 'insert');
          const insertSamples = history.filter((s) => matchesOp(s, 'insert'));
          const totalInserts = Math.max(insertEvents.length, insertSamples.length);
          if (removeFound && totalInserts >= 2 && (state.integrity?.passed ?? true)) {
            const lastInsert = insertSamples[insertSamples.length - 1] ?? insertEvents[0];
            const seq = lastInsert?.seq ?? lastInsert?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Slot 0 was freed and reused. FIFO queue order preserved without data corruption.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Free slot 0 with C1, then step P6 to reuse slot 0.', stepSeq: null };
        },
      },
    ],
    takeaway: 'Circular buffers reuse memory slots in O(1) time without array reallocation or shifting. Modulo arithmetic (index + 1) % N ensures strict FIFO preservation across boundary wraparounds.',
  },

  {
    id: 'independent-prep',
    letter: 'F',
    title: 'Experiment F · Independent Kitchen Preparation',
    objective: 'Distinguish queue critical section protection from long-running kitchen work.',
    concept: 'Decoupling Critical Section from Work',
    setupDescription: 'At least 2 assigned orders in the queue. Two consumers (C1 and C2) ready to dequeue and prepare dishes concurrently outside the mutex.',
    setupEngine: (engine) => {
      engine.reset();
      engine.addProducer(3);
      engine.runUntilBlocked(); // 3 orders in queue
      engine.addConsumer(2); // C1 and C2 ready
      engine.clearHistory('Experiment F: Independent Preparation loaded');
    },
    prediction: {
      question: 'Should a kitchen worker hold the queue mutex while cooking food?',
      options: [
        { id: 'opt-a', text: 'No! The mutex must be released immediately after dequeue so other processes can access the queue while cooking occurs.', correct: true },
        { id: 'opt-b', text: 'Yes, because cooking requires access to the shared queue slots.', correct: false },
        { id: 'opt-c', text: 'Yes, to prevent students from placing new orders while cooking is in progress.', correct: false },
        { id: 'opt-d', text: 'It makes no difference to throughput or concurrency.', correct: false },
      ],
      correctId: 'opt-a',
      explanation: 'Holding a critical section lock during slow independent work (like cooking or I/O) destroys concurrency and causes artificial bottlenecks. The mutex should only be held during the brief pointer update.',
    },
    guideSteps: [
      'Step Consumer C1 until it dequeues its order, releases the mutex, and enters PREPARING state.',
      'Step Consumer C2 until it dequeues its order, releases the mutex, and also enters PREPARING state.',
      'Observe both workers PREPARING concurrently while the mutex is unlocked (mutex=1, owner: null).',
      'Add a new student producer: observe that it can access the buffer even while both workers are cooking!',
      'Advance kitchen ticks: observe preparation progress tick forward independently outside the lock.',
    ],
    checks: [
      {
        id: 'check-mutex-released',
        label: '1. Mutex Released Immediately Upon Dequeue',
        expected: 'Consumer releases queue mutex immediately after removing order, before beginning preparation.',
        evaluate: (state, history) => {
          const released = history.some((s) => matchesOp(s, 'releaseMutex')) || (state.events || []).some((e) => e.operation === 'releaseMutex');
          const consumerPreparing = (state.workers || []).some((w) => w.state === 'PREPARING') || (state.processes || []).some((p) => p.type === 'CONSUMER' && p.state === 'PREPARING');
          if (released && (consumerPreparing || state.mutexOwner === null)) {
            const releaseSample = history.find((s) => matchesOp(s, 'releaseMutex'));
            const releaseEvent = (state.events || []).find((e) => e.operation === 'releaseMutex');
            const seq = releaseSample?.seq ?? releaseEvent?.step ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Consumer released mutex immediately after dequeue; critical section exited.`,
              stepSeq: seq,
            };
          }
          return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Step a consumer through dequeue and releaseMutex.', stepSeq: null };
        },
      },
      {
        id: 'check-concurrent-prep',
        label: '2. Concurrent Preparation Outside Lock',
        expected: 'Multiple consumers cook in parallel while mutex is free (mutex == 1, owner == null).',
        evaluate: (state, history) => {
          const concurrentSample = history.find((s) => {
            const prepCount = s.workers?.filter((w) => w.state === 'PREPARING').length ?? 0;
            return prepCount >= 2 && s.mutexOwner === null;
          });
          const livePrepCount = state.workers?.filter((w) => w.state === 'PREPARING').length ?? 0;
          if (concurrentSample || (livePrepCount >= 2 && state.mutexOwner === null)) {
            const seq = concurrentSample?.seq ?? null;
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: `Step ${seq ?? 'recorded'}: Two kitchen workers PREPARING concurrently outside the lock (mutex is unlocked).`,
              stepSeq: seq,
            };
          }
          if (livePrepCount === 1) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: '1 worker cooking. Step C2 to achieve concurrent preparation.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Neither worker has entered preparation yet.', stepSeq: null };
        },
      },
      {
        id: 'check-unblocked-queue',
        label: '3. Unblocked Queue Access During Cooking',
        expected: 'The shared buffer remains accessible to producers while kitchen preparation proceeds in parallel.',
        evaluate: (state, history) => {
          const producerWorkedWhileCooking = history.some((s) => {
            const prepActive = s.workers?.some((w) => w.state === 'PREPARING');
            return prepActive && (s.processId?.startsWith('P') || s.occupancy > 0);
          });
          if (producerWorkedWhileCooking && (state.integrity?.passed ?? true)) {
            return {
              status: EXPERIMENT_STATUS.OBSERVED,
              evidenceText: 'Buffer access remained fully operational and unblocked while dishes cooked in parallel.',
              stepSeq: null,
            };
          }
          const prepActive = state.workers?.some((w) => w.state === 'PREPARING');
          if (prepActive) {
            return { status: EXPERIMENT_STATUS.IN_PROGRESS, evidenceText: 'Workers are cooking. Queue mutex is free and accessible.', stepSeq: null };
          }
          return { status: EXPERIMENT_STATUS.NOT_RUN, evidenceText: 'Queue concurrency check pending worker preparation.', stepSeq: null };
        },
      },
    ],
    takeaway: 'Critical sections should be as small as possible. In producer-consumer systems, only pointer modifications belong inside the mutex. Long-running workloads (like kitchen cooking or I/O) must execute outside the lock to preserve throughput.',
  },
];

/**
 * Manual Scheduling Challenge Logic:
 * "Schedule two consumers safely"
 */
export const MANUAL_SCHEDULING_CHALLENGE = {
  id: 'schedule-consumers',
  title: 'Challenge · Schedule Two Consumers Safely',
  prompt: 'You are the CPU scheduler. Coordinate two kitchen consumers (C1 and C2) to safely retrieve two queued orders without race hazards, underflow, or mutex violations.',
  setupDescription: 'Queue contains 2 orders (ORD101, ORD102). Two consumers (C1, C2) are ready at pc=0.',
  setupEngine: (engine) => {
    engine.reset();
    engine.addProducer(2);
    engine.runUntilBlocked(); // 2 orders in queue
    engine.addConsumer(2); // C1 and C2 ready
    engine.clearHistory('Challenge: Schedule Two Consumers Safely loaded');
  },
};

/**
 * Inspects engine and state to determine runnable vs blocked processes
 * and whether a proposed dispatch is conceptually valid.
 */
export function evaluateSchedulerTurn(engine, processId) {
  const state = engine.snapshot();
  const process = state.processes?.find((p) => p.id === processId);

  if (!process) {
    return {
      valid: false,
      rejectionReason: `Process ${processId} does not exist in the active process table.`,
    };
  }

  if (process.state === 'BLOCKED' || process.state === 'WAITING') {
    const reason = process.waitingFor === 'empty'
      ? 'Blocked waiting for a free slot permit (empty == 0).'
      : process.waitingFor === 'full'
      ? 'Blocked waiting for an available order permit (full == 0).'
      : process.waitingFor === 'mutex'
      ? `Blocked waiting for the mutex lock currently owned by ${state.mutexOwner}.`
      : 'Blocked on a synchronization resource.';
    return {
      valid: false,
      rejectionReason: `Rejected: ${processId} is in the ${process.state} state (${reason}). A blocked thread cannot be dispatched by the CPU scheduler until unblocked by an operating system signal.`,
    };
  }

  if (process.state === 'COMPLETED') {
    return {
      valid: false,
      rejectionReason: `Rejected: ${processId} has already completed its instruction stream.`,
    };
  }

  return { valid: true };
}

/**
 * Generates structured explanation for a completed manual scheduling step.
 */
export function explainSchedulerStep(executedOp, processId, beforeState, afterState) {
  switch (executedOp) {
    case 'waitFull':
      return `${processId} executed sem_wait(&full). Decremented available orders from ${beforeState.full} to ${afterState.full} and acquired an item permit.`;
    case 'waitEmpty':
      return `${processId} executed sem_wait(&empty). Decremented vacant slots from ${beforeState.empty} to ${afterState.empty} and acquired a slot permit.`;
    case 'waitMutex':
      return `${processId} acquired the mutex lock (mutex 1 → 0). ${processId} has entered the critical section; all other processes are now barred from modifying the buffer pointers.`;
    case 'remove':
      return `${processId} removed order from slot ${beforeState.readPosition}. Critical section protects against simultaneous reads.`;
    case 'advanceRead':
      return `${processId} advanced the circular read pointer modulo 5 (${beforeState.readPosition} → ${afterState.readPosition}).`;
    case 'releaseMutex':
      return `${processId} released the mutex (mutex 0 → 1). Critical section exited. If another process was waiting in the FIFO mutex queue, ownership is handed off.`;
    case 'signalEmpty':
      return `${processId} signaled empty (sem_post(&empty)). Slot returned to pool (empty: ${beforeState.empty} → ${afterState.empty}); wakes any blocked producer.`;
    case 'signalFull':
      return `${processId} signaled full (sem_post(&full)). Order published (full: ${beforeState.full} → ${afterState.full}); wakes any blocked consumer.`;
    default:
      return `${processId} executed ${executedOp}.`;
  }
}

/**
 * Compares an experiment's checks against the live simulation state and history.
 */
export function evaluateExperimentChecks(experiment, state, history) {
  if (!experiment || !experiment.checks) return [];
  const historyArray = Array.isArray(history) ? history : (history?.samples || state?.executionHistory || []);
  return experiment.checks.map((check) => {
    const result = check.evaluate(state, historyArray);
    return {
      id: check.id,
      label: check.label,
      expected: check.expected,
      status: result.status,
      evidenceText: result.evidenceText,
      stepSeq: result.stepSeq,
    };
  });
}

/**
 * Creates structured report object suitable for export and printable display.
 */
export function buildExperimentReport({
  studentName = 'Student',
  studentId = 'STUDENT-01',
  experiment,
  predictionAnswer,
  predictionHypothesis = '',
  conclusion = '',
  state,
  history = [],
}) {
  const historyArray = Array.isArray(history) ? history : (history?.samples || state?.executionHistory || []);
  const evaluatedChecks = evaluateExperimentChecks(experiment, state, historyArray);
  const totalChecks = evaluatedChecks.length;
  const observedCount = evaluatedChecks.filter((c) => c.status === EXPERIMENT_STATUS.OBSERVED).length;
  const isComplete = observedCount === totalChecks;

  const selectedOption = experiment.prediction?.options?.find((o) => o.id === predictionAnswer);

  return {
    reportId: `CANTEO-REPORT-${Date.now()}`,
    timestamp: new Date().toISOString(),
    studentName,
    studentId,
    experimentId: experiment.id,
    experimentTitle: experiment.title,
    objective: experiment.objective,
    concept: experiment.concept,
    initialConfiguration: experiment.setupDescription,
    prediction: {
      question: experiment.prediction?.question ?? '',
      selectedOption: selectedOption?.text ?? 'No prediction recorded',
      isCorrect: selectedOption?.correct ?? false,
      hypothesis: predictionHypothesis,
      explanation: experiment.prediction?.explanation ?? '',
    },
    executionSummary: {
      totalSteps: historyArray.length,
      currentOccupancy: state.occupancy,
      finalSemaphores: {
        empty: state.empty,
        full: state.full,
        mutex: state.mutex,
        mutexOwner: state.mutexOwner,
      },
      integrityPassed: state.integrity?.passed ?? false,
      status: isComplete ? 'Completed & Verified' : 'Incomplete',
    },
    checks: evaluatedChecks,
    conclusion: conclusion || experiment.takeaway,
    events: historyArray.slice(-25).map((s) => ({
      seq: s.seq,
      process: s.lastInstruction?.processId ?? 'SYSTEM',
      operation: s.lastInstruction?.op ?? s.kind,
      occupancy: s.occupancy,
      explanation: s.explanation,
    })),
  };
}
