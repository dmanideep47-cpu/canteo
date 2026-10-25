import { Utensils, Clock, ChefHat, Activity } from 'lucide-react';

const TABS = [
  { id: 'menu', label: 'Menu', icon: Utensils },
  { id: 'orders', label: 'Orders', icon: Clock },
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'synclab', label: 'Sync Lab', icon: Activity },
];

export default function BottomNavigation({ activeTab, onSelectTab, orderCount, queueCount }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F2] border-t border-[#E5E2DD] pb-safe"
      aria-label="Bottom Navigation"
    >
      <div className="max-w-[480px] mx-auto flex items-center justify-around h-16 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors rounded-lg focus:outline-none ${
                isActive ? 'text-[#111111]' : 'text-[#6B6B6B] hover:text-[#111111]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 transition-transform ${
                    isActive ? 'scale-105 stroke-[2]' : 'stroke-[1.5]'
                  }`}
                />
                {tab.id === 'orders' && orderCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#D97706] text-white text-[9px] font-mono rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {orderCount}
                  </span>
                )}
                {tab.id === 'kitchen' && queueCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#111111] text-white text-[9px] font-mono rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {queueCount}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 font-body ${isActive ? 'font-medium text-[#111111]' : 'font-normal text-[#6B6B6B]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
