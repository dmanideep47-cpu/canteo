import { useState, useReducer, useEffect, useRef } from 'react';
import { useApp } from '../app/AppContext';
import EventLog from '../components/EventLog';
import SafeImage from '../components/SafeImage';
import {
  raceConditionReducer,
  INITIAL_RACE_STATE,
  RACE_DEMO_ACTIONS,
  WITHOUT_MUTEX_STEPS,
  WITH_MUTEX_STEPS,
} from '../logic/raceConditionReducer';
import {
  Plus,
  Play,
  Layers,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function SyncLabScreen() {
  const {
    state,
    simulateStudentOrder,
    takeOrder,
    simulateQueueFull,
    resetSimulation,
  } = useApp();

  const [raceState, dispatchRace] = useReducer(raceConditionReducer, INITIAL_RACE_STATE);
  const raceTimerRef = useRef(null);

  // Semaphore pulse tracking
  const [pulsing, setPulsing] = useState({ empty: false, full: false, mutex: false });
  const prevValsRef = useRef({ empty: state.empty, full: state.full, mutex: state.mutex });

  useEffect(() => {
    const prev = prevValsRef.current;
    if (prev.empty !== state.empty || prev.full !== state.full || prev.mutex !== state.mutex) {
      setPulsing({
        empty: prev.empty !== state.empty,
        full: prev.full !== state.full,
        mutex: prev.mutex !== state.mutex,
      });
      prevValsRef.current = { empty: state.empty, full: state.full, mutex: state.mutex };
      const timer = setTimeout(() => {
        setPulsing({ empty: false, full: false, mutex: false });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state.empty, state.full, state.mutex]);

  // Slot exit animation tracking
  const [exitingOrder, setExitingOrder] = useState(null);
  const prevQueueIdsRef = useRef(state.queue.map((o) => o.id));

  useEffect(() => {
    const prevIds = prevQueueIdsRef.current;
    const currentIds = state.queue.map((o) => o.id);
    const removed = prevIds.find((id) => !currentIds.includes(id));
    if (removed) {
      setExitingOrder(removed);
      const timer = setTimeout(() => setExitingOrder(null), 300);
      prevQueueIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }
    prevQueueIdsRef.current = currentIds;
  }, [state.queue]);

  useEffect(() => {
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    };
  }, []);

  // Race demo steppers
  const handleRunWithoutMutex = () => {
    if (raceState.isRunning) return;
    dispatchRace({ type: RACE_DEMO_ACTIONS.START_WITHOUT_MUTEX });
    let step = 0;
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    raceTimerRef.current = setInterval(() => {
      if (step < WITHOUT_MUTEX_STEPS.length) {
        dispatchRace({ type: RACE_DEMO_ACTIONS.STEP_WITHOUT_MUTEX, payload: { index: step } });
        step++;
      } else {
        clearInterval(raceTimerRef.current);
      }
    }, 300);
  };

  const handleRunWithMutex = () => {
    if (raceState.isRunning) return;
    dispatchRace({ type: RACE_DEMO_ACTIONS.START_WITH_MUTEX });
    let step = 0;
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    raceTimerRef.current = setInterval(() => {
      if (step < WITH_MUTEX_STEPS.length) {
        dispatchRace({ type: RACE_DEMO_ACTIONS.STEP_WITH_MUTEX, payload: { index: step } });
        step++;
      } else {
        clearInterval(raceTimerRef.current);
      }
    }, 300);
  };

  const handleResetRaceDemo = () => {
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    dispatchRace({ type: RACE_DEMO_ACTIONS.RESET_DEMO });
  };

  const isInvariantValid = state.empty + state.full === 5;
  const isBufferFull = state.empty === 0;
  const isBufferEmpty = state.full === 0;

  // Dynamic status pill
  const statusPill = isBufferFull
    ? { dot: 'bg-[#EF4444]', text: 'BUFFER FULL — PRODUCERS BLOCKED', dotClass: 'bg-[#EF4444]' }
    : isBufferEmpty
      ? { dot: 'bg-[#8A8A8E]', text: 'BUFFER EMPTY — CONSUMER IDLE', dotClass: 'bg-[#8A8A8E]' }
      : { dot: 'bg-[#22C55E]', text: 'KERNEL OPERATIONAL', dotClass: 'bg-[#22C55E] animate-pulse' };

  const withoutMutexDone =
    raceState.mode === 'WITHOUT_MUTEX' && raceState.stepIndex >= WITHOUT_MUTEX_STEPS.length;
  const withMutexDone =
    raceState.mode === 'WITH_MUTEX' && raceState.stepIndex >= WITH_MUTEX_STEPS.length;

  return (
    <div className="bg-[#0A0A0B] text-[#F5F5F4] min-h-[calc(100vh-45px)] p-6 sm:p-8 space-y-4 max-w-[1200px] mx-auto text-left selection:bg-[#F59E0B] selection:text-black">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#232326]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold font-sans tracking-tight text-[#F5F5F4]">
            Sync Lab
          </h1>
          <p className="text-xs text-[#8A8A8E] mt-0.5 font-mono">
            POSIX Semaphore & Bounded Buffer Synchronization Console
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 bg-[#121214] border border-[#232326] px-3 py-1 rounded-full font-mono text-[11px] text-[#8A8A8E]">
            <span className={`w-2 h-2 rounded-full ${statusPill.dotClass}`} />
            <span className="uppercase tracking-[0.15em] font-medium text-[#F5F5F4]">
              {statusPill.text}
            </span>
          </div>

          <button
            onClick={resetSimulation}
            className="text-xs font-mono text-[#8A8A8E] hover:text-white px-2.5 py-1 rounded-full hover:bg-[#161618] border border-transparent hover:border-[#232326] transition-all flex items-center gap-1.5 focus-amber cursor-pointer"
            title="Reset queue and semaphores to initial state"
            aria-label="Reset simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* MAIN CONSOLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ZONE 1: SEMAPHORE CONSOLE */}
        <section
          aria-label="Semaphore Console"
          className="lg:col-span-4 bg-[#121214] border border-[#232326] rounded-xl p-6 space-y-6 order-2 lg:order-1"
        >
          <div>
            <h2 className="font-sans font-semibold text-base text-[#F5F5F4] tracking-tight">
              Synchronization State
            </h2>
            <p className="text-[11px] font-mono text-[#8A8A8E] mt-0.5 uppercase tracking-[0.1em]">
              POSIX Semaphore Registers
            </p>
          </div>

          <div className="space-y-6">
            {/* EMPTY */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span
                  key={`empty-${state.empty}`}
                  className={`text-[56px] font-bold font-mono leading-none tracking-tight text-[#F59E0B] tabular-nums ${pulsing.empty ? 'animate-number-pulse' : ''
                    }`}
                >
                  {state.empty}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#8A8A8E]">
                  empty · free slots
                </span>
              </div>
              <div className="w-full h-1 bg-[#1F1F24] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F59E0B] rounded-full transition-all duration-300"
                  style={{ width: `${(state.empty / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* FULL */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span
                  key={`full-${state.full}`}
                  className={`text-[56px] font-bold font-mono leading-none tracking-tight text-[#22C55E] tabular-nums ${pulsing.full ? 'animate-number-pulse' : ''
                    }`}
                >
                  {state.full}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#8A8A8E]">
                  full · waiting orders
                </span>
              </div>
              <div className="w-full h-1 bg-[#1F1F24] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22C55E] rounded-full transition-all duration-300"
                  style={{ width: `${(state.full / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* MUTEX */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span
                  key={`mutex-${state.mutex}`}
                  className={`text-[44px] font-bold font-mono leading-none tracking-tight tabular-nums ${state.mutex === 0 ? 'text-[#F59E0B]' : 'text-[#8A8A8E]'
                    } ${pulsing.mutex ? 'animate-number-pulse' : ''}`}
                >
                  {state.mutex === 0 ? 'LOCKED' : 'FREE'}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#8A8A8E]">
                  mutex · binary lock
                </span>
              </div>
              <div className="w-full h-1 bg-[#1F1F24] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${state.mutex === 0 ? 'w-full bg-[#F59E0B]' : 'w-[8%] bg-[#44444A]'
                    }`}
                />
              </div>
            </div>
          </div>

          {/* INVARIANT */}
          <div className="pt-4 border-t border-[#232326] flex items-center justify-between font-mono text-xs">
            <span className="text-[#8A8A8E] text-[11px] uppercase tracking-[0.1em]">
              System Invariant
            </span>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={isInvariantValid ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                empty + full = 5
              </span>
              <span className={isInvariantValid ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                {isInvariantValid ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </section>

        {/* ZONE 2: BOUNDED BUFFER */}
        <section
          aria-label="Bounded Buffer Conveyor"
          className="lg:col-span-8 bg-[#121214] border border-[#232326] rounded-xl p-6 space-y-6 order-1 lg:order-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
            <div>
              <h2 className="font-sans font-semibold text-base text-[#F5F5F4] tracking-tight">
                Bounded Buffer — Capacity 5
              </h2>
              <p className="text-xs text-[#8A8A8E] mt-0.5 font-mono">
                Students produce → Kitchen consumes
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-[#8A8A8E]">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>FIFO circular memory array</span>
            </div>
          </div>

          {/* CONVEYOR STRIP */}
          <div className="w-full overflow-x-auto no-scrollbar rounded-xl border border-[#232326] bg-[#161618] conveyor-scanlines">
            <div className="flex min-w-[600px] divide-x divide-[#232326]">
              {Array.from({ length: 5 }).map((_, idx) => {
                const order = state.queue[idx] || null;
                const slotNum = String(idx + 1).padStart(2, '0');

                // Ghost slot for exit animation
                if (!order && exitingOrder && idx === state.queue.length) {
                  return (
                    <div
                      key={`exit-${exitingOrder}`}
                      className="w-1/5 min-w-[120px] h-[140px] flex flex-col items-center justify-center p-3.5 text-center animate-slot-out"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#1A1A1E] border border-[#2E2E33] flex items-center justify-center font-mono text-[10px] text-[#8A8A8E]">
                        {exitingOrder}
                      </div>
                      <span className="font-mono text-[10px] text-[#6B6B6B] mt-2">consumed</span>
                    </div>
                  );
                }

                if (!order) {
                  const isFirstEmpty = state.queue.length === idx;
                  return (
                    <div
                      key={`empty-slot-${idx}`}
                      className="w-1/5 min-w-[120px] h-[140px] flex flex-col items-center justify-center p-3.5 text-center transition-all"
                    >
                      <div
                        className={`w-10 h-10 rounded-full border border-dashed border-[#3A3A3E] flex items-center justify-center font-mono text-[10px] text-[#55555A] mb-2 ${isFirstEmpty && !isBufferFull ? 'animate-pulse' : ''
                          }`}
                      >
                        {slotNum}
                      </div>
                      <span className="font-mono text-[10px] text-[#6B6B6B] uppercase tracking-wider">
                        EMPTY
                      </span>
                      {isFirstEmpty && !isBufferFull && (
                        <span className="font-mono text-[9px] text-[#55555A] mt-1">
                          awaiting producer
                        </span>
                      )}
                    </div>
                  );
                }

                const firstItem = order.items?.[0];
                const status = (order.status || 'WAITING').toUpperCase();

                return (
                  <div
                    key={order.id}
                    className="relative w-1/5 min-w-[120px] h-[140px] flex flex-col items-center justify-between p-3.5 text-center animate-slot-in transition-all bg-[#121214]/60 hover:bg-[#121214] cursor-pointer group"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-44 bg-[#1A1A1E] border border-[#2E2E33] rounded-lg p-2.5 text-left opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="font-mono text-[11px] text-[#F5F5F4] font-semibold">
                        {order.id}
                      </div>
                      <div className="font-mono text-[10px] text-[#8A8A8E] mt-1">
                        {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                      </div>
                      <div className="font-mono text-[10px] text-[#F59E0B] mt-1">
                        Position: {idx + 1} · {status}
                      </div>
                    </div>

                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1A1A1E] border border-[#2E2E33] shrink-0 p-0.5 group-hover:border-[#F59E0B] transition-colors">
                      {firstItem?.imageUrl ? (
                        <SafeImage
                          src={firstItem.imageUrl}
                          alt={firstItem.name || order.id}
                          aspectRatio="aspect-square"
                          className="w-full h-full rounded-full object-cover"
                          fallbackText={order.id}
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-[#1F1F24] flex items-center justify-center font-mono text-[10px] text-[#F5F5F4] font-semibold">
                          ORD
                        </div>
                      )}
                    </div>

                    <div className="font-mono font-semibold text-xs text-[#F5F5F4] tracking-tight">
                      {order.id}
                    </div>

                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase tracking-wider font-semibold ${status === 'READY'
                          ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                          : status === 'PREPARING'
                            ? 'text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30 animate-pulse'
                            : 'text-[#8A8A8E] bg-[#1C1C1F] border border-[#2E2E33]'
                        }`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={simulateStudentOrder}
              className="h-[44px] px-5 rounded-full bg-[#F59E0B] text-black font-sans font-semibold text-xs hover:bg-[#D97706] active:scale-[0.97] transition-all flex items-center gap-2 focus-amber cursor-pointer"
            >
              <Plus className="w-4 h-4 text-black stroke-[2.5]" />
              <span>Simulate Student Order</span>
            </button>

            <button
              onClick={takeOrder}
              disabled={state.full === 0 && !state.activeOrder}
              className="h-[44px] px-5 rounded-full border border-[#3A3A3E] text-[#F5F5F4] font-sans font-medium text-xs hover:bg-[#1A1A1E] hover:border-[#4A4A4E] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] transition-all flex items-center gap-2 focus-amber cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-[#22C55E] fill-current" />
              <span>Simulate Kitchen Take</span>
            </button>

            <button
              onClick={simulateQueueFull}
              className="h-[44px] px-5 rounded-full border border-[#3A3A3E] text-[#F5F5F4] font-sans font-medium text-xs hover:bg-[#1A1A1E] hover:border-[#4A4A4E] active:scale-[0.97] transition-all flex items-center gap-2 focus-amber cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#8A8A8E]" />
              <span>Simulate Queue Full</span>
            </button>

            <button
              onClick={resetSimulation}
              className="h-[44px] px-4 rounded-full text-[#8A8A8E] hover:text-white font-sans font-medium text-xs hover:bg-[#1A1A1E] active:scale-[0.97] transition-all flex items-center gap-1.5 focus-amber cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* BUFFER FULL WARNING */}
          {isBufferFull && (
            <div className="bg-[#1C1214] border border-[#EF4444]/40 text-[#EF4444] px-4 py-2.5 rounded-xl text-xs font-mono flex items-center gap-2 animate-slot-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
              <span>⚠ Buffer full — producer blocked waiting on sem_wait(&empty)</span>
            </div>
          )}

          {/* BLOCKED PRODUCERS */}
          {state.blockedProducers.length > 0 && (
            <div className="bg-[#161618] border border-[#232326] rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-mono text-[#8A8A8E] uppercase tracking-wider block">
                Blocked Producers FIFO Queue ({state.blockedProducers.length} threads suspended)
              </span>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                {state.blockedProducers.map((blockedOrder, bIdx) => (
                  <div key={blockedOrder.id} className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded bg-[#1C1214] border border-[#EF4444]/40 text-[#EF4444] font-semibold">
                      {blockedOrder.id}
                    </span>
                    {bIdx < state.blockedProducers.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-[#55555A]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* EVENT LOG */}
      <section aria-label="Event Log View">
        <EventLog events={state.events} />
      </section>

      {/* RACE CONDITION LAB */}
      <section
        aria-label="Race Condition Laboratory"
        className="bg-[#121214] border border-[#232326] rounded-xl p-6 space-y-6 text-left"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#232326]">
          <div>
            <h2 className="font-sans font-semibold text-lg text-[#F5F5F4] tracking-tight">
              Race Condition Laboratory
            </h2>
            <p className="text-xs text-[#8A8A8E] mt-0.5 font-mono">
              Isolated demonstration — does not affect real orders
            </p>
          </div>
          <button
            onClick={handleResetRaceDemo}
            className="text-xs font-mono text-[#8A8A8E] hover:text-[#F5F5F4] hover:bg-[#1A1A1E] px-3 py-1 rounded transition-colors self-start sm:self-auto focus-amber cursor-pointer"
          >
            Reset Lab
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WITHOUT MUTEX */}
          <div className="bg-[#161214] border border-[#EF4444]/25 rounded-xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-semibold text-sm text-[#EF4444]">Without Mutex</h3>
                  <p className="text-[11px] font-mono text-[#8A8A8E] mt-0.5">
                    Unsynchronized concurrent execution
                  </p>
                </div>
                <button
                  onClick={handleRunWithoutMutex}
                  disabled={raceState.isRunning}
                  className="h-[38px] px-4 rounded-full border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/15 disabled:opacity-40 text-xs font-sans font-medium active:scale-[0.97] transition-all focus-amber cursor-pointer"
                >
                  Run Unsafe Demo
                </button>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {WITHOUT_MUTEX_STEPS.map((stepItem, idx) => {
                  const isCurrent =
                    raceState.mode === 'WITHOUT_MUTEX' && raceState.stepIndex === idx + 1;
                  const isCompleted =
                    raceState.mode === 'WITHOUT_MUTEX' && raceState.stepIndex > idx + 1;
                  return (
                    <div
                      key={stepItem.step}
                      className={`flex items-start gap-2.5 p-2 rounded transition-colors ${isCurrent
                          ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]'
                          : isCompleted
                            ? 'text-[#F5F5F4]'
                            : 'text-[#66666A]'
                        }`}
                    >
                      <span className="font-bold shrink-0">{idx + 1}.</span>
                      <div className="min-w-0">
                        <span className="font-semibold text-white mr-1.5">{stepItem.actor}:</span>
                        <span>{stepItem.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#232326] space-y-1.5">
              {withoutMutexDone ? (
                <div className="bg-[#211114] border border-[#EF4444]/40 p-2.5 rounded-lg flex items-center justify-between font-mono text-xs">
                  <span className="text-[#8A8A8E]">Final Shared State:</span>
                  <span className="text-[#EF4444] font-bold flex items-center gap-1.5">
                    ORD101 = READY
                    <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                  </span>
                </div>
              ) : (
                <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg font-mono text-xs text-[#66666A] text-center">
                  Run demo to see result
                </div>
              )}
              <p className="text-[11px] font-mono text-[#8A8A8E] leading-relaxed">
                Staff B acted on stale data — invalid transition hidden
              </p>
            </div>
          </div>

          {/* WITH MUTEX */}
          <div className="bg-[#121915] border border-[#22C55E]/25 rounded-xl p-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-semibold text-sm text-[#22C55E]">With Mutex</h3>
                  <p className="text-[11px] font-mono text-[#8A8A8E] mt-0.5">
                    Serialized critical section lock
                  </p>
                </div>
                <button
                  onClick={handleRunWithMutex}
                  disabled={raceState.isRunning}
                  className="h-[38px] px-4 rounded-full border border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/15 disabled:opacity-40 text-xs font-sans font-medium active:scale-[0.97] transition-all focus-amber cursor-pointer"
                >
                  Run Safe Demo
                </button>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {WITH_MUTEX_STEPS.map((stepItem, idx) => {
                  const isCurrent =
                    raceState.mode === 'WITH_MUTEX' && raceState.stepIndex === idx + 1;
                  const isCompleted =
                    raceState.mode === 'WITH_MUTEX' && raceState.stepIndex > idx + 1;
                  return (
                    <div
                      key={stepItem.step}
                      className={`flex items-start gap-2.5 p-2 rounded transition-colors ${isCurrent
                          ? 'bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B]'
                          : isCompleted
                            ? 'text-[#F5F5F4]'
                            : 'text-[#66666A]'
                        }`}
                    >
                      <span className="font-bold shrink-0">{idx + 1}.</span>
                      <div className="min-w-0">
                        <span className="font-semibold text-white mr-1.5">{stepItem.actor}:</span>
                        <span>{stepItem.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[#232326] space-y-1.5">
              {withMutexDone ? (
                <div className="bg-[#122116] border border-[#22C55E]/40 p-2.5 rounded-lg flex items-center justify-between font-mono text-xs">
                  <span className="text-[#8A8A8E]">Final Shared State:</span>
                  <span className="text-[#22C55E] font-bold flex items-center gap-1.5">
                    ORD101 = READY
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                  </span>
                </div>
              ) : (
                <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg font-mono text-xs text-[#66666A] text-center">
                  Run demo to see result
                </div>
              )}
              <p className="text-[11px] font-mono text-[#8A8A8E] leading-relaxed">
                Mutual exclusion serialized the updates — valid transitions
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}