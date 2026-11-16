import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createInitialCounterState,
  stepCounterSimulation,
  COUNTER_PRESETS,
  COUNTER_INSTRUCTIONS_WITHOUT_MUTEX,
  COUNTER_INSTRUCTIONS_WITH_MUTEX,
} from '../../logic/counterEngine';
import {
  Lock,
  Unlock,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

/**
 * Derives a single, crystal-clear classroom sentence from engine state and step index.
 */
function getWhatJustHappenedSentence(state, withMutex, scheduleIndex, lastThreadId) {
  if (scheduleIndex === 0 || !lastThreadId) {
    return withMutex
      ? "Ready. P1 and P2 will use a mutex to take turns safely."
      : "Ready. P1 and P2 will try to increment the counter without synchronization.";
  }

  if (state.isCompleted) {
    if (state.shared === state.expectedFinal) {
      return "Finished! Both increments were preserved: 2 + 1 + 1 = 4. The mutex protected each turn.";
    } else {
      return `Finished! Counter ended at ${state.shared} instead of ${state.expectedFinal}. P2 overwrote P1's increment!`;
    }
  }

  // Without Mutex Explanations
  if (!withMutex) {
    switch (scheduleIndex) {
      case 1:
        return "P1 read 2 from the shared counter into its private local copy.";
      case 2:
        return "P2 also read 2 from the shared counter before P1 could write its update!";
      case 3:
        return "P1 calculated local increment: 2 + 1 = 3.";
      case 4:
        return "P2 calculated local increment: 2 + 1 = 3 using its stale copy of 2.";
      case 5:
        return "P1 wrote 3 to the shared counter.";
      case 6:
        return "P2 wrote 3, overwriting P1's update. One increment was lost!";
      default:
        break;
    }
  }

  // With Mutex Explanations
  if (withMutex) {
    switch (scheduleIndex) {
      case 1:
        return "P1 acquired the mutex lock and entered the exclusive critical section.";
      case 2:
        return "P2 tried to enter, but the mutex was locked by P1. P2 is waiting.";
      case 3:
        return "P1 read 2 from the shared counter inside the critical section.";
      case 4:
        return "P1 calculated local increment: 2 + 1 = 3.";
      case 5:
        return "P1 wrote 3 to the shared counter.";
      case 6:
        return "P1 finished and released the mutex. Ownership handed directly to waiting P2.";
      case 7:
        return "P2 enters and reads 3 from the shared counter (the fresh, updated value!).";
      case 8:
        return "P2 calculated local increment: 3 + 1 = 4.";
      case 9:
        return "P2 wrote 4 to the shared counter.";
      case 10:
        return "P2 finished and unlocked the mutex. Mutex is now free.";
      default:
        break;
    }
  }

  // Fallback to latest event explanation from engine
  const lastEvent = state.events[0];
  return lastEvent?.explanation || `${lastThreadId} executed an instruction.`;
}

export default function SimpleMutexDemo() {
  // Mode: false = Without Mutex (LOST_UPDATE preset), true = With Mutex (PROTECTED preset)
  const [withMutex, setWithMutex] = useState(false);

  // Engine state initialized to 2
  const [state, setState] = useState(() =>
    createInitialCounterState({ withMutex: false, initialShared: 2 })
  );

  // Active schedule index (0 to schedule.length)
  const [scheduleIndex, setScheduleIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastThreadId, setLastThreadId] = useState(null);

  const timerRef = useRef(null);

  const activePreset = withMutex ? COUNTER_PRESETS.PROTECTED : COUNTER_PRESETS.LOST_UPDATE;
  const schedule = activePreset.schedule;

  // Stop playback timer
  const stopPlayback = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  // Step 1 action forward through the authoritative schedule
  const handleStep = useCallback(() => {
    if (scheduleIndex >= schedule.length || state.isCompleted) {
      stopPlayback();
      return;
    }

    const nextThreadId = schedule[scheduleIndex];
    const result = stepCounterSimulation(state, nextThreadId);

    if (result.executed) {
      setState(result.nextState);
      setScheduleIndex((prev) => prev + 1);
      setLastThreadId(nextThreadId);

      if (result.nextState.isCompleted || scheduleIndex + 1 >= schedule.length) {
        stopPlayback();
      }
    } else {
      // If thread was blocked or cannot step, advance index or stop
      stopPlayback();
    }
  }, [scheduleIndex, schedule, state, stopPlayback]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      if (scheduleIndex >= schedule.length || state.isCompleted) {
        // Restart if already finished
        const fresh = createInitialCounterState({ withMutex, initialShared: 2 });
        setState(fresh);
        setScheduleIndex(0);
        setLastThreadId(null);
      }
      setIsPlaying(true);
    }
  };

  // Playback timer effect (comfortable 1200ms step interval for classroom viewing)
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        handleStep();
      }, 1250);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, handleStep]);

  // Reset to beginning
  const handleReset = () => {
    stopPlayback();
    setState(createInitialCounterState({ withMutex, initialShared: 2 }));
    setScheduleIndex(0);
    setLastThreadId(null);
  };

  // Mode change (Without Mutex <-> With Mutex)
  const handleModeChange = (modeWithMutex) => {
    stopPlayback();
    setWithMutex(modeWithMutex);
    setState(createInitialCounterState({ withMutex: modeWithMutex, initialShared: 2 }));
    setScheduleIndex(0);
    setLastThreadId(null);
  };

  // Current explanation
  const currentSentence = getWhatJustHappenedSentence(state, withMutex, scheduleIndex, lastThreadId);

  const instructions = withMutex
    ? COUNTER_INSTRUCTIONS_WITH_MUTEX
    : COUNTER_INSTRUCTIONS_WITHOUT_MUTEX;

  const p1 = state.threads.P1;
  const p2 = state.threads.P2;

  // Determine current action status for each thread
  const getThreadActionText = (thread) => {
    if (thread.status === 'COMPLETED') return 'Completed';
    if (thread.status === 'BLOCKED') return 'Waiting for mutex...';
    if (scheduleIndex === 0) return 'Ready';

    const currentInst = instructions[thread.pc];
    if (!currentInst) return 'Ready';

    if (currentInst.op === 'LOCK') return 'Requesting Lock';
    if (currentInst.op === 'READ') return 'Reading shared memory';
    if (currentInst.op === 'COMPUTE') return 'Calculating (local + 1)';
    if (currentInst.op === 'WRITE') return 'Writing to shared memory';
    if (currentInst.op === 'UNLOCK') return 'Releasing lock';
    return currentInst.label;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ======================================================== */}
      {/* AREA 1: Title & Question                                  */}
      {/* ======================================================== */}
      <header className="bg-white rounded-2xl border border-[#E5E2DD] p-6 shadow-xs text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold uppercase tracking-wider">
          Classroom Synchronization Demonstration
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
          Why do we need a mutex?
        </h1>
        <p className="text-base sm:text-lg text-[#5E5E5E] max-w-2xl mx-auto">
          P1 and P2 each add 1 to the same shared counter.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-1 text-sm font-medium">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E5E2DD] text-[#111111]">
            <span className="text-[#5E5E5E]">Starting Value:</span>
            <span className="font-mono font-bold text-base text-blue-700">2</span>
          </div>
          <ArrowRight className="w-4 h-4 text-[#5E5E5E] hidden sm:inline" />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E5E2DD] text-[#111111]">
            <span className="text-[#5E5E5E]">Expected Final:</span>
            <span className="font-mono font-bold text-base text-emerald-700">4</span>
            <span className="text-xs text-[#5E5E5E] font-normal">(2 + 1 + 1)</span>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* AREA 2: The Main Visual                                   */}
      {/* ======================================================== */}
      <section className="bg-white rounded-2xl border border-[#E5E2DD] p-6 sm:p-8 shadow-xs">
        {/* Central Memory & Mutex State */}
        <div className="max-w-md mx-auto mb-8">
          <div className="p-6 rounded-2xl bg-[#FAF7F2] border-2 border-[#E5E2DD] text-center shadow-xs relative">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5E5E5E] block mb-1">
              Shared Memory Counter
            </span>
            <div className="text-6xl font-black font-mono text-[#111111] tracking-tight tabular-nums my-2">
              {state.shared}
            </div>

            {/* Mutex State Pill (shown only when in With Mutex mode) */}
            {withMutex ? (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all">
                {state.mutexOwner ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full animate-pulse">
                    <Lock className="w-4 h-4 text-amber-700" />
                    Mutex: Locked by {state.mutexOwner}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full">
                    <Unlock className="w-4 h-4 text-emerald-700" />
                    Mutex: Free (Unlocked)
                  </span>
                )}
                {state.waitQueue.length > 0 && (
                  <span className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-medium">
                    Queue: {state.waitQueue.join(', ')}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                Unprotected (No Mutex)
              </div>
            )}
          </div>
        </div>

        {/* Two Thread Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thread P1 */}
          <div
            className={`rounded-xl border p-5 transition-all ${
              lastThreadId === 'P1' && !state.isCompleted
                ? 'border-blue-500 bg-blue-50/30 ring-2 ring-blue-100'
                : 'border-[#E5E2DD] bg-[#FAF7F2]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DD]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
                <h2 className="text-lg font-bold text-[#111111]">Thread 1 (P1)</h2>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  p1.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : p1.status === 'BLOCKED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                    : lastThreadId === 'P1' && !state.isCompleted
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-white text-[#5E5E5E] border border-[#E5E2DD]'
                }`}
              >
                {getThreadActionText(p1)}
              </span>
            </div>

            {/* P1 Local Registers */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-white p-3 rounded-lg border border-[#E5E2DD] text-center">
                <span className="text-xs text-[#5E5E5E] block">Local Read</span>
                <span className="text-2xl font-mono font-bold text-blue-700">
                  {p1.localRead !== null ? p1.localRead : '—'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#E5E2DD] text-center">
                <span className="text-xs text-[#5E5E5E] block">Local Computed</span>
                <span className="text-2xl font-mono font-bold text-blue-700">
                  {p1.localComputed !== null ? p1.localComputed : '—'}
                </span>
              </div>
            </div>

            {/* P1 Instructions list (only active step highlighted) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-[#5E5E5E] uppercase tracking-wider block mb-1">
                Steps
              </span>
              {instructions.map((inst, idx) => {
                const isCurrent = p1.status !== 'COMPLETED' && p1.pc === idx;
                const isPast = p1.pc > idx || p1.status === 'COMPLETED';

                return (
                  <div
                    key={inst.step}
                    className={`text-xs px-3 py-2 rounded-lg font-mono transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : isPast
                        ? 'bg-white text-slate-400 border border-[#E5E2DD]'
                        : 'bg-white/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <span>
                      {idx + 1}. {inst.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase">
                        Current
                      </span>
                    )}
                    {isPast && <span className="text-emerald-500 font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Thread P2 */}
          <div
            className={`rounded-xl border p-5 transition-all ${
              lastThreadId === 'P2' && !state.isCompleted
                ? 'border-teal-500 bg-teal-50/30 ring-2 ring-teal-100'
                : 'border-[#E5E2DD] bg-[#FAF7F2]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DD]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-teal-600 inline-block" />
                <h2 className="text-lg font-bold text-[#111111]">Thread 2 (P2)</h2>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  p2.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : p2.status === 'BLOCKED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                    : lastThreadId === 'P2' && !state.isCompleted
                    ? 'bg-teal-100 text-teal-800 border border-teal-300'
                    : 'bg-white text-[#5E5E5E] border border-[#E5E2DD]'
                }`}
              >
                {getThreadActionText(p2)}
              </span>
            </div>

            {/* P2 Local Registers */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-white p-3 rounded-lg border border-[#E5E2DD] text-center">
                <span className="text-xs text-[#5E5E5E] block">Local Read</span>
                <span className="text-2xl font-mono font-bold text-teal-700">
                  {p2.localRead !== null ? p2.localRead : '—'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#E5E2DD] text-center">
                <span className="text-xs text-[#5E5E5E] block">Local Computed</span>
                <span className="text-2xl font-mono font-bold text-teal-700">
                  {p2.localComputed !== null ? p2.localComputed : '—'}
                </span>
              </div>
            </div>

            {/* Waiting callout banner if P2 is blocked */}
            {p2.status === 'BLOCKED' && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>P2 is waiting for the mutex to be unlocked by P1.</span>
              </div>
            )}

            {/* P2 Instructions list (only active step highlighted) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-semibold text-[#5E5E5E] uppercase tracking-wider block mb-1">
                Steps
              </span>
              {instructions.map((inst, idx) => {
                const isCurrent = p2.status !== 'COMPLETED' && p2.pc === idx;
                const isPast = p2.pc > idx || p2.status === 'COMPLETED';

                return (
                  <div
                    key={inst.step}
                    className={`text-xs px-3 py-2 rounded-lg font-mono transition-all flex items-center justify-between ${
                      isCurrent
                        ? p2.status === 'BLOCKED'
                          ? 'bg-amber-600 text-white font-bold shadow-xs'
                          : 'bg-teal-600 text-white font-bold shadow-xs'
                        : isPast
                        ? 'bg-white text-slate-400 border border-[#E5E2DD]'
                        : 'bg-white/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <span>
                      {idx + 1}. {inst.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase">
                        {p2.status === 'BLOCKED' ? 'Blocked' : 'Current'}
                      </span>
                    )}
                    {isPast && <span className="text-emerald-500 font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* AREA 3: The Controls (Minimal & Obvious - Only 5 controls) */}
      {/* ======================================================== */}
      <section className="bg-white rounded-2xl border border-[#E5E2DD] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Mode Toggle: Without Mutex vs With Mutex */}
        <div className="inline-flex rounded-xl p-1 bg-[#FAF7F2] border border-[#E5E2DD]">
          <button
            type="button"
            onClick={() => handleModeChange(false)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              !withMutex
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-[#5E5E5E] hover:text-[#111111]'
            }`}
          >
            Without Mutex (Race)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              withMutex
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[#5E5E5E] hover:text-[#111111]'
            }`}
          >
            With Mutex (Protected)
          </button>
        </div>

        {/* Action Controls: Step, Play/Pause, Reset */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStep}
            disabled={isPlaying || state.isCompleted}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E5E2DD] text-sm font-semibold text-[#111111] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            title="Advance one action"
          >
            <SkipForward className="w-4 h-4 text-blue-600" />
            <span>Step</span>
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={state.isCompleted && scheduleIndex >= schedule.length}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-xs ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#111111] hover:bg-black'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isPlaying ? 'Pause simulation' : 'Play simulation automatically'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5E2DD] text-sm font-medium text-[#5E5E5E] hover:text-[#111111] hover:bg-slate-50 transition-all shadow-xs"
            title="Reset to initial state"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </section>

      {/* ======================================================== */}
      {/* AREA 4: What Just Happened (One Sentence)                 */}
      {/* ======================================================== */}
      <section className="bg-white rounded-2xl border border-[#E5E2DD] p-6 shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#5E5E5E] block">
          What Just Happened
        </span>

        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E2DD] flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <p className="text-base sm:text-lg font-medium text-[#111111] leading-relaxed">
            {currentSentence}
          </p>
        </div>

        {/* Completion Result Banner */}
        {state.isCompleted && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 mt-3 ${
              state.shared === state.expectedFinal
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            {state.shared === state.expectedFinal ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm sm:text-base">
                {state.shared === state.expectedFinal
                  ? `Success: Final Counter = ${state.shared} (Matches Expected: ${state.expectedFinal})`
                  : `Race Condition: Final Counter = ${state.shared} (Expected: ${state.expectedFinal})`}
              </div>
              <div className="text-xs sm:text-sm text-[#5E5E5E] mt-1">
                {state.shared === state.expectedFinal
                  ? 'With the mutex lock in place, each thread had exclusive access to read and update the counter. No work was lost.'
                  : "Without a mutex, both threads read the counter at 2 before either wrote back. P2 calculated 2 + 1 = 3 and overwrote P1's work, losing 1 increment."}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

