import test from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import {
  CLASSROOM_EXPERIMENTS,
  EXPERIMENT_STATUS,
  evaluateExperimentChecks,
  buildExperimentReport,
  evaluateSchedulerTurn,
  explainSchedulerStep,
} from '../src/synclab/classroomExperiments.js';
import { startExperiment, evaluateExperiment, startChallenge, evaluateChallenge } from '../src/synclab/learningModes.js';

test('classroom experiments catalog contains all six required experiments (A–F)', () => {
  assert.equal(CLASSROOM_EXPERIMENTS.length, 6);
  const ids = CLASSROOM_EXPERIMENTS.map((e) => e.id);
  assert.deepEqual(ids, ['full-buffer', 'empty-buffer', 'two-consumers', 'mutex-contention', 'wraparound', 'independent-prep']);
  const letters = CLASSROOM_EXPERIMENTS.map((e) => e.letter);
  assert.deepEqual(letters, ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.ok(CLASSROOM_EXPERIMENTS.every((e) => e.title && e.objective && e.concept && e.prediction && e.checks.length > 0 && e.takeaway));
});

test('Experiment A (Full Buffer) loads exact initial conditions and observes blocking', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expA = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'full-buffer');
  expA.setupEngine(engine);

  const initial = engine.snapshot();
  assert.equal(initial.occupancy, 5, 'Buffer should start completely full');
  assert.equal(initial.empty, 0, 'No empty slot permits available');
  assert.equal(initial.full, 5, '5 orders available');
  assert.ok(initial.processes.some((p) => p.id === 'P6'), 'P6 must be ready');
  assert.ok(initial.processes.some((p) => p.id === 'C1'), 'C1 must be ready');

  // Initial checks: Not run
  let checks = evaluateExperimentChecks(expA, initial, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.IN_PROGRESS);

  // Step P6: attempts waitEmpty and blocks
  engine.stepNextInstruction('P6');
  const afterP6Step = engine.snapshot();
  const p6 = afterP6Step.processes.find((p) => p.id === 'P6');
  assert.equal(p6.state, 'BLOCKED');
  assert.equal(p6.waitingFor, 'empty');

  checks = evaluateExperimentChecks(expA, afterP6Step, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED);
  assert.ok(checks[0].stepSeq !== null);

  // Step C1 through removal and signaling
  while (engine.snapshot().events.filter((e) => e.processId === 'C1' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C1');
  }
  const afterC1 = engine.snapshot();
  checks = evaluateExperimentChecks(expA, afterC1, engine.getExecutionHistory());
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED, 'Consumer removal should be observed');

  // Verify P6 is unblocked by signal(empty)
  const p6Woken = afterC1.processes.find((p) => p.id === 'P6');
  assert.equal(p6Woken.state, 'READY');
  assert.equal(p6Woken.permit, true);
  assert.equal(checks[2].status, EXPERIMENT_STATUS.OBSERVED, 'P6 unblocking should be observed');

  // Step P6 to complete insertion
  while (engine.snapshot().events.filter((e) => e.processId === 'P6' && e.operation === 'signalFull').length === 0) {
    engine.stepNextInstruction('P6');
  }
  const finalState = engine.snapshot();
  checks = evaluateExperimentChecks(expA, finalState, engine.getExecutionHistory());
  assert.equal(checks[3].status, EXPERIMENT_STATUS.OBSERVED, 'P6 insertion should be observed');
});

test('Experiment B (Empty Buffer) demonstrates consumer blocking on empty queue', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expB = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'empty-buffer');
  expB.setupEngine(engine);

  const initial = engine.snapshot();
  assert.equal(initial.occupancy, 0, 'Buffer should start empty');
  assert.equal(initial.full, 0);

  // Step C1: blocks on full
  engine.stepNextInstruction('C1');
  let state = engine.snapshot();
  const c1 = state.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'BLOCKED');
  assert.equal(c1.waitingFor, 'full');

  let checks = evaluateExperimentChecks(expB, state, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED);

  // Step P1 to insert and signal
  while (engine.snapshot().events.filter((e) => e.processId === 'P1' && e.operation === 'signalFull').length === 0) {
    engine.stepNextInstruction('P1');
  }
  state = engine.snapshot();
  checks = evaluateExperimentChecks(expB, state, engine.getExecutionHistory());
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED);

  // Step C1 to complete removal
  while (engine.snapshot().events.filter((e) => e.processId === 'C1' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C1');
  }
  state = engine.snapshot();
  checks = evaluateExperimentChecks(expB, state, engine.getExecutionHistory());
  assert.equal(checks[2].status, EXPERIMENT_STATUS.OBSERVED);
});

