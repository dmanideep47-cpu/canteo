import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

const LESSONS = [
  {
    id: 'lesson-1',
    num: '01',
    title: 'Normal Order Journey',
    tag: 'COMPLETE CYCLE',
    desc: 'Observe the full cooperative synchronization sequence between Student Producer (P1) and Kitchen Consumer (C1).',
    steps: [
      { actor: 'P1 (Student)', op: 'sem_wait(&empty)', effect: 'Checks if free peg exists. empty decrements from 5 to 4.' },
      { actor: 'P1 (Student)', op: 'sem_wait(&mutex)', effect: 'Acquires critical section token. mutex: 1 → 0.' },
      { actor: 'P1 (Student)', op: 'buffer[tail] = order', effect: 'Deposits Order #1 (Masala Dosa) into slot 0.' },
      { actor: 'P1 (Student)', op: 'tail = (tail + 1) % 5', effect: 'Advances tail pointer modulo 5 to slot 1.' },
      { actor: 'P1 (Student)', op: 'sem_post(&mutex)', effect: 'Releases critical section token. mutex: 0 → 1.' },
      { actor: 'P1 (Student)', op: 'sem_post(&full)', effect: 'Signals available order to kitchen. full: 0 → 1.' },
      { actor: 'C1 (Kitchen)', op: 'sem_wait(&full)', effect: 'Claims ready order permit. full: 1 → 0.' },
      { actor: 'C1 (Kitchen)', op: 'sem_wait(&mutex)', effect: 'Acquires critical section token. mutex: 1 → 0.' },
      { actor: 'C1 (Kitchen)', op: 'order = buffer[head]', effect: 'Removes Order #1 ticket from slot 0.' },
      { actor: 'C1 (Kitchen)', op: 'head = (head + 1) % 5', effect: 'Advances head pointer modulo 5 to slot 1.' },
      { actor: 'C1 (Kitchen)', op: 'sem_post(&mutex)', effect: 'Releases critical section token. mutex: 0 → 1.' },
      { actor: 'C1 (Kitchen)', op: 'sem_post(&empty)', effect: 'Signals freed peg back to students. empty: 4 → 5.' },
      { actor: 'C1 (Kitchen)', op: 'cook_food()', effect: 'Prepares dish concurrently outside the lock!' },
    ],
    withoutSync: 'Without semaphores, consumer reads empty array (null pointer crash) or producer overwrites unconsumed orders.',
  },
  {
    id: 'lesson-2',
    num: '02',
    title: 'Counter Full (Producer Blocks)',
    tag: 'BACKPRESSURE & WAIT QUEUE',
    desc: 'Fill all 5 counter slots, then attempt to place a 6th order. Watch how the student thread is suspended without busy waiting.',
    steps: [
      { actor: 'System', op: 'Queue Saturation', effect: '5 students submit orders. All slots 0-4 are occupied (empty = 0, full = 5).' },
      { actor: 'P6 (Student)', op: 'sem_wait(&empty)', effect: 'Checks empty semaphore. empty is 0!' },
      { actor: 'OS Kernel', op: 'Thread Sleep', effect: 'P6 is placed in the passive wait queue. Consumes 0% CPU cycles (Zero busy-waiting).' },
      { actor: 'C1 (Kitchen)', op: 'sem_wait(&full)', effect: 'Kitchen takes an order from slot 0.' },
      { actor: 'C1 (Kitchen)', op: 'sem_post(&empty)', effect: 'Kitchen signals empty. OS awakens P6 in FIFO order!' },
      { actor: 'P6 (Student)', op: 'insert(order)', effect: 'P6 wakes up, claims freed slot 0, and deposits its order safely.' },
    ],
    withoutSync: 'Without sem_wait(&empty), P6 would overwrite slot 0, destroying a waiting student’s order.',
  },
  {
    id: 'lesson-3',
    num: '03',
    title: 'Counter Empty (Consumer Blocks)',
    tag: 'STARVATION PREVENTION',
    desc: 'Observe an empty counter where kitchen staff attempt to take an order and sleep peacefully until food is ordered.',
    steps: [
      { actor: 'System', op: 'Empty State', effect: 'Buffer is empty (empty = 5, full = 0). No orders are pending.' },
      { actor: 'C1 (Kitchen)', op: 'sem_wait(&full)', effect: 'Checks full semaphore. full is 0!' },
      { actor: 'OS Kernel', op: 'Thread Sleep', effect: 'C1 is suspended in the full wait queue without spinlock polling.' },
      { actor: 'P1 (Student)', op: 'insert(order)', effect: 'Student places Order #101.' },
      { actor: 'P1 (Student)', op: 'sem_post(&full)', effect: 'Student signals full. Kernel awakens C1!' },
      { actor: 'C1 (Kitchen)', op: 'remove(order)', effect: 'C1 resumes, dequeues Order #101, and cooks it.' },
    ],
    withoutSync: 'Without sem_wait(&full), C1 continuously spins in a while-loop burning 100% CPU cycles or reads garbage memory.',
  },
];

