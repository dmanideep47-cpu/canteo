import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createInitialComparison,
  stepComparisonTurn,
  evaluateComparisonInvariants,
  COMPARISON_EXPERIMENTS,
} from '../../logic/comparisonEngine';
import { COUNTER_PRESETS } from '../../logic/counterEngine';
import { BUFFER_COMPARISON_PRESETS } from '../../logic/syncLabEngine';
import CounterVisualizer from './CounterVisualizer';
import BufferComparisonDiagram from './BufferComparisonDiagram';
import LiveVerificationPanel from './LiveVerificationPanel';
import EventEvidenceModal from './EventEvidenceModal';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
} from 'lucide-react';

export default function ComparisonWorkspace({ initialExperiment = COMPARISON_EXPERIMENTS.COUNTER, initialPresetId = null }) {
  const [experimentType, setExperimentType] = useState(initialExperiment);
  const [presetId, setPresetId] = useState(() => initialPresetId || (initialExperiment === COMPARISON_EXPERIMENTS.BUFFER ? 'RACE_COLLISION' : 'LOST_UPDATE'));
  const [pauseAtFirstFault, setPauseAtFirstFault] = useState(true);
  const [viewMode, setViewMode] = useState('DUAL'); // 'DUAL' | 'LEFT' | 'RIGHT'

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playIntervalRef = useRef(null);

  // Modal inspection receipt state
  const [activeReceipt, setActiveReceipt] = useState(null);

  // Comparison Engine State
  const [compState, setCompState] = useState(() =>
    createInitialComparison(
      initialExperiment,
      initialPresetId || (initialExperiment === COMPARISON_EXPERIMENTS.BUFFER ? 'RACE_COLLISION' : 'LOST_UPDATE'),
      { pauseAtFirstFault: true }
    )
  );

  // Reset comparison
  const handleReset = useCallback(
    (exp = experimentType, pid = presetId) => {
      setIsPlaying(false);
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      const newState = createInitialComparison(exp, pid, { pauseAtFirstFault });
      setCompState(newState);
    },
    [experimentType, presetId, pauseAtFirstFault]
  );

  // Switch experiment
  const handleExperimentChange = (newExp) => {
    setExperimentType(newExp);
    const defaultPreset =
      newExp === COMPARISON_EXPERIMENTS.COUNTER ? 'LOST_UPDATE' : 'RACE_COLLISION';
    setPresetId(defaultPreset);
    handleReset(newExp, defaultPreset);
  };

  // Switch preset
  const handlePresetChange = (newPid) => {
    setPresetId(newPid);
    handleReset(experimentType, newPid);
  };

  // Step synchronized comparison turn
  const handleStepTurn = useCallback(() => {
    setCompState((prev) => {
      if (prev.status === 'COMPLETED' || prev.isFirstFaultPaused) {
        setIsPlaying(false);
        return prev;
      }
      const next = stepComparisonTurn(prev);
      if (next.isFirstFaultPaused || next.status === 'COMPLETED') {
        setIsPlaying(false);
      }
      return next;
    });
  }, []);

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      const delay = Math.max(300, 1000 / speed);
      playIntervalRef.current = setInterval(() => {
        handleStepTurn();
      }, delay);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, speed, handleStepTurn]);

  // Evaluated invariants
  const evaluatedInvariants = evaluateComparisonInvariants(compState);

  // Current active preset object
  const activePreset =
    experimentType === COMPARISON_EXPERIMENTS.COUNTER
      ? COUNTER_PRESETS[presetId] || COUNTER_PRESETS.LOST_UPDATE
      : BUFFER_COMPARISON_PRESETS[presetId] || BUFFER_COMPARISON_PRESETS.RACE_COLLISION;

  const leftReceipt = compState.history[0]?.leftReceipt || null;
  const rightReceipt = compState.history[0]?.rightReceipt || null;

  return (
    <div className="space-y-4 font-sans text-left">
      {/* 1. TOP CONTROL BAR */}
      <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Experiment & Preset selectors */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#DDD9CF]/80 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Experiment selector pills */}
            <div className="flex items-center gap-1 bg-[#ECE9E1] p-1 rounded-xl text-xs">
              <button
                onClick={() => handleExperimentChange(COMPARISON_EXPERIMENTS.COUNTER)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  experimentType === COMPARISON_EXPERIMENTS.COUNTER
                    ? 'bg-[#172B3A] text-white shadow-2xs'
                    : 'text-[#647480] hover:text-[#172B3A]'
                }`}
              >
                1. Shared Counter (Lost Update)
              </button>
              <button
                onClick={() => handleExperimentChange(COMPARISON_EXPERIMENTS.BUFFER)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  experimentType === COMPARISON_EXPERIMENTS.BUFFER
                    ? 'bg-[#172B3A] text-white shadow-2xs'
                    : 'text-[#647480] hover:text-[#172B3A]'
                }`}
              >
                2. Bounded Buffer (Slot Overwrite)
              </button>
            </div>

            {/* Preset Selector Dropdown */}
            <select
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-[#FAF9F5] border border-[#DDD9CF] text-[#172B3A] text-xs font-medium px-3 py-1.5 rounded-xl cursor-pointer focus:outline-none focus:border-[#087F8C]"
            >
              {experimentType === COMPARISON_EXPERIMENTS.COUNTER
                ? Object.values(COUNTER_PRESETS).map((p) => (
                    <option key={p.id} value={p.id}>
                      Preset: {p.name}
                    </option>
                  ))
                : Object.values(BUFFER_COMPARISON_PRESETS).map((p) => (
                    <option key={p.id} value={p.id}>
                      Preset: {p.name}
                    </option>
                  ))}
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#647480] font-medium hidden sm:inline">View:</span>
            <div className="flex items-center gap-1 bg-[#ECE9E1] p-1 rounded-xl text-xs">
              <button
                onClick={() => setViewMode('DUAL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  viewMode === 'DUAL' ? 'bg-white text-[#172B3A] shadow-2xs' : 'text-[#647480]'
                }`}
              >
                Side-by-Side
              </button>
              <button
                onClick={() => setViewMode('LEFT')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  viewMode === 'LEFT' ? 'bg-white text-[#172B3A] shadow-2xs' : 'text-[#647480]'
                }`}
              >
                Without Mutex
              </button>
              <button
                onClick={() => setViewMode('RIGHT')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  viewMode === 'RIGHT' ? 'bg-white text-[#172B3A] shadow-2xs' : 'text-[#647480]'
                }`}
              >
                With Mutex
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Turn Counter, Playback & Fault Pause Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Turn Counter Pill */}
            <div className="flex items-center gap-2 bg-[#FAF9F5] border border-[#DDD9CF] px-3 py-1.5 rounded-xl font-mono text-xs">
              <span className="text-[#647480]">Turn</span>
              <span className="font-bold text-[#172B3A] text-sm">{compState.turnIndex}</span>
              {compState.schedule && (
                <span className="text-[#647480]">/ {compState.schedule.length}</span>
              )}
            </div>

            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={compState.status === 'COMPLETED' || compState.isFirstFaultPaused}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-[#172B3A] hover:bg-[#203a4e] text-white disabled:opacity-50'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Auto Run'}</span>
            </button>

            {/* Synchronized Step */}
            <button
              onClick={handleStepTurn}
              disabled={isPlaying || compState.status === 'COMPLETED' || compState.isFirstFaultPaused}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#DDD9CF] hover:border-[#087F8C] text-[#172B3A] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5 text-[#087F8C]" />
              <span>Step Both Panes</span>
            </button>

            {/* Reset */}
            <button
              onClick={() => handleReset()}
              className="p-2 text-[#647480] hover:text-[#172B3A] hover:bg-[#ECE9E1] rounded-xl transition-all cursor-pointer"
              title="Reset comparison simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed selector */}
            <div className="hidden sm:flex items-center gap-1 text-xs">
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded-lg font-mono text-[11px] ${
                    speed === s
                      ? 'bg-[#172B3A] text-white font-bold'
                      : 'text-[#647480] hover:bg-[#ECE9E1]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* "Pause at first fault" toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#172B3A]">
              <input
                type="checkbox"
                checked={pauseAtFirstFault}
                onChange={(e) => {
                  setPauseAtFirstFault(e.target.checked);
                  setCompState((prev) => ({ ...prev, pauseAtFirstFault: e.target.checked }));
                }}
                className="w-4 h-4 accent-[#087F8C] rounded cursor-pointer"
              />
              <span>Pause on First Fault</span>
            </label>
            {compState.isFirstFaultPaused && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                Fault Paused
              </span>
            )}
          </div>
        </div>

        {/* Preset Description & Teaching Note Banner */}
        <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 text-xs leading-relaxed text-[#2D4554] flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-[#172B3A]">{activePreset.name}:</span>
            <p className="text-[#647480]">{activePreset.description}</p>
            {activePreset.teachingNote && (
              <p className="text-[11px] text-[#087F8C] font-medium pt-0.5">
                Teacher Note: {activePreset.teachingNote}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. FIRST FAULT ALERT BANNER */}
      {compState.firstFaultData && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-rose-900">
                  Critical Race Condition Detected at Turn #{compState.firstFaultData.turnIndex}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 font-bold">
                  Thread {compState.firstFaultData.threadId}
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-rose-950">
                {compState.firstFaultData.fault?.explanation ||
                  'Unsynchronized concurrent execution clobbered shared state! Notice that the mutex-protected right pane remained completely safe.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveReceipt(compState.firstFaultData.receipt)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              Inspect Diagnostic Receipt
            </button>
            {compState.isFirstFaultPaused && (
              <button
                onClick={() => setCompState((prev) => ({ ...prev, isFirstFaultPaused: false }))}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-900 hover:bg-rose-100 font-bold rounded-xl text-xs cursor-pointer"
              >
                Resume Execution
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. DUAL-PANE WORKSPACE: LEFT (WITHOUT MUTEX) vs RIGHT (WITH MUTEX) */}
      <div
        className={`grid gap-4 ${
          viewMode === 'DUAL'
            ? 'grid-cols-1 lg:grid-cols-2'
            : 'grid-cols-1'
        }`}
      >
        {/* LEFT PANE: WITHOUT MUTEX */}
        {(viewMode === 'DUAL' || viewMode === 'LEFT') && (
          <div className="space-y-4 bg-[#FDFCF9] border-2 border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            {/* Left Header */}
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-[#172B3A]">
                    Pane A: Without Mutex
                  </h3>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Unsynchronized Critical Section (Permits Stale Races)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl font-bold">
                  Committed: {compState.leftCommittedCount}
                </span>
                {leftReceipt && (
                  <button
                    onClick={() => setActiveReceipt(leftReceipt)}
                    className="text-[11px] font-bold text-[#087F8C] hover:underline cursor-pointer"
                  >
                    View Receipt
                  </button>
                )}
              </div>
            </div>

            {/* Visualizer for Left Pane */}
            {experimentType === COMPARISON_EXPERIMENTS.COUNTER ? (
              <CounterVisualizer state={compState.leftState} />
            ) : (
              <BufferComparisonDiagram state={compState.leftState} />
            )}

            {/* Live Invariant Verification Panel */}
            <LiveVerificationPanel
              invariants={evaluatedInvariants.left}
              title="Without Mutex Invariants"
              subtitle="Evaluated in real-time directly from actual memory & pointers"
            />
          </div>
        )}

        {/* RIGHT PANE: WITH MUTEX */}
        {(viewMode === 'DUAL' || viewMode === 'RIGHT') && (
          <div className="space-y-4 bg-[#FAFDFD] border-2 border-teal-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
            {/* Right Header */}
            <div className="flex items-center justify-between border-b border-teal-200/80 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-[#172B3A]">
                    Pane B: With Mutex
                  </h3>
                  <p className="text-[11px] text-teal-800 font-medium">
                    Serialized Critical Section (Guarantees Mutual Exclusion)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs bg-teal-50 text-teal-900 border border-teal-300 px-2.5 py-1 rounded-xl font-bold">
                  Committed: {compState.rightCommittedCount}
                </span>
                {rightReceipt && (
                  <button
                    onClick={() => setActiveReceipt(rightReceipt)}
                    className="text-[11px] font-bold text-[#087F8C] hover:underline cursor-pointer"
                  >
                    View Receipt
                  </button>
                )}
              </div>
            </div>

            {/* Visualizer for Right Pane */}
            {experimentType === COMPARISON_EXPERIMENTS.COUNTER ? (
              <CounterVisualizer state={compState.rightState} />
            ) : (
              <BufferComparisonDiagram state={compState.rightState} />
            )}

            {/* Live Invariant Verification Panel */}
            <LiveVerificationPanel
              invariants={evaluatedInvariants.right}
              title="With Mutex Invariants"
              subtitle="Strictly verifies atomic lock possession and FIFO integrity"
            />
          </div>
        )}
      </div>

      {/* 4. EXECUTION RECEIPTS DRAWER / MODAL */}
      {activeReceipt && (
        <EventEvidenceModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)} />
      )}
    </div>
  );
}

