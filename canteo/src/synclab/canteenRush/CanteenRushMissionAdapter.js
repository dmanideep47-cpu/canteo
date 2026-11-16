import { ProducerConsumerEngine, PROCESS_INSTRUCTIONS } from '../engine/ProducerConsumerEngine.js';

export const TUTORIAL_STAGES = {
  SELECT_P1: {
    id: 'SELECT_P1',
    stepNumber: 1,
    title: 'Select Student P1',
    instruction: 'Student P1 has arrived at the order counter with a request for Masala Dosa. Click on P1 to select this student producer.',
    targetEntity: 'P1',
    requiredAction: 'SELECT_P1',
  },
  ADVANCE_P1: {
    id: 'ADVANCE_P1',
    stepNumber: 2,
    title: 'Produce Masala Dosa (P1)',
    instruction: 'Click "Advance Next Step" to step P1 through producer synchronization: wait(empty) → wait(mutex) → insert → update write pointer → release(mutex) → signal(full).',
    targetEntity: 'P1',
    requiredAction: 'STEP_P1',
  },
  SELECT_C1: {
    id: 'SELECT_C1',
    stepNumber: 3,
    title: 'Select Chef C1',
    instruction: 'The order is placed in the rack! Now select Kitchen Worker C1 at Workstation 1 to claim and dequeue the order.',
    targetEntity: 'C1',
    requiredAction: 'SELECT_C1',
  },
  ADVANCE_C1: {
    id: 'ADVANCE_C1',
    stepNumber: 4,
    title: 'Claim Order (C1)',
    instruction: 'Click "Advance Next Step" to step C1 through consumer synchronization: wait(full) → wait(mutex) → remove → update read pointer → release(mutex) → signal(empty).',
    targetEntity: 'C1',
    requiredAction: 'STEP_C1',
  },
  COOK_O01: {
    id: 'COOK_O01',
    stepNumber: 5,
    title: 'Prepare Food Outside Mutex',
    instruction: 'C1 claimed O01 and released the queue lock! Notice the rack is FREE while cooking occurs. Click "Advance Cooking (Tick)" to cook Masala Dosa.',
    targetEntity: 'C1',
    requiredAction: 'TICK_KITCHEN',
  },
  PICKUP_O01: {
    id: 'PICKUP_O01',
    stepNumber: 6,
    title: 'Deliver to Student',
    instruction: 'Masala Dosa is cooked and sitting on the Pickup Counter! Click "Pick Up O01" to hand the food over to the student.',
    targetEntity: null,
    requiredAction: 'PICKUP_ORDER',
  },
  COORDINATE_REMAINING: {
    id: 'COORDINATE_REMAINING',
    stepNumber: 7,
    title: 'Coordinate Canteen Rush',
    instruction: 'Excellent! Now coordinate P2, P3, and workers C1 and C2 to finish all 3 lunch orders. Notice both chefs can cook at the same time!',
    targetEntity: null,
    requiredAction: 'FREEDOM',
  },
  MISSION_COMPLETE: {
    id: 'MISSION_COMPLETE',
    stepNumber: 8,
    title: 'Shift Complete!',
    instruction: 'All 3 student orders have been produced, synchronized through the bounded rack, cooked outside the lock, and delivered!',
    targetEntity: null,
    requiredAction: 'DEBRIEF',
  },
};

export class CanteenRushMissionAdapter {
  constructor() {
    this.listeners = new Set();
    this.targetOrderIds = ['O01', 'O02', 'O03'];
    this.init();
  }

