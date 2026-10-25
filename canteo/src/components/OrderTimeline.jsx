import { Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

const LIFECYCLE_STAGES = [
  { key: 'BLOCKED', label: 'Order Placed (Waiting for Queue Capacity)', desc: 'Buffer full (5/5). Waiting in FIFO line.' },
  { key: 'WAITING', label: 'Received by Kitchen', desc: 'Order is waiting in bounded queue for a worker.' },
  { key: 'PREPARING', label: 'Preparing Food', desc: 'Worker is actively cooking your food.' },
  { key: 'READY', label: 'Ready for Collection', desc: 'Your food is ready — collect at Counter 2.' },
  { key: 'COMPLETED', label: 'Order Collected', desc: 'Picked up by student.' },
];

export default function OrderTimeline({ order, queuePosition = null }) {
  if (!order) {
    return (
      <div className="bg-white border border-[#E5E2DD] rounded-xl p-16 text-center">
        <p className="font-mono text-xs text-[#6B6B6B]">
          — nothing here yet —
        </p>
        <p className="text-xs text-[#8C8C8C] mt-2 max-w-sm mx-auto">
          Submit an order from the menu to observe live queue lifecycle tracking.
        </p>
      </div>
    );
  }

  const isBlocked = order.status === 'BLOCKED';
  const isReady = order.status === 'READY';

  // Determine stage progression
  const getStageState = (stageKey) => {
    const orderIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === order.status);
    const stageIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === stageKey);

    if (stageKey === 'BLOCKED') {
      if (order.status === 'BLOCKED') return 'current';
      return 'hidden';
    }

    if (stageIndex < orderIndex) return 'completed';
    if (stageIndex === orderIndex) return 'current';
    return 'future';
  };

  const visibleStages = LIFECYCLE_STAGES.filter((s) => {
    if (s.key === 'BLOCKED' && !isBlocked) return false;
    return true;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Schematic Route Map (Inline SVG) */}
      <div className="relative w-full h-40 sm:h-48 bg-[#FAF7F2] rounded-xl border border-[#E5E2DD] overflow-hidden p-2">
        <svg
          className="w-full h-full text-[#E5E2DD]"
          viewBox="0 0 500 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Subtle Grid Lines */}
          <line x1="50" y1="0" x2="50" y2="160" stroke="currentColor" strokeDasharray="3 3" />
          <line x1="150" y1="0" x2="150" y2="160" stroke="currentColor" strokeDasharray="3 3" />
          <line x1="250" y1="0" x2="250" y2="160" stroke="currentColor" strokeDasharray="3 3" />
          <line x1="350" y1="0" x2="350" y2="160" stroke="currentColor" strokeDasharray="3 3" />
          <line x1="450" y1="0" x2="450" y2="160" stroke="currentColor" strokeDasharray="3 3" />

          {/* Campus Path Route in Warm Amber */}
          <path
            d="M 60 80 Q 180 30 250 80 T 440 80"
            stroke="#D97706"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Canteen Node */}
          <circle cx="60" cy="80" r="10" fill="#111111" />
          <circle cx="60" cy="80" r="4" fill="white" />
          <text x="60" y="112" textAnchor="middle" className="text-[10px] font-mono fill-[#111111]">
            Canteen
          </text>

          {/* Counter 2 Pickup Node */}
          <circle cx="250" cy="80" r="8" fill={isReady ? '#D97706' : '#6B6B6B'} />
          <circle cx="250" cy="80" r="3" fill="white" />
          <text x="250" y="112" textAnchor="middle" className="text-[10px] font-mono fill-[#6B6B6B]">
            Counter 2
          </text>

          {/* Destination / Student Node */}
          <circle cx="440" cy="80" r="10" fill="#D97706" />
          <circle cx="440" cy="80" r="4" fill="white" />
          <text x="440" y="112" textAnchor="middle" className="text-[10px] font-mono fill-[#D97706]">
            You
          </text>
        </svg>

        <div className="absolute bottom-2 left-3 text-[10px] font-mono text-[#6B6B6B]">
          Schematic Campus Route · Food Pickup at Counter 2
        </div>
      </div>

      {/* Blocked Queue Alert Banner */}
      {isBlocked && (
        <div className="p-4 bg-[#FAF7F2] border border-[#C0392B] rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#C0392B] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-[#C0392B] block">
              Buffer Full (5/5 Orders Queued)
            </span>
            <p className="text-[#5E5E5E] mt-0.5 leading-relaxed">
              Your order is held in the FIFO blocked queue. It will be admitted to the kitchen buffer the instant staff completes a prep slot.
            </p>
          </div>
        </div>
      )}

      {/* Ready Alert Banner */}
      {isReady && (
        <div className="p-4 bg-[#FAF7F2] border border-[#D97706] rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-[#D97706] block">
              Your food is ready — collect at Counter 2.
            </span>
            <p className="text-[#5E5E5E] mt-0.5">
              Please present your order ID ({order.id}) at the counter.
            </p>
          </div>
        </div>
      )}

      {/* Active Order Card */}
      <div className="bg-white border border-[#E5E2DD] rounded-xl p-5 sm:p-6 space-y-6">
        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5E2DD] gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xl font-bold text-[#111111]">
                {order.id}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#E5E2DD] uppercase tracking-wider text-[#111111]">
                {order.status}
              </span>
            </div>
            <p className="text-xs text-[#6B6B6B] mt-1 font-mono tabular-nums">
              Submitted at {order.timestamp} · Total: ₹{order.total}
            </p>
          </div>

          {queuePosition && (
            <div className="text-right bg-[#FAF7F2] px-3 py-1 rounded-md border border-[#E5E2DD] shrink-0 self-start sm:self-auto">
              <span className="text-[10px] text-[#6B6B6B] uppercase block font-mono">Queue Pos</span>
              <span className="text-base font-mono font-bold text-[#111111]">#{queuePosition}</span>
            </div>
          )}
        </div>

        {/* Ordered items list */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#6B6B6B]">
            Ordered Items
          </span>
          <div className="divide-y divide-[#F1EFEA]">
            {order.items?.map((it, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between text-xs sm:text-sm tabular-nums">
                <span className="text-[#111111] font-normal">
                  {it.quantity}x {it.name}
                </span>
                <span className="text-[#6B6B6B] font-mono">₹{it.subtotal || it.price * it.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical Stepper Timeline */}
        <div className="pt-4 border-t border-[#E5E2DD]">
          <h4 className="text-xs font-mono uppercase tracking-wider text-[#6B6B6B] mb-5">
            Order Lifecycle Timeline
          </h4>

          <div className="space-y-5">
            {visibleStages.map((stage, idx) => {
              const state = getStageState(stage.key);
              const isLast = idx === visibleStages.length - 1;

              return (
                <div key={stage.key} className="flex gap-4 relative">
                  {!isLast && (
                    <div
                      className={`absolute left-3 top-6 bottom-0 w-[1px] ${
                        state === 'completed' ? 'bg-[#D97706]' : 'bg-[#E5E2DD]'
                      }`}
                    />
                  )}

                  {/* Indicator Dot */}
                  <div className="shrink-0 relative z-10 pt-0.5">
                    {state === 'completed' ? (
                      <div className="w-6 h-6 rounded-full bg-[#D97706] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : state === 'current' ? (
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-[#D97706] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-white border border-[#E5E2DD] flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E5E2DD]" />
                      </div>
                    )}
                  </div>

                  {/* Stage description */}
                  <div className="pb-3 text-left">
                    <div
                      className={`text-xs font-semibold font-body ${
                        state === 'current'
                          ? 'text-[#111111]'
                          : state === 'completed'
                          ? 'text-[#D97706]'
                          : 'text-[#8C8C8C]'
                      }`}
                    >
                      {stage.label}
                    </div>
                    <p className="text-[12px] text-[#6B6B6B] mt-0.5">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