export default function SynchronizationLab({ onNavigateSection = () => {} }) {
  const [activeLessonId, setActiveLessonId] = useState('lesson-1');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const lesson = LESSONS.find((l) => l.id === activeLessonId) || LESSONS[0];
  const currentStep = lesson.steps[currentStepIndex] || lesson.steps[0];

  const handleNext = () => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, lesson.steps.length - 1));
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleReset = (id) => {
    setActiveLessonId(id);
    setCurrentStepIndex(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Lesson Selector Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {LESSONS.map((l) => {
          const isActive = l.id === activeLessonId;
          return (
            <div
              key={l.id}
              className={`sl2-concept-card ${isActive ? 'active-lesson' : ''}`}
              style={{
                cursor: 'pointer',
                borderColor: isActive ? 'var(--black-900)' : 'var(--white-300)',
                backgroundColor: isActive ? 'var(--white-0)' : 'var(--white-100)',
                boxShadow: isActive ? 'var(--shadow-md)' : 'none',
              }}
              onClick={() => handleReset(l.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--producer)' }}>
                  LESSON {l.num}
                </span>
                <span className="sl2-invariant-pill" style={{ fontSize: '9px', padding: '1px 6px' }}>{l.tag}</span>
              </div>
              <h4 style={{ fontSize: '15px' }}>{l.title}</h4>
              <p style={{ fontSize: '12px' }}>{l.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Main Interactive Stage for Lesson */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Step Sequence Trace */}
        <div className="sl2-card">
          <div className="sl2-card-header">
            <span className="sl2-card-title">
              INTERACTIVE STEP SEQUENCE <small>({currentStepIndex + 1} / {lesson.steps.length})</small>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="sl2-ctrl-btn"
                onClick={handlePrev}
                disabled={currentStepIndex === 0}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Previous
              </button>
              <button
                className="sl2-ctrl-btn primary"
                onClick={handleNext}
                disabled={currentStepIndex >= lesson.steps.length - 1}
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Next Step <ArrowRight size={12} />
              </button>
              <button
                className="sl2-ctrl-btn"
                onClick={() => setCurrentStepIndex(0)}
                style={{ padding: '4px 8px' }}
                title="Reset lesson"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          <div className="sl2-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lesson.steps.map((st, i) => {
              const isPast = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: isCurrent ? 'var(--white-200)' : 'transparent',
                    borderLeft: isCurrent ? '3px solid var(--producer)' : '3px solid transparent',
                    opacity: isPast ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--black-400)', width: '24px' }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '12px', width: '90px', color: 'var(--black-800)' }}>
                    {st.actor}
                  </span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--producer)', width: '160px' }}>
                    {st.op}
                  </code>
                  <span style={{ fontSize: '12px', color: 'var(--black-600)', flex: 1 }}>
                    {st.effect}
                  </span>
                  {isCurrent && <span className="sl2-status-dot" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lesson Analysis & Counter-Example Comparison */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Step Deep Dive */}
          <div className="sl2-card">
            <div className="sl2-card-header">
              <span className="sl2-card-title">ACTIVE OPERATION INSIGHT</span>
            </div>
            <div className="sl2-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sl2-state-badge running">{currentStep.actor}</span>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--producer)' }}>
                  {currentStep.op}
                </code>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--black-800)', lineHeight: 1.5 }}>
                {currentStep.effect}
              </p>
            </div>
          </div>

          {/* What Happens Without Synchronization */}
          <div className="sl2-card" style={{ borderColor: 'var(--error-border)', backgroundColor: 'var(--error-bg)' }}>
            <div className="sl2-card-header" style={{ backgroundColor: 'transparent', borderBottomColor: 'var(--error-border)' }}>
              <span className="sl2-card-title" style={{ color: 'var(--error)' }}>
                <AlertTriangle size={14} /> WHAT HAPPENS WITHOUT SYNCHRONIZATION?
              </span>
            </div>
            <div className="sl2-card-body">
              <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5, color: '#7F1D1D' }}>
                {lesson.withoutSync}
              </p>
            </div>
          </div>

          {/* Invariant Guarantee */}
          <div className="sl2-card">
            <div className="sl2-card-header">
              <span className="sl2-card-title">
                <ShieldCheck size={14} color="var(--consumer)" /> OPERATING SYSTEM GUARANTEE
              </span>
            </div>
            <div className="sl2-card-body">
              <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.5, color: 'var(--black-600)' }}>
                Mutual exclusion serializes updates to shared pointers (<code>head</code> and <code>tail</code>).
                Counting semaphores maintain strict resource limits. Threads sleep passively in kernel queues with zero CPU consumption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

