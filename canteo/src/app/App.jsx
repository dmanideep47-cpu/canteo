import { useState, useEffect, useCallback } from 'react';
import { AppProvider, useApp } from './AppContext';
import LandingPage from '../landing/LandingPage';
import BottomNavigation from '../components/BottomNavigation';
import Toast from '../components/Toast';
import MenuScreen from '../screens/MenuScreen';
import OrdersScreen from '../screens/OrdersScreen';
import KitchenScreen from '../screens/KitchenScreen';
import SyncLabScreen from '../screens/SyncLabScreen';
import { Utensils, Clock, ChefHat, Activity } from 'lucide-react';

function MainAppShell() {
  const {
    activeTab,
    setActiveTab,
    state,
    toasts,
    removeToast,
  } = useApp();

  const [currentPath, setCurrentPath] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/app')
      ? '/app'
      : '/';
  });

  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname.startsWith('/app') ? '/app' : '/';
      setCurrentPath(path);

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['menu', 'orders', 'kitchen', 'synclab'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveTab]);

  const navigateToApp = useCallback(
    (targetTab = 'menu') => {
      setActiveTab(targetTab);
      setCurrentPath('/app');
      if (window.location.pathname !== '/app') {
        window.history.pushState({}, '', `/app?tab=${targetTab}`);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setActiveTab]
  );

  const navigateToLanding = useCallback(() => {
    setCurrentPath('/');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeOrdersCount =
    state.queue.length +
    state.blockedProducers.length +
    (state.activeOrder ? 1 : 0) +
    state.readyOrders.length;

  const kitchenQueueCount = state.full + (state.activeOrder ? 1 : 0);

  if (currentPath === '/') {
    return <LandingPage onNavigateToApp={navigateToApp} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center selection:bg-[#D97706] selection:text-white font-body">
      {/* Top Editorial Return Bar: Exactly ONE instance on /app route */}
      <header className="w-full bg-[#FAF7F2] border-b border-[#E5E2DD] py-3 px-6 sm:px-10 sticky top-0 z-50 flex items-center justify-between">
        <button
          onClick={navigateToLanding}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#111111] hover:text-[#D97706] transition-colors focus:outline-none -ml-2 py-1 px-2 rounded"
          aria-label="Return to Editorial Landing Page"
        >
          <span>← Back to Editorial</span>
        </button>

        <div className="flex items-center gap-2.5 font-mono text-xs text-[#6B6B6B] tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          <span className="uppercase tracking-wider font-semibold text-[#111111]">
            Active Prototype
          </span>
          <span className="hidden sm:inline text-[#E5E2DD]">|</span>
          <span className="hidden sm:inline uppercase text-[10px] text-[#6B6B6B]">
            {activeTab}
          </span>
        </div>
      </header>

      {/* Main Container: Centered max-w-[1440px] with responsive 24-32px gaps */}
      <div className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col lg:flex-row justify-center items-start lg:py-8 lg:gap-8 px-0 sm:px-6 lg:px-10 pb-20 lg:pb-12">
        {/* Desktop Sidebar: 240-260px wide on desktop (>=1024px), completely hidden on mobile (<768px) */}
        <aside
          className="hidden lg:flex flex-col w-64 bg-white border border-[#E5E2DD] rounded-xl p-5 shrink-0 sticky top-20 text-left"
          aria-label="Desktop Navigation"
        >
          <div className="pb-4 border-b border-[#E5E2DD] mb-4">
            <span className="font-display text-2xl text-[#111111]">Canteo</span>
            <p className="text-xs text-[#6B6B6B] font-mono mt-0.5">OS Sync Prototype</p>
          </div>

          <nav className="space-y-1.5" aria-label="Prototype Views">
            {[
              { id: 'menu', label: 'Menu', desc: 'Producer Order Entry', icon: Utensils, badge: null },
              { id: 'orders', label: 'Orders', desc: 'Live Queue Tracking', icon: Clock, badge: activeOrdersCount },
              { id: 'kitchen', label: 'Kitchen', desc: 'Consumer Bounded Buffer', icon: ChefHat, badge: kitchenQueueCount },
              { id: 'synclab', label: 'Sync Lab', desc: 'OS Semaphore Simulation', icon: Activity, badge: null },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-[#111111] text-white'
                      : 'text-[#6B6B6B] hover:bg-[#FAF7F2] hover:text-[#111111]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold leading-tight">{tab.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isActive ? 'text-[#A3A3A3]' : 'text-[#6B6B6B]'}`}>
                        {tab.desc}
                      </div>
                    </div>
                  </div>
                  {tab.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums ${
                        isActive ? 'bg-[#D97706] text-white' : 'bg-[#FAF7F2] text-[#111111] border border-[#E5E2DD]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Semaphore HUD mini-widget in sidebar */}
          <div className="mt-6 pt-4 border-t border-[#E5E2DD] space-y-2 text-xs font-mono tabular-nums">
            <span className="text-[10px] text-[#6B6B6B] uppercase tracking-wider block">
              Buffer Semaphores
            </span>
            <div className="flex justify-between text-[#6B6B6B] bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E5E2DD]">
              <span>empty: <strong className="text-[#111111]">{state.empty}</strong></span>
              <span>full: <strong className="text-[#111111]">{state.full}</strong></span>
              <span>mutex: <strong className={state.mutex === 1 ? 'text-[#D97706]' : 'text-[#C0392B]'}>{state.mutex}</strong></span>
            </div>
          </div>
        </aside>

        {/* Fluid Main Content Area */}
        <main className="w-full flex-1 bg-white border-x lg:border border-[#E5E2DD] lg:rounded-xl relative flex flex-col min-h-[calc(100vh-45px)] lg:min-h-[780px] overflow-x-hidden">
          {/* Floating Toasts */}
          <Toast toasts={toasts} onDismiss={removeToast} />

          {/* Active Screen View (Exactly ONE mounted) */}
          <div className="flex-1 w-full">
            {activeTab === 'menu' && <MenuScreen />}
            {activeTab === 'orders' && <OrdersScreen />}
            {activeTab === 'kitchen' && <KitchenScreen />}
            {activeTab === 'synclab' && <SyncLabScreen />}
          </div>

          {/* Persistent Mobile Bottom Navigation (Visible on mobile/tablet < 1024px; hidden on desktop) */}
          <div className="lg:hidden">
            <BottomNavigation
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              orderCount={activeOrdersCount}
              queueCount={kitchenQueueCount}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppShell />
    </AppProvider>
  );
}
