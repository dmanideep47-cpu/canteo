/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import { useCanteenQueue } from '../logic/useCanteenQueue';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const queueData = useCanteenQueue();
  return <AppContext.Provider value={queueData}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
