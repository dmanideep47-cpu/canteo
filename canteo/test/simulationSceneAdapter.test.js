import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';
import {
  computeSceneState,
  COUNTER_SLOT_POSITIONS,
  QUEUE_CAPACITY,
  computeRoomBounds,
  getWorkstationCoords,
} from '../src/synclab/3d/SimulationSceneAdapter.js';
import { interpolateWaypoints } from '../src/synclab/3d/useProcessDepartures.js';

describe('SimulationSceneAdapter Corrected Spatial Model Verification', () => {
  it('1. Queue capacity is strictly 5 across 0, 1, 5, 8, and 12 consumers', () => {
    [0, 1, 5, 8, 12].forEach((count) => {
      const engine = new ProducerConsumerEngine();
      if (count > 0) engine.addConsumer(count);
      const scene = computeSceneState(engine.snapshot());

      assert.equal(scene.slots.length, 5, `Queue capacity must be 5 for ${count} consumers`);
      assert.equal(scene.counts.capacity, 5);
      for (let i = 0; i < 5; i++) {
        assert.equal(scene.slots[i].index, i);
        assert.equal(scene.slots[i].position[0], COUNTER_SLOT_POSITIONS[i]);
        assert.equal(scene.slots[i].position[2], 0.0); // At service hatch Z=0
      }
    });
  });

  it('2. Acceptance criterion: 8 consumers produce exactly 8 workstations inside', () => {
    const engine = new ProducerConsumerEngine();
    engine.addConsumer(8);
    const scene = computeSceneState(engine.snapshot());

    assert.equal(scene.workstations.length, 8, 'Must have exactly 8 workstations');
    assert.equal(scene.counts.workstationCount, 8);
    assert.equal(scene.counts.consumers, 8);
    // Queue buffer capacity must remain strictly 5
    assert.equal(scene.slots.length, 5);
  });

  it('3. Dynamic workstations scale with consumer count (0, 2, 5, 8, 12)', () => {
    [0, 2, 5, 8, 12].forEach((consumerCount) => {
      const engine = new ProducerConsumerEngine();
      if (consumerCount > 0) engine.addConsumer(consumerCount);
      const scene = computeSceneState(engine.snapshot());

      assert.equal(
        scene.workstations.length,
        consumerCount,
        `Workstation count must match ${consumerCount} consumers`
      );
      // All workstations must be located inside the kitchen (Z < 0)
      scene.workstations.forEach((ws, idx) => {
        assert.ok(ws.position[2] < 0, `Workstation ${ws.id} must be inside kitchen (Z < 0)`);
        assert.equal(ws.index, idx);
      });
    });
  });

  it('4. Workstation assignment is stable: adding C3 does not move C1 or C2', () => {
    const engine2 = new ProducerConsumerEngine();
    engine2.addConsumer(2);
    const scene2 = computeSceneState(engine2.snapshot());
    const c1PosBefore = [...scene2.workstations[0].position];
    const c2PosBefore = [...scene2.workstations[1].position];

    // Add 3rd consumer
    const engine3 = new ProducerConsumerEngine();
    engine3.addConsumer(3);
    const scene3 = computeSceneState(engine3.snapshot());
    const c1PosAfter = [...scene3.workstations[0].position];
    const c2PosAfter = [...scene3.workstations[1].position];

    assert.deepEqual(c1PosBefore, c1PosAfter, 'C1 workstation position must remain stable');
    assert.deepEqual(c2PosBefore, c2PosAfter, 'C2 workstation position must remain stable');
  });

  it('5. Producers stay strictly outside (Z >= 0.5) and never enter the kitchen', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(4);
    // Step one producer to acquire mutex at the counter
    engine.step('P1'); // waitEmpty
    engine.step('P1'); // waitMutex -> acquires mutex at counter
    const scene = computeSceneState(engine.snapshot());

    const producerTokens = scene.tokens.filter((t) => t.type === 'PRODUCER');
    assert.ok(producerTokens.length > 0);

    producerTokens.forEach((t) => {
      assert.ok(
        t.position[2] >= 0.5,
        `Producer ${t.id} at Z=${t.position[2]} must stay outside the kitchen (Z >= 0.5)`
      );
    });

    const p1 = producerTokens.find((t) => t.id === 'P1');
    assert.ok(p1.isMutexOwner);
    assert.equal(p1.zone, 'SERVICE_HATCH_OUTSIDE');
    assert.equal(p1.position[0], COUNTER_SLOT_POSITIONS[0]);
  });

  it('6. Consumers stay strictly inside (Z <= 0.0) at their workstations or collection aisle', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(1);
    engine.addConsumer(3);
    // Submit order from P1
    for (let i = 0; i < 4; i++) engine.stepNextInstruction();
    // Consumer C1 collects and prepares
    for (let i = 0; i < 6; i++) engine.stepNextInstruction();
    const scene = computeSceneState(engine.snapshot());

    const consumerTokens = scene.tokens.filter((t) => t.type === 'CONSUMER');
    assert.equal(consumerTokens.length, 3);

    consumerTokens.forEach((t) => {
      assert.ok(
        t.position[2] <= 0.0,
        `Consumer ${t.id} at Z=${t.position[2]} must stay inside the kitchen (Z <= 0.0)`
      );
    });
  });

  it('7. Mutex ownership is associated with the shared counter access at the hatch', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(1);
    const sceneBefore = computeSceneState(engine.snapshot());
    assert.equal(sceneBefore.counterAccess.isLocked, false);
    assert.equal(sceneBefore.counterAccess.ownerId, null);
    assert.equal(sceneBefore.counterAccess.label, 'Counter Free (Mutex Available)');

    // Step P1 to acquire mutex
    engine.step('P1');
    engine.step('P1');
    const sceneAfter = computeSceneState(engine.snapshot());
    assert.equal(sceneAfter.counterAccess.isLocked, true);
    assert.equal(sceneAfter.counterAccess.ownerId, 'P1');
    assert.equal(sceneAfter.counterAccess.ownerType, 'PRODUCER');
    assert.match(sceneAfter.counterAccess.label, /Order Submission: P1/);
  });

  it('8. Safe removal decreases consumer count and removes corresponding workstation', () => {
    const engine = new ProducerConsumerEngine();
    engine.addConsumer(3);
    const sceneInitial = computeSceneState(engine.snapshot());
    assert.equal(sceneInitial.workstations.length, 3);

    // Remove one idle consumer
    engine.removeProcess('CONSUMER');
    const sceneAfter = computeSceneState(engine.snapshot());
    assert.equal(sceneAfter.workstations.length, 2);
    assert.equal(sceneAfter.counts.consumers, 2);
    assert.equal(sceneAfter.counts.workstationCount, 2);
  });

  it('9. Room bounds expand depth for larger consumer counts without squeezing', () => {
    const room2 = computeRoomBounds(2);
    const room8 = computeRoomBounds(8);
    const room12 = computeRoomBounds(12);

    assert.equal(room2.numRows, 1);
    assert.equal(room8.numRows, 2);
    assert.equal(room12.numRows, 3);

    assert.ok(room8.interiorDepth > room2.interiorDepth);
    assert.ok(room12.interiorDepth > room8.interiorDepth);
    assert.equal(room2.frontWallZ, 0.0);
    assert.equal(room8.frontWallZ, 0.0);
    assert.equal(room12.frontWallZ, 0.0);
  });

  it('10. Finite producer single workload completion departs via outside exit path and disappears', () => {
    const engine = new ProducerConsumerEngine();
    engine.addProducer(1, { workloadMode: 'single' });
    // Run P1 through entire cycle: waitEmpty, waitMutex, insert, advanceWrite, releaseMutex, signalFull
    for (let i = 0; i < 6; i++) {
      engine.stepNextInstruction();
    }
    const snap = engine.snapshot();
    const p1 = snap.processes.find((p) => p.id === 'P1');
    assert.equal(p1.state, 'COMPLETED');

    // Scene while departing: token along outside exit path
    const departingMap = new Map();
    departingMap.set('P1', {
      id: 'P1',
      type: 'PRODUCER',
      role: 'Student Producer',
      currentPosition: [7.0, 0.35, 2.6],
      departed: false,
    });
    const sceneDeparting = computeSceneState(snap, { departingMap, departedIds: new Set() });
    const p1Token = sceneDeparting.tokens.find((t) => t.id === 'P1');
    assert.ok(p1Token, 'P1 token must be present during departure');
    assert.equal(p1Token.zone, 'EXIT_PATH_OUTSIDE');
    assert.equal(p1Token.stateLabel, 'Order Submitted · Leaving');
    assert.equal(p1Token.position[0], 7.0);
    assert.equal(sceneDeparting.counts.producers, 0, 'Active producer count decreases when completed');

    // Scene after departure completes: token is completely removed
    const departedIds = new Set(['P1']);
    const sceneDeparted = computeSceneState(snap, { departingMap, departedIds });
    assert.equal(sceneDeparted.tokens.find((t) => t.id === 'P1'), undefined, 'P1 token must be removed from scene');
    assert.equal(sceneDeparted.counts.producers, 0);
  });

  it('11. Finite consumer single workload completion exits through staff door and releases workstation', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1, { workloadMode: 'single' });
    engine.addConsumer(1, { workloadMode: 'single' });
    // Submit order from P1
    for (let i = 0; i < 6; i++) engine.stepNextInstruction();
    // Consumer collects order
    for (let i = 0; i < 6; i++) engine.stepNextInstruction();
    // Advance kitchen ticks until preparation finishes
    while (engine.workers.some((w) => w.state === 'PREPARING')) {
      engine.tickKitchen();
    }
    const snap = engine.snapshot();
    const c1 = snap.processes.find((p) => p.id === 'C1');
    assert.equal(c1.state, 'COMPLETED', 'Single workload consumer must reach COMPLETED');

    // While departing: walking towards Staff Exit Door
    const departingMap = new Map();
    departingMap.set('C1', {
      id: 'C1',
      type: 'CONSUMER',
      role: 'Kitchen Worker',
      currentPosition: [6.0, 0.35, -2.5],
      departed: false,
    });
    const sceneDeparting = computeSceneState(snap, { departingMap, departedIds: new Set() });
    const c1Token = sceneDeparting.tokens.find((t) => t.id === 'C1');
    assert.ok(c1Token, 'C1 token must be present during departure');
    assert.equal(c1Token.zone, 'EXITING_STAFF_DOOR');
    assert.equal(c1Token.stateLabel, 'Finished · Leaving');
    assert.equal(c1Token.position[0], 6.0);
    assert.equal(sceneDeparting.workstations.length, 1, 'Workstation exists during departure');
    assert.equal(sceneDeparting.workstations[0].isDeparting, true);

    // After departure completes: token removed and workstation released
    const departedIds = new Set(['C1']);
    const sceneDeparted = computeSceneState(snap, { departingMap, departedIds });
    assert.equal(sceneDeparted.tokens.find((t) => t.id === 'C1'), undefined, 'C1 token removed');
    assert.equal(sceneDeparted.workstations.length, 0, 'Workstation released upon departure');
    assert.equal(sceneDeparted.counts.consumers, 0);
  });

  it('12. Waiting consumers do not exit on idle; they remain at their workstation', () => {
    const engine = new ProducerConsumerEngine();
    engine.addConsumer(2);
    // Consumers C1 and C2 wait for orders
    engine.step('C1'); // waitFull -> BLOCKED
    engine.step('C2'); // waitFull -> BLOCKED
    const snap = engine.snapshot();

    const scene = computeSceneState(snap);
    assert.equal(scene.tokens.length, 2);
    scene.tokens.forEach((t) => {
      assert.equal(t.type, 'CONSUMER');
      assert.equal(t.zone, 'WORKSTATION');
      assert.equal(t.stateLabel, 'Waiting for an order');
      assert.ok(t.position[2] < 0, 'Must remain inside kitchen');
    });
    assert.equal(scene.workstations.length, 2);
    assert.equal(scene.counts.consumers, 2);
  });

  it('13. Continuous consumers stay inside at workstation after preparing an order', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1, { workloadMode: 'single' });
    engine.addConsumer(1, { workloadMode: 'continuous' });
    for (let i = 0; i < 6; i++) engine.stepNextInstruction(); // P1 submits
    for (let i = 0; i < 6; i++) engine.stepNextInstruction(); // C1 claims
    while (engine.workers.some((w) => w.state === 'PREPARING')) {
      engine.tickKitchen();
    }
    const snap = engine.snapshot();
    const c1 = snap.processes.find((p) => p.id === 'C1');
    assert.equal(c1.state, 'READY', 'Continuous consumer returns to READY');
    assert.equal(c1.completedCount, 1);

    const scene = computeSceneState(snap);
    assert.equal(scene.counts.consumers, 1, 'Continuous consumer remains active');
    assert.equal(scene.workstations.length, 1);
    const token = scene.tokens.find((t) => t.id === 'C1');
    assert.equal(token.zone, 'WORKSTATION');
    assert.equal(token.stateLabel, 'Kitchen Worker Ready');
  });

  it('14. Graceful removal: consumer preparing finishes dish then exits and releases workstation', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(1, { workloadMode: 'single' });
    engine.addConsumer(1, { workloadMode: 'continuous' });
    for (let i = 0; i < 6; i++) engine.stepNextInstruction(); // P1 submits
    for (let i = 0; i < 6; i++) engine.stepNextInstruction(); // C1 claims
    assert.equal(engine.workers[0].state, 'PREPARING');

    // Request graceful removal
    const res = engine.removeProcess('C1');
    assert.equal(res.success, true);
    assert.equal(res.graceful, true);

    // Finish preparation
    while (engine.workers.some((w) => w.state === 'PREPARING')) {
      engine.tickKitchen();
    }
    const snap = engine.snapshot();
    assert.equal(snap.processes.some((p) => p.id === 'C1'), false, 'C1 retired and removed from processes');

    // Scene with departing Map
    const departingMap = new Map();
    departingMap.set('C1', {
      id: 'C1',
      type: 'CONSUMER',
      role: 'Kitchen Worker',
      currentPosition: [7.5, 0.35, -2.5],
      departed: false,
    });
    const sceneDeparting = computeSceneState(snap, { departingMap, departedIds: new Set() });
    const c1Token = sceneDeparting.tokens.find((t) => t.id === 'C1');
    assert.ok(c1Token, 'Departing token rendered even if removed from engine processes');
    assert.equal(c1Token.zone, 'EXITING_STAFF_DOOR');

    // Departure completes
    const departedIds = new Set(['C1']);
    const sceneDeparted = computeSceneState(snap, { departingMap, departedIds });
    assert.equal(sceneDeparted.tokens.find((t) => t.id === 'C1'), undefined);
    assert.equal(sceneDeparted.workstations.length, 0);
  });

  it('15. Completed orders count remains strictly authoritative throughout departures', () => {
    const engine = new ProducerConsumerEngine({ persistentConsumers: true });
    engine.addProducer(2, { workloadMode: 'single' });
    engine.addConsumer(2, { workloadMode: 'single' });
    // P1 and P2 submit
    for (let i = 0; i < 12; i++) engine.stepNextInstruction();
    // C1 and C2 claim
    for (let i = 0; i < 12; i++) engine.stepNextInstruction();
    while (engine.workers.some((w) => w.state === 'PREPARING')) {
      engine.tickKitchen();
    }
    // Student picks up both ready orders
    engine.readyOrderIds.slice().forEach((id) => engine.pickUpOrder(id));

    const snap = engine.snapshot();
    assert.equal(snap.completedOrders.length, 2);

    // Compute scene before and after departures
    const sceneBefore = computeSceneState(snap);
    assert.equal(sceneBefore.counts.completed, 2);

    const departedIds = new Set(['P1', 'P2', 'C1', 'C2']);
    const sceneAfter = computeSceneState(snap, { departedIds });
    assert.equal(sceneAfter.counts.completed, 2, 'Completed count unchanged by departures');
  });

  it('16. interpolateWaypoints correctly computes 3D coordinates along path', () => {
    const waypoints = [
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
    ];
    assert.deepEqual(interpolateWaypoints(waypoints, 0), [0, 0, 0]);
    assert.deepEqual(interpolateWaypoints(waypoints, 0.25), [5, 0, 0]);
    assert.deepEqual(interpolateWaypoints(waypoints, 0.5), [10, 0, 0]);
    assert.deepEqual(interpolateWaypoints(waypoints, 0.75), [10, 0, 5]);
    assert.deepEqual(interpolateWaypoints(waypoints, 1.0), [10, 0, 10]);
  });
});
