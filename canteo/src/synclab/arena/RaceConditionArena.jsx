import React, { useState, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  SkipForward,
  RotateCcw,
} from 'lucide-react';
import { CircularBuffer } from './CircularBuffer.jsx';

const RACE_STEPS = [
  {
    step: 1,
    title: 'P1 reads writePosition = 0',
    proc: 'P1',
    action: 'Student P1 reads shared pointer: writePosition is 0.',
    slotState: [null, null, null, null, null],
    writePos: 0,
    overwritten: false,
  },
  {
    step: 2,
    title: 'Preemption: P2 reads writePosition = 0',
    proc: 'P2',
    action: 'Scheduler context switch preempts P1 before it can write. Student P2 also reads writePosition = 0.',
    slotState: [null, null, null, null, null],
    writePos: 0,
    overwritten: false,
  },
  {
    step: 3,
    title: 'P1 writes Order A to slot [0]',
    proc: 'P1',
    action: 'Student P1 writes Order A to slot 0 and advances its local pointer to 1.',
    slotState: [{ id: 'OA', orderId: 'ORD #A', foodName: 'Masala Dosa', producer: 'P1' }, null, null, null, null],
    writePos: 1,
    overwritten: false,
  },
  {
    step: 4,
    title: 'P2 writes Order B to slot [0] — Overwrite',
    proc: 'P2',
    action: 'Student P2 writes Order B using its stale writePosition = 0. Order A is replaced before the kitchen can dequeue it.',
    slotState: [{ id: 'OB', orderId: 'ORD #B', foodName: 'Idli & Sambar', producer: 'P2' }, null, null, null, null],
    writePos: 1,
    overwritten: true,
  },
];

const PROTECTED_STEPS = [
  {
    step: 1,
    title: 'P1 acquires mutex lock',
    proc: 'P1',
    action: 'Student P1 calls pthread_mutex_lock(&mutex) and enters Critical Section.',
    mutexOwner: 'P1',
    slotState: [null, null, null, null, null],
    writePos: 0,
  },
  {
    step: 2,
    title: 'P2 attempts mutex — Blocked',
    proc: 'P2',
    action: 'Student P2 calls pthread_mutex_lock(&mutex). Because the lock is held by P1, P2 sleeps on the mutex waitlist.',
    mutexOwner: 'P1',
    slotState: [null, null, null, null, null],
    writePos: 0,
  },
  {
    step: 3,
    title: 'P1 commits Order A and releases mutex',
    proc: 'P1',
    action: 'Student P1 writes Order A to slot 0, updates writePosition = 1, and releases the mutex.',
    mutexOwner: null,
    slotState: [{ id: 'OA', orderId: 'ORD #A', foodName: 'Masala Dosa', producer: 'P1' }, null, null, null, null],
    writePos: 1,
  },
  {
    step: 4,
    title: 'P2 awakens, acquires mutex and writes Order B',
    proc: 'P2',
    action: 'Student P2 acquires the released lock, reads the updated writePosition = 1, and safely writes Order B to slot 1. Both orders are preserved.',
    mutexOwner: 'P2',
    slotState: [
      { id: 'OA', orderId: 'ORD #A', foodName: 'Masala Dosa', producer: 'P1' },
      { id: 'OB', orderId: 'ORD #B', foodName: 'Idli & Sambar', producer: 'P2' },
      null, null, null
    ],
    writePos: 2,
  },
];

export function RaceConditionArena({ onBackToNormal = () => {} }) {
  const [isProtected, setIsProtected] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = isProtected ? PROTECTED_STEPS : RACE_STEPS;
  const currentStep = steps[stepIndex] ?? steps[0];
  const isFinished = stepIndex >= steps.length - 1;

  const handleStep = useCallback(() => {
    setStepIndex((curr) => Math.min(curr + 1, steps.length - 1));
  }, [steps.length]);

  const handleReset = useCallback(() => {
    setStepIndex(0);
  }, []);

  const handleToggleProtection = useCallback((protectedMode) => {
    setIsProtected(protectedMode);
    setStepIndex(0);
  }, []);

  const bufferState = {
    occupancy: currentStep.slotState.filter(Boolean).length,
    writePosition: currentStep.writePos ?? 0,
    readPosition: 0,
    mutexOwner: isProtected ? currentStep.mutexOwner : null,
    buffer: {
      capacity: 5,
      occupancy: currentStep.slotState.filter(Boolean).length,
      slots: currentStep.slotState,
      writePosition: currentStep.writePos ?? 0,
      readPosition: 0,
    },
    slots: currentStep.slotState,
    empty: 5 - currentStep.slotState.filter(Boolean).length,
    full: currentStep.slotState.filter(Boolean).length,
  };

  const raceState = {
    protected: isProtected,
    buffer: currentStep.slotState,
    writePosition: currentStep.writePos ?? 0,
    readPosition: 0,
    mutexOwner: isProtected ? currentStep.mutexOwner : null,
    overwritten: (!isProtected && currentStep.overwritten) ? [0] : [],
  };

  return (
    <div className="arena-race-container">
      {/* Mode Bar */}
      <div className="arena-race-bar">
        <div className="race-bar-info">
          {isProtected ? (
            <ShieldCheck size={16} className="text-emerald-600" />
          ) : (
            <ShieldAlert size={16} className="text-zinc-600" />
          )}
          <span className="race-bar-title">
            {isProtected ? 'Protected Mode (with Mutex)' : 'Unsafe Mode (without Mutex)'}
          </span>
          <span className="race-bar-desc">
            {isProtected
              ? 'pthread_mutex_lock strictly serializes buffer updates.'
              : 'Concurrent threads modify shared writePosition without mutual exclusion.'}
          </span>
        </div>

        <div className="race-bar-toggles">
          <button
            className={`race-toggle-btn ${!isProtected ? 'active' : ''}`}
            onClick={() => handleToggleProtection(false)}
          >
            Unsafe
          </button>
          <button
            className={`race-toggle-btn ${isProtected ? 'active' : ''}`}
            onClick={() => handleToggleProtection(true)}
          >
            Protected
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="arena-race-workspace">
        {/* Left: Precise Step Card */}
        <div className="arena-race-card">
          <div className="race-card-header">
            <span className="race-card-step">Step {stepIndex + 1} of {steps.length}</span>
            <span className="race-card-proc">{currentStep.proc}</span>
          </div>

          <h3 className="race-card-title">{currentStep.title}</h3>
          <p className="race-card-action">{currentStep.action}</p>

          {!isProtected && currentStep.overwritten && (
            <div className="race-card-failure">
              <strong>Order overwritten</strong>
              <p>
                P2 wrote to slot 0 using a stale index. The order previously written by P1 was replaced before dequeue.
              </p>
            </div>
          )}

          {isProtected && isFinished && (
            <div className="race-card-success">
              <strong>Orders preserved</strong>
              <p>
                Mutex serialized critical sections. Both Order A and Order B are queued without loss.
              </p>
            </div>
          )}

          <div className="race-card-controls">
            <button
              className="race-step-btn"
              onClick={handleStep}
              disabled={isFinished}
            >
              <SkipForward size={13} />
              <span>{isFinished ? 'Completed' : 'Step'}</span>
            </button>

            <button
              className="race-reset-btn"
              onClick={handleReset}
              title="Reset sequence"
            >
              <RotateCcw size={13} />
              <span>Replay</span>
            </button>
          </div>
        </div>

        {/* Center: Buffer Visualization */}
        <div className="arena-race-counter">
          <CircularBuffer
            state={bufferState}
            raceMode={true}
            raceState={raceState}
          />
        </div>
      </div>
    </div>
  );
}