test('Experiment C (Two Consumers, One Order) preserves exactly-once consumption', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expC = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'two-consumers');
  expC.setupEngine(engine);

  const initial = engine.snapshot();
  assert.equal(initial.occupancy, 1);
  assert.equal(initial.full, 1);

  // Step C1: takes permit
  engine.stepNextInstruction('C1');
  // Step C2: blocks on full
  engine.stepNextInstruction('C2');

  let state = engine.snapshot();
  const c2 = state.processes.find((p) => p.id === 'C2');
  assert.equal(c2.state, 'BLOCKED');
  assert.equal(c2.waitingFor, 'full');

  // Complete C1
  while (engine.snapshot().events.filter((e) => e.processId === 'C1' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C1');
  }
  state = engine.snapshot();

  const checks = evaluateExperimentChecks(expC, state, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED, 'Single permit claimed');
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED, 'Second consumer blocked');
  assert.equal(checks[2].status, EXPERIMENT_STATUS.OBSERVED, 'Exactly-once removal verified');
  assert.equal(state.occupancy, 0);
});

test('Experiment D (Mutex Contention) distinguishes item permits from mutex serialization', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expD = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'mutex-contention');
  expD.setupEngine(engine);

  // Both obtain item permits
  engine.stepNextInstruction('C1'); // C1 waitFull
  engine.stepNextInstruction('C2'); // C2 waitFull

  let state = engine.snapshot();
  let checks = evaluateExperimentChecks(expD, state, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED, 'Both hold item permits');

  // C1 acquires mutex
  engine.stepNextInstruction('C1'); // C1 waitMutex -> lock
  // C2 attempts mutex -> contention!
  engine.stepNextInstruction('C2'); // C2 waitMutex -> blocks

  state = engine.snapshot();
  checks = evaluateExperimentChecks(expD, state, engine.getExecutionHistory());
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED, 'Mutex contention observed');

  // Complete both consumers
  while (engine.snapshot().events.filter((e) => e.processId === 'C1' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C1');
  }
  while (engine.snapshot().events.filter((e) => e.processId === 'C2' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C2');
  }

  state = engine.snapshot();
  checks = evaluateExperimentChecks(expD, state, engine.getExecutionHistory());
  assert.equal(checks[2].status, EXPERIMENT_STATUS.OBSERVED, 'Serialized removals completed');
});

test('Experiment E (Wraparound) verifies modulo indexing (4 -> 0) and slot reuse', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expE = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'wraparound');
  expE.setupEngine(engine);

  // Step P5 through insertion into slot 4 and modulo wrap
  while (engine.snapshot().events.filter((e) => e.processId === 'P5' && e.operation === 'signalFull').length === 0) {
    engine.stepNextInstruction('P5');
  }
  let state = engine.snapshot();
  let checks = evaluateExperimentChecks(expE, state, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED, 'Slot 4 write observed');
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED, 'Modulo 5 wraparound observed');

  // Free slot 0 using C1
  while (engine.snapshot().events.filter((e) => e.processId === 'C1' && e.operation === 'signalEmpty').length === 0) {
    engine.stepNextInstruction('C1');
  }
  // Reuse slot 0 using P6
  while (engine.snapshot().events.filter((e) => e.processId === 'P6' && e.operation === 'signalFull').length === 0) {
    engine.stepNextInstruction('P6');
  }

  state = engine.snapshot();
  checks = evaluateExperimentChecks(expE, state, engine.getExecutionHistory());
  assert.equal(checks[2].status, EXPERIMENT_STATUS.OBSERVED, 'Slot reuse observed');
});

