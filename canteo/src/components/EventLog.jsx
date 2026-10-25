import { useState } from 'react';
import { Terminal } from 'lucide-react';

export default function EventLog({ events }) {
  const [filter, setFilter] = useState('ALL');

  const filteredEvents = events.filter((ev) => {
    if (filter === 'ALL') return true;
    if (filter === 'PRODUCER') return ev.type === 'producer';
    if (filter === 'CONSUMER') return ev.type === 'consumer';
    if (filter === 'MUTEX') return ev.type === 'mutex';
    if (filter === 'BLOCKED') return ev.result === 'blocked' || ev.result === 'warning';
    return true;
  });

  return (
    <div className="bg-[#0C0C0C] text-white rounded-xl border border-[#222222] p-5 flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#D97706]" />
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-white">
            OS Synchronization Event Log
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#8C8C8C] tabular-nums">
          {events.length} events
        </span>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 py-3 border-b border-[#222222] text-[10px] font-mono overflow-x-auto no-scrollbar">
        {['ALL', 'PRODUCER', 'CONSUMER', 'MUTEX', 'BLOCKED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              filter === f
                ? 'bg-white text-black font-semibold'
                : 'bg-[#161616] text-[#8C8C8C] hover:text-white border border-[#222222]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Scrollable Events Body: 13px JetBrains Mono, hairline rows, syntax-colored verbs */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1A1A1A] font-mono text-[13px] text-left pt-1">
        {filteredEvents.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#5E5E5E] text-xs font-mono">
            — nothing here yet —
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const op = (ev.operation || '').toLowerCase();
            let verbColor = 'text-[#D97706]'; // default wait = amber
            if (ev.result === 'blocked' || ev.result === 'warning' || op.includes('block')) {
              verbColor = 'text-[#EF4444]'; // blocked = red
            } else if (op.includes('mutex') || ev.type === 'mutex') {
              verbColor = 'text-[#3B82F6]'; // mutex = blue
            } else if (op.startsWith('wait')) {
              verbColor = 'text-[#D97706]'; // wait = amber
            } else if (op.startsWith('signal')) {
              verbColor = 'text-[#22C55E]'; // signal = green
            }

            return (
              <div key={ev.id} className="py-2.5 flex items-start gap-3">
                {/* Gray Timestamp */}
                <span className="text-[#6B6B6B] tabular-nums shrink-0 pt-0.5 text-[11px]">
                  {ev.timestamp || '00:00:00'}
                </span>

                {/* Colored Verb & White Description */}
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-semibold ${verbColor}`}>
                      {ev.operation}
                    </span>
                    {ev.semaphores && (
                      <span className="text-[11px] text-[#6B6B6B] tabular-nums">
                        [E:{ev.semaphores.empty} F:{ev.semaphores.full} M:{ev.semaphores.mutex}]
                      </span>
                    )}
                  </div>
                  <p className="text-[#CCCCCC] text-[12px] mt-0.5 font-normal leading-relaxed">
                    {ev.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
