import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, BookOpen, ChefHat, CirclePlay, LockKeyhole, Pause, Play, Plus, RotateCcw, SkipForward, Users, Utensils, Leaf, Coffee, Timer } from 'lucide-react';
import { ProducerConsumerEngine } from './engine/ProducerConsumerEngine.js';
import { PROCESS_INSTRUCTIONS } from './engine/ProducerConsumerEngine.js';
import { RaceConditionEngine } from './engine/RaceConditionEngine.js';
import { CHALLENGES, EXPERIMENTS, evaluateChallenge, evaluateExperiment, startChallenge, startExperiment } from './learningModes.js';
import { CLASSROOM_DEMOS, SIMULATOR_SCENARIOS, loadSimulatorScenario, startClassroomDemo, stepClassroomDemo } from './scenarios.js';
import { createExperimentRecord, downloadExperiment, simulatorScenarioResult, classroomDemoResult } from './evidence.js';
import { VisualRaceLaboratory } from './VisualRaceLaboratory.jsx';
import { InteractiveSynchronizationSolution } from './InteractiveSynchronizationSolution.jsx';
import { SynchronizationFlowchartsView } from './SynchronizationFlowchartsView.jsx';
import { ExecutionAnalysis } from './ExecutionAnalysis.jsx';
import { ClassroomWorkbench } from './ClassroomWorkbench.jsx';
import { ManualSchedulingExercise } from './ManualSchedulingExercise.jsx';
import { CanteenRushGame } from './canteenRush/CanteenRushGame.jsx';
import { SyncLabArena } from './arena/SyncLabArena.jsx';
import './synclab.css';

const SECTIONS = [
  ['model', 'System Overview', '01'],
  ['simulator', 'Producer–Consumer Lab', '02'],
  ['semaphores', 'Synchronization Lab', '03'],
  ['race', 'Race Condition Lab', '04'],
  ['solution', 'Solution & Analysis', '05'],
];

function Metric({ label, value, tone = '' }) { return <div className="sl-metric"><span>{label}</span><strong className={tone}>{value}</strong></div>; }
function Panel({ children, className = '' }) { return <section className={`sl-panel ${className}`}>{children}</section>; }
function SectionHeading({ eyebrow, title, children }) { return <div className="sl-section-heading"><span className="sl-eyebrow">{eyebrow}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>; }

const FOOD_CROPS = [
  { name: 'Masala Dosa', terms: ['dosa'], position: '0% 0%' },
  { name: 'Idli & Sambar', terms: ['idli', 'vada'], position: '50% 0%' },
  { name: 'Vegetable Sandwich', terms: ['sandwich'], position: '100% 0%' },
  { name: 'Samosa', terms: ['samosa'], position: '0% 100%' },
  { name: 'Rice Bowl', terms: ['rice', 'meal', 'thali'], position: '50% 100%' },
  { name: 'Canteen Noodles', terms: ['noodle', 'pasta'], position: '100% 100%' },
];
function foodForOrder(item, fallbackIndex = 0) {
  const actual = [item?.foodName, item?.itemName, item?.name, item?.food, item?.label].find((value) => value && !/^order\s/i.test(value));
  const match = actual && FOOD_CROPS.find((food) => food.terms.some((term) => actual.toLowerCase().includes(term)));
  const indexFromId = Number(String(item?.id ?? '').match(/\d+/)?.[0]);
  return { ...(match ?? FOOD_CROPS[(Number.isFinite(indexFromId) && indexFromId > 0 ? indexFromId - 1 : fallbackIndex) % FOOD_CROPS.length]), actualName: actual ?? null };
}
function FoodPhoto({ item, fallbackIndex = 0, className = '', empty = false }) {
  if (empty) return <div className={`sl-food-empty ${className}`} aria-hidden="true"><Utensils size={20}/><span>FREE</span></div>;
  const food = foodForOrder(item, fallbackIndex);
  return <div className={`sl-food-photo ${className}`} role="img" aria-label={food.actualName ?? `Demo visual: ${food.name}`} style={{ backgroundPosition: food.position }} />;
}

function calculatePreparationProgress(worker, order) {
  if (!worker || (!order && !worker.assignedOrderId)) {
    return { percent: null, label: 'No assigned order', ticksText: '', isCooking: false, isReady: false, isValid: false };
  }

  const state = worker.state;
  if (state === 'READY') {
    return {
      percent: 100,
      label: '100% · Ready for pickup',
      ticksText: worker.preparationDuration ? `${worker.preparationDuration}/${worker.preparationDuration} ticks` : '100% Complete',
      isCooking: false,
      isReady: true,
      isValid: true,
    };
  }

  if (state !== 'PREPARING') {
    return {
      percent: null,
      label: 'Not cooking',
      ticksText: '',
      isCooking: false,
      isReady: false,
      isValid: false,
    };
  }

  const progress = worker.preparationProgress;
  const duration = worker.preparationDuration;

  if (
    typeof progress !== 'number' ||
    typeof duration !== 'number' ||
    !Number.isFinite(progress) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return {
      percent: null,
      label: 'Progress unavailable',
      ticksText: 'Invalid duration',
      isCooking: true,
      isReady: false,
      isValid: false,
    };
  }

  const rawRatio = progress / duration;
  const clampedPercent = Math.max(0, Math.min(100, Math.round(rawRatio * 100)));
  const remainingSteps = typeof worker.remainingSteps === 'number' && Number.isFinite(worker.remainingSteps)
    ? Math.max(0, worker.remainingSteps)
    : Math.max(0, duration - progress);

  return {
    percent: clampedPercent,
    label: `${clampedPercent}%`,
    ticksText: `${Math.max(0, Math.min(duration, progress))}/${duration} ticks (${remainingSteps} remaining)`,
    isCooking: true,
    isReady: false,
    isValid: true,
  };
}

function getFifoQueueHeadInfo(state) {
  if (!state || !state.slots) {
    return { title: 'Buffer Empty (0 orders)', detail: 'Queue contains no orders. Consumers block on wait(full).' };
  }
  const occupancy = state.occupancy ?? state.slots.filter(Boolean).length;
  if (occupancy === 0) {
    return {
      title: 'Buffer Empty (0 orders)',
      detail: 'Queue contains no orders. Consumers block on wait(full).',
    };
  }
  const slotAtRead = state.slots[state.readPosition];
  if (slotAtRead) {
    const food = foodForOrder(slotAtRead, state.readPosition);
    const foodName = food?.actualName || slotAtRead.label || 'Order';
    if (state.full === 0 && state.reservedFull > 0) {
      return {
        title: `Slot ${state.readPosition}: ${slotAtRead.id} (${foodName})`,
        detail: `Produced by ${slotAtRead.producer} · All queued orders are reserved by active consumers.`,
      };
    }
    return {
      title: `Slot ${state.readPosition}: ${slotAtRead.id} (${foodName})`,
      detail: `Produced by ${slotAtRead.producer} · Next claiming consumer dequeues this order.`,
    };
  }
  return {
    title: `Slot ${state.readPosition}: Order Dequeued (Pointer advancing)`,
    detail: `Order removed by consumer in critical section; pointer will advance mod ${state.capacity}.`,
  };
}

function CanteenBackdrop() {
  return <div className="sl-ambient" aria-hidden="true">
    <svg className="sl-canteen-scene" viewBox="0 0 520 100" fill="none">
      <path d="M42 78h420M72 78V35h340v43M60 35h365l-16-18H78L60 35Z" fill="#F0E8D8" stroke="#B6A283" strokeWidth="1.4"/>
      <path d="M87 42h100v36H87zM202 42h90v36h-90zM309 42h83v36h-83z" fill="#E6EFE7" stroke="#9CAD9A"/>
      <path d="M87 42h100v8H87zM202 42h90v8h-90zM309 42h83v8h-83z" fill="#D0B987"/>
      <path d="M205 17c4-14 18-14 22 0M222 17c2-9 15-11 19 0M399 27c6-9 14-8 18 0M414 25c4-10 14-10 18 0" stroke="#82947A" strokeWidth="2" strokeLinecap="round"/>
      <path d="M48 78v-23h17v23M447 78V54h16v24" fill="#DCCFAF" stroke="#B6A283"/>
      <path d="M115 63h42M230 63h35M331 63h38" stroke="#C39A5A" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 79h480" stroke="#9E8A6A" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <span className="sl-float-decor leaf-one"><Leaf/></span><span className="sl-float-decor plate-one"><i/></span>
    <span className="sl-float-decor leaf-two"><Leaf/></span><span className="sl-float-decor cup-one"><Coffee/></span>
  </div>;
}

