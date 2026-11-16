import { useApp } from '../app/AppContext';
import OrderTimeline from '../components/OrderTimeline';
import { History, Clock, ArrowRight } from 'lucide-react';

export default function OrdersScreen() {
  const {
    state,
    setSelectedOrderId,
    currentTrackingOrder,
    openSyncLabForOrder,
    setActiveTab,
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E3D9]">
        <div>
          <h1 className="text-2xl font-semibold font-body text-[#181A19] tracking-tight">
            Orders &amp; Queue Tracking
          </h1>
          <p className="text-xs text-[#6B726C] font-normal mt-0.5">
            Track your active orders through the kitchen queue to pickup.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-[#E5E2DA] px-3.5 py-1.5 rounded-full text-xs font-mono shrink-0 self-start sm:self-auto tabular-nums shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-[#194D40]" />
          <span className="font-semibold text-[#181A19]">{activeOrders.length} Active</span>
          <span className="text-[#6B726C]">· {state.history.length} Completed</span>
        </div>
      </header>

      {/* Multiple Active Orders Switcher */}
      {activeOrders.length > 1 && (
        <section aria-label="Active Orders Switcher" className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <span className="text-xs font-mono text-[#747B75] uppercase tracking-wider shrink-0 font-medium">
              Switch Order:
            </span>
            {activeOrders.map((ord) => {
              const isSelected = currentTrackingOrder?.id === ord.id;
              const isPreparing = ord.status === 'PREPARING';
              const isReady = ord.status === 'READY';
              const isBlocked = ord.status === 'BLOCKED';

              return (
                <button
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all border flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#194D40] text-white border-[#194D40] shadow-2xs font-semibold'
                      : 'bg-white text-[#747B75] border-[#E7E3D9] hover:bg-[#FAF8F3] hover:text-[#252A27]'
                  }`}
                >
                  <span>{ord.id}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isSelected
                        ? 'bg-[#C69A52] text-white'
                        : isReady
                          ? 'bg-[#EDF7F2] text-[#2E7D5B]'
                          : isPreparing
                            ? 'bg-[#FCF5EC] text-[#B8782E]'
                            : isBlocked
                              ? 'bg-[#FDF1EF] text-[#BA3C2A]'
                              : 'bg-[#FAF8F3] text-[#747B75]'
                    }`}
                  >
                    {ord.status}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty State when no orders exist */}
      {activeOrders.length === 0 && !currentTrackingOrder && (
        <div className="canteo-panel p-10 text-center max-w-2xl mx-auto space-y-4">
          <Clock className="w-10 h-10 text-[#C69A52] mx-auto opacity-80" />
          <h3 className="text-base font-semibold text-[#252A27] font-body">No Active Orders</h3>
          <p className="text-xs text-[#747B75] max-w-md mx-auto">
            Place an order from the canteen menu to observe the producer-consumer queue progression in real time.
          </p>
          <button
            onClick={() => setActiveTab('menu')}
            className="canteo-btn-primary h-10 px-5 text-xs font-medium cursor-pointer inline-flex items-center gap-2"
          >
            <span>Open Menu</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#C69A52]" />
          </button>
        </div>
      )}

      {/* Main Tracking Stepper and Schematic Route Map */}
      {currentTrackingOrder && (
        <div className="max-w-3xl">
          <OrderTimeline
            order={currentTrackingOrder}
            queuePosition={queuePos}
            onUnderstandInSyncLab={openSyncLabForOrder}
          />
        </div>
      )}

      {/* Past Completed Orders Archive */}
      <section className="space-y-4 pt-6 border-t border-[#E7E3D9]" aria-label="Past Orders">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#194D40]" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#252A27] font-semibold">
              Past Orders Archive
            </h2>
          </div>
          <span className="text-xs font-mono text-[#747B75] tabular-nums">
            {state.history.length} completed
          </span>
        </div>

        {state.history.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-[#E7E3D9] text-[#747B75] max-w-3xl">
            <p className="font-mono text-xs text-[#747B75]">— no past orders in session —</p>
            <p className="text-xs text-[#747B75] mt-1 font-body">
              Orders marked as collected at Counter 2 will be archived here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {state.history.map((histOrder) => (
              <div
                key={histOrder.id}
                onClick={() => setSelectedOrderId(histOrder.id)}
                className="bg-white border border-[#E7E3D9] rounded-xl p-4 flex items-center justify-between gap-3 hover:border-[#194D40] transition-all cursor-pointer text-left shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#252A27]">
                      {histOrder.id}
                    </span>
                    <span className="text-[10px] font-mono text-[#2E7D5B] bg-[#EDF7F2] px-2 py-0.5 rounded-full font-bold uppercase border border-[#BCE4D0]">
                      COLLECTED
                    </span>
                  </div>
                  <p className="text-xs text-[#747B75] truncate mt-1">
                    {histOrder.items?.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </p>
                  <span className="text-[10px] text-[#747B75] font-mono block mt-0.5">
                    Collected at {histOrder.collectedAt || histOrder.timestamp}
                  </span>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-sm font-semibold text-[#194D40] tabular-nums">
                    ₹{histOrder.total}
                  </div>
                  <span className="text-[10px] text-[#C69A52] block mt-0.5 font-sans font-medium">
                    Inspect &gt;
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
