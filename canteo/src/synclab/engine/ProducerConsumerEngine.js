import { CircularBuffer, BUFFER_CAPACITY } from './CircularBuffer.js';
import { CountingSemaphore } from './CountingSemaphore.js';
import { Mutex } from './Mutex.js';
import { extractSampleFromEngine, MAX_HISTORY_SAMPLES, TRANSITION_KINDS } from '../executionHistory.js';

const INITIAL_EXPLANATION = 'Five queue slots are empty. Students may produce orders; kitchen requests wait until an order exists.';
export const PROCESS_INSTRUCTIONS = {
  PRODUCER: [
    { op: 'waitEmpty', label: 'wait(empty)', boundary: true },
    { op: 'waitMutex', label: 'wait(mutex)', boundary: true },
    { op: 'insert', label: 'insert(order)', boundary: false },
    { op: 'advanceWrite', label: 'write = (write + 1) % 5', boundary: false },
    { op: 'releaseMutex', label: 'signal(mutex)', boundary: true },
    { op: 'signalFull', label: 'signal(full)', boundary: true },
  ],
  CONSUMER: [
    { op: 'waitFull', label: 'wait(full)', boundary: true },
    { op: 'waitMutex', label: 'wait(mutex)', boundary: true },
    { op: 'remove', label: 'remove(order)', boundary: false },
    { op: 'advanceRead', label: 'read = (read + 1) % 5', boundary: false },
    { op: 'releaseMutex', label: 'signal(mutex)', boundary: true },
    { op: 'signalEmpty', label: 'signal(empty)', boundary: true },
  ],
};

export class ProducerConsumerEngine {
  constructor({ persistentConsumers = false } = {}) {
    this.persistentConsumers = persistentConsumers;
    this.reset();
  }

