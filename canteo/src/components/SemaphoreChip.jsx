import { Lock, Unlock, Inbox, Layers } from 'lucide-react';

export default function SemaphoreChip({ empty, full, mutex, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
        <span className="bg-[#FAF8F3] text-[#252A27] px-2 py-0.5 rounded-md border border-[#E7E3D9]">
          E:{empty}
        </span>
        <span className="bg-[#FAF8F3] text-[#252A27] px-2 py-0.5 rounded-md border border-[#E7E3D9]">
          F:{full}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md font-medium border ${
            mutex === 1
              ? 'bg-[#FAF8F3] text-[#194D40] border-[#E7E3D9]'
              : 'bg-[#FDF1EF] text-[#BA3C2A] border-[#F6CBC5]'
          }`}
        >
          M:{mutex}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 w-full tabular-nums">
      {/* Empty */}
      <div className="bg-[#123A32] border border-[#236555] rounded-xl p-3.5 flex flex-col justify-between text-left shadow-xs">
        <div className="flex items-center justify-between text-[#A3BEB4]">
          <span className="text-[10px] font-mono tracking-widest uppercase font-semibold">empty</span>
          <Inbox className="w-3.5 h-3.5 text-[#A3BEB4]" />
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-white">{empty}</span>
          <span className="text-[10px] text-[#A3BEB4] font-mono font-medium">free slots</span>
        </div>
      </div>

      {/* Full */}
      <div className="bg-[#123A32] border border-[#236555] rounded-xl p-3.5 flex flex-col justify-between text-left shadow-xs">
        <div className="flex items-center justify-between text-[#A3BEB4]">
          <span className="text-[10px] font-mono tracking-widest uppercase font-semibold">full</span>
          <Layers className="w-3.5 h-3.5 text-[#A3BEB4]" />
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono text-white">{full}</span>
          <span className="text-[10px] text-[#A3BEB4] font-mono font-medium">queued</span>
        </div>
      </div>

      {/* Mutex */}
      <div
        className={`border rounded-xl p-3.5 flex flex-col justify-between text-left transition-colors shadow-xs ${
          mutex === 1
            ? 'bg-[#123A32] border-[#236555]'
            : 'bg-[#2A1816] border-[#BA3C2A]/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-mono tracking-widest uppercase font-semibold ${
              mutex === 1 ? 'text-[#A3BEB4]' : 'text-[#F6CBC5]'
            }`}
          >
            mutex
          </span>
          {mutex === 1 ? (
            <Unlock className="w-3.5 h-3.5 text-[#C69A52]" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-[#E07A6B]" />
          )}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between">
          <span
            className={`text-2xl font-bold font-mono ${
              mutex === 1 ? 'text-[#C69A52]' : 'text-[#E07A6B]'
            }`}
          >
            {mutex}
          </span>
          <span
            className={`text-[10px] font-mono font-medium ${
              mutex === 1 ? 'text-[#A3BEB4]' : 'text-[#F6CBC5]'
            }`}
          >
            {mutex === 1 ? 'unlocked' : 'locked'}
          </span>
        </div>
      </div>
    </div>
  );
}
