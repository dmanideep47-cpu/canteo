export default function SlotInspector({ syncState, selectedSlot, onSelectSlot }) {
  const slotData = syncState.slots[selectedSlot] || null;
  const isTargetIn = syncState.in === selectedSlot;
  const isTargetOut = syncState.out === selectedSlot;

  return (
    <div className="bg-[#121214] border border-[#232326] rounded-xl p-5 space-y-4 text-left">
      <div className="flex items-center justify-between pb-2 border-b border-[#232326]">
        <div>
          <h3 className="font-sans font-semibold text-sm text-[#F5F5F4]">
            Buffer Slot Inspector
          </h3>
          <p className="text-[11px] font-mono text-[#8A8A8E] mt-0.5">
            Circular array memory cell telemetry
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {syncState.slots.map((_, idx) => (
            <button
              key={`btn-slot-${idx}`}
              onClick={() => onSelectSlot(idx)}
              className={`w-7 h-7 rounded font-mono text-xs font-bold transition-all cursor-pointer ${
                selectedSlot === idx
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border border-[#27272A]'
              }`}
            >
              {idx}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 font-mono text-xs">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg space-y-1">
            <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
              Slot Address
            </span>
            <div className="font-bold text-[#F5F5F4]">Slot #{selectedSlot}</div>
          </div>

          <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg space-y-1">
            <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
              Cell State
            </span>
            <div
              className={`font-bold flex items-center gap-1.5 ${
                slotData ? 'text-[#3B82F6]' : 'text-[#71717A]'
              }`}
            >
              <span>{slotData ? 'OCCUPIED' : 'EMPTY'}</span>
            </div>
          </div>
        </div>

        {/* Pointers pointing to this slot */}
        <div className="bg-[#161618] border border-[#232326] p-3 rounded-lg flex items-center justify-between">
          <span className="text-[11px] text-[#8A8A8E]">Active Pointers:</span>
          <div className="flex items-center gap-2">
            {isTargetIn && (
              <span className="px-2 py-0.5 rounded bg-[#F59E0B] text-black font-bold text-[10px]">
                IN (Next Write)
              </span>
            )}
            {isTargetOut && (
              <span className="px-2 py-0.5 rounded bg-[#22C55E] text-black font-bold text-[10px]">
                OUT (Next Read)
              </span>
            )}
            {!isTargetIn && !isTargetOut && (
              <span className="text-[10px] text-[#71717A]">None</span>
            )}
          </div>
        </div>

        {slotData ? (
          <div className="bg-[#161618] border border-[#232326] p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8A8A8E]">Order Token:</span>
              <strong className="text-[#F59E0B]">{slotData.id}</strong>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8A8A8E]">Item Name:</span>
              <span className="text-white">{slotData.name}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8A8A8E]">Producer ID:</span>
              <span className="text-[#A1A1AA]">{slotData.producerId}</span>
            </div>
            {slotData.insertedStep && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#8A8A8E]">Inserted at Step:</span>
                <span className="text-[#A1A1AA]">#{slotData.insertedStep}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#161618] border border-[#232326] p-3 rounded-lg text-center text-[#71717A] text-[11px]">
            Slot is currently empty and eligible for allocation by producer when empty &gt; 0.
          </div>
        )}
      </div>
    </div>
  );
}

