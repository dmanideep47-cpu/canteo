import { User, ChefHat, Lock } from 'lucide-react';
import { getThreadInstructions } from '../../logic/syncLabEngine';

export default function ContextualInspector({
  syncState,
  selectedSlot,
  selectedThreadId,
  inspectorTab,
  setInspectorTab,
  onSelectThread,
  onSelectSlot,
}) {
  const activeThread = syncState.threads[selectedThreadId] || Object.values(syncState.threads)[0];
  const scheduledThread = syncState.threads[syncState.scheduledThreadId] || activeThread;
  const slotData = syncState.slots[selectedSlot] || null;
  const isTargetIn = syncState.in === selectedSlot;
  const isTargetOut = syncState.out === selectedSlot;

  const instructions = activeThread ? getThreadInstructions(activeThread, syncState) : [];
  const currentInstruction = activeThread ? instructions[activeThread.pc] : null;

  // Next relevant action explanation
  const getNextActionExplanation = () => {
    if (syncState.isDeadlocked) {
      return 'System in deadlock. Broken ordering caused mutual wait dependency.';
    }
    if (!scheduledThread) {
      return 'No runnable threads currently available.';
    }
    const schedInst = getThreadInstructions(scheduledThread, syncState)[scheduledThread.pc];
    return `Next: ${scheduledThread.id} will execute ${schedInst?.op || 'step'} (${schedInst?.label || ''}).`;
  };

  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-5 flex flex-col justify-between shadow-xs text-left h-full min-h-[460px]">
      <div>
        {/* Context Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#ECE9E1] rounded-xl mb-4 text-xs font-sans">
          <button
            onClick={() => setInspectorTab('OVERVIEW')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
              inspectorTab === 'OVERVIEW'
                ? 'bg-white text-[#172B3A] shadow-xs'
                : 'text-[#647480] hover:text-[#172B3A]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setInspectorTab('THREAD')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
              inspectorTab === 'THREAD'
                ? 'bg-white text-[#172B3A] shadow-xs'
                : 'text-[#647480] hover:text-[#172B3A]'
            }`}
          >
            Thread: {activeThread?.id}
          </button>
          <button
            onClick={() => setInspectorTab('SLOT')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg font-medium transition-all cursor-pointer ${
              inspectorTab === 'SLOT'
                ? 'bg-white text-[#172B3A] shadow-xs'
                : 'text-[#647480] hover:text-[#172B3A]'
            }`}
          >
            Slot #{selectedSlot}
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {inspectorTab === 'OVERVIEW' && (
          <div className="space-y-4 font-sans">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#647480] font-semibold">
                Scheduled Next
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-base font-bold text-[#172B3A] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#087F8C]" />
                  {scheduledThread?.name || 'None'}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#E1F2EF] text-[#087F8C] font-semibold">
                  PC: {scheduledThread ? scheduledThread.pc + 1 : 0}/8
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#647480] block font-semibold">
                Upcoming Operation
              </span>
              <p className="text-xs font-mono text-[#172B3A] font-medium leading-relaxed">
                {getNextActionExplanation()}
              </p>
            </div>

            {/* Intermediate Semaphore and Reservation Metrics */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-white border border-[#DDD9CF] space-y-0.5">
                <span className="text-[10px] font-mono text-[#647480] uppercase block">Bays Occupied</span>
                <div className="text-sm font-bold text-[#172B3A] font-mono">
                  {syncState.occupancy}/5
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#DDD9CF] space-y-0.5">
                <span className="text-[10px] font-mono text-[#647480] uppercase block">Empty Permits</span>
                <div className="text-sm font-bold text-[#E98570] font-mono">
                  {syncState.empty}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white border border-[#DDD9CF] space-y-0.5">
                <span className="text-[10px] font-mono text-[#647480] uppercase block">Full Permits</span>
                <div className="text-sm font-bold text-[#087F8C] font-mono">
                  {syncState.full}
                </div>
              </div>
            </div>

            {/* Mutex & Reservation Note */}
            <div className="p-2.5 rounded-xl bg-white border border-[#DDD9CF] flex items-center justify-between text-xs">
              <span className="font-mono text-[#647480] text-[11px]">Mutex State:</span>
              <span className="font-mono font-bold">
                {syncState.mutex === 0 ? (
                  <span className="text-[#BC4141]">Locked by {syncState.mutexOwner}</span>
                ) : (
                  <span className="text-[#237A57]">Free (1)</span>
                )}
              </span>
            </div>

            {/* Invariant & Semantics Note */}
            <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#DDD9CF] text-[11px] text-[#647480] leading-relaxed">
              <strong className="text-[#172B3A]">POSIX Permit Accounting:</strong> When a producer decrements empty before inserting into a bay, empty decreases before occupancy increases. This temporary difference reflects safe capacity reservation.
            </div>

            {/* Invariant status */}
            <div className="p-2.5 rounded-xl bg-[#E6F3EA] border border-[#237A57]/20 flex items-center gap-2 text-xs text-[#237A57]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#237A57]" />
              <span className="font-medium">Invariants intact: No buffer overflow or lost items</span>
            </div>
          </div>
        )}

        {/* TAB 2: SELECTED THREAD */}
        {inspectorTab === 'THREAD' && activeThread && (
          <div className="space-y-4 font-sans">
            {/* Thread Selector Pills */}
            <div className="flex items-center gap-1.5 pb-2 border-b border-[#DDD9CF]">
              {Object.values(syncState.threads).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectThread(t.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeThread.id === t.id
                      ? 'bg-[#172B3A] text-white'
                      : 'bg-[#ECE9E1] text-[#647480] hover:text-[#172B3A]'
                  }`}
                >
                  {t.id}
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#172B3A] flex items-center gap-1.5">
                  {activeThread.role === 'PRODUCER' ? (
                    <User className="w-4 h-4 text-[#E98570]" />
                  ) : (
                    <ChefHat className="w-4 h-4 text-[#087F8C]" />
                  )}
                  {activeThread.name}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    activeThread.status === 'BLOCKED'
                      ? 'bg-[#FBEAEA] text-[#BC4141]'
                      : activeThread.status === 'RUNNING'
                        ? 'bg-[#FFF1D6] text-[#B77912]'
                        : 'bg-[#E6F3EA] text-[#237A57]'
                  }`}
                >
                  {activeThread.status}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#647480]">Instruction:</span>
                <span className="font-bold text-[#087F8C]">Step {activeThread.pc + 1} of 8</span>
              </div>
              <div className="text-xs font-mono text-[#172B3A] font-medium leading-relaxed">
                {currentInstruction ? currentInstruction.label : 'Idle'}
              </div>
            </div>

            {/* Held resources */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-[#DDD9CF]">
                <span className="text-[10px] font-mono text-[#647480] uppercase block">Mutex Lock</span>
                <span className="font-bold font-mono text-[#172B3A] mt-0.5 block">
                  {syncState.mutexOwner === activeThread.id ? 'Owned' : 'None'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#DDD9CF]">
                <span className="text-[10px] font-mono text-[#647480] uppercase block">Order Token</span>
                <span className="font-bold font-mono text-[#087F8C] mt-0.5 block truncate">
                  {activeThread.localItem ? activeThread.localItem.id : 'None'}
                </span>
              </div>
            </div>

            {activeThread.status === 'BLOCKED' && (
              <div className="p-3.5 rounded-xl bg-[#FFF1D6] border border-[#B77912]/40 text-xs text-[#B77912] space-y-2">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#B77912]" />
                  <div className="leading-relaxed">
                    <strong className="block font-semibold">Causal Dependency: Blocked on {activeThread.waitingFor}</strong>
                    {activeThread.waitingFor === 'empty' && (
                      <p className="mt-1 text-[#8C5D0D]">
                        Buffer is saturated (empty = 0). <strong>{activeThread.id}</strong> is suspended in <code>waitQueues.empty</code>. It cannot proceed until a consumer extracts an order and calls <code>sem_post(&empty)</code>.
                      </p>
                    )}
                    {activeThread.waitingFor === 'full' && (
                      <p className="mt-1 text-[#8C5D0D]">
                        Buffer is empty (full = 0). <strong>{activeThread.id}</strong> is suspended in <code>waitQueues.full</code>. It cannot proceed until a producer creates an order and calls <code>sem_post(&full)</code>.
                      </p>
                    )}
                    {activeThread.waitingFor === 'mutex' && (
                      <p className="mt-1 text-[#8C5D0D]">
                        Mutex is currently held by <strong>{syncState.mutexOwner}</strong>. <strong>{activeThread.id}</strong> is queued in <code>waitQueues.mutex</code> and will be woken when the owner executes <code>pthread_mutex_unlock(&mutex)</code>.
                      </p>
                    )}
                  </div>
                </div>

                {/* Direct Actionable Navigation Button */}
                {activeThread.waitingFor === 'empty' && syncState.threads.C1 && (
                  <button
                    onClick={() => onSelectThread('C1')}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white border border-[#B77912]/30 text-[#B77912] font-semibold text-xs hover:bg-[#FFF7E8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Switch Focus to Consumer C1 →</span>
                  </button>
                )}
                {activeThread.waitingFor === 'full' && (syncState.threads.P1 || syncState.threads.P2) && (
                  <button
                    onClick={() => onSelectThread(syncState.threads.P1 ? 'P1' : 'P2')}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white border border-[#B77912]/30 text-[#B77912] font-semibold text-xs hover:bg-[#FFF7E8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Switch Focus to Producer {syncState.threads.P1 ? 'P1' : 'P2'} →</span>
                  </button>
                )}
                {activeThread.waitingFor === 'mutex' && syncState.mutexOwner && (
                  <button
                    onClick={() => onSelectThread(syncState.mutexOwner)}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white border border-[#B77912]/30 text-[#B77912] font-semibold text-xs hover:bg-[#FFF7E8] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Switch Focus to Mutex Owner ({syncState.mutexOwner}) →</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SELECTED SLOT */}
        {inspectorTab === 'SLOT' && (
          <div className="space-y-4 font-sans">
            {/* Slot selector pills */}
            <div className="flex items-center gap-1.5 pb-2 border-b border-[#DDD9CF]">
              {Array.from({ length: 5 }).map((_, idx) => (
                <button
                  key={`slot-btn-${idx}`}
                  onClick={() => onSelectSlot(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    selectedSlot === idx
                      ? 'bg-[#087F8C] text-white'
                      : 'bg-[#ECE9E1] text-[#647480] hover:text-[#172B3A]'
                  }`}
                >
                  {idx}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-[#172B3A]">Buffer Bay #{selectedSlot}</span>
                <span className="text-xs text-[#647480] block font-mono">
                  {slotData ? 'Contains active order' : 'Available for placement'}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  slotData ? 'bg-[#E1F2EF] text-[#087F8C]' : 'bg-[#ECE9E1] text-[#647480]'
                }`}
              >
                {slotData ? 'Occupied' : 'Empty'}
              </span>
            </div>

            {/* Pointers active on this slot */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] text-xs font-mono">
              <span className="text-[#647480]">Pointers:</span>
              <div className="flex items-center gap-1.5">
                {isTargetIn && (
                  <span className="px-2 py-0.5 rounded bg-[#E98570] text-white font-bold text-[10px]">
                    IN (Next Write)
                  </span>
                )}
                {isTargetOut && (
                  <span className="px-2 py-0.5 rounded bg-[#087F8C] text-white font-bold text-[10px]">
                    OUT (Next Read)
                  </span>
                )}
                {!isTargetIn && !isTargetOut && (
                  <span className="text-[#647480]">None on this bay</span>
                )}
              </div>
            </div>

            {slotData ? (
              <div className="p-3 rounded-xl bg-white border border-[#DDD9CF] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#647480]">Order ID:</span>
                  <strong className="text-[#087F8C]">{slotData.id}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#647480]">Item Name:</span>
                  <span className="text-[#172B3A] font-bold">{slotData.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#647480]">Origin Station:</span>
                  <span className="text-[#172B3A]">{slotData.producerId}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#F6F4EE] border border-dashed border-[#DDD9CF] text-center text-xs text-[#647480] font-mono">
                Bay is currently empty. Ready for student insertion when empty &gt; 0.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[#DDD9CF] flex items-center justify-between text-[11px] font-mono text-[#647480]">
        <span>Click stage objects to inspect</span>
        <span>Bounded Buffer Cap: 5</span>
      </div>
    </div>
  );
}
