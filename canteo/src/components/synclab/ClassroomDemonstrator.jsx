import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createInitialCounterState,
  stepCounterSimulation,
  COUNTER_PRESETS,
} from '../../logic/counterEngine';
import DemonstrateTimeline from './DemonstrateTimeline';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  RefreshCw,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  ArrowRight,
  HelpCircle,
  Cpu,
  ChevronRight,
  Package,
} from 'lucide-react';

const DEMO_STAGES = {
  STAGE_1_QUESTION: 1,
  STAGE_2_UNLOCKED: 2,
  STAGE_3_PROVE: 3,
  STAGE_4_PROTECTED: 4,
  STAGE_5_TAKEAWAY: 5,
};

export default function ClassroomDemonstrator({ onNavigateToBuffer = () => {} }) {
  const [currentStage, setCurrentStage] = useState(DEMO_STAGES.STAGE_1_QUESTION);
  const [userPrediction, setUserPrediction] = useState(null); // null | 3 | 4 | 'SKIPPED'

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5x, 1x, 2x
  const playTimerRef = useRef(null);

  // Selected timeline event for inspection (Step number)
  const [selectedTimelineStep, setSelectedTimelineStep] = useState(null);

  // Engines
  // 1. Unlocked Run State (Stage 2 & 3)
  const [unlockedState, setUnlockedState] = useState(() =>
    createInitialCounterState({ withMutex: false, initialShared: 2 })
  );

  // 2. Protected Run State (Stage 4)
  const [protectedState, setProtectedState] = useState(() =>
    createInitialCounterState({ withMutex: true, initialShared: 2 })
  );

  const unlockedSchedule = COUNTER_PRESETS.LOST_UPDATE.schedule; // ['P1', 'P2', 'P1', 'P2', 'P1', 'P2']
  const protectedSchedule = COUNTER_PRESETS.PROTECTED.schedule; // ['P1', 'P2', 'P1', 'P1', 'P1', 'P1', 'P2', 'P2', 'P2', 'P2']

  // Stop auto playback
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  // Reset active run
  const handleResetRun = useCallback(() => {
    stopPlayback();
    if (currentStage === DEMO_STAGES.STAGE_4_PROTECTED) {
      setProtectedState(createInitialCounterState({ withMutex: true, initialShared: 2 }));
    } else {
      setUnlockedState(createInitialCounterState({ withMutex: false, initialShared: 2 }));
    }
    setSelectedTimelineStep(null);
  }, [currentStage, stopPlayback]);

  // Step 1 Instruction
  const handleStepInstruction = useCallback(() => {
    if (currentStage === DEMO_STAGES.STAGE_4_PROTECTED) {
      setProtectedState((prev) => {
        if (prev.isCompleted || prev.stepCounter >= protectedSchedule.length) {
          stopPlayback();
          return prev;
        }
        const nextThreadId = protectedSchedule[prev.stepCounter];
        const res = stepCounterSimulation(prev, nextThreadId);
        if (res.nextState.isCompleted || res.nextState.stepCounter >= protectedSchedule.length) {
          stopPlayback();
        }
        return res.nextState;
      });
    } else {
      setUnlockedState((prev) => {
        if (prev.isCompleted || prev.stepCounter >= unlockedSchedule.length) {
          stopPlayback();
          return prev;
        }
        const nextThreadId = unlockedSchedule[prev.stepCounter];
        const res = stepCounterSimulation(prev, nextThreadId);
        if (res.nextState.isCompleted || res.nextState.stepCounter >= unlockedSchedule.length) {
          stopPlayback();
        }
        return res.nextState;
      });
    }
  }, [currentStage, protectedSchedule, unlockedSchedule, stopPlayback]);

  // Replay this run from the beginning
  const handleReplayCurrentRun = useCallback(() => {
    handleResetRun();
    // Auto-start playback
    setTimeout(() => {
      setIsPlaying(true);
    }, 100);
  }, [handleResetRun]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      const delay = Math.max(300, 1000 / speed);
      playTimerRef.current = setInterval(() => {
        handleStepInstruction();
      }, delay);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, speed, handleStepInstruction]);

  // Active state based on current stage
  const activeState =
    currentStage === DEMO_STAGES.STAGE_4_PROTECTED ? protectedState : unlockedState;
  const activeSchedule =
    currentStage === DEMO_STAGES.STAGE_4_PROTECTED ? protectedSchedule : unlockedSchedule;

  // Selected event evidence object
  const activeEvents = activeState.events;
  const inspectedEvent =
    selectedTimelineStep !== null
      ? activeEvents.find((e) => e.step === selectedTimelineStep) || activeEvents[0]
      : activeEvents[0] || null;

  // Stage 2 Teaching Point: Step 2 interleaving
  const isInterleavingPointReached =
    currentStage === DEMO_STAGES.STAGE_2_UNLOCKED &&
    unlockedState.threads.P1.localRead === 2 &&
    unlockedState.threads.P2.localRead === 2 &&
    unlockedState.stepCounter === 2;

  return (
    <div className="space-y-4 font-sans text-left">
      {/* 1. STAGE PROGRESSION BREADCRUMBS */}
      <div className="bg-white border border-[#DDD9CF] rounded-2xl p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[
              { stage: DEMO_STAGES.STAGE_1_QUESTION, label: '1. The Question' },
              { stage: DEMO_STAGES.STAGE_2_UNLOCKED, label: '2. Run Unlocked' },
              { stage: DEMO_STAGES.STAGE_3_PROVE, label: '3. Prove the Cause' },
              { stage: DEMO_STAGES.STAGE_4_PROTECTED, label: '4. Run With Mutex' },
              { stage: DEMO_STAGES.STAGE_5_TAKEAWAY, label: '5. Key Takeaway' },
            ].map(({ stage, label }) => {
              const isActive = currentStage === stage;
              const isPast = currentStage > stage;

              return (
                <button
                  key={stage}
                  onClick={() => {
                    stopPlayback();
                    setCurrentStage(stage);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#172B3A] text-white shadow-2xs'
                      : isPast
                      ? 'bg-[#FAF9F5] text-[#087F8C] border border-[#DDD9CF] hover:bg-white'
                      : 'text-[#8C9BA5] hover:text-[#172B3A]'
                  }`}
                >
                  {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick link to Next Experiment: Bounded Buffer */}
          <button
            onClick={onNavigateToBuffer}
            className="text-xs font-bold text-[#087F8C] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Next: Bounded Buffer Experiment</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. STAGE 1: THE QUESTION */}
      {currentStage === DEMO_STAGES.STAGE_1_QUESTION && (
        <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#087F8C] bg-[#E1F2EF] px-2.5 py-0.5 rounded-full">
              Classroom Experiment
            </span>
            <h2 className="text-xl font-extrabold text-[#172B3A]">
              The Core Problem: Concurrent Increments Without Synchronization
            </h2>
            <p className="text-sm text-[#2D4554] leading-relaxed">
              Two producer threads (P1 and P2) each increment a shared counter once.
            </p>
          </div>

          {/* Setup Numbers Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF] space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#647480]">
                Initial Shared Value
              </span>
              <div className="text-3xl font-mono font-extrabold text-[#172B3A]">2</div>
              <p className="text-xs text-[#647480]">Before either thread begins.</p>
            </div>

            <div className="p-4 rounded-xl bg-[#F0F8F8] border border-[#A6D6D9] space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#087F8C]">
                Expected Final Math
              </span>
              <div className="text-3xl font-mono font-extrabold text-[#087F8C]">4</div>
              <p className="text-xs text-[#647480]">2 initial + 1 (P1) + 1 (P2) = 4.</p>
            </div>
          </div>

          {/* Interactive Prediction Prompt */}
          <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#DDD9CF] space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#087F8C]" />
              <h3 className="font-bold text-sm text-[#172B3A]">
                Prediction: What will the final value be without a mutex?
              </h3>
            </div>
            <p className="text-xs text-[#647480] leading-relaxed">
              If both threads run concurrently without any locking, what is the result? Make your prediction:
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => setUserPrediction(3)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userPrediction === 3
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white border border-[#DDD9CF] text-[#172B3A] hover:border-rose-400'
                }`}
              >
                Predict 3 (Update Lost)
              </button>
              <button
                onClick={() => setUserPrediction(4)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  userPrediction === 4
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white border border-[#DDD9CF] text-[#172B3A] hover:border-emerald-400'
                }`}
              >
                Predict 4 (Correct Result)
              </button>
              <button
                onClick={() => setUserPrediction('SKIPPED')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  userPrediction === 'SKIPPED'
                    ? 'bg-[#172B3A] text-white'
                    : 'text-[#647480] hover:text-[#172B3A]'
                }`}
              >
                Skip Prediction
              </button>
            </div>

            {userPrediction && (
              <div className="pt-2 text-xs font-medium text-[#087F8C]">
                {userPrediction === 'SKIPPED'
                  ? 'Prediction skipped. Let’s observe the real machine execution.'
                  : `Your prediction: ${userPrediction}. Let’s test it against deterministic OS execution.`}
              </div>
            )}
          </div>

          {/* Advance Button */}
          <div className="pt-2 flex justify-start">
            <button
              onClick={() => {
                if (!userPrediction) setUserPrediction('SKIPPED');
                setCurrentStage(DEMO_STAGES.STAGE_2_UNLOCKED);
              }}
              className="px-5 py-2.5 bg-[#172B3A] hover:bg-[#203a4e] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
            >
              <span>Begin Unlocked Execution (Stage 2)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. STAGE 2, 3, 4: MACHINE VISUALIZER & TEACHER CONTROL BAR */}
      {currentStage !== DEMO_STAGES.STAGE_1_QUESTION && currentStage !== DEMO_STAGES.STAGE_5_TAKEAWAY && (
        <div className="space-y-4">
          {/* STAGE HEADER & TEACHING INSTRUCTION */}
          <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#ECE9E1] text-[#172B3A] px-2 py-0.5 rounded">
                  {currentStage === DEMO_STAGES.STAGE_2_UNLOCKED
                    ? 'Stage 2: Unlocked Run'
                    : currentStage === DEMO_STAGES.STAGE_3_PROVE
                    ? 'Stage 3: Causal Proof'
                    : 'Stage 4: Mutex Protected Run'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    activeState.withMutex
                      ? 'bg-teal-100 text-teal-800 border border-teal-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {activeState.withMutex ? 'With Mutex (Protected)' : 'Without Mutex (Unsynchronized)'}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#172B3A] mt-1">
                {currentStage === DEMO_STAGES.STAGE_2_UNLOCKED &&
                  'Executing Real Unlocked Interleaving (Lost Update)'}
                {currentStage === DEMO_STAGES.STAGE_3_PROVE &&
                  'Inspecting the Proof: Stale Read Overwritten at Step #6'}
                {currentStage === DEMO_STAGES.STAGE_4_PROTECTED &&
                  'Executing Protected Schedule: Mutex Serializes Access'}
              </h3>
            </div>

            {/* Stage Navigation Advance Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {currentStage === DEMO_STAGES.STAGE_2_UNLOCKED && activeState.isCompleted && (
                <button
                  onClick={() => setCurrentStage(DEMO_STAGES.STAGE_3_PROVE)}
                  className="px-4 py-2 bg-[#087F8C] hover:bg-[#076b77] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Prove the Cause (Stage 3)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {currentStage === DEMO_STAGES.STAGE_3_PROVE && (
                <button
                  onClick={() => {
                    stopPlayback();
                    setCurrentStage(DEMO_STAGES.STAGE_4_PROTECTED);
                  }}
                  className="px-4 py-2 bg-[#172B3A] hover:bg-[#203a4e] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Run With Mutex (Stage 4)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              {currentStage === DEMO_STAGES.STAGE_4_PROTECTED && activeState.isCompleted && (
                <button
                  onClick={() => setCurrentStage(DEMO_STAGES.STAGE_5_TAKEAWAY)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>View Takeaway (Stage 5)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* TEACHER CONTROL BAR */}
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Play / Pause */}
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={activeState.isCompleted}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-[#172B3A] hover:bg-[#203a4e] text-white disabled:opacity-40'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
              </button>

              {/* Step 1 Instruction */}
              <button
                onClick={handleStepInstruction}
                disabled={isPlaying || activeState.isCompleted}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#DDD9CF] hover:border-[#087F8C] text-[#172B3A] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5 text-[#087F8C]" />
                <span>Step 1 Instruction</span>
              </button>

              {/* Reset */}
              <button
                onClick={handleResetRun}
                className="p-1.5 text-[#647480] hover:text-[#172B3A] hover:bg-[#ECE9E1] rounded-xl cursor-pointer"
                title="Reset this run"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Replay */}
              <button
                onClick={handleReplayCurrentRun}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#647480] hover:text-[#172B3A] hover:bg-[#ECE9E1] rounded-xl cursor-pointer"
                title="Replay from beginning"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replay</span>
              </button>

              {/* Speed */}
              <div className="flex items-center gap-1 border-l border-[#DDD9CF] pl-2 text-xs">
                {[0.5, 1, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold ${
                      speed === s
                        ? 'bg-[#172B3A] text-white'
                        : 'text-[#647480] hover:bg-[#ECE9E1]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Step Progress Badge */}
            <div className="flex items-center gap-3 text-xs">
              <div className="font-mono bg-white border border-[#DDD9CF] px-2.5 py-1 rounded-xl">
                <span className="text-[#647480]">Step </span>
                <span className="font-bold text-[#172B3A]">{activeState.stepCounter}</span>
                <span className="text-[#647480]"> / {activeSchedule.length}</span>
              </div>
              {activeState.isCompleted ? (
                activeState.shared === activeState.expectedFinal ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Result: {activeState.shared} (Math Verified)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3" /> Result: {activeState.shared} (Lost Update)
                  </span>
                )
              ) : (
                <span className="text-[11px] font-mono text-[#647480]">
                  Status: <span className="font-bold text-blue-700">Executing...</span>
                </span>
              )}
            </div>
          </div>

          {/* TEACHING POINT ALERT (Stage 2 Interleaving) */}
          {isInterleavingPointReached && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="uppercase tracking-wider">
                  Key Teaching Point: Simultaneous Stale Reads (Step #2)
                </span>
              </div>
              <p className="leading-relaxed">
                Both Thread P1 and Thread P2 have now copied the shared value <strong>(2)</strong> into their private CPU registers. Neither thread has written back yet.
                Because neither thread sees the other, both will compute <strong>3</strong>, and the second write will overwrite the first!
              </p>
            </div>
          )}

          {/* 4. THE MACHINE VISUALIZER: SHARED MEMORY & THREAD LANES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cell 1: Central Shared Memory & Mutex Lock */}
            <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#647480]">
                  Shared Memory
                </span>
                {activeState.withMutex ? (
                  activeState.mutex === 1 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> Mutex Free (1)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked by {activeState.mutexOwner}
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                    No Mutex Lock
                  </span>
                )}
              </div>

              {/* Big Memory Block */}
              <div className="flex flex-col items-center justify-center py-3 space-y-2">
                <div className="w-24 h-24 rounded-2xl bg-[#172B3A] text-white flex flex-col items-center justify-center shadow-md">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-300">
                    int shared
                  </span>
                  <span className="text-4xl font-extrabold font-mono text-[#087F8C]">
                    {activeState.shared}
                  </span>
                </div>
                <div className="text-center text-xs text-[#647480]">
                  Initial: <span className="font-bold font-mono text-[#172B3A]">{activeState.initialShared}</span> | Target: <span className="font-bold font-mono text-[#087F8C]">{activeState.expectedFinal}</span>
                </div>
              </div>

              {/* Mutex Wait Queue */}
              {activeState.withMutex && (
                <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-2.5 text-xs">
                  <span className="text-[10px] font-bold uppercase text-[#647480] block mb-1">
                    Mutex Contention Queue
                  </span>
                  {activeState.waitQueue.length === 0 ? (
                    <span className="text-[11px] text-[#8C9BA5] italic">Queue empty</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {activeState.waitQueue.map((tid) => (
                        <span
                          key={tid}
                          className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold text-xs"
                        >
                          {tid} (Blocked)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cell 2: Thread P1 Lane */}
            <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="font-bold text-sm text-[#172B3A]">Thread P1</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                  {activeState.threads.P1.status}
                </span>
              </div>

              {/* CPU Registers */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
                  Private CPU Registers
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF]">
                    <div className="text-[10px] text-[#647480]">localRead:</div>
                    <div className="text-base font-bold text-[#172B3A]">
                      {activeState.threads.P1.localRead ?? '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF]">
                    <div className="text-[10px] text-[#647480]">localComputed:</div>
                    <div className="text-base font-bold text-blue-600">
                      {activeState.threads.P1.localComputed ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dataflow Note */}
              <div className="text-[11px] text-[#647480] bg-[#FAF9F5] p-2 rounded-xl border border-[#DDD9CF]/60">
                <span>PC: {activeState.threads.P1.pc}</span> — {activeState.threads.P1.status === 'COMPLETED' ? 'Completed 1 cycle' : 'Active'}
              </div>
            </div>

            {/* Cell 3: Thread P2 Lane */}
            <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-sm text-[#172B3A]">Thread P2</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    activeState.threads.P2.status === 'BLOCKED'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {activeState.threads.P2.status}
                </span>
              </div>

              {/* CPU Registers */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#647480] block">
                  Private CPU Registers
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF]">
                    <div className="text-[10px] text-[#647480]">localRead:</div>
                    <div className="text-base font-bold text-[#172B3A]">
                      {activeState.threads.P2.localRead ?? '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF]">
                    <div className="text-[10px] text-[#647480]">localComputed:</div>
                    <div className="text-base font-bold text-emerald-600">
                      {activeState.threads.P2.localComputed ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dataflow Note */}
              <div className="text-[11px] text-[#647480] bg-[#FAF9F5] p-2 rounded-xl border border-[#DDD9CF]/60">
                <span>PC: {activeState.threads.P2.pc}</span> — {activeState.threads.P2.status === 'BLOCKED' ? 'Blocked on mutex' : activeState.threads.P2.status === 'COMPLETED' ? 'Completed 1 cycle' : 'Active'}
              </div>
            </div>
          </div>

          {/* 5. DETERMINISTIC THREAD TIMELINE */}
          <DemonstrateTimeline
            events={activeEvents}
            selectedStep={selectedTimelineStep}
            onSelectStep={(stepNum) => setSelectedTimelineStep(stepNum)}
            totalExpectedSteps={activeSchedule.length}
          />

          {/* 6. CONTEXTUAL EXECUTION EVIDENCE PANEL */}
          {inspectedEvent && (
            <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 text-xs text-left space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#087F8C]" />
                  <span className="font-bold text-[#172B3A]">
                    Execution Evidence for Step #{inspectedEvent.step} ({inspectedEvent.threadId}: {inspectedEvent.instruction})
                  </span>
                </div>
                {inspectedEvent.isLostUpdate && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    Clobbering Write
                  </span>
                )}
              </div>

              <p className="text-xs text-[#2D4554] leading-relaxed">
                {inspectedEvent.explanation}
              </p>

              {/* Before vs After Snapshots */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-[#DDD9CF] space-y-1 font-mono text-[11px]">
                  <span className="font-bold text-[#647480] text-[10px] uppercase block">
                    Before Instruction (Step #{inspectedEvent.step - 1})
                  </span>
                  <div>shared: <span className="font-bold text-[#172B3A]">{inspectedEvent.before?.shared}</span></div>
                  <div>localRead: <span className="font-bold text-[#172B3A]">{inspectedEvent.before?.localRead ?? 'null'}</span></div>
                  <div>localComputed: <span className="font-bold text-[#172B3A]">{inspectedEvent.before?.localComputed ?? 'null'}</span></div>
                </div>

                <div className="bg-[#F0F8F8] p-3 rounded-xl border border-[#A6D6D9] space-y-1 font-mono text-[11px]">
                  <span className="font-bold text-[#087F8C] text-[10px] uppercase block">
                    After Instruction (Step #{inspectedEvent.step})
                  </span>
                  <div>shared: <span className="font-bold text-[#087F8C]">{inspectedEvent.after?.shared}</span></div>
                  <div>localRead: <span className="font-bold text-[#087F8C]">{inspectedEvent.after?.localRead ?? 'null'}</span></div>
                  <div>localComputed: <span className="font-bold text-[#087F8C]">{inspectedEvent.after?.localComputed ?? 'null'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. STAGE 5: TAKEAWAY & SCORECARD */}
      {currentStage === DEMO_STAGES.STAGE_5_TAKEAWAY && (
        <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 shadow-xs space-y-6 text-left">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              Demonstration Complete
            </span>
            <h2 className="text-xl font-extrabold text-[#172B3A]">
              The Core Takeaway: What a Mutex Actually Does
            </h2>
            <p className="text-sm text-[#2D4554]">
              Here is what the real machine execution proved across both schedules:
            </p>
          </div>

          {/* Side-by-Side Comparison Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unlocked Scorecard */}
            <div className="p-5 rounded-2xl bg-[#FFF9F8] border-2 border-rose-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                  Run 1: Without Mutex
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  Lost Update
                </span>
              </div>
              <div className="text-4xl font-mono font-extrabold text-rose-700">
                {unlockedState.shared}
              </div>
              <p className="text-xs text-rose-950 leading-relaxed">
                Interleaved execution allowed both threads to read 2 before either wrote. P2 computed from the stale value and clobbered P1’s update.
              </p>
              <button
                onClick={() => {
                  setCurrentStage(DEMO_STAGES.STAGE_2_UNLOCKED);
                  handleReplayCurrentRun();
                }}
                className="text-xs font-bold text-rose-700 hover:underline flex items-center gap-1 cursor-pointer pt-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replay Unlocked Run</span>
              </button>
            </div>

            {/* Protected Scorecard */}
            <div className="p-5 rounded-2xl bg-[#F0FBF9] border-2 border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-900">
                  Run 2: With Mutex
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Math Verified (4)
                </span>
              </div>
              <div className="text-4xl font-mono font-extrabold text-[#087F8C]">
                {protectedState.shared}
              </div>
              <p className="text-xs text-teal-950 leading-relaxed">
                Binary mutex locked the critical section. When P2 attempted entry, it was queued. P2 read the fresh value (3) only after P1 committed and unlocked.
              </p>
              <button
                onClick={() => {
                  setCurrentStage(DEMO_STAGES.STAGE_4_PROTECTED);
                  handleReplayCurrentRun();
                }}
                className="text-xs font-bold text-[#087F8C] hover:underline flex items-center gap-1 cursor-pointer pt-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replay Protected Run</span>
              </button>
            </div>
          </div>

          {/* Golden Rule Callout */}
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#DDD9CF] space-y-1.5 text-xs text-[#172B3A]">
            <span className="font-bold text-[#087F8C] uppercase tracking-wider text-[11px] block">
              Key Classroom Principle
            </span>
            <p className="text-sm font-semibold leading-relaxed">
              &ldquo;A mutex prevents concurrent interleaving inside the read–modify–write critical section. It enforces sequential correctness — it does not make threads run faster.&rdquo;
            </p>
          </div>

          {/* Action to proceed to Bounded Buffer */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#DDD9CF] pt-4">
            <button
              onClick={() => {
                setCurrentStage(DEMO_STAGES.STAGE_1_QUESTION);
                handleResetRun();
              }}
              className="px-4 py-2 border border-[#DDD9CF] text-[#647480] hover:text-[#172B3A] rounded-xl text-xs font-bold cursor-pointer"
            >
              Restart Demonstration From Beginning
            </button>

            <button
              onClick={onNavigateToBuffer}
              className="px-5 py-2.5 bg-[#087F8C] hover:bg-[#076b77] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>Next Experiment: Bounded Buffer Synchronization</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
