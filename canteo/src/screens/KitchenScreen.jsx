import { useApp } from '../app/AppContext';
import SemaphoreChip from '../components/SemaphoreChip';
import QueueSlot from '../components/QueueSlot';
import { BUFFER_CAPACITY } from '../logic/canteenInvariants';
import { ChefHat, Check, UserCheck, Play } from 'lucide-react';

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
    <div className="space-y-5 max-w-full text-left">
      {/* Header Band: Compact High-Density Canteo Forest Green */}
      <header className="bg-[#194D40] text-white px-6 py-4 border-b border-[#123A32] shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#123A32] border border-[#2D6057] flex items-center justify-center text-[#C69A52] shrink-0">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold font-body text-white tracking-tight">
                  Kitchen Operations
                </h1>
                <span className="text-[10px] font-mono bg-[#123A32] text-[#DCE8DF] px-2.5 py-0.5 rounded-full border border-[#2D6057] font-semibold">
                  Station 1
                </span>
              </div>
              <p className="text-xs text-[#DCE8DF] mt-0.5">
                Consumer process · Dequeues orders into workstation, freeing slots immediately for producers.
              </p>
            </div>
          </div>

          {/* Semaphore Chips HUD */}
          <div className="shrink-0">
            <SemaphoreChip
              empty={state.empty}
              full={state.full}
              mutex={state.mutex}
            />
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-8 space-y-6">
        {/* Active Preparation Station Card (Single Worker) */}
        <section aria-label="Kitchen Preparation Station">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#252A27] font-semibold">
              Active Preparation Station (Worker 1)
            </h2>
            <span
              className={`text-[10px] font-mono px-3 py-1 rounded-full border font-bold ${
                isWorkerBusy
                  ? 'bg-[#FCF5EC] text-[#B8782E] border-[#F4DCBE]'
                  : 'bg-white text-[#747B75] border-[#E7E3D9]'
              }`}
            >
              {isWorkerBusy ? '● PREPARING DISH' : '○ IDLE / WAITING'}
            </span>
          </div>

          {state.activeOrder ? (
            <div className="canteo-panel border-[#194D40] p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E7E3D9]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xl font-bold text-[#252A27]">
                      {state.activeOrder.id}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#B45309] bg-[#FEF3C7] px-2.5 py-0.5 rounded-full border border-[#FDE68A]">
                      COOKING (PREPARATION OUTSIDE LOCK)
                    </span>
                  </div>
                  <p className="text-xs text-[#6B726C] mt-1">
                    Slot freed immediately upon removal. Cooking proceeds concurrently without holding the mutex.
                  </p>
                </div>
                <div className="text-sm font-semibold font-mono text-[#194D40] tabular-nums">
                  Total: ₹{state.activeOrder.total}
                </div>
              </div>

              {/* Items */}
              <div className="border border-[#E7E3D9] rounded-xl p-4 text-xs space-y-2 bg-[#FAF8F3]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#747B75] block mb-1 font-semibold">
                  Items to Prepare:
                </span>
                {state.activeOrder.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between font-normal text-[#252A27] tabular-nums">
                    <span>{it.quantity}x {it.name}</span>
                    <span className="text-[#747B75] font-mono">₹{it.subtotal || it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Action Button: Mark Ready */}
              <button
                type="button"
                onClick={() => markReady(state.activeOrder.id)}
                className="w-full h-12 rounded-full bg-[#194D40] hover:bg-[#123A32] text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#C69A52] cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4 text-[#C69A52]" />
                <span>Mark Food Ready for Pickup (Counter 2)</span>
              </button>
            </div>
          ) : (
            <div className="canteo-panel p-8 text-center space-y-4">
              <ChefHat className="w-10 h-10 text-[#C69A52] mx-auto opacity-80" />
              <p className="text-xs font-mono text-[#747B75]">
                — Kitchen worker is idle at station —
              </p>
              <button
                type="button"
                onClick={takeOrder}
                disabled={isQueueEmpty}
                className="canteo-btn-primary h-12 px-6 text-xs font-medium cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-[#C69A52]" />
                <span>Take Next Order (wait(full))</span>
              </button>
              {isQueueEmpty && (
                <p className="text-[11px] text-[#747B75] font-mono">
                  No pending orders. Consumer safely blocked on empty buffer (full == 0).
                </p>
              )}
            </div>
          )}
        </section>

        {/* 5 Bounded Buffer Queue Slots */}
        <section aria-label="Bounded Buffer Slots">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#252A27] font-semibold">
                Bounded Buffer ({state.full}/5 Occupied)
              </h2>
              <p className="text-xs text-[#747B75]">
                Shared circular array holding active meal requests in strict FIFO sequence
              </p>
            </div>
            <span className="text-xs font-mono text-[#194D40] bg-[#DCE8DF] px-2.5 py-1 rounded-full font-bold border border-[#C2DCEB]">
              Modulo 5 Arithmetic
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: BUFFER_CAPACITY }).map((_, idx) => (
              <QueueSlot
                key={idx}
                index={idx}
                order={state.queue[idx] || null}
              />
            ))}
          </div>
        </section>

        {/* Ready for Pickup Shelf */}
        <section aria-label="Ready Orders Counter">
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#252A27] font-semibold">
              Ready for Pickup (Counter 2) · {state.readyOrders.length}
            </h2>
            <span className="text-xs font-mono text-[#2E7D5B] bg-[#EDF7F2] px-2.5 py-1 rounded-full font-bold border border-[#BCE4D0]">
              Pickup Shelf
            </span>
          </div>

          {state.readyOrders.length === 0 ? (
            <div className="canteo-panel p-6 text-center text-xs font-mono text-[#747B75]">
              — No plated meals waiting on the pickup shelf —
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.readyOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border border-[#BCE4D0] rounded-xl p-5 flex items-center justify-between gap-4 shadow-2xs hover:border-[#2E7D5B] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-[#252A27]">
                        {ord.id}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#2E7D5B] bg-[#EDF7F2] px-2 py-0.5 rounded-full border border-[#BCE4D0]">
                        READY
                      </span>
                    </div>
                    <p className="text-xs text-[#747B75] mt-1">
                      {ord.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => markCollected(ord.id)}
                    className="h-9 px-4 rounded-full bg-[#2E7D5B] hover:bg-[#246348] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Customer Collect</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
