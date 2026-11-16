export const LEARNING_MODES = [
  { id: 'explore', name: 'Explore', detail: 'Manual controls and live inspection' },
  { id: 'guided', name: 'Guided Lab', detail: 'Six structured experiments' },
  { id: 'challenge', name: 'Challenge', detail: 'Solve a synchronization task' },
];

export const EXPERIMENTS = [
  { id: 'fill', title: '01 · Fill the buffer', section: 'simulator', objective: 'Fill all five slots, then show the next student blocking on empty.', start: 'Six student producer processes; the queue starts empty.', instructions: ['Run producers until all five slots are occupied.', 'Observe empty reach zero.', 'Execute the sixth producer until it blocks.'], knowledge: 'Which event wakes the blocked student?', answers: ['A consumer signals empty after taking an order.', 'The mutex is released.'], correct: 0 },
  { id: 'empty', title: '02 · Empty the buffer', section: 'simulator', objective: 'Show a kitchen consumer blocking until an order is produced.', start: 'One kitchen consumer; the queue starts empty.', instructions: ['Execute the consumer and observe its wait on full.', 'Add a student producer.', 'Continue until the consumer takes the order.'], knowledge: 'Which semaphore prevents an empty queue read?', answers: ['empty', 'full'], correct: 1 },
  { id: 'wrap', title: '03 · Circular wraparound', section: 'simulator', objective: 'Advance the write pointer from slot 4 back to slot 0 using modulo five.', start: 'An empty buffer; create and run five student producers.', instructions: ['Fill all five slots in order.', 'Observe the write pointer wrap from 4 to 0.', 'The next producer must wait until a kitchen worker frees a slot.'], knowledge: 'What is (4 + 1) mod 5?', answers: ['0', '5'], correct: 0 },
  { id: 'producer-race', title: '04 · Producer race', section: 'race', objective: 'Interleave two students so both use the same stale write position.', start: 'Unsafe race lane with writePosition at 0.', instructions: ['Step Producer A to read the pointer.', 'Step Producer B before A writes.', 'Write both orders and inspect the overwritten slot.'], knowledge: 'What did the mutex protect?', answers: ['The shared pointer and buffer write as one critical section.', 'The order label only.'], correct: 0 },
  { id: 'consumer-race', title: '05 · Consumer race', section: 'race', objective: 'Interleave two kitchen processes so they claim the same order.', start: 'Unsafe race lane with Order A at readPosition 0.', instructions: ['Step Consumer A to read the pointer.', 'Step Consumer B before A claims the order.', 'Let both attempt to process their saved candidate.'], knowledge: 'What is the observed fault?', answers: ['Duplicate consumption of one order.', 'A student producer blocks.'], correct: 0 },
  { id: 'mutex', title: '06 · Critical-section protection', section: 'simulator', objective: 'Run two producers and show the mutex serializing their writes.', start: 'Two student producer processes; an empty queue.', instructions: ['Run both processes with scheduler steps.', 'Inspect the mutex waiter and owner handoff.', 'Confirm two distinct buffer slots contain orders.'], knowledge: 'Who may release a mutex?', answers: ['Only its current owner.', 'Any waiting process.'], correct: 0 },
];

export const CHALLENGES = [
  { id: 'full', title: 'A · Full queue backpressure', prompt: 'The five queue slots are full. A new student submits an order. Demonstrate what the process does.', setup: 'A full five-order buffer and one ready student process.', hint: 'Inspect the semaphore that counts free slots.', section: 'simulator' },
  { id: 'empty', title: 'B · Empty queue request', prompt: 'The queue is empty and the kitchen requests an order. Demonstrate safe behavior.', setup: 'An empty buffer and one ready kitchen process.', hint: 'Inspect the semaphore that counts available orders.', section: 'simulator' },
  { id: 'mutex', title: 'C · Protect two producers', prompt: 'Two students insert into the shared queue. Preserve both orders in distinct slots.', setup: 'An empty buffer and two ready student processes.', hint: 'Watch who owns the mutex while the write pointer changes.', section: 'simulator' },
  { id: 'wrap', title: 'D · Wrap the write pointer', prompt: 'The write pointer is at slot 4. Insert the next order and demonstrate wraparound.', setup: 'Four orders are queued; the write pointer is at slot 4.', hint: 'The pointer should move to (4 + 1) mod 5.', section: 'simulator' },
];

