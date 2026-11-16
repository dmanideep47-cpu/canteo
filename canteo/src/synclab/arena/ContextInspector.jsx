import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Code2,
  ChevronDown,
  ChevronRight,
  Info,
  History,
} from 'lucide-react';

const PRODUCER_C_CODE = [
  { line: 1, code: 'void *student_producer(void *param) {' },
  { line: 2, code: '    order_t order = create_order();' },
  { line: 3, code: '    sem_wait(&empty);', pc: 0, comment: '/* Wait for available slot */' },
  { line: 4, code: '    pthread_mutex_lock(&mutex);', pc: 1, comment: '/* Enter critical section */' },
  { line: 5, code: '    buffer[write_pos] = order;', pc: 2, comment: '/* Store order atomically */' },
  { line: 6, code: '    write_pos = (write_pos + 1) % 5;', pc: 3, comment: '/* Advance pointer modulo 5 */' },
  { line: 7, code: '    pthread_mutex_unlock(&mutex);', pc: 4, comment: '/* Leave critical section */' },
  { line: 8, code: '    sem_post(&full);', pc: 5, comment: '/* Signal available order */' },
  { line: 9, code: '    return NULL;' },
  { line: 10, code: '}' },
];

const CONSUMER_C_CODE = [
  { line: 1, code: 'void *kitchen_consumer(void *param) {' },
  { line: 2, code: '    order_t order;' },
  { line: 3, code: '    sem_wait(&full);', pc: 0, comment: '/* Wait for available order */' },
  { line: 4, code: '    pthread_mutex_lock(&mutex);', pc: 1, comment: '/* Enter critical section */' },
  { line: 5, code: '    order = buffer[read_pos];', pc: 2, comment: '/* Dequeue order atomically */' },
  { line: 6, code: '    read_pos = (read_pos + 1) % 5;', pc: 3, comment: '/* Advance pointer modulo 5 */' },
  { line: 7, code: '    pthread_mutex_unlock(&mutex);', pc: 4, comment: '/* Free critical section */' },
  { line: 8, code: '    sem_post(&empty);', pc: 5, comment: '/* Signal available slot */' },
  { line: 9, code: '    prepare_food(order);', pc: -1, comment: '/* Prepares outside lock */' },
  { line: 10, code: '    return NULL;' },
  { line: 11, code: '}' },
];

export function ContextInspector({
  isOpen = false,
  mode = 'concurrency', // 'concurrency' | 'slot' | 'process' | 'activity'
  targetData = null,
  target = null,
  state = null,
  onClose = () => {},
}) {
  const resolvedTarget = targetData ?? target;

  // Support Escape key to close inspector
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside className="arena-inspector-overlay" aria-label="Contextual Inspector" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="arena-inspector-panel">
        {/* Header */}
        <div className="inspector-header">
          <div className="inspector-title-group">
            <span className="inspector-eyebrow">
              {mode === 'concurrency' && 'SYNCHRONIZATION INSPECTOR'}
              {mode === 'slot' && 'BUFFER POSITION'}
              {mode === 'process' && 'THREAD CONTEXT'}
              {mode === 'activity' && 'EXECUTION TRACE'}
            </span>
            <h3 className="inspector-heading">
              {mode === 'concurrency' && 'Counting Semaphores & Mutex'}
              {mode === 'slot' && `Slot [${resolvedTarget?.index ?? 0}]`}
              {mode === 'process' && `${resolvedTarget?.id ?? 'Thread'} · ${resolvedTarget?.type === 'PRODUCER' ? 'Student' : 'Kitchen'}`}
              {mode === 'activity' && 'Event History'}
            </h3>
          </div>
          <button
            type="button"
            className="inspector-close-btn"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onClose();
              }
            }}
            data-testid="inspector-close-btn"
            aria-label="Close Inspector (Esc)"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="inspector-body">
          {mode === 'process' && (
            <ProcessDetailView
              process={(state?.processes || []).find((p) => p.id === resolvedTarget?.id) || resolvedTarget}
              state={state}
            />
          )}

          {mode === 'concurrency' && (
            <ConcurrencyDetailView state={state} />
          )}

          {mode === 'slot' && (
            <SlotDetailView
              slotData={{
                index: resolvedTarget?.index,
                slot: state?.slots?.[resolvedTarget?.index] ?? state?.buffer?.slots?.[resolvedTarget?.index] ?? resolvedTarget?.slot
              }}
              state={state}
            />
          )}

          {mode === 'activity' && (
            <ActivityDetailView state={state} />
          )}
        </div>
      </div>
    </aside>
  );
}

