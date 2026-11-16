import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { selectQueueFlowState } from './flow/selectQueueFlowState.js';
import '../styles/liveQueueFlow.css';

/**
 * Format a waiting-process queue concisely: e.g. "C1, C2" or "C1, C2 +4"
 */
function formatWaiters(waiters, maxCount = 2) {
  if (!waiters || waiters.length === 0) return null;
  const ids = waiters.map((w) => w.id);
  const head = ids.slice(0, maxCount).join(', ');
  const remainder = ids.length - maxCount;
  return remainder > 0 ? `${head} +${remainder}` : head;
}

export function LiveQueueFlow({
  state = null,
  isPlaying = false,
  selectedSlotIndex = null,
  onSelectSlot = null,
  selectedProcessId = null,
  onSelectProcess = null,
  onInspectProcess = null,
  onOpenProcessManager = null,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllProducers, setShowAllProducers] = useState(false);
  const [showConsumerWaitDetails, setShowConsumerWaitDetails] = useState(false);
  const [showProducerWaitDetails, setShowProducerWaitDetails] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Authoritative selector
  const flow = useMemo(
    () => selectQueueFlowState(state, isPlaying),
    [state, isPlaying]
  );

  const {
    playbackStatus = 'Paused',
    isEntirelyEmpty = false,
    activeStageKey = null,
    activeOrderId = null,
    producers = [],
    producerWaiters = [],
    bufferFifoOrders = [],
    bufferOccupancy = { occupied: 0, capacity: 5 },
    consumerWaiters = [],
    consumerMutexWaiters = [],
    preparingAssignments = [],
    completedOrders = [],
    completedTotal = 0,
    latestShortExplanation = 'Ready to execute ready processes.',
    latestTechnicalDetails = '',
  } = flow;

  // Producers: show first 4 by default, or all if toggled
  const visibleProducers = showAllProducers ? producers : producers.slice(0, 4);

  // Waiting queues
  const ordersWaitText = formatWaiters(consumerWaiters, 2);
  const mutexWaitText = formatWaiters(consumerMutexWaiters, 2);
  const hasConsumerWaiters = Boolean(ordersWaitText || mutexWaitText);
  const hasProducerWaiters = producerWaiters && producerWaiters.length > 0;

  return (
    <section
      className="live-queue-flow-section"
      aria-labelledby="live-queue-flow-heading"
      data-flow-revision={state?.revision ?? 0}
    >
      {/* ====================================================================
          1. COMPACT HEADER
          ==================================================================== */}
      <header className="lqf-header">
        <div className="lqf-header-text">
          <h2 id="live-queue-flow-heading" className="lqf-title">
            Live Queue Flow
          </h2>
          <p className="lqf-subtitle">See where each order is now.</p>
        </div>

        <div className="lqf-header-actions">
          {/* Real Playback State: Live / Paused / Idle */}
          <span
            className={`lqf-status-pill status-${playbackStatus.toLowerCase()}`}
            aria-live="polite"
          >
            <span className="lqf-status-dot" aria-hidden="true" />
            <span>{playbackStatus}</span>
          </span>

          {/* Expand / Collapse Button */}
          <button
            type="button"
            className="lqf-collapse-btn"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            aria-controls="lqf-flow-body"
          >
            {isExpanded ? (
              <>
                <span>Collapse</span>
                <ChevronUp size={14} aria-hidden="true" />
              </>
            ) : (
              <>
                <span>Expand</span>
                <ChevronDown size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          2. CONNECTED LIFECYCLE PATH & STAGES
          ==================================================================== */}
      {isExpanded && (
        <div id="lqf-flow-body" className="lqf-flow-body">
          {/* Continuous Connected Lifecycle Track */}
          <div className="lqf-track-container" role="presentation">
            <div className="lqf-track-line" aria-hidden="true" />
            <div className="lqf-track-stages">
              {/* 01 PRODUCE */}
              <div className={`lqf-track-node-wrapper ${activeStageKey === 'produce' ? 'is-active' : ''}`}>
                <div className="lqf-track-label-group">
                  <span className="lqf-track-number">01</span>
                  <span className="lqf-track-name">PRODUCE</span>
                </div>
                <div className="lqf-track-pin-wrapper">
                  <span className="lqf-node-dot" />
                </div>
              </div>

              {/* 02 QUEUE (Centerpiece) */}
              <div className={`lqf-track-node-wrapper lqf-queue-node ${activeStageKey === 'queue' ? 'is-active' : ''}`}>
                <div className="lqf-track-label-group">
                  <span className="lqf-track-number">02</span>
                  <span className="lqf-track-name">QUEUE</span>
                </div>
                <div className="lqf-track-pin-wrapper">
                  <span className="lqf-node-dot" />
                </div>
              </div>

              {/* 03 PREPARE */}
              <div className={`lqf-track-node-wrapper ${activeStageKey === 'prepare' ? 'is-active' : ''}`}>
                <div className="lqf-track-label-group">
                  <span className="lqf-track-number">03</span>
                  <span className="lqf-track-name">PREPARE</span>
                </div>
                <div className="lqf-track-pin-wrapper">
                  <span className="lqf-node-dot" />
                </div>
              </div>

              {/* 04 COMPLETE */}
              <div className={`lqf-track-node-wrapper ${activeStageKey === 'complete' ? 'is-active' : ''}`}>
                <div className="lqf-track-label-group">
                  <span className="lqf-track-number">04</span>
                  <span className="lqf-track-name">COMPLETE</span>
                </div>
                <div className="lqf-track-pin-wrapper">
                  <span className="lqf-node-dot" />
                </div>
              </div>
            </div>
          </div>

          {/* If the ENTIRE session is empty, show one unified message under the visible path */}
          {isEntirelyEmpty ? (
            <div className="lqf-unified-empty-state">
              <p className="lqf-unified-empty-title">Ready to show the order journey.</p>
              <p className="lqf-unified-empty-desc">
                Use the producer and consumer controls above, then press Play.
              </p>
            </div>
          ) : (
            <div className="lqf-stages-grid" role="region" aria-label="Order lifecycle stages">
              {/* -------------------------------------------------------------
                  STAGE 1: PRODUCE
                  ------------------------------------------------------------- */}
              <div className="lqf-stage-col lqf-col-produce">
                <div className="lqf-mobile-stage-head" aria-hidden="true">
                  <span className="lqf-mobile-stage-num">01</span>
                  <span className="lqf-mobile-stage-name">PRODUCE</span>
                </div>

                {producers.length === 0 ? (
                  <div className="lqf-quiet-placeholder">No active producers</div>
                ) : (
                  <div className="lqf-proc-compact-list" role="list">
                    {visibleProducers.map((proc) => {
                      const isSelected = selectedProcessId === proc.id;
                      return (
                        <button
                          key={proc.id}
                          type="button"
                          className={`lqf-proc-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (onSelectProcess) onSelectProcess(proc.id);
                            const rawProc = (state?.processes || []).find((p) => p.id === proc.id);
                            if (onInspectProcess && rawProc) onInspectProcess(rawProc);
                          }}
                          title={`Select ${proc.id} · ${proc.stateLabel}`}
                        >
                          <span className="lqf-proc-id">{proc.id}</span>
                          <span className="lqf-proc-bullet">·</span>
                          <span className={`lqf-proc-state state-${proc.stateKey.toLowerCase()}`}>
                            {proc.stateLabel}
                          </span>
                        </button>
                      );
                    })}

                    {producers.length > 4 && (
                      <button
                        type="button"
                        className="lqf-view-more-btn"
                        onClick={() => setShowAllProducers((v) => !v)}
                      >
                        {showAllProducers ? 'Show less' : `+${producers.length - 4} more`}
                      </button>
                    )}
                  </div>
                )}

                {/* Waiting Summary for Producers (Beneath Stage 1) */}
                {hasProducerWaiters && (
                  <div className="lqf-stage-wait-summary">
                    <span className="lqf-amber-dot" aria-hidden="true" />
                    <span className="lqf-wait-text">
                      {producerWaiters.length === 1 ? '1 producer' : `${producerWaiters.length} producers`} waiting for capacity
                    </span>
                    <button
                      type="button"
                      className="lqf-inline-link-btn"
                      onClick={() => setShowProducerWaitDetails((v) => !v)}
                      aria-expanded={showProducerWaitDetails}
                    >
                      {showProducerWaitDetails ? 'Hide' : 'Details'}
                    </button>
                  </div>
                )}

                {showProducerWaitDetails && hasProducerWaiters && (
                  <div className="lqf-wait-details-pop">
                    {producerWaiters.map((pw) => (
                      <span key={pw.id} className="lqf-waiter-chip">
                        #{pw.queuePosition} {pw.id} (wait empty)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------------
                  STAGE 2: SHARED QUEUE (Centerpiece Tray)
                  ------------------------------------------------------------- */}
              <div className="lqf-stage-col lqf-col-queue">
                <div className="lqf-mobile-stage-head" aria-hidden="true">
                  <span className="lqf-mobile-stage-num">02</span>
                  <span className="lqf-mobile-stage-name">QUEUE</span>
                </div>

                <div className="lqf-queue-subhead">
                  <span className="lqf-queue-flow-dir">
                    {bufferFifoOrders.length > 1
                      ? 'Front → Back'
                      : bufferFifoOrders.length === 1
                      ? 'Front'
                      : ''}
                  </span>
                  <span className="lqf-queue-occupancy">
                    {bufferOccupancy.occupied} of {bufferOccupancy.capacity} occupied
                  </span>
                </div>

                <div className="lqf-queue-tray">
                  {bufferFifoOrders.length === 0 ? (
                    <div className="lqf-tray-empty-text">Queue empty</div>
                  ) : (
                    <div className="lqf-tray-tickets-track" role="list" aria-label="Orders in logical FIFO order">
                      {bufferFifoOrders.map((ord, idx) => {
                        const isFront = idx === 0;
                        const isSelected = selectedSlotIndex === ord.physicalSlotIndex;
                        const isActiveEvent = activeOrderId === ord.id;

                        return (
                          <React.Fragment key={ord.id}>
                            <button
                              type="button"
                              className={`lqf-queue-ticket ${isFront ? 'is-front' : ''} ${isSelected ? 'selected' : ''} ${isActiveEvent ? 'is-active-event' : ''}`}
                              onClick={() => {
                                if (onSelectSlot) onSelectSlot(ord.physicalSlotIndex);
                              }}
                              title={`Slot [${ord.physicalSlotIndex}]: Order ${ord.id} (${ord.foodName}). Click to highlight in arena.`}
                            >
                              <div className="lqf-ticket-top">
                                <span className="lqf-ticket-id">{ord.id}</span>
                                {isFront && <span className="lqf-front-badge">Front</span>}
                              </div>
                              <span className="lqf-ticket-name">{ord.foodName}</span>
                              <span className="lqf-ticket-slot">Slot {ord.physicalSlotIndex}</span>
                            </button>

                            {idx < bufferFifoOrders.length - 1 && (
                              <div className="lqf-tray-arrow" aria-hidden="true">
                                →
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Waiting Summary for Consumers (Beneath Stage 2) */}
                {hasConsumerWaiters && (
                  <div className="lqf-stage-wait-summary">
                    <span className="lqf-amber-dot" aria-hidden="true" />
                    <div className="lqf-wait-col">
                      {consumerWaiters.length > 0 && (
                        <span className="lqf-wait-text">
                          {consumerWaiters.length === 1
                            ? '1 consumer'
                            : `${consumerWaiters.length} consumers`}{' '}
                          waiting for orders ({formatWaiters(consumerWaiters, 2)})
                        </span>
                      )}
                      {consumerMutexWaiters.length > 0 && (
                        <span className="lqf-wait-text">
                          {formatWaiters(consumerMutexWaiters, 2)} waiting for mutex · Item permit reserved
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="lqf-inline-link-btn"
                      onClick={() => setShowConsumerWaitDetails((v) => !v)}
                      aria-expanded={showConsumerWaitDetails}
                    >
                      {showConsumerWaitDetails ? 'Hide' : 'Details'}
                    </button>
                  </div>
                )}

                {showConsumerWaitDetails && hasConsumerWaiters && (
                  <div className="lqf-wait-details-pop">
                    {consumerWaiters.length > 0 && (
                      <div className="lqf-pop-group">
                        <span className="lqf-pop-label">Orders queue:</span>
                        {consumerWaiters.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className="lqf-waiter-chip"
                            onClick={() => {
                              if (onSelectProcess) onSelectProcess(w.id);
                              const raw = (state?.processes || []).find((p) => p.id === w.id);
                              if (onInspectProcess && raw) onInspectProcess(raw);
                            }}
                            title={`${w.id} blocked on sem_wait(&full)`}
                          >
                            #{w.queuePosition} {w.id}
                          </button>
                        ))}
                      </div>
                    )}
                    {consumerMutexWaiters.length > 0 && (
                      <div className="lqf-pop-group">
                        <span className="lqf-pop-label">Mutex queue:</span>
                        {consumerMutexWaiters.map((w) => (
                          <button
                            key={`mutex-${w.id}`}
                            type="button"
                            className="lqf-waiter-chip mutex"
                            onClick={() => {
                              if (onSelectProcess) onSelectProcess(w.id);
                              const raw = (state?.processes || []).find((p) => p.id === w.id);
                              if (onInspectProcess && raw) onInspectProcess(raw);
                            }}
                            title={`${w.id} holds full permit, waiting for pthread_mutex_lock`}
                          >
                            {w.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------------
                  STAGE 3: PREPARE
                  ------------------------------------------------------------- */}
              <div className="lqf-stage-col lqf-col-prepare">
                <div className="lqf-mobile-stage-head" aria-hidden="true">
                  <span className="lqf-mobile-stage-num">03</span>
                  <span className="lqf-mobile-stage-name">PREPARE</span>
                </div>

                <div className="lqf-stage-subhead">
                  <span>Active: {preparingAssignments.length}</span>
                </div>

                {preparingAssignments.length === 0 ? (
                  <div className="lqf-quiet-placeholder">No active preparation</div>
                ) : (
                  <div className="lqf-prep-compact-list" role="list">
                    {preparingAssignments.map((work) => {
                      const isActiveEvent = activeOrderId === work.orderId;
                      return (
                        <button
                          key={work.workerId}
                          type="button"
                          className={`lqf-prep-card ${isActiveEvent ? 'is-active-event' : ''}`}
                          onClick={() => {
                            if (onSelectProcess) onSelectProcess(work.workerId);
                            const raw = (state?.processes || []).find((p) => p.id === work.workerId);
                            if (onInspectProcess && raw) onInspectProcess(raw);
                          }}
                          title={`Inspect consumer ${work.workerId}`}
                        >
                          <div className="lqf-prep-top">
                            <span className="lqf-prep-worker-id">
                              {work.workerId} · {work.orderId}
                            </span>
                          </div>
                          <span className="lqf-prep-dish-name">{work.foodName}</span>
                          <div className="lqf-prep-progress-line">
                            <div className="lqf-prep-track">
                              <div
                                className="lqf-prep-fill"
                                style={{ width: `${work.progressPercent}%` }}
                              />
                            </div>
                            <span className="lqf-prep-ticks">
                              {work.remainingSteps} {work.remainingSteps === 1 ? 'tick' : 'ticks'} left
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------------
                  STAGE 4: COMPLETE
                  ------------------------------------------------------------- */}
              <div className="lqf-stage-col lqf-col-complete">
                <div className="lqf-mobile-stage-head" aria-hidden="true">
                  <span className="lqf-mobile-stage-num">04</span>
                  <span className="lqf-mobile-stage-name">COMPLETE</span>
                </div>

                <div className="lqf-stage-subhead">
                  <span>Total: {completedTotal}</span>
                </div>

                {completedOrders.length === 0 ? (
                  <div className="lqf-quiet-placeholder">No completed orders yet</div>
                ) : (
                  <div className="lqf-complete-compact-list" role="list">
                    {completedOrders.slice(0, 3).map((ord) => {
                      const isActiveEvent = activeOrderId === ord.id;
                      return (
                        <div
                          key={ord.id}
                          className={`lqf-complete-row ${isActiveEvent ? 'is-active-event' : ''}`}
                        >
                          <span className="lqf-complete-id">{ord.id} · {ord.foodName}</span>
                          <span className="lqf-complete-badge">Finished</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================================
              3. QUIET FOOTER (LATEST EVENT EXPLANATION)
              ================================================================== */}
          <footer className="lqf-footer">
            <div className="lqf-footer-main">
              <span className="lqf-event-heading">Latest event</span>
              <span className="lqf-event-text">{latestShortExplanation}</span>
            </div>
            {latestTechnicalDetails && (
              <button
                type="button"
                className="lqf-details-btn"
                onClick={() => setShowTechnicalDetails((v) => !v)}
                aria-expanded={showTechnicalDetails}
              >
                {showTechnicalDetails ? 'Hide details' : 'View details'}
              </button>
            )}
          </footer>

          {showTechnicalDetails && latestTechnicalDetails && (
            <div className="lqf-tech-breakdown">
              <code>{latestTechnicalDetails}</code>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
