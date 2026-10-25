import { useReducer, useState, useCallback, useMemo } from 'react';
import { canteenReducer, INITIAL_STATE } from './canteenReducer';
import {
  placeOrderAction,
  takeOrderAction,
  markReadyAction,
  markCollectedAction,
  simulateQueueFullAction,
  resetAction,
} from './canteenActions';
import { BUFFER_CAPACITY } from './canteenInvariants';
import { MENU_ITEMS } from '../data/menuItems';

export function useCanteenQueue() {
  const [state, dispatch] = useReducer(canteenReducer, INITIAL_STATE);

  // Cart state: Map of itemId -> quantity
  const [cart, setCart] = useState({});
  // Active navigation tab: 'menu' | 'orders' | 'kitchen' | 'synclab'
  const [activeTab, setActiveTab] = useState('menu');
  // Selected order for live tracking screen
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  // Toast notifications: array of { id, type: 'success' | 'danger' | 'info', message }
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const toastId = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Cart operations
  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const currentQty = prev[item.id] ? prev[item.id].quantity : 0;
      return {
        ...prev,
        [item.id]: {
          item,
          quantity: currentQty + 1,
        },
      };
    });
  }, []);

  const updateCartQuantity = useCallback((itemId, newQty) => {
    setCart((prev) => {
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      if (!prev[itemId]) return prev;
      return {
        ...prev,
        [itemId]: {
          ...prev[itemId],
          quantity: newQty,
        },
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({});
  }, []);

  const cartItemsList = useMemo(() => Object.values(cart), [cart]);

  const cartTotal = useMemo(() => {
    return cartItemsList.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  }, [cartItemsList]);

  const cartCount = useMemo(() => {
    return cartItemsList.reduce((sum, entry) => sum + entry.quantity, 0);
  }, [cartItemsList]);

  // Order submission
  const placeOrder = useCallback(() => {
    if (cartItemsList.length === 0) return null;

    const orderId = `ORD${state.nextOrderNumber}`;
    const itemsSnapshot = cartItemsList.map((entry) => ({
      id: entry.item.id,
      name: entry.item.name,
      price: entry.item.price,
      quantity: entry.quantity,
      subtotal: entry.item.price * entry.quantity,
      icon: entry.item.icon,
    }));

    const total = cartTotal;
    const isFull = state.empty === 0;

    dispatch(
      placeOrderAction({
        id: orderId,
        items: itemsSnapshot,
        total,
        estimatedPrep: '8-10 mins',
      })
    );

    clearCart();
    setSelectedOrderId(orderId);
    setActiveTab('orders');

    if (isFull) {
      addToast(
        `Kitchen queue is full. Your order ${orderId} is waiting for a free slot.`,
        'danger'
      );
    } else {
      addToast(`Order ${orderId} placed successfully! Admitted to queue.`, 'success');
    }

    return orderId;
  }, [cartItemsList, cartTotal, state.empty, state.nextOrderNumber, clearCart, addToast]);

  // Simulated student order from Sync Lab
  const simulateStudentOrder = useCallback(() => {
    const orderId = `ORD${state.nextOrderNumber}`;
    const randomItem = MENU_ITEMS[Math.floor(Math.random() * MENU_ITEMS.length)];
    const itemsSnapshot = [
      {
        id: randomItem.id,
        name: randomItem.name,
        price: randomItem.price,
        quantity: 1,
        subtotal: randomItem.price,
        icon: randomItem.icon,
      },
    ];

    const isFull = state.empty === 0;

    dispatch(
      placeOrderAction({
        id: orderId,
        items: itemsSnapshot,
        total: randomItem.price,
        estimatedPrep: randomItem.prepTime,
      })
    );

    if (isFull) {
      addToast(`Buffer full! Producer blocked: ${orderId} waiting for slot.`, 'danger');
    } else {
      addToast(`Simulated Order ${orderId} admitted to queue slot #${state.queue.length + 1}`, 'success');
    }
  }, [state.nextOrderNumber, state.empty, state.queue.length, addToast]);

  // Kitchen consumer actions
  const takeOrder = useCallback(() => {
    if (state.activeOrder !== null) {
      addToast(`Simulated worker is busy preparing ${state.activeOrder.id}`, 'danger');
      return;
    }
    if (state.full === 0) {
      addToast('No pending orders. Consumer waiting for producer.', 'info');
      dispatch(takeOrderAction());
      return;
    }

    dispatch(takeOrderAction());
    addToast('Kitchen worker took the oldest order from queue.', 'info');
  }, [state.activeOrder, state.full, addToast]);

  const markReady = useCallback(
    (orderId) => {
      dispatch(markReadyAction(orderId));
      addToast(`Order ${orderId} is ready for collection at Counter 2!`, 'success');
    },
    [addToast]
  );

  const markCollected = useCallback(
    (orderId) => {
      dispatch(markCollectedAction(orderId));
      addToast(`Order ${orderId} collected. Lifecycle complete!`, 'info');
    },
    [addToast]
  );

  const simulateQueueFull = useCallback(() => {
    let nextNum = state.nextOrderNumber;
    const slotsNeeded = BUFFER_CAPACITY - state.queue.length;
    const ordersToGenerate = [];

    // Fill remaining slots
    for (let i = 0; i < slotsNeeded; i++) {
      const item = MENU_ITEMS[i % MENU_ITEMS.length];
      ordersToGenerate.push({
        id: `ORD${nextNum++}`,
        items: [{ id: item.id, name: item.name, price: item.price, quantity: 1, subtotal: item.price, icon: item.icon }],
        total: item.price,
        estimatedPrep: item.prepTime,
      });
    }

    // 1 extra order to block
    const overflowItem = MENU_ITEMS[4];
    ordersToGenerate.push({
      id: `ORD${nextNum}`,
      items: [{ id: overflowItem.id, name: overflowItem.name, price: overflowItem.price, quantity: 1, subtotal: overflowItem.price, icon: overflowItem.icon }],
      total: overflowItem.price,
      estimatedPrep: overflowItem.prepTime,
    });

    dispatch(simulateQueueFullAction(ordersToGenerate));
    addToast(`Buffer filled to capacity (5/5). 6th producer blocked!`, 'danger');
  }, [state.nextOrderNumber, state.queue.length, addToast]);

  const resetSimulation = useCallback(() => {
    dispatch(resetAction());
    clearCart();
    setSelectedOrderId(null);
    addToast('Simulation completely reset to initial state (ORD101, empty=5).', 'info');
  }, [clearCart, addToast]);

  // Derived tracking order
  const currentTrackingOrder = useMemo(() => {
    const all = [
      ...state.queue,
      ...state.blockedProducers,
      ...(state.activeOrder ? [state.activeOrder] : []),
      ...state.readyOrders,
      ...state.history,
    ];

    if (selectedOrderId) {
      const match = all.find((o) => o.id === selectedOrderId);
      if (match) return match;
    }

    // Default to most recent order placed or active
    return all[all.length - 1] || null;
  }, [state.queue, state.blockedProducers, state.activeOrder, state.readyOrders, state.history, selectedOrderId]);

  return {
    state,
    cart,
    cartItemsList,
    cartTotal,
    cartCount,
    addToCart,
    updateCartQuantity,
    clearCart,
    placeOrder,
    simulateStudentOrder,
    takeOrder,
    markReady,
    markCollected,
    simulateQueueFull,
    resetSimulation,
    activeTab,
    setActiveTab,
    selectedOrderId,
    setSelectedOrderId,
    currentTrackingOrder,
    toasts,
    removeToast,
    addToast,
  };
}
