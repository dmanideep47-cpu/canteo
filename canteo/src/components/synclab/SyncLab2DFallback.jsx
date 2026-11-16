import { Lock, User, ChefHat, KeyRound, Layers } from 'lucide-react';

export default function SyncLab2DFallback({
  syncState,
  selectedSlot,
  selectedThreadId,
  selectedComponent,
  onSelectSlot,
  onSelectThread,
  onSelectComponent,
  showOsMapping = false,
}) {
  return (
    <div className="w-full bg-white border border-[#DEE6E8] rounded-xl p-5 space-y-5 text-left shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DEE6E8]">
        <div>
          <span className="font-sans font-bold text-sm text-[#263843]">
            {showOsMapping ? '2D Bounded Buffer Architectural Map' : '2D Miniature Canteen Map (Accessible View)'}
          </span>
          <p className="text-xs text-[#62747C] mt-0.5">
            Deterministic circular buffer bays with live pointer and thread tracking
          </p>
        </div>
        <div className="font-mono text-xs text-[#62747C] flex items-center gap-3">
          <span>{showOsMapping ? 'IN Pointer' : 'IN'}: <strong className="text-[#A94D36]">{syncState.in}</strong></span>
          <span>{showOsMapping ? 'OUT Pointer' : 'OUT'}: <strong className="text-[#3268A8]">{syncState.out}</strong></span>
          <span>{showOsMapping ? 'Occupancy' : 'Bays'}: <strong className="text-[#263843]">{syncState.occupancy}/5</strong></span>
        </div>
      </div>

      {/* 5 Bays in Shallow Arc representation */}
      <div className="grid grid-cols-5 gap-3">
        {syncState.slots.map((slot, idx) => {
          const isOccupied = slot !== null;
          const isTargetIn = syncState.in === idx;
          const isTargetOut = syncState.out === idx;
          const isSelected = selectedSlot === idx;

          return (
            <div
              key={`slot-2d-${idx}`}
              onClick={() => onSelectSlot(idx)}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer relative ${
                isSelected
                  ? 'border-[#167D8D] bg-[#E4F3F3] shadow-xs'
                  : isOccupied
                    ? 'border-[#167D8D]/40 bg-[#F0F4F5]'
                    : 'border-[#DEE6E8] bg-white hover:bg-[#F0F4F5]'
              }`}
            >
              {/* Pointer Badges */}
              <div className="flex justify-center gap-1 mb-2 min-h-[18px]">
                {isTargetIn && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#FBECE5] text-[#A94D36] border border-[#A94D36]/40 font-bold">
                    IN
                  </span>
                )}
                {isTargetOut && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EAF1FB] text-[#3268A8] border border-[#3268A8]/40 font-bold">
                    OUT
                  </span>
                )}
              </div>

              <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center font-mono text-xs font-bold border border-[#DEE6E8] bg-white mb-2 shadow-xs">
                {isOccupied ? (
                  <span className="text-[#167D8D]">✓</span>
                ) : (
                  <span className="text-[#62747C]">{idx}</span>
                )}
              </div>

              <div className="font-mono text-xs font-bold text-[#263843] truncate">
                {isOccupied ? slot.id : 'EMPTY'}
              </div>

              <div className="text-[10px] text-[#62747C] mt-0.5 truncate">
                {showOsMapping
                  ? isOccupied ? `Slot ${idx} (Occupied)` : `Slot ${idx} (Free)`
                  : isOccupied ? (slot.name || slot.label) : 'Ready'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Workstations Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
        {Object.values(syncState.threads).map((thread) => {
          const isBlocked = thread.status === 'BLOCKED';
          const isSelected = selectedThreadId === thread.id;
          const isProducer = thread.role === 'PRODUCER';

          return (
            <div
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? isProducer ? 'border-[#A94D36] bg-[#FBECE5]' : 'border-[#3268A8] bg-[#EAF1FB]'
                  : 'border-[#DEE6E8] bg-white hover:bg-[#F0F4F5]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#263843] flex items-center gap-1.5 font-sans">
                  {isProducer ? (
                    <User className="w-3.5 h-3.5 text-[#A94D36]" />
                  ) : (
                    <ChefHat className="w-3.5 h-3.5 text-[#3268A8]" />
                  )}
                  {thread.id} — {isProducer ? 'Student' : 'Kitchen'}
                </span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isBlocked
                      ? 'bg-[#FFF3D6] text-[#8B6508] border border-[#8B6508]/30'
                      : 'bg-[#E8F4EC] text-[#23704B] border border-[#23704B]/30'
                  }`}
                >
                  {thread.status}
                </span>
              </div>
              <div className="mt-2 text-xs font-mono text-[#62747C] truncate">
                {isBlocked ? (
                  <span className="text-[#8B6508] flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Waiting on {thread.waitingFor}
                  </span>
                ) : (
                  <span>Instruction PC: {thread.pc}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Semaphores & Mutex Inspection Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#DEE6E8]">
        {/* Mutex card */}
        <div
          onClick={() => onSelectComponent?.('MUTEX')}
          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
            selectedComponent === 'MUTEX'
              ? 'border-[#167D8D] bg-[#E4F3F3]'
              : 'border-[#DEE6E8] bg-[#F0F4F5] hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#167D8D]" />
            <div>
              <div className="text-xs font-bold text-[#263843]">
                {showOsMapping ? 'Mutex Lock (Binary Semaphore)' : 'Central Mutex Gate'}
              </div>
              <div className="text-[10px] text-[#62747C] font-mono">
                {syncState.withoutMutex
                  ? 'Bypassed (Unprotected)'
                  : syncState.mutexOwner
                  ? `Locked by ${syncState.mutexOwner}`
                  : 'Free (value = 1)'}
              </div>
            </div>
          </div>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              syncState.mutex === 0 ? 'bg-[#8B6508]' : 'bg-[#23704B]'
            }`}
          />
        </div>

        {/* Semaphores card */}
        <div
          onClick={() => onSelectComponent?.('SEMAPHORES')}
          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
            selectedComponent === 'SEMAPHORES'
              ? 'border-[#167D8D] bg-[#E4F3F3]'
              : 'border-[#DEE6E8] bg-[#F0F4F5] hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#167D8D]" />
            <div>
              <div className="text-xs font-bold text-[#263843]">
                {showOsMapping ? 'Counting Semaphores (empty / full)' : 'Capacity Permits'}
              </div>
              <div className="text-[10px] text-[#62747C] font-mono">
                empty = {syncState.empty} • full = {syncState.full}
              </div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-[#167D8D]">N = 5</span>
        </div>
      </div>
    </div>
  );
}
