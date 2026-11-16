import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the exact production functions directly from SyncLabLayout.jsx
const layoutSource = fs.readFileSync(path.join(__dirname, '../src/synclab/SyncLabLayout.jsx'), 'utf8');

const foodCropMatch = layoutSource.match(/const FOOD_CROPS = [\s\S]*?\];/);
const foodMatch = layoutSource.match(/function foodForOrder\([\s\S]*?\n\}/);
const calcMatch = layoutSource.match(/function calculatePreparationProgress\([\s\S]*?\n\}/);
const fifoMatch = layoutSource.match(/function getFifoQueueHeadInfo\([\s\S]*?\n\}/);

assert.ok(foodCropMatch && foodMatch && calcMatch && fifoMatch, 'Must find production functions in SyncLabLayout.jsx');

const contextModule = new Function(
  `${foodCropMatch[0]};
   ${foodMatch[0]};
   ${calcMatch[0]};
   ${fifoMatch[0]};
   return { calculatePreparationProgress, getFifoQueueHeadInfo, foodForOrder };`
)();

const { calculatePreparationProgress, getFifoQueueHeadInfo } = contextModule;

describe('Kitchen Preparation Progress UI & Queue Display Validation', () => {
  describe('calculatePreparationProgress function', () => {
    it('1. Start (0%), intermediate progress (67%), and completion (100%)', () => {
      const order = { id: 'O01', foodName: 'Masala Dosa' };

      // 0% start
      const start = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O01', preparationProgress: 0, preparationDuration: 3, remainingSteps: 3 },
        order
      );
      assert.equal(start.percent, 0);
      assert.equal(start.label, '0%');
      assert.equal(start.ticksText, '0/3 ticks (3 remaining)');
      assert.equal(start.isCooking, true);
      assert.equal(start.isReady, false);
      assert.equal(start.isValid, true);

      // Intermediate (2 of 3 ticks -> 66.66% -> 67%)
      const intermediate = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O01', preparationProgress: 2, preparationDuration: 3, remainingSteps: 1 },
        order
      );
      assert.equal(intermediate.percent, 67);
      assert.equal(intermediate.label, '67%');
      assert.equal(intermediate.ticksText, '2/3 ticks (1 remaining)');
      assert.equal(intermediate.isCooking, true);
      assert.equal(intermediate.isReady, false);
      assert.equal(intermediate.isValid, true);

      // Completion (3 of 3 ticks -> 100%)
      const completed = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O01', preparationProgress: 3, preparationDuration: 3, remainingSteps: 0 },
        order
      );
      assert.equal(completed.percent, 100);
      assert.equal(completed.label, '100%');
      assert.equal(completed.ticksText, '3/3 ticks (0 remaining)');
      assert.equal(completed.isCooking, true);
      assert.equal(completed.isReady, false);
      assert.equal(completed.isValid, true);
    });

    it('2. Negative progress and over-duration clamping', () => {
      const order = { id: 'O02', foodName: 'Samosa' };

      // Negative progress clamped to 0
      const neg = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O02', preparationProgress: -2, preparationDuration: 4, remainingSteps: 6 },
        order
      );
      assert.equal(neg.percent, 0);
      assert.equal(neg.label, '0%');
      assert.equal(neg.ticksText, '0/4 ticks (6 remaining)');

      // Over-duration clamped to 100
      const over = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O02', preparationProgress: 8, preparationDuration: 4, remainingSteps: 0 },
        order
      );
      assert.equal(over.percent, 100);
      assert.equal(over.label, '100%');
      assert.equal(over.ticksText, '4/4 ticks (0 remaining)');
    });

    it('3. Invalid, missing, or non-finite numbers and zero duration', () => {
      const order = { id: 'O03', foodName: 'Canteen Noodles' };

      // duration = 0
      const zeroDur = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O03', preparationProgress: 0, preparationDuration: 0 },
        order
      );
      assert.equal(zeroDur.percent, null);
      assert.equal(zeroDur.label, 'Progress unavailable');
      assert.equal(zeroDur.isValid, false);

      // negative duration
      const negDur = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O03', preparationProgress: 1, preparationDuration: -5 },
        order
      );
      assert.equal(negDur.percent, null);
      assert.equal(negDur.label, 'Progress unavailable');

      // NaN or null duration / progress
      const nanProg = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O03', preparationProgress: NaN, preparationDuration: 3 },
        order
      );
      assert.equal(nanProg.percent, null);
      assert.equal(nanProg.label, 'Progress unavailable');

      const nullProg = calculatePreparationProgress(
        { state: 'PREPARING', assignedOrderId: 'O03', preparationProgress: null, preparationDuration: 3 },
        order
      );
      assert.equal(nullProg.percent, null);
      assert.equal(nullProg.label, 'Progress unavailable');
    });

    it('4. Waiting and idle consumers must not appear to be cooking', () => {
      const order = { id: 'O04', foodName: 'Rice Bowl' };

      const idle = calculatePreparationProgress(
        { state: 'IDLE', assignedOrderId: null, preparationProgress: 0, preparationDuration: 3 },
        null
      );
      assert.equal(idle.percent, null);
      assert.equal(idle.isCooking, false);
      assert.equal(idle.isReady, false);

      const waitingFull = calculatePreparationProgress(
        { state: 'WAITING_FOR_ORDER', assignedOrderId: null, preparationProgress: 0, preparationDuration: 3 },
        null
      );
      assert.equal(waitingFull.percent, null);
      assert.equal(waitingFull.isCooking, false);

      const waitingMutex = calculatePreparationProgress(
        { state: 'WAITING_FOR_MUTEX', assignedOrderId: 'O04', preparationProgress: 0, preparationDuration: 3 },
        order
      );
      assert.equal(waitingMutex.percent, null);
      assert.equal(waitingMutex.isCooking, false);

      const critical = calculatePreparationProgress(
        { state: 'CRITICAL_SECTION', assignedOrderId: 'O04', preparationProgress: 0, preparationDuration: 3 },
        order
      );
      assert.equal(critical.percent, null);
      assert.equal(critical.isCooking, false);
    });

    it('5. READY state returns 100% completed progress', () => {
      const order = { id: 'O05', foodName: 'Idli & Sambar' };
      const ready = calculatePreparationProgress(
        { state: 'READY', assignedOrderId: 'O05', preparationProgress: 3, preparationDuration: 3, remainingSteps: 0 },
        order
      );
      assert.equal(ready.percent, 100);
      assert.equal(ready.label, '100% · Ready for pickup');
      assert.equal(ready.isCooking, false);
      assert.equal(ready.isReady, true);
      assert.equal(ready.isValid, true);
    });
  });

  describe('Selected slot versus FIFO read position logic', () => {
    it('6. Empty buffer display (occupancy === 0)', () => {
      const emptyState = {
        capacity: 5,
        occupancy: 0,
        full: 0,
        reservedFull: 0,
        readPosition: 0,
        writePosition: 0,
        slots: [null, null, null, null, null],
      };
      const info = getFifoQueueHeadInfo(emptyState);
      assert.equal(info.title, 'Buffer Empty (0 orders)');
      assert.equal(info.detail, 'Queue contains no orders. Consumers block on wait(full).');
    });

    it('7. Normal occupied buffer head display', () => {
      const occupiedState = {
        capacity: 5,
        occupancy: 2,
        full: 2,
        reservedFull: 0,
        readPosition: 1,
        writePosition: 3,
        slots: [
          null,
          { id: 'ORD102', producer: 'P2', label: 'Order ORD102' },
          { id: 'ORD103', producer: 'P3', label: 'Order ORD103' },
          null,
          null,
        ],
      };
      const info = getFifoQueueHeadInfo(occupiedState);
      assert.match(info.title, /Slot 1: ORD102/);
      assert.match(info.detail, /Produced by P2 · Next claiming consumer dequeues this order\./);
    });

    it('8. All queued orders reserved by active consumers (full === 0 && reservedFull > 0)', () => {
      const reservedState = {
        capacity: 5,
        occupancy: 1,
        full: 0,
        reservedFull: 1,
        readPosition: 2,
        writePosition: 3,
        slots: [
          null,
          null,
          { id: 'ORD105', producer: 'P5', label: 'Order ORD105' },
          null,
          null,
        ],
      };
      const info = getFifoQueueHeadInfo(reservedState);
      assert.match(info.title, /Slot 2: ORD105/);
      assert.match(info.detail, /All queued orders are reserved by active consumers\./);
    });

    it('9. Removal-before-pointer-advance intermediate display', () => {
      // In critical section: slot at readPosition has been dequeued (null), but readPosition not yet incremented
      const intermediateState = {
        capacity: 5,
        occupancy: 1,
        full: 0,
        reservedFull: 0,
        readPosition: 0,
        writePosition: 2,
        slots: [
          null, // dequeued
          { id: 'ORD102', producer: 'P2', label: 'Order ORD102' },
          null,
          null,
          null,
        ],
      };
      const info = getFifoQueueHeadInfo(intermediateState);
      assert.equal(info.title, 'Slot 0: Order Dequeued (Pointer advancing)');
      assert.equal(info.detail, 'Order removed by consumer in critical section; pointer will advance mod 5.');
    });
  });

  describe('Multi-consumer lifecycle integration & progress progression', () => {
    it('10. Independent consumers advance preparation ticks and reset upon new assignment', () => {
      const engine = new ProducerConsumerEngine({ persistentConsumers: true });
      // Add 2 producers to create 2 orders
      const { ids } = engine.addProducer(2);
      while (engine.processes.some((p) => ids.includes(p.id) && (p.state === 'READY' || p.state === 'RUNNING'))) {
        const ready = engine.processes.find((p) => ids.includes(p.id) && (p.state === 'READY' || p.state === 'RUNNING'));
        if (!ready) break;
        engine.step(ready.id);
      }

      // Add 2 consumers
      engine.addConsumer(2);

      // Step C1 through claiming order 1
      while (engine.processes.some((p) => p.id === 'C1' && p.pc < 6 && p.state !== 'PREPARING')) {
        engine.step('C1');
      }

      // Step C2 through claiming order 2
      while (engine.processes.some((p) => p.id === 'C2' && p.pc < 6 && p.state !== 'PREPARING')) {
        engine.step('C2');
      }

      let snap = engine.snapshot();
      let w1 = snap.workers.find((w) => w.id === 'C1');
      let w2 = snap.workers.find((w) => w.id === 'C2');

      assert.equal(w1.state, 'PREPARING');
      assert.equal(w2.state, 'PREPARING');
      assert.equal(w1.assignedOrderId, 'O01');
      assert.equal(w2.assignedOrderId, 'O02');

      // Check initial 0%
      let p1 = calculatePreparationProgress(w1, snap.orders.find((o) => o.id === w1.assignedOrderId));
      let p2 = calculatePreparationProgress(w2, snap.orders.find((o) => o.id === w2.assignedOrderId));
      assert.equal(p1.percent, 0);
      assert.equal(p2.percent, 0);

      // Advance 1 kitchen tick
      engine.tickKitchen();
      snap = engine.snapshot();
      w1 = snap.workers.find((w) => w.id === 'C1');
      w2 = snap.workers.find((w) => w.id === 'C2');

      p1 = calculatePreparationProgress(w1, snap.orders.find((o) => o.id === w1.assignedOrderId));
      p2 = calculatePreparationProgress(w2, snap.orders.find((o) => o.id === w2.assignedOrderId));

      // Each consumer calculates progress independently based on its own order duration:
      // C1 duration is 3 -> 1/3 = 33%; C2 duration is 5 -> 1/5 = 20%
      const expectedPercent1 = Math.round((w1.preparationProgress / w1.preparationDuration) * 100);
      const expectedPercent2 = Math.round((w2.preparationProgress / w2.preparationDuration) * 100);
      assert.equal(p1.percent, expectedPercent1);
      assert.equal(p2.percent, expectedPercent2);
      assert.equal(p1.label, `${expectedPercent1}%`);
      assert.equal(p2.label, `${expectedPercent2}%`);

      // Advance 2nd kitchen tick (C1 reaches 67%, C2 reaches 40%)
      engine.tickKitchen();
      snap = engine.snapshot();
      w1 = snap.workers.find((w) => w.id === 'C1');
      w2 = snap.workers.find((w) => w.id === 'C2');
      p1 = calculatePreparationProgress(w1, snap.orders.find((o) => o.id === w1.assignedOrderId));
      p2 = calculatePreparationProgress(w2, snap.orders.find((o) => o.id === w2.assignedOrderId));
      assert.equal(p1.percent, 67);
      assert.equal(p2.percent, 40);

      // Advance 3rd kitchen tick: C1 finishes (duration 3), moves order to readyOrders, C1 becomes IDLE
      engine.tickKitchen();
      snap = engine.snapshot();
      w1 = snap.workers.find((w) => w.id === 'C1');
      w2 = snap.workers.find((w) => w.id === 'C2');
      assert.equal(w1.state, 'IDLE');
      assert.equal(w1.assignedOrderId, null);
      assert.equal(w2.state, 'PREPARING');
      assert.ok(snap.readyOrders.some((o) => o.id === 'O01'));

      // Verification that idle worker returns no cooking progress
      p1 = calculatePreparationProgress(w1, null);
      assert.equal(p1.percent, null);
      assert.equal(p1.isCooking, false);

      // Verification of ready order representation
      const readyOrder = snap.readyOrders.find((o) => o.id === 'O01');
      const readyDisplay = calculatePreparationProgress({ state: 'READY', assignedOrderId: readyOrder.id, preparationDuration: 3 }, readyOrder);
      assert.equal(readyDisplay.percent, 100);
      assert.equal(readyDisplay.label, '100% · Ready for pickup');
      assert.equal(readyDisplay.isReady, true);

      // Advance remaining 2 ticks so C2 completes as well
      engine.tickKitchen();
      engine.tickKitchen();
      snap = engine.snapshot();
      w2 = snap.workers.find((w) => w.id === 'C2');
      assert.equal(w2.state, 'IDLE');
      assert.ok(snap.readyOrders.some((o) => o.id === 'O02'));
    });
  });
});