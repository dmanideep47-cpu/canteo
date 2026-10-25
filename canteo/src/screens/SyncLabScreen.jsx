import { useReducer, useEffect, useRef } from 'react';
import { useApp } from '../app/AppContext';
import EventLog from '../components/EventLog';
import {
  raceConditionReducer,
  INITIAL_RACE_STATE,
  RACE_DEMO_ACTIONS,
  WITHOUT_MUTEX_STEPS,
  WITH_MUTEX_STEPS,
} from '../logic/raceConditionReducer';
import {
  Activity,
  Cpu,
  Lock,
  Unlock,
  RotateCcw,
  PlusCircle,
  Play,
  Layers,
  Info,
  AlertTriangle,
  CheckCircle2,
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

  useEffect(() => {
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    };
  }, []);

  const handleRunWithoutMutex = () => {
    if (raceState.isRunning) return;
    dispatchRace({ type: RACE_DEMO_ACTIONS.START_WITHOUT_MUTEX });

    let step = 0;
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);

    raceTimerRef.current = setInterval(() => {
      if (step < WITHOUT_MUTEX_STEPS.length) {
        dispatchRace({
          type: RACE_DEMO_ACTIONS.STEP_WITHOUT_MUTEX,
          payload: { index: step },
        });
        step++;
      } else {
        clearInterval(raceTimerRef.current);
      }
    }, 700);
  };

  const handleRunWithMutex = () => {
    if (raceState.isRunning) return;
    dispatchRace({ type: RACE_DEMO_ACTIONS.START_WITH_MUTEX });

    let step = 0;
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);

    raceTimerRef.current = setInterval(() => {
      if (step < WITH_MUTEX_STEPS.length) {
        dispatchRace({
          type: RACE_DEMO_ACTIONS.STEP_WITH_MUTEX,
          payload: { index: step },
        });
        step++;
      } else {
        clearInterval(raceTimerRef.current);
      }
    }, 650);
  };

  const handleResetRaceDemo = () => {
    if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    dispatchRace({ type: RACE_DEMO_ACTIONS.RESET_DEMO });
  };

  return (
    <div className="bg-[#0C0C0C] text-white min-h-[calc(100vh-45px)] p-6 sm:p-8 lg:p-10 space-y-8 max-w-full text-left">
      {/* Screen Header */}
      <header className="space-y-2 border-b border-[#222222] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#161616] border border-[#262626] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-[#D97706]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold font-body text-white tracking-tight">
                Sync Lab
              </h1>
              <p className="text-xs text-[#8C8C8C] mt-1 font-body">
                Educational bounded-buffer producer-consumer demonstration with counting semaphores and lock simulation.
              </p>
            </div>
          </div>

          <button
            onClick={resetSimulation}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#161616] hover:bg-[#222222] active:scale-[0.98] text-xs font-mono text-[#8C8C8C] hover:text-white transition-all border border-[#262626] focus:outline-none shrink-0 self-start sm:self-auto"
            aria-label="Reset simulation state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Simulation</span>
          </button>
        </div>
      </header>

      {/* Educational Note */}
      <div className="bg-[#141414] border border-[#222222] rounded-xl p-4 flex items-start gap-3 text-xs text-[#8C8C8C]">
        <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="font-semibold text-white">Educational Model:</span> Mutex is modelled educationally; see documentation for the real Java semaphore implementation. Single-threaded React reducers execute synchronously, so critical sections are stepped and logged explicitly.
        </p>
      </div>

      {/* Semaphore Instrument Panel: Unified #0C0C0C Panel with 48px Tabular Numbers */}
      <section aria-label="Semaphore Counters" className="space-y-3">
        <h2 className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#8C8C8C]">
          Active Counting Semaphores · Instrument Readout
        </h2>

        <div className="bg-[#121212] border border-[#222222] rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#222222] tabular-nums">
          {/* empty */}
          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#8C8C8C]">
                empty
              </span>
              <span className="text-[10px] font-mono text-[#6B6B6B] uppercase">Slots Free</span>
            </div>
            <div className="mt-6">
              <span className="text-[48px] font-semibold font-body leading-none text-white tracking-tight block">
                {state.empty}
              </span>
              <p className="text-[11px] text-[#6B6B6B] mt-2 font-mono">Available buffer capacity</p>
            </div>
          </div>

          {/* full */}
          <div className="p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#8C8C8C]">
                full
              </span>
              <span className="text-[10px] font-mono text-[#6B6B6B] uppercase">Occupied</span>
            </div>
            <div className="mt-6">
              <span className="text-[48px] font-semibold font-body leading-none text-white tracking-tight block">
                {state.full}
              </span>
              <p className="text-[11px] text-[#6B6B6B] mt-2 font-mono">Orders waiting in queue</p>
            </div>
          </div>

          {/* mutex */}
          <div
            className={`p-6 sm:p-8 flex flex-col justify-between transition-colors ${
              state.mutex === 1 ? 'bg-[#121212]' : 'bg-[#1A1010]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-mono uppercase tracking-[0.15em] ${
                  state.mutex === 1 ? 'text-[#D97706]' : 'text-[#EF4444]'
                }`}
              >
                mutex
              </span>
              {state.mutex === 1 ? (
                <Unlock className="w-4 h-4 text-[#D97706]" />
              ) : (
                <Lock className="w-4 h-4 text-[#EF4444]" />
              )}
            </div>
            <div className="mt-6">
              <span
                className={`text-[48px] font-semibold font-body leading-none tracking-tight block ${
                  state.mutex === 1 ? 'text-[#D97706]' : 'text-[#EF4444]'
                }`}
              >
                {state.mutex}
              </span>
              <p className="text-[11px] text-[#6B6B6B] mt-2 font-mono">
                {state.mutex === 1 ? 'Critical section free' : 'Critical section held'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Manual Simulation Controls */}
      <section aria-label="Simulation Controls" className="space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-wider text-[#6B6B6B]">
          Manual OS Simulation Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={simulateStudentOrder}
            className="p-4 bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] rounded-xl flex flex-col items-start gap-1.5 text-left transition-colors active:scale-[0.98] focus:outline-none"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-white font-body">
              <PlusCircle className="w-4 h-4 text-[#D97706]" />
              <span>Simulate Order</span>
            </div>
            <span className="text-[11px] text-[#6B6B6B] font-mono leading-tight">
              Producer: wait(empty) -&gt; CS -&gt; signal(full)
            </span>
          </button>

          <button
            onClick={takeOrder}
            className="p-4 bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] rounded-xl flex flex-col items-start gap-1.5 text-left transition-colors active:scale-[0.98] focus:outline-none"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-white font-body">
              <Play className="w-4 h-4 text-[#D97706] fill-current" />
              <span>Simulate Consumer</span>
            </div>
            <span className="text-[11px] text-[#6B6B6B] font-mono leading-tight">
              Consumer: wait(full) -&gt; CS -&gt; signal(empty)
            </span>
          </button>

          <button
            onClick={simulateQueueFull}
            className="p-4 bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] rounded-xl flex flex-col items-start gap-1.5 text-left transition-colors active:scale-[0.98] focus:outline-none"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-[#C0392B] font-body">
              <Layers className="w-4 h-4" />
              <span>Simulate Queue Full</span>
            </div>
            <span className="text-[11px] text-[#6B6B6B] font-mono leading-tight">
              Fills buffer to 5/5 &amp; blocks 6th producer
            </span>
          </button>

          <button
            onClick={resetSimulation}
            className="p-4 bg-[#141414] hover:bg-[#1A1A1A] border border-[#222222] rounded-xl flex flex-col items-start gap-1.5 text-left transition-colors active:scale-[0.98] focus:outline-none"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-[#8C8C8C] font-body">
              <RotateCcw className="w-4 h-4" />
              <span>Reset Simulation</span>
            </div>
            <span className="text-[11px] text-[#6B6B6B] font-mono leading-tight">
              Restore initial semaphores &amp; buffer
            </span>
          </button>
        </div>
      </section>

      {/* Race Condition Laboratory Section (Isolated Reducer) */}
      <section
        aria-label="Race Condition Demonstration"
        className="bg-[#111111] border border-[#222222] rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="border-b border-[#222222] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2 font-body">
              <Activity className="w-4 h-4 text-[#C0392B]" />
              Race Condition Demonstration
            </h2>
            <button
              onClick={handleResetRaceDemo}
              className="text-xs font-mono text-[#8C8C8C] hover:text-white underline self-start sm:self-auto"
            >
              Reset Race Demo
            </button>
          </div>
          <p className="text-xs text-[#8C8C8C] mt-1 leading-relaxed max-w-3xl">
            A race condition occurs when concurrent processes read and write shared state without mutual exclusion, causing outcomes to depend on arbitrary execution order.
          </p>
        </div>

        {/* Target Shared Order Indicator */}
        <div className="bg-[#161616] rounded-lg p-3.5 flex items-center justify-between border border-[#262626] font-mono text-xs">
          <div>
            <span className="text-[10px] uppercase text-[#6B6B6B] block">Target Resource</span>
            <span className="font-semibold text-white text-sm">ORD101 (Shared State)</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-[#6B6B6B] block">Current Status</span>
            <span
              className={`font-mono px-2.5 py-0.5 rounded text-xs ${
                raceState.orderState === 'READY'
                  ? 'text-[#D97706] bg-[#221808]'
                  : raceState.orderState === 'PREPARING'
                  ? 'text-white bg-[#222222]'
                  : 'text-white bg-[#222222]'
              }`}
            >
              {raceState.orderState}
            </span>
          </div>
        </div>

        {/* Worker Views & Lock Indicator */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-[#161616] rounded-lg p-3 border border-[#262626]">
            <span className="text-[10px] text-[#6B6B6B] block uppercase">Staff A View</span>
            <span className="font-semibold text-white text-xs mt-1 block truncate">
              {raceState.staffAView}
            </span>
          </div>
          <div className="bg-[#161616] rounded-lg p-3 border border-[#262626]">
            <span className="text-[10px] text-[#6B6B6B] block uppercase">Staff B View</span>
            <span className="font-semibold text-white text-xs mt-1 block truncate">
              {raceState.staffBView}
            </span>
          </div>
          <div className="bg-[#161616] rounded-lg p-3 border border-[#262626]">
            <span className="text-[10px] text-[#6B6B6B] block uppercase">Mutex Holder</span>
            <span className="font-semibold text-[#8C8C8C] text-xs mt-1 block truncate">
              {raceState.mutexHolder}
            </span>
          </div>
        </div>

        {/* Action Triggers: 48px Pill Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleRunWithoutMutex}
            disabled={raceState.isRunning}
            className="flex-1 h-12 rounded-full bg-[#1F1616] hover:bg-[#2A1E1E] border border-[#C0392B]/40 disabled:opacity-40 text-[#EF4444] font-medium text-xs transition-colors focus:outline-none"
          >
            Run Without Mutex (Expose Race Condition)
          </button>
          <button
            onClick={handleRunWithMutex}
            disabled={raceState.isRunning}
            className="flex-1 h-12 rounded-full bg-[#D97706] hover:bg-[#B45309] disabled:opacity-40 text-white font-medium text-xs transition-colors focus:outline-none shadow-xs"
          >
            Run With Mutex (Enforce Mutual Exclusion)
          </button>
        </div>

        {/* Deterministic Outcome Messages */}
        {raceState.outcomeType === 'error' && (
          <div className="bg-[#1C1111] border border-[#C0392B]/50 text-[#C0392B] p-4 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#C0392B]" />
              <span>Race condition detected: inconsistent order status.</span>
            </div>
            <p className="text-[11px] text-[#8C8C8C] leading-relaxed">
              Staff B performed a stale read of "WAITING" and overwrote the order directly to "READY", clobbering Staff A's concurrent transition.
            </p>
          </div>
        )}

        {raceState.outcomeType === 'success' && (
          <div className="bg-[#1A1408] border border-[#D97706]/40 text-[#D97706] p-4 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#D97706]" />
              <span>Mutual exclusion enforced. Valid state transitions preserved.</span>
            </div>
            <p className="text-[11px] text-[#A3A3A3] leading-relaxed">
              Serialized critical sections guaranteed that Staff B only observed the order after Staff A finished and released the lock.
            </p>
          </div>
        )}

        {/* Execution Log */}
        {raceState.stepsLog.length > 0 && (
          <div className="space-y-2 bg-[#161616] rounded-xl p-4 border border-[#262626] font-mono text-xs">
            <span className="text-[10px] text-[#6B6B6B] uppercase block pb-1 border-b border-[#262626]">
              Interleaving Trace ({raceState.mode})
            </span>
            {raceState.stepsLog.map((st, sIdx) => (
              <div key={sIdx} className="flex items-start gap-2.5 pt-1 text-[#8C8C8C]">
                <span className="text-white font-semibold shrink-0">Step {st.step}:</span>
                <span className="text-white font-medium">[{st.actor}]</span>
                <span className="text-[#CCCCCC]">{st.description}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live Event Log */}
      <section aria-label="Event Log">
        <EventLog events={state.events} />
      </section>
    </div>
  );
}
