import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  History,
  Sliders,
  X,
  PlusCircle,
  ArrowDownCircle,
  CheckCircle2,
  Clock,
  Trash2,
  AlertTriangle,
  UserPlus,
  ArrowRight,
} from 'lucide-react';

export const SCENARIOS = [
  { id: 'start-empty', label: 'Start Empty' },
  { id: 'normal', label: 'Normal Concurrency' },
  { id: 'empty', label: 'Empty Buffer (Wait on Full)' },
  { id: 'full', label: 'Full Buffer (Wait on Empty)' },
  { id: 'wrap', label: 'Circular Wrap (4 → 0)' },
  { id: 'mixed', label: 'Mixed (3 Students, 3 Kitchen)' },
  { id: 'race', label: 'Race Condition Demo' },
];

export function ControlDock({
  isPlaying = false,
  onTogglePlay = () => {},
  onStep = () => {},
  onReset = () => {},
  stepCount = 0,
  systemStatus = null,
  sessionSummary = null,
  lastEventDetails = null,
  nextActionText = '',
  selectedProcessId = null,
  processes = [],
  onSelectProcess = () => {},
  schedulingMode = 'roundRobin',
  onChangeSchedulingMode = () => {},
  speed = 900,
  onChangeSpeed = () => {},
  currentScenario = 'normal',
  onSelectScenario = () => {},
  onToggleActivityDrawer = () => {},
  isActivityDrawerOpen = false,
  recentEvents = [],
  workloadMode = 'single',
  onChangeWorkloadMode = () => {},
  prepDuration = 3,
  onChangePrepDuration = () => {},
  producerDelay = 0,
  onChangeProducerDelay = () => {},
  randomSeed = 1337,
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecentActivityOpen, setIsRecentActivityOpen] = useState(false);

  // Status defaults
  const statusBadge = systemStatus?.badge ?? (isPlaying ? 'PLAYING' : 'PAUSED');
  const statusColor = systemStatus?.badgeColor ?? (isPlaying ? 'success' : 'neutral');
  const statusMessage = systemStatus?.message ?? (isPlaying ? 'Running simulation' : 'Paused · Press Play to execute ready processes.');

  // Summary counts
  const summaryProduced = sessionSummary?.produced ?? 0;
  const summaryCollected = sessionSummary?.collected ?? 0;
  const summaryCompleted = sessionSummary?.completed ?? 0;

  return (
    <div className="arena-control-dock-container" role="region" aria-label="Simulation Controls">
      {/* 1. System Status Line & Session Summary */}
      <div className="arena-dock-status-bar" role="status" aria-live="polite">
        <div className="status-badge-group">
          <span className={`status-badge ${statusColor}`}>
            <span className="status-dot" aria-hidden="true" />
            <span className="status-badge-text">{statusBadge}</span>
          </span>
          <span className="status-message-text">{statusMessage}</span>
        </div>

        <div className="session-summary-pills" aria-label="Session order summary">
          <span className="summary-pill" title="Total orders inserted into buffer (op: insert)">
            Produced <strong className="summary-num">{summaryProduced}</strong>
          </span>
          <span className="summary-sep" aria-hidden="true">·</span>
          <span className="summary-pill" title="Total orders claimed from buffer by kitchen (op: remove)">
            Collected <strong className="summary-num">{summaryCollected}</strong>
          </span>
          <span className="summary-sep" aria-hidden="true">·</span>
          <span className="summary-pill" title="Total orders whose preparation is complete (kitchen finished)">
            Completed <strong className="summary-num">{summaryCompleted}</strong>
          </span>
        </div>
      </div>

      {/* 2. Instruction Separation: Last Completed vs Next Instruction */}
      <div className="arena-dock-instruction-strip">
        {/* Last Completed Event */}
        <div className="instruction-item last-completed" title="Last executed event and variable changes">
          <span className="instruction-tag last-tag">LAST</span>
          <span className="instruction-process-badge">{lastEventDetails?.processId ?? '—'}</span>
          <span className="instruction-action-text">{lastEventDetails?.action ?? 'Initialized'}</span>
          {lastEventDetails?.changed && (
            <span className="instruction-changed-pill">{lastEventDetails.changed}</span>
          )}
        </div>

        <div className="instruction-strip-divider" aria-hidden="true" />

        {/* Next Instruction Preview */}
        <div className="instruction-item next-pending" title="Next atomic instruction to execute">
          <span className="instruction-tag next-tag">NEXT</span>
          <span className="instruction-action-text">{nextActionText || 'Ready to step.'}</span>
        </div>
      </div>

      {/* 3. Main Control Toolbar Dock */}
      <div className="arena-control-dock">
        {/* Primary Controls */}
        <div className="dock-group">
          <button
            type="button"
            className={`dock-btn dock-btn-primary ${isPlaying ? 'playing' : ''}`}
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            className="dock-btn dock-btn-secondary"
            onClick={onStep}
            disabled={isPlaying}
            title="Advance one atomic instruction"
            aria-label="Step instruction"
          >
            <SkipForward size={14} />
            <span>Step</span>
          </button>

          <button
            type="button"
            className="dock-btn dock-btn-icon"
            onClick={onReset}
            title="Reset current simulation scenario"
            aria-label="Reset"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div className="dock-divider" />

        {/* Playback Speed */}
        <div className="dock-group">
          <div className="dock-field">
            <label className="dock-label">SPEED</label>
            <select
              className="dock-select speed-select"
              value={speed}
              onChange={(e) => onChangeSpeed(Number(e.target.value))}
              title="Simulation speed"
            >
              <option value={1500}>0.5×</option>
              <option value={900}>1.0×</option>
              <option value={450}>2.0×</option>
              <option value={200}>4.0×</option>
            </select>
          </div>
        </div>

        <div className="dock-divider" />

        {/* Scheduler & Thread Dispatch */}
        <div className="dock-group">
          <div className="dock-field">
            <label className="dock-label">SCHEDULER</label>
            <div className="dock-segmented">
              <button
                type="button"
                className={`segment-btn ${schedulingMode === 'roundRobin' ? 'active' : ''}`}
                onClick={() => onChangeSchedulingMode('roundRobin')}
                title="Round-robin fair scheduling"
              >
                RR
              </button>
              <button
                type="button"
                className={`segment-btn ${schedulingMode === 'manual' ? 'active' : ''}`}
                onClick={() => onChangeSchedulingMode('manual')}
                title="Manual dispatch"
              >
                MAN
              </button>
              <button
                type="button"
                className={`segment-btn ${schedulingMode === 'random' ? 'active' : ''}`}
                onClick={() => onChangeSchedulingMode('random')}
                title="Stochastic preemption (Mulberry32 PRNG)"
              >
                RND
              </button>
            </div>
          </div>

          <div className="dock-field">
            <label className="dock-label">THREAD</label>
            <select
              className="dock-select"
              value={selectedProcessId ?? ''}
              onChange={(e) => onSelectProcess(e.target.value)}
              title="Select thread for manual dispatch"
            >
              <option value="">Auto</option>
              {processes.map((proc) => (
                <option key={proc.id} value={proc.id}>
                  {proc.id} ({proc.type === 'PRODUCER' ? 'Student' : 'Kitchen'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dock-divider" />

        {/* Secondary: Scenario Presets */}
        <div className="dock-group">
          <div className="dock-field">
            <label className="dock-label">SCENARIO</label>
            <select
              className="dock-select scenario-select"
              value={currentScenario}
              onChange={(e) => onSelectScenario(e.target.value)}
              title="Select simulation scenario (pauses and confirms if active session has work)"
            >
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dock-divider" />

        {/* Step Counter, Experiment Settings & Recent Activity */}
        <div className="dock-group">
          <div className="dock-step-box">
            <span className="step-label">STEP</span>
            <span className="step-number">{stepCount}</span>
          </div>

          <button
            type="button"
            className={`dock-btn dock-btn-icon ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => {
              setIsSettingsOpen((o) => !o);
              if (isRecentActivityOpen) setIsRecentActivityOpen(false);
            }}
            title="Experiment Settings (Workload & Duration)"
            aria-label="Experiment Settings"
          >
            <Sliders size={13} />
          </button>

          <button
            type="button"
            className={`dock-btn dock-btn-activity ${isRecentActivityOpen || isActivityDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              setIsRecentActivityOpen((o) => !o);
              if (isSettingsOpen) setIsSettingsOpen(false);
            }}
            title="Recent Activity Summary"
            aria-label="Recent Activity Summary"
          >
            <History size={14} />
            <span>Activity</span>
          </button>
        </div>
      </div>

      {/* 4. Compact Expandable Recent Activity Popover */}
      {isRecentActivityOpen && (
        <div className="arena-dock-activity-popover" role="dialog" aria-label="Recent Activity">
          <div className="popover-header">
            <div className="popover-title-row">
              <History size={13} />
              <span className="popover-title">Recent Lifecycle Activity</span>
              <span className="activity-count-badge">{recentEvents.length} events</span>
            </div>
            <button
              type="button"
              className="popover-close-btn"
              onClick={() => setIsRecentActivityOpen(false)}
              aria-label="Close recent activity"
            >
              <X size={12} />
            </button>
          </div>

          <div className="activity-list-container">
            {recentEvents.length === 0 ? (
              <div className="activity-empty-message">
                No recorded lifecycle events yet. Step or Play the simulation to observe activity.
              </div>
            ) : (
              recentEvents.map((ev) => (
                <div key={ev.id} className="activity-row">
                  <div className="activity-icon-col">
                    {ev.category === 'PROCESS_CREATED' && <UserPlus size={12} className="act-icon icon-blue" />}
                    {ev.category === 'ORDER_INSERTED' && <PlusCircle size={12} className="act-icon icon-amber" />}
                    {ev.category === 'ORDER_COLLECTED' && <ArrowDownCircle size={12} className="act-icon icon-emerald" />}
                    {ev.category === 'PREPARATION_COMPLETED' && <CheckCircle2 size={12} className="act-icon icon-teal" />}
                    {ev.category === 'REMOVAL_REQUESTED' && <Clock size={12} className="act-icon icon-purple" />}
                    {ev.category === 'PROCESS_REMOVED' && <Trash2 size={12} className="act-icon icon-rose" />}
                    {ev.category === 'PROCESS_BLOCKED' && <AlertTriangle size={12} className="act-icon icon-orange" />}
                  </div>

                  <div className="activity-content-col">
                    <div className="activity-meta-line">
                      <span className="activity-step">#{ev.step}</span>
                      <span className="activity-actor">{ev.processId}</span>
                      <span className="activity-category">{ev.label}</span>
                    </div>
                    <div className="activity-msg">{ev.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="popover-footer">
            <button
              type="button"
              className="activity-full-history-btn"
              onClick={() => {
                setIsRecentActivityOpen(false);
                onToggleActivityDrawer();
              }}
            >
              <span>View Full History Trace in Inspector</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* 5. Experiment Settings Popover */}
      {isSettingsOpen && (
        <div className="arena-dock-settings-popover" role="dialog" aria-label="Experiment Settings">
          <div className="popover-header">
            <div className="popover-title-row">
              <Sliders size={13} />
              <span className="popover-title">Experiment Settings</span>
            </div>
            <button
              type="button"
              className="popover-close-btn"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="Close settings"
            >
              <X size={12} />
            </button>
          </div>

          <div className="settings-scope-banner">
            <span>Applies to future work: New processes and upcoming kitchen orders. Active in-flight threads remain safe.</span>
          </div>

          <div className="popover-body">
            {/* Workload Mode */}
            <div className="popover-control-row">
              <div className="control-label-group">
                <span className="control-label">Workload Mode</span>
                <span className="control-sublabel">Finite vs continuous backlog</span>
              </div>
              <div className="control-segmented">
                <button
                  type="button"
                  className={`sub-segment-btn ${workloadMode === 'single' ? 'active' : ''}`}
                  onClick={() => onChangeWorkloadMode('single')}
                  title="One order per process cycle (finite)"
                >
                  Single-Order
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${workloadMode === 'continuous' ? 'active' : ''}`}
                  onClick={() => onChangeWorkloadMode('continuous')}
                  title="Producers repeatedly submit new orders until stopped"
                >
                  Continuous
                </button>
              </div>
            </div>

            {/* Kitchen Preparation Duration */}
            <div className="popover-control-row">
              <div className="control-label-group">
                <span className="control-label">Kitchen Preparation</span>
                <span className="control-sublabel">Cooking duration outside lock</span>
              </div>
              <div className="control-segmented">
                <button
                  type="button"
                  className={`sub-segment-btn ${prepDuration === 1 ? 'active' : ''}`}
                  onClick={() => onChangePrepDuration(1)}
                  title="1 tick fast preparation"
                >
                  Fast (1t)
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${prepDuration === 3 ? 'active' : ''}`}
                  onClick={() => onChangePrepDuration(3)}
                  title="3 ticks standard preparation"
                >
                  Normal (3t)
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${prepDuration === 5 ? 'active' : ''}`}
                  onClick={() => onChangePrepDuration(5)}
                  title="5 ticks relaxed preparation"
                >
                  Relaxed (5t)
                </button>
              </div>
            </div>

            {/* Production Duration / Pacing */}
            <div className="popover-control-row">
              <div className="control-label-group">
                <span className="control-label">Production Pacing</span>
                <span className="control-sublabel">Student creation staging</span>
              </div>
              <div className="control-segmented">
                <button
                  type="button"
                  className={`sub-segment-btn ${producerDelay === 0 ? 'active' : ''}`}
                  onClick={() => onChangeProducerDelay(0)}
                  title="Immediate submission attempt (0 ticks)"
                >
                  Instant (0t)
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${producerDelay === 1 ? 'active' : ''}`}
                  onClick={() => onChangeProducerDelay(1)}
                  title="Staged submission (1 tick pacing)"
                >
                  Staged (1t)
                </button>
              </div>
            </div>

            {/* Scheduler Mode Selection */}
            <div className="popover-control-row">
              <div className="control-label-group">
                <span className="control-label">Scheduler Dispatch</span>
                <span className="control-sublabel">Thread selection algorithm</span>
              </div>
              <div className="control-segmented">
                <button
                  type="button"
                  className={`sub-segment-btn ${schedulingMode === 'roundRobin' ? 'active' : ''}`}
                  onClick={() => onChangeSchedulingMode('roundRobin')}
                >
                  RR
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${schedulingMode === 'random' ? 'active' : ''}`}
                  onClick={() => onChangeSchedulingMode('random')}
                >
                  RND
                </button>
                <button
                  type="button"
                  className={`sub-segment-btn ${schedulingMode === 'manual' ? 'active' : ''}`}
                  onClick={() => onChangeSchedulingMode('manual')}
                >
                  MAN
                </button>
              </div>
            </div>

            {/* Random PRNG Seed Status (Deterministic) */}
            {schedulingMode === 'random' && (
              <div className="seed-status-row">
                <span className="seed-label">PRNG Seed:</span>
                <span className="seed-value">{randomSeed}</span>
                <span className="seed-note">(Deterministic Mulberry32)</span>
              </div>
            )}

            {/* Capacity Invariant Note */}
            <div className="capacity-note-row">
              <span className="capacity-label">Bounded Buffer Capacity:</span>
              <strong className="capacity-val">N = 5 slots (Fixed)</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
