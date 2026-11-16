import { Component, useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Award,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  User,
  Utensils,
} from 'lucide-react';
import { CanteenRushMissionAdapter } from './CanteenRushMissionAdapter.js';
import { CanteenRush3DScene } from './CanteenRush3DScene.jsx';
import { CanteenRush2DFallback } from './CanteenRush2DFallback.jsx';
import { PROCESS_INSTRUCTIONS } from '../engine/ProducerConsumerEngine.js';

// WebGL Error Boundary for safe 3D Canvas rendering
class WebGLSceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('WebGL initialization failed, falling back to 2D view:', error);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function CanteenRushGame({ activeSection, onNavigateSection }) {
  const [adapter] = useState(() => new CanteenRushMissionAdapter());

  const [missionState, setMissionState] = useState(() => adapter.getMissionSnapshot());
  const [viewMode, setViewMode] = useState('3d'); // '3d' | '2d'
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const speed = 850;

  // Subscribe to reactive adapter updates
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__canteen_rush_adapter__ = adapter;
    }
    const unsubscribe = adapter.subscribe((nextState) => {
      setMissionState(nextState);
    });
    return () => unsubscribe();
  }, [adapter]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || activeSection !== 'canteen-rush') return undefined;

    const timer = window.setInterval(() => {
      const snap = adapter.getMissionSnapshot();
      if (snap.isMissionComplete) {
        setIsPlaying(false);
        return;
      }

      // Check if any cooking needs ticks
      const preparing = snap.engineSnapshot.workers?.some((w) => w.state === 'PREPARING');
      if (preparing) {
        adapter.tickKitchen();
        return;
      }

      // Check if any ready order can be picked up
      if (snap.engineSnapshot.readyOrders?.length > 0) {
        adapter.pickUpOrder(snap.engineSnapshot.readyOrders[0].id);
        return;
      }

      // Try stepping selected process or next ready process
      const selected = snap.selectedEntityId;
      const process = snap.engineSnapshot.processes.find((p) => p.id === selected);

      if (process && (process.state === 'READY' || process.state === 'RUNNING')) {
        adapter.stepSelectedProcess();
      } else {
        // Find another runnable process
        const nextReady = snap.engineSnapshot.processes.find(
          (p) => p.state === 'READY' || p.state === 'RUNNING'
        );
        if (nextReady) {
          adapter.selectEntity(nextReady.id);
          adapter.stepSelectedProcess();
        } else {
          // All blocked or idle
          setIsPlaying(false);
        }
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [isPlaying, speed, adapter, activeSection]);

  const {
    engineSnapshot,
    selectedEntityId,
    tutorialStage,
    lastExplanation,
    stats,
    isMissionComplete,
  } = missionState;

  const {
    slots = [],
    empty = 5,
    full = 0,
    mutexOwner = null,
    processes = [],
    workers = [],
    completedOrders = [],
    writePosition = 0,
    readPosition = 0,
  } = engineSnapshot;

  const selectedProcess = processes.find((p) => p.id === selectedEntityId);
  const selectedWorker = workers.find((w) => w.id === selectedEntityId);
  const isCooking = selectedWorker?.state === 'PREPARING';
  const isBlocked = selectedProcess?.state === 'BLOCKED';
  const isCompleted = selectedProcess?.state === 'COMPLETED';

  const nextInstruction = selectedProcess
    ? PROCESS_INSTRUCTIONS[selectedProcess.type]?.[selectedProcess.pc]
    : null;

  const handleSelect = useCallback(
    (id) => {
      adapter.selectEntity(id);
    },
    [adapter]
  );

  const handleStep = useCallback(() => {
    adapter.stepSelectedProcess();
  }, [adapter]);

  const handleTickKitchen = useCallback(() => {
    adapter.tickKitchen();
  }, [adapter]);

  const handlePickUp = useCallback(
    (orderId) => {
      adapter.pickUpOrder(orderId);
    },
    [adapter]
  );

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    adapter.reset();
  }, [adapter]);

  return (
    <div className="cr-game-container">
      {/* Game Header Bar */}
      <div className="cr-top-header">
        <div className="cr-title-area">
          <div className="cr-title-badge">
            <Utensils size={18} />
          </div>
          <div>
            <span className="cr-eyebrow">SYNC LAB ACTIVITY · MISSION 01</span>
            <h2>Lunch Break: Keep the Orders Moving</h2>
            <p>Coordinate student order submission and parallel kitchen cooking in a 5-slot bounded rack.</p>
          </div>
        </div>

        {/* View Mode & Metrics Header HUD */}
        <div className="cr-header-actions">
          <div className="cr-view-toggle">
            <button
              type="button"
              className={`cr-toggle-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => setViewMode('3d')}
            >
              <Layers size={14} /> 3D Isometric View
            </button>
            <button
              type="button"
              className={`cr-toggle-btn ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => setViewMode('2d')}
            >
              <Activity size={14} /> 2D Accessible Diagram
            </button>
          </div>

          <div className="cr-top-metrics">
            <div className="cr-metric-chip">
              <span>empty</span>
              <b>{empty} / 5</b>
            </div>
            <div className="cr-metric-chip">
              <span>full</span>
              <b>{full} / 5</b>
            </div>
            <div className={`cr-metric-chip mutex ${mutexOwner ? 'locked' : 'free'}`}>
              <span>mutex</span>
              <b>{mutexOwner ? `🔒 ${mutexOwner}` : '🔓 Free'}</b>
            </div>
            <div className="cr-metric-chip target">
              <span>delivered</span>
              <b>{completedOrders.length} / 3</b>
            </div>
          </div>
        </div>
      </div>

      {/* Tutorial Guidance Banner */}
      <div className={`cr-tutorial-banner step-${tutorialStage.stepNumber}`}>
        <div className="cr-tutorial-left">
          <span className="cr-step-pill">Step {tutorialStage.stepNumber} of 8</span>
          <div className="cr-tutorial-text">
            <h4>{tutorialStage.title}</h4>
            <p>{tutorialStage.instruction}</p>
          </div>
        </div>
        <div className="cr-tutorial-progress-dots">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
            <span
              key={step}
              className={`cr-dot ${step === tutorialStage.stepNumber ? 'active' : step < tutorialStage.stepNumber ? 'passed' : ''}`}
              title={`Step ${step}`}
            />
          ))}
        </div>
      </div>

      {/* Interactive Main Viewport (3D or 2D) */}
      <div className="cr-viewport-card">
        {viewMode === '3d' ? (
          <WebGLSceneBoundary
            fallback={
              <CanteenRush2DFallback
                snapshot={engineSnapshot}
                selectedEntityId={selectedEntityId}
                onSelectEntity={handleSelect}
                onPickUpOrder={handlePickUp}
              />
            }
          >
            <CanteenRush3DScene
              snapshot={engineSnapshot}
              selectedEntityId={selectedEntityId}
              onSelectEntity={handleSelect}
              onPickUpOrder={handlePickUp}
            />
          </WebGLSceneBoundary>
        ) : (
          <CanteenRush2DFallback
            snapshot={engineSnapshot}
            selectedEntityId={selectedEntityId}
            onSelectEntity={handleSelect}
            onPickUpOrder={handlePickUp}
          />
        )}
      </div>

      {/* Contextual Feedback & Explanation Strip */}
      <div className="cr-explanation-strip">
        <div className="cr-strip-main">
          <div className="cr-strip-icon">
            <Info size={17} />
          </div>
          <div className="cr-strip-content">
            <span className="cr-strip-eyebrow">LAST SYNCHRONIZATION EVENT</span>
            <p className="cr-strip-text">{lastExplanation}</p>
          </div>
          <button
            type="button"
            className="cr-details-toggle-btn"
            onClick={() => setShowTechnicalDetails((v) => !v)}
          >
            {showTechnicalDetails ? (
              <>Hide Details <ChevronUp size={14} /></>
            ) : (
              <>Inspect Variables <ChevronDown size={14} /></>
            )}
          </button>
        </div>

        {/* Technical Details Inspection Drawer */}
        {showTechnicalDetails && (
          <div className="cr-details-drawer">
            <div className="cr-detail-grid">
              <div>
                <b>Selected Process</b>
                <span>{selectedEntityId || 'None'}</span>
              </div>
              <div>
                <b>Next Instruction</b>
                <code>{nextInstruction ? nextInstruction.label : 'None / Completed'}</code>
              </div>
              <div>
                <b>Queue Mutex Owner</b>
                <span className={mutexOwner ? 'cr-owner-alert' : ''}>{mutexOwner || 'Free'}</span>
              </div>
              <div>
                <b>Write Index / Read Index</b>
                <span>write: {writePosition} · read: {readPosition}</span>
              </div>
              <div>
                <b>Semaphore Counts</b>
                <span>empty: {empty} · full: {full}</span>
              </div>
              <div>
                <b>Queue Occupancy</b>
                <span>{slots.filter(Boolean).length} / 5 slots filled</span>
              </div>
            </div>
            {engineSnapshot.lastInstruction && (
              <div className="cr-drawer-sub">
                <small>Engine transition: {engineSnapshot.lastInstruction.processId} executed {engineSnapshot.lastInstruction.label}</small>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Primary Game Controls Panel */}
      <div className="cr-controls-cluster">
        {/* Selected Entity Card */}
        <div className="cr-selected-card">
          <div className="cr-selected-avatar">
            {selectedProcess?.type === 'CONSUMER' ? <ChefHat size={22} /> : <User size={22} />}
          </div>
          <div className="cr-selected-info">
            <div className="cr-selected-header">
              <strong>{selectedEntityId ? `${selectedEntityId} (${selectedProcess?.type === 'CONSUMER' ? 'Kitchen Worker' : 'Student Producer'})` : 'No Entity Selected'}</strong>
              {selectedProcess && (
                <span className={`cr-badge ${selectedProcess.state.toLowerCase()}`}>
                  {isCooking ? 'COOKING' : selectedProcess.state}
                </span>
              )}
            </div>
            <div className="cr-selected-sub">
              {isCooking ? (
                <span>🍳 Cooking on workstation outside mutex ({selectedWorker.preparationProgress}/{selectedWorker.preparationDuration} ticks)</span>
              ) : isBlocked ? (
                <span className="cr-blocked-warn">⏳ Blocked on wait({selectedProcess.waitingFor}) until signaled</span>
              ) : isCompleted ? (
                <span>✓ Process completed its submission</span>
              ) : nextInstruction ? (
                <span>Next step: <code>{nextInstruction.label}</code></span>
              ) : (
                <span>Click an entity in the scene or list to select</span>
              )}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="cr-actions-group">
          {/* Step Selected Process */}
          <button
            type="button"
            className="cr-btn primary"
            onClick={handleStep}
            disabled={!selectedEntityId || isBlocked || isCompleted || isCooking || isPlaying}
          >
            <SkipForward size={16} />
            <span>
              {nextInstruction
                ? `Advance Step (${selectedEntityId}: ${nextInstruction.label})`
                : 'Advance Next Step'}
            </span>
          </button>

          {/* Kitchen Tick Cooking */}
          <button
            type="button"
            className="cr-btn cooking"
            onClick={handleTickKitchen}
            disabled={!workers.some((w) => w.state === 'PREPARING') || isPlaying}
          >
            <Timer size={16} />
            <span>Advance Cooking (Tick)</span>
          </button>

          {/* Auto Step Play/Pause */}
          <button
            type="button"
            className={`cr-btn play ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying((p) => !p)}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Pause Auto' : 'Auto Play'}</span>
          </button>

          {/* Reset Mission */}
          <button
            type="button"
            className="cr-btn quiet"
            onClick={handleReset}
          >
            <RotateCcw size={16} />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* Mission Complete Modal / Debrief Card */}
      {isMissionComplete && (
        <div className="cr-debrief-overlay" role="dialog" aria-modal="true" aria-labelledby="debrief-heading">
          <div className="cr-debrief-card">
            <div className="cr-debrief-header">
              <div className="cr-debrief-icon">
                <Award size={36} />
              </div>
              <div>
                <span className="cr-debrief-eyebrow">MISSION COMPLETE</span>
                <h3 id="debrief-heading">Shift Complete: Lunch Orders Delivered!</h3>
                <p>You successfully synchronized student arrivals, bounded rack access, and kitchen preparation.</p>
              </div>
            </div>

            <div className="cr-debrief-stats">
              <div className="cr-stat-box">
                <b>3 / 3</b>
                <span>Orders Delivered</span>
              </div>
              <div className="cr-stat-box">
                <b>{stats.mutexAcquisitions}</b>
                <span>Mutex Locks</span>
              </div>
              <div className="cr-stat-box">
                <b>{stats.ordersSubmitted}</b>
                <span>Rack Insertions</span>
              </div>
              <div className="cr-stat-box">
                <b>0</b>
                <span>Queue Overflows</span>
              </div>
            </div>

            <div className="cr-debrief-lessons">
              <h4>Key Operating System Principles Verified</h4>
              <ul>
                <li>
                  <strong>1. Bounded Buffer Invariants:</strong> The shared 5-slot order rack never overflowed. The <code>empty</code> and <code>full</code> semaphores correctly conserved queue capacity throughout.
                </li>
                <li>
                  <strong>2. Mutual Exclusion on Critical Section:</strong> Only one process entered the rack at a time via <code>wait(mutex)</code> and <code>signal(mutex)</code>. No orders were overwritten or double-consumed.
                </li>
                <li>
                  <strong>3. Independent Parallel Preparation:</strong> Cooking occurred <em>outside</em> the queue mutex lock. Both kitchen workstations cooked simultaneously without blocking the student arrival counter.
                </li>
                <li>
                  <strong>4. Strict FIFO Dispatch:</strong> Orders were claimed from the head of the circular buffer in exact chronological sequence.
                </li>
              </ul>
            </div>

            <div className="cr-debrief-actions">
              <button
                type="button"
                className="cr-btn primary large"
                onClick={handleReset}
              >
                <RotateCcw size={16} /> Replay Mission
              </button>
              {onNavigateSection && (
                <button
                  type="button"
                  className="cr-btn secondary large"
                  onClick={() => onNavigateSection('simulator')}
                >
                  Return to Simulator
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

