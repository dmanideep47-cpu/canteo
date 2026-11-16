import React, { useState } from 'react';
import { BookOpen, HelpCircle, CheckCircle, Award, FileText } from 'lucide-react';

const VIVA_QUESTIONS = [
  {
    id: 1,
    q: 'What is the Producer–Consumer Problem?',
    a: 'A classic synchronization challenge where two classes of processes—producers (which generate data and insert into a shared buffer) and consumers (which extract data and process it)—share a fixed-capacity buffer. The system must prevent buffer overflow, buffer underflow, race collisions, and deadlock without busy-waiting.',
  },
  {
    id: 2,
    q: 'Why is a bounded buffer required in real systems?',
    a: 'Real hardware has finite memory. A bounded buffer of capacity N decouples producer and consumer processing speeds while providing backpressure: if producers run faster than consumers, the buffer prevents unbounded memory growth by suspending producers once N slots are filled.',
  },
  {
    id: 3,
    q: 'Why do we need all three primitives: empty, full, and mutex?',
    a: 'empty (counting semaphore) tracks free buffer bays to prevent overflow. full (counting semaphore) tracks ready items to prevent underflow. mutex (binary semaphore) provides mutual exclusion to prevent race conditions during pointer and array modification. Counting semaphores do not protect pointers from concurrent access.',
  },
  {
    id: 4,
    q: 'What happens if we remove the mutex lock?',
    a: 'A race condition occurs. If two producers or two consumers access shared pointers (head or tail) concurrently, one process will overwrite the other’s pointer update. In the canteen, this causes duplicate order claims (two workers take the same order) or lost updates (one order overwrites another in the same slot).',
  },
  {
    id: 5,
    q: 'What happens if we remove empty or full?',
    a: 'Removing empty allows producers to write beyond buffer capacity N, overwriting existing unconsumed items (buffer overflow). Removing full allows consumers to read from empty slots, reading null or garbage memory (buffer underflow).',
  },
  {
    id: 6,
    q: 'What is a race condition?',
    a: 'A flaw in concurrent execution where the system outcome depends unpredictably on the uncontrollable execution interleaving or scheduling order of two or more threads accessing shared state without proper synchronization.',
  },
  {
    id: 7,
    q: 'What is busy waiting, and why is it undesirable?',
    a: 'Busy waiting occurs when a thread repeatedly loops testing a condition (e.g. while(queue.isFull())) while waiting. It is undesirable because it wastes 100% CPU cycles doing no productive work. POSIX semaphores solve this by putting waiting threads into passive kernel sleep queues (0% CPU).',
  },
  {
    id: 8,
    q: 'What is a critical section?',
    a: 'The segment of code that accesses shared resources (shared array buffer, readPosition, writePosition) that must not be concurrently executed by more than one process at any given moment.',
  },
  {
    id: 9,
    q: 'Why must sem_wait(&empty) precede sem_wait(&mutex)?',
    a: 'To prevent deadlock! If a producer acquires mutex first and then finds empty == 0, it will block while still holding the mutex. The consumer will subsequently attempt to acquire mutex to remove an order, but will block on the mutex held by the producer. Both processes are deadlocked forever.',
  },
  {
    id: 10,
    q: 'What is the system invariant of the bounded buffer?',
    a: 'At all times during execution: empty + full + reservedEmpty + reservedFull = 5. In quiescent boundaries between operations, this simplifies to empty + full = 5. Permits are mathematically conserved and neither created nor lost.',
  },
];

export default function VivaMode() {
  const [revealedIds, setRevealedIds] = useState(new Set([1, 2, 3]));
  const [filter, setFilter] = useState('all');

  const toggleReveal = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const revealAll = () => {
    setRevealedIds(new Set(VIVA_QUESTIONS.map((q) => q.id)));
  };

  const hideAll = () => {
    setRevealedIds(new Set());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', color: 'var(--black-950)' }}>
            Operating Systems Viva & Exam Preparation Mode
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--black-500)', margin: 0 }}>
            Master the 10 most common professor examination questions on semaphores, bounded buffers, and concurrency.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="sl2-ctrl-btn" onClick={revealAll}>
            Reveal All Answers
          </button>
          <button className="sl2-ctrl-btn" onClick={hideAll}>
            Hide All (Quiz Mode)
          </button>
        </div>
      </div>

      {/* Quick Revision Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div className="sl2-concept-card" style={{ padding: '12px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--producer)' }}>PRIMITIVE 1</span>
          <b style={{ fontSize: '13px' }}>empty = 5</b>
          <span style={{ fontSize: '11px', color: 'var(--black-500)' }}>Counts free slots. Blocks producers when 0.</span>
        </div>
        <div className="sl2-concept-card" style={{ padding: '12px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--consumer)' }}>PRIMITIVE 2</span>
          <b style={{ fontSize: '13px' }}>full = 0</b>
          <span style={{ fontSize: '11px', color: 'var(--black-500)' }}>Counts ready orders. Blocks consumers when 0.</span>
        </div>
        <div className="sl2-concept-card" style={{ padding: '12px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--critical)' }}>PRIMITIVE 3</span>
          <b style={{ fontSize: '13px' }}>mutex = 1</b>
          <span style={{ fontSize: '11px', color: 'var(--black-500)' }}>Binary lock. Serializes pointer modification.</span>
        </div>
        <div className="sl2-concept-card" style={{ padding: '12px 14px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--black-700)' }}>INVARIANT</span>
          <b style={{ fontSize: '13px' }}>empty + full = 5</b>
          <span style={{ fontSize: '11px', color: 'var(--black-500)' }}>Permit conservation law at all quiescent steps.</span>
        </div>
      </div>

      {/* 10 Viva Cards Grid */}
      <div className="sl2-viva-grid">
        {VIVA_QUESTIONS.map((item) => {
          const isRevealed = revealedIds.has(item.id);

          return (
            <div key={item.id} className="sl2-viva-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="sl2-viva-q-num">QUESTION {String(item.id).padStart(2, '0')}</span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--producer)', fontWeight: 600 }}
                  onClick={() => toggleReveal(item.id)}
                >
                  {isRevealed ? 'Hide Answer' : 'Show Answer'}
                </button>
              </div>

              <h4 className="sl2-viva-q">{item.q}</h4>

              {isRevealed ? (
                <p className="sl2-viva-a">{item.a}</p>
              ) : (
                <div
                  style={{
                    backgroundColor: 'var(--white-200)',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    color: 'var(--black-400)',
                    fontStyle: 'italic',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                  onClick={() => toggleReveal(item.id)}
                >
                  Click to test your memory and reveal the answer
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