// -----------------------------------------------------------------------------
// PROCESS DETAIL VIEW
// -----------------------------------------------------------------------------
function ProcessDetailView({ process, state }) {
  const [showCode, setShowCode] = useState(false);
  const [showRegisters, setShowRegisters] = useState(false);

  if (!process) {
    return <div className="p-4 text-xs text-zinc-500">No process selected.</div>;
  }

  const isProducer = process.type === 'PRODUCER';
  const cCode = isProducer ? PRODUCER_C_CODE : CONSUMER_C_CODE;
  const currentPc = process.pc ?? 0;
  const isBlocked = process.state === 'BLOCKED' || process.state === 'WAITING';
  const isCritical = process.state === 'CRITICAL' || process.acquiredMutex;

  const emptyVal = typeof state?.empty === 'number' ? state.empty : (state?.empty?.value ?? 5);
  const fullVal = typeof state?.full === 'number' ? state.full : (state?.full?.value ?? 0);
  const mutexOwner = state?.mutexOwner ?? null;

  // 1. Identity & Status
  let statusLabel = 'Ready';
  if (isCritical) statusLabel = 'Critical Section (Mutex Held)';
  else if (isBlocked) {
    if (process.waitingFor === 'empty') statusLabel = 'Waiting for capacity';
    else if (process.waitingFor === 'full') statusLabel = 'Waiting for order';
    else if (process.waitingFor === 'mutex') statusLabel = 'Waiting for mutex lock';
    else statusLabel = 'Blocked';
  } else if (process.state === 'RUNNING') statusLabel = 'Running';
  else if (process.state === 'COMPLETED') statusLabel = 'Completed';

  // 2. Human-readable explanation
  let explanationText = '';
  if (isBlocked && process.waitingFor === 'empty') {
    explanationText = `All buffer slots are currently occupied (${5 - emptyVal}/5). This student cannot complete sem_wait(&empty) until a kitchen worker consumes an order and posts a free slot.`;
  } else if (isBlocked && process.waitingFor === 'full') {
    explanationText = `The order buffer is empty (0 orders). This kitchen worker cannot complete sem_wait(&full) until a student places an order and posts an available item.`;
  } else if (isBlocked && process.waitingFor === 'mutex') {
    explanationText = `The buffer mutex is currently held by ${mutexOwner ?? 'another thread'}. This process waits on the mutex queue to guarantee mutual exclusion.`;
  } else if (isCritical) {
    explanationText = `This process holds the mutual exclusion lock and is safely performing atomic buffer modifications.`;
  } else {
    explanationText = `Thread is ready for execution. The scheduler may dispatch its next atomic instruction at any step.`;
  }

  // Current Instruction
  const currentInstructionLabel = isProducer
    ? ['sem_wait(&empty);', 'pthread_mutex_lock(&mutex);', 'buffer[in] = order;', 'in = (in + 1) % 5;', 'pthread_mutex_unlock(&mutex);', 'sem_post(&full);'][currentPc % 6]
    : ['sem_wait(&full);', 'pthread_mutex_lock(&mutex);', 'order = buffer[out];', 'out = (out + 1) % 5;', 'pthread_mutex_unlock(&mutex);', 'sem_post(&empty);'][currentPc % 6];

  return (
    <div className="inspector-flow">
      {/* 1. Identity and Status */}
      <div className="inspector-card">
        <div className="proc-title-row">
          <strong>{process.id} · {isProducer ? 'Student' : 'Kitchen'}</strong>
          <span className={`status-pill ${process.state?.toLowerCase()}`}>{statusLabel}</span>
        </div>
      </div>

      {/* 2. Human-Readable Explanation */}
      <div className="inspector-card">
        <span className="card-label">STATE SUMMARY</span>
        <p className="card-explanation">{explanationText}</p>
      </div>

      {/* 3. Relevant Values */}
      <div className="inspector-card">
        <span className="card-label">CURRENT INSTRUCTION</span>
        <div className="instruction-preview">
          <code>{currentInstructionLabel}</code>
          <span className="instruction-pc">PC {currentPc}</span>
        </div>

        <div className="proc-meta-grid">
          <div className="proc-meta-item">
            <span>Target index:</span>
            <strong>[{isProducer ? (state?.writePosition ?? 0) : (state?.readPosition ?? 0)}]</strong>
          </div>
          <div className="proc-meta-item">
            <span>Mutex held:</span>
            <strong>{process.acquiredMutex || mutexOwner === process.id ? 'Yes' : 'No'}</strong>
          </div>
          {process.order && (
            <div className="proc-meta-item">
              <span>Assigned order:</span>
              <strong>{process.order}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 4. Expandable Technical Details: POSIX C Code */}
      <div className="inspector-accordion">
        <button
          className="accordion-toggle"
          onClick={() => setShowCode((v) => !v)}
          aria-expanded={showCode}
        >
          <div className="accordion-title">
            <Code2 size={13} />
            <span>POSIX C Routine ({isProducer ? 'student_producer' : 'kitchen_consumer'})</span>
          </div>
          {showCode ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {showCode && (
          <div className="accordion-content">
            <pre className="code-block">
              {cCode.map((row) => {
                const isCurrent = row.pc !== undefined && row.pc === currentPc;
                return (
                  <div
                    key={`line-${row.line}`}
                    className={`code-line ${isCurrent ? 'active' : ''}`}
                  >
                    <span className="code-lineno">{row.line}</span>
                    <span className="code-text">{row.code}</span>
                    {isCurrent && <span className="code-marker">← active</span>}
                  </div>
                );
              })}
            </pre>
          </div>
        )}
      </div>

      {/* Expandable Technical Details: Thread Local Registers */}
      <div className="inspector-accordion">
        <button
          className="accordion-toggle"
          onClick={() => setShowRegisters((v) => !v)}
          aria-expanded={showRegisters}
        >
          <div className="accordion-title">
            <span>Local Thread Registers</span>
          </div>
          {showRegisters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {showRegisters && (
          <div className="accordion-content">
            <div className="registers-table">
              <div className="reg-row">
                <span>program_counter:</span>
                <code>{currentPc}</code>
              </div>
              <div className="reg-row">
                <span>local_pointer:</span>
                <code>{isProducer ? (state?.writePosition ?? 0) : (state?.readPosition ?? 0)}</code>
              </div>
              <div className="reg-row">
                <span>permit_acquired:</span>
                <code>{process.permit ? 'true (1)' : 'false (0)'}</code>
              </div>
              <div className="reg-row">
                <span>mutex_acquired:</span>
                <code>{process.acquiredMutex ? 'true (1)' : 'false (0)'}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CONCURRENCY & SEMAPHORES DETAIL VIEW
// -----------------------------------------------------------------------------
function ConcurrencyDetailView({ state }) {
  const emptyVal = typeof state?.empty === 'number' ? state.empty : (state?.empty?.value ?? 5);
  const fullVal = typeof state?.full === 'number' ? state.full : (state?.full?.value ?? 0);
  const mutexOwner = state?.mutexOwner ?? null;
  const capacity = state?.capacity ?? 5;
  const occupancy = state?.occupancy ?? state?.slots?.filter(Boolean)?.length ?? 0;
  const reservedEmpty = state?.reservedEmpty ?? 0;
  const reservedFull = state?.reservedFull ?? 0;

  return (
    <div className="inspector-flow">
      <div className="inspector-card">
        <span className="card-label">BOUNDED BUFFER COORDINATION</span>
        <p className="card-explanation">
          Capacity is bounded at $N = {capacity}$. Dijkstra counting semaphores govern permit availability,
          preventing buffer overflow and starvation.
        </p>
      </div>

      <div className="inspector-card">
        <span className="card-label">SEMAPHORES</span>
        <div className="sem-list">
          <div className="sem-row">
            <div className="sem-info">
              <strong>sem_t empty</strong>
              <span>Available producer slots</span>
            </div>
            <span className="sem-val">{emptyVal} / {capacity}</span>
          </div>

          <div className="sem-row">
            <div className="sem-info">
              <strong>sem_t full</strong>
              <span>Queued orders ready for kitchen</span>
            </div>
            <span className="sem-val">{fullVal} / {capacity}</span>
          </div>

          <div className="sem-row">
            <div className="sem-info">
              <strong>pthread_mutex_t</strong>
              <span>Queue mutual exclusion lock</span>
            </div>
            <span className={`sem-val ${mutexOwner ? 'locked' : ''}`}>
              {mutexOwner ? `Held by ${mutexOwner}` : '1 (Unlocked)'}
            </span>
          </div>
        </div>
      </div>

      <div className="inspector-card">
        <span className="card-label">INVARIANT CONSERVATION</span>
        <div className="invariant-equation">
          <code>empty ({emptyVal}) + full ({fullVal}) + in_flight ({reservedEmpty + reservedFull}) = {capacity}</code>
        </div>
        <p className="card-note">
          Permits are strictly conserved. A slot is either empty, occupied, or currently reserved
          by an active thread completing its atomic critical-section update.
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SLOT DETAIL VIEW
// -----------------------------------------------------------------------------
function SlotDetailView({ slotData, state }) {
  const index = slotData?.index ?? 0;
  const slot = slotData?.slot ?? null;
  const isOccupied = Boolean(slot);

  return (
    <div className="inspector-flow">
      <div className="inspector-card">
        <div className="proc-title-row">
          <strong>Slot [{index}]</strong>
          <span className={`status-pill ${isOccupied ? 'running' : 'ready'}`}>
            {isOccupied ? 'Occupied' : 'Empty'}
          </span>
        </div>
      </div>

      {isOccupied ? (
        <div className="inspector-card">
          <span className="card-label">ORDER CONTENT</span>
          <div className="slot-order-info">
            <div className="slot-row">
              <span>Order ID:</span>
              <strong>{slot.id ?? slot.orderId ?? `ORD #${100 + index}`}</strong>
            </div>
            <div className="slot-row">
              <span>Item:</span>
              <strong>{slot.foodName ?? slot.itemName ?? 'Food Item'}</strong>
            </div>
            <div className="slot-row">
              <span>Submitted by:</span>
              <code>{slot.producer ?? 'Student'}</code>
            </div>
          </div>
        </div>
      ) : (
        <div className="inspector-card">
          <span className="card-label">STATUS</span>
          <p className="card-explanation">
            This buffer slot is empty and available for insertion by the next producer advancing
            via <code>in = (in + 1) % 5</code>.
          </p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ACTIVITY DETAIL VIEW
// -----------------------------------------------------------------------------
function ActivityDetailView({ state }) {
  const events = state?.events ?? [];

  return (
    <div className="inspector-flow">
      <div className="inspector-card">
        <span className="card-label">RECORDED ATOMIC EVENTS</span>
        <div className="activity-event-list">
          {events.length === 0 ? (
            <p className="card-explanation text-zinc-500">No events recorded yet.</p>
          ) : (
            [...events].reverse().slice(0, 25).map((evt, idx) => (
              <div key={`act-${idx}`} className="activity-event-item">
                <span className="event-seq">{events.length - idx}</span>
                <span className="event-text">{evt.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
