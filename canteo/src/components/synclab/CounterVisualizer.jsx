import { Lock, Unlock, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import {
  COUNTER_INSTRUCTIONS_WITH_MUTEX,
  COUNTER_INSTRUCTIONS_WITHOUT_MUTEX,
} from '../../logic/counterEngine';

export default function CounterVisualizer({ state, onInspectThread = null }) {
  if (!state) return null;

  const instructions = state.withMutex
    ? COUNTER_INSTRUCTIONS_WITH_MUTEX
    : COUNTER_INSTRUCTIONS_WITHOUT_MUTEX;

  const p1 = state.threads.P1;
  const p2 = state.threads.P2;

  const isFault = Boolean(state.firstFault);
  const isComplete = state.isCompleted;

  return (
    <div className="space-y-4 font-sans text-left">
      {/* 1. SHARED MEMORY & MUTEX CELL */}
      <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD9CF]/80 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#647480]">
                Shared Memory Location
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  state.withMutex
                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {state.withMutex ? 'Mutex Protected' : 'Without Mutex (Unsynchronized)'}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#172B3A] mt-0.5">
              Global Order Counter (`int shared_counter`)
            </h3>
          </div>

          {/* Mutex State Badge / Indicator */}
          {state.withMutex ? (
            <div className="flex items-center gap-2 text-xs">
              {state.mutex === 1 ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium">
                  <Unlock className="w-4 h-4 text-emerald-600" />
                  <span>Mutex FREE (1)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 font-medium">
                  <Lock className="w-4 h-4 text-rose-600" />
                  <span>LOCKED by {state.mutexOwner}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Mutex BYPASSED (No Lock)</span>
            </div>
          )}
        </div>

        {/* Big Tactile Memory Block */}
        <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-[#172B3A] text-white flex flex-col items-center justify-center shadow-md">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-300">shared</span>
              <span className="text-3xl font-extrabold font-mono text-[#087F8C]">{state.shared}</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="text-[#647480]">
                Initial value: <span className="font-mono font-bold text-[#172B3A]">{state.initialShared}</span>
              </div>
              <div className="text-[#647480]">
                Expected target: <span className="font-mono font-bold text-[#087F8C]">{state.expectedFinal}</span> (2 increments)
              </div>
              <div className="text-[#647480]">
                Committed steps: <span className="font-mono font-bold text-[#172B3A]">{state.committedInstructions}</span>
              </div>
            </div>
          </div>

          {/* Wait Queue Display if withMutex */}
          {state.withMutex && (
            <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 min-w-[180px] text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block mb-1">
                Mutex Wait Queue
              </span>
              {state.waitQueue.length === 0 ? (
                <span className="text-[11px] text-[#647480] italic">Queue empty (no contention)</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {state.waitQueue.map((tid) => (
                    <span
                      key={tid}
                      className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold text-xs"
                    >
                      {tid} (BLOCKED)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fault Banner if Lost Update occurred */}
        {isFault && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 text-xs text-rose-950 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-rose-900 uppercase tracking-wider">
                Lost Update Race Condition Detected!
              </h5>
              <p className="leading-relaxed">
                {state.firstFault.explanation ||
                  `P2 wrote ${state.threads.P2.localComputed} back to memory, clobbering P1's earlier increment because P2 loaded a stale value (${state.threads.P2.localRead})! Final value is ${state.shared} instead of ${state.expectedFinal}.`}
              </p>
            </div>
          </div>
        )}

        {/* Completion Success Banner */}
        {isComplete && !isFault && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-emerald-900 uppercase tracking-wider">
                {state.withMutex
                  ? 'Correct Mathematical Outcome Guaranteed'
                  : 'Correct Outcome Achieved (Serialized by Luck)'}
              </h5>
              <p className="leading-relaxed">
                {state.withMutex
                  ? `Both threads serialized safely through mutual exclusion. Final value is precisely ${state.shared}.`
                  : `Scheduling happened to execute threads serially without overlap. Final value is ${state.shared}, but safety was not guaranteed.`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. THREAD PRIVATE REGISTERS & INSTRUCTION REGISTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Thread P1 */}
        <div
          onClick={() => onInspectThread && onInspectThread('P1')}
          className="bg-white border border-[#DDD9CF] rounded-2xl p-4 shadow-xs space-y-3 cursor-pointer hover:border-blue-400 transition-all"
        >
          <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h4 className="font-bold text-sm text-[#172B3A]">Thread P1</h4>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                p1.status === 'BLOCKED'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : p1.status === 'COMPLETED'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              {p1.status}
            </span>
          </div>

          {/* Local CPU Registers */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 text-xs space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
              Thread-Private Registers
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-white p-2 rounded-lg border border-[#DDD9CF]">
                <div className="text-[10px] text-[#647480]">localRead:</div>
                <div className="text-sm font-bold text-[#172B3A]">{p1.localRead ?? '—'}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#DDD9CF]">
                <div className="text-[10px] text-[#647480]">localComputed:</div>
                <div className="text-sm font-bold text-blue-600">{p1.localComputed ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Instruction Progress List */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
              Instruction Stream (PC = {p1.pc})
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              {instructions.map((inst) => {
                const isCurrent = p1.status !== 'COMPLETED' && p1.pc === inst.step;
                const isDone = p1.pc > inst.step || p1.status === 'COMPLETED';

                return (
                  <div
                    key={inst.step}
                    className={`px-2.5 py-1 rounded-lg border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold shadow-2xs'
                        : isDone
                        ? 'bg-[#FAF9F5] border-transparent text-[#647480] line-through opacity-70'
                        : 'bg-white border-[#DDD9CF]/60 text-[#2D4554]'
                    }`}
                  >
                    <span>{inst.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-blue-600 text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Thread P2 */}
        <div
          onClick={() => onInspectThread && onInspectThread('P2')}
          className="bg-white border border-[#DDD9CF] rounded-2xl p-4 shadow-xs space-y-3 cursor-pointer hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h4 className="font-bold text-sm text-[#172B3A]">Thread P2</h4>
            </div>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                p2.status === 'BLOCKED'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : p2.status === 'COMPLETED'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {p2.status}
            </span>
          </div>

          {/* Local CPU Registers */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 text-xs space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
              Thread-Private Registers
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-white p-2 rounded-lg border border-[#DDD9CF]">
                <div className="text-[10px] text-[#647480]">localRead:</div>
                <div className="text-sm font-bold text-[#172B3A]">{p2.localRead ?? '—'}</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#DDD9CF]">
                <div className="text-[10px] text-[#647480]">localComputed:</div>
                <div className="text-sm font-bold text-emerald-600">{p2.localComputed ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Instruction Progress List */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
              Instruction Stream (PC = {p2.pc})
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              {instructions.map((inst) => {
                const isCurrent = p2.status !== 'COMPLETED' && p2.pc === inst.step;
                const isDone = p2.pc > inst.step || p2.status === 'COMPLETED';

                return (
                  <div
                    key={inst.step}
                    className={`px-2.5 py-1 rounded-lg border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-2xs'
                        : isDone
                        ? 'bg-[#FAF9F5] border-transparent text-[#647480] line-through opacity-70'
                        : 'bg-white border-[#DDD9CF]/60 text-[#2D4554]'
                    }`}
                  >
                    <span>{inst.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-600 text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