export { CLASSROOM_EXPERIMENTS, MANUAL_SCHEDULING_CHALLENGE } from './classroomExperiments.js';

export function startExperiment(id, engine, raceEngines) {
  // Check classroom experiments first
  const classroomExp = (id === 'full-buffer' || id === 'empty-buffer' || id === 'two-consumers' || id === 'mutex-contention' || id === 'wraparound' || id === 'independent-prep');
  if (classroomExp) {
    if (id === 'full-buffer') { engine.reset(); engine.addProducer(5); engine.runUntilBlocked(); engine.addProducer(1); engine.addConsumer(1); engine.clearHistory('Full buffer loaded'); }
    else if (id === 'empty-buffer') { engine.reset(); engine.addConsumer(1); engine.addProducer(1); engine.clearHistory('Empty buffer loaded'); }
    else if (id === 'two-consumers') { engine.reset(); engine.addProducer(1); engine.runUntilBlocked(); engine.addConsumer(2); engine.clearHistory('Two consumers loaded'); }
    else if (id === 'mutex-contention') { engine.reset(); engine.addProducer(2); engine.runUntilBlocked(); engine.addConsumer(2); engine.clearHistory('Mutex contention loaded'); }
    else if (id === 'wraparound') { engine.reset(); engine.addProducer(4); engine.runUntilBlocked(); engine.addConsumer(1); engine.addProducer(2); engine.clearHistory('Wraparound loaded'); }
    else if (id === 'independent-prep') { engine.reset(); engine.addProducer(3); engine.runUntilBlocked(); engine.addConsumer(2); engine.clearHistory('Independent prep loaded'); }
    return { section: 'simulator', baselineSimulationEvents: engine.snapshot().events.length, baselineRaceEvents: 0 };
  }

  const experiment = EXPERIMENTS.find((item) => item.id === id);
  if (!experiment) throw new RangeError(`Unknown experiment: ${id}`);
  engine.reset();
  raceEngines.unsafe.selectScenario(id === 'consumer-race' ? 'consumer' : 'producer');
  raceEngines.unsafe.setProtected(false);
  raceEngines.safe.selectScenario(id === 'consumer-race' ? 'consumer' : 'producer');
  raceEngines.safe.setProtected(true);
  if (id === 'fill') engine.addProducer(6);
  if (id === 'empty') engine.addConsumer();
  if (id === 'mutex') engine.addProducer(2);
  return { section: experiment.section, baselineSimulationEvents: engine.snapshot().events.length, baselineRaceEvents: raceEngines.unsafe.snapshot().interactiveEvents.length };
}

export function startChallenge(id, engine) {
  if (id === 'schedule-consumers') {
    engine.reset();
    engine.addProducer(2);
    engine.runUntilBlocked();
    engine.addConsumer(2);
    engine.clearHistory('Schedule Two Consumers Safely loaded');
    return { section: 'simulator', baselineSimulationEvents: engine.snapshot().events.length };
  }

  const challenge = CHALLENGES.find((item) => item.id === id);
  if (!challenge) throw new RangeError(`Unknown challenge: ${id}`);
  engine.reset();
  if (id === 'full') { engine.addProducer(5); engine.runUntilBlocked(); engine.addProducer(); }
  if (id === 'empty') engine.addConsumer();
  if (id === 'mutex') engine.addProducer(2);
  if (id === 'wrap') { engine.addProducer(4); engine.runUntilBlocked(); engine.addProducer(); }
  return { section: challenge.section, baselineSimulationEvents: engine.snapshot().events.length };
}

