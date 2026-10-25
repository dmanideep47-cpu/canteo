import { ACTION_TYPES } from './canteenActions.js';
import { BUFFER_CAPACITY, validateInvariants } from './canteenInvariants.js';

export const INITIAL_STATE = {
  queue: [], // FIFO array of WAITING orders (max 5)
  blockedProducers: [], // FIFO array of BLOCKED orders
  activeOrder: null, // Order currently being prepared (PREPARING)
  readyOrders: [], // Orders ready for pickup (READY)
  history: [], // Collected orders (COMPLETED)
  empty: BUFFER_CAPACITY,
  full: 0,
  mutex: 1, // 1: unlocked, 0: locked
  events: [
    {
      id: 1,
      sequence: 1,
      timestamp: '00:00:00',
      operation: 'INITIALIZE',
      description: 'Canteen queue initialized with capacity = 5 (empty = 5, full = 0, mutex = 1)',
      semaphores: { empty: 5, full: 0, mutex: 1 },
      result: 'success',
      type: 'system',
    },
  ],
  nextOrderNumber: 101,
  nextEventNumber: 2,
};

function appendEvents(stateEvents, startNumber, newEventsList, currentSemaphores) {
  let seq = startNumber;
  const formatted = newEventsList.map((e) => {
    const item = {
      id: seq,
      sequence: seq,
      timestamp: e.timestamp,
      operation: e.operation,
      description: e.description,
      semaphores: e.semaphores || { ...currentSemaphores },
      result: e.result || 'success',
      type: e.type || 'system',
    };
    seq++;
    return item;
  });

  // Prepend newest events first, capped at 100 entries to prevent memory growth
  const combined = [...formatted.reverse(), ...stateEvents].slice(0, 100);
  return {
    events: combined,
    nextEventNumber: seq,
  };
}

