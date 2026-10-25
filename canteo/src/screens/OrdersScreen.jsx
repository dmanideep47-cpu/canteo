import { useApp } from '../app/AppContext';
import OrderTimeline from '../components/OrderTimeline';
import { History } from 'lucide-react';

export default function OrdersScreen() {
  const {
    state,
    setSelectedOrderId,
    currentTrackingOrder,
  } = useApp();

  const activeOrders = [
    ...state.blockedProducers,
    ...state.queue,
    ...(state.activeOrder ? [state.activeOrder] : []),
    ...state.readyOrders,
  ];

  const queuePos =
    currentTrackingOrder && currentTrackingOrder.status === 'WAITING'
      ? state.queue.findIndex((o) => o.id === currentTrackingOrder.id) + 1
      : null;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-full text-left">
      {/* Header */}
      <header className="pb-4 border-b border-[#E5E2DD]">
        <h1 className="text-2xl font-semibold font-body text-[#111111] tracking-tight">
          Orders
        </h1>
        <p className="text-xs text-[#5E5E5E] font-normal mt-0.5">
          Real-time lifecycle monitoring and bounded queue progression.
        </p>
      </header>

      {/* Multiple Active Orders Switcher */}
      {activeOrders.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-mono text-[#6B6B6B] uppercase tracking-wider shrink-0">
            Active Orders:
          </span>
          {activeOrders.map((ord) => {
            const isSelected = currentTrackingOrder?.id === ord.id;
            return (
              <button
                key={ord.id}
                onClick={() => setSelectedOrderId(ord.id)}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors border ${
                  isSelected
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-[#6B6B6B] border-[#E5E2DD] hover:text-[#111111]'
                }`}
              >
                {ord.id} ({ord.status})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Tracking Stepper and Schematic Route Map */}
      <div className="max-w-3xl">
        <OrderTimeline
          order={currentTrackingOrder}
          queuePosition={queuePos}
        />
      </div>

      {/* Past Completed Orders Archive */}
      <section className="space-y-4 pt-6 border-t border-[#E5E2DD]" aria-label="Past Orders">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-[#6B6B6B]" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#111111] font-semibold">
              Past Orders Archive
            </h2>
          </div>
          <span className="text-xs font-mono text-[#6B6B6B] tabular-nums">
            {state.history.length} completed
          </span>
        </div>

        {state.history.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-xl border border-[#E5E2DD] text-[#6B6B6B] max-w-3xl">
            <p className="font-mono text-xs text-[#6B6B6B]">— nothing here yet —</p>
            <p className="text-xs text-[#8C8C8C] mt-1">
              Orders marked as collected at Counter 2 will be archived here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {state.history.map((histOrder) => (
              <div
                key={histOrder.id}
                onClick={() => setSelectedOrderId(histOrder.id)}
                className="bg-white border border-[#E5E2DD] rounded-xl p-4 flex items-center justify-between gap-3 hover:border-[#111111] transition-colors cursor-pointer text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#111111]">
                      {histOrder.id}
                    </span>
                    <span className="text-[10px] font-mono text-[#D97706] uppercase">
                      COMPLETED
                    </span>
                  </div>
                  <p className="text-xs text-[#5E5E5E] truncate mt-1">
                    {histOrder.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                  <span className="text-[10px] text-[#8C8C8C] font-mono block mt-0.5">
                    Collected at {histOrder.collectedAt || histOrder.timestamp}
                  </span>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-sm font-medium text-[#111111] tabular-nums">
                    ₹{histOrder.total}
                  </div>
                  <span className="text-[10px] text-[#D97706] block mt-0.5">
                    View &gt;
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
