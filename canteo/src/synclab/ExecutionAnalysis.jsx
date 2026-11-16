import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  LockKeyhole,
  Users,
  ChefHat,
  Cpu,
  Info,
} from 'lucide-react';
import {
  calculateOccupancyChartGeometry,
  getProcessDisplayState,
  generateStepCauseAndEffect,
  filterHistoricalSteps,
} from './executionHistory.js';

const CHART_WIDTH = 760;
const CHART_HEIGHT = 185;
const CHART_PADDING = { top: 28, right: 32, bottom: 42, left: 56 };

const EVENT_FILTERS = [
  { id: 'all', label: 'All steps' },
  { id: 'queue', label: 'Queue changes (Insert/Remove)' },
  { id: 'blocked', label: 'Blocked threads' },
  { id: 'mutex', label: 'Mutex lock/release' },
  { id: 'kitchen', label: 'Kitchen preparation' },
];

export function ExecutionAnalysis({ state, inspectedSeq }) {
  const history = useMemo(() => state?.executionHistory || [], [state?.executionHistory]);
  const truncatedCount = state?.historyTruncatedCount || 0;
  const capacity = state?.capacity || 5;

  const [followLatest, setFollowLatest] = useState(true);
  const [selectedSeq, setSelectedSeq] = useState(null);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [manualWindowOffset, setManualWindowOffset] = useState(0);
  const [eventFilter, setEventFilter] = useState('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [zoom, setZoom] = useState(25); // 15, 25, 40, or 'all'
  const [selectedProcessId, setSelectedProcessId] = useState(null);

  const containerRef = useRef(null);

  const latestSeq = history.length ? history[history.length - 1].seq : 0;
  const earliestRetainedSeq = history.length ? history[0].seq : 0;

  // Safe effective sequence: if selectedSeq was evicted, clamp safely to earliest retained
  const effectiveSeq = useMemo(() => {
    if (followLatest || selectedSeq === null) return latestSeq;
    if (selectedSeq < earliestRetainedSeq) return earliestRetainedSeq;
    if (selectedSeq > latestSeq) return latestSeq;
    return selectedSeq;
  }, [followLatest, selectedSeq, earliestRetainedSeq, latestSeq]);

  const totalSamples = history.length;
  const windowSize = zoom === 'all' ? Math.max(1, totalSamples) : zoom;
  const maxOffset = Math.max(0, totalSamples - windowSize);
  const effectiveOffset = followLatest ? maxOffset : Math.max(0, Math.min(manualWindowOffset, maxOffset));

  const visibleSamples = useMemo(() => {
    if (totalSamples <= windowSize) return history;
    return history.slice(effectiveOffset, effectiveOffset + windowSize);
  }, [history, totalSamples, effectiveOffset, windowSize]);

  const minSeq = visibleSamples.length ? visibleSamples[0].seq : 0;
  const maxSeq = visibleSamples.length ? visibleSamples[visibleSamples.length - 1].seq : 0;

  const currentIndex = history.findIndex((s) => s.seq === effectiveSeq);
  const currentSample = currentIndex >= 0 ? history[currentIndex] : (history[history.length - 1] ?? null);
  const prevSample = currentIndex > 0 ? history[currentIndex - 1] : null;

  const isHistorical = currentSample && currentSample.seq !== latestSeq;
  const liveSample = history.length ? history[history.length - 1] : null;

  // Distinct processes across history
  const processList = useMemo(() => {
    const map = new Map();
    for (const sample of history) {
      for (const p of sample.processes || []) {
        if (!map.has(p.id)) {
          map.set(p.id, { id: p.id, type: p.type });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'PRODUCER' ? -1 : 1;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [history]);

  // Matching sequence numbers for event filter
  const matchingStepSeqs = useMemo(() => {
    return filterHistoricalSteps(history, eventFilter);
  }, [history, eventFilter]);

  // Two-level cause-and-effect summary
  const causeAndEffect = useMemo(() => {
    return generateStepCauseAndEffect(currentSample, prevSample);
  }, [currentSample, prevSample]);

  // User interactions
  const handleSelectSample = (seq) => {
    setSelectedSeq(seq);
    const isNowLatest = seq === latestSeq;
    setFollowLatest(isNowLatest);
    if (!isNowLatest) {
      const idx = history.findIndex((s) => s.seq === seq);
      if (idx !== -1) {
        // Keep selected step centered in the visible window
        setManualWindowOffset(Math.max(0, Math.min(maxOffset, idx - Math.floor(windowSize / 2))));
      }
    }
    // Synchronize process focus to the thread executing this step
    const sample = history.find((s) => s.seq === seq);
    if (sample?.processId) {
      setSelectedProcessId(sample.processId);
    }
  };

  useEffect(() => {
    if (!inspectedSeq) return;
    const targetSeq = typeof inspectedSeq === 'object' ? inspectedSeq.seq : inspectedSeq;
    if (typeof targetSeq === 'number' && Number.isFinite(targetSeq) && targetSeq >= 0) {
      setSelectedSeq(targetSeq);
      setFollowLatest(false);
      const idx = history.findIndex((s) => s.seq === targetSeq);
      if (idx !== -1) {
        setManualWindowOffset(Math.max(0, Math.min(maxOffset, idx - Math.floor(windowSize / 2))));
      }
      const sample = history.find((s) => s.seq === targetSeq);
      if (sample?.processId) {
        setSelectedProcessId(sample.processId);
      }
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [inspectedSeq, history, maxOffset, windowSize]);

  const handleReturnToLatest = () => {
    setSelectedSeq(null);
    setFollowLatest(true);
    setManualWindowOffset(maxOffset);
    if (liveSample?.processId) {
      setSelectedProcessId(liveSample.processId);
    }
  };

  const handlePrevStep = () => {
    if (!history.length) return;
    if (currentIndex > 0) {
      handleSelectSample(history[currentIndex - 1].seq);
    }
  };

  const handleNextStep = () => {
    if (!history.length) return;
    if (currentIndex >= 0 && currentIndex < history.length - 1) {
      handleSelectSample(history[currentIndex + 1].seq);
    }
  };

  // Event navigation: jump to previous/next matching event in history
  const handlePrevMatchingEvent = () => {
    if (!matchingStepSeqs.length) return;
    const earlier = matchingStepSeqs.filter((seq) => seq < effectiveSeq);
    if (earlier.length) {
      handleSelectSample(earlier[earlier.length - 1]);
    }
  };

  const handleNextMatchingEvent = () => {
    if (!matchingStepSeqs.length) return;
    const later = matchingStepSeqs.filter((seq) => seq > effectiveSeq);
    if (later.length) {
      handleSelectSample(later[0]);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrevStep();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNextStep();
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (history.length) handleSelectSample(history[0].seq);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleReturnToLatest();
    }
  };

  const geometry = useMemo(() => {
    return calculateOccupancyChartGeometry({
      samples: visibleSamples,
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      padding: CHART_PADDING,
      capacity,
      minSeq,
      maxSeq,
    });
  }, [visibleSamples, capacity, minSeq, maxSeq]);

  const stepCellWidth = zoom === 15 ? 56 : zoom === 25 ? 44 : zoom === 40 ? 34 : 28;

  return (
    <section
      className="sl-panel sl-analysis-section"
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="Execution analysis tool"
      aria-label="Execution Analysis graphs and timeline. Use Left and Right arrow keys to navigate steps, Home to jump to start, End to return to latest."
    >
      {/* SECTION HEADER & PRIMARY TOOLBAR */}
      <div className="sl-analysis-header">
        <div className="sl-analysis-title-block">
          <span className="sl-eyebrow">02.B / EXECUTION ANALYSIS</span>
          <h3>Queue Occupancy & Process Timeline</h3>
          <p>
            Discrete transition analysis recording queue occupancy changes and per-thread concurrency states.
          </p>
        </div>

        <div className="sl-analysis-toolbar">
          {/* Live vs Historical indicator pill */}
          <div className="sl-occupancy-status-pill">
            <span className="sl-status-dot live" />
            <span className="sl-status-label">
              Live Queue: <b>{liveSample ? liveSample.occupancy : 0}</b>/{capacity} orders
            </span>
            {isHistorical && (
              <span className="sl-status-historical">
                · Selected: <b>{currentSample?.occupancy ?? 0}</b>/{capacity} (Step #{effectiveSeq})
              </span>
            )}
          </div>

          {/* Stepping controls */}
          <div className="sl-analysis-controls-cluster">
            <button
              type="button"
              className="sl-btn small quiet"
              onClick={handlePrevStep}
              disabled={!history.length || effectiveSeq <= earliestRetainedSeq}
              title="Previous execution step (Left Arrow)"
              aria-label="Previous execution step"
            >
              <ArrowLeft size={13} />
            </button>

            <span className="sl-step-indicator" title="Currently inspected step">
              Step <b>{effectiveSeq}</b> <small>/ {latestSeq}</small>
            </span>

            <button
              type="button"
              className="sl-btn small quiet"
              onClick={handleNextStep}
              disabled={!history.length || effectiveSeq >= latestSeq}
              title="Next execution step (Right Arrow)"
              aria-label="Next execution step"
            >
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Follow Live Checkbox */}
          <label className="sl-follow-toggle" title="Keep inspection locked to latest engine transition">
            <input
              type="checkbox"
              checked={followLatest}
              onChange={(e) => {
                setFollowLatest(e.target.checked);
                if (e.target.checked) setSelectedSeq(latestSeq);
              }}
            />
            <span>Follow Live</span>
          </label>

          {/* Return to Latest Button */}
          {isHistorical && (
            <button
              type="button"
              className="sl-btn small primary sl-return-latest"
              onClick={handleReturnToLatest}
              title="Return inspection to live simulation state (End key)"
            >
              <RotateCcw size={12} /> Return to Latest
            </button>
          )}

          {/* Toggle Timeline Button */}
          <button
            type="button"
            className="sl-btn small sl-toggle-timeline-btn"
            onClick={() => setTimelineExpanded((prev) => !prev)}
            aria-expanded={timelineExpanded}
          >
            <Layers size={13} />
            <span>Timeline</span>
            {timelineExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* EVENT NAVIGATION BAR */}
      <div className="sl-event-navigator-bar">
        <div className="sl-event-filter-group">
          <span className="sl-filter-title">
            <SlidersHorizontal size={12} /> Event Navigator:
          </span>
          <div className="sl-filter-pills" role="radiogroup" aria-label="Event category filter">
            {EVENT_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sl-filter-pill ${eventFilter === f.id ? 'active' : ''}`}
                onClick={() => setEventFilter(f.id)}
                role="radio"
                aria-checked={eventFilter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sl-event-jump-controls">
          <button
            type="button"
            className="sl-btn small quiet"
            onClick={handlePrevMatchingEvent}
            disabled={!matchingStepSeqs.some((seq) => seq < effectiveSeq)}
            title="Jump to previous matching event in history"
          >
            ◀ Prev Event
          </button>
          <span className="sl-matching-count">
            {matchingStepSeqs.length} {eventFilter === 'all' ? 'transitions' : 'events'} recorded
          </span>
          <button
            type="button"
            className="sl-btn small quiet"
            onClick={handleNextMatchingEvent}
            disabled={!matchingStepSeqs.some((seq) => seq > effectiveSeq)}
            title="Jump to next matching event in history"
          >
            Next Event ▶
          </button>
        </div>
      </div>

      {/* RETENTION DISCLOSURE NOTICE */}
      {truncatedCount > 0 && (
        <div className="sl-analysis-notice">
          Showing steps <b>{earliestRetainedSeq}–{latestSeq}</b>. Earlier history (steps 0–{truncatedCount - 1}) was discarded to bound memory.
        </div>
      )}

      {/* GRAPH 1: BUFFER OCCUPANCY HISTORY */}
      <div className="sl-occupancy-graph-card">
        <div className="sl-graph-caption-row">
          <div>
            <b className="sl-graph-title">Buffer Occupancy History</b>
            <span className="sl-graph-subtitle">
              Physical order count across discrete execution steps (0–{capacity})
            </span>
          </div>

          {totalSamples > windowSize && (
            <div className="sl-range-navigator">
              <span className="sl-range-label">
                Window: steps {minSeq}–{maxSeq}
              </span>
              <button
                type="button"
                className="sl-btn small quiet"
                disabled={effectiveOffset <= 0}
                onClick={() => {
                  setFollowLatest(false);
                  setManualWindowOffset((o) => Math.max(0, o - 10));
                }}
                title="Scroll window earlier"
              >
                ◀ Earlier
              </button>
              <button
                type="button"
                className="sl-btn small quiet"
                disabled={effectiveOffset >= maxOffset}
                onClick={() => {
                  setManualWindowOffset((o) => Math.min(maxOffset, o + 10));
                }}
                title="Scroll window later"
              >
                Later ▶
              </button>
            </div>
          )}
        </div>

        <div className="sl-svg-wrap">
          <svg
            className="sl-occupancy-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Buffer occupancy stepped line graph"
          >
            {/* Y-Axis Semantic Label: Queued orders */}
            <text
              x={CHART_PADDING.left}
              y={16}
              textAnchor="start"
              className="sl-axis-title y-axis"
            >
              Queued orders
            </text>

            {/* Horizontal Grid lines and labels (0 to capacity) */}
            {Array.from({ length: capacity + 1 }, (_, occ) => {
              const y = geometry.yScale(occ);
              const isFull = occ === capacity;
              const isEmpty = occ === 0;
              return (
                <g key={occ} className="sl-grid-row">
                  <line
                    x1={CHART_PADDING.left}
                    y1={y}
                    x2={CHART_WIDTH - CHART_PADDING.right}
                    y2={y}
                    stroke={isFull ? '#e5cfaf' : isEmpty ? '#dfdbd3' : '#ede8de'}
                    strokeDasharray={isFull || isEmpty ? '3 3' : undefined}
                    strokeWidth="1"
                  />
                  <text
                    x={CHART_PADDING.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className={`sl-axis-label ${isFull ? 'full' : isEmpty ? 'empty' : ''}`}
                  >
                    {occ}
                  </text>
                  {isFull && (
                    <text
                      x={CHART_WIDTH - CHART_PADDING.right}
                      y={y - 6}
                      textAnchor="end"
                      className="sl-boundary-label full"
                    >
                      Capacity limit ({capacity})
                    </text>
                  )}
                  {isEmpty && (
                    <text
                      x={CHART_WIDTH - CHART_PADDING.right}
                      y={y - 6}
                      textAnchor="end"
                      className="sl-boundary-label empty"
                    >
                      Empty buffer (0)
                    </text>
                  )}
                </g>
              );
            })}

            {/* Capacity Limit Shading */}
            <rect
              x={CHART_PADDING.left}
              y={geometry.yScale(capacity)}
              width={CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right}
              height={1}
              fill="none"
            />

            {/* Shaded Area fill under stepped curve */}
            {geometry.hasData && geometry.areaPath && (
              <path
                d={geometry.areaPath}
                className="sl-occupancy-area"
                fill="url(#occupancy-fill)"
              />
            )}

            {/* Stepped line graph path */}
            {geometry.hasData && geometry.linePath && (
              <path
                d={geometry.linePath}
                className="sl-occupancy-line"
                fill="none"
                strokeWidth="2.5"
              />
            )}

            {/* Gradient definition for area fill */}
            <defs>
              <linearGradient id="occupancy-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#194D40" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#194D40" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Interactive Data Points along stepped curve */}
            {geometry.points.map((pt) => {
              const isSelected = pt.seq === effectiveSeq;
              return (
                <g key={pt.seq} className={`sl-chart-point-group ${isSelected ? 'selected' : ''}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? 6 : 3.5}
                    className={`sl-occupancy-point ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectSample(pt.seq)}
                    role="button"
                    tabIndex={-1}
                    aria-label={`Step ${pt.seq}: occupancy ${pt.occupancy}. ${pt.annotation?.label || ''}`}
                  />
                  {isSelected && (
                    <line
                      x1={pt.x}
                      y1={CHART_PADDING.top}
                      x2={pt.x}
                      y2={geometry.yBottom}
                      className="sl-vertical-selection-cursor"
                      stroke="#194D40"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Occupancy Legend */}
        <div className="sl-occupancy-legend">
          <span className="sl-legend-item">
            <i className="sl-legend-line occupancy" /> Queued orders count
          </span>
          <span className="sl-legend-item">
            <i className="sl-legend-dash capacity" /> Capacity boundary (5 orders)
          </span>
        </div>
      </div>

      {/* GRAPH 2: REDESIGNED PROCESS EXECUTION TIMELINE */}
      {timelineExpanded && (
        <div className="sl-timeline-card">
          <div className="sl-graph-caption-row">
            <div className="sl-timeline-header-meta">
              <div>
                <b className="sl-graph-title">Process Execution Trace</b>
                <span className="sl-graph-subtitle">
                  Inspect the progression of producers and consumers across synchronization steps.
                </span>
              </div>
              {/* Compact Execution Summary Stats */}
              <div className="sl-trace-summary-strip">
                <span className="sl-trace-stat">
                  Threads: <b>{processList.length}</b> ({processList.filter((p) => p.type === 'PRODUCER').length} Students, {processList.filter((p) => p.type === 'CONSUMER').length} Kitchen)
                </span>
                <span className="sl-trace-stat">
                  Current Step: <b>#{effectiveSeq}</b> <small>/ {latestSeq}</small>
                </span>
                <span className="sl-trace-stat">
                  Queue Occupancy: <b>{currentSample?.occupancy ?? 0}</b>/{capacity} orders
                </span>
                <span className={`sl-trace-stat ${currentSample?.mutexOwner ? 'mutex-held' : 'mutex-free'}`}>
                  Mutex: <b>{currentSample?.mutexOwner ? `Locked (${currentSample.mutexOwner})` : 'Unlocked (1)'}</b>
                </span>
                {selectedProcessId && (
                  <span className="sl-trace-stat highlighted-proc">
                    Selected: <b>{selectedProcessId}</b>
                    <button
                      type="button"
                      className="sl-clear-proc-btn"
                      onClick={() => setSelectedProcessId(null)}
                      title="Clear thread highlight"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Zoom / Range & Focus Controls */}
            <div className="sl-timeline-view-controls">
              <div className="sl-zoom-selector" role="group" aria-label="Timeline zoom level">
                <span className="sl-control-label">Window:</span>
                {[15, 25, 40, 'all'].map((z) => (
                  <button
                    key={z}
                    type="button"
                    className={`sl-zoom-btn ${zoom === z ? 'active' : ''}`}
                    onClick={() => {
                      setZoom(z);
                      if (z !== 'all') {
                        const idx = history.findIndex((s) => s.seq === effectiveSeq);
                        if (idx !== -1) {
                          setManualWindowOffset(
                            Math.max(0, Math.min(Math.max(0, totalSamples - z), idx - Math.floor(z / 2)))
                          );
                        }
                      }
                    }}
                  >
                    {z === 'all' ? 'All' : `${z} steps`}
                  </button>
                ))}
              </div>

              {totalSamples > windowSize && (
                <div className="sl-window-nav-btns">
                  <button
                    type="button"
                    className="sl-btn small quiet"
                    disabled={effectiveOffset <= 0}
                    onClick={() => {
                      setFollowLatest(false);
                      setManualWindowOffset((o) =>
                        Math.max(0, o - Math.max(5, Math.floor(windowSize / 2)))
                      );
                    }}
                    title="Slide window earlier"
                  >
                    ◀ Earlier
                  </button>
                  <button
                    type="button"
                    className="sl-btn small quiet"
                    disabled={effectiveOffset >= maxOffset}
                    onClick={() => {
                      setManualWindowOffset((o) =>
                        Math.min(maxOffset, o + Math.max(5, Math.floor(windowSize / 2)))
                      );
                    }}
                    title="Slide window later"
                  >
                    Later ▶
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Table Container */}
          <div className="sl-timeline-table-wrap">
            <div className="sl-trace-scroll-container">
              {processList.length === 0 ? (
                <div className="sl-muted sl-timeline-empty">
                  No processes registered. Add a Producer or Consumer in the Simulator to record execution traces.
                </div>
              ) : (
                <div className="sl-trace-grid" style={{ minWidth: `${140 + visibleSamples.length * (stepCellWidth + 3)}px` }}>
                  {/* TOP RULER ROW */}
                  <div className="sl-trace-ruler-row">
                    <div className="sl-trace-corner-header">
                      <span className="sl-ruler-axis-label">THREAD / STEP</span>
                    </div>
                    <div className="sl-trace-ruler-track">
                      {visibleSamples.map((sample) => {
                        const isSelected = sample.seq === effectiveSeq;
                        return (
                          <div
                            key={sample.seq}
                            className={`sl-ruler-tick ${isSelected ? 'selected' : ''}`}
                            style={{ width: `${stepCellWidth}px` }}
                            onClick={() => handleSelectSample(sample.seq)}
                            title={`Jump to Step #${sample.seq}: ${sample.operation}`}
                          >
                            <span className="sl-tick-num">#{sample.seq}</span>
                            {isSelected && <span className="sl-tick-pointer">▼</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PROCESS LANES */}
                  {processList.map((procDef) => {
                    const isProducer = procDef.type === 'PRODUCER';
                    const isRowSelected = selectedProcessId === procDef.id;
                    const isRowActingInSelectedStep = currentSample?.processId === procDef.id;

                    return (
                      <div
                        key={procDef.id}
                        className={`sl-trace-lane ${isRowSelected ? 'lane-highlighted' : ''} ${isRowActingInSelectedStep ? 'lane-acting' : ''}`}
                      >
                        {/* Fixed Sticky Left Header */}
                        <div
                          className="sl-trace-lane-header"
                          onClick={() =>
                            setSelectedProcessId((prev) => (prev === procDef.id ? null : procDef.id))
                          }
                          title={`Click to focus on ${procDef.id} (${isProducer ? 'Student' : 'Kitchen'})`}
                        >
                          <div className="sl-lane-identity">
                            <span className={`sl-lane-role-icon ${isProducer ? 'producer' : 'consumer'}`}>
                              {isProducer ? <Users size={12} /> : <ChefHat size={12} />}
                            </span>
                            <b className="sl-proc-name">{procDef.id}</b>
                            <span className="sl-proc-role-tag">{isProducer ? 'Student' : 'Kitchen'}</span>
                          </div>
                          {(() => {
                            const latestP = (currentSample?.processes || []).find((c) => c.id === procDef.id);
                            const latestW = (currentSample?.workers || []).find((c) => c.id === procDef.id);
                            const disp = getProcessDisplayState(latestP, latestW, currentSample?.mutexOwner);
                            return (
                              <span className={`sl-lane-status-badge ${disp.tone}`}>
                                {disp.badge || disp.label}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Horizontal Lane Track */}
                        <div className="sl-trace-lane-track">
                          {visibleSamples.map((sample) => {
                            const p = (sample.processes || []).find((cand) => cand.id === procDef.id);
                            const w = (sample.workers || []).find((cand) => cand.id === procDef.id);
                            const display = getProcessDisplayState(p, w, sample.mutexOwner);
                            const isSelected = sample.seq === effectiveSeq;
                            const isActing = sample.processId === procDef.id;

                            return (
                              <div
                                key={sample.seq}
                                className={`sl-trace-cell state-${display.stateKey.toLowerCase()} tone-${display.tone} ${isSelected ? 'selected-col' : ''} ${isActing ? 'acting-thread' : ''}`}
                                style={{ width: `${stepCellWidth}px` }}
                                onClick={() => {
                                  handleSelectSample(sample.seq);
                                  setSelectedProcessId(procDef.id);
                                }}
                                title={`Step #${sample.seq} · ${procDef.id}: ${display.label}${isActing ? ` (Active: ${sample.operation})` : ''}`}
                                role="button"
                                tabIndex={-1}
                                aria-label={`Step ${sample.seq}, ${procDef.id}: ${display.label}`}
                              >
                                <span className="sl-trace-cell-content">
                                  {display.isMutexOwner && (
                                    <LockKeyhole size={10} className="sl-cell-icon" />
                                  )}
                                  {display.badge && display.badge !== '—' && (
                                    <span className="sl-trace-cell-text">{display.badge}</span>
                                  )}
                                </span>
                                {isActing && (
                                  <span
                                    className="sl-acting-indicator"
                                    title="Active thread executing this instruction"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Educational Semantics Bar */}
            <div className="sl-trace-educational-notes">
              <div className="sl-edu-note-item">
                <Cpu size={14} className="sl-edu-icon" />
                <div>
                  <strong>Zero CPU Spinning</strong>
                  <p>Blocked threads sleep passively in OS wait queues without consuming CPU cycles until signaled.</p>
                </div>
              </div>
              <div className="sl-edu-note-item">
                <LockKeyhole size={14} className="sl-edu-icon" />
                <div>
                  <strong>Critical Section Isolation</strong>
                  <p>Mutual exclusion guarantees that only one process at a time can read or modify shared queue pointers.</p>
                </div>
              </div>
              <div className="sl-edu-note-item">
                <ChefHat size={14} className="sl-edu-icon" />
                <div>
                  <strong>Parallel Kitchen Preparation</strong>
                  <p>Removing an order frees its queue slot immediately; food is prepared concurrently outside the queue lock.</p>
                </div>
              </div>
            </div>

            {/* Compact Semantic Timeline Legend */}
            <div className="sl-timeline-legend">
              <span className="sl-legend-item">
                <i className="sl-swatch running" /> Running (Executing)
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch gold" /> Critical Section (Mutex Held)
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch orange" /> Wait(mutex)
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch amber" /> Wait(empty / full)
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch teal" /> Cooking in Kitchen (Parallel)
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch green-subtle" /> Ready / Runnable
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch slate" /> Workstation Idle
              </span>
              <span className="sl-legend-item">
                <i className="sl-swatch neutral" /> Completed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STRUCTURED EXECUTION INSPECTOR */}
      {currentSample && causeAndEffect && (
        <div className={`sl-execution-inspector ${isHistorical ? 'historical-mode' : 'live-mode'}`}>
          {/* Header */}
          <div className="sl-inspector-header">
            <div className="sl-inspector-title-group">
              <span className={`sl-inspector-status-badge ${isHistorical ? 'historical' : 'live'}`}>
                {isHistorical ? `HISTORICAL · STEP #${currentSample.seq}` : `LIVE · STEP #${latestSeq}`}
              </span>
              <span className="sl-inspector-actor-badge">
                {currentSample.processId ? `${currentSample.processId} (${causeAndEffect.actorRole})` : 'SYSTEM KERNEL'}
              </span>
              <h4 className="sl-inspector-headline">{causeAndEffect.headline}</h4>
            </div>

            <div className="sl-inspector-header-actions">
              <span className={`sl-inspector-lock-chip ${currentSample.mutexOwner ? 'locked' : 'unlocked'}`}>
                <LockKeyhole size={11} />
                {currentSample.mutexOwner ? `Mutex: Locked by ${currentSample.mutexOwner}` : 'Mutex: Unlocked (1)'}
              </span>
              {isHistorical && (
                <button
                  type="button"
                  className="sl-btn small primary sl-return-latest"
                  onClick={handleReturnToLatest}
                  title="Return to latest simulation step (End key)"
                >
                  <RotateCcw size={12} /> Return to Latest
                </button>
              )}
            </div>
          </div>

          {/* Structured 4-Card Inspector Grid */}
          <div className="sl-inspector-cards-grid">
            {/* Card 1: Operation Details */}
            <div className="sl-inspector-card">
              <span className="sl-card-label">OPERATION DETAILS</span>
              <div className="sl-card-keyvalues">
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Active Actor:</span>
                  <b
                    className="sl-kv-val sl-actor-link"
                    onClick={() => setSelectedProcessId(causeAndEffect.whoActed)}
                    title={`Click to focus on thread ${causeAndEffect.whoActed} in the trace`}
                  >
                    {causeAndEffect.whoActed} ({causeAndEffect.actorRole})
                  </b>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">POSIX Instruction:</span>
                  <code className="sl-kv-code">{currentSample.instructionOp || currentSample.operation}</code>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Queue Semaphore:</span>
                  <b className="sl-kv-val">
                    empty = {currentSample.empty} / 5 · full = {currentSample.full} / 5
                  </b>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Permit Status:</span>
                  <span className="sl-kv-val">
                    {causeAndEffect.accounting.reservedEmpty > 0
                      ? '1 empty permit reserved (in CS)'
                      : causeAndEffect.accounting.reservedFull > 0
                      ? '1 full permit reserved (dequeuing)'
                      : 'Quiescent (no held permits)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Shared Buffer & Pointers */}
            <div className="sl-inspector-card">
              <span className="sl-card-label">SHARED BUFFER & POINTERS</span>
              <div className="sl-card-keyvalues">
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Queue Occupancy:</span>
                  <b className="sl-kv-val">
                    {currentSample.occupancy} / {capacity} slots ({causeAndEffect.queueItem.text})
                  </b>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Read Pointer:</span>
                  <b className="sl-kv-val">Slot {currentSample.readPosition} (Head)</b>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Write Pointer:</span>
                  <b className="sl-kv-val">Slot {currentSample.writePosition} (Tail)</b>
                </div>
                <div className="sl-kv-row">
                  <span className="sl-kv-key">Critical Section:</span>
                  <span className={`sl-kv-val ${currentSample.mutexOwner ? 'highlight-lock' : ''}`}>
                    {currentSample.mutexOwner ? `Held by ${currentSample.mutexOwner}` : 'Free · Any runnable process can enter'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Cause and Effect Narrative */}
            <div className="sl-inspector-card narrative-card">
              <span className="sl-card-label">EXPLANATION</span>
              <p className="sl-narrative-p">{causeAndEffect.explanation}</p>
              {causeAndEffect.wokenProcess && (
                <div className="sl-wakeup-callout">
                  <strong>Causal Wakeup:</strong> Process <b>{causeAndEffect.wokenProcess}</b> was awakened from{' '}
                  <code>{causeAndEffect.wokenResource || 'wait queue'}</code> and transitioned to <code>READY</code>.
                </div>
              )}
            </div>

            {/* Card 4: State Transition Delta */}
            <div className="sl-inspector-card delta-card">
              <span className="sl-card-label">STATE TRANSITION DELTA</span>
              {currentSample.variableChanges ? (
                <div className="sl-delta-rows">
                  {Object.keys(currentSample.variableChanges.after || {}).map((key) => {
                    const b = currentSample.variableChanges.before?.[key];
                    const a = currentSample.variableChanges.after?.[key];
                    if (b === a) return null;
                    return (
                      <div key={key} className="sl-delta-item">
                        <span className="sl-delta-var">{key}:</span>
                        <span className="sl-delta-before">{String(b)}</span>
                        <span className="sl-delta-arrow">→</span>
                        <span className="sl-delta-after">{String(a)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <small className="sl-muted">No state variables were modified during this instruction.</small>
              )}
            </div>
          </div>

          {/* Technical Diagnostics & Accounting Details (Expandable) */}
          <details
            className="sl-analysis-details"
            open={detailsOpen}
            onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
          >
            <summary className="sl-details-summary">
              <span>{detailsOpen ? 'Hide' : 'Show'} Diagnostic & Permit Accounting Details</span>
            </summary>

            <div className="sl-details-content">
              {/* Card A: Permit Accounting Conservation Law */}
              <div className="sl-detail-card">
                <span className="sl-detail-eyebrow">PERMIT CONSERVATION (CAPACITY N = {capacity})</span>
                <div className="sl-permit-equation">
                  <code>{causeAndEffect.accounting.equation}</code>
                  <span
                    className={`sl-accounting-verdict ${causeAndEffect.accounting.isConserved ? 'pass' : 'fail'}`}
                  >
                    {causeAndEffect.accounting.isConserved ? '✓ Invariant Conserved' : 'Invariant Discrepancy'}
                  </span>
                </div>
                <ul className="sl-permit-breakdown">
                  <li>
                    <code>empty = {causeAndEffect.accounting.empty}</code>: available free slots for future producers
                  </li>
                  <li>
                    <code>full = {causeAndEffect.accounting.full}</code>: available published orders for future consumers
                  </li>
                  <li>
                    <code>reservedEmpty = {causeAndEffect.accounting.reservedEmpty}</code>: empty permits held by in-flight producers or pending signals
                  </li>
                  <li>
                    <code>reservedFull = {causeAndEffect.accounting.reservedFull}</code>: order permits held by in-flight consumers or pending signals
                  </li>
                </ul>
                <div className="sl-buffer-conservation-note">
                  Buffer Occupancy: <b>{currentSample.occupancy}</b> ={' '}
                  <code>full ({causeAndEffect.accounting.full}) + reservedFull ({causeAndEffect.accounting.reservedFull})</code>
                </div>
              </div>

              {/* Card B: Circular Buffer Pointer Head & Tail */}
              <div className="sl-detail-card">
                <span className="sl-detail-eyebrow">CIRCULAR BUFFER POINTERS</span>
                <div className="sl-pointer-row">
                  <div>
                    <span>Read Pointer (Head):</span>
                    <b>Slot {currentSample.readPosition}</b>
                  </div>
                  <div>
                    <span>Write Pointer (Tail):</span>
                    <b>Slot {currentSample.writePosition}</b>
                  </div>
                </div>
                <small className="sl-detail-note">
                  {currentSample.occupancy === capacity
                    ? `Buffer saturated at capacity limit (${capacity} orders). Next producer will block on wait(empty).`
                    : currentSample.occupancy === 0
                    ? 'Buffer empty (0 orders). Next consumer will block on wait(full).'
                    : `${capacity - currentSample.occupancy} free slots available for producer insertions.`}
                </small>
              </div>

              {/* Card C: Full Thread States Snapshot */}
              <div className="sl-detail-card full-span">
                <span className="sl-detail-eyebrow">THREAD STATES SNAPSHOT AT STEP #{currentSample.seq}</span>
                <div className="sl-thread-table-wrap">
                  <table className="sl-thread-table">
                    <thead>
                      <tr>
                        <th>Thread</th>
                        <th>Type</th>
                        <th>State</th>
                        <th>Program Counter</th>
                        <th>Permit</th>
                        <th>Wait Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentSample.processes || []).map((proc) => {
                        const w = (currentSample.workers || []).find((c) => c.id === proc.id);
                        const disp = getProcessDisplayState(proc, w, currentSample.mutexOwner);
                        return (
                          <tr
                            key={proc.id}
                            className={currentSample.processId === proc.id ? 'active-row' : ''}
                          >
                            <td>
                              <b>{proc.id}</b>
                            </td>
                            <td>{proc.type === 'PRODUCER' ? 'Student' : 'Kitchen'}</td>
                            <td>
                              <span className={`sl-table-badge ${disp.tone}`}>{disp.label}</span>
                            </td>
                            <td>PC: {proc.pc}</td>
                            <td>{proc.permit ? 'Held' : 'None'}</td>
                            <td>{proc.waitingFor ? `wait(${proc.waitingFor})` : 'None'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
