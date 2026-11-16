import {
  PRODUCER_INSTRUCTIONS,
  CONSUMER_INSTRUCTIONS,
  DEADLOCK_CONSUMER_INSTRUCTIONS,
} from '../../logic/syncLabEngine';

export default function InstructionInspector({ syncState, selectedThreadId }) {
  const activeThread = syncState.threads[selectedThreadId] || Object.values(syncState.threads)[0];
  const isDeadlockConsumer = syncState.useDeadlockConsumer && activeThread?.role === 'CONSUMER';
  const consumerList = isDeadlockConsumer ? DEADLOCK_CONSUMER_INSTRUCTIONS : CONSUMER_INSTRUCTIONS;

  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 space-y-4 text-left shadow-xs font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-[#DDD9CF]">
        <div>
          <h3 className="font-sans font-bold text-sm text-[#172B3A]">
            POSIX Synchronization Pseudocode
          </h3>
          <p className="text-xs text-[#647480] mt-0.5">
            Active instruction line highlighted in real-time execution
          </p>
        </div>
        <div className="text-xs font-mono text-[#647480]">
          Active Focus: <strong className="text-[#087F8C]">{activeThread?.id || '—'}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Producer Routine */}
        <div className="bg-[#F6F4EE] border border-[#DDD9CF] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD9CF]">
            <span className="font-mono text-xs font-bold text-[#E98570]">
              void* producer(void* arg)
            </span>
            <span className="text-[10px] font-mono text-[#647480]">P1, P2</span>
          </div>

          <div className="space-y-1 font-mono text-[11px] leading-relaxed">
            {PRODUCER_INSTRUCTIONS.map((item, idx) => {
              const isCurrent =
                activeThread?.role === 'PRODUCER' && activeThread?.pc === idx;
              const isLastExecuted =
                activeThread?.role === 'PRODUCER' &&
                syncState.stepCounter > 0 &&
                ((activeThread.pc - 1 + 8) % 8) === idx;
              const isCriticalSection = idx >= 2 && idx <= 5;

              return (
                <div
                  key={`prod-step-${idx}`}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-white border-2 border-[#E98570] text-[#172B3A] font-bold shadow-xs'
                      : isLastExecuted
                        ? 'bg-[#E1F2EF]/60 border border-[#087F8C]/40 text-[#172B3A]'
                        : isCriticalSection
                          ? 'bg-amber-50/60 border border-amber-200/80 text-[#172B3A]'
                          : 'text-[#647480] hover:text-[#172B3A]'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-[#A0AAB2] select-none w-4 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <span className="break-all">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {idx === 2 && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                        Lock 🔒
                      </span>
                    )}
                    {idx === 5 && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                        Unlock 🔓
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-xs bg-[#E98570] text-white uppercase tracking-wider">
                        Next →
                      </span>
                    )}
                    {!isCurrent && isLastExecuted && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-xs bg-[#087F8C] text-white uppercase tracking-wider">
                        Last ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Consumer Routine */}
        <div className="bg-[#F6F4EE] border border-[#DDD9CF] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#DDD9CF]">
            <span className="font-mono text-xs font-bold text-[#087F8C]">
              void* consumer(void* arg)
            </span>
            <span className="text-[10px] font-mono text-[#647480]">
              {isDeadlockConsumer ? 'FAULTY ORDER' : 'C1 Kitchen'}
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px] leading-relaxed">
            {consumerList.map((item, idx) => {
              const isCurrent =
                activeThread?.role === 'CONSUMER' && activeThread?.pc === idx;
              const isLastExecuted =
                activeThread?.role === 'CONSUMER' &&
                syncState.stepCounter > 0 &&
                ((activeThread.pc - 1 + 8) % 8) === idx;
              const isCriticalSection = !isDeadlockConsumer && idx >= 1 && idx <= 4;
              const isCookingOutsideLock = !isDeadlockConsumer && idx === 6;

              return (
                <div
                  key={`cons-step-${idx}`}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                    isCurrent
                      ? 'bg-white border-2 border-[#087F8C] text-[#172B3A] font-bold shadow-xs'
                      : isLastExecuted
                        ? 'bg-[#E1F2EF]/60 border border-[#087F8C]/40 text-[#172B3A]'
                        : isCriticalSection
                          ? 'bg-amber-50/60 border border-amber-200/80 text-[#172B3A]'
                          : isCookingOutsideLock
                            ? 'bg-[#E1F2EF]/30 border border-[#087F8C]/20 text-[#172B3A]'
                            : 'text-[#647480] hover:text-[#172B3A]'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-[#A0AAB2] select-none w-4 shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <span className="break-all">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isDeadlockConsumer && idx === 1 && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                        Lock 🔒
                      </span>
                    )}
                    {!isDeadlockConsumer && idx === 4 && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                        Unlock 🔓
                      </span>
                    )}
                    {isCookingOutsideLock && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#E1F2EF] text-[#087F8C] uppercase">
                        Outside Lock 🍳
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-xs bg-[#087F8C] text-white shrink-0 uppercase tracking-wider">
                        Next →
                      </span>
                    )}
                    {!isCurrent && isLastExecuted && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-xs bg-[#087F8C] text-white shrink-0 uppercase tracking-wider">
                        Last ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Real Backend vs Educational Model Comparison Callout */}
      <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#DDD9CF] space-y-1.5 text-xs text-[#5E5E5E] leading-relaxed">
        <div className="flex items-center gap-2 font-mono font-bold text-[#111111]">
          <span>Production Backend vs Educational Model</span>
        </div>
        <p>
          <strong>Actual Spring Boot Backend:</strong> The Java server (<code>OrderService.java</code>) enforces queue admission using a JVM monitor lock: <code>synchronized (QUEUE_LOCK)</code>, verifying that the database does not exceed <code>QUEUE_CAPACITY = 5</code> before persisting the order entity.
        </p>
        <p>
          <strong>Sync Lab Educational Model:</strong> Implements textbook POSIX concurrency primitives: explicit counting semaphores (<code>empty</code>, <code>full</code>) and a binary <code>mutex</code> with circular pointer modulo arithmetic, demonstrating instruction-level thread interleavings and race conditions.
        </p>
      </div>
    </div>
  );
}