test('Experiment F (Independent Prep) demonstrates concurrent preparation outside mutex', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expF = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'independent-prep');
  expF.setupEngine(engine);

  // Step C1 until it enters PREPARING
  for (let i = 0; i < 10; i += 1) {
    if (engine.snapshot().workers.some((w) => w.id === 'C1' && w.state === 'PREPARING')) break;
    engine.stepNextInstruction('C1');
  }
  // Step C2 until it enters PREPARING
  for (let i = 0; i < 10; i += 1) {
    if (engine.snapshot().workers.some((w) => w.id === 'C2' && w.state === 'PREPARING')) break;
    engine.stepNextInstruction('C2');
  }

  const state = engine.snapshot();
  assert.equal(state.mutexOwner, null, 'Mutex must be free while workers cook');
  const prepWorkers = state.workers.filter((w) => w.state === 'PREPARING');
  assert.equal(prepWorkers.length, 2, 'Both workers should be preparing concurrently');

  const checks = evaluateExperimentChecks(expF, state, engine.getExecutionHistory());
  assert.equal(checks[0].status, EXPERIMENT_STATUS.OBSERVED, 'Mutex released upon dequeue');
  assert.equal(checks[1].status, EXPERIMENT_STATUS.OBSERVED, 'Concurrent preparation observed');
});

test('Manual Scheduling Exercise: rejects dispatching blocked threads with clear reason', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.reset();
  engine.addConsumer(1); // C1 at pc=0, empty queue

  // Step C1 so it blocks on full == 0
  engine.stepNextInstruction('C1');
  const state = engine.snapshot();
  const c1 = state.processes.find((p) => p.id === 'C1');
  assert.equal(c1.state, 'BLOCKED');

  // Attempt to dispatch blocked C1
  const result = evaluateSchedulerTurn(engine, 'C1');
  assert.equal(result.valid, false);
  assert.match(result.rejectionReason, /Rejected: C1 is in the BLOCKED state/);
  assert.match(result.rejectionReason, /full == 0/);
});

test('Manual Scheduling Exercise: explains valid instruction execution conceptually', () => {
  const before = { full: 2, empty: 3, readPosition: 0 };
  const after = { full: 1, empty: 3, readPosition: 0 };
  const explanation = explainSchedulerStep('waitFull', 'C1', before, after);
  assert.match(explanation, /sem_wait\(&full\)/);
  assert.match(explanation, /Decremented available orders from 2 to 1/);
});

test('buildExperimentReport produces complete structured data for academic export', () => {
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  const expA = CLASSROOM_EXPERIMENTS.find((e) => e.id === 'full-buffer');
  expA.setupEngine(engine);

  const report = buildExperimentReport({
    studentName: 'Alice Kumar',
    studentId: 'CS2026-042',
    experiment: expA,
    predictionAnswer: 'opt-a',
    predictionHypothesis: 'Consumers must return a permit.',
    conclusion: 'Producer backpressure demonstrated.',
    state: engine.snapshot(),
    history: engine.getExecutionHistory(),
  });

  assert.equal(report.studentName, 'Alice Kumar');
  assert.equal(report.studentId, 'CS2026-042');
  assert.equal(report.experimentTitle, expA.title);
  assert.equal(report.prediction.isCorrect, true);
  assert.ok(report.checks.length > 0);
  assert.equal(report.conclusion, 'Producer backpressure demonstrated.');
});

test('learningModes backward compatibility: supports both classroom and legacy experiment IDs', () => {
  const engine = new ProducerConsumerEngine();
  const raceEngines = { unsafe: { selectScenario: () => {}, setProtected: () => {}, snapshot: () => ({ interactiveEvents: [] }) }, safe: { selectScenario: () => {}, setProtected: () => {} } };

  // Classroom experiment ID
  const classroomRes = startExperiment('full-buffer', engine, raceEngines);
  assert.equal(classroomRes.section, 'simulator');

  // Legacy experiment ID
  const legacyRes = startExperiment('fill', engine, raceEngines);
  assert.equal(legacyRes.section, 'simulator');
});