  reset() {
    this.buffer = new CircularBuffer();
    this.empty = new CountingSemaphore('empty', BUFFER_CAPACITY, BUFFER_CAPACITY);
    this.full = new CountingSemaphore('full', 0, BUFFER_CAPACITY);
    this.mutex = new Mutex();
    this.processes = [];
    this.workers = [];
    this.orders = {};
    this.readyOrderIds = [];
    this.completedOrderIds = [];
    this.events = [];
    this.nextProcess = 1;
    this.nextProducer = 1;
    this.nextConsumer = 1;
    this.nextOrder = 1;
    this.nextEvent = 1;
    this.currentOperation = 'Ready';
    this.explanation = INITIAL_EXPLANATION;
    this.lastInstruction = null;
    this.previousInstruction = null;
    this.variableChanges = null;
    this.lastAction = null;
    this.reservedEmpty = 0;
    this.reservedFull = 0;
    this.roundRobin = 0;
    this.lastScheduledId = null;
    this.integrityFailure = null;
    this.sessionId = (this.sessionId ?? 0) + 1;
    this.stepSequence = 0;
    this.executionHistory = [];
    this.truncatedCount = 0;
    this.#recordSample(TRANSITION_KINDS.INIT, {
      operation: 'Queue initialized',
      eventMessage: 'Queue reset to initial state (capacity 5, empty 5, full 0, mutex 1).'
    });
    this.assertInvariants();
    return this.snapshot();
  }

  clearHistory(initialOperation = 'Scenario loaded') {
    this.sessionId = (this.sessionId ?? 0) + 1;
    this.stepSequence = 0;
    this.executionHistory = [];
    this.truncatedCount = 0;
    this.#recordSample(TRANSITION_KINDS.INIT, {
      operation: initialOperation,
      eventMessage: `Session started with ${this.buffer.occupancy} queued orders.`
    });
    return this.snapshot();
  }

  addProducer(count = 1, options = {}) { return this.#add('PRODUCER', count, options); }
  addConsumer(count = 1, options = {}) { return this.#add('CONSUMER', count, options); }

  removeProcess(target) {
    if (!target) {
      return { success: false, reason: 'A process ID or type (PRODUCER/CONSUMER) is required for removal.', state: this.snapshot() };
    }

    let processId = target;

    // Handle type-based removal (steppers: "PRODUCER" or "CONSUMER")
    if (typeof target === 'string' && (target.toUpperCase() === 'PRODUCER' || target.toUpperCase() === 'CONSUMER')) {
      const type = target.toUpperCase();
      // Rule 3: Skip processes already stopping
      const candidates = this.processes.filter(
        (p) => p.type === type && !p.stoppingRequested && p.state !== 'RETIRED'
      );
      if (!candidates.length) {
        return { success: false, reason: `No removable ${type.toLowerCase()} processes found.`, state: this.snapshot() };
      }

      // Rule 1: Prefer the newest safely removable process (reversed order)
      const immediateCandidate = [...candidates].reverse().find((p) => {
        const ownsResources = p.permit || p.acquiredMutex || this.mutex.owner === p.id;
        const isPreparing = p.state === 'PREPARING';
        return !ownsResources && !isPreparing && (p.state === 'READY' || p.state === 'COMPLETED' || p.state === 'BLOCKED' || p.state === 'WAITING');
      });

      if (immediateCandidate) {
        processId = immediateCandidate.id;
      } else {
        // Rule 2: Otherwise request graceful removal of the newest process not already stopping
        const newestCandidate = [...candidates].reverse()[0];
        processId = newestCandidate.id;
      }
    }

    const process = this.processes.find((p) => p.id === processId);
    if (!process) {
      return { success: false, reason: `Process ${processId} not found.`, state: this.snapshot() };
    }

    // Skip if already stopping
    if (process.stoppingRequested) {
      return { success: false, reason: `${processId} is already scheduled to stop after its current operation.`, graceful: true, processId, state: this.snapshot() };
    }

    const ownsResources = process.permit || process.acquiredMutex || this.mutex.owner === processId;
    const isPreparing = process.state === 'PREPARING';

    // Case 1: Unstarted or Completed without holding resources -> Immediate Removal
    if (!ownsResources && !isPreparing && (process.state === 'READY' || process.state === 'COMPLETED')) {
      this.processes = this.processes.filter((p) => p.id !== processId);
      this.workers = this.workers.filter((w) => w.id !== processId);
      if (this.lastScheduledId === processId) this.lastScheduledId = null;
      this.#event(`${processId} removed from simulation.`, 'process-removed', processId);
      this.#recordSample(TRANSITION_KINDS.PROCESS_REMOVED, {
        processId,
        operation: `Removed ${process.type === 'PRODUCER' ? 'Student Producer' : 'Kitchen Consumer'} (${processId})`,
        eventMessage: `${processId} removed from simulation.`
      });
      return { success: true, graceful: false, processId, state: this.snapshot() };
    }

    // Case 2: Waiting on semaphore without holding resources -> Safe Waiter Splice
    if (!ownsResources && !isPreparing && (process.state === 'BLOCKED' || process.state === 'WAITING')) {
      if (process.waitingFor === 'full') {
        this.full.waiters = this.full.waiters.filter((id) => id !== processId);
      } else if (process.waitingFor === 'empty') {
        this.empty.waiters = this.empty.waiters.filter((id) => id !== processId);
      } else if (process.waitingFor === 'mutex') {
        this.mutex.waiters = this.mutex.waiters.filter((id) => id !== processId);
      }
      this.processes = this.processes.filter((p) => p.id !== processId);
      this.workers = this.workers.filter((w) => w.id !== processId);
      if (this.lastScheduledId === processId) this.lastScheduledId = null;
      this.#event(`${processId} safely removed from ${process.waitingFor} wait queue.`, 'process-removed', processId);
      this.#recordSample(TRANSITION_KINDS.PROCESS_REMOVED, {
        processId,
        operation: `Removed Waiting Process (${processId})`,
        eventMessage: `${processId} safely removed from ${process.waitingFor} wait queue.`
      });
      return { success: true, graceful: false, processId, state: this.snapshot() };
    }

    // Case 3: Resource-owning, in critical section, or preparing in kitchen -> Graceful retirement
    process.stoppingRequested = true;
    const worker = this.workers.find((w) => w.id === processId);
    if (worker) {
      worker.stoppingRequested = true;
    }
    this.#event(`${processId} owns resources; marked to stop after current operation finishes.`, 'process-stopping', processId);
    this.#recordSample(TRANSITION_KINDS.PROCESS_STOPPING, {
      processId,
      operation: `Graceful Stop Requested (${processId})`,
      eventMessage: `${processId} marked to stop after current operation finishes.`
    });
    return { success: true, graceful: true, processId, state: this.snapshot() };
  }

  pause() {
    for (const process of this.processes) if (process.state === 'RUNNING') {
      process.state = 'READY';
      this.#event(`${process.id} returned to READY when paused.`, 'transition', process.id, null, { transition: { from: 'RUNNING', to: 'READY' } });
    }
    this.#event('Simulation paused. The active process remains READY at its next instruction.', 'control');
    return this.snapshot();
  }

  resume() {
    this.#event('Simulation resumed. The scheduler will continue from each process program counter.', 'control');
    return this.snapshot();
  }

  tickKitchen() {
    if (!this.persistentConsumers) throw new Error('Kitchen preparation ticks require persistent consumer mode.');
    const activeWorkers = this.workers.filter((worker) => worker.state === 'PREPARING');
    if (!activeWorkers.length) {
      this.#event('Kitchen tick advanced; no workstation currently has an order to prepare.', 'kitchen-tick', null, 'prepareStep');
      return this.snapshot();
    }
    for (const worker of activeWorkers) {
      const order = this.orders[worker.assignedOrderId];
      if (!order || order.lifecycle !== 'PREPARING' || this.mutex.owner === worker.id) {
        this.#latchIntegrityFailure({ id: 'kitchen-assignment', label: 'Kitchen assignment', actual: { worker: worker.id, order: worker.assignedOrderId, lifecycle: order?.lifecycle, mutexOwner: this.mutex.owner }, expected: 'A preparing worker owns one PREPARING order and does not hold the queue mutex', correction: 'Reset and repeat the dequeue and mutex release sequence.' }, worker.id);
        return this.snapshot();
      }
      const before = worker.preparationProgress;
      worker.preparationProgress += 1;
      worker.remainingSteps = Math.max(0, worker.preparationDuration - worker.preparationProgress);
      order.preparationProgress = worker.preparationProgress;
      this.#event(`${worker.id} advanced ${order.id} preparation from ${before}/${worker.preparationDuration} to ${worker.preparationProgress}/${worker.preparationDuration}.`, 'kitchen-tick', worker.id, 'prepareStep', { orderId: order.id, progressBefore: before, progressAfter: worker.preparationProgress, preparationDuration: worker.preparationDuration, mutexOwner: this.mutex.owner });
      if (worker.preparationProgress >= worker.preparationDuration) {
        order.lifecycle = 'READY';
        this.readyOrderIds.push(order.id);
        worker.state = 'IDLE'; worker.lastEvent = `${order.id} is ready; ${worker.id} returned to IDLE.`;
        worker.assignedOrderId = null; worker.foodName = null; worker.preparationDuration = 0; worker.preparationProgress = 0; worker.remainingSteps = 0;
        const process = this.processes.find((candidate) => candidate.id === worker.id);
        if (process) {
          process.completedCount = (process.completedCount ?? 0) + 1;
          if (process.stoppingRequested || worker.stoppingRequested) {
            process.state = 'RETIRED';
            this.processes = this.processes.filter((candidate) => candidate.id !== worker.id);
            this.workers = this.workers.filter((w) => w.id !== worker.id);
            if (this.lastScheduledId === worker.id) this.lastScheduledId = null;
            this.#event(`${process.id} completed graceful retirement after finishing preparation.`, 'process-retired', process.id);
          } else if (process.workloadMode === 'single') {
            process.state = 'COMPLETED';
            if (this.lastScheduledId === worker.id) this.lastScheduledId = null;
            this.#event(`${process.id} completed assigned single workload after finishing preparation.`, 'complete', process.id, 'orderReady', { transition: { from: 'PREPARING', to: 'COMPLETED' }, orderId: order.id });
          } else {
            process.state = 'READY'; process.pc = 0; process.waitingFor = null; process.result = null;
            this.#event(`${process.id} returned to READY after finishing preparation; the workstation can accept another order.`, 'transition', process.id, 'orderReady', { transition: { from: 'PREPARING', to: 'READY' }, orderId: order.id });
          }
        }
        this.#event(`${order.id} is READY for pickup. ${worker.id} returned to IDLE and can request another FIFO order.`, 'order-ready', worker.id, 'orderReady', { orderId: order.id, transition: { from: 'PREPARING', to: 'READY' }, workerTransition: { from: 'PREPARING', to: 'IDLE' } });
      }
    }
    const integrity = this.checkIntegrity();
    if (!integrity.passed) this.#latchIntegrityFailure(integrity.checks.find((check) => check.status === 'FAIL'), null);
    this.#recordSample(TRANSITION_KINDS.TICK, {
      processId: activeWorkers.map((w) => w.id).join(', '),
      operation: 'Kitchen Preparation Tick',
      eventMessage: `Kitchen tick advanced for ${activeWorkers.map((w) => `${w.id} (${w.preparationProgress}/${w.preparationDuration})`).join(', ')}.`
    });
    return this.snapshot();
  }

  pickUpOrder(orderId) {
    const order = this.orders[orderId];
    if (!order || order.lifecycle !== 'READY') return { success: false, reason: 'Only a READY order can be picked up.', state: this.snapshot() };
    order.lifecycle = 'COMPLETED';
    this.readyOrderIds = this.readyOrderIds.filter((id) => id !== orderId);
    this.completedOrderIds.push(orderId);
    this.#event(`${orderId} was handed over to the student and marked COMPLETED.`, 'order-completed', null, 'pickUp', { orderId, transition: { from: 'READY', to: 'COMPLETED' } });
    const integrity = this.checkIntegrity();
    if (!integrity.passed) this.#latchIntegrityFailure(integrity.checks.find((check) => check.status === 'FAIL'), null);
    return { success: true, state: this.snapshot() };
  }

  #add(type, count, options = {}) {
    const ids = [];
    const workloadMode = options.workloadMode ?? (type === 'CONSUMER' ? 'continuous' : 'single');
    const customPrepDuration = options.preparationDuration;

    for (let i = 0; i < Math.max(1, Math.min(20, count)); i += 1) {
      const id = this.persistentConsumers
        ? `${type === 'PRODUCER' ? 'P' : 'C'}${type === 'PRODUCER' ? this.nextProducer++ : this.nextConsumer++}`
        : `${type === 'PRODUCER' ? 'P' : 'C'}${this.nextProcess++}`;
      const orderNumber = type === 'PRODUCER' ? this.nextOrder++ : null;
      const orderId = orderNumber ? `O${String(orderNumber).padStart(2, '0')}` : null;
      const foodName = orderNumber ? ['Masala Dosa', 'Idli & Sambar', 'Vegetable Sandwich', 'Samosa', 'Rice Bowl', 'Canteen Noodles'][(orderNumber - 1) % 6] : null;
      const defaultDuration = [3, 5, 2, 4, 3, 2][(orderNumber - 1) % 6];
      const preparationDuration = customPrepDuration ?? defaultDuration;

      this.processes.push({
        id,
        type,
        state: 'READY',
        pc: 0,
        order: orderNumber ? `Order ${String(orderNumber).padStart(2, '0')}` : null,
        orderId,
        foodName,
        waitingFor: null,
        permit: false,
        acquiredMutex: false,
        result: null,
        workloadMode,
        completedCount: 0,
        stoppingRequested: false,
      });

      if (orderId) {
        this.orders[orderId] = {
          id: orderId,
          label: `Order ${String(orderNumber).padStart(2, '0')}`,
          producer: id,
          foodName,
          lifecycle: 'CREATED',
          preparationDuration,
          preparationProgress: 0,
        };
      }

      if (type === 'CONSUMER') {
        this.workers.push({
          id,
          state: 'IDLE',
          assignedOrderId: null,
          foodName: null,
          preparationDuration: 0,
          preparationProgress: 0,
          remainingSteps: 0,
          lastEvent: 'Worker ready',
          requestCount: 0,
          stoppingRequested: false,
        });
      }

      this.#event(`${id} created as a ${type === 'PRODUCER' ? 'student producer' : 'kitchen consumer'}.`, 'process', id);
      ids.push(id);
    }
    this.#recordSample(TRANSITION_KINDS.PROCESS_ADDED, {
      processId: ids.join(', '),
      operation: `Added ${type === 'PRODUCER' ? 'Student Producer' : 'Kitchen Consumer'} (${ids.join(', ')})`,
      eventMessage: `${ids.join(', ')} added to the simulation.`
    });
    return { ids, state: this.snapshot() };
  }

  stepNextInstruction(processId = null) {
    return this.step(processId);
  }

  stepNextProcess(processId = null) {
    const selected = processId ?? this.#nextReadyProcessId();
    if (!selected) return this.snapshot();
    let state = this.snapshot();
    for (let count = 0; count < 20; count += 1) {
      state = this.step(selected);
      const process = state.processes.find((item) => item.id === selected);
      const executed = this.lastInstruction;
      if (!process || process.state === 'BLOCKED' || process.state === 'WAITING' || process.state === 'COMPLETED' || executed?.boundary) break;
      if (process.state !== 'READY' && process.state !== 'RUNNING') break;
    }
    return state;
  }

  #nextReadyProcessId() {
    const ready = this.processes.filter((p) => p.state === 'READY' || p.state === 'RUNNING');
    if (!ready.length) return null;
    if (!this.persistentConsumers) return ready[this.roundRobin % ready.length]?.id ?? null;
    const lastIndex = this.processes.findIndex((process) => process.id === this.lastScheduledId);
    for (let offset = 1; offset <= this.processes.length; offset += 1) {
      const candidate = this.processes[(lastIndex + offset + this.processes.length) % this.processes.length];
      if (candidate && (candidate.state === 'READY' || candidate.state === 'RUNNING')) return candidate.id;
    }
    return ready[0].id;
  }

  step(processId = null) {
    if (this.integrityFailure) return this.snapshot();
    const preflight = this.checkIntegrity();
    if (!preflight.passed) { this.#latchIntegrityFailure(preflight.checks.find((check) => check.status === 'FAIL'), processId ?? this.#nextReadyProcessId()); return this.snapshot(); }
    for (const process of this.processes) if (process.state === 'RUNNING') {
      process.state = 'READY';
      this.#event(`${process.id} returned to READY for deterministic scheduling.`, 'transition', process.id, null, { transition: { from: 'RUNNING', to: 'READY' } });
    }
    const ready = this.processes.filter((p) => p.state === 'READY');
    if (!ready.length) {
      if (this.persistentConsumers && this.workers.some((w) => w.state === 'PREPARING')) {
        return this.tickKitchen();
      }
      this.currentOperation = 'No process is ready';
      if (this.processes.some((p) => p.state === 'WAITING' || p.state === 'BLOCKED')) this.explanation = 'Every remaining process is waiting for a semaphore permit or the mutex. A matching signal or release must occur before it can run.';
      return this.snapshot();
    }
    const scheduledId = this.persistentConsumers ? this.#nextReadyProcessId() : null;
    const selectedIndex = processId ? ready.findIndex((p) => p.id === processId) : this.persistentConsumers ? ready.findIndex((p) => p.id === scheduledId) : this.roundRobin % ready.length;
    if (selectedIndex < 0) return this.snapshot();
    const process = ready[selectedIndex];
    this.roundRobin = (selectedIndex + 1) % Math.max(1, ready.length);
    if (this.persistentConsumers) this.lastScheduledId = process.id;
    const instruction = PROCESS_INSTRUCTIONS[process.type][process.pc];
    if (!instruction) return this.snapshot();
    const before = this.#variablesSnapshot();
    const eventStart = this.events.length;
    this.previousInstruction = this.lastInstruction;
    this.lastInstruction = { processId: process.id, processType: process.type, pc: process.pc, op: instruction.op, label: instruction.label, boundary: instruction.boundary };
    this.lastAction = null;
    process.state = 'RUNNING';
    this.#event(`${process.id} entered RUNNING for ${instruction.label}.`, 'transition', process.id, instruction.op, { transition: { from: 'READY', to: 'RUNNING' } });
    try { this.#execute(process, instruction.op); }
    catch (error) {
      this.#latchIntegrityFailure({ id: 'engine-safety', label: 'Safe operation preconditions', actual: error.message, expected: 'Operation satisfies permit, mutex, and buffer ownership rules', correction: 'Reset the simulation and repeat the operation sequence.' }, process.id);
    }
    if (process.state === 'RUNNING') {
      process.pc += 1;
      if (process.pc >= PROCESS_INSTRUCTIONS[process.type].length) {
        process.state = 'COMPLETED';
        if (process.stoppingRequested) {
          process.state = 'RETIRED';
          this.processes = this.processes.filter((candidate) => candidate.id !== process.id);
          this.workers = this.workers.filter((w) => w.id !== process.id);
          if (this.lastScheduledId === process.id) this.lastScheduledId = null;
          this.#event(`${process.id} completed graceful retirement after releasing all resources.`, 'process-retired', process.id);
        } else {
          this.#event(`${process.id} completed its operation.`, 'complete', process.id, instruction.op, { transition: { from: 'RUNNING', to: 'COMPLETED' } });
        }
      }
    } else if (process.state === 'PREPARING') {
      this.#event(`${process.id} left the queue scheduler and is preparing its claimed order outside the critical section.`, 'transition', process.id, instruction.op, { transition: { from: 'RUNNING', to: 'PREPARING' } });
    } else if (['BLOCKED', 'WAITING'].includes(process.state)) {
      this.#event(`${process.id} changed from RUNNING to ${process.state}.`, 'transition', process.id, instruction.op, { transition: { from: 'RUNNING', to: process.state }, resource: process.waitingFor });
    }
    this.variableChanges = { before, after: this.#variablesSnapshot() };
    this.#event(`${process.id} executed ${instruction.label}.`, 'instruction', process.id, instruction.op);
    for (const event of this.events.slice(0, Math.max(0, this.events.length - eventStart))) {
      if (!event.variablesBefore) {
        event.variablesBefore = { ...before }; event.variablesAfter = { ...this.variableChanges.after };
        event.instruction = instruction.label; event.causedBy = process.id;
      }
    }
    const integrity = this.checkIntegrity();
    if (!integrity.passed) this.#latchIntegrityFailure(integrity.checks.find((check) => check.status === 'FAIL'), process.id);
    const isBlocked = ['BLOCKED', 'WAITING'].includes(process.state);
    this.#recordSample(isBlocked ? TRANSITION_KINDS.BLOCKED : TRANSITION_KINDS.EXECUTE, {
      processId: process.id,
      operation: instruction.label,
      instructionOp: instruction.op,
      orderId: process.orderId ?? process.result?.id ?? null,
      eventMessage: `${process.id} ${isBlocked ? `blocked on ${process.waitingFor}` : `executed ${instruction.label}`}.`
    });
    return this.snapshot();
  }

  runUntilBlocked(maxSteps = 200) {
    for (let i = 0; i < maxSteps && this.processes.some((p) => p.state === 'READY' || p.state === 'RUNNING'); i += 1) this.stepNextInstruction();
    return this.snapshot();
  }

  #variablesSnapshot() {
    return { empty: this.empty.value, full: this.full.value, mutex: this.mutex.owner ? 0 : 1, mutexOwner: this.mutex.owner, writePosition: this.buffer.writePosition, readPosition: this.buffer.readPosition, occupancy: this.buffer.occupancy, reservedEmpty: this.reservedEmpty, reservedFull: this.reservedFull };
  }

  #execute(p, op) {
    const wait = (sem, reservedKey, label) => {
      const result = sem.wait(p.id);
      if (result.alreadyHeld || result.alreadyWaiting) throw new Error(`${p.id} attempted to wait twice on ${sem.name} without completing the previous wait.`);
      if (result.acquired) {
        p.permit = true;
        this[reservedKey] += 1;
        if (sem.name === 'full' && p.type === 'CONSUMER') this.#setWorkerState(p.id, 'FULL_PERMIT_RESERVED', `${p.id} reserved a full-order permit.`);
        this.#event(`${p.id} acquired one ${label} permit (${sem.name} is now ${sem.value}).`, 'semaphore', p.id);
        this.#explain(`${p.id} acquired a ${label} permit. The permit reserves capacity or an available order before shared queue access.`);
      } else {
        p.state = 'BLOCKED'; p.waitingFor = sem.name;
        if (sem.name === 'full' && p.type === 'CONSUMER') this.#setWorkerState(p.id, 'WAITING_FOR_ORDER', `${p.id} is waiting for a published order.`);
        p.pc += 1; // wait is pending; a later FIFO handoff supplies its permit.
        this.#event(`${p.id} blocked on ${sem.name}; no permit is available.`, 'blocked', p.id);
        this.#explain(`${p.id} is waiting because ${sem.name} has no available permits. A signal will wake the oldest waiter.`);
      }
    };
    if (op === 'waitEmpty') return wait(this.empty, 'reservedEmpty', 'empty-slot');
    if (op === 'waitFull') return wait(this.full, 'reservedFull', 'order');
    if (op === 'waitMutex') {
      const result = this.mutex.acquire(p.id);
      if (!result.acquired) {
        p.state = 'WAITING';
        p.waitingFor = 'mutex';
        p.pc += 1;
        if (p.type === 'CONSUMER') this.#setWorkerState(p.id, 'WAITING_FOR_MUTEX', `${p.id} blocked on mutex owned by ${this.mutex.owner}.`);
        this.#event(`${p.id} blocked on mutex owned by ${this.mutex.owner}.`, 'blocked', p.id);
        this.#explain(`${p.id} cannot enter the critical section while ${this.mutex.owner} owns the mutex.`);
      } else {
        p.acquiredMutex = true;
        if (p.type === 'CONSUMER') this.#setWorkerState(p.id, 'CRITICAL_SECTION', `${p.id} acquired mutex and entered the critical section.`);
        this.#event(`${p.id} acquired mutex and entered the critical section.`, 'critical', p.id);
        this.#explain(`${p.id} now has exclusive access to the shared buffer and its pointers.`);
      }
      return;
    }
    if (op === 'insert') {
      if (this.mutex.owner !== p.id || !p.permit || p.type !== 'PRODUCER') throw new Error('Producer attempted an unprotected or unreserved insertion.');
      if (!this.empty.holders.has(p.id)) throw new Error('Producer does not own the empty-slot permit it is consuming.');
      const position = this.buffer.writeCurrent({ id: p.orderId, label: p.order, producer: p.id, foodName: p.foodName, lifecycle: 'QUEUED' });
      this.orders[p.orderId].lifecycle = 'QUEUED';
      this.empty.releasePermit(p.id);
      this.reservedEmpty -= 1; this.reservedFull += 1; p.permit = false;
      this.lastAction = { type: 'insert', position, order: p.order };
      this.#event(`${p.id} inserted ${p.order} into slot ${position}.`, 'insert', p.id, 'insert');
      this.events[0].orderId = p.orderId; this.events[0].slot = position;
      this.#explain(`The order occupies slot ${position}. The write pointer advances in its own instruction while the mutex is held.`);
    } else if (op === 'advanceWrite') {
      const from = this.buffer.writePosition; const to = this.buffer.advanceWrite();
      this.lastAction = { type: 'write-pointer', from, to };
      this.#event(`${p.id} advanced write position from ${from} to ${to} modulo five.`, 'pointer', p.id, op);
      this.#explain(`The circular write pointer advanced from slot ${from} to slot ${to}. Modulo five wraps slot 4 back to slot 0.`);
    } else if (op === 'remove') {
      if (this.mutex.owner !== p.id || !p.permit || p.type !== 'CONSUMER') throw new Error('Consumer attempted an unprotected or unreserved removal.');
      if (!this.full.holders.has(p.id)) throw new Error('Consumer does not own the full-order permit it is consuming.');
      const { item, position } = this.buffer.readCurrent();
      const order = this.orders[item.id];
      if (!order || order.lifecycle !== 'QUEUED') throw new Error(`${item.id} is not in QUEUED state and cannot be claimed.`);
      order.lifecycle = 'PREPARING';
      this.full.releasePermit(p.id);
      this.reservedFull -= 1; this.reservedEmpty += 1; p.permit = false; p.result = { ...item, lifecycle: 'PREPARING' };
      const worker = this.#workerFor(p.id);
      if (worker) {
        worker.assignedOrderId = item.id; worker.foodName = order.foodName;
        worker.preparationDuration = order.preparationDuration; worker.preparationProgress = 0;
        worker.remainingSteps = order.preparationDuration; worker.state = 'ORDER_REMOVED';
        worker.lastEvent = `${p.id} removed ${item.id} from queue`;
      }
      this.lastAction = { type: 'remove', position, order: item.label };
      this.#event(`${p.id} removed ${item.label} from slot ${position}.`, 'remove', p.id, 'remove');
      this.events[0].orderId = item.id; this.events[0].slot = position;
      this.#explain(`${p.id} removed ${item.label} at slot ${position}. The read pointer advances in its own instruction while the mutex is held.`);
    } else if (op === 'advanceRead') {
      const from = this.buffer.readPosition; const to = this.buffer.advanceRead();
      this.lastAction = { type: 'read-pointer', from, to };
      this.#event(`${p.id} advanced read position from ${from} to ${to} modulo five.`, 'pointer', p.id, op);
      this.#explain(`The circular read pointer advanced from slot ${from} to slot ${to}. Modulo five wraps slot 4 back to slot 0.`);
    } else if (op === 'releaseMutex') {
      const awakened = this.mutex.release(p.id); p.acquiredMutex = false;
      this.#event(`${p.id} released mutex${awakened ? `; ${awakened} now owns it` : ''}.`, 'critical', p.id);
      if (p.type === 'CONSUMER' && p.result) {
        const worker = this.#workerFor(p.id);
        if (worker) {
          worker.state = 'PREPARING'; worker.lastEvent = `${p.id} began preparing ${p.result.id} outside the critical section.`;
          this.#event(worker.lastEvent, 'kitchen-start', p.id, 'prepare', { orderId: p.result.id, mutexOwner: this.mutex.owner });
        }
      }
      if (awakened) this.#wake(awakened, 'mutex');
      this.#explain(`${p.id} left the critical section. Only the mutex owner could release it${awakened ? `, and FIFO waiter ${awakened} is next` : ''}.`);
    } else if (op === 'signalFull') {
      this.#signal(this.full, 'reservedFull', 'full');
      p.completedCount = (p.completedCount ?? 0) + 1;
      if (p.workloadMode === 'continuous' && !p.stoppingRequested) {
        const orderNumber = this.nextOrder++;
        const orderId = `O${String(orderNumber).padStart(2, '0')}`;
        const foodName = ['Masala Dosa', 'Idli & Sambar', 'Vegetable Sandwich', 'Samosa', 'Rice Bowl', 'Canteen Noodles'][(orderNumber - 1) % 6];
        p.order = `Order ${String(orderNumber).padStart(2, '0')}`;
        p.orderId = orderId;
        p.foodName = foodName;
        p.pc = 0;
        p.state = 'READY';
        this.orders[orderId] = {
          id: orderId,
          label: p.order,
          producer: p.id,
          foodName,
          lifecycle: 'CREATED',
          preparationDuration: [3, 5, 2, 4, 3, 2][(orderNumber - 1) % 6],
          preparationProgress: 0,
        };
        this.#event(`${p.id} began continuous cycle for ${orderId}.`, 'process', p.id);
      } else if (p.stoppingRequested) {
        p.state = 'RETIRED';
        this.processes = this.processes.filter((proc) => proc.id !== p.id);
        if (this.lastScheduledId === p.id) this.lastScheduledId = null;
        this.#event(`${p.id} completed graceful retirement after releasing all resources.`, 'process-retired', p.id);
      }
    }
    else if (op === 'signalEmpty') {
      this.#signal(this.empty, 'reservedEmpty', 'empty');
      if (this.persistentConsumers) {
        p.pc = 0;
        p.state = 'PREPARING';
      }
    }
  }

  #signal(sem, reservedKey, label) {
    if (this[reservedKey] < 1) throw new Error(`No reserved ${label} permit exists to signal.`);
    this[reservedKey] -= 1;
    const result = sem.signal();
    if (result.woken) {
      this[reservedKey] += 1;
      this.#wake(result.woken, sem.name);
      this.#event(`${label} signaled; permit transferred to waiting ${result.woken}.`, 'semaphore', result.woken);
      this.#explain(`A ${label} permit was handed directly to the oldest waiting process, so it resumes after wait without decrementing twice.`);
    } else {
      this.#event(`${label} signaled (${sem.name} is now ${sem.value}).`, 'semaphore');
      this.#explain(`The ${label} semaphore gained one available permit for a future process.`);
    }
  }

  #wake(id, resource) {
    const p = this.processes.find((candidate) => candidate.id === id);
    if (!p) return;
    const from = p.state; p.state = 'READY'; p.waitingFor = null;
    if (resource === 'mutex') {
      p.acquiredMutex = true;
      if (p.type === 'CONSUMER') this.#setWorkerState(p.id, 'CRITICAL_SECTION', `${p.id} acquired mutex from FIFO handoff and entered critical section.`);
    } else {
      p.permit = true;
      if (resource === 'full' && p.type === 'CONSUMER') this.#setWorkerState(p.id, 'FULL_PERMIT_RESERVED', `${p.id} received a handed-off full permit.`);
    }
    this.#event(`${id} woke from ${resource} and is READY.`, 'wake', id, null, { resource, transition: { from, to: 'READY' } });
  }

  #workerFor(id) { return this.workers.find((worker) => worker.id === id) ?? null; }
  #setWorkerState(id, state, message) {
    const worker = this.#workerFor(id);
    if (!worker) return;
    worker.state = state; worker.lastEvent = message;
  }

  #event(message, type = 'info', processId = null, operation = null, details = {}) {
    this.currentOperation = message;
    const sequence = this.nextEvent++;
    this.events.unshift({ id: sequence, step: sequence, message, type, processId, operation, ...details });
  }
  #explain(message) { this.explanation = message; }

  assertInvariants() {
    const integrity = this.checkIntegrity();
    const failure = integrity.checks.find((check) => check.status === 'FAIL');
    if (failure) throw new Error(`${failure.label}: ${failure.actual}; expected ${failure.expected}.`);
    return true;
  }

  checkIntegrity() {
    const checks = [];
    const add = (id, label, passed, actual, expected, correction) => checks.push({ id, label, status: passed ? 'PASS' : 'FAIL', actual, expected, correction });
    const occupancy = this.buffer.occupancy;
    add('capacity', 'Buffer capacity', occupancy >= 0 && occupancy <= BUFFER_CAPACITY, occupancy, '0 through 5 occupied slots', 'Check insert/remove ownership and slot indexing.');
    const total = this.empty.value + this.full.value + this.reservedEmpty + this.reservedFull;
    add('accounting', 'Permit accounting', total === BUFFER_CAPACITY && [this.empty.value, this.full.value, this.reservedEmpty, this.reservedFull].every((value) => value >= 0), { empty: this.empty.value, full: this.full.value, reservedEmpty: this.reservedEmpty, reservedFull: this.reservedFull, total }, 'empty + full + reservedEmpty + reservedFull = 5', 'Restore the permit transfer at the instruction that changed the count.');
    add('buffer-full-conservation', 'Buffer occupancy and full permit conservation', occupancy === this.full.value + this.reservedFull, { occupancy, full: this.full.value, reservedFull: this.reservedFull }, 'buffer.occupiedCount = full + reservedFull', 'Buffer occupancy must equal available full permits plus reserved order permits.');
    const hasReservations = this.reservedEmpty + this.reservedFull > 0;
    checks.push({ id: 'stable-accounting', label: 'Stable-state accounting', status: hasReservations ? 'IN FLIGHT' : (this.empty.value + this.full.value === BUFFER_CAPACITY ? 'PASS' : 'FAIL'), actual: { empty: this.empty.value, full: this.full.value, reservations: this.reservedEmpty + this.reservedFull }, expected: hasReservations ? 'Stable equality applies after reservations complete' : 'empty + full = 5', correction: 'Complete the in-flight critical section or inspect semaphore signaling.' });
    const mutexOwners = this.processes.filter((p) => p.acquiredMutex).map((p) => p.id);
    add('mutex-owner', 'Mutex ownership', mutexOwners.length <= 1 && (this.mutex.owner === null ? mutexOwners.length === 0 : mutexOwners.length === 1 && mutexOwners[0] === this.mutex.owner), { owner: this.mutex.owner, processOwners: mutexOwners }, 'At most one matching owner', 'Release the mutex only from its owner; verify FIFO handoff.');
    const producerEmpty = this.processes.filter((p) => p.type === 'PRODUCER' && p.permit).length;
    const consumerFull = this.processes.filter((p) => p.type === 'CONSUMER' && p.permit).length;
    const producerSignals = this.processes.filter((p) => p.type === 'PRODUCER' && !p.permit && p.pc >= 3 && p.pc < PROCESS_INSTRUCTIONS.PRODUCER.length).length;
    const consumerSignals = this.processes.filter((p) => p.type === 'CONSUMER' && !p.permit && p.pc >= 3 && p.pc < PROCESS_INSTRUCTIONS.CONSUMER.length).length;
    const ownershipOk = producerEmpty + consumerSignals === this.reservedEmpty && consumerFull + producerSignals === this.reservedFull && this.empty.holders.size === producerEmpty && this.full.holders.size === consumerFull && [...this.empty.holders].every((id) => this.processes.some((p) => p.id === id && p.type === 'PRODUCER' && p.permit)) && [...this.full.holders].every((id) => this.processes.some((p) => p.id === id && p.type === 'CONSUMER' && p.permit));
    add('permit-ownership', 'Semaphore ownership', ownershipOk, { emptyHolders: [...this.empty.holders], fullHolders: [...this.full.holders], reservedEmpty: this.reservedEmpty, reservedFull: this.reservedFull }, 'Held permits and pending post-critical-section signals match reservations', 'Resume the process after its existing wait; do not acquire its permit again.');
    const queues = [[this.empty.waiters, 'BLOCKED', 'empty'], [this.full.waiters, 'BLOCKED', 'full'], [this.mutex.waiters, 'WAITING', 'mutex']];
    const queuesValid = queues.every(([waiters, status, resource]) => new Set(waiters).size === waiters.length && waiters.every((id) => this.processes.some((p) => p.id === id && p.state === status && p.waitingFor === resource)));
    add('wait-queues', 'FIFO wait queues', queuesValid, { empty: [...this.empty.waiters], full: [...this.full.waiters], mutex: [...this.mutex.waiters] }, 'Each queued process appears once with the matching WAITING/BLOCKED state and resource', 'Restore FIFO queue membership before transferring a permit or mutex.');
    const readWriteValid = [this.buffer.readPosition, this.buffer.writePosition].every((position) => Number.isInteger(position) && position >= 0 && position < BUFFER_CAPACITY);
    add('circular-index', 'Circular indexing', readWriteValid, { read: this.buffer.readPosition, write: this.buffer.writePosition }, 'Read and write positions are integers from 0 through 4', 'Apply modulo-five pointer advancement.');
    const slotIds = this.buffer.slots.filter(Boolean).map((item) => item.id);
    const consumed = this.persistentConsumers
      ? Object.values(this.orders).filter((order) => order.lifecycle !== 'CREATED' && order.lifecycle !== 'QUEUED').map((order) => order.id)
      : this.processes.filter((p) => p.result).map((p) => p.result.id);
    const insertedEvents = this.events.filter((event) => event.operation === 'insert' && event.orderId).map((event) => event.orderId);
    const removedEvents = this.events.filter((event) => event.operation === 'remove' && event.orderId).map((event) => event.orderId);
    const unique = (items) => new Set(items).size === items.length;
    const represented = this.persistentConsumers
      ? [...slotIds, ...consumed, ...Object.values(this.orders).filter((order) => order.lifecycle === 'CREATED').map((order) => order.id)]
      : [...slotIds, ...consumed];
    let integrity = unique(represented) && unique(insertedEvents) && insertedEvents.every((id) => represented.filter((itemId) => itemId === id).length === 1) && consumed.every((id) => removedEvents.filter((eventId) => eventId === id).length === 1) && removedEvents.every((id) => consumed.filter((itemId) => itemId === id).length === 1) && slotIds.every((id) => insertedEvents.includes(id));
    let orderDiagnostics = { buffer: slotIds, consumed, insertedEvents, removedEvents };
    if (this.persistentConsumers) {
      const workerAssignments = this.workers.filter((worker) => worker.assignedOrderId).map((worker) => worker.assignedOrderId);
      const lifecycleValid = Object.values(this.orders).every((order) => {
        const inBuffer = slotIds.filter((id) => id === order.id).length;
        const assigned = workerAssignments.filter((id) => id === order.id).length;
        const ready = this.readyOrderIds.filter((id) => id === order.id).length;
        const completed = this.completedOrderIds.filter((id) => id === order.id).length;
        const locationCount = inBuffer + assigned + ready + completed;
        const expectedLocation = order.lifecycle === 'CREATED' ? 0 : 1;
        const removedCount = removedEvents.filter((id) => id === order.id).length;
        const removalExpected = ['PREPARING', 'READY', 'COMPLETED'].includes(order.lifecycle) ? 1 : 0;
        return locationCount === expectedLocation && removedCount === removalExpected &&
          (order.lifecycle !== 'QUEUED' || inBuffer === 1) &&
          (order.lifecycle !== 'PREPARING' || assigned === 1) &&
          (order.lifecycle !== 'READY' || ready === 1) &&
          (order.lifecycle !== 'COMPLETED' || completed === 1);
      });
      integrity = integrity && unique(workerAssignments) && lifecycleValid && this.readyOrderIds.every((id) => this.orders[id]?.lifecycle === 'READY') && this.completedOrderIds.every((id) => this.orders[id]?.lifecycle === 'COMPLETED');
      orderDiagnostics = { ...orderDiagnostics, workerAssignments, lifecycle: Object.fromEntries(Object.values(this.orders).map((order) => [order.id, order.lifecycle])) };
      add('preparation-outside-mutex', 'Preparation outside critical section', this.workers.filter((worker) => worker.state === 'PREPARING').every((worker) => this.mutex.owner !== worker.id), { mutexOwner: this.mutex.owner, preparing: this.workers.filter((worker) => worker.state === 'PREPARING').map((worker) => worker.id) }, 'Preparing workers do not own the queue mutex', 'Release the queue mutex immediately after dequeue and pointer updates.');
    }
    add('order-integrity', 'Order integrity / exactly-once consumption', integrity, orderDiagnostics, 'Every order occupies exactly one valid lifecycle location and has one FIFO removal at most', 'Trace the insert/remove and lifecycle events; restore the unique queued, assigned, ready, or completed location.');
    const failure = checks.find((check) => check.status === 'FAIL');
    return { passed: !failure, checks, failure: failure ?? null };
  }

  #latchIntegrityFailure(check, processId = null) {
    if (this.integrityFailure) return;
    this.integrityFailure = { ...check, invariant: check.id, processId, causeEvent: this.events[0] ?? null };
    this.currentOperation = `Integrity failure: ${check.label}`;
    this.explanation = `${check.label} failed. Actual: ${JSON.stringify(check.actual)}. Expected: ${check.expected}. ${check.correction}`;
    this.#event(`INTEGRITY FAILURE — ${check.label}. Actual ${JSON.stringify(check.actual)}; expected ${check.expected}.`, 'integrity-failure', processId, null, { invariant: check.id, actual: check.actual, expected: check.expected });
  }

  snapshot() {
    return {
      revision: this.stepSequence,
      capacity: BUFFER_CAPACITY, slots: this.buffer.slots.map((slot) => slot ? { ...slot } : null),
      writePosition: this.buffer.writePosition, readPosition: this.buffer.readPosition,
      empty: this.empty.value, full: this.full.value, mutex: this.mutex.owner === null ? 1 : 0, mutexOwner: this.mutex.owner,
      reservedEmpty: this.reservedEmpty, reservedFull: this.reservedFull,
      occupancy: this.buffer.occupancy, processes: this.processes.map((p) => ({ ...p })),
      workers: this.workers.map((worker) => ({ ...worker })),
      orders: Object.values(this.orders).map((order) => ({ ...order })),
      readyOrders: this.readyOrderIds.map((id) => ({ ...this.orders[id] })),
      completedOrders: this.completedOrderIds.map((id) => ({ ...this.orders[id] })),
      events: [...this.events], currentOperation: this.currentOperation, explanation: this.explanation,
      lastInstruction: this.lastInstruction ? { ...this.lastInstruction } : null,
      previousInstruction: this.previousInstruction ? { ...this.previousInstruction } : null,
      currentInstruction: this.processes.find((p) => p.id === this.lastInstruction?.processId)
        ? PROCESS_INSTRUCTIONS[this.lastInstruction.processType][this.processes.find((p) => p.id === this.lastInstruction.processId).pc] ?? null
        : null,
      variableChanges: this.variableChanges ? { before: { ...this.variableChanges.before }, after: { ...this.variableChanges.after } } : null,
      lastAction: this.lastAction ? { ...this.lastAction } : null,
      integrity: this.checkIntegrity(), integrityFailure: this.integrityFailure ? { ...this.integrityFailure } : null,
      emptyWaiters: [...this.empty.waiters], fullWaiters: [...this.full.waiters], mutexWaiters: [...this.mutex.waiters],
      executionHistory: [...this.executionHistory],
      historyTruncatedCount: this.truncatedCount,
      historySessionId: this.sessionId,
    };
  }

  #recordSample(kind, details = {}) {
    const sample = extractSampleFromEngine(this, kind, details);
    this.stepSequence += 1;
    this.executionHistory.push(sample);
    if (this.executionHistory.length > MAX_HISTORY_SAMPLES) {
      this.executionHistory.shift();
      this.truncatedCount += 1;
    }
  }

  getExecutionHistory() {
    return {
      sessionId: this.sessionId,
      samples: [...this.executionHistory],
      truncatedCount: this.truncatedCount,
    };
  }
}
