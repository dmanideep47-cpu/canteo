import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CanteenRushMissionAdapter } from '../src/synclab/canteenRush/CanteenRushMissionAdapter.js';

describe('Canteen Rush 3D Mission Adapter & Synchronization Lifecycle', () => {
  it('1. Initial State: Sets up 3 student producers, 2 kitchen workers, and empty bounded rack', () => {
    const adapter = new CanteenRushMissionAdapter();
    const snap = adapter.getMissionSnapshot();

    assert.strictEqual(snap.tutorialStage.id, 'SELECT_P1');
    assert.strictEqual(snap.tutorialStage.stepNumber, 1);
    assert.strictEqual(snap.engineSnapshot.capacity, 5);
    assert.strictEqual(snap.engineSnapshot.empty, 5);
    assert.strictEqual(snap.engineSnapshot.full, 0);
    assert.strictEqual(snap.engineSnapshot.mutex, 1);
    assert.strictEqual(snap.engineSnapshot.mutexOwner, null);

    // Verify 3 student producers with expected dishes
    const producers = snap.engineSnapshot.processes.filter((p) => p.type === 'PRODUCER');
    assert.strictEqual(producers.length, 3);
    assert.strictEqual(producers[0].id, 'P1');
    assert.strictEqual(producers[0].foodName, 'Masala Dosa');
    assert.strictEqual(producers[1].id, 'P2');
    assert.strictEqual(producers[1].foodName, 'Idli & Sambar');
    assert.strictEqual(producers[2].id, 'P3');
    assert.strictEqual(producers[2].foodName, 'Vegetable Sandwich');

    // Verify 2 kitchen consumers
    const consumers = snap.engineSnapshot.workers;
    assert.strictEqual(consumers.length, 2);
    assert.strictEqual(consumers[0].id, 'C1');
    assert.strictEqual(consumers[1].id, 'C2');
  });

  it('2. Tutorial Selection: Selecting P1 advances to ADVANCE_P1 without executing any code', () => {
    const adapter = new CanteenRushMissionAdapter();
    adapter.selectEntity('P1');
    const snap = adapter.getMissionSnapshot();

    assert.strictEqual(snap.selectedEntityId, 'P1');
    assert.strictEqual(snap.tutorialStage.id, 'ADVANCE_P1');
    // Ensure no instructions were executed by merely selecting
    assert.strictEqual(snap.engineSnapshot.empty, 5);
    assert.strictEqual(snap.engineSnapshot.full, 0);
    assert.strictEqual(snap.engineSnapshot.slots.filter(Boolean).length, 0);
  });

  it('3. Producer Cycle: Stepping P1 executes full instruction sequence and publishes order O01', () => {
    const adapter = new CanteenRushMissionAdapter();
    adapter.selectEntity('P1');

    // 1. waitEmpty -> empty decreases 5 to 4
    adapter.stepSelectedProcess();
    let snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.empty, 4);

    // 2. waitMutex -> P1 acquires mutex
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.mutexOwner, 'P1');

    // 3. insert -> Masala Dosa placed in slot 0
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.slots[0]?.id, 'O01');
    assert.strictEqual(snap.engineSnapshot.slots[0]?.foodName, 'Masala Dosa');

    // 4. advanceWrite -> writePosition advances 0 to 1
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.writePosition, 1);

    // 5. releaseMutex -> mutex released
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.mutexOwner, null);

    // 6. signalFull -> full increases 0 to 1, P1 completed, stage moves to SELECT_C1
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.full, 1);
    assert.strictEqual(snap.engineSnapshot.processes.find((p) => p.id === 'P1').state, 'COMPLETED');
    assert.strictEqual(snap.tutorialStage.id, 'SELECT_C1');
  });

  it('4. Consumer Cycle: Stepping C1 dequeues order O01 and begins PREPARING outside mutex', () => {
    const adapter = new CanteenRushMissionAdapter();
    adapter.selectEntity('P1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();

    adapter.selectEntity('C1');
    let snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.tutorialStage.id, 'ADVANCE_C1');

    // 1. waitFull -> full decreases 1 to 0
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.full, 0);

    // 2. waitMutex -> C1 acquires mutex
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.mutexOwner, 'C1');

    // 3. remove -> order removed from slot 0
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.slots[0], null);

    // 4. advanceRead -> readPosition advances 0 to 1
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.readPosition, 1);

    // 5. releaseMutex -> mutex released
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.mutexOwner, null);

    // 6. signalEmpty -> empty increases 4 to 5, C1 enters PREPARING outside mutex!
    adapter.stepSelectedProcess();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.empty, 5);
    const workerC1 = snap.engineSnapshot.workers.find((w) => w.id === 'C1');
    assert.strictEqual(workerC1.state, 'PREPARING');
    assert.strictEqual(workerC1.assignedOrderId, 'O01');
    assert.strictEqual(workerC1.preparationDuration, 3);
    assert.strictEqual(workerC1.preparationProgress, 0);
    // CRITICAL: Mutex is free while preparing
    assert.strictEqual(snap.engineSnapshot.mutexOwner, null);
    assert.strictEqual(snap.tutorialStage.id, 'COOK_O01');
  });

  it('5. Kitchen Preparation Ticks & Pickup Handover: Dishes cook outside lock and deliver to student', () => {
    const adapter = new CanteenRushMissionAdapter();
    adapter.selectEntity('P1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();
    adapter.selectEntity('C1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();

    // Tick 1 & 2
    adapter.tickKitchen();
    let snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.workers[0].preparationProgress, 1);
    adapter.tickKitchen();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.workers[0].preparationProgress, 2);

    // Tick 3: Finishes cooking!
    adapter.tickKitchen();
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.workers[0].state, 'IDLE');
    assert.strictEqual(snap.engineSnapshot.readyOrders.length, 1);
    assert.strictEqual(snap.engineSnapshot.readyOrders[0].id, 'O01');
    assert.strictEqual(snap.tutorialStage.id, 'PICKUP_O01');

    // Handover / Pick up
    const pickedUp = adapter.pickUpOrder('O01');
    assert.strictEqual(pickedUp, true);
    snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.engineSnapshot.completedOrders.length, 1);
    assert.strictEqual(snap.engineSnapshot.completedOrders[0].id, 'O01');
    assert.strictEqual(snap.tutorialStage.id, 'COORDINATE_REMAINING');
  });

  it('6. Full End-to-End Mission Completion: Coordinates remaining orders and verifies debrief', () => {
    const adapter = new CanteenRushMissionAdapter();
    // Complete P1 and C1 for O01
    adapter.selectEntity('P1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();
    adapter.selectEntity('C1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();
    for (let i = 0; i < 3; i++) adapter.tickKitchen();
    adapter.pickUpOrder('O01');

    // Produce P2 (O02: Idli & Sambar) & P3 (O03: Sandwich)
    adapter.selectEntity('P2');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();
    adapter.selectEntity('P3');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();

    // Consume with C1 and C2 in parallel
    adapter.selectEntity('C1');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();
    adapter.selectEntity('C2');
    for (let i = 0; i < 6; i++) adapter.stepSelectedProcess();

    // Cook in parallel (P2 duration 5, P3 duration 2)
    for (let i = 0; i < 5; i++) adapter.tickKitchen();

    // Pick up ready orders
    adapter.pickUpOrder('O02');
    adapter.pickUpOrder('O03');

    const snap = adapter.getMissionSnapshot();
    assert.strictEqual(snap.isMissionComplete, true);
    assert.strictEqual(snap.tutorialStage.id, 'MISSION_COMPLETE');
    assert.strictEqual(snap.engineSnapshot.completedOrders.length, 3);
  });

  it('7. Blocking Semantics & Reset Isolation', () => {
    const adapter = new CanteenRushMissionAdapter();
    // With empty queue, C2 trying to waitFull blocks cleanly
    adapter.selectEntity('C2');
    const stepped = adapter.stepSelectedProcess();
    assert.strictEqual(stepped, true);
    const snap = adapter.getMissionSnapshot();
    const c2 = snap.engineSnapshot.processes.find((p) => p.id === 'C2');
    assert.strictEqual(c2.state, 'BLOCKED');
    assert.strictEqual(c2.waitingFor, 'full');

    // Attempting to step a blocked process returns false without corruption
    const stepAgain = adapter.stepSelectedProcess();
    assert.strictEqual(stepAgain, false);

    // Reset restores initial tutorial stage and empty queue
    adapter.reset();
    const resetSnap = adapter.getMissionSnapshot();
    assert.strictEqual(resetSnap.tutorialStage.id, 'SELECT_P1');
    assert.strictEqual(resetSnap.engineSnapshot.empty, 5);
    assert.strictEqual(resetSnap.engineSnapshot.full, 0);
  });
});

