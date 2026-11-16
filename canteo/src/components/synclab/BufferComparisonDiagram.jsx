import { Lock, Unlock, AlertTriangle, AlertOctagon, Package } from 'lucide-react';

export default function BufferComparisonDiagram({ state, onInspectSlot = null, onInspectThread = null }) {
  if (!state) return null;

  const capacity = state.capacity || 5;
  const slots = state.slots || Array(capacity).fill(null);
  const displaced = state.displacedItems || [];

  return (
    <div className="space-y-4 font-sans text-left">
      {/* 1. SEMAPHORE & MUTEX DASHBOARD */}
      <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD9CF]/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#647480]">
              Synchronization Primitives
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                !state.withoutMutex
                  ? 'bg-teal-100 text-teal-800 border border-teal-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {!state.withoutMutex ? 'Mutex Enabled' : 'Without Mutex (Race Condition Active)'}
            </span>
          </div>

          <div className="text-xs text-[#647480]">
            Occupancy: <span className="font-bold font-mono text-[#172B3A]">{state.occupancy}/{capacity}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Empty Semaphore */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#172B3A]">sem_t empty</span>
              <span className="text-sm font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {state.empty}
              </span>
            </div>
            <div className="text-[10px] text-[#647480] mt-1">
              Waiters: {state.waitQueues?.empty?.length || 0}
              {state.waitQueues?.empty?.length > 0 && ` (${state.waitQueues.empty.join(', ')})`}
            </div>
          </div>

          {/* Full Semaphore */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#172B3A]">sem_t full</span>
              <span className="text-sm font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {state.full}
              </span>
            </div>
            <div className="text-[10px] text-[#647480] mt-1">
              Waiters: {state.waitQueues?.full?.length || 0}
              {state.waitQueues?.full?.length > 0 && ` (${state.waitQueues.full.join(', ')})`}
            </div>
          </div>

          {/* Binary Mutex */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#172B3A]">pthread_mutex_t</span>
              {!state.withoutMutex ? (
                state.mutex === 1 ? (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> FREE (1)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> {state.mutexOwner}
                  </span>
                )
              ) : (
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> DISABLED
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#647480] mt-1">
              Contenders: {state.waitQueues?.mutex?.length || 0}
              {state.waitQueues?.mutex?.length > 0 && ` (${state.waitQueues.mutex.join(', ')})`}
            </div>
          </div>
        </div>
      </div>

      {/* 2. CIRCULAR BUFFER BAYS (2D ARCHITECTURAL DIAGRAM) */}
      <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A] flex items-center gap-1.5">
            <Package className="w-4 h-4 text-[#087F8C]" />
            <span>Shared Circular Buffer (Order Tray Bays)</span>
          </h4>
          <span className="text-[11px] font-mono text-[#647480]">
            IN: Bay {state.in} | OUT: Bay {state.out}
          </span>
        </div>

        {/* 5 Bays Row */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3 py-2">
          {slots.map((item, idx) => {
            const isIn = state.in === idx;
            const isOut = state.out === idx;
            const isOccupied = item !== null;

            return (
              <div
                key={idx}
                onClick={() => onInspectSlot && onInspectSlot(idx)}
                className={`relative rounded-xl border-2 p-2 sm:p-3 flex flex-col items-center justify-between min-h-[90px] transition-all cursor-pointer ${
                  isOccupied
                    ? 'bg-[#F0F8F8] border-[#087F8C] shadow-xs'
                    : 'bg-[#FAF9F5] border-dashed border-[#DDD9CF]'
                }`}
              >
                {/* Bay Number Header */}
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono font-bold text-[#647480]">
                    Bay {idx}
                  </span>
                  {/* Pointer badges */}
                  <div className="flex items-center gap-0.5">
                    {isIn && (
                      <span className="text-[9px] font-mono font-bold bg-[#087F8C] text-white px-1 py-0.2 rounded">
                        IN
                      </span>
                    )}
                    {isOut && (
                      <span className="text-[9px] font-mono font-bold bg-amber-500 text-white px-1 py-0.2 rounded">
                        OUT
                      </span>
                    )}
                  </div>
                </div>

                {/* Tray Item Content */}
                <div className="my-auto text-center">
                  {isOccupied ? (
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-[#172B3A] font-mono">
                        {item.id}
                      </div>
                      <div className="text-[9px] text-[#647480] truncate max-w-[65px]">
                        {item.name || 'Order Token'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#8C9BA5] italic">empty</span>
                  )}
                </div>

                {/* Bottom Pointer Indicator Arrow */}
                {isIn && (
                  <div className="absolute -bottom-2 text-[#087F8C]">
                    <span className="text-[8px] font-mono font-bold bg-[#087F8C] text-white px-1 rounded-full">
                      Next Write
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DISPLACED / OVERWRITTEN ITEMS EVIDENCE ZONE (DIAGNOSTIC EVIDENCE) */}
      {displaced.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 text-xs text-rose-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="uppercase tracking-wider">
              Diagnostic Evidence: Overwritten / Lost Orders
            </span>
          </div>
          <p className="leading-relaxed">
            Due to the absence of mutex mutual exclusion, concurrent producers calculated identical write pointer
            targets. Earlier orders were clobbered without consumer processing:
          </p>

          <div className="space-y-1.5 pt-1">
            {displaced.map((disp, i) => (
              <div
                key={i}
                className="bg-white border border-rose-200 rounded-xl p-2.5 flex items-center justify-between font-mono text-[11px]"
              >
                <div>
                  <span className="font-bold text-rose-800">
                    Displaced Item: {disp.item?.id || disp.displacedItem?.id || 'Order Token'}
                  </span>
                  <span className="text-[#647480] ml-2">
                    (Bay {disp.slotIndex})
                  </span>
                </div>
                <div className="text-[#647480]">
                  Overwritten by <span className="font-bold text-[#172B3A]">{disp.culpritThreadId || 'Producer'}</span> at Step #{disp.step}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ACTIVE THREADS STATE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.values(state.threads || {}).map((th) => (
          <div
            key={th.id}
            onClick={() => onInspectThread && onInspectThread(th.id)}
            className="bg-white border border-[#DDD9CF] rounded-xl p-3 text-xs space-y-2 cursor-pointer hover:border-[#087F8C] transition-all"
          >
            <div className="flex items-center justify-between border-b border-[#DDD9CF]/60 pb-1.5">
              <span className="font-bold text-[#172B3A] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${th.id === 'P1' ? 'bg-blue-500' : th.id === 'P2' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                <span>{th.name || th.id}</span>
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                th.status === 'BLOCKED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {th.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-[#647480]">
              <div>
                <span>PC:</span> <span className="font-bold text-[#172B3A]">{th.pc}</span>
              </div>
              <div>
                <span>targetSlot:</span>{' '}
                <span className="font-bold text-[#087F8C]">
                  {th.targetSlot !== undefined ? th.targetSlot : '—'}
                </span>
              </div>
            </div>

            {th.localItem && (
              <div className="text-[11px] bg-[#FAF9F5] p-1.5 rounded border border-[#DDD9CF]/80 text-[#172B3A] font-mono">
                Holding: <span className="font-bold">{th.localItem.id}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

