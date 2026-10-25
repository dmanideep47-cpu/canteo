import { Lock, Unlock, Inbox, Layers } from 'lucide-react';

export default function SemaphoreChip({ empty, full, mutex, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
        <span className="bg-[#FAF7F2] text-[#111111] px-2 py-0.5 rounded-md border border-[#E5E2DD]">
          E:{empty}
        </span>
        <span className="bg-[#FAF7F2] text-[#111111] px-2 py-0.5 rounded-md border border-[#E5E2DD]">
          F:{full}
        </span>
        <span
          className={`px-2 py-0.5 rounded-md font-medium border ${
            mutex === 1
              ? 'bg-[#FAF7F2] text-[#D97706] border-[#E5E2DD]'
              : 'bg-[#FAF7F2] text-[#C0392B] border-[#C0392B]'
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
      <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between text-[#8C8C8C]">
          <span className="text-[10px] font-mono tracking-widest uppercase">empty</span>
          <Inbox className="w-3.5 h-3.5 text-[#8C8C8C]" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xl font-bold font-mono text-white">{empty}</span>
          <span className="text-[10px] text-[#8C8C8C] font-mono">free</span>
        </div>
      </div>

      {/* Full */}
      <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 flex flex-col justify-between text-left">
        <div className="flex items-center justify-between text-[#8C8C8C]">
          <span className="text-[10px] font-mono tracking-widest uppercase">full</span>
          <Layers className="w-3.5 h-3.5 text-[#8C8C8C]" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xl font-bold font-mono text-white">{full}</span>
          <span className="text-[10px] text-[#8C8C8C] font-mono">queued</span>
        </div>
      </div>

      {/* Mutex */}
      <div
        className={`border rounded-xl p-3 flex flex-col justify-between text-left transition-colors ${
          mutex === 1
            ? 'bg-[#161616] border-[#262626]'
            : 'bg-[#1C1111] border-[#C0392B]/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-mono tracking-widest uppercase ${
              mutex === 1 ? 'text-[#8C8C8C]' : 'text-[#C0392B]'
            }`}
          >
            mutex
          </span>
          {mutex === 1 ? (
            <Unlock className="w-3.5 h-3.5 text-[#D97706]" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-[#C0392B]" />
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span
            className={`text-xl font-bold font-mono ${
              mutex === 1 ? 'text-[#D97706]' : 'text-[#C0392B]'
            }`}
          >
            {mutex}
          </span>
          <span className="text-[10px] text-[#8C8C8C] font-mono">
            {mutex === 1 ? 'unlocked' : 'locked'}
          </span>
        </div>
      </div>
    </div>
  );
}
