import React, { useState, useEffect, useCallback, useRef } from 'react';
import Overview from './Overview.jsx';
import LiveSimulator from './LiveSimulator.jsx';
import SynchronizationLab from './SynchronizationLab.jsx';
import RaceConditionLab from './RaceConditionLab.jsx';
import Flowcharts from './Flowcharts.jsx';
import VivaMode from './VivaMode.jsx';
import { ProducerConsumerEngine, SCHEDULER_MODES } from './engine/syncLabEngine.js';
import { validateSystemInvariants } from './engine/invariants.js';
import { Play, Pause, SkipForward, Activity, Timer, RotateCcw, ShieldCheck, Keyboard } from 'lucide-react';
import './styles/synclab2.css';

const SECTIONS = [
  { id: 'overview', num: '1', title: 'Overview' },
  { id: 'simulator', num: '2', title: 'Live Simulator' },
  { id: 'sync', num: '3', title: 'Sync Lab' },
  { id: 'race', num: '4', title: 'Race Lab' },
  { id: 'flow', num: '5', title: 'Flowcharts' },
  { id: 'viva', num: '6', title: 'Viva Mode' },
];

export default function SyncLabShell() {
  const [activeTab, setActiveTab] = useState('overview');
  const [engine] = useState(() => new ProducerConsumerEngine({ persistentConsumers: true }));
  const [simulationState, setSimulationState] = useState(() => engine.snapshot());
  const [selectedSlot, setSelectedSlot] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5, 1, 2, 4
  const [schedulerMode, setSchedulerMode] = useState(SCHEDULER_MODES.MANUAL);
  const playTimerRef = useRef(null);

  const refresh = useCallback(() => {
    setSimulationState(engine.snapshot());
  }, [engine]);

  // Handle single atomic step
  const handleStepInstruction = useCallback(() => {
    engine.stepNextInstruction();
    refresh();
  }, [engine, refresh]);

  // Handle complete process step
  const handleStepProcess = useCallback(() => {
    engine.stepNextProcess();
    refresh();
  }, [engine, refresh]);

  // Handle kitchen tick
  const handleTickKitchen = useCallback(() => {
    engine.tickKitchen();
    refresh();
  }, [engine, refresh]);

  // Handle simulation reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    engine.reset();
    refresh();
  }, [engine, refresh]);

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    const intervalMs = Math.max(200, Math.floor(1000 / speed));
    playTimerRef.current = setInterval(() => {
      const snap = engine.snapshot();
      const hasRunnable = (snap.processes || []).some(
        (p) => p.state === 'READY' || p.state === 'RUNNING'
      );
      const hasPreparing = (snap.workers || []).some((w) => w.state === 'PREPARING');

      if (hasRunnable) {
        engine.stepNextInstruction();
        refresh();
      } else if (hasPreparing) {
        engine.tickKitchen();
        refresh();
      } else {
        setIsPlaying(false);
      }
    }, intervalMs);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, speed, engine, refresh]);

  // Keyboard shortcuts (Space, ArrowRight, R, 1-6)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepInstruction();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      } else if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const sec = SECTIONS[Number(e.key) - 1];
        if (sec) {
          e.preventDefault();
          setActiveTab(sec.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStepInstruction, handleReset]);

  const inv = validateSystemInvariants(simulationState);

  return (
    <div className="sl2-shell">
      {/* Top Navigation Bar */}
      <header className="sl2-navbar">
        <div className="sl2-nav-brand">
          <span className="sl2-brand-badge">CASE STUDY 03</span>
          <span className="sl2-brand-title">CANTEO SYNCLAB 2.0</span>
          <span className="sl2-brand-subtitle">· Producer–Consumer OS Simulator</span>
        </div>

        {/* 6 Sections Switcher */}
        <nav className="sl2-nav-tabs" aria-label="SyncLab 2.0 Sections">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              className={`sl2-nav-tab ${activeTab === sec.id ? 'active' : ''}`}
              onClick={() => setActiveTab(sec.id)}
            >
              <span className="sl2-tab-num">{sec.num}</span>
              <span>{sec.title}</span>
            </button>
          ))}
        </nav>

        {/* Invariant & Status Badges */}
        <div className="sl2-nav-status">
          <div className={`sl2-invariant-pill ${inv.valid ? 'valid' : 'invalid'}`}>
            <span className={`sl2-status-dot ${inv.valid ? '' : 'danger'}`} />
            <span>{inv.equation}</span>
          </div>
          <div className="sl2-keyboard-hints" style={{ display: 'none' }}>
            <span><kbd className="sl2-kbd">Space</kbd> Play</span>
            <span><kbd className="sl2-kbd">→</kbd> Step</span>
          </div>
        </div>
      </header>

      {/* Main Viewport Content Container */}
      <main className="sl2-main-container">
        {activeTab === 'overview' && (
          <Overview onNavigate={(target) => setActiveTab(target)} />
        )}

        {activeTab === 'simulator' && (
          <LiveSimulator
            state={simulationState}
            engine={engine}
            refresh={refresh}
            selectedSlot={selectedSlot}
            onSelectSlot={(slot) => setSelectedSlot(slot)}
          />
        )}

        {activeTab === 'sync' && (
          <SynchronizationLab onNavigateSection={(sec) => setActiveTab(sec)} />
        )}

        {activeTab === 'race' && <RaceConditionLab />}

        {activeTab === 'flow' && <Flowcharts />}

        {activeTab === 'viva' && <VivaMode />}
      </main>

      {/* Floating Bottom Simulation Control Bar */}
      <footer className="sl2-bottom-control-bar">
        <div className="sl2-ctrl-group">
          <button
            className={`sl2-ctrl-btn ${isPlaying ? '' : 'primary'}`}
            onClick={() => setIsPlaying((prev) => !prev)}
            title="Toggle Continuous Simulation (Space)"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
          </button>

          <button
            className="sl2-ctrl-btn"
            onClick={handleStepInstruction}
            disabled={isPlaying}
            title="Execute exactly one POSIX micro-step (ArrowRight)"
          >
            <SkipForward size={14} />
            <span>Step Instruction</span>
          </button>

          <button
            className="sl2-ctrl-btn"
            onClick={handleStepProcess}
            disabled={isPlaying}
            title="Advance active process to next boundary"
          >
            <Activity size={14} />
            <span>Step Process</span>
          </button>

          <button
            className="sl2-ctrl-btn"
            onClick={handleTickKitchen}
            disabled={isPlaying}
            title="Advance kitchen cooking tick outside lock"
          >
            <Timer size={14} />
            <span>Kitchen Tick</span>
          </button>

          <button
            className="sl2-ctrl-btn"
            onClick={handleReset}
            title="Reset simulation to initial empty state (R)"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        <div className="sl2-ctrl-group">
          <label style={{ fontSize: '11px', color: 'var(--black-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Speed:</span>
            <select
              className="sl2-ctrl-select"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value="0.5">0.5x</option>
              <option value="1">1.0x</option>
              <option value="2">2.0x</option>
              <option value="4">4.0x</option>
            </select>
          </label>

          <label style={{ fontSize: '11px', color: 'var(--black-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Scheduler:</span>
            <select
              className="sl2-ctrl-select"
              value={schedulerMode}
              onChange={(e) => setSchedulerMode(e.target.value)}
            >
              <option value={SCHEDULER_MODES.MANUAL}>Manual</option>
              <option value={SCHEDULER_MODES.ROUND_ROBIN}>Round Robin</option>
              <option value={SCHEDULER_MODES.RANDOM}>Random</option>
            </select>
          </label>
        </div>

        <div className="sl2-keyboard-hints">
          <span><kbd className="sl2-kbd">Space</kbd> Play/Pause</span>
          <span><kbd className="sl2-kbd">→</kbd> Step</span>
          <span><kbd className="sl2-kbd">R</kbd> Reset</span>
          <span><kbd className="sl2-kbd">1-6</kbd> Sections</span>
        </div>
      </footer>
    </div>
  );
}

