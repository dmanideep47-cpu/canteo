import { useState, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import {
  evaluateSchedulerTurn,
  explainSchedulerStep,
} from './classroomExperiments.js';

export function ManualSchedulingExercise({ engine, state, refresh, onInteraction }) {
  const [exerciseState, setExerciseState] = useState({
    decisions: [],
    lastDecision: null,
    rejectedAlert: null,
  });

  const processes = state?.processes || [];
  const consumers = processes.filter((p) => p.type === 'CONSUMER');

  // Evaluate runnable vs blocked for each consumer
  const consumerStatuses = useMemo(() => {
    return consumers.map((c) => {
      const isBlocked = c.state === 'BLOCKED' || c.state === 'WAITING';
      const isCompleted = c.state === 'COMPLETED';
      const isPreparing = state.workers?.some((w) => w.id === c.id && w.state === 'PREPARING');
      const isRunnable = !isBlocked && !isCompleted;

      let blockedReason = null;
      if (isBlocked) {
        if (c.waitingFor === 'full') {
          blockedReason = 'Blocked waiting for an available order: wait(full) blocked because full == 0.';
        } else if (c.waitingFor === 'mutex') {
          blockedReason = `Blocked on critical section entry: mutex is currently owned by ${state.mutexOwner ?? 'another thread'}.`;
        } else if (c.waitingFor === 'empty') {
          blockedReason = 'Blocked on wait(empty).';
        } else {
          blockedReason = 'Blocked on synchronization resource.';
        }
      }

      const nextOp = c.pc === 0 ? 'wait(full)'
        : c.pc === 1 ? 'wait(mutex)'
        : c.pc === 2 ? 'remove order'
        : c.pc === 3 ? 'advance read pointer'
        : c.pc === 4 ? 'release(mutex)'
        : c.pc === 5 ? 'signal(empty)'
        : 'Completed';

      return {
        id: c.id,
        state: c.state,
        pc: c.pc,
        permit: Boolean(c.permit),
        isRunnable,
        isBlocked,
        isPreparing,
        isCompleted,
        blockedReason,
        nextOp,
      };
    });
  }, [consumers, state.workers, state.mutexOwner]);

  // Check if exercise goal is achieved: both consumers removed an order safely
  const removals = (state?.events || []).filter((e) => e.operation === 'remove' && e.processId?.startsWith('C'));
  const distinctConsumers = new Set(removals.map((e) => e.processId)).size;
  const isCompleted = distinctConsumers >= 2 && state?.mutexOwner === null && (state?.integrity?.passed ?? true);

  const handleReset = useCallback(() => {
    engine.reset();
    engine.addProducer(2);
    engine.runUntilBlocked(); // Buffer loaded with 2 orders (ORD101, ORD102)
    engine.addConsumer(2); // C1 and C2 ready at pc=0
    engine.clearHistory('Manual Scheduling Exercise initialized');
    setExerciseState({
      decisions: [],
      lastDecision: null,
      rejectedAlert: null,
    });
    refresh();
    onInteraction();
  }, [engine, refresh, onInteraction]);

  const handleDispatchProcess = useCallback((processId) => {
    // 1. Evaluate validity
    const evaluation = evaluateSchedulerTurn(engine, processId);
    if (!evaluation.valid) {
      setExerciseState((prev) => ({
        ...prev,
        rejectedAlert: {
          processId,
          reason: evaluation.rejectionReason,
          timestamp: Date.now(),
        },
      }));
      return;
    }

    // 2. Capture state before
    const beforeState = engine.snapshot();
    const targetProcess = beforeState.processes.find((p) => p.id === processId);
    const op = targetProcess?.instructions?.[targetProcess.pc]?.op ?? 'step';

    // 3. Execute one instruction
    engine.stepNextInstruction(processId);
    const afterState = engine.snapshot();

    // 4. Generate structured conceptual explanation
    const explanation = explainSchedulerStep(op, processId, beforeState, afterState);

    const decisionRecord = {
      step: beforeState.executionHistory.length + 1,
      processId,
      op,
      explanation,
      valid: true,
      timestamp: Date.now(),
    };

    setExerciseState((prev) => ({
      decisions: [...prev.decisions, decisionRecord],
      lastDecision: decisionRecord,
      rejectedAlert: null,
    }));

    refresh();
    onInteraction();
  }, [engine, refresh, onInteraction]);

  return (
    <div className="sl-manual-scheduling-panel">
      <div className="sl-panel-header">
        <div className="sl-panel-header-titles">
          <span className="sl-eyebrow">CHALLENGE WORKBENCH · INTERACTIVE SCHEDULER</span>
          <h3>Manual Scheduling Exercise: Schedule Two Consumers Safely</h3>
          <p>
            You are the operating system thread scheduler. Select which eligible process takes the next execution step.
            Coordinate Consumer C1 and Consumer C2 so that both safely retrieve their orders without race hazards, underflow, or deadlocks.
          </p>
        </div>
        <button className="sl-btn small" onClick={handleReset} title="Reset simulation state to start of challenge">
          <RotateCcw size={14} /> Restart Exercise
        </button>
      </div>

      {/* Top Status Metrics */}
      <div className="sl-scheduler-metrics">
        <div className="sl-metric-card">
          <span>Buffer Orders</span>
          <strong>{state.occupancy} / {state.capacity}</strong>
          <small>{state.full} available permits</small>
        </div>
        <div className="sl-metric-card">
          <span>Mutex Lock</span>
          <strong className={state.mutexOwner ? 'danger-text' : 'success-text'}>
            {state.mutexOwner ? `Locked by ${state.mutexOwner}` : '1 (Unlocked / Free)'}
          </strong>
          <small>{state.mutexOwner ? 'Critical section occupied' : 'Available for acquisition'}</small>
        </div>
        <div className="sl-metric-card">
          <span>Orders Retrieved</span>
          <strong className={distinctConsumers >= 2 ? 'success-text' : ''}>
            {distinctConsumers} / 2
          </strong>
          <small>{distinctConsumers >= 2 ? 'Both consumers satisfied' : 'Awaiting retrieval'}</small>
        </div>
        <div className="sl-metric-card">
          <span>System Integrity</span>
          <strong className={state.integrity?.passed ? 'success-text' : 'danger-text'}>
            {state.integrity?.passed ? 'PASS · 0 Violations' : 'Integrity Issue'}
          </strong>
          <small>Continuous invariant checks</small>
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {exerciseState.rejectedAlert && (
        <div className="sl-scheduler-alert rejected" role="alert">
          <div className="sl-alert-icon">
            <ShieldAlert size={20} />
          </div>
          <div className="sl-alert-body">
            <b>Scheduler Action Rejected</b>
            <p>{exerciseState.rejectedAlert.reason}</p>
          </div>
          <button
            className="sl-alert-dismiss"
            onClick={() => setExerciseState((prev) => ({ ...prev, rejectedAlert: null }))}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Banner */}
      {isCompleted && (
        <div className="sl-scheduler-alert success" role="status">
          <div className="sl-alert-icon">
            <ShieldCheck size={22} />
          </div>
          <div className="sl-alert-body">
            <b>Challenge Completed Successfully!</b>
            <p>
              Both Consumer C1 and Consumer C2 safely retrieved their orders without race conditions, pointer corruption, or duplicate claims.
              The critical section remained strictly serialized by the mutex, and order integrity passed all checks.
            </p>
          </div>
        </div>
      )}

      {/* Scheduler Dispatch Grid */}
      <div className="sl-scheduler-dispatch-grid">
        {/* Left Column: Consumer Status & Action Buttons */}
        <div className="sl-scheduler-col">
          <h4 className="sl-subheading">Thread Scheduler Dispatcher</h4>
          <div className="sl-consumer-cards">
            {consumerStatuses.map((c) => (
              <div
                key={c.id}
                className={`sl-consumer-card ${c.isBlocked ? 'is-blocked' : c.isRunnable ? 'is-runnable' : 'is-idle'}`}
              >
                <div className="sl-consumer-card-header">
                  <div>
                    <span className="sl-process-id-badge">{c.id}</span>
                    <span className="sl-consumer-role">Kitchen Worker</span>
                  </div>
                  <span className={`sl-status-pill ${c.isBlocked ? 'blocked' : c.isRunnable ? 'runnable' : 'idle'}`}>
                    {c.state}
                  </span>
                </div>

                <div className="sl-consumer-card-body">
                  <div className="sl-card-row">
                    <span>Item Permit Held:</span>
                    <strong>{c.permit ? 'Yes (Full permit granted)' : 'No (Awaiting permit)'}</strong>
                  </div>
                  <div className="sl-card-row">
                    <span>Next Instruction:</span>
                    <code>{c.nextOp}</code>
                  </div>
                  {c.isBlocked && (
                    <div className="sl-blocked-explanation">
                      <AlertCircle size={14} />
                      <span>{c.blockedReason}</span>
                    </div>
                  )}
                  {c.isPreparing && (
                    <div className="sl-preparing-note">
                      <Utensils size={14} />
                      <span>Order retrieved! Worker is preparing dish outside the mutex lock.</span>
                    </div>
                  )}
                </div>

                <div className="sl-consumer-card-footer">
                  <button
                    className={`sl-btn primary ${c.isBlocked ? 'disabled-attempt' : ''}`}
                    onClick={() => handleDispatchProcess(c.id)}
                    disabled={isCompleted || c.isCompleted}
                    title={c.isBlocked ? 'Attempting to dispatch a blocked thread will be rejected by the scheduler' : `Dispatch ${c.id}`}
                  >
                    <Play size={13} /> Dispatch {c.id}: {c.nextOp}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Explain This Step & Conceptual Feedback */}
        <div className="sl-scheduler-col">
          <h4 className="sl-subheading">Explain This Step · Real-Time OS Feedback</h4>
          {exerciseState.lastDecision ? (
            <div className="sl-step-explanation-box">
              <div className="sl-explanation-header">
                <span className="sl-eyebrow">STEP {exerciseState.lastDecision.step} COMPLETED</span>
                <b>{exerciseState.lastDecision.processId} executed {exerciseState.lastDecision.op}</b>
              </div>
              <p className="sl-explanation-text">{exerciseState.lastDecision.explanation}</p>
              <div className="sl-explanation-theory">
                <span className="sl-theory-tag">OS Concept</span>
                <small>
                  {exerciseState.lastDecision.op === 'waitMutex'
                    ? 'Mutual Exclusion (Mutex) — Guarantees atomic updates to the shared circular buffer index.'
                    : exerciseState.lastDecision.op === 'waitFull'
                    ? 'Counting Semaphore — Tracks resource availability to prevent buffer underflow.'
                    : exerciseState.lastDecision.op === 'releaseMutex'
                    ? 'Lock Release & Signaling — Hands off critical section access in strict FIFO order.'
                    : exerciseState.lastDecision.op === 'remove'
                    ? 'Critical Section Execution — Protected order handoff without concurrent interference.'
                    : 'Process Scheduling — CPU dispatches runnable threads while preserving resource safety.'}
                </small>
              </div>
            </div>
          ) : (
            <div className="sl-step-placeholder">
              <HelpCircle size={28} />
              <p>Select a process button to execute its next instruction and view the step-by-step operating system explanation.</p>
            </div>
          )}

          {/* Decision History Log */}
          {exerciseState.decisions.length > 0 && (
            <div className="sl-decisions-history">
              <h5>Recent Scheduler Actions ({exerciseState.decisions.length})</h5>
              <div className="sl-decisions-list">
                {exerciseState.decisions.slice(-5).reverse().map((d, idx) => (
                  <div key={idx} className="sl-decision-row">
                    <span className="sl-step-seq">#{d.step}</span>
                    <strong className="sl-proc-tag">{d.processId}</strong>
                    <code className="sl-op-code">{d.op}</code>
                    <span className="sl-decision-desc">{d.explanation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
