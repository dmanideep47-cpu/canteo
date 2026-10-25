import { useApp } from '../app/AppContext';
import SemaphoreChip from '../components/SemaphoreChip';
import QueueSlot from '../components/QueueSlot';
import { BUFFER_CAPACITY } from '../logic/canteenInvariants';
import { ChefHat, Check, UserCheck, Play, AlertCircle } from 'lucide-react';

export default function KitchenScreen() {
  const {
    state,
    takeOrder,
    markReady,
    markCollected,
  } = useApp();

  const isWorkerBusy = state.activeOrder !== null;
  const isQueueEmpty = state.full === 0;

  return (
    <div className="space-y-6 max-w-full text-left">
      {/* Header Band: Near-black #0C0C0C, quiet and restrained */}
      <header className="bg-[#0C0C0C] text-white p-6 sm:p-8 border-b border-[#222222]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#161616] border border-[#262626] flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold font-body text-white tracking-tight">
                Kitchen
              </h1>
              <p className="text-xs text-[#8C8C8C] mt-0.5">
                Consumer process: retrieves queued orders, prepares meals, and manages FIFO buffer capacity.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-[#161616] text-[#8C8C8C] px-3 py-1 rounded-full border border-[#262626] shrink-0 self-start sm:self-auto uppercase tracking-[0.15em]">
            Worker Station 1
          </span>
        </div>

        {/* Semaphore Chips HUD */}
        <div className="pt-4">
          <SemaphoreChip
            empty={state.empty}
            full={state.full}
            mutex={state.mutex}
          />
        </div>
      </header>

      <div className="p-6 lg:p-8 space-y-8">
        {/* Active Preparation Station Card (Single Worker) */}
        <section aria-label="Kitchen Preparation Station">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#111111] font-semibold">
              Active Preparation Station (Worker 1)
            </h2>
            <span
              className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                isWorkerBusy
                  ? 'bg-white text-[#D97706] border-[#E5E2DD]'
                  : 'bg-white text-[#6B6B6B] border-[#E5E2DD]'
              }`}
            >
              {isWorkerBusy ? 'STATUS: COOKING' : 'STATUS: IDLE / WAITING'}
            </span>
          </div>

          {state.activeOrder ? (
            <div className="bg-white border border-[#111111] rounded-xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xl font-bold text-[#111111]">
                      {state.activeOrder.id}
                    </span>
                    <span className="text-[10px] font-mono text-[#D97706] bg-[#FAF7F2] px-2 py-0.5 rounded-md border border-[#E5E2DD]">
                      PREPARING
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6B6B] font-mono mt-1">
                    Cooking started at {state.activeOrder.preparedStartedAt || state.activeOrder.timestamp}
                  </p>
                </div>
                <div className="text-sm font-medium font-mono text-[#111111] tabular-nums">
                  Total: ₹{state.activeOrder.total}
                </div>
              </div>

              {/* Items */}
              <div className="border border-[#E5E2DD] rounded-lg p-3.5 text-xs space-y-2 bg-[#FAF7F2]">
                {state.activeOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between font-normal text-[#111111] tabular-nums">
                    <span>{it.quantity}x {it.name}</span>
                    <span className="text-[#6B6B6B] font-mono">₹{it.subtotal || it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Action Button: Mark Ready (48px pill) */}
              <button
                onClick={() => markReady(state.activeOrder.id)}
                className="w-full h-12 rounded-full bg-[#111111] hover:bg-[#1A1A1A] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors focus:outline-none"
              >
                <Check className="w-4 h-4 text-[#D97706]" />
                <span>Mark Food Ready for Pickup (Counter 2)</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E2DD] rounded-xl p-8 text-center space-y-4">
              <p className="text-xs font-mono text-[#6B6B6B]">
                — simulated kitchen worker is idle —
              </p>
              <button
                onClick={takeOrder}
                disabled={isQueueEmpty}
                className="h-12 px-6 rounded-full bg-[#111111] hover:bg-[#1A1A1A] disabled:bg-[#E5E2DD] disabled:text-[#A3A3A3] text-white text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors focus:outline-none"
              >
                <Play className="w-3.5 h-3.5 fill-current text-[#D97706]" />
                <span>Take Next Order (wait(full))</span>
              </button>
              {isQueueEmpty && (
                <p className="text-[11px] text-[#8C8C8C] font-mono">
                  No pending orders. Consumer blocked on empty buffer.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 5 Bounded Buffer Queue Slots: Unified Horizontal Strip with Hairline Separators */}
        <section aria-label="Bounded Buffer Slots">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#111111] font-semibold">
                Bounded Buffer ({state.full}/5 Occupied)
              </h2>
              <p className="text-xs text-[#6B6B6B]">
                Shared memory buffer holding orders in strict FIFO sequence
              </p>
            </div>
            <span className="text-xs font-mono text-[#6B6B6B] tabular-nums">
              Capacity: {BUFFER_CAPACITY}
            </span>
          </div>

          {/* Horizontal Strip of 5 Numbered Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E2DD] border border-[#E5E2DD] rounded-xl bg-white overflow-hidden">
            {Array.from({ length: BUFFER_CAPACITY }).map((_, idx) => {
              const order = state.queue[idx] || null;
              return <QueueSlot key={idx} index={idx} order={order} />;
            })}
          </div>
        </section>

        {/* Blocked Producers Section: Clean hairline rows */}
        {state.blockedProducers.length > 0 && (
          <section
            className="border border-[#E5E2DD] rounded-xl p-5 sm:p-6 space-y-3 bg-white"
            aria-label="Blocked Producers FIFO Queue"
          >
            <div className="flex items-center gap-2 text-[#C0392B]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider">
                Blocked Producers ({state.blockedProducers.length} Waiting in FIFO)
              </h3>
            </div>
            <p className="text-xs text-[#5E5E5E] leading-relaxed">
              Buffer capacity reached (5/5). The following student orders are blocked from entering memory and will be automatically admitted the instant a slot is freed.
            </p>

            <div className="divide-y divide-[#E5E2DD] border border-[#E5E2DD] rounded-lg overflow-hidden pt-1">
              {state.blockedProducers.map((bOrder, bIdx) => (
                <div
                  key={bOrder.id}
                  className="p-3.5 flex items-center justify-between text-xs bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-[#C0392B]">
                      #{String(bIdx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-mono font-semibold text-[#111111]">
                      {bOrder.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-[#6B6B6B] tabular-nums">
                    <span>₹{bOrder.total}</span>
                    <span className="text-[10px] uppercase text-[#C0392B]">BLOCKED</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ready Orders (Counter 2 Pickup): Clean styling */}
        {state.readyOrders.length > 0 && (
          <section aria-label="Ready for Student Pickup">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#111111] font-semibold pb-3">
              Ready for Student Pickup at Counter 2 ({state.readyOrders.length})
            </h2>
            <div className="divide-y divide-[#E5E2DD] border border-[#E5E2DD] rounded-xl bg-white overflow-hidden">
              {state.readyOrders.map((rOrder) => (
                <div
                  key={rOrder.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-[#111111]">{rOrder.id}</span>
                      <span className="text-[10px] text-[#D97706] uppercase">READY</span>
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] mt-0.5 font-mono tabular-nums">
                      Ready at {rOrder.readyAt || rOrder.timestamp} · Total: ₹{rOrder.total}
                    </p>
                  </div>

                  <button
                    onClick={() => markCollected(rOrder.id)}
                    className="h-12 px-5 rounded-full bg-[#111111] hover:bg-[#1A1A1A] active:scale-[0.98] text-white text-xs font-medium inline-flex items-center gap-2 transition-all focus:outline-none"
                  >
                    <UserCheck className="w-4 h-4 text-[#D97706]" />
                    <span>Confirm Student Pickup</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
