import React, { useState } from 'react';
import { Play, RotateCcw, AlertOctagon, CheckCircle2, LockKeyhole, Unlock, Users } from 'lucide-react';

export default function RaceConditionLab() {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    {
      step: 1,
      title: 'Initial State: Order Waiting in Slot 0',
      unsafe: 'Order #1 (Masala Dosa) is at slot 0. Both Worker C1 and Worker C2 arrive simultaneously.',
      safe: 'Order #1 (Masala Dosa) is at slot 0. Both Worker C1 and Worker C2 arrive simultaneously.',
      unsafePtr: 0,
      safePtr: 0,
    },
    {
      step: 2,
      title: 'Reading the Head Pointer',
      unsafe: 'C1 reads readPosition = 0. Concurrently, C2 ALSO reads readPosition = 0 before C1 can update it!',
      safe: 'C1 acquires mutex lock and enters critical section. C2 attempts sem_wait(&mutex) and is BLOCKED.',
      unsafePtr: 0,
      safePtr: 0,
      c2Blocked: true,
    },
    {
      step: 3,
      title: 'Claiming the Food Order',
      unsafe: 'C1 claims Order #1. Concurrently, C2 ALSO claims Order #1 from slot 0! (DUPLICATE CLAIM)',
      safe: 'C1 removes Order #1, advances readPosition to 1, and releases mutex. C2 is awakened and enters CS.',
      unsafePtr: 0,
      safePtr: 1,
      duplicateClaim: true,
    },
    {
      step: 4,
      title: 'Pointer Advance & Final Resolution',
      unsafe: 'Both workers increment their local pointers. Order #1 was cooked twice; Order #2 was skipped and lost!',
      safe: 'C2 safely claims Order #2 from slot 1. Both orders are fulfilled exactly once with zero collisions.',
      unsafePtr: 1,
      safePtr: 2,
      fault: true,
      safeSuccess: true,
    },
  ];

  const current = steps[stepIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Race Header & Interactive Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', color: 'var(--black-950)' }}>
            Race Condition Laboratory: The Concurrent Claim Fault
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--black-500)', margin: 0 }}>
            Side-by-side execution trace demonstrating how two kitchen workers corrupt shared queue memory without mutex protection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="sl2-ctrl-btn primary"
            onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
            disabled={stepIndex >= steps.length - 1}
          >
            <Play size={13} /> Step Interleaving ({stepIndex + 1}/4)
          </button>
          <button
            className="sl2-ctrl-btn"
            onClick={() => setStepIndex(0)}
            title="Reset Race"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Split-Screen Arena */}
      <div className="sl2-race-split-grid">
        {/* Left Pane: Mode A (Without Mutex) */}
        <div className="sl2-race-pane unsafe">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sl2-race-badge unsafe">
              <Unlock size={11} style={{ display: 'inline', marginRight: '4px' }} /> MODE A: WITHOUT MUTEX (UNPROTECTED)
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--error)' }}>
              Step {current.step} / 4
            </span>
          </div>

          <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--black-900)' }}>{current.title}</h3>

          <div style={{ backgroundColor: 'var(--white-100)', padding: '14px', borderRadius: '8px', border: '1px solid var(--white-400)', minHeight: '80px', fontSize: '13px', lineHeight: 1.5 }}>
            {current.unsafe}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--white-200)', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <span>Shared readPosition: <b>Slot {current.unsafePtr}</b></span>
            <span>Critical Section: <b style={{ color: 'var(--error)' }}>UNENFORCED</b></span>
          </div>

          {current.fault ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: '8px', color: 'var(--error)' }}>
              <AlertOctagon size={20} />
              <div style={{ fontSize: '12px' }}>
                <b>RACE CONDITION DETECTED: DUPLICATE CLAIM FAULT</b>
                <div>Both workers claimed Order #1. Order #2 was permanently lost due to concurrent unsynchronized reads.</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11.5px', color: 'var(--black-400)' }}>
              Advancing concurrent read of <code>readPosition</code> without locking...
            </div>
          )}
        </div>

        {/* Right Pane: Mode B (With Mutex) */}
        <div className="sl2-race-pane safe">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sl2-race-badge safe">
              <LockKeyhole size={11} style={{ display: 'inline', marginRight: '4px' }} /> MODE B: WITH MUTEX (SERIALIZED)
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--consumer)' }}>
              Step {current.step} / 4
            </span>
          </div>

          <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--black-900)' }}>{current.title}</h3>

          <div style={{ backgroundColor: 'var(--white-100)', padding: '14px', borderRadius: '8px', border: '1px solid var(--white-400)', minHeight: '80px', fontSize: '13px', lineHeight: 1.5 }}>
            {current.safe}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--white-200)', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            <span>Shared readPosition: <b>Slot {current.safePtr}</b></span>
            <span>Critical Section: <b style={{ color: 'var(--consumer)' }}>MUTEX PROTECTED</b></span>
          </div>

          {current.safeSuccess ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', backgroundColor: 'var(--consumer-bg)', border: '1px solid var(--consumer-border)', borderRadius: '8px', color: 'var(--consumer)' }}>
              <CheckCircle2 size={20} />
              <div style={{ fontSize: '12px' }}>
                <b>MUTEX SERIALIZATION SUCCESSFUL</b>
                <div>Worker C1 and Worker C2 were serialized. Every order consumed exactly once with zero race faults.</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11.5px', color: 'var(--black-400)' }}>
              Strict mutual exclusion prevents Worker C2 from reading stale pointer values.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

