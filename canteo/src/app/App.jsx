import { useState, useEffect, useCallback, useRef } from 'react';
import { AppProvider, useApp } from './AppContext';
import LandingPage from '../landing/LandingPage';
import BottomNavigation from '../components/BottomNavigation';
import Toast from '../components/Toast';
import MenuScreen from '../screens/MenuScreen';
import OrdersScreen from '../screens/OrdersScreen';
import KitchenScreen from '../screens/KitchenScreen';
import SyncLabScreen from '../screens/SyncLabScreen';
import {
  Utensils,
  Clock,
  ChefHat,
  Activity,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'menu', label: 'Menu', desc: 'Order Submission', icon: Utensils },
  { id: 'orders', label: 'Orders', desc: 'Live Queue Tracking', icon: Clock },
  { id: 'kitchen', label: 'Kitchen', desc: 'Bounded Workstation', icon: ChefHat },
  { id: 'synclab', label: 'SyncLab', desc: 'Educational Engine', icon: Activity },
];

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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('canteo_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef(null);
  const drawerContentRef = useRef(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('canteo_sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
        drawerTriggerRef.current?.focus();
      }
    }
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen]);

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

  if (currentPath === '/') {
    return (
      <LandingPage
        onNavigateToApp={(tabKey = 'menu') => navigateToApp(tabKey)}
        onEnterApp={() => navigateToApp('menu')}
      />
    );
  }

  const activeOrdersCount =
    state.queue.length + (state.activeOrder ? 1 : 0) + state.blockedProducers.length;
  const kitchenQueueCount = state.full;

  return (
    <div className="w-full h-screen h-[100dvh] overflow-hidden flex bg-[#F5F2EA] font-body text-[#252A27] selection:bg-[#C69A52] selection:text-white">
      {/* Top-Left Corner Navigation Toggle */}
      <button
        ref={drawerTriggerRef}
        onClick={() => {
          if (window.innerWidth >= 1024) {
            toggleSidebar();
          } else {
            setIsMobileDrawerOpen(true);
          }
        }}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg text-[#252A27] bg-white border border-[#E7E3D9] shadow-xs hover:bg-[#FAF8F3] transition-colors cursor-pointer flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#194D40]"
        title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        <span className="lg:hidden text-[#194D40]">
          <Menu className="w-4 h-4" />
        </span>
        <span className="hidden lg:block text-[#194D40]">
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </span>
      </button>

      {/* LEFT COLUMN: DESKTOP SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-[#E7E3D9] transition-[width] duration-200 ease-in-out shrink-0 z-30 ${
          isSidebarCollapsed ? 'w-16' : 'w-60'
        }`}
        aria-label="Application Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center border-b border-[#E7E3D9] overflow-hidden">
          <div className="w-7 shrink-0 flex items-center justify-center">
            {isSidebarCollapsed ? (
              <span className="font-display text-xl text-[#194D40] font-bold">C</span>
            ) : null}
          </div>
          {!isSidebarCollapsed && (
            <div className="pl-3 min-w-0 flex-1">
              <span className="font-display text-2xl text-[#194D40] block leading-none font-semibold">
                Canteo
              </span>
              <p className="text-[10px] text-[#747B75] font-mono tracking-tight mt-1 truncate">
                Canteen Operating System
              </p>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {NAV_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount =
              tab.id === 'orders' ? activeOrdersCount : tab.id === 'kitchen' ? kitchenQueueCount : null;

            if (isSidebarCollapsed) {
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/app?tab=${tab.id}`);
                    }
                  }}
                  className={`relative w-full h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#194D40] text-white shadow-xs'
                      : 'text-[#747B75] hover:bg-[#FAF8F3] hover:text-[#194D40]'
                  }`}
                  title={`${tab.label} — ${tab.desc}`}
                  aria-label={`${tab.label} — ${tab.desc}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {badgeCount > 0 && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#C69A52]" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', `/app?tab=${tab.id}`);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#194D40] text-white shadow-xs'
                    : 'text-[#5A615B] hover:bg-[#FAF8F3] hover:text-[#194D40]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#DCE8DF]' : 'text-[#747B75]'}`} />
                  <div className="text-left truncate">
                    <div className="text-xs font-medium leading-tight">{tab.label}</div>
                    <div className={`text-[10px] truncate ${isActive ? 'text-[#DCE8DF]' : 'text-[#959D96]'}`}>
                      {tab.desc}
                    </div>
                  </div>
                </div>
                {badgeCount > 0 && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums shrink-0 font-medium ${
                      isActive ? 'bg-[#C69A52] text-white' : 'bg-[#FAF8F3] border border-[#E7E3D9] text-[#252A27]'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E7E3D9] text-xs font-mono text-[#747B75] overflow-hidden">
          {!isSidebarCollapsed ? (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px]">Buffer N = 5</span>
              <span className="text-[10px] bg-[#EBF3EF] text-[#194D40] px-2 py-0.5 rounded font-semibold border border-[#DCE8DF]">
                BOUNDED
              </span>
            </div>
          ) : (
            <div className="text-center font-bold text-[#194D40] text-xs">N=5</div>
          )}
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={drawerContentRef}
            className="relative w-68 max-w-[80vw] bg-white h-full shadow-xl flex flex-col p-4 text-left border-r border-[#E7E3D9] z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E3D9] mb-3">
              <div>
                <span className="font-display text-2xl text-[#194D40] font-semibold">Canteo</span>
                <p className="text-[10px] text-[#747B75] font-mono">College Canteen Platform</p>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1 rounded-lg text-[#747B75] hover:text-[#194D40] hover:bg-[#FAF8F3] cursor-pointer"
                aria-label="Close navigation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-1 flex-1">
              {NAV_ITEMS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const badgeCount =
                  tab.id === 'orders' ? activeOrdersCount : tab.id === 'kitchen' ? kitchenQueueCount : null;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (typeof window !== 'undefined') {
                        window.history.pushState({}, '', `/app?tab=${tab.id}`);
                      }
                      setIsMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? (activeTab === 'synclab' ? 'bg-[#18181B] text-white shadow-xs' : 'bg-[#194D40] text-white shadow-xs')
                        : 'text-[#5A615B] hover:bg-[#FAF8F3] hover:text-[#194D40]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="text-left">
                        <div className="text-xs font-medium leading-tight">{tab.label}</div>
                        <div className={`text-[10px] ${isActive ? 'text-[#DCE8DF]' : 'text-[#959D96]'}`}>
                          {tab.desc}
                        </div>
                      </div>
                    </div>
                    {badgeCount > 0 && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full tabular-nums ${
                          isActive ? 'bg-[#C69A52] text-white' : 'bg-[#FAF8F3] border border-[#E7E3D9] text-[#252A27]'
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-[#E7E3D9] text-[11px] font-mono text-[#747B75]">
              <span>Canteo Platform v3.1</span>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT COLUMN: WORKSPACE */}
      <div className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden ${activeTab === 'synclab' ? 'bg-white' : 'bg-[#F5F2EA]'}`}>
        {/* Workspace Header */}
        <header className="w-full h-14 bg-white border-b border-[#E7E3D9] px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5 pl-11 lg:pl-2">
            <button
              onClick={navigateToLanding}
              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors focus:outline-none py-1.5 px-2.5 rounded-md cursor-pointer ${
                activeTab === 'synclab'
                  ? 'text-[#09090B] hover:text-[#52525B] hover:bg-[#F4F4F5]'
                  : 'text-[#194D40] hover:text-[#123A32] hover:bg-[#FAF8F3]'
              }`}
              aria-label="Return to Editorial Landing Page"
            >
              <span>← Editorial</span>
            </button>
            <span className={activeTab === 'synclab' ? 'text-[#E4E4E7]' : 'text-[#E7E3D9]'}>/</span>
            <span className="text-xs font-semibold text-[#252A27] capitalize font-body">
              {activeTab === 'synclab' ? 'Synchronization Lab' : activeTab}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-[#747B75] tabular-nums">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${
                activeTab === 'synclab'
                  ? 'bg-[#F4F4F5] border border-[#E4E4E7]'
                  : 'bg-[#FAF8F3] border border-[#E7E3D9]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'synclab' ? 'bg-[#16A34A]' : 'bg-[#194D40]'}`} />
              <span className="font-semibold text-[#252A27] uppercase">Capacity</span>
              <span className={`font-bold ${activeTab === 'synclab' ? 'text-[#09090B]' : 'text-[#194D40]'}`}>
                {state.empty}/5 free
              </span>
            </div>
          </div>
        </header>

        {/* Workspace Main Content */}
        <main className={`flex-1 w-full min-w-0 overflow-y-auto relative flex flex-col ${activeTab === 'synclab' ? 'bg-white' : 'bg-[#F5F2EA]'}`}>
          <Toast toasts={toasts} onDismiss={removeToast} />

          <div className="flex-1 w-full min-w-0 pb-16 lg:pb-0">
            {activeTab === 'menu' && <MenuScreen />}
            {activeTab === 'orders' && <OrdersScreen />}
            {activeTab === 'kitchen' && <KitchenScreen />}
            {activeTab === 'synclab' && <SyncLabScreen />}
          </div>

          <div className="lg:hidden shrink-0">
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
