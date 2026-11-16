import { useState, useEffect, useRef } from 'react';
import {
  LOST_UPDATE_WITHOUT_MUTEX_STEPS,
  LOST_UPDATE_WITH_MUTEX_STEPS,
} from '../../logic/lostUpdateEngine';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, SkipForward } from 'lucide-react';

export default function LostUpdateArena() {
  const [mode, setMode] = useState(null); // 'WITHOUT_MUTEX' | 'WITH_MUTEX'
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  const steps = mode === 'WITH_MUTEX' ? LOST_UPDATE_WITH_MUTEX_STEPS : LOST_UPDATE_WITHOUT_MUTEX_STEPS;
  const currentStep = stepIndex > 0 ? steps[stepIndex - 1] : null;

  const sharedValue = currentStep ? currentStep.shared : 2;
  const p1Value = currentStep ? currentStep.localP1 : null;
  const p2Value = currentStep ? currentStep.localP2 : null;
  const mutexOwner = currentStep ? currentStep.mutexOwner : null;
  const isFinished = stepIndex >= steps.length;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleStartDemo = (selectedMode) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setMode(selectedMode);
    setStepIndex(0);
    setIsRunning(true);

    const targetSteps =
      selectedMode === 'WITH_MUTEX'
        ? LOST_UPDATE_WITH_MUTEX_STEPS
        : LOST_UPDATE_WITHOUT_MUTEX_STEPS;

    let current = 0;
    timerRef.current = setInterval(() => {
      current++;
      setStepIndex(current);
      if (current >= targetSteps.length) {
        clearInterval(timerRef.current);
        setIsRunning(false);
      }
    }, 450);
  };

  const handleStepOnce = (selectedMode) => {
    if (isRunning) return;
    const targetSteps =
      selectedMode === 'WITH_MUTEX'
        ? LOST_UPDATE_WITH_MUTEX_STEPS
        : LOST_UPDATE_WITHOUT_MUTEX_STEPS;

    if (mode !== selectedMode) {
      setMode(selectedMode);
      setStepIndex(1);
    } else {
      if (stepIndex < targetSteps.length) {
        setStepIndex((prev) => prev + 1);
      }
    }
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setStepIndex(0);
    setMode(null);
  };

  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 sm:p-8 space-y-6 text-left shadow-xs font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DDD9CF]">
        <div>
          <h2 className="font-sans font-bold text-lg text-[#172B3A] flex items-center gap-2">
            <span>Race Condition Experiment: The Lost Update Problem</span>
          </h2>
          <p className="text-xs text-[#647480] mt-0.5 font-mono">
            Comparing unsynchronized concurrent read-modify-write against serialized mutex protection
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-3.5 py-1.5 rounded-xl border border-[#DDD9CF] hover:bg-[#F6F4EE] text-xs font-sans font-medium text-[#172B3A] transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo</span>
        </button>
      </div>

      {/* Explanatory Banner */}
      <div className="bg-[#F6F4EE] border border-[#DDD9CF] rounded-xl p-4 text-xs font-sans text-[#172B3A] leading-relaxed">
        <strong className="text-[#172B3A]">Conceptual Foundation:</strong> An increment operation{' '}
        <code>counter++</code> is not atomic at the CPU instruction level. It decomposes into:
        <span className="text-[#087F8C] font-semibold"> (1) Read shared counter into register</span>,{' '}
        <span className="text-[#B77912] font-semibold">(2) Compute register + 1</span>, and{' '}
        <span className="text-[#E98570] font-semibold">(3) Write result back to shared memory</span>. Without a
        mutex, interleaving causes one thread to overwrite the other, resulting in a{' '}
        <strong>lost update</strong>.
      </div>

      {/* Shared Register Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans text-center">
        <div className="bg-[#F6F4EE] border border-[#DDD9CF] p-4 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono text-[#647480] font-semibold tracking-wider block">
            Shared Memory Counter
          </span>
          <span className="text-3xl font-bold font-mono text-[#172B3A] tabular-nums">{sharedValue}</span>
          <span className="text-[10px] font-mono text-[#647480] block">Initial: 2</span>
        </div>

        <div className="bg-[#F6F4EE] border border-[#DDD9CF] p-4 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono text-[#647480] font-semibold tracking-wider block">
            P1 Local Register
          </span>
          <span className="text-3xl font-bold font-mono text-[#E98570] tabular-nums">
            {p1Value !== null ? p1Value : '—'}
          </span>
          <span className="text-[10px] font-mono text-[#647480] block">Producer 1</span>
        </div>

        <div className="bg-[#F6F4EE] border border-[#DDD9CF] p-4 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono text-[#647480] font-semibold tracking-wider block">
            P2 Local Register
          </span>
          <span className="text-3xl font-bold font-mono text-[#087F8C] tabular-nums">
            {p2Value !== null ? p2Value : '—'}
          </span>
          <span className="text-[10px] font-mono text-[#647480] block">Producer 2</span>
        </div>

        <div className="bg-[#F6F4EE] border border-[#DDD9CF] p-4 rounded-xl space-y-1">
          <span className="text-[10px] uppercase font-mono text-[#647480] font-semibold tracking-wider block">
            Mutex Owner
          </span>
          <span
            className={`text-2xl font-bold font-mono mt-1 block ${
              mutexOwner ? 'text-[#BC4141]' : 'text-[#237A57]'
            }`}
          >
            {mutexOwner ? mutexOwner : 'Free'}
          </span>
          <span className="text-[10px] font-mono text-[#647480] block">Lock State</span>
        </div>
      </div>

      {/* Dual Column Stepper: Without Mutex vs With Mutex */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Scenario 1: Without Mutex */}
        <div
          className={`border rounded-2xl p-5 space-y-4 transition-all ${
            mode === 'WITHOUT_MUTEX'
              ? 'border-[#BC4141] bg-[#FBEAEA]/30'
              : 'border-[#DDD9CF] bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-sans font-bold text-sm text-[#BC4141]">
                <ShieldAlert className="w-4 h-4" />
                <span>Execution Without Mutex</span>
              </div>
              <p className="text-xs text-[#647480] mt-0.5">
                Unsynchronized interleaved reads & writes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStepOnce('WITHOUT_MUTEX')}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg border border-[#DDD9CF] text-[#172B3A] hover:bg-white disabled:opacity-40 font-sans text-xs flex items-center gap-1 cursor-pointer"
                title="Step single instruction"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Step</span>
              </button>
              <button
                onClick={() => handleStartDemo('WITHOUT_MUTEX')}
                disabled={isRunning}
                className="px-3.5 py-1 rounded-lg bg-[#BC4141] text-white hover:bg-[#A33434] disabled:opacity-40 font-sans text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Demo</span>
              </button>
            </div>
          </div>

          {/* Stepper list */}
          <div className="space-y-1.5 font-mono text-xs">
            {LOST_UPDATE_WITHOUT_MUTEX_STEPS.map((s, idx) => {
              const isCurrent = mode === 'WITHOUT_MUTEX' && stepIndex === idx + 1;
              const isPast = mode === 'WITHOUT_MUTEX' && stepIndex > idx + 1;

              return (
                <div
                  key={`without-mutex-${s.step}`}
                  className={`p-2 rounded-lg flex items-start gap-2 transition-all ${
                    isCurrent
                      ? 'bg-white border border-[#BC4141] text-[#172B3A] font-semibold shadow-xs'
                      : isPast
                        ? 'text-[#647480] bg-[#F6F4EE]'
                        : 'text-[#A0AAB2]'
                  }`}
                >
                  <span className="font-bold select-none shrink-0 w-4">{idx + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[#E98570] font-semibold mr-1.5">[{s.threadId}]</span>
                    <span>{s.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Result Outcome */}
          {mode === 'WITHOUT_MUTEX' && isFinished && (
            <div className="bg-[#FBEAEA] border border-[#BC4141] p-3.5 rounded-xl text-xs font-sans space-y-1 text-[#BC4141]">
              <div className="flex items-center justify-between font-bold">
                <span>Final Shared Counter: 3</span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Lost Update Occurred
                </span>
              </div>
              <p className="text-[11px] text-[#647480] leading-relaxed">
                Expected 4 (2 initial + 1 + 1), but counter ended at 3. P1&apos;s increment was completely
                overwritten because P2 read a stale copy of the counter before P1 committed.
              </p>
            </div>
          )}
        </div>

        {/* Scenario 2: With Mutex */}
        <div
          className={`border rounded-2xl p-5 space-y-4 transition-all ${
            mode === 'WITH_MUTEX'
              ? 'border-[#087F8C] bg-[#E1F2EF]/30'
              : 'border-[#DDD9CF] bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 font-sans font-bold text-sm text-[#087F8C]">
                <ShieldCheck className="w-4 h-4" />
                <span>Execution With Mutex</span>
              </div>
              <p className="text-xs text-[#647480] mt-0.5">
                Mutual exclusion serializes the critical section
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStepOnce('WITH_MUTEX')}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg border border-[#DDD9CF] text-[#172B3A] hover:bg-white disabled:opacity-40 font-sans text-xs flex items-center gap-1 cursor-pointer"
                title="Step single instruction"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Step</span>
              </button>
              <button
                onClick={() => handleStartDemo('WITH_MUTEX')}
                disabled={isRunning}
                className="px-3.5 py-1 rounded-lg bg-[#087F8C] text-white hover:bg-[#076B76] disabled:opacity-40 font-sans text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Demo</span>
              </button>
            </div>
          </div>

          {/* Stepper list */}
          <div className="space-y-1.5 font-mono text-xs max-h-[310px] overflow-y-auto pr-1">
            {LOST_UPDATE_WITH_MUTEX_STEPS.map((s, idx) => {
              const isCurrent = mode === 'WITH_MUTEX' && stepIndex === idx + 1;
              const isPast = mode === 'WITH_MUTEX' && stepIndex > idx + 1;

              return (
                <div
                  key={`with-mutex-${s.step}`}
                  className={`p-2 rounded-lg flex items-start gap-2 transition-all ${
                    isCurrent
                      ? 'bg-white border border-[#087F8C] text-[#172B3A] font-semibold shadow-xs'
                      : isPast
                        ? 'text-[#647480] bg-[#F6F4EE]'
                        : 'text-[#A0AAB2]'
                  }`}
                >
                  <span className="font-bold select-none shrink-0 w-4">{idx + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[#087F8C] font-semibold mr-1.5">[{s.threadId}]</span>
                    <span>{s.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Result Outcome */}
          {mode === 'WITH_MUTEX' && isFinished && (
            <div className="bg-[#E6F3EA] border border-[#237A57] p-3.5 rounded-xl text-xs font-sans space-y-1 text-[#237A57]">
              <div className="flex items-center justify-between font-bold">
                <span>Final Shared Counter: 4</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Correct Mathematical Result
                </span>
              </div>
              <p className="text-[11px] text-[#647480] leading-relaxed">
                Mutex serialized the read-modify-write transitions. P2 was forced to wait until P1
                finished writing 3, so P2 read the fresh value and correctly committed 4.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
