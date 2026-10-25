export const RACE_DEMO_ACTIONS = {
  START_WITHOUT_MUTEX: 'START_WITHOUT_MUTEX',
  STEP_WITHOUT_MUTEX: 'STEP_WITHOUT_MUTEX',
  START_WITH_MUTEX: 'START_WITH_MUTEX',
  STEP_WITH_MUTEX: 'STEP_WITH_MUTEX',
  RESET_DEMO: 'RESET_DEMO',
};

export const INITIAL_RACE_STATE = {
  mode: null, // 'WITHOUT_MUTEX' | 'WITH_MUTEX' | null
  stepIndex: 0,
  isRunning: false,
  isFinished: false,
  orderState: 'WAITING',
  staffAView: '—',
  staffBView: '—',
  mutexHolder: 'None (Lock: Unlocked)',
  stepsLog: [],
  outcomeType: null, // 'error' | 'success' | null
  outcomeMessage: '',
};

export const WITHOUT_MUTEX_STEPS = [
  {
    step: 1,
    actor: 'Staff A',
    action: 'Read shared order status',
    readStatus: 'WAITING',
    orderStatus: 'WAITING',
    description: 'Staff A reads ORD101 from memory as "WAITING". Decides to prepare.',
  },
  {
    step: 2,
    actor: 'Staff B',
    action: 'Read shared order status (stale/concurrent)',
    readStatus: 'WAITING',
    orderStatus: 'WAITING',
    description: 'Staff B also reads ORD101 concurrently as "WAITING" before Staff A writes.',
  },
  {
    step: 3,
    actor: 'Staff A',
    action: 'Write "PREPARING" to memory',
    readStatus: 'WAITING',
    orderStatus: 'PREPARING',
    description: 'Staff A updates ORD101 status in memory to "PREPARING".',
  },
  {
    step: 4,
    actor: 'Staff B',
    action: 'Write "READY" based on stale "WAITING" read',
    readStatus: 'WAITING',
    orderStatus: 'READY',
    description: 'Staff B blindly overwrites ORD101 to "READY", clobbering Staff A\'s transition!',
  },
];

export const WITH_MUTEX_STEPS = [
  {
    step: 1,
    actor: 'Staff A',
    action: 'wait(mutex) -> Acquired lock',
    mutex: 'Staff A',
    orderStatus: 'WAITING',
    description: 'Staff A acquires mutual exclusion lock. Staff B is blocked if it tries to access.',
  },
  {
    step: 2,
    actor: 'Staff A',
    action: 'Verify & Transition: WAITING -> PREPARING',
    mutex: 'Staff A',
    orderStatus: 'PREPARING',
    description: 'Staff A safely verifies order is WAITING, updates to PREPARING inside critical section.',
  },
  {
    step: 3,
    actor: 'Staff A',
    action: 'signal(mutex) -> Released lock',
    mutex: 'None',
    orderStatus: 'PREPARING',
    description: 'Staff A releases lock. Queue critical section is now free.',
  },
  {
    step: 4,
    actor: 'Staff B',
    action: 'wait(mutex) -> Acquired lock',
    mutex: 'Staff B',
    orderStatus: 'PREPARING',
    description: 'Staff B acquires lock and inspects order state.',
  },
  {
    step: 5,
    actor: 'Staff B',
    action: 'Verify PREPARING & Transition -> READY',
    mutex: 'Staff B',
    orderStatus: 'READY',
    description: 'Staff B observes valid state PREPARING, safely transitions to READY.',
  },
  {
    step: 6,
    actor: 'Staff B',
    action: 'signal(mutex) -> Released lock',
    mutex: 'None',
    orderStatus: 'READY',
    description: 'Staff B completes and releases lock. All transitions serialized cleanly.',
  },
];

export function raceConditionReducer(state, action) {
  switch (action.type) {
    case RACE_DEMO_ACTIONS.START_WITHOUT_MUTEX:
      return {
        ...INITIAL_RACE_STATE,
        mode: 'WITHOUT_MUTEX',
        isRunning: true,
        stepIndex: 0,
      };

    case RACE_DEMO_ACTIONS.START_WITH_MUTEX:
      return {
        ...INITIAL_RACE_STATE,
        mode: 'WITH_MUTEX',
        isRunning: true,
        stepIndex: 0,
      };

    case RACE_DEMO_ACTIONS.STEP_WITHOUT_MUTEX: {
      const step = WITHOUT_MUTEX_STEPS[action.payload.index];
      if (!step) return state;

      const isLast = action.payload.index === WITHOUT_MUTEX_STEPS.length - 1;
      return {
        ...state,
        stepIndex: action.payload.index + 1,
        orderState: step.orderStatus,
        staffAView: step.actor === 'Staff A' ? (step.readStatus || step.orderStatus) : state.staffAView,
        staffBView: step.actor === 'Staff B' ? (step.readStatus || step.orderStatus) : state.staffBView,
        stepsLog: [...state.stepsLog, step],
        isRunning: !isLast,
        isFinished: isLast,
        outcomeType: isLast ? 'error' : null,
        outcomeMessage: isLast
          ? 'Race condition detected: inconsistent order status. Staff B clobbered Staff A due to unsynchronized stale reads!'
          : '',
      };
    }

    case RACE_DEMO_ACTIONS.STEP_WITH_MUTEX: {
      const step = WITH_MUTEX_STEPS[action.payload.index];
      if (!step) return state;

      const isLast = action.payload.index === WITH_MUTEX_STEPS.length - 1;
      return {
        ...state,
        stepIndex: action.payload.index + 1,
        orderState: step.orderStatus,
        mutexHolder: step.mutex === 'None' ? 'None (Lock: Unlocked)' : `${step.mutex} (Lock: Locked)`,
        stepsLog: [...state.stepsLog, step],
        isRunning: !isLast,
        isFinished: isLast,
        outcomeType: isLast ? 'success' : null,
        outcomeMessage: isLast
          ? 'Mutual exclusion enforced. Valid state transitions preserved. Race condition prevented.'
          : '',
      };
    }

    case RACE_DEMO_ACTIONS.RESET_DEMO:
      return INITIAL_RACE_STATE;

    default:
      return state;
  }
}
