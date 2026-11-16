import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import { RaceConditionEngine } from '../src/synclab/engine/RaceConditionEngine.js';
import { CHALLENGES, EXPERIMENTS, evaluateChallenge, evaluateExperiment, startChallenge, startExperiment } from '../src/synclab/learningModes.js';

function finish(engine, limit = 200) {
  for (let i = 0; i < limit && engine.snapshot().processes.some((p) => p.state === 'READY' || p.state === 'RUNNING'); i += 1) engine.stepNextInstruction();
  return engine.snapshot();
}
function races() { return { unsafe: new RaceConditionEngine(), safe: new RaceConditionEngine() }; }

test('six guided experiments and four challenges have unique ids and learning goals', () => {
  assert.equal(EXPERIMENTS.length, 6); assert.equal(new Set(EXPERIMENTS.map((x) => x.id)).size, 6);
  assert.equal(CHALLENGES.length, 4); assert.equal(new Set(CHALLENGES.map((x) => x.id)).size, 4);
  assert.ok(EXPERIMENTS.every((x) => x.objective && x.start && x.instructions.length && x.knowledge));
});

test('guided fill experiment only completes after five orders and a sixth producer blocks', () => {
  const engine = new ProducerConsumerEngine(); const race = races(); startExperiment('fill', engine, race);
  assert.equal(evaluateExperiment('fill', engine.snapshot(), { unsafe: race.unsafe.snapshot() }), false);
  const state = finish(engine);
  assert.equal(evaluateExperiment('fill', state, { unsafe: race.unsafe.snapshot() }), true);
});

test('guided empty experiment completes after a waiting consumer receives and consumes an order', () => {
  const engine = new ProducerConsumerEngine(); startExperiment('empty', engine, races());
  finish(engine); assert.equal(evaluateExperiment('empty', engine.snapshot(), {}), false);
  engine.addProducer(); finish(engine);
  assert.equal(evaluateExperiment('empty', engine.snapshot(), {}), true);
});

test('guided wraparound completion depends on an actual write-pointer 4-to-0 event', () => {
  const engine = new ProducerConsumerEngine(); startExperiment('wrap', engine, races());
  engine.addProducer(5); const state = finish(engine);
  assert.ok(state.events.some((event) => event.operation === 'advanceWrite' && event.message.includes('from 4 to 0')));
  assert.equal(evaluateExperiment('wrap', state, {}), true);
});

test('guided race experiments use isolated deterministic race engines', () => {
  const engine = new ProducerConsumerEngine(); const pair = races(); startExperiment('producer-race', engine, pair);
  assert.equal(pair.unsafe.snapshot().buffer.every((slot) => slot === null), true);
  pair.unsafe.stepProcess('A'); pair.unsafe.stepProcess('B'); pair.unsafe.stepProcess('A'); pair.unsafe.stepProcess('B');
  assert.equal(evaluateExperiment('producer-race', engine.snapshot(), { unsafe: pair.unsafe.snapshot() }), true);
  const other = races(); startExperiment('consumer-race', engine, other);
  other.unsafe.stepProcess('A'); other.unsafe.stepProcess('B'); other.unsafe.stepProcess('A'); other.unsafe.stepProcess('B');
  assert.equal(evaluateExperiment('consumer-race', engine.snapshot(), { unsafe: other.unsafe.snapshot() }), true);
});

test('guided mutex experiment requires two distinct completed producer insertions and a mutex wait', () => {
  const engine = new ProducerConsumerEngine(); startExperiment('mutex', engine, races());
  assert.equal(evaluateExperiment('mutex', engine.snapshot(), {}), false);
  const state = finish(engine);
  assert.equal(evaluateExperiment('mutex', state, {}), true);
});

test('challenge checking does not pass or disclose a solution before an attempted operation', () => {
  const engine = new ProducerConsumerEngine(); const setup = startChallenge('full', engine);
  const result = evaluateChallenge('full', engine.snapshot(), setup.baselineSimulationEvents);
  assert.equal(result.passed, false); assert.equal(result.attempted, false);
  assert.match(result.message, /Execute at least one/);
});

test('challenge validation is based on live state after the student attempts it', () => {
  const engine = new ProducerConsumerEngine(); const setup = startChallenge('full', engine);
  finish(engine);
  const result = evaluateChallenge('full', engine.snapshot(), setup.baselineSimulationEvents);
  assert.equal(result.attempted, true); assert.equal(result.passed, true);
});

test('challenge setup supplies the requested starting conditions without marking success', () => {
  const engine = new ProducerConsumerEngine();
  let setup = startChallenge('empty', engine); assert.equal(engine.snapshot().occupancy, 0);
  assert.equal(evaluateChallenge('empty', engine.snapshot(), setup.baselineSimulationEvents).passed, false);
  setup = startChallenge('mutex', engine); assert.equal(engine.snapshot().processes.filter((p) => p.type === 'PRODUCER').length, 2);
  assert.equal(evaluateChallenge('mutex', engine.snapshot(), setup.baselineSimulationEvents).passed, false);
  setup = startChallenge('wrap', engine); assert.equal(engine.snapshot().writePosition, 4);
  assert.equal(evaluateChallenge('wrap', engine.snapshot(), setup.baselineSimulationEvents).passed, false);
});

test('process stepping runs local critical-section instructions to the next mutex boundary', () => {
  const engine = new ProducerConsumerEngine(); engine.addProducer();
  let state = engine.stepNextProcess(); assert.equal(state.lastInstruction.op, 'waitEmpty');
  state = engine.stepNextProcess(); assert.equal(state.lastInstruction.op, 'waitMutex');
  state = engine.stepNextProcess(); assert.equal(state.lastInstruction.op, 'releaseMutex');
  assert.deepEqual(state.events.filter((event) => event.processId === 'P1' && event.type === 'instruction').slice(0, 4).map((event) => event.operation), ['releaseMutex', 'advanceWrite', 'insert', 'waitMutex']);
});

test('race interleaving accepts explicit A/B order and records isolated lost-update evidence', () => {
  const race = new RaceConditionEngine(); race.stepProcess('A'); race.stepProcess('B'); race.stepProcess('A');
  assert.equal(race.snapshot().buffer[0].label, 'Order A');
  race.stepProcess('B');
  assert.equal(race.snapshot().buffer[0].label, 'Order B');
  assert.equal(race.snapshot().overwritten[0].label, 'Order A');
  assert.equal(race.snapshot().lostOrder, true);
});

test('protected race interleaving blocks the competing process until mutex handoff', () => {
  const race = new RaceConditionEngine(); race.setProtected(true);
  race.stepProcess('A'); const blocked = race.stepProcess('B');
  assert.equal(blocked.mutexWaiters[0], 'B'); assert.equal(blocked.processStatesInteractive[1].state, 'WAITING');
  race.stepProcess('A'); race.stepProcess('A');
  assert.equal(race.snapshot().mutexOwner, 'B');
  race.stepProcess('B'); race.stepProcess('B'); race.stepProcess('B');
  assert.equal(race.snapshot().overwritten.length, 0);
  assert.equal(new Set(race.snapshot().buffer.filter(Boolean).map((item) => item.id)).size, 2);
});

