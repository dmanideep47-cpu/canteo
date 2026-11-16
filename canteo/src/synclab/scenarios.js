export const SIMULATOR_SCENARIOS = [
  { id: 'normal', label: 'Normal operation', objective: 'Run one student request and one kitchen request through the synchronized queue.', expected: 'The order is inserted, consumed once, and the queue returns to empty.' },
  { id: 'full', label: 'Full buffer', objective: 'Observe a sixth producer block when all five slots are occupied.', expected: 'empty = 0; the sixth producer waits and does not overwrite a slot.' },
  { id: 'empty', label: 'Empty buffer', objective: 'Observe a consumer wait before it can read the queue.', expected: 'full = 0; the consumer blocks until an order is published.' },
  { id: 'wrap', label: 'Circular wraparound', objective: 'Start with four orders and advance the next producer through slot 4.', expected: 'writePosition advances from 4 to 0 modulo five.' },
  { id: 'mixed', label: 'Multiple producers and consumers', objective: 'Step three producers and three consumers through a shared queue.', expected: 'Every order is consumed once; semaphore and buffer accounting remain valid.' },
  { id: 'protected', label: 'Protected concurrent execution', objective: 'Observe two producers and two consumers contend safely for the mutex.', expected: 'The mutex has one owner at a time and the processes preserve distinct orders.' },
];

export const CLASSROOM_DEMOS = [
  { id: 'producer-block', label: 'Producer blocking on a full buffer', objective: 'A sixth producer waits; a consumer frees a slot and wakes it.' },
  { id: 'consumer-block', label: 'Consumer blocking on an empty buffer', objective: 'A consumer waits; a producer publishes an order and wakes it.' },
  { id: 'race-protection', label: 'Race condition, then mutex protection', objective: 'Reproduce a lost update in an isolated counterexample, then serialize the same producers with a mutex.' },
];

export function loadSimulatorScenario(id, engine) {
  if (id === 'start-empty') {
    engine.reset();
    return {
      id: 'start-empty',
      label: 'Start empty',
      objective: 'Begin with an empty buffer and zero processes to design your own workload.',
      expected: 'Buffer remains empty until producers are added.',
      state: engine.snapshot(),
    };
  }
  const scenario = SIMULATOR_SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new RangeError(`Unknown simulator scenario: ${id}`);
  engine.reset();
  if (id === 'normal') { engine.addProducer(); engine.addConsumer(); }
  if (id === 'full') { engine.addProducer(5); engine.runUntilBlocked(); engine.addProducer(); }
  if (id === 'empty') engine.addConsumer();
  if (id === 'wrap') { engine.addProducer(4); engine.runUntilBlocked(); engine.addProducer(); }
  if (id === 'mixed') { engine.addProducer(3); engine.addConsumer(3); }
  if (id === 'protected') { engine.addProducer(2); engine.addConsumer(2); }
  return { ...scenario, state: engine.snapshot() };
}

export function startClassroomDemo(id, engine, raceEngines) {
  const demo = CLASSROOM_DEMOS.find((item) => item.id === id);
  if (!demo) throw new RangeError(`Unknown classroom demonstration: ${id}`);
  if (id === 'producer-block') {
    loadSimulatorScenario('full', engine);
    const producer = engine.snapshot().processes.filter((process) => process.type === 'PRODUCER').at(-1).id;
    const consumer = engine.addConsumer().ids[0];
    return { ...demo, lane: 'buffer', index: 0, steps: [producer, ...Array(6).fill(consumer), ...Array(5).fill(producer)], processIds: { producer, consumer } };
  }
  if (id === 'consumer-block') {
    loadSimulatorScenario('empty', engine);
    const consumer = engine.snapshot().processes[0].id;
    const producer = engine.addProducer().ids[0];
    return { ...demo, lane: 'buffer', index: 0, steps: [consumer, ...Array(6).fill(producer), ...Array(5).fill(consumer)], processIds: { producer, consumer } };
  }
  engine.reset();
  raceEngines.unsafe.selectScenario('producer');
  raceEngines.unsafe.setProtected(false);
  raceEngines.safe.selectScenario('producer');
  raceEngines.safe.setProtected(true);
  return {
    ...demo,
    lane: 'race',
    index: 0,
    executionTrace: [],
    raceInitialState: { unsafe: raceEngines.unsafe.snapshot(), safe: raceEngines.safe.snapshot() },
    steps: [
      { lane: 'unsafe', process: 'A' }, { lane: 'unsafe', process: 'B' }, { lane: 'unsafe', process: 'A' }, { lane: 'unsafe', process: 'B' },
      { lane: 'safe', process: 'A' }, { lane: 'safe', process: 'B' }, { lane: 'safe', process: 'A' }, { lane: 'safe', process: 'A' },
      { lane: 'safe', process: 'B' }, { lane: 'safe', process: 'B' }, { lane: 'safe', process: 'B' },
    ],
  };
}

export function stepClassroomDemo(demo, engine, raceEngines) {
  if (!demo || demo.index >= demo.steps.length) return demo;
  const action = demo.steps[demo.index];
  if (demo.lane === 'buffer') engine.stepNextInstruction(action);
  else raceEngines[action.lane].stepProcess(action.process);
  let executionTrace = demo.executionTrace ?? [];
  if (demo.lane === 'race') {
    const race = raceEngines[action.lane].snapshot();
    const previousCount = executionTrace.filter((entry) => entry.lane === action.lane).length;
    executionTrace = [...executionTrace, ...race.interactiveEvents.slice(previousCount).map((event) => ({ ...event, lane: action.lane, processId: event.process }))];
  }
  return { ...demo, executionTrace, index: demo.index + 1 };
}