  init() {
    this.engine = new ProducerConsumerEngine({ persistentConsumers: true });
    // Add 3 deterministic student producers: P1 (O01: Masala Dosa), P2 (O02: Idli & Sambar), P3 (O03: Veg Sandwich)
    this.engine.addProducer(3);
    // Add 2 persistent kitchen workers: C1 (Workstation 1), C2 (Workstation 2)
    this.engine.addConsumer(2);

    this.selectedEntityId = null;
    this.tutorialStage = TUTORIAL_STAGES.SELECT_P1;
    this.lastExplanation = 'Welcome to Canteen Rush 3D! You are the Canteen Shift Coordinator. Select Student P1 to begin.';
    this.lastActionOutcome = null;
    this.stats = {
      ordersSubmitted: 0,
      ordersRemoved: 0,
      ordersReady: 0,
      ordersCompleted: 0,
      mutexAcquisitions: 0,
      blockedEvents: 0,
    };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getMissionSnapshot());
      } catch (err) {
        console.error('Error in mission listener:', err);
      }
    }
  }

  selectEntity(entityId) {
    const isSame = this.selectedEntityId === entityId;
    this.selectedEntityId = entityId;

    if (this.tutorialStage.id === 'SELECT_P1' && entityId === 'P1') {
      this.tutorialStage = TUTORIAL_STAGES.ADVANCE_P1;
      this.lastExplanation = 'Selected Student P1. P1 wants to submit Masala Dosa. Click "Advance Next Step" to begin synchronization.';
    } else if (this.tutorialStage.id === 'SELECT_C1' && entityId === 'C1') {
      this.tutorialStage = TUTORIAL_STAGES.ADVANCE_C1;
      this.lastExplanation = 'Selected Chef C1. C1 is ready to claim the order from the rack. Click "Advance Next Step".';
    } else if (isSame) {
      return;
    } else {
      const snap = this.engine.snapshot();
      const process = snap.processes.find((p) => p.id === entityId);
      const worker = snap.workers?.find((w) => w.id === entityId);

      if (process?.state === 'BLOCKED') {
        this.lastExplanation = `${entityId} is BLOCKED waiting for ${process.waitingFor}. It cannot execute until a matching signal occurs.`;
      } else if (worker?.state === 'PREPARING') {
        this.lastExplanation = `${entityId} is cooking ${worker.assignedOrderId} outside the queue mutex (${worker.preparationProgress}/${worker.preparationDuration} ticks).`;
      } else if (process?.state === 'COMPLETED') {
        this.lastExplanation = `${entityId} has finished its current order lifecycle.`;
      } else if (process?.state === 'READY') {
        const nextOp = PROCESS_INSTRUCTIONS[process.type]?.[process.pc]?.label || 'Next instruction';
        this.lastExplanation = `Selected ${entityId}. Next instruction: ${nextOp}. Click "Advance Next Step" to execute.`;
      }
    }

    this.notify();
  }

  stepSelectedProcess() {
    if (!this.selectedEntityId) return false;
    const snap = this.engine.snapshot();
    const process = snap.processes.find((p) => p.id === this.selectedEntityId);

    if (!process) return false;
    if (process.state === 'BLOCKED') {
      this.lastExplanation = `${process.id} cannot advance: it is BLOCKED on ${process.waitingFor}.`;
      this.notify();
      return false;
    }
    if (process.state === 'COMPLETED') {
      this.lastExplanation = `${process.id} has already completed its submission.`;
      this.notify();
      return false;
    }
    if (process.state === 'PREPARING') {
      this.lastExplanation = `${process.id} is cooking food on the workstation outside the queue mutex. Use "Advance Cooking (Tick)".`;
      this.notify();
      return false;
    }

    const beforeSnap = snap;
    const nextInstruction = PROCESS_INSTRUCTIONS[process.type]?.[process.pc];
    this.engine.stepNextInstruction(this.selectedEntityId);
    const afterSnap = this.engine.snapshot();

    // Check explanation based on instruction
    this.#updateExplanationForStep(process.id, process.type, nextInstruction, beforeSnap, afterSnap);
    this.#checkProgression(afterSnap);
    this.notify();
    return true;
  }

  tickKitchen() {
    const snap = this.engine.snapshot();
    const preparingWorkers = snap.workers?.filter((w) => w.state === 'PREPARING') || [];
    if (!preparingWorkers.length) {
      this.lastExplanation = 'No kitchen worker is currently cooking food. Dequeue an order first!';
      this.notify();
      return false;
    }

    this.engine.tickKitchen();
    const afterSnap = this.engine.snapshot();

    const readyNow = afterSnap.readyOrders.filter((ro) => !snap.readyOrders.some((so) => so.id === ro.id));
    if (readyNow.length > 0) {
      this.lastExplanation = `Cooking complete! ${readyNow.map((o) => `${o.id} (${o.foodName})`).join(', ')} is now READY on the Pickup Counter!`;
    } else {
      const progressText = afterSnap.workers
        .filter((w) => w.state === 'PREPARING')
        .map((w) => `${w.id}: ${w.preparationProgress}/${w.preparationDuration} ticks`)
        .join(', ');
      this.lastExplanation = `Kitchen tick advanced outside the queue mutex. Cooking progress: ${progressText}.`;
    }

    this.#checkProgression(afterSnap);
    this.notify();
    return true;
  }

  pickUpOrder(orderId) {
    const result = this.engine.pickUpOrder(orderId);
    if (result.success) {
      this.lastExplanation = `Student picked up ${orderId}! Order marked COMPLETED.`;
      this.#checkProgression(result.state);
      this.notify();
      return true;
    }
    this.lastExplanation = `Cannot pick up ${orderId}: ${result.reason}`;
    this.notify();
    return false;
  }

  reset() {
    this.init();
  }

  #updateExplanationForStep(id, type, instruction, before, after) {
    const op = instruction?.op;
    let text = `${id} executed ${instruction?.label}.`;

    if (op === 'waitEmpty') {
      text = `${id} decremented empty (${before.empty} → ${after.empty}), reserving a slot permit in the rack.`;
    } else if (op === 'waitMutex') {
      text = `${id} acquired the Queue Mutex! Slot access is now locked and protected from concurrent access.`;
      this.stats.mutexAcquisitions += 1;
    } else if (op === 'insert') {
      const order = after.slots[before.writePosition];
      text = `${id} inserted ${order?.id || 'order'} (${order?.foodName || 'dish'}) into Slot ${before.writePosition}.`;
      this.stats.ordersSubmitted += 1;
    } else if (op === 'advanceWrite') {
      text = `Write pointer advanced modulo 5 (${before.writePosition} → ${after.writePosition}).`;
    } else if (op === 'releaseMutex') {
      text = `${id} released the Queue Mutex. The order rack is now unlocked.`;
    } else if (op === 'signalFull') {
      text = `${id} signaled full (${before.full} → ${after.full}), notifying kitchen workers that an order is ready to claim!`;
    } else if (op === 'waitFull') {
      text = `${id} decremented full (${before.full} → ${after.full}), claiming an available order permit.`;
    } else if (op === 'remove') {
      const worker = after.workers?.find((w) => w.id === id);
      text = `${id} claimed and dequeued ${worker?.assignedOrderId || 'order'} from Slot ${before.readPosition}.`;
      this.stats.ordersRemoved += 1;
    } else if (op === 'advanceRead') {
      text = `Read pointer advanced modulo 5 (${before.readPosition} → ${after.readPosition}).`;
    } else if (op === 'signalEmpty') {
      text = `${id} signaled empty (${before.empty} → ${after.empty}), freeing a slot permit for students! ${id} begins cooking outside the critical section.`;
    }

    const processAfter = after.processes.find((p) => p.id === id);
    if (processAfter?.state === 'BLOCKED') {
      text = `${id} attempted ${instruction?.label} but BLOCKED on ${processAfter.waitingFor}!`;
      this.stats.blockedEvents += 1;
    }

    this.lastExplanation = text;
    this.lastActionOutcome = { id, type, op, text, timestamp: Date.now() };
  }

  #checkProgression(snap) {
    const p1 = snap.processes.find((p) => p.id === 'P1');
    const workerC1 = snap.workers?.find((w) => w.id === 'C1');
    const completedIds = snap.completedOrders?.map((o) => o.id) || [];
    const readyIds = snap.readyOrders?.map((o) => o.id) || [];

    // Stage progression checks
    if (this.tutorialStage.id === 'ADVANCE_P1') {
      if (p1?.state === 'COMPLETED') {
        this.tutorialStage = TUTORIAL_STAGES.SELECT_C1;
        this.selectedEntityId = 'C1';
        this.lastExplanation = 'P1 successfully published Masala Dosa! Now select Chef C1 at Workstation 1 to claim it.';
      }
    } else if (this.tutorialStage.id === 'ADVANCE_C1') {
      if (workerC1?.state === 'PREPARING') {
        this.tutorialStage = TUTORIAL_STAGES.COOK_O01;
        this.lastExplanation = 'C1 claimed O01 and released the queue lock! Workstation 1 is ready. Click "Advance Cooking (Tick)" to cook the dish.';
      }
    } else if (this.tutorialStage.id === 'COOK_O01') {
      if (readyIds.includes('O01')) {
        this.tutorialStage = TUTORIAL_STAGES.PICKUP_O01;
        this.lastExplanation = 'Masala Dosa is cooked and sitting on the Pickup Counter! Click "Pick Up O01" to deliver it.';
      }
    } else if (this.tutorialStage.id === 'PICKUP_O01') {
      if (completedIds.includes('O01')) {
        this.tutorialStage = TUTORIAL_STAGES.COORDINATE_REMAINING;
        this.lastExplanation = 'Awesome job delivering Order 01! Now coordinate P2, P3, and workers C1 and C2 to finish all 3 lunch orders.';
      }
    }

    // Check complete mission
    const allCompleted = this.targetOrderIds.every((id) => completedIds.includes(id));
    if (allCompleted && this.tutorialStage.id !== 'MISSION_COMPLETE') {
      this.tutorialStage = TUTORIAL_STAGES.MISSION_COMPLETE;
      this.lastExplanation = 'Shift Complete! All 3 student orders have been safely synchronized, cooked in parallel, and picked up!';
    }
  }

  getMissionSnapshot() {
    const snap = this.engine.snapshot();
    const completedIds = snap.completedOrders?.map((o) => o.id) || [];
    const isCompleted = this.targetOrderIds.every((id) => completedIds.includes(id));

    return {
      engineSnapshot: snap,
      selectedEntityId: this.selectedEntityId,
      tutorialStage: this.tutorialStage,
      lastExplanation: this.lastExplanation,
      lastActionOutcome: this.lastActionOutcome,
      stats: {
        ...this.stats,
        ordersCompleted: completedIds.length,
        ordersReady: snap.readyOrders?.length || 0,
      },
      isMissionComplete: isCompleted,
      targetOrderIds: this.targetOrderIds,
    };
  }
}
