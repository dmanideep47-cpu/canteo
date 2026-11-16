import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { RaceConditionEngine } from '../src/synclab/engine/RaceConditionEngine.js';
import { CLASSROOM_DEMOS, SIMULATOR_SCENARIOS, loadSimulatorScenario, startClassroomDemo, stepClassroomDemo } from '../src/synclab/scenarios.js';

function createRaces() {
  return { unsafe: new RaceConditionEngine(), safe: new RaceConditionEngine() };
}

test('all six simulator scenarios load deterministic five-slot states', () => {
  const engine = new ProducerConsumerEngine();
  for (const scenario of SIMULATOR_SCENARIOS) {
    const result = loadSimulatorScenario(scenario.id, engine);
    assert.equal(result.id, scenario.id);
    assert.equal(result.state.capacity, 5);
    assert.equal(result.state.empty + result.state.full + result.state.reservedEmpty + result.state.reservedFull, 5);
    assert.equal(engine.assertInvariants(), true);
  }
  assert.equal(loadSimulatorScenario('full', engine).state.occupancy, 5);
  assert.equal(engine.snapshot().processes.filter((process) => process.state === 'READY').length, 1);
  assert.equal(loadSimulatorScenario('wrap', engine).state.writePosition, 4);
  assert.throws(() => loadSimulatorScenario('missing', engine), /Unknown simulator scenario/);
});

test('producer blocking classroom demonstration steps through FIFO wake and resumed insertion', () => {
  const engine = new ProducerConsumerEngine(); const races = createRaces();
  let demo = startClassroomDemo('producer-block', engine, races);
  assert.equal(demo.steps.length, 12);
  for (let index = 0; index < demo.steps.length; index += 1) {
    demo = stepClassroomDemo(demo, engine, races);
    assert.equal(engine.assertInvariants(), true);
    if (index === 0) assert.equal(engine.snapshot().processes.find((process) => process.id === demo.processIds.producer).state, 'BLOCKED');
  }
  const state = engine.snapshot();
  assert.equal(state.occupancy, 5);
  assert.equal(state.processes.find((process) => process.id === demo.processIds.producer).state, 'COMPLETED');
  assert.ok(state.events.some((event) => event.message.includes(`woke from empty`)));
  assert.ok(state.events.some((event) => event.message.includes('inserted') && event.processId === demo.processIds.producer));
});

test('consumer blocking classroom demonstration wakes and consumes the published order', () => {
  const engine = new ProducerConsumerEngine(); const races = createRaces();
  let demo = startClassroomDemo('consumer-block', engine, races);
  for (let index = 0; index < demo.steps.length; index += 1) {
    demo = stepClassroomDemo(demo, engine, races);
    assert.equal(engine.assertInvariants(), true);
    if (index === 0) assert.equal(engine.snapshot().processes.find((process) => process.id === demo.processIds.consumer).state, 'BLOCKED');
  }
  const consumer = engine.snapshot().processes.find((process) => process.id === demo.processIds.consumer);
  assert.equal(consumer.state, 'COMPLETED');
  assert.equal(consumer.result.label, 'Order 01');
  assert.equal(engine.snapshot().occupancy, 0);
});

test('classroom race demonstration reproduces isolated lost update before protected serialization', () => {
  const engine = new ProducerConsumerEngine(); const races = createRaces();
  let demo = startClassroomDemo('race-protection', engine, races);
  for (let index = 0; index < demo.steps.length; index += 1) {
    demo = stepClassroomDemo(demo, engine, races);
    assert.equal(engine.assertInvariants(), true);
    assert.equal(engine.snapshot().occupancy, 0, 'race lesson never mutates the safe bounded buffer');
  }
  assert.equal(races.unsafe.snapshot().lostOrder, true);
  assert.equal(races.safe.snapshot().lostOrder, false);
  assert.equal(races.safe.snapshot().mutexOwner, null);
  assert.equal(races.safe.snapshot().interactiveComplete, true);
  assert.equal(new Set(races.safe.snapshot().buffer.filter(Boolean).map((item) => item.id)).size, 2);
});

test('classroom demonstration catalog remains limited to the three prepared lessons', () => {
  assert.equal(CLASSROOM_DEMOS.length, 3);
  assert.equal(new Set(CLASSROOM_DEMOS.map((demo) => demo.id)).size, 3);
});
