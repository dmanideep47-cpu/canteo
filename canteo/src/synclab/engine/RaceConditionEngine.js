const producerSteps = [
  ['P-A reads writePosition = 0.', 'P-B reads writePosition = 0.', 'P-A writes Order A into slot 0.', 'P-B writes Order B into slot 0, overwriting Order A.', 'Both producers advance their local pointer to 1; one order was lost.'],
  ['P-A acquires mutex; P-B waits.', 'P-A reads writePosition = 0.', 'P-A writes Order A and advances position to 1.', 'P-A releases mutex; P-B acquires it.', 'P-B writes Order B at position 1; both orders are preserved.'],
];
const consumerSteps = [
  ['C-A reads readPosition = 0 and sees Order A.', 'C-B reads readPosition = 0 and sees Order A.', 'C-A removes Order A.', 'C-B also removes Order A: duplicate processing.', 'Both local pointers advance to 1; Order B was skipped.'],
  ['C-A acquires mutex; C-B waits.', 'C-A reads Order A at position 0.', 'C-A removes Order A and advances position to 1.', 'C-A releases mutex; C-B acquires it.', 'C-B reads and removes Order B at position 1.'],
];

export class RaceConditionEngine {
  constructor() { this.reset(); }
  reset() { this.scenario = this.scenario ?? 'producer'; this.index = 0; this.events = []; this.protected = false; this.#resetInterleaving(); return this.snapshot(); }
  #resetInterleaving() {
    this.pc = { A: 0, B: 0 }; this.localTarget = { A: null, B: null }; this.localItem = { A: null, B: null };
    this.buffer = this.scenario === 'producer' ? Array(5).fill(null) : [{ id: 'OA', label: 'Order A' }, { id: 'OB', label: 'Order B' }, null, null, null];
    this.writePosition = 0; this.readPosition = 0; this.processed = []; this.overwritten = []; this.duplicateClaims = [];
    this.interactiveEvents = []; this.mutexOwner = null; this.mutexWaiters = []; this.roundRobin = 0;
  }
  selectScenario(scenario) { this.scenario = scenario === 'consumer' ? 'consumer' : 'producer'; this.index = 0; this.events = []; this.#resetInterleaving(); return this.snapshot(); }
  step() {
    const scenario = this.scenario === 'consumer' ? consumerSteps : producerSteps;
    const line = scenario[this.protected ? 1 : 0][this.index];
    if (line) this.events.push({ step: this.index + 1, message: line, process: line.slice(0, 3) });
    this.index = Math.min(this.index + 1, 5);
    return this.snapshot();
  }
  setProtected(value) { this.protected = Boolean(value); this.index = 0; this.events = []; this.#resetInterleaving(); return this.snapshot(); }
  getNextInteractiveProcess() {
    if (this.protected && this.mutexOwner) return this.pc[this.mutexOwner] < 3 ? this.mutexOwner : this.mutexWaiters[0] ?? null;
    const ready = ['A', 'B'].filter((id) => this.pc[id] < 3);
    return ready.length ? ready[this.roundRobin % ready.length] : null;
  }
  stepNextProcess() { const id = this.getNextInteractiveProcess(); return id ? this.stepProcess(id) : this.snapshot(); }
  stepProcess(id) {
    if (!['A', 'B'].includes(id)) throw new RangeError('Race process must be A or B.');
    if (this.pc[id] >= 3) return this.snapshot();
    const eventStart = this.interactiveEvents.length;
    const before = { value: this.scenario === 'producer' ? this.writePosition : this.readPosition, buffer: this.buffer.map((item) => item ? { ...item } : null), mutexOwner: this.mutexOwner };
    if (this.protected) {
      if (this.mutexOwner && this.mutexOwner !== id) {
        if (!this.mutexWaiters.includes(id)) this.mutexWaiters.push(id);
        this.#raceEvent(`${this.#name(id)} waits for the mutex owned by ${this.#name(this.mutexOwner)}.`, id, 'blocked');
        this.#annotateInterleaving(eventStart, before);
        return this.snapshot();
      }
      if (!this.mutexOwner) {
        this.mutexOwner = id;
        this.#raceEvent(`${this.#name(id)} acquired the mutex and entered the critical section.`, id, 'lock');
      }
    }
    this.roundRobin = id === 'A' ? 1 : 0;
    const operation = this.scenario === 'producer' ? ['read', 'write', 'advance'][this.pc[id]] : ['read', 'claim', 'advance'][this.pc[id]];
    if (this.scenario === 'producer') this.#producerOperation(id, operation);
    else this.#consumerOperation(id, operation);
    this.pc[id] += 1;
    if (this.protected && this.pc[id] === 3) {
      const next = this.mutexWaiters.shift() ?? null;
      this.mutexOwner = next;
      this.#raceEvent(`${this.#name(id)} released the mutex${next ? `; ${this.#name(next)} acquired it` : ''}.`, id, 'unlock');
    }
    this.#annotateInterleaving(eventStart, before);
    return this.snapshot();
  }
  #name(id) { return `${this.scenario === 'producer' ? 'Producer' : 'Consumer'} ${id}`; }
  #producerOperation(id, operation) {
    if (operation === 'read') {
      this.localTarget[id] = this.writePosition;
      this.#raceEvent(`${this.#name(id)} reads writePosition = ${this.writePosition}.`, id, operation);
    } else if (operation === 'write') {
      const order = { id: `O${id}`, label: `Order ${id}` };
      const displaced = this.buffer[this.localTarget[id]];
      if (displaced) { this.overwritten.push(displaced); this.#raceEvent(`${this.#name(id)} writes ${order.label} to slot ${this.localTarget[id]}, overwriting ${displaced.label}.`, id, operation); }
      else this.#raceEvent(`${this.#name(id)} writes ${order.label} to slot ${this.localTarget[id]}.`, id, operation);
      this.buffer[this.localTarget[id]] = order;
    } else {
      const from = this.writePosition; this.writePosition = (this.localTarget[id] + 1) % 5;
      this.#raceEvent(`${this.#name(id)} advances writePosition from ${from} to ${this.writePosition}.`, id, operation);
    }
  }
  #consumerOperation(id, operation) {
    if (operation === 'read') {
      this.localTarget[id] = this.readPosition; this.localItem[id] = this.buffer[this.readPosition];
      this.#raceEvent(`${this.#name(id)} reads readPosition = ${this.readPosition} and sees ${this.localItem[id]?.label ?? 'an empty slot'}.`, id, operation);
    } else if (operation === 'claim') {
      const item = this.localItem[id];
      if (item && this.processed.some((processed) => processed.id === item.id)) {
        this.duplicateClaims.push(item); this.#raceEvent(`${this.#name(id)} attempts to process ${item.label} again: duplicate consumption.`, id, operation);
      } else if (item) {
        this.processed.push(item); this.buffer[this.localTarget[id]] = null;
        this.#raceEvent(`${this.#name(id)} removes and processes ${item.label} from slot ${this.localTarget[id]}.`, id, operation);
      } else this.#raceEvent(`${this.#name(id)} cannot claim an order from an empty slot.`, id, 'error');
    } else {
      const from = this.readPosition; this.readPosition = (this.localTarget[id] + 1) % 5;
      this.#raceEvent(`${this.#name(id)} advances readPosition from ${from} to ${this.readPosition}.`, id, operation);
    }
  }
  #raceEvent(message, id, operation) {
    this.interactiveEvents.push({ step: this.interactiveEvents.length + 1, message, process: id, operation });
  }
  #annotateInterleaving(start, before) {
    const after = { value: this.scenario === 'producer' ? this.writePosition : this.readPosition, buffer: this.buffer.map((item) => item ? { ...item } : null), mutexOwner: this.mutexOwner };
    for (const event of this.interactiveEvents.slice(start)) {
      event.sharedBefore = before.value;
      event.sharedAfter = after.value;
      event.bufferBefore = before.buffer;
      event.bufferAfter = after.buffer;
      event.mutexOwnerBefore = before.mutexOwner;
      event.mutexOwnerAfter = after.mutexOwner;
      event.outcome = event.operation === 'blocked' ? 'BLOCKED' : event.operation === 'error' ? 'INVALID ACCESS' : 'EXECUTED';
    }
  }
  snapshot() {
    const lines = (this.scenario === 'consumer' ? consumerSteps : producerSteps)[this.protected ? 1 : 0];
    let processStates;
    if (this.protected) {
      processStates = [
        { id: 'A', state: this.index === 0 ? 'READY' : this.index < 4 ? 'RUNNING' : 'COMPLETED' },
        { id: 'B', state: this.index === 0 ? 'READY' : this.index < 4 ? 'WAITING' : this.index < 5 ? 'RUNNING' : 'COMPLETED' },
      ];
    } else if (this.index >= 5) {
      processStates = [{ id: 'A', state: 'COMPLETED' }, { id: 'B', state: 'COMPLETED' }];
    } else if (this.index === 0) {
      processStates = [{ id: 'A', state: 'READY' }, { id: 'B', state: 'READY' }];
    } else {
      const current = this.events.at(-1)?.process === `${this.scenario === 'producer' ? 'P' : 'C'}-A` ? 'A' : 'B';
      processStates = [{ id: 'A', state: current === 'A' ? 'RUNNING' : 'READY' }, { id: 'B', state: current === 'B' ? 'RUNNING' : 'READY' }];
    }
    const processStatesInteractive = ['A', 'B'].map((id) => ({ id, state: this.pc[id] >= 3 ? 'COMPLETED' : this.protected && this.mutexWaiters.includes(id) ? 'WAITING' : this.protected && this.mutexOwner === id ? 'RUNNING' : this.pc[id] > 0 ? 'READY' : 'READY' }));
    return { scenario: this.scenario, protected: Boolean(this.protected), index: this.index, events: [...this.events], next: lines[this.index] ?? null, complete: this.index >= lines.length, lostOrder: this.overwritten.length > 0 || (!this.protected && this.scenario === 'producer' && this.index >= 4), duplicateConsume: this.duplicateClaims.length > 0 || (!this.protected && this.scenario === 'consumer' && this.index >= 4), processStates, interactiveEvents: [...this.interactiveEvents], interactiveNextProcess: this.getNextInteractiveProcess(), processStatesInteractive, buffer: this.buffer.map((item) => item ? { ...item } : null), writePosition: this.writePosition, readPosition: this.readPosition, sharedValue: this.scenario === 'producer' ? this.writePosition : this.readPosition, mutexOwner: this.mutexOwner, mutexWaiters: [...this.mutexWaiters], overwritten: [...this.overwritten], duplicateClaims: [...this.duplicateClaims], processed: [...this.processed], interactiveComplete: this.pc.A >= 3 && this.pc.B >= 3 };
  }
}

export function createRaceConditionEngine() { return new RaceConditionEngine(); }
