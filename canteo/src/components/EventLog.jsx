import { useState, useRef, useEffect } from 'react';

export default function EventLog({ events = [] }) {
  const [clearedTimestamp, setClearedTimestamp] = useState(0);
  const scrollRef = useRef(null);

  // Filter events newer than last clear action, cap at 50
  const activeEvents = events
    .filter((e) => !clearedTimestamp || (e.id > clearedTimestamp))
    .slice(0, 50);

  // Auto-scroll to top whenever a new event enters
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const handleClear = () => {
    if (events.length > 0) {
      setClearedTimestamp(events[0]?.id || Date.now());
    }
  };

  return (
    <div className="bg-[#121214] border border-[#232326] rounded-xl overflow-hidden flex flex-col h-[300px] text-left">
      {/* Title Bar */}
      <div className="px-5 py-3.5 border-b border-[#232326] flex items-center justify-between bg-[#121214] shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-sans font-semibold text-sm text-[#F5F5F4] tracking-tight">
            Event Log
          </span>
          <span className="font-mono text-[10px] bg-[#1C1C1F] text-[#8A8A8E] border border-[#2E2E33] px-2 py-0.5 rounded-full tabular-nums">
            {activeEvents.length} {activeEvents.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        <button
          onClick={handleClear}
          className="text-[11px] font-mono text-[#8A8A8E] hover:text-[#F5F5F4] hover:bg-[#1C1C1F] px-2.5 py-1 rounded transition-colors focus-amber cursor-pointer"
          aria-label="Clear event log"
        >
          Clear
        </button>
      </div>

      {/* Log Rows (13px JetBrains Mono, hairline separators #1A1A1A, 300px total height) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto divide-y divide-[#1A1A1A] font-mono text-[13px] px-5 py-1 text-left leading-normal"
      >
        {activeEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#55555A] text-xs font-mono py-12">
            — no kernel events recorded —
          </div>
        ) : (
          activeEvents.map((ev) => {
            const opRaw = ev.operation || 'OP';
            const opLower = opRaw.toLowerCase();

            // Syntax-highlighting for verb:
            // wait = amber #F59E0B, signal = green #22C55E, mutex = blue #60A5FA, BLOCKED = red #EF4444, INSERT/CONSUME = white
            let verbColor = 'text-[#F5F5F4]';
            if (opLower.includes('block') || ev.result === 'blocked') {
              verbColor = 'text-[#EF4444]';
            } else if (opLower.startsWith('wait')) {
              verbColor = 'text-[#F59E0B]';
            } else if (opLower.startsWith('signal')) {
              verbColor = 'text-[#22C55E]';
            } else if (opLower.includes('mutex') || ev.type === 'mutex') {
              verbColor = 'text-[#60A5FA]';
            } else if (opLower.includes('insert') || opLower.includes('consume') || opLower.includes('take')) {
              verbColor = 'text-[#F5F5F4]';
            }

            // Result tag right-aligned
            const isBlocked = ev.result === 'blocked' || ev.result === 'warning' || opLower.includes('block');
            const isSuccess = ev.result === 'success' || !isBlocked;

            return (
              <div
                key={ev.id || `${ev.sequence}-${ev.timestamp}`}
                className="py-2 flex items-center justify-between gap-3 group"
              >
                {/* Left: [time] VERB description */}
                <div className="flex items-baseline gap-2.5 min-w-0 flex-1 truncate">
                  <span className="text-[#6B6B6B] text-[11px] tabular-nums shrink-0 font-mono">
                    [{ev.timestamp || '00:00:00'}]
                  </span>

                  <span className={`font-semibold shrink-0 ${verbColor}`}>
                    {opRaw}
                  </span>

                  <span className="text-[#D4D4D8] truncate font-normal text-[13px]">
                    {ev.description}
                  </span>

                  {ev.semaphores && (
                    <span className="text-[#6B6B6B] text-[11px] tabular-nums shrink-0 hidden sm:inline">
                      ({ev.semaphores.empty}→{ev.semaphores.full})
                    </span>
                  )}
                </div>

                {/* Right: Small Pill */}
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 font-medium ${
                    isBlocked
                      ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                      : isSuccess
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                      : 'bg-[#232326] text-[#8A8A8E] border border-[#2E2E33]'
                  }`}
                >
                  {isBlocked ? 'BLOCKED' : 'SUCCESS'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