export function canteenReducer(state, action) {
  let newState;

  switch (action.type) {
    case ACTION_TYPES.PLACE_ORDER: {
      const { id, items, total, timestamp, estimatedPrep } = action.payload;

      // Duplicate protection
      const allActiveIds = [
        ...state.queue.map((o) => o.id),
        ...state.blockedProducers.map((o) => o.id),
        ...(state.activeOrder ? [state.activeOrder.id] : []),
        ...state.readyOrders.map((o) => o.id),
        ...state.history.map((o) => o.id),
      ];

      if (allActiveIds.includes(id)) {
        return state;
      }

      if (state.empty > 0) {
        // Queue has capacity
        const newEmpty = state.empty - 1;
        const newFull = state.full + 1;
        const newOrder = {
          id,
          items,
          total,
          status: 'WAITING',
          timestamp,
          estimatedPrep,
          admittedAt: timestamp,
        };

        const eventBatch = [
          {
            timestamp,
            operation: `wait(empty): ${state.empty} → ${newEmpty}`,
            description: `Decremented empty slot counter from ${state.empty} to ${newEmpty}.`,
            semaphores: { empty: newEmpty, full: state.full, mutex: 1 },
            result: 'success',
            type: 'producer',
          },
          {
            timestamp,
            operation: 'wait(mutex): critical section entered',
            description: 'Acquired mutual exclusion lock for queue buffer.',
            semaphores: { empty: newEmpty, full: state.full, mutex: 0 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `${id} added to queue`,
            description: `Order ${id} (${items.length} items, ₹${total}) placed at slot #${state.queue.length + 1}.`,
            semaphores: { empty: newEmpty, full: state.full, mutex: 0 },
            result: 'success',
            type: 'producer',
          },
          {
            timestamp,
            operation: 'signal(mutex): critical section exited',
            description: 'Released mutual exclusion lock for queue buffer.',
            semaphores: { empty: newEmpty, full: state.full, mutex: 1 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `signal(full): ${state.full} → ${newFull}`,
            description: `Incremented full slot counter from ${state.full} to ${newFull}.`,
            semaphores: { empty: newEmpty, full: newFull, mutex: 1 },
            result: 'success',
            type: 'producer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: newEmpty, full: newFull, mutex: 1 }
        );

        newState = {
          ...state,
          queue: [...state.queue, newOrder],
          empty: newEmpty,
          full: newFull,
          mutex: 1,
          events,
          nextEventNumber,
          nextOrderNumber: Math.max(state.nextOrderNumber, parseInt(id.replace(/\D/g, ''), 10) + 1),
        };
      } else {
        // Queue is FULL - producer must block
        const blockedOrder = {
          id,
          items,
          total,
          status: 'BLOCKED',
          timestamp,
          estimatedPrep,
        };

        const newBlockedList = [...state.blockedProducers, blockedOrder];

        const eventBatch = [
          {
            timestamp,
            operation: 'wait(empty) failed: empty = 0',
            description: 'Queue buffer full (5/5). Producer cannot acquire slot.',
            semaphores: { empty: 0, full: 5, mutex: 1 },
            result: 'warning',
            type: 'producer',
          },
          {
            timestamp,
            operation: `Producer blocked: ${id}`,
            description: `Kitchen queue is full. Order ${id} queued in FIFO blocked list (position #${newBlockedList.length}).`,
            semaphores: { empty: 0, full: 5, mutex: 1 },
            result: 'blocked',
            type: 'producer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: 0, full: 5, mutex: 1 }
        );

        newState = {
          ...state,
          blockedProducers: newBlockedList,
          events,
          nextEventNumber,
          nextOrderNumber: Math.max(state.nextOrderNumber, parseInt(id.replace(/\D/g, ''), 10) + 1),
        };
      }
      break;
    }

    case ACTION_TYPES.TAKE_ORDER: {
      const { timestamp } = action.payload;

      // Rule: Simulated single worker can only prepare one order at a time
      if (state.activeOrder !== null) {
        const eventBatch = [
          {
            timestamp,
            operation: 'Consumer rejected: worker busy',
            description: `Worker is currently preparing ${state.activeOrder.id}. Complete or mark ready before taking another order.`,
            semaphores: { empty: state.empty, full: state.full, mutex: 1 },
            result: 'blocked',
            type: 'consumer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: state.empty, full: state.full, mutex: 1 }
        );

        return {
          ...state,
          events,
          nextEventNumber,
        };
      }

      // Rule: Consumer blocks when queue is empty (full === 0)
      if (state.full === 0) {
        const eventBatch = [
          {
            timestamp,
            operation: 'Consumer blocked: full = 0',
            description: 'No pending orders. Consumer waiting for producer.',
            semaphores: { empty: 5, full: 0, mutex: 1 },
            result: 'blocked',
            type: 'consumer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: 5, full: 0, mutex: 1 }
        );

        return {
          ...state,
          events,
          nextEventNumber,
        };
      }

      // Valid consumption
      const [takenOrder, ...remainingQueue] = state.queue;
      const workerOrder = {
        ...takenOrder,
        status: 'PREPARING',
        preparedStartedAt: timestamp,
      };

      // Check for blocked producers to admit in the SAME transition
      if (state.blockedProducers.length > 0) {
        const [admittedOrder, ...remainingBlocked] = state.blockedProducers;
        const admittedWithWaiting = {
          ...admittedOrder,
          status: 'WAITING',
          admittedAt: timestamp,
        };

        const finalQueue = [...remainingQueue, admittedWithWaiting];
        const finalEmpty = BUFFER_CAPACITY - finalQueue.length; // 0
        const finalFull = finalQueue.length; // 5

        const eventBatch = [
          {
            timestamp,
            operation: `wait(full): ${state.full} → ${state.full - 1}`,
            description: 'Kitchen worker decremented full counter.',
            semaphores: { empty: state.empty, full: state.full - 1, mutex: 1 },
            result: 'success',
            type: 'consumer',
          },
          {
            timestamp,
            operation: 'wait(mutex): critical section entered',
            description: 'Worker acquired lock on queue buffer.',
            semaphores: { empty: state.empty, full: state.full - 1, mutex: 0 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `Consumer removed ${takenOrder.id}; slot freed`,
            description: `Order ${takenOrder.id} moved from queue to kitchen preparation station.`,
            semaphores: { empty: state.empty + 1, full: state.full - 1, mutex: 0 },
            result: 'success',
            type: 'consumer',
          },
          {
            timestamp,
            operation: `Released blocked producer: ${admittedOrder.id} admitted (FIFO)`,
            description: `Freed slot immediately allocated to oldest blocked producer ${admittedOrder.id}.`,
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 0 },
            result: 'success',
            type: 'producer',
          },
          {
            timestamp,
            operation: 'signal(mutex): critical section exited',
            description: 'Released queue buffer lock after removal and FIFO admission.',
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 1 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `signal(full): queue remains full (${finalEmpty} empty, ${finalFull} full)`,
            description: 'Counters reflect final state after atomic release and admission.',
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 1 },
            result: 'success',
            type: 'consumer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: finalEmpty, full: finalFull, mutex: 1 }
        );

        newState = {
          ...state,
          queue: finalQueue,
          blockedProducers: remainingBlocked,
          activeOrder: workerOrder,
          empty: finalEmpty,
          full: finalFull,
          mutex: 1,
          events,
          nextEventNumber,
        };
      } else {
        // No blocked producers waiting
        const finalEmpty = state.empty + 1;
        const finalFull = state.full - 1;

        const eventBatch = [
          {
            timestamp,
            operation: `wait(full): ${state.full} → ${finalFull}`,
            description: 'Kitchen worker decremented full counter.',
            semaphores: { empty: state.empty, full: finalFull, mutex: 1 },
            result: 'success',
            type: 'consumer',
          },
          {
            timestamp,
            operation: 'wait(mutex): critical section entered',
            description: 'Worker acquired lock on queue buffer.',
            semaphores: { empty: state.empty, full: finalFull, mutex: 0 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `Consumer removed ${takenOrder.id}; slot freed`,
            description: `Order ${takenOrder.id} moved from queue to kitchen preparation station.`,
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 0 },
            result: 'success',
            type: 'consumer',
          },
          {
            timestamp,
            operation: 'signal(mutex): critical section exited',
            description: 'Released queue buffer lock.',
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 1 },
            result: 'info',
            type: 'mutex',
          },
          {
            timestamp,
            operation: `signal(empty): ${state.empty} → ${finalEmpty}`,
            description: `Free slot counter incremented to ${finalEmpty}.`,
            semaphores: { empty: finalEmpty, full: finalFull, mutex: 1 },
            result: 'success',
            type: 'consumer',
          },
        ];

        const { events, nextEventNumber } = appendEvents(
          state.events,
          state.nextEventNumber,
          eventBatch,
          { empty: finalEmpty, full: finalFull, mutex: 1 }
        );

        newState = {
          ...state,
          queue: remainingQueue,
          activeOrder: workerOrder,
          empty: finalEmpty,
          full: finalFull,
          mutex: 1,
          events,
          nextEventNumber,
        };
      }
      break;
    }

    case ACTION_TYPES.MARK_READY: {
      const { orderId, timestamp } = action.payload;

      if (!state.activeOrder || state.activeOrder.id !== orderId) {
        return state;
      }

      const readyOrder = {
        ...state.activeOrder,
        status: 'READY',
        readyAt: timestamp,
      };

      const eventBatch = [
        {
          timestamp,
          operation: `Order ${orderId} marked READY`,
          description: `Worker finished preparation. ${orderId} is ready for collection at Counter 2. Worker is now free.`,
          semaphores: { empty: state.empty, full: state.full, mutex: 1 },
          result: 'success',
          type: 'lifecycle',
        },
      ];

      const { events, nextEventNumber } = appendEvents(
        state.events,
        state.nextEventNumber,
        eventBatch,
        { empty: state.empty, full: state.full, mutex: 1 }
      );

      newState = {
        ...state,
        activeOrder: null,
        readyOrders: [...state.readyOrders, readyOrder],
        events,
        nextEventNumber,
      };
      break;
    }

    case ACTION_TYPES.MARK_COLLECTED: {
      const { orderId, timestamp } = action.payload;
      const target = state.readyOrders.find((o) => o.id === orderId);

      if (!target) {
        return state;
      }

      const completedOrder = {
        ...target,
        status: 'COMPLETED',
        collectedAt: timestamp,
      };

      const eventBatch = [
        {
          timestamp,
          operation: `Order ${orderId} COLLECTED`,
          description: `Student collected ${orderId} from Counter 2. Order moved to completed history.`,
          semaphores: { empty: state.empty, full: state.full, mutex: 1 },
          result: 'success',
          type: 'lifecycle',
        },
      ];

      const { events, nextEventNumber } = appendEvents(
        state.events,
        state.nextEventNumber,
        eventBatch,
        { empty: state.empty, full: state.full, mutex: 1 }
      );

      newState = {
        ...state,
        readyOrders: state.readyOrders.filter((o) => o.id !== orderId),
        history: [completedOrder, ...state.history],
        events,
        nextEventNumber,
      };
      break;
    }

    case ACTION_TYPES.SIMULATE_QUEUE_FULL: {
      const { orders, timestamp } = action.payload;
      // Expecting array of orders where first N fill remaining slots and remaining 1 is blocked
      let currQueue = [...state.queue];
      let currBlocked = [...state.blockedProducers];
      const eventBatch = [];

      orders.forEach((ord) => {
        if (currQueue.length < BUFFER_CAPACITY) {
          const newOrder = {
            ...ord,
            status: 'WAITING',
            admittedAt: timestamp,
          };
          currQueue.push(newOrder);
          eventBatch.push({
            timestamp,
            operation: `wait(empty) & wait(mutex)`,
            description: `Simulation order ${ord.id} filled buffer slot #${currQueue.length}.`,
            semaphores: { empty: BUFFER_CAPACITY - currQueue.length, full: currQueue.length, mutex: 1 },
            result: 'success',
            type: 'producer',
          });
        } else {
          const blockedOrder = {
            ...ord,
            status: 'BLOCKED',
          };
          currBlocked.push(blockedOrder);
          eventBatch.push({
            timestamp,
            operation: `wait(empty) failed: Buffer Full`,
            description: `Producer attempted insertion of ${ord.id} into full buffer (5/5). Order placed in FIFO blocked list.`,
            semaphores: { empty: 0, full: 5, mutex: 1 },
            result: 'blocked',
            type: 'producer',
          });
        }
      });

      const finalEmpty = BUFFER_CAPACITY - currQueue.length;
      const finalFull = currQueue.length;

      const { events, nextEventNumber } = appendEvents(
        state.events,
        state.nextEventNumber,
        eventBatch,
        { empty: finalEmpty, full: finalFull, mutex: 1 }
      );

      const maxNum = Math.max(
        state.nextOrderNumber,
        ...orders.map((o) => parseInt(o.id.replace(/\D/g, ''), 10) + 1)
      );

      newState = {
        ...state,
        queue: currQueue,
        blockedProducers: currBlocked,
        empty: finalEmpty,
        full: finalFull,
        events,
        nextEventNumber,
        nextOrderNumber: maxNum,
      };
      break;
    }

    case ACTION_TYPES.RESET: {
      const { timestamp } = action.payload;
      return {
        ...INITIAL_STATE,
        events: [
          {
            id: 1,
            sequence: 1,
            timestamp,
            operation: 'RESET',
            description: 'Simulation state completely reset. Queue empty (empty = 5, full = 0, mutex = 1, ORD101).',
            semaphores: { empty: 5, full: 0, mutex: 1 },
            result: 'info',
            type: 'system',
          },
        ],
        nextEventNumber: 2,
        nextOrderNumber: 101,
      };
    }

    default:
      return state;
  }

  // Development check of invariants
  const validation = validateInvariants(newState);
  if (!validation.valid) {
    console.error('Invariants violated:', validation.errors);
  }

  return newState;
}
