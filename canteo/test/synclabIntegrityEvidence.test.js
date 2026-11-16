import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { SIMULATOR_SCENARIOS, loadSimulatorScenario, startClassroomDemo, stepClassroomDemo } from '../src/synclab/scenarios.js';
import { RaceConditionEngine } from '../src/synclab/engine/RaceConditionEngine.js';
import { createExperimentRecord, experimentToCsv, experimentToJson, simulatorScenarioResult } from '../src/synclab/evidence.js';

test('integrity monitor reports live initial, full, empty and in-flight accounting states', () => {
  const engine = new ProducerConsumerEngine();
  assert.equal(engine.snapshot().integrity.passed, true);
  assert.equal(engine.snapshot().integrity.checks.find((item) => item.id === 'stable-accounting').status, 'PASS');
  engine.addProducer(5); engine.runUntilBlocked();
  let state = engine.snapshot();
  assert.equal(state.integrity.passed, true); assert.equal(state.occupancy, 5); assert.equal(state.empty, 0);
  engine.addConsumer(); engine.stepNextInstruction(); // full wait
  engine.stepNextInstruction(); // mutex wait
  engine.stepNextInstruction(); // removal reserves an empty permit
  state = engine.snapshot();
  assert.equal(state.integrity.passed, true);
  assert.equal(state.integrity.checks.find((item) => item.id === 'stable-accounting').status, 'IN FLIGHT');
  assert.equal(state.empty + state.full + state.reservedEmpty + state.reservedFull, 5);
});

test('integrity failure latches a process and cause diagnostic after a corrupted safe-engine step', () => {
  const engine = new ProducerConsumerEngine(); engine.addProducer();
  engine.buffer.readPosition = 5;
  engine.stepNextInstruction();
  const state = engine.snapshot();
  assert.equal(state.integrityFailure.invariant, 'circular-index');
  assert.equal(state.integrityFailure.processId, 'P1');
  assert.ok(state.integrityFailure.causeEvent);
  const count = state.events.length;
  engine.stepNextInstruction();
  assert.equal(engine.snapshot().events.length, count);
});

test('integrity monitor catches a committed order disappearing from the shared buffer', () => {
  const engine = new ProducerConsumerEngine(); engine.addProducer();
  for (let index = 0; index < 3; index += 1) engine.stepNextProcess('P1');
  const slot = engine.buffer.writePosition === 0 ? 0 : engine.buffer.writePosition - 1;
  engine.buffer.slots[slot] = null;
  const integrity = engine.checkIntegrity();
  assert.equal(integrity.passed, false);
  assert.equal(integrity.checks.find((item) => item.id === 'order-integrity').status, 'FAIL');
});

test('mixed producers and consumers preserve unique exactly-once orders and recorded transitions', () => {
  const engine = new ProducerConsumerEngine(); engine.addProducer(5); engine.addConsumer(5);
  for (let i = 0; i < 100 && engine.snapshot().processes.some((p) => !['COMPLETED', 'BLOCKED', 'WAITING'].includes(p.state)); i += 1) engine.stepNextInstruction();
  const state = engine.snapshot();
  assert.equal(state.integrity.passed, true);
  const consumed = state.processes.filter((p) => p.result).map((p) => p.result.id);
  assert.equal(consumed.length, 5); assert.equal(new Set(consumed).size, 5);
  assert.ok(state.events.some((event) => event.transition?.from === 'RUNNING' && event.transition.to === 'COMPLETED'));
  assert.ok(state.events.every((event) => !event.transition || (event.transition.from && event.transition.to)));
});

test('scenario objective validation is based on state and event records', () => {
  assert.equal(SIMULATOR_SCENARIOS.length, 6);
  const engine = new ProducerConsumerEngine();
  loadSimulatorScenario('wrap', engine);
  assert.equal(simulatorScenarioResult('wrap', engine.snapshot()).passed, false);
  engine.runUntilBlocked();
  assert.equal(simulatorScenarioResult('wrap', engine.snapshot()).passed, true);
});

test('evidence record exports recorded events as valid JSON and escaped CSV', () => {
  const engine = new ProducerConsumerEngine(); engine.addProducer(); engine.runUntilBlocked();
  const state = engine.snapshot();
  const report = createExperimentRecord({ title: 'Test, evidence', objective: 'Check queue', expected: 'Order inserted', initialState: { ...state, empty: 5, full: 0, occupancy: 0, slots: Array(5).fill(null) }, finalState: state });
  assert.equal(JSON.parse(experimentToJson(report)).events.length, state.events.length);
  const csv = experimentToCsv(report);
  assert.match(csv, /"Test, evidence"/); assert.match(csv, /"P1"/); assert.ok(csv.split('\r\n').every((line) => line.startsWith('"')));
  assert.equal(report.events.filter((event) => event.type === 'insert').length, 1);
});

test('classroom demonstrations reset and replay deterministically', () => {
  const engine = new ProducerConsumerEngine(); const races = { unsafe: new RaceConditionEngine(), safe: new RaceConditionEngine() };
  let demo = startClassroomDemo('producer-block', engine, races);
  const initial = engine.snapshot();
  for (let i = 0; i < 4; i += 1) demo = stepClassroomDemo(demo, engine, races);
  const firstTrace = engine.snapshot().events.map((event) => [event.type, event.message]);
  demo = startClassroomDemo('producer-block', engine, races);
  assert.equal(engine.snapshot().occupancy, initial.occupancy);
  for (let i = 0; i < 4; i += 1) demo = stepClassroomDemo(demo, engine, races);
  assert.deepEqual(engine.snapshot().events.map((event) => [event.type, event.message]), firstTrace);
});

test('race classroom evidence preserves the actual unsafe/protected teaching interleaving', () => {
  const engine = new ProducerConsumerEngine(); const races = { unsafe: new RaceConditionEngine(), safe: new RaceConditionEngine() };
  let demo = startClassroomDemo('race-protection', engine, races);
  while (demo.index < demo.steps.length) demo = stepClassroomDemo(demo, engine, races);
  assert.equal(demo.executionTrace[0].lane, 'unsafe');
  assert.ok(demo.executionTrace.some((event) => event.message.includes('overwriting')));
  assert.ok(demo.executionTrace.some((event) => event.lane === 'safe' && event.operation === 'blocked'));
  assert.ok(demo.executionTrace.findIndex((event) => event.lane === 'safe') > demo.executionTrace.findIndex((event) => event.lane === 'unsafe'));
});