function SystemModel({ onNavigate }) {
  const [selectedComponent, setSelectedComponent] = useState('buffer');

  const components = {
    students: {
      title: 'Students · Producer Processes',
      osRole: 'Independent concurrent processes generating digital meal orders.',
      canteenRole: 'Students browsing the digital canteen menu and submitting food orders.',
      invariants: 'Must wait on wait(empty) if all 5 buffer slots are occupied.',
      protocol: 'wait(empty) → wait(mutex) → insert order at writePosition → advance writePosition mod 5 → signal(mutex) → signal(full)',
      keyRule: 'Never blocks inside the queue critical section while generating the order.'
    },
    producerOp: {
      title: 'Producer Operation · Enqueue & Modulo Write',
      osRole: 'Atomic critical section insertion into shared bounded buffer array.',
      canteenRole: 'Digital order ticket added to the active canteen kitchen queue.',
      invariants: 'Order is placed at buffer[writePosition]; pointer advances (writePosition + 1) % 5.',
      protocol: 'Under mutex protection, stores order payload and commits circular pointer.',
      keyRule: 'Capacity bounded at exactly N=5. Prevents overwriting unconsumed orders.'
    },
    buffer: {
      title: 'Order Queue · Shared Bounded Buffer (Capacity N = 5)',
      osRole: 'Fixed-size circular FIFO buffer of 5 slots shared between producers and consumers.',
      canteenRole: 'Orders awaiting kitchen staff pickup. Slot is held until dequeued by kitchen.',
      invariants: '0 ≤ occupancy ≤ 5. Circular FIFO ordering guarantees fairness.',
      protocol: 'Indexed by writePosition (next insert) and readPosition (oldest waiting order).',
      keyRule: 'Queue slot is freed immediately when kitchen worker removes order, NOT when cooking finishes.'
    },
    mutex: {
      title: 'Mutex Lock · Critical Section Mutual Exclusion',
      osRole: 'Binary semaphore (mutex = 1) ensuring indivisible queue operations.',
      canteenRole: 'Exclusive access token preventing two workers or students from editing queue simultaneously.',
      invariants: 'At most one thread owns the mutex (mutex ∈ {0, 1}).',
      protocol: 'wait(mutex) acquires ownership; signal(mutex) releases ownership to oldest waiting thread.',
      keyRule: 'Critical section must be minimized: food cooking NEVER takes place under mutex lock.'
    },
    consumerOp: {
      title: 'Consumer Operation · Dequeue & Slot Release',
      osRole: 'Atomic critical section removal from shared bounded buffer array.',
      canteenRole: 'Kitchen staff takes oldest pending order ticket from the counter queue.',
      invariants: 'Order is retrieved from buffer[readPosition]; pointer advances (readPosition + 1) % 5.',
      protocol: 'Under mutex protection, removes order, nulls slot, commits pointer, then signals empty.',
      keyRule: 'Frees buffer slot immediately. Next waiting student producer is unblocked at this moment.'
    },
    kitchen: {
      title: 'Kitchen Staff · Consumer Processes',
      osRole: 'Independent concurrent worker threads consuming orders and executing long-running preparation.',
      canteenRole: 'Cooks and kitchen staff preparing dosa, noodles, sandwiches, and beverages at workstations.',
      invariants: 'Must wait on wait(full) if queue contains zero orders (full == 0).',
      protocol: 'wait(full) → wait(mutex) → remove order at readPosition → advance readPosition mod 5 → signal(mutex) → signal(empty) → PREPARE FOOD (outside lock)',
      keyRule: 'Food preparation occurs concurrently outside the mutex. Multiple cooks prepare separate dishes in parallel without blocking the queue.'
    },
    semaphores: {
      title: 'Counting Semaphores · Capacity & Work Accounting',
      osRole: 'Synchronization primitives tracking resource counts without busy-waiting (spinning).',
      canteenRole: 'empty = 5 (free queue slots), full = 0 (orders ready for pickup), mutex = 1 (queue lock).',
      invariants: 'Mathematical invariant: empty + full + inFlightPermits = 5.',
      protocol: 'Wait decrements count (or blocks if ≤ 0); Signal increments count (or wakes blocked thread).',
      keyRule: 'Eliminates race conditions and deadlock when paired with strict mutex locking discipline.'
    }
  };

  const selected = components[selectedComponent] || components.buffer;

  const rows = [
    ['Students', 'Producer processes'],
    ['Kitchen staff', 'Consumer processes'],
    ['Order queue', 'Shared bounded buffer (N = 5)'],
    ['Order insertion', 'Produce operation'],
    ['Order removal', 'Consume operation'],
    ['Queue & pointer access', 'Critical section (protected by mutex)'],
    ['Available slots / orders', 'Counting semaphores (empty / full)'],
    ['Food preparation', 'Concurrent computation (outside lock)']
  ];

  return (
    <div className="sl-section-content">
      <SectionHeading
        eyebrow="01 / SYSTEM OVERVIEW"
        title="College Canteen Digital Order System"
      >
        Operating Systems Case Study 3: The Producer–Consumer Problem in a five-slot bounded queue.
        Students generate orders, kitchen staff consume them, and semaphores coordinate mutual exclusion and capacity.
      </SectionHeading>

      {/* 2D System Architecture Interactive Diagram */}
      <Panel className="sl-model-flow-panel">
        <div className="sl-panel-title">
          <div>
            <span className="sl-eyebrow">INTERACTIVE 2D ARCHITECTURE DIAGRAM</span>
            <h3>Click any architecture component to inspect its OS role & invariants</h3>
          </div>
          {onNavigate && (
            <button className="sl-btn primary small" onClick={() => onNavigate('simulator')}>
              Enter Simulator →
            </button>
          )}
        </div>

        <div className="sl-arch-canvas" aria-label="Interactive 2D Architecture Diagram">
          {/* Node 1: Students / Producers */}
          <button
            type="button"
            className={`sl-arch-node ${selectedComponent === 'students' ? 'active' : ''}`}
            onClick={() => setSelectedComponent('students')}
          >
            <div className="sl-arch-node-icon"><Users size={20} /></div>
            <div className="sl-arch-node-text">
              <span className="sl-arch-role">PRODUCERS</span>
              <strong>Students</strong>
              <small>create order requests</small>
            </div>
          </button>

          {/* Connector: Enqueue Operation */}
          <button
            type="button"
            className={`sl-arch-connector ${selectedComponent === 'producerOp' ? 'active' : ''}`}
            onClick={() => setSelectedComponent('producerOp')}
            title="Produce operation"
          >
            <span className="sl-arch-connector-label">wait(empty) → wait(mutex)</span>
            <div className="sl-arch-arrow-line"><ArrowRight size={16} /></div>
            <span className="sl-arch-connector-sub">enqueue</span>
          </button>

          {/* Node 2: Shared Buffer */}
          <div className="sl-arch-buffer-wrapper">
            <button
              type="button"
              className={`sl-arch-buffer-box ${selectedComponent === 'buffer' ? 'active' : ''}`}
              onClick={() => setSelectedComponent('buffer')}
            >
              <div className="sl-arch-buffer-header">
                <span className="sl-arch-tag">SHARED RESOURCE</span>
                <strong>Order Queue (5 Slots)</strong>
                <small>Fixed circular FIFO array</small>
              </div>
              <div className="sl-arch-mini-slots">
                {[0, 1, 2, 3, 4].map((n) => (
                  <span key={n} className="sl-arch-slot-cell">
                    <i>Slot {n}</i>
                  </span>
                ))}
              </div>
            </button>

            {/* Mutex lock indicator */}
            <button
              type="button"
              className={`sl-arch-mutex-chip ${selectedComponent === 'mutex' ? 'active' : ''}`}
              onClick={() => setSelectedComponent('mutex')}
            >
              <LockKeyhole size={13} />
              <span>Critical Section: Mutex Lock (1)</span>
            </button>
          </div>

          {/* Connector: Dequeue Operation */}
          <button
            type="button"
            className={`sl-arch-connector ${selectedComponent === 'consumerOp' ? 'active' : ''}`}
            onClick={() => setSelectedComponent('consumerOp')}
            title="Consume operation"
          >
            <span className="sl-arch-connector-label">wait(full) → wait(mutex)</span>
            <div className="sl-arch-arrow-line"><ArrowRight size={16} /></div>
            <span className="sl-arch-connector-sub">dequeue</span>
          </button>

          {/* Node 3: Kitchen Staff / Consumers */}
          <button
            type="button"
            className={`sl-arch-node ${selectedComponent === 'kitchen' ? 'active' : ''}`}
            onClick={() => setSelectedComponent('kitchen')}
          >
            <div className="sl-arch-node-icon"><ChefHat size={20} /></div>
            <div className="sl-arch-node-text">
              <span className="sl-arch-role">CONSUMERS</span>
              <strong>Kitchen Staff</strong>
              <small>remove & prepare dishes</small>
            </div>
          </button>
        </div>

        {/* Selected Component Inspector Card */}
        <div className="sl-arch-inspector">
          <div className="sl-inspector-header">
            <div className="sl-inspector-badge">INSPECTED COMPONENT</div>
            <h4>{selected.title}</h4>
          </div>
          <div className="sl-inspector-grid">
            <div>
              <span className="sl-inspector-label">OPERATING SYSTEMS ROLE</span>
              <p>{selected.osRole}</p>
            </div>
            <div>
              <span className="sl-inspector-label">CANTEEN SYSTEM REALITY</span>
              <p>{selected.canteenRole}</p>
            </div>
            <div>
              <span className="sl-inspector-label">SYNCHRONIZATION PROTOCOL</span>
              <code className="sl-inspector-code">{selected.protocol}</code>
            </div>
            <div>
              <span className="sl-inspector-label">CRITICAL INVARIANT</span>
              <p className="sl-inspector-rule">{selected.keyRule}</p>
            </div>
          </div>
        </div>
      </Panel>

      {/* 3-Step High-Level System Workflow */}
      <div className="sl-model-lower">
        <Panel>
          <h3>Three-step synchronization lifecycle</h3>
          <div className="sl-arch-steps">
            <div className="sl-step-card">
              <span className="sl-step-num">1</span>
              <div>
                <strong>Student Order Placement (Producer)</strong>
                <p>Student process checks <code>empty</code>. If available, acquires <code>mutex</code>, inserts order at <code>writePosition</code>, advances pointer mod 5, releases <code>mutex</code>, and signals <code>full</code>.</p>
              </div>
            </div>
            <div className="sl-step-card">
              <span className="sl-step-num">2</span>
              <div>
                <strong>Bounded Buffer Retention (Capacity 5)</strong>
                <p>Orders reside in the circular queue awaiting kitchen pickup. If 5 orders are queued, subsequent producers block on <code>wait(empty)</code> until capacity is freed.</p>
              </div>
            </div>
            <div className="sl-step-card">
              <span className="sl-step-num">3</span>
              <div>
                <strong>Kitchen Pickup & Cooking Outside Lock (Consumer)</strong>
                <p>Worker acquires <code>mutex</code>, removes order at <code>readPosition</code>, advances pointer mod 5, releases <code>mutex</code>, and signals <code>empty</code>. The slot is freed immediately; cooking proceeds concurrently outside the lock.</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <h3>Why synchronization is necessary</h3>
          <p>
            Without mutual exclusion, multiple students or kitchen workers attempting to update shared pointers simultaneously would overwrite orders or consume the same order twice (lost updates and duplicate claims). Counting semaphores prevent buffer overflow and underflow without wasteful CPU spinning.
          </p>
          <div className="sl-concept-pills">
            <button type="button" className="sl-pill-btn" onClick={() => setSelectedComponent('buffer')}>Bounded Buffer (N=5)</button>
            <button type="button" className="sl-pill-btn" onClick={() => setSelectedComponent('mutex')}>Mutual Exclusion (Mutex)</button>
            <button type="button" className="sl-pill-btn" onClick={() => setSelectedComponent('semaphores')}>Counting Semaphores</button>
            <button type="button" className="sl-pill-btn" onClick={() => setSelectedComponent('kitchen')}>Cooking Outside Lock</button>
          </div>
        </Panel>
      </div>

      <Panel>
        <h3>Canteen concepts mapped to Operating Systems concepts</h3>
        <div className="sl-mapping">
          {rows.map(([a, b]) => (
            <div key={a}>
              <span>{a}</span>
              <ArrowRight size={15} />
              <b>{b}</b>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function BufferView({ state, selectedSlot, onSelect }) {
  const inFlight = (state.reservedEmpty ?? 0) + (state.reservedFull ?? 0);
  return (
    <div className="sl-buffer-stage">
      <div className={`sl-buffer-orbit ${state.mutexOwner ? 'critical-active' : ''}`}>
        <div className="sl-buffer-heading">
          <div>
            <span className="sl-eyebrow">SHARED MEMORY · CIRCULAR BOUNDED BUFFER</span>
            <b>Bounded Buffer (N = 5 Slots)</b>
            <small>FIFO Discipline · Oldest waiting order dequeued first</small>
          </div>
          <div className="sl-buffer-header-badges">
            <span className={`sl-mutex-status-pill ${state.mutex === 1 ? 'unlocked' : 'locked'}`}>
              <LockKeyhole size={12} />
              {state.mutex === 1 ? 'Mutex: Free (1)' : `Mutex: Locked (${state.mutexOwner})`}
            </span>
            <span className="sl-capacity-pill">{state.occupancy} <i>/</i> 5 occupied</span>
          </div>
        </div>

        {/* Live Semaphore and Invariant Monitor Bar directly above the slots */}
        <div className="sl-buffer-sync-strip">
          <div className="sl-sync-strip-metrics">
            <div className="sl-sync-strip-item">
              <span className="sl-sync-strip-label">empty permit</span>
              <strong className="sl-sync-strip-val amber">{state.empty} / 5</strong>
              <small className="sl-sync-strip-sub">{state.empty === 0 ? 'Buffer full (producers block)' : `${state.empty} slots free`}</small>
            </div>
            <div className="sl-sync-strip-item">
              <span className="sl-sync-strip-label">full permit</span>
              <strong className="sl-sync-strip-val green">{state.full} / 5</strong>
              <small className="sl-sync-strip-sub">{state.full === 0 ? 'Buffer empty (consumers block)' : `${state.full} orders ready`}</small>
            </div>
            <div className="sl-sync-strip-item">
              <span className="sl-sync-strip-label">mutex lock</span>
              <strong className={`sl-sync-strip-val ${state.mutex === 1 ? 'green' : 'red'}`}>
                {state.mutex === 1 ? '1 · Unlocked' : `0 · Held (${state.mutexOwner})`}
              </strong>
              <small className="sl-sync-strip-sub">{state.mutex === 1 ? 'Critical section free' : 'CS locked'}</small>
            </div>
          </div>
          <div className="sl-sync-strip-invariant-bar">
            <span className="sl-invariant-label">PERMIT CONSERVATION INVARIANT</span>
            <code className="sl-invariant-eq">
              empty ({state.empty}) + full ({state.full}) + in_flight ({inFlight}) = 5
            </code>
            <span className={`sl-invariant-status-badge ${inFlight > 0 ? 'transit' : 'quiescent'}`}>
              {inFlight > 0 ? `${inFlight} in transit` : '✓ Quiescent'}
            </span>
          </div>
        </div>

        <div className="sl-slots-wrap">
          <div className="sl-slots">
            {state.slots.map((item, i) => (
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Inspect slot ${i}${item ? `, ${item.label}` : ', empty'}`}
                aria-pressed={selectedSlot === i}
                key={i}
                className={`sl-slot ${item ? 'filled' : ''} ${selectedSlot === i ? 'selected' : ''} ${state.readPosition === i ? 'read-point' : ''} ${state.writePosition === i ? 'write-point' : ''} ${state.lastAction?.position === i ? `recent-${state.lastAction.type}` : ''}`}
              >
                <div className="sl-slot-top-row">
                  <span className="sl-slot-number">SLOT {i}</span>
                  {state.readPosition === i && <span className="sl-slot-role-badge read">FIFO HEAD</span>}
                  {state.writePosition === i && <span className="sl-slot-role-badge write">NEXT WRITE</span>}
                </div>
                {item ? (
                  <>
                    <FoodPhoto item={item} fallbackIndex={i} className="sl-slot-food" />
                    <b className="sl-slot-dish">{foodForOrder(item, i).actualName ?? `${foodForOrder(item, i).name} · demo visual`}</b>
                    <span className="sl-order-id">{item.id} · {item.producer}</span>
                    <small className="sl-queue-status">IN QUEUE</small>
                  </>
                ) : (
                  <>
                    <FoodPhoto empty className="sl-slot-food" />
                    <b className="sl-slot-dish empty-label">Empty slot</b>
                    <span className="sl-order-id">Free capacity</span>
                  </>
                )}
                <div className="sl-pointer-row">
                  {state.readPosition === i && <i className="read">READ</i>}
                  {state.writePosition === i && <i className="write">WRITE</i>}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="sl-orbit-bottom">
          <span>READ POINTER (OUT): <b>Slot {state.readPosition}</b></span>
          <span className="sl-buffer-arrow">Modulo 5 Indexing: (ptr + 1) % 5</span>
          <span>WRITE POINTER (IN): <b>Slot {state.writePosition}</b></span>
        </div>
      </div>
    </div>
  );
}

function Simulator({ engine, state, refresh, onInteraction, onReset, learning, raceEngines, refreshRaces, onScenarioLoaded, activeSection, inspectedStepSeq }) {
  const [running, setRunning] = useState(false);
  const runGeneration = useRef(0);
  const timerRef = useRef(null);
  const [speed, setSpeed] = useState(900);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [selectedSemaphore, setSelectedSemaphore] = useState('empty');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [scenarioId, setScenarioId] = useState('normal');
  const [demo, setDemo] = useState(null);
  const demoRef = useRef(null);
  const updateDemo = useCallback((next) => {
    demoRef.current = typeof next === 'function' ? next(demoRef.current) : next;
    setDemo(next);
  }, []);
  const [classroomMode, setClassroomMode] = useState(false);
  const [initialState, setInitialState] = useState(() => engine.snapshot());
  const [reportOverride, setReportOverride] = useState(null);
  const [integrityOpen, setIntegrityOpen] = useState(false);
  const effectiveSelectedProcess = state.processes.some((candidate) => candidate.id === selectedProcess) ? selectedProcess : null;
  const hasRunnableProcess = state.processes.some((candidate) => candidate.state === 'READY' || candidate.state === 'RUNNING');
  const hasPreparingWorker = state.workers.some((worker) => worker.state === 'PREPARING');
  const runnableProcess = state.processes.find((candidate) => candidate.state === 'READY' || candidate.state === 'RUNNING');
  const selectedIsRunnable = effectiveSelectedProcess ? state.processes.find((candidate) => candidate.id === effectiveSelectedProcess && (candidate.state === 'READY' || candidate.state === 'RUNNING')) : null;
  const processToStep = selectedIsRunnable ?? runnableProcess;
  const canStepProcess = Boolean(processToStep) || hasPreparingWorker;
  const canAutoRun = demo ? demo.index < demo.steps.length : hasRunnableProcess || hasPreparingWorker;

  const stepInstruction = useCallback(() => {
    if (demo && demo.index < demo.steps.length) {
      const nextDemo = stepClassroomDemo(demo, engine, raceEngines);
      updateDemo(nextDemo);
      if (demo.lane === 'race') refreshRaces();
      else refresh();
    } else {
      if (hasRunnableProcess) {
        const runnableTarget = (canStepProcess && processToStep) ? processToStep.id : null;
        engine.stepNextInstruction(runnableTarget);
      } else if (hasPreparingWorker) {
        engine.tickKitchen();
      }
      refresh();
    }
    onInteraction();
  }, [demo, engine, raceEngines, refresh, refreshRaces, onInteraction, updateDemo, hasRunnableProcess, hasPreparingWorker, canStepProcess, processToStep]);

  const stepProcess = useCallback(() => {
    if (processToStep) {
      engine.stepNextProcess(processToStep.id);
    } else if (hasPreparingWorker) {
      engine.tickKitchen();
    }
    refresh();
    onInteraction();
  }, [engine, processToStep, hasPreparingWorker, refresh, onInteraction]);
  const stopAutoRun = useCallback(() => {
    runGeneration.current += 1;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
  }, []);
  const startAutoRun = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    runGeneration.current += 1;
    setRunning(true);
    engine.resume();
    refresh();
    onInteraction();
  }, [engine, refresh, onInteraction]);

  const [prevActiveSection, setPrevActiveSection] = useState(activeSection);
  if (prevActiveSection !== activeSection) {
    setPrevActiveSection(activeSection);
    if (activeSection !== 'simulator' && running) {
      setRunning(false);
    }
  }
  useEffect(() => {
    if (!running) return undefined;
    const generation = runGeneration.current;
    let timerId = null;

    const tick = () => {
      timerId = window.setTimeout(() => {
        if (generation !== runGeneration.current) return;

        const currentDemo = demoRef.current;
        if (currentDemo) {
          if (currentDemo.index >= currentDemo.steps.length) {
            stopAutoRun();
            return;
          }
          const nextDemo = stepClassroomDemo(currentDemo, engine, raceEngines);
          updateDemo(nextDemo);
          if (currentDemo.lane === 'race') refreshRaces();
          else refresh();
          onInteraction();

          if (nextDemo.index >= nextDemo.steps.length) {
            stopAutoRun();
            return;
          }
        } else {
          const before = engine.snapshot();
          if (before.integrityFailure) {
            engine.pause();
            refresh();
            stopAutoRun();
            return;
          }

          if (before.processes.some((process) => process.state === 'READY' || process.state === 'RUNNING')) {
            engine.stepNextInstruction();
            refresh();
            onInteraction();
          } else if (before.workers.some((worker) => worker.state === 'PREPARING')) {
            engine.tickKitchen();
            refresh();
            onInteraction();
          } else {
            stopAutoRun();
            return;
          }

          const after = engine.snapshot();
          if (after.integrityFailure) {
            engine.pause();
            refresh();
            stopAutoRun();
            return;
          }

          const stillHasWork = after.processes.some((process) => process.state === 'READY' || process.state === 'RUNNING') ||
                               after.workers.some((worker) => worker.state === 'PREPARING');
          if (!stillHasWork) {
            stopAutoRun();
            return;
          }
        }

        tick();
      }, speed);
    };

    tick();

    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [running, activeSection, speed, engine, raceEngines, refresh, refreshRaces, onInteraction, stopAutoRun, updateDemo]);
  const producers = state.processes.filter((p) => p.type === 'PRODUCER');
  const consumers = state.processes.filter((p) => p.type === 'CONSUMER');
  const add = (fn, n = 1) => { fn.call(engine, n); refresh(); onInteraction(); };
  const process = state.processes.find((p) => p.id === effectiveSelectedProcess) ?? state.processes.find((p) => p.id === state.lastInstruction?.processId) ?? null;
  const selectedEvent = state.events.find((event) => event.id === selectedEventId) ?? state.events[0] ?? null;
  const instructions = process ? PROCESS_INSTRUCTIONS[process.type] : [];
  const currentInstruction = process ? instructions[process.pc] : null;
  const lastProcessInstruction = process && state.lastInstruction?.processId === process.id ? state.lastInstruction.label : 'No instruction executed by this process yet';
  const lastMutexAcquire = state.events.find((event) => event.message.includes('acquired mutex'));
  const lastMutexRelease = state.events.find((event) => event.message.includes('released mutex'));
  const selectedSemaphoreInfo = selectedSemaphore === 'mutex'
    ? { label: 'mutex', value: state.mutex, initial: 1, waiters: state.mutexWaiters, definition: 'Binary lock. Only its current owner may enter or leave the critical section.', changes: state.events.filter((event) => event.type === 'critical' || event.message.includes('mutex')) }
    : selectedSemaphore === 'empty'
      ? { label: 'empty', value: state.empty, initial: 5, waiters: state.emptyWaiters, definition: 'Counts free queue slots. Producers wait here when all five slots are occupied.', changes: state.events.filter((event) => event.message.includes('empty')) }
      : { label: 'full', value: state.full, initial: 0, waiters: state.fullWaiters, definition: 'Counts available orders. Kitchen consumers wait here when the queue is empty.', changes: state.events.filter((event) => event.message.includes('full')) };
  const operationCopy = (event) => {
    if (!event) return { what: state.explanation, why: 'A process must coordinate access to the shared queue.', concept: 'Process synchronization' };
    const operation = event.operation ?? event.type;
    const concept = operation?.includes('wait') || event.message.includes('blocked') ? 'Semaphore blocking and wake-up' : operation?.includes('Mutex') || event.message.toLowerCase().includes('mutex') ? 'Mutual exclusion' : operation?.includes('insert') || operation?.includes('remove') ? 'Critical section' : operation?.includes('advance') ? 'Circular buffer indexing' : 'Process scheduling';
    const why = event.message.includes('blocked on empty') ? 'No unreserved buffer slot was available, so the producer waits without changing the queue.' : event.message.includes('blocked on full') ? 'No unreserved order was available, so the consumer waits without reading a slot.' : event.message.includes('blocked on mutex') ? 'Another process owns the critical section; FIFO handoff prevents simultaneous access.' : event.message.includes('woke from') ? 'A matching signal or mutex release transferred the resource to this waiting process.' : operation?.includes('insert') ? 'The producer owns both an empty-slot permit and the mutex.' : operation?.includes('remove') ? 'The consumer owns both an order permit and the mutex.' : operation?.includes('advance') ? 'The pointer advances modulo five to preserve circular indexing.' : 'This event records a scheduler or synchronization state transition.';
    return { what: event.message, why, concept };
  };
  const selectedExplanation = effectiveSelectedProcess && process
    ? {
        what: process.state === 'PREPARING'
          ? `${process.id} is preparing food at its workstation outside the critical section. Duration: ${state.workers.find((w) => w.id === process.id)?.preparationProgress ?? 0}/${state.workers.find((w) => w.id === process.id)?.preparationDuration ?? 0} ticks.`
          : `${process.id} is ${process.state.toLowerCase()} at program counter ${process.pc}. Last: ${lastProcessInstruction}. ${currentInstruction ? `Next: ${currentInstruction.label}.` : 'Its operation is complete.'}`,
        why: process.state === 'PREPARING'
          ? 'Food preparation occurs outside the mutex lock so other producers and consumers can access the queue simultaneously.'
          : process.waitingFor
            ? `The process is queued for ${process.waitingFor}; it cannot advance until the resource is handed off.`
            : process.permit
              ? 'Its permit is reserved while it waits to complete the corresponding critical operation.'
              : 'Its next instruction is scheduled when the deterministic scheduler selects it.',
        concept: process.state === 'PREPARING' ? 'Critical section minimization' : (currentInstruction?.label ?? 'Process lifecycle')
      }
    : operationCopy(selectedEvent);
  const processDetail = process
    ? process.state === 'PREPARING'
      ? `${process.id} · PREPARING (outside mutex) · PC ${process.pc}/${PROCESS_INSTRUCTIONS[process.type].length}`
      : `${process.id} · ${process.state} · PC ${process.pc}/${PROCESS_INSTRUCTIONS[process.type].length}${process.waitingFor ? ` · waiting for ${process.waitingFor}` : ''}${process.permit ? ` · reserved ${process.type === 'PRODUCER' ? 'empty-slot' : 'full-order'} permit` : ''}`
    : 'No process selected';
  const activeScenario = SIMULATOR_SCENARIOS.find((scenario) => scenario.id === scenarioId);
  const failed = Boolean(state.integrityFailure);
  const loadScenario = (id = scenarioId) => {
    stopAutoRun(); setScenarioId(id); updateDemo(null); setSelectedProcess(null); setSelectedSlot(0); setSelectedEventId(null);
    const loaded = loadSimulatorScenario(id, engine);
    engine.clearHistory(`Scenario: ${loaded.label}`);
    setInitialState(loaded.state); setReportOverride(null); onScenarioLoaded(); refresh(); refreshRaces(); onInteraction();
  };
  const startDemo = (id) => {
    stopAutoRun(); updateDemo(startClassroomDemo(id, engine, raceEngines)); setSelectedProcess(null); setSelectedSlot(0); setSelectedEventId(null);
    setReportOverride(null); setInitialState(engine.snapshot()); onScenarioLoaded(); refresh(); refreshRaces(); onInteraction();
  };
  const previousDemoStep = () => {
    if (!demo || demo.index < 1) return;
    const replayed = startClassroomDemo(demo.id, engine, raceEngines);
    for (let index = 0; index < demo.index - 1; index += 1) stepClassroomDemo(replayed, engine, raceEngines);
    replayed.index = demo.index - 1; updateDemo(replayed); refresh(); refreshRaces(); setReportOverride(null);
  };
  const reportOutcome = demo
    ? classroomDemoResult(demo, state, { unsafe: raceEngines.unsafe.snapshot(), safe: raceEngines.safe.snapshot() })
    : simulatorScenarioResult(scenarioId, state);
  const buildReport = useCallback(() => {
    const raceEvents = demo?.lane === 'race' ? demo.executionTrace ?? [] : [];
    const expected = demo?.objective ?? activeScenario?.expected;
    return createExperimentRecord({ title: demo?.label ?? activeScenario?.label ?? 'Explore session', objective: demo?.objective ?? activeScenario?.objective ?? 'Explore the producer-consumer system.', expected, initialState, finalState: state, integrity: state.integrity, actualResult: reportOutcome.actual, raceEvents, raceInitialState: demo?.raceInitialState ?? null });
  }, [demo, activeScenario, initialState, state, reportOutcome]);
  const experimentReport = useMemo(() => reportOverride ?? (reportOutcome.passed ? buildReport() : null), [reportOverride, reportOutcome.passed, buildReport]);
  const captureReport = () => setReportOverride(buildReport());
  const currentDemoAction = demo?.steps[Math.max(0, demo.index - 1)];
  const demoRace = demo?.lane === 'race' && currentDemoAction ? raceEngines[currentDemoAction.lane].snapshot() : null;
  const demoRaceEvent = demoRace?.interactiveEvents.at(-1);
  const demoProcess = demoRace?.processStatesInteractive.find((item) => item.id === currentDemoAction?.process);
  const demoVariableChanges = demoRaceEvent
    ? `${demoRace.scenario === 'producer' ? 'writePosition' : 'readPosition'} ${demoRaceEvent.sharedBefore} → ${demoRaceEvent.sharedAfter}`
    : state.variableChanges ? Object.keys(state.variableChanges.after).filter((key) => state.variableChanges.before[key] !== state.variableChanges.after[key]).map((key) => `${key} ${state.variableChanges.before[key]} → ${state.variableChanges.after[key]}`).join(' · ') || 'No shared variable changed' : 'No operation yet';
  const displayedProcessDetail = demoRace && currentDemoAction
    ? `${currentDemoAction.lane === 'safe' ? 'Protected' : 'Unsafe'} process ${currentDemoAction.process} · ${demoProcess?.state ?? 'READY'} · mutex ${demoRace.mutexOwner ?? 'free'}`
    : processDetail;
  const displayedExplanation = demoRaceEvent
    ? { what: demoRaceEvent.message, why: currentDemoAction?.lane === 'safe' ? 'The protected process owns the mutex, or waits until the owner releases it.' : 'This controlled interleaving deliberately allows stale shared-state observations.', concept: currentDemoAction?.lane === 'safe' ? 'Mutex serialization' : 'Race condition counterexample' }
    : selectedExplanation;
  return <div className={`sl-section-content ${classroomMode ? 'sl-classroom-mode' : ''}`}>
    <SectionHeading eyebrow="02 / LIVE SIMULATION" title="Producer–Consumer Simulator" >Bounded Buffer · Capacity 5 · Step through semaphore waits, mutex ownership, circular indexing, and process wakeups. This browser model never creates real Canteo orders.</SectionHeading>
    <div className="sl-educational-action-strip">
      <span className="sl-action-strip-badge">LEARNING OBJECTIVE</span>
      <p className="sl-action-strip-text">
        {state.processes.length === 0
          ? 'Queue is idle. Spawn student producers to insert orders, or kitchen consumers to dequeue orders from the 5-slot bounded buffer.'
          : state.empty === 0
          ? 'Queue saturated at 5 orders: Producers sleep passively on wait(empty) without CPU spinning until kitchen dequeues an item.'
          : state.full === 0 && consumers.some((c) => c.state === 'READY' || c.waitingFor === 'full')
          ? 'Queue empty (0 orders): Kitchen consumers sleep passively on wait(full) until a student deposits an order.'
          : state.mutex === 0
          ? `Critical section locked: Mutex held by ${state.mutexOwner}. Competing threads wait on wait(mutex) without corruption.`
          : 'Threads ready: Advance one POSIX micro-step or run continuous flow to observe semaphore coordination.'}
      </p>
      <div className="sl-action-strip-hint">
        <b>Action:</b>{' '}
        {state.processes.length === 0
          ? 'Click "+ Add Producer" or "+ Add Consumer"'
          : 'Click "Step Instruction" or "Auto Run"'}
      </div>
    </div>
    <Panel className="sl-control-bar sl-top-control-bar"><div className="sl-button-group"><button className="sl-btn primary" onClick={startAutoRun} disabled={running || failed || !canAutoRun}><Play size={15}/> Auto Run</button><button className="sl-btn" onClick={stepInstruction} disabled={running || failed || (!demo && !hasRunnableProcess && !hasPreparingWorker) || Boolean(demo && demo.index >= demo.steps.length)}><SkipForward size={14}/> Step Instruction</button><button className="sl-btn" onClick={stepProcess} disabled={running || failed || Boolean(demo) || !canStepProcess} title={demo ? 'Follow the scripted demonstration one instruction at a time.' : undefined}><Activity size={14}/> Step Process</button><button className="sl-btn" onClick={() => { engine.tickKitchen(); refresh(); onInteraction(); }} disabled={running || failed || !hasPreparingWorker}><Timer size={14}/> Advance Kitchen Tick</button><button className="sl-btn" onClick={() => { engine.pause(); stopAutoRun(); refresh(); onInteraction(); }} disabled={!running}><Pause size={14}/> Pause</button><button className="sl-btn" onClick={startAutoRun} disabled={running || failed || !canAutoRun}><CirclePlay size={14}/> Resume</button><button className="sl-btn quiet" onClick={() => { stopAutoRun(); updateDemo(null); setReportOverride(null); onReset(); setSelectedProcess(null); setSelectedSlot(0); setSelectedEventId(null); setInitialState(engine.snapshot()); }}><RotateCcw size={14}/> Reset</button></div><label className="sl-speed">Speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value="1400">Slow</option><option value="900">Normal</option><option value="450">Fast</option></select></label></Panel>
    <Panel className="sl-scenario-picker"><div className="sl-scenario-row"><label>Scenario<select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>{SIMULATOR_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></label><button className="sl-btn small" onClick={() => loadScenario()}>Load scenario</button><label>Classroom demo<select value={demo?.id ?? ''} onChange={(event) => event.target.value && startDemo(event.target.value)}><option value="">Choose demonstration</option>{CLASSROOM_DEMOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="sl-classroom-toggle"><input type="checkbox" checked={classroomMode} onChange={(event) => setClassroomMode(event.target.checked)}/> Classroom view</label>{demo && <><button className="sl-btn small" onClick={previousDemoStep} disabled={demo.index === 0 || running}>Previous</button><button className="sl-btn small" onClick={() => startDemo(demo.id)}>Restart demo</button></>}<span className="sl-scenario-copy">{demo ? `${demo.label} · ${demo.index}/${demo.steps.length} steps` : activeScenario?.objective}</span></div><div className="sl-scenario-expected">{demo ? demo.objective : `Expected: ${activeScenario?.expected}`}{demo && currentDemoAction && <span> · Active: {demo.lane === 'race' ? `${currentDemoAction.lane} ${currentDemoAction.process}` : currentDemoAction}</span>}{demo && demo.index >= demo.steps.length && <b> · Demonstration complete</b>}</div>{demo && <div className="sl-demo-evidence"><span>Step {demo.index} / {demo.steps.length}</span><span>Operation: {demo.lane === 'race' ? demoRace?.interactiveEvents.at(-1)?.message ?? 'Ready' : state.lastInstruction?.label ?? 'Ready'}</span><span>Changed variable: {demoVariableChanges}</span>{demo.lane === 'race' && <span>{demoRace?.lostOrder ? 'Unsafe lost update reproduced.' : demoRace?.interactiveComplete ? 'Mutex-protected schedule completed.' : 'Race example is isolated from the safe buffer.'}</span>}</div>}<div className="sl-evidence-actions"><span className={reportOutcome.passed ? 'pass' : 'pending'}>{reportOutcome.passed ? 'Objective verified' : 'Objective in progress'}</span><button className="sl-btn small" onClick={captureReport}>Capture evidence</button>{experimentReport && <><button className="sl-btn small" onClick={() => downloadExperiment(experimentReport, 'json')}>Export JSON</button><button className="sl-btn small" onClick={() => downloadExperiment(experimentReport, 'csv')}>Export CSV</button><button className="sl-btn small" onClick={() => window.print()}>Print report</button></>}</div>{experimentReport && <details className="sl-report-preview"><summary>Experiment report · {experimentReport.events.length} events · integrity {experimentReport.integrityChecks.filter((check) => check.status === 'PASS').length}/{experimentReport.integrityChecks.length} pass</summary><p><b>Expected:</b> {experimentReport.expectedResult}</p><p><b>Actual:</b> {experimentReport.actualResult}</p><p><b>Conclusion:</b> {experimentReport.conclusion}</p></details>}</Panel>
    {learning}
    <div className="sl-sim-grid refined-sim-grid"><section className="sl-sim-main"><BufferView state={state} selectedSlot={selectedSlot} onSelect={setSelectedSlot}/><div className="sl-buffer-selected"><div className="sl-selected-slot-block"><span className="sl-buffer-subtag">INSPECTED SLOT {selectedSlot}</span><b className="sl-buffer-selected-title">{state.slots[selectedSlot] ? `${state.slots[selectedSlot].label} (${state.slots[selectedSlot].id})` : 'Empty Slot'}</b><small className="sl-buffer-selected-detail">{state.slots[selectedSlot] ? `Produced by ${state.slots[selectedSlot].producer} · ${foodForOrder(state.slots[selectedSlot], selectedSlot).actualName || foodForOrder(state.slots[selectedSlot], selectedSlot).name}` : 'Available for next producer insertion'}{state.readPosition === selectedSlot ? ' · Current FIFO Read Pointer' : ''}{state.writePosition === selectedSlot ? ' · Current Write Pointer' : ''}</small></div><div className="sl-fifo-head-block"><span className="sl-buffer-subtag sl-fifo-subtag">FIFO QUEUE HEAD (NEXT TO DEQUEUE)</span><b className="sl-fifo-head-title">{(() => { const fifo = getFifoQueueHeadInfo(state); return fifo.title; })()}</b><small className="sl-fifo-head-detail">{(() => { const fifo = getFifoQueueHeadInfo(state); return fifo.detail; })()}</small></div></div>
      <Panel className="sl-execution-bottom"><div className="sl-current-operation"><div><span className="sl-eyebrow">CURRENT PROCESS</span><b>{displayedProcessDetail}</b></div><div><span className="sl-eyebrow">CURRENT OPERATION</span><b>{demoRaceEvent?.operation ?? state.lastInstruction?.op ?? state.currentOperation}</b></div></div><div className="sl-selected-event"><span className="sl-eyebrow">SELECTED EVENT</span><p>{displayedExplanation.what}</p><small>Why: {displayedExplanation.why}</small><small>OS concept · {displayedExplanation.concept}</small>{demoRaceEvent && <small>{demoRaceEvent.sharedBefore} → {demoRaceEvent.sharedAfter} · mutex {demoRaceEvent.mutexOwnerBefore ?? 'free'} → {demoRaceEvent.mutexOwnerAfter ?? 'free'}</small>}{process && <div className="sl-algorithm-mini" aria-label={`${process.type} instruction sequence`}>{instructions.map((instruction, index) => <code key={instruction.op} className={index === process.pc ? 'current' : index < process.pc ? 'done' : ''}>{instruction.label}</code>)}</div>}</div></Panel>
      <Panel className="sl-history-panel"><div className="sl-panel-title"><h3>Process execution trace</h3><span>{state.events.length} recorded events</span></div><ProcessTimeline processes={state.processes} events={state.events} selectedEventId={selectedEvent?.id} onSelectEvent={setSelectedEventId}/><details className="sl-event-history"><summary>Ordered event log · newest first</summary><div className="sl-history-table" role="list">{state.events.length ? state.events.slice(0, 30).map((event) => <button type="button" role="listitem" key={event.id} onClick={() => setSelectedEventId(event.id)} className={`sl-history-row ${selectedEvent?.id === event.id ? 'selected' : ''}`}><span>{String(event.step).padStart(3, '0')}</span><b>{event.processId ?? 'SYSTEM'}</b><span>{event.operation ?? event.type}</span><span>{eventVariable(event)}</span><span>{event.message}</span></button>) : <p className="sl-muted">Add a process, then step to create execution history.</p>}</div></details>{selectedEvent && <div className="sl-event-inspector"><b>{selectedEvent.processId ?? 'SYSTEM'} · {selectedEvent.instruction ?? selectedEvent.operation ?? selectedEvent.type}</b><span>{selectedEvent.transition ? `${selectedEvent.transition.from} → ${selectedEvent.transition.to}` : selectedEvent.message}</span><small>Before: {JSON.stringify(selectedEvent.variablesBefore ?? {})}</small><small>After: {JSON.stringify(selectedEvent.variablesAfter ?? {})}</small></div>}</Panel>
    </section><aside className="sl-sim-side refined-side"><Panel className="sl-process-panel"><div className="sl-panel-title sl-process-heading"><div><h3>Process monitor</h3><span>{state.processes.length} total</span></div><div className="sl-add-process"><button className="sl-btn small" disabled={failed} onClick={() => add(engine.addProducer)}><Plus size={13}/> Add Producer</button><button className="sl-btn small" disabled={failed} onClick={() => add(engine.addConsumer)}><Plus size={13}/> Add Consumer</button></div></div><div className="sl-process-columns"><div><span className="sl-eyebrow">PRODUCERS · STUDENTS</span><ProcessList items={producers} selected={effectiveSelectedProcess} onSelect={setSelectedProcess} orders={state.orders} processes={state.processes} mutexOwner={state.mutexOwner}/></div><div><span className="sl-eyebrow">CONSUMERS · KITCHEN</span><ProcessList items={consumers} selected={effectiveSelectedProcess} onSelect={setSelectedProcess} workers={state.workers} orders={state.orders} processes={state.processes} mutexOwner={state.mutexOwner}/></div></div>{process && <div className="sl-process-detail"><b>{process.id} instruction</b><span>{currentInstruction?.label ?? 'Completed'}</span><small>{state.mutexOwner === process.id ? 'Owns mutex' : `Mutex owner: ${state.mutexOwner ?? 'none'}`}</small></div>}</Panel>
    </aside></div>
    <div className="sl-resource-integrity-grid">
      <Panel className="sl-resource-panel"><h3>Synchronization resources</h3><div className="sl-semaphores">{[['empty','EMPTY · initial 5'],['full','FULL · initial 0'],['mutex','MUTEX · available 1 / held 0']].map(([id,label]) => <button type="button" key={id} className={`sl-metric sl-metric-button ${selectedSemaphore === id ? 'selected' : ''}`} onClick={() => setSelectedSemaphore(id)}><span>{label}</span><strong className={id === 'empty' ? 'amber' : id === 'full' ? 'green' : state.mutexOwner ? 'red' : 'green'}>{id === 'mutex' ? `${state.mutex} · ${state.mutexOwner ?? 'Free'}` : state[id]}</strong></button>)}</div><p className="sl-resource-detail">{selectedSemaphoreInfo.definition}</p><small>{selectedSemaphore === 'empty' ? `Available slots: ${state.empty} · producer reservations: ${state.reservedEmpty}` : selectedSemaphore === 'full' ? `Available orders: ${state.full} · consumer reservations: ${state.reservedFull}` : `Availability: ${state.mutex ? 'unlocked' : 'locked'} · owner: ${state.mutexOwner ?? 'none'}`}</small><small>FIFO waiters: {selectedSemaphoreInfo.waiters.join(' → ') || 'none'}</small><small>Recent change: {selectedSemaphoreInfo.changes[0]?.message ?? 'No resource operation recorded yet.'}</small>{selectedSemaphore === 'mutex' && <small>Last acquire: {lastMutexAcquire?.message ?? 'none'} · Last release: {lastMutexRelease?.message ?? 'none'}</small>}<div className="sl-invariant"><span>Permit accounting</span><b>{state.empty} + {state.full} + {state.reservedEmpty} + {state.reservedFull} = {state.capacity}</b></div></Panel>
      <Panel className="sl-ready-panel"><div className="sl-panel-title"><h3>Ready for pickup</h3><span>{state.readyOrders.length}</span></div>{state.readyOrders.length ? <div className="sl-ready-orders">{state.readyOrders.map((order) => <div key={order.id} className="sl-ready-order"><FoodPhoto item={order}/><span><b>{order.id}</b><small>{order.foodName} · {order.producer}</small></span><button className="sl-btn small" onClick={() => { engine.pickUpOrder(order.id); refresh(); onInteraction(); }}>Pick up</button></div>)}</div> : <p className="sl-muted">Prepared orders will appear here.</p>}</Panel>
      <Panel className={`sl-integrity-panel ${state.integrity.passed ? 'passed' : 'failed'}`}><div className="sl-panel-title"><h3>System integrity</h3><button className="sl-text-button" onClick={() => setIntegrityOpen((open) => !open)}>{integrityOpen ? 'Hide checks' : 'Details'}</button></div><b className="sl-integrity-status">{state.integrityFailure ? 'FAIL · simulation paused' : state.integrity.passed ? 'PASS · invariants hold' : 'FAIL · inspect diagnostic'}</b>{state.integrityFailure && <p><b>{state.integrityFailure.label}</b> · process {state.integrityFailure.processId ?? 'SYSTEM'} · actual {JSON.stringify(state.integrityFailure.actual)} · expected {state.integrityFailure.expected}<br/>Cause: {state.integrityFailure.causeEvent?.message ?? 'Current step'}<br/>Correction: {state.integrityFailure.correction}</p>}{integrityOpen && <div className="sl-integrity-checks">{state.integrity.checks.map((check) => <div key={check.id}><b>{check.status}</b><span>{check.label}</span><small>{check.status === 'FAIL' ? `${JSON.stringify(check.actual)} · expected ${check.expected} · ${check.correction}` : check.status === 'IN FLIGHT' ? 'Reserved permits are between synchronization instructions.' : check.expected}</small></div>)}</div>}</Panel>
    </div>
    <ExecutionAnalysis state={state} engine={engine} inspectedSeq={inspectedStepSeq}/>
  </div>;
}

function ProcessList({ items, selected, onSelect, workers = [], orders = [], processes = [], mutexOwner = null }) {
  if (items[0]?.type === 'CONSUMER') return <KitchenWorkstations workers={workers} orders={orders} selected={selected} onSelect={onSelect} processes={processes} mutexOwner={mutexOwner}/>;
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const processById = new Map(processes.map((proc) => [proc.id, proc]));
  return <div className="sl-process-list">{items.length ? [...items].reverse().map((p) => {
    const food = foodForOrder(p, Number(p.orderId?.match(/\d+/)?.[0] ?? 0));
    const order = orderById.get(p.orderId);
    const proc = processById.get(p.id) ?? p;
    const hasPermit = Boolean(proc.permit);
    const isMutexOwner = mutexOwner === p.id;
    const isWaitingMutex = proc.waitingFor === 'mutex';
    const isWaitingEmpty = proc.waitingFor === 'empty' || p.state === 'BLOCKED';
    return <button type="button" key={p.id} onClick={() => onSelect(p.id)} className={`sl-process-card ${selected === p.id ? 'selected' : ''}`}>
      <span className={`sl-state-dot ${p.state.toLowerCase()}`}/>
      <FoodPhoto item={p} fallbackIndex={Number(p.orderId?.match(/\d+/)?.[0] ?? 0)} className="sl-process-food"/>
      <div className="sl-process-card-body">
        <div className="sl-process-card-header">
          <b className="sl-process-id">{p.id}</b>
          <span className="sl-process-item-title">{p.orderId} · {food.actualName ?? food.name}</span>
          <span className={`sl-process-badge state-${p.state.toLowerCase()}`}>{p.state}</span>
        </div>
        <div className="sl-sync-indicators">
          <span className={`sl-sync-chip ${isWaitingEmpty ? 'waiting-full' : hasPermit ? 'held' : 'none'}`}>
            {isWaitingEmpty ? '⏳ Waiting on wait(empty)' : hasPermit ? '✓ Empty Permit Held' : 'Awaiting Permit'}
          </span>
          <span className={`sl-sync-chip ${isMutexOwner ? 'mutex-held' : isWaitingMutex ? 'mutex-waiting' : 'mutex-none'}`}>
            {isMutexOwner ? '🔒 Owns Mutex (CS)' : isWaitingMutex ? `⏳ Wait Mutex (${mutexOwner})` : 'Mutex Free'}
          </span>
          {order && <span className="sl-order-lifecycle">Order: {order.lifecycle}</span>}
        </div>
      </div>
    </button>;
  }) : <small className="sl-muted">No processes created</small>}</div>;
}

function KitchenWorkstations({ workers, orders, selected, onSelect, processes = [], mutexOwner = null }) {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const processById = new Map(processes.map((proc) => [proc.id, proc]));
  return <div className="sl-workstation-list">{workers.length ? workers.map((worker) => {
    const order = worker.assignedOrderId ? orderById.get(worker.assignedOrderId) : null;
    const proc = processById.get(worker.id);
    const isMutexOwner = mutexOwner === worker.id;
    const hasPermit = Boolean(proc?.permit);
    const isWaitingMutex = worker.state === 'WAITING_FOR_MUTEX' || proc?.waitingFor === 'mutex';
    const isWaitingFull = worker.state === 'WAITING_FOR_ORDER' || proc?.waitingFor === 'full';
    const isCooking = worker.state === 'PREPARING';
    const isOrderClaimed = worker.state === 'PREPARING' || worker.state === 'READY' || worker.state === 'ORDER_REMOVED';

    let statusText = 'Ready for order';
    let badgeLabel = worker.state.replaceAll('_', ' ');
    if (worker.state === 'IDLE') {
      statusText = 'Workstation idle · ready for next order';
      badgeLabel = 'IDLE';
    } else if (worker.state === 'WAITING_FOR_ORDER') {
      statusText = 'Blocked on wait(full) · awaiting order in queue';
      badgeLabel = 'WAITING FULL';
    } else if (worker.state === 'FULL_PERMIT_RESERVED') {
      statusText = 'Full permit reserved · requesting queue lock';
      badgeLabel = 'PERMIT RESERVED';
    } else if (worker.state === 'WAITING_FOR_MUTEX') {
      statusText = `Blocked on wait(mutex) · lock held by ${mutexOwner ?? 'another process'}`;
      badgeLabel = 'WAITING MUTEX';
    } else if (worker.state === 'CRITICAL_SECTION') {
      statusText = `Inside critical section (owns mutex) · claiming ${order?.id || worker.assignedOrderId || 'order'}`;
      badgeLabel = 'CRITICAL SECTION';
    } else if (worker.state === 'ORDER_REMOVED') {
      statusText = `Order ${order?.id || worker.assignedOrderId} dequeued · advancing read pointer`;
      badgeLabel = 'ORDER REMOVED';
    } else if (worker.state === 'PREPARING') {
      statusText = `Preparing ${order?.foodName || worker.foodName || 'dish'} outside critical section`;
      badgeLabel = 'PREPARING';
    } else if (worker.state === 'READY') {
      statusText = `Order ${order?.id || worker.assignedOrderId} is cooked and ready for pickup`;
      badgeLabel = 'READY';
    }

    const prep = calculatePreparationProgress(worker, order);

    return <button type="button" key={worker.id} className={`sl-workstation ${selected === worker.id ? 'selected' : ''}`} onClick={() => onSelect(worker.id)}>
      <span className={`sl-state-dot ${worker.state.toLowerCase()}`}/>
      {order ? <FoodPhoto item={order} className="sl-process-food"/> : <span className="sl-kitchen-icon"><ChefHat size={17}/></span>}
      <div className="sl-workstation-body">
        <div className="sl-workstation-header">
          <b className="sl-workstation-id">{worker.id}</b>
          <span className="sl-workstation-state" data-state={worker.state}>{badgeLabel}</span>
        </div>
        <div className="sl-workstation-detail">
          <span className="sl-workstation-order-name">{order ? `${order.id} · ${order.foodName}` : statusText}</span>
          {order && <small className="sl-workstation-sub-status">{statusText}</small>}
        </div>
        <div className="sl-sync-indicators">
          <span className={`sl-sync-chip ${isWaitingFull ? 'waiting-full' : isOrderClaimed ? 'consumed' : hasPermit ? 'held' : 'none'}`}>
            {isWaitingFull ? '⏳ Waiting on wait(full)' : isOrderClaimed ? `✓ Order Claimed (${order?.id || worker.assignedOrderId})` : hasPermit ? '✓ Order Permit Reserved' : 'Awaiting Order'}
          </span>
          <span className={`sl-sync-chip ${isMutexOwner ? 'mutex-held' : isWaitingMutex ? 'mutex-waiting' : isCooking ? 'cooking-outside-mutex' : 'mutex-none'}`}>
            {isMutexOwner ? '🔒 Owns Mutex (CS)' : isWaitingMutex ? `⏳ Wait Mutex (${mutexOwner})` : isCooking ? '🍳 Cooking Outside Mutex' : 'Mutex Free'}
          </span>
        </div>
        {order && (prep.isCooking || prep.isReady) && <div className="sl-workstation-prep">
          <div className="sl-prep-header">
            <span className="sl-prep-percentage">{prep.label}</span>
          </div>
          {prep.percent !== null && (
            <span className="sl-prep-progress"><i style={{ width: `${prep.percent}%` }}/></span>
          )}
          {prep.ticksText && <em>{prep.ticksText}</em>}
        </div>}
      </div>
    </button>;
  }) : <small className="sl-muted">Add a consumer to create a persistent workstation.</small>}</div>;
}

function ProcessTimeline({ processes, events, onSelectEvent, selectedEventId }) {
  return <div className="sl-process-timeline">{processes.length ? processes.map((process) => {
    const transitions = [...events].reverse().filter((event) => event.processId === process.id && event.transition);
    return <div className="sl-trace-row" key={process.id}><b>{process.id}</b><div className="sl-trace-events">{transitions.length ? transitions.map((event) => <button key={event.id} title={event.message} className={selectedEventId === event.id ? 'selected' : ''} onClick={() => onSelectEvent(event.id)}><span>{event.transition.from}</span><i>→</i><span>{event.transition.to}</span><small>#{event.step}</small></button>) : <small>Transitions appear when scheduled</small>}</div></div>;
  }) : <p className="sl-muted">Create a process to record its lifecycle.</p>}</div>;
}

function eventVariable(event) {
  const operation = event.operation ?? '';
  if (operation.includes('Empty') || operation.includes('empty') || event.message.includes('empty')) return 'empty';
  if (operation.includes('Full') || operation.includes('full') || event.message.includes('full')) return 'full';
  if (operation.toLowerCase().includes('mutex') || event.message.toLowerCase().includes('mutex')) return 'mutex';
  if (operation.includes('insert') || operation.includes('Write')) return 'buffer / writePosition';
  if (operation.includes('remove') || operation.includes('Read')) return 'buffer / readPosition';
  return 'process state';
}

function RaceLane({ title, description, safe, scenario, data, onStepA, onStepB, onNext, onReset }) {
  const variable = scenario === 'producer' ? 'writePosition' : 'readPosition';
  const success = safe && data.interactiveComplete && !data.lostOrder && !data.duplicateConsume;
  return <Panel className={`sl-race-lane ${safe ? 'protected' : 'unsafe'}`}><div className="sl-race-title"><span className="sl-eyebrow">{safe ? 'WITH MUTEX' : 'WITHOUT SYNCHRONIZATION'}</span><span className={`sl-verdict ${safe ? 'good' : 'bad'}`}>{safe ? 'PROTECTED EXECUTION' : 'CONTROLLED COUNTEREXAMPLE'}</span></div><h3>{title}</h3><p>{description}</p><div className="sl-shared-variable"><span>SHARED VARIABLE</span><b>{variable}</b><code>{variable} = {data.sharedValue}</code></div><div className="sl-race-processes">{data.processStatesInteractive.map((p) => <div key={p.id} className={p.state === 'RUNNING' ? 'active' : ''}><b>{scenario === 'producer' ? `Producer ${p.id}` : `Consumer ${p.id}`}</b><em>{p.state}{safe && data.mutexOwner === p.id ? ' · mutex owner' : ''}</em></div>)}</div><div className="sl-button-group sl-race-controls"><button className="sl-btn small" onClick={onStepA}>Step {scenario === 'producer' ? 'Producer' : 'Consumer'} A</button><button className="sl-btn small" onClick={onStepB}>Step {scenario === 'producer' ? 'Producer' : 'Consumer'} B</button><button className="sl-btn small" onClick={onNext} disabled={!data.interactiveNextProcess}>Next operation</button><button className="sl-btn small" onClick={onReset}>Replay / Reset</button></div><div className="sl-race-next"><Activity size={15}/><span>Scheduler next: {data.interactiveNextProcess ? `${scenario === 'producer' ? 'Producer' : 'Consumer'} ${data.interactiveNextProcess}` : 'scenario complete'}</span></div><div className="sl-race-timeline">{data.interactiveEvents.map((e, i) => <div key={e.step} className={`sl-race-event ${i === data.interactiveEvents.length - 1 ? 'current' : ''}`}><span>{String(e.step).padStart(2,'0')}</span><div><p>{e.message}</p><small>{variable}: {e.sharedBefore} → {e.sharedAfter} · mutex: {e.mutexOwnerBefore ?? 'free'} → {e.mutexOwnerAfter ?? 'free'} · {e.outcome}</small></div></div>)}{!data.interactiveEvents.length && <p className="sl-muted">Choose A, B, or the deterministic next operation to begin.</p>}</div>{data.lostOrder && <div className="sl-outcome error">Incorrect result: the second write displaced the first order from slot 0.</div>}{data.duplicateConsume && <div className="sl-outcome error">Incorrect result: two consumers processed the same saved order.</div>}{success && <div className="sl-outcome success">Correct result: the mutex serialized both critical sections and preserved separate orders.</div>}</Panel>;
}

export function RaceLab({ engines, refresh }) {
  const [scenario, setScenario] = useState('producer');
  const { unsafe, safe } = engines;
  const run = (engine, action) => { action(engine); refresh(); };
  const reset = (engine) => { engine.selectScenario(scenario); engine.setProtected(engine === safe); refresh(); };
  const change = (value) => { setScenario(value); unsafe.selectScenario(value); unsafe.setProtected(false); safe.selectScenario(value); safe.setProtected(true); refresh(); };
  const left = unsafe.snapshot(); const right = safe.snapshot();
  return <div className="sl-section-content"><SectionHeading eyebrow="03 / CONTROLLED INTERLEAVING" title="See how a race condition forms." >JavaScript executes one callback at a time. This scheduler deliberately interleaves process-level read and write steps to teach the logical race that concurrent OS processes can encounter.</SectionHeading>
    <div className="sl-race-toolbar"><div className="sl-tabs"><button className={scenario === 'producer' ? 'active' : ''} onClick={() => change('producer')}><Utensils size={15}/> Producer race</button><button className={scenario === 'consumer' ? 'active' : ''} onClick={() => change('consumer')}><ChefHat size={15}/> Consumer race</button></div><p>Advance each lane independently to compare the same scenario.</p></div>
    <div className="sl-race-grid"><RaceLane title={scenario === 'producer' ? 'Two students, one write position' : 'Two kitchen workers, one order'} description={scenario === 'producer' ? 'Choose A and B in any order. Both can read the same pointer before either commits.' : 'Choose A and B in any order. Each consumer keeps its candidate while the other may claim it.'} safe={false} scenario={scenario} data={left} onStepA={() => run(unsafe, (engine) => engine.stepProcess('A'))} onStepB={() => run(unsafe, (engine) => engine.stepProcess('B'))} onNext={() => run(unsafe, (target) => target.stepNextProcess())} onReset={() => reset(unsafe)}/><RaceLane title="Mutex-protected critical section" description="Try stepping B while A owns the lock, then continue A. Ownership transfers to the FIFO waiter." safe scenario={scenario} data={right} onStepA={() => run(safe, (engine) => engine.stepProcess('A'))} onStepB={() => run(safe, (engine) => engine.stepProcess('B'))} onNext={() => run(safe, (engine) => engine.stepNextProcess())} onReset={() => reset(safe)}/></div>
    <Panel className="sl-learning"><BookOpen size={18}/><div><h3>What is the OS concept?</h3><p>A race condition occurs when a result depends on the timing of unsynchronized access to shared data. The unsafe lane is an intentional logical interleaving; it never touches or corrupts the producer-consumer simulator’s real buffer. A mutex makes each critical section indivisible relative to competing processes.</p></div></Panel>
  </div>;
}

const PRODUCER_ALGORITHM = ['wait(empty)', 'wait(mutex)', 'Insert order at buffer[write]', 'write = (write + 1) % 5', 'signal(mutex)', 'signal(full)'];
const CONSUMER_ALGORITHM = ['wait(full)', 'wait(mutex)', 'Remove order at buffer[read]', 'read = (read + 1) % 5', 'signal(mutex)', 'signal(empty)'];
function FlowNode({ x, y, label, sub, shape = 'box', width = 190, height = 42, instruction, activeInstruction, onSelect }) {
  const lines = [label, sub].filter(Boolean);
  return <g className={`sl-flow-node ${shape} ${activeInstruction === instruction ? 'active' : ''} ${onSelect ? 'clickable' : ''}`} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect ? () => onSelect(instruction) : undefined} onKeyDown={onSelect ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(instruction); } } : undefined}>
    {shape === 'decision' ? <polygon points={`${x},${y - height / 2} ${x + width / 2},${y} ${x},${y + height / 2} ${x - width / 2},${y}`} /> : shape === 'terminal' ? <ellipse cx={x} cy={y} rx={width / 2} ry={height / 2} /> : <rect x={x - width / 2} y={y - height / 2} width={width} height={height} rx="7" />}
    <text x={x} y={y - (lines.length > 1 ? 4 : -4)} textAnchor="middle">{label}</text>{sub && <text className="sub" x={x} y={y + 11} textAnchor="middle">{sub}</text>}
  </g>;
}
function Flowchart({ kind, activeInstruction, onSelect }) {
  const producer = kind === 'producer'; const subject = producer ? 'Producer' : 'Consumer';
  const waitLabel = producer ? 'empty permit > 0?' : 'full permit > 0?';
  const change = producer ? 'Insert order at write slot' : 'Remove order at read slot';
  const pointer = producer ? 'write = (write + 1) mod 5' : 'read = (read + 1) mod 5';
  const signal = producer ? 'signal(full)' : 'signal(empty)';
  const blocked = producer ? 'BLOCKED on empty' : 'BLOCKED on full';
  return <svg className="sl-flow-svg" viewBox="0 0 620 710" role="img" aria-label={`${subject} synchronization flowchart. Wait for a buffer permit, acquire the mutex, enter the critical section, update the circular pointer, release the mutex, signal the opposite semaphore, and repeat.`}>
    <defs><marker id={`arrow-${kind}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#a68c61"/></marker></defs>
    <g className="sl-flow-lines" markerEnd={`url(#arrow-${kind})`}>
      <path d="M310 53 V78 M310 120 V148 M310 202 V225 M310 279 V302 M310 350 V374 M310 416 V440 M310 482 V506 M310 548 V572 M310 614 V642"/>
      <path d="M405 175 H450"/><path d="M610 163 H620 V214 H310 V225"/><path d="M405 252 H450"/><path d="M610 282 H620 V326 H420"/>
      <path d="M214 660 H105 V29 H205"/>
    </g>
    <text className="sl-flow-label" x="322" y="218">YES</text><text className="sl-flow-label" x="433" y="164">NO · WAIT</text><text className="sl-flow-label" x="322" y="296">YES</text><text className="sl-flow-label" x="433" y="249">NO · WAIT</text>
    <FlowNode x={310} y={30} label={`${subject} starts`} shape="terminal" width={180} height={45} instruction={producer ? 'waitEmpty' : 'waitFull'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={99} label={producer ? 'Prepare student order' : 'Request next kitchen order'} width={220} instruction={producer ? 'waitEmpty' : 'waitFull'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={175} label={waitLabel} sub={producer ? 'wait(empty)' : 'wait(full)'} shape="decision" width={190} height={54} instruction={producer ? 'waitEmpty' : 'waitFull'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={530} y={163} label={blocked} sub="signal wakes oldest waiter" width={160} height={42} instruction={producer ? 'waitEmpty' : 'waitFull'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={252} label="mutex available?" sub="wait(mutex)" shape="decision" width={190} height={54} instruction="waitMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={530} y={282} label="WAITING on mutex" sub="owner releases lock" width={160} height={42} instruction="waitMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={326} label="Enter critical section" sub="mutex owner only" width={220} instruction="waitMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={395} label={change} width={230} instruction={producer ? 'insert' : 'remove'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={461} label={pointer} sub="circular indexing" width={230} instruction={producer ? 'advanceWrite' : 'advanceRead'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={527} label="signal(mutex) · leave critical section" width={270} instruction="releaseMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={593} label={signal} sub={producer ? 'publish one available order' : 'release one empty slot'} width={230} instruction={producer ? 'signalFull' : 'signalEmpty'} activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={310} y={660} label="Repeat while running" shape="terminal" width={210} height={45} instruction={producer ? 'waitEmpty' : 'waitFull'} activeInstruction={activeInstruction} onSelect={onSelect}/>
  </svg>;
}
function CombinedFlowchart({ activeInstruction, onSelect }) {
  return <svg className="sl-combined-svg" viewBox="0 0 1050 360" role="img" aria-label="Combined producer consumer synchronization flowchart around one five-slot circular buffer">
    <defs><marker id="combined-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#a68c61"/></marker></defs>
    <g className="sl-flow-lines combined-lines" markerEnd="url(#combined-arrow)">
      <path d="M205 94 H274 M414 94 H480 M684 94 H742 M865 94 H918"/>
      <path d="M175 263 H200 M340 263 H350 M510 263 H540 M720 263 H750 M900 263 H915"/>
      <path d="M570 123 V230"/><path className="signal-link" d="M975 123 V175 H270 V230"/><path className="signal-link" d="M980 237 V195 H340 V123"/>
    </g>
    <FlowNode x={115} y={94} label="Student producer" sub="create order" width={180} height={52} instruction="waitEmpty" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={340} y={94} label="wait(empty)" sub="reserve a free slot" width={140} height={52} instruction="waitEmpty" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={570} y={94} label="wait(mutex) → insert" sub="advance write mod 5" width={205} height={58} instruction="insert" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={800} y={94} label="signal(mutex)" sub="leave critical section" width={160} height={52} instruction="releaseMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={975} y={94} label="signal(full)" sub="wake kitchen waiter" width={140} height={52} instruction="signalFull" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={100} y={263} label="Kitchen staff process" sub="request next order" width={150} height={52} instruction="waitFull" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={270} y={263} label="wait(full)" sub="block when no order" width={140} height={52} instruction="waitFull" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={430} y={263} label="wait(mutex) → remove" sub="advance read mod 5" width={160} height={58} instruction="remove" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={630} y={263} label="Shared circular buffer" sub="5 slots · read and write pointers" width={180} height={62} instruction="insert" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={825} y={263} label="signal(mutex)" sub="leave critical section" width={150} height={52} instruction="releaseMutex" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <FlowNode x={980} y={263} label="signal(empty)" sub="wake student waiter" width={130} height={52} instruction="signalEmpty" activeInstruction={activeInstruction} onSelect={onSelect}/>
    <text className="sl-flow-label" x="620" y="168" textAnchor="middle">full signal wakes a waiting consumer</text><text className="sl-flow-label" x="620" y="188" textAnchor="middle">empty signal wakes a waiting producer</text>
  </svg>;
}

export function SynchronizationSolution({ engine, state, refresh, onInteraction, onReset, activeSection }) {
  const [kind, setKind] = useState('PRODUCER'); const [flowSelection, setFlowSelection] = useState(null); const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(900);
  const instructions = PROCESS_INSTRUCTIONS[kind];
  const activeInstruction = flowSelection ?? state.lastInstruction?.op;
  const activeIndex = instructions.findIndex((instruction) => instruction.op === activeInstruction);
  const selectFlowInstruction = (op) => {
    setFlowSelection(op);
    if (['waitFull', 'remove', 'advanceRead', 'signalEmpty'].includes(op)) setKind('CONSUMER');
    else if (['waitEmpty', 'insert', 'advanceWrite', 'signalFull'].includes(op)) setKind('PRODUCER');
  };
  const stepInstruction = () => { engine.stepNextInstruction(); refresh(); onInteraction(); };
  const stepProcess = () => { engine.stepNextProcess(); refresh(); onInteraction(); };

  const [prevActiveSection, setPrevActiveSection] = useState(activeSection);
  if (prevActiveSection !== activeSection) {
    setPrevActiveSection(activeSection);
    if (activeSection !== 'solution' && playing) {
      setPlaying(false);
    }
  }

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      const snap = engine.snapshot();
      if (snap.processes.some((p) => p.state === 'READY' || p.state === 'RUNNING')) {
        engine.stepNextInstruction();
        refresh();
        onInteraction();
      } else if (snap.workers && snap.workers.some((w) => w.state === 'PREPARING')) {
        engine.tickKitchen();
        refresh();
        onInteraction();
      } else {
        setPlaying(false);
      }
    }, speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, engine, refresh, onInteraction]);
  const explain = activeInstruction === 'waitEmpty' ? 'wait(empty) reserves one free slot. With no permit, the producer blocks and resumes after a FIFO signal.'
    : activeInstruction === 'waitFull' ? 'wait(full) reserves one published order. With no permit, the consumer blocks rather than reading an empty slot.'
      : activeInstruction === 'waitMutex' ? 'wait(mutex) gives this process exclusive ownership before it enters the shared-buffer critical section.'
        : activeInstruction === 'insert' ? 'The producer writes its order in the slot named by writePosition. The following pointer instruction performs modulo-five wraparound.'
          : activeInstruction === 'remove' ? 'The consumer removes the order at readPosition. The following pointer instruction advances the circular read index.'
            : activeInstruction === 'advanceWrite' || activeInstruction === 'advanceRead' ? `The pointer advances modulo five. The engine changed ${state.variableChanges ? JSON.stringify(state.variableChanges.before) : 'no variables'} to ${state.variableChanges ? JSON.stringify(state.variableChanges.after) : 'no variables'}.`
              : activeInstruction === 'releaseMutex' ? 'Only the mutex owner can release it. A waiting process receives ownership in FIFO order.'
                : activeInstruction === 'signalFull' ? 'signal(full) publishes the order and wakes the oldest waiting kitchen consumer.'
                  : activeInstruction === 'signalEmpty' ? 'signal(empty) returns a free slot and wakes the oldest waiting student producer.'
                    : 'Select a flowchart node or execute an instruction to see its explanation.';
  const reset = () => { setPlaying(false); engine.pause(); onReset(); setFlowSelection(null); };
  return <div className="sl-section-content"><SectionHeading eyebrow="04 / EXECUTABLE ALGORITHM" title="Select a step. Run it on the shared model." >Flowchart actions and instruction stepping operate on the same five-slot simulation engine used in Explore and Guided Lab.</SectionHeading>
    <div className="sl-semaphore-defs"><Metric label="empty · current / initial" value={`${state.empty} / 5`} tone="amber"/><Metric label="full · current / initial" value={`${state.full} / 0`} tone="green"/><Metric label="mutex · available / held" value={`${state.mutex} / ${state.mutexOwner ? '0' : '1'}`} tone={state.mutexOwner ? 'red' : 'green'}/></div>
    <div className="sl-algorithms"><Panel><h3>Student producer</h3><pre>{PRODUCER_ALGORITHM.map((line, i) => <span role="button" tabIndex={0} key={line} className={kind === 'PRODUCER' && activeIndex === i ? 'algorithm-line current' : 'algorithm-line'} onClick={() => { setKind('PRODUCER'); setFlowSelection(PROCESS_INSTRUCTIONS.PRODUCER[i].op); }}>{line}{'\n'}</span>)}</pre></Panel><Panel><h3>Kitchen consumer</h3><pre>{CONSUMER_ALGORITHM.map((line, i) => <span role="button" tabIndex={0} key={line} className={kind === 'CONSUMER' && activeIndex === i ? 'algorithm-line current' : 'algorithm-line'} onClick={() => { setKind('CONSUMER'); setFlowSelection(PROCESS_INSTRUCTIONS.CONSUMER[i].op); }}>{line}{'\n'}</span>)}</pre></Panel></div>
    <Panel className="sl-instruction-panel"><div className="sl-panel-title"><div><span className="sl-eyebrow">LIVE ENGINE DEBUGGER</span><h3>{state.lastInstruction ? `${state.lastInstruction.processId} · ${state.lastInstruction.label}` : 'Ready for an instruction'}</h3></div><div className="sl-tabs compact-tabs"><button className={kind === 'PRODUCER' ? 'active' : ''} onClick={() => { setKind('PRODUCER'); setFlowSelection(null); }}>Producer</button><button className={kind === 'CONSUMER' ? 'active' : ''} onClick={() => { setKind('CONSUMER'); setFlowSelection(null); }}>Consumer</button></div></div><div className="sl-button-group"><button className="sl-btn primary" onClick={() => setPlaying(true)} disabled={playing}><Play size={15}/> Auto run</button><button className="sl-btn" onClick={() => { engine.pause(); setPlaying(false); refresh(); onInteraction(); }} disabled={!playing}><Pause size={15}/> Pause</button><button className="sl-btn" onClick={() => setPlaying(true)} disabled={playing}><CirclePlay size={15}/> Resume</button><button className="sl-btn" onClick={stepInstruction} disabled={playing}><SkipForward size={15}/> Next instruction</button><button className="sl-btn" onClick={stepProcess} disabled={playing}><Activity size={15}/> Next process</button><button className="sl-btn" onClick={() => { engine.addProducer(); refresh(); onInteraction(); }} disabled={playing}>Add student</button><button className="sl-btn" onClick={() => { engine.addConsumer(); refresh(); onInteraction(); }} disabled={playing}>Add kitchen process</button><button className="sl-btn quiet" onClick={reset}><RotateCcw size={15}/> Reset</button><label className="sl-speed">Speed <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value="1400">Slow</option><option value="900">Normal</option><option value="450">Fast</option></select></label></div><div className="sl-code-steps">{instructions.map((instruction, i) => <div key={instruction.op} className={activeIndex === i ? 'current' : state.lastInstruction?.processType === kind && state.lastInstruction.pc > i ? 'done' : ''}><span>{String(i + 1).padStart(2, '0')}</span><code>{instruction.label}</code>{activeIndex === i && <i>{flowSelection ? 'SELECTED' : 'LAST / CURRENT'}</i>}</div>)}</div><div className="sl-explain-step"><span>OPERATION EXPLANATION</span><p>{state.explanation} {explain}</p></div><div className="sl-debug-vars"><b>Previous instruction</b><span>{state.previousInstruction?.label ?? 'none'}</span><b>Next process instruction</b><span>{state.currentInstruction?.label ?? 'complete or no process selected'}</span><b>Variable changes</b><code>{state.variableChanges ? `${JSON.stringify(state.variableChanges.before)} → ${JSON.stringify(state.variableChanges.after)}` : 'none yet'}</code></div></Panel>
    <div className="sl-flowcharts"><Panel><h3>Producer flow · click a node to highlight code</h3><Flowchart kind="producer" activeInstruction={activeInstruction} onSelect={selectFlowInstruction}/></Panel><Panel><h3>Consumer flow · click a node to highlight code</h3><Flowchart kind="consumer" activeInstruction={activeInstruction} onSelect={selectFlowInstruction}/></Panel><Panel className="combined-flow"><h3>Combined synchronization flow</h3><div className="sl-svg-scroll"><CombinedFlowchart activeInstruction={activeInstruction} onSelect={selectFlowInstruction}/></div></Panel></div>
    <Panel className="sl-compare"><h3>With and without synchronization</h3><div><b>Without coordination</b><span>Processes can claim the same slot, overwrite an order, read an empty position, or corrupt a shared pointer.</span><b>With semaphores and mutex</b><span>Producers wait for capacity, consumers wait for work, and the mutex serializes every shared-buffer change.</span></div></Panel>
  </div>;
}

function LearningModeWorkspace({
  mode,
  setMode,
  setSection,
  simulation,
  experimentId,
  setExperimentId,
  startGuide,
  challengeId,
  setChallengeId,
  challengeSession,
  startChallengeMode,
  challengeResult,
  setChallengeResult,
  engine,
  refresh,
  onInteraction,
  onInspectStep,
}) {
  const [challengeSubMode, setChallengeSubMode] = useState('exercise');
  const [hintOpen, setHintOpen] = useState(false);
  const activeChallenge = CHALLENGES.find((challenge) => challenge.id === challengeId);
  const changeChallenge = (id) => { setChallengeId(id); setHintOpen(false); setChallengeResult(null); startChallengeMode(id); };

  return <>
    <div className="sl-mode-selector" role="tablist" aria-label="Learning mode">
      {[
        ['explore', 'Explore', 'Manual control'],
        ['guided', 'Guided Lab', '6 classroom experiments'],
        ['challenge', 'Challenge', 'Interactive scheduling & problems'],
      ].map(([id, name, detail]) => (
        <button
          type="button"
          role="tab"
          aria-selected={mode === id}
          key={id}
          className={mode === id ? 'active' : ''}
          onClick={() => setMode(id)}
        >
          <b>{name}</b>
          <small>{detail}</small>
        </button>
      ))}
    </div>

    {/* In explore mode, manual controls and buffer view are immediately active below */}

    {mode === 'guided' && (
      <ClassroomWorkbench
        engine={engine}
        state={simulation}
        refresh={refresh}
        onInteraction={onInteraction}
        onInspectStep={onInspectStep}
        activeExperimentId={experimentId}
        onSelectExperiment={(id) => {
          setExperimentId(id);
          startGuide(id);
        }}
      />
    )}

    {mode === 'challenge' && (
      <div className="sl-challenge-workspace-wrapper">
        <div className="sl-challenge-subnav" role="tablist" aria-label="Challenge mode choices">
          <button
            type="button"
            role="tab"
            aria-selected={challengeSubMode === 'exercise'}
            className={`sl-challenge-subtab ${challengeSubMode === 'exercise' ? 'active' : ''}`}
            onClick={() => setChallengeSubMode('exercise')}
          >
            <b>Manual Scheduling Exercise</b>
            <small>Schedule two consumers safely</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={challengeSubMode === 'bank'}
            className={`sl-challenge-subtab ${challengeSubMode === 'bank' ? 'active' : ''}`}
            onClick={() => setChallengeSubMode('bank')}
          >
            <b>Challenge Problem Bank</b>
            <small>4 classic scenario challenges</small>
          </button>
        </div>

        {challengeSubMode === 'exercise' ? (
          <ManualSchedulingExercise
            engine={engine}
            state={simulation}
            refresh={refresh}
            onInteraction={onInteraction}
          />
        ) : (
          activeChallenge && (
            <Panel className="sl-mode-panel challenge-mode">
              <div className="sl-panel-title">
                <div>
                  <span className="sl-eyebrow">CHALLENGE PROBLEM BANK</span>
                  <h3>{activeChallenge.title}</h3>
                </div>
                <span className="sl-progress-tag">ATTEMPT REQUIRED</span>
              </div>
              <div className="sl-mode-toolbar">
                <select
                  value={challengeId}
                  onChange={(event) => changeChallenge(event.target.value)}
                  aria-label="Select challenge"
                >
                  {CHALLENGES.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <button
                  className="sl-btn small"
                  onClick={() => {
                    startChallengeMode(challengeId);
                    setChallengeResult(null);
                    setHintOpen(false);
                  }}
                >
                  Reset challenge
                </button>
                <button className="sl-btn small" onClick={() => setSection(activeChallenge.section)}>
                  Open challenge activity
                </button>
              </div>
              <div className="sl-guided-grid">
                <div>
                  <b>Your task</b>
                  <p>{activeChallenge.prompt}</p>
                  <b>Starting state</b>
                  <p>{activeChallenge.setup}</p>
                  <button className="sl-btn small" onClick={() => setHintOpen((value) => !value)}>
                    {hintOpen ? 'Hide hint' : 'Show hint'}
                  </button>
                  {hintOpen && <p className="sl-hint">Hint: {activeChallenge.hint}</p>}
                </div>
                <div>
                  <b>Evaluate your attempt</b>
                  <p>Run the process in the simulator, then ask the lab to check the resulting engine state.</p>
                  <button
                    className="sl-btn primary small"
                    onClick={() =>
                      setChallengeResult(
                        evaluateChallenge(
                          challengeId,
                          simulation,
                          challengeSession?.baselineSimulationEvents ?? simulation.events.length
                        )
                      )
                    }
                  >
                    Check challenge
                  </button>
                  {challengeResult && (
                    <p className={challengeResult.passed ? 'sl-completion-pass' : 'sl-feedback'}>
                      {challengeResult.message}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )
        )}
      </div>
    )}
  </>;
}

export default function SyncLabLayout() {
  const [section, setSection] = useState('simulator'); const [mode, setMode] = useState('explore');
  const [inspectedStepSeq, setInspectedStepSeq] = useState(null);
  const guideSessionActive = useRef(false);
  const [engine] = useState(() => {
    const eng = new ProducerConsumerEngine({ persistentConsumers: true });
    eng.addProducer(2);
    eng.addConsumer(2);
    return eng;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.__synclab_engine__ = engine;
  }, [engine]);
  const [simulation, setSimulation] = useState(() => engine.snapshot());
  const [raceEngines] = useState(() => { const unsafe = new RaceConditionEngine(); const safe = new RaceConditionEngine(); safe.setProtected(true); return { unsafe, safe }; });
  const [raceState, setRaceState] = useState(() => ({ unsafe: raceEngines.unsafe.snapshot(), safe: raceEngines.safe.snapshot() }));
  const [experimentId, setExperimentId] = useState(EXPERIMENTS[0].id); const [experimentSession, setExperimentSession] = useState(null); const [completedExperiments, setCompletedExperiments] = useState(() => new Set());
  const [challengeId, setChallengeId] = useState(CHALLENGES[0].id); const [challengeSession, setChallengeSession] = useState(null); const [challengeResult, setChallengeResult] = useState(null);
  const recordGuideCompletion = useCallback((nextSimulation, nextRaces) => {
    if (guideSessionActive.current && experimentSession?.id && evaluateExperiment(experimentSession.id, nextSimulation, nextRaces)) {
      setCompletedExperiments((current) => new Set(current).add(experimentSession.id));
    }
  }, [experimentSession]);
  const refresh = useCallback(() => {
    const nextSimulation = engine.snapshot(); const nextRaces = { unsafe: raceEngines.unsafe.snapshot(), safe: raceEngines.safe.snapshot() };
    setSimulation(nextSimulation); setRaceState(nextRaces); recordGuideCompletion(nextSimulation, nextRaces);
  }, [engine, raceEngines, recordGuideCompletion]);
  useEffect(() => {
    if (typeof window !== 'undefined') window.__synclab_refresh__ = refresh;
  }, [refresh]);
  const refreshRaces = useCallback(() => {
    const nextRaces = { unsafe: raceEngines.unsafe.snapshot(), safe: raceEngines.safe.snapshot() };
    setRaceState(nextRaces); recordGuideCompletion(engine.snapshot(), nextRaces);
  }, [engine, raceEngines, recordGuideCompletion]);
  const onInteraction = useCallback(() => setChallengeResult(null), []);
  const handleSectionChange = useCallback((nextSection) => {
    engine.pause();
    refresh();
    setSection(nextSection);
    const mainEl = document.querySelector('main.overflow-y-auto');
    if (mainEl) mainEl.scrollTop = 0;
  }, [engine, refresh]);
  const beginGuide = useCallback((id) => {
    guideSessionActive.current = true;
    engine.pause();
    const session = startExperiment(id, engine, raceEngines); setExperimentSession({ id, ...session }); setCompletedExperiments((current) => { const next = new Set(current); next.delete(id); return next; });
    setSection(session.section); refresh(); refreshRaces();
  }, [engine, raceEngines, refresh, refreshRaces]);
  const beginChallenge = useCallback((id) => {
    guideSessionActive.current = false;
    engine.pause();
    const session = startChallenge(id, engine); setChallengeSession({ id, ...session }); setChallengeResult(null); setSection(session.section); refresh();
  }, [engine, refresh]);
  const resetSimulation = useCallback(() => {
    if (mode === 'guided' && experimentSession?.id) { beginGuide(experimentSession.id); return; }
    if (mode === 'challenge' && challengeSession?.id) { beginChallenge(challengeSession.id); return; }
    engine.reset(); refresh(); onInteraction();
  }, [mode, experimentSession, challengeSession, beginGuide, beginChallenge, engine, refresh, onInteraction]);
  const selectMode = useCallback((nextMode) => {
    setMode(nextMode);
    if (nextMode === 'challenge' && !challengeSession) beginChallenge(challengeId);
  }, [beginChallenge, challengeId, challengeSession]);
  const onScenarioLoaded = useCallback(() => {
    guideSessionActive.current = false;
    setMode('explore'); setExperimentSession(null); setChallengeSession(null); setChallengeResult(null);
  }, []);
  return <SyncLabArena engine={engine} state={simulation} refresh={refresh} />;
}