export function evaluateExperiment(id, simulation, races) {
  switch (id) {
    case 'full-buffer':
    case 'fill': return simulation.occupancy === 5 && simulation.empty === 0 && simulation.processes.some((p) => p.type === 'PRODUCER' && p.state === 'BLOCKED' && p.waitingFor === 'empty');
    case 'empty-buffer':
    case 'empty': return simulation.occupancy === 0 && simulation.full === 0 && simulation.processes.some((p) => p.type === 'CONSUMER' && ((p.state === 'COMPLETED' && p.result) || (p.state === 'PREPARING' && p.result)));
    case 'wraparound':
    case 'wrap': return simulation.events.some((event) => event.operation === 'advanceWrite' && event.message.includes('from 4 to 0'));
    case 'two-consumers': return simulation.events.filter((e) => e.operation === 'remove').length === 1 && simulation.processes.some((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED' && p.waitingFor === 'full');
    case 'mutex-contention': return simulation.events.some((e) => e.message?.toLowerCase().includes('blocked on mutex')) && simulation.events.filter((e) => e.operation === 'remove').length >= 2;
    case 'independent-prep': return (simulation.workers?.filter((w) => w.state === 'PREPARING').length ?? 0) >= 2 && simulation.mutexOwner === null;
    case 'producer-race': return races.unsafe.scenario === 'producer' && races.unsafe.overwritten.length > 0;
    case 'consumer-race': return races.unsafe.scenario === 'consumer' && races.unsafe.duplicateClaims.length > 0;
    case 'mutex': {
      const inserts = simulation.events.filter((event) => event.operation === 'insert').map((event) => event.processId);
      return inserts.length >= 2 && new Set(inserts).size >= 2 && simulation.events.some((event) => event.message.includes('blocked on mutex')) && simulation.mutexOwner === null;
    }
    default: return false;
  }
}

export function evaluateChallenge(id, simulation, baselineEvents = 0) {
  const attempted = simulation.events.length > baselineEvents;
  if (!attempted) return { passed: false, attempted: false, message: 'Execute at least one process instruction before checking the challenge.' };
  let passed = false;
  if (id === 'schedule-consumers') {
    const removals = simulation.events.filter((e) => e.operation === 'remove');
    passed = removals.length === 2 && new Set(removals.map((e) => e.processId)).size === 2 && simulation.mutexOwner === null && (simulation.integrity?.passed ?? true);
  }
  if (id === 'full') passed = simulation.occupancy === 5 && simulation.empty === 0 && simulation.processes.some((p) => p.state === 'BLOCKED' && p.waitingFor === 'empty');
  if (id === 'empty') passed = simulation.occupancy === 0 && simulation.processes.some((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED' && p.waitingFor === 'full');
  if (id === 'mutex') {
    const writes = simulation.slots.filter(Boolean);
    const inserted = simulation.events.filter((event) => event.operation === 'insert');
    passed = writes.length === 2 && new Set(writes.map((item) => item.id)).size === 2 && inserted.length === 2 && simulation.mutexOwner === null;
  }
  if (id === 'wrap') passed = simulation.events.some((event) => event.operation === 'advanceWrite' && event.message.includes('from 4 to 0'));
  const message = passed
    ? 'Challenge passed. The simulation state demonstrates the required synchronization behavior.'
    : id === 'schedule-consumers'
    ? 'Not yet: schedule both consumers safely through wait(full), wait(mutex), remove, and releaseMutex until two distinct orders are retrieved.'
    : id === 'full'
    ? 'Not yet: fill the buffer and execute the new producer until it blocks on empty.'
    : id === 'empty'
    ? 'Not yet: execute the kitchen process while full is zero and confirm it blocks.'
    : id === 'mutex'
    ? 'Not yet: complete both producers and verify that two distinct orders occupy separate slots.'
    : 'Not yet: advance the write pointer from slot 4 to slot 0.';
  return { passed, attempted: true, message };
}
