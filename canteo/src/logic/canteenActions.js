export const ACTION_TYPES = {
  PLACE_ORDER: 'PLACE_ORDER',
  TAKE_ORDER: 'TAKE_ORDER',
  MARK_READY: 'MARK_READY',
  MARK_COLLECTED: 'MARK_COLLECTED',
  RELEASE_BLOCKED_PRODUCER: 'RELEASE_BLOCKED_PRODUCER',
  SIMULATE_QUEUE_FULL: 'SIMULATE_QUEUE_FULL',
  RESET: 'RESET',
};

export const placeOrderAction = (orderData) => ({
  type: ACTION_TYPES.PLACE_ORDER,
  payload: {
    id: orderData.id,
    items: orderData.items,
    total: orderData.total,
    timestamp: orderData.timestamp || new Date().toLocaleTimeString(),
    estimatedPrep: orderData.estimatedPrep || '8-10 mins',
  },
});

export const takeOrderAction = () => ({
  type: ACTION_TYPES.TAKE_ORDER,
  payload: {
    timestamp: new Date().toLocaleTimeString(),
  },
});

export const markReadyAction = (orderId) => ({
  type: ACTION_TYPES.MARK_READY,
  payload: {
    orderId,
    timestamp: new Date().toLocaleTimeString(),
  },
});

export const markCollectedAction = (orderId) => ({
  type: ACTION_TYPES.MARK_COLLECTED,
  payload: {
    orderId,
    timestamp: new Date().toLocaleTimeString(),
  },
});

export const simulateQueueFullAction = (generatedOrders) => ({
  type: ACTION_TYPES.SIMULATE_QUEUE_FULL,
  payload: {
    orders: generatedOrders,
    timestamp: new Date().toLocaleTimeString(),
  },
});

export const resetAction = () => ({
  type: ACTION_TYPES.RESET,
  payload: {
    timestamp: new Date().toLocaleTimeString(),
  },
});
