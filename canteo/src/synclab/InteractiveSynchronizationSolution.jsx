import { useState, useEffect } from 'react';
import {
  ChefHat,
  ChevronDown,
  ChevronRight,
  Code,
  GitCommit,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Users,
  Utensils,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import {
  SCENARIO_1_STEPS,
  SCENARIO_2_STEPS,
  SCENARIO_3_STEPS,
  POSIX_PSEUDOCODE
} from './educationalSchedules.js';

export { SCENARIO_1_STEPS, SCENARIO_2_STEPS, SCENARIO_3_STEPS };

export function InteractiveSynchronizationSolution({ activeSection = 'semaphores', onNavigateSection }) {
  const [scenarioId, setScenarioId] = useState(1); // 1: Normal, 2: Full, 3: Empty
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false);

  const scenarioSteps =
    scenarioId === 1 ? SCENARIO_1_STEPS : scenarioId === 2 ? SCENARIO_2_STEPS : SCENARIO_3_STEPS;
  const currentStep = stepIndex > 0 ? scenarioSteps[stepIndex - 1] : null;

  // Derive display values
  const emptyCount = currentStep ? currentStep.empty : scenarioId === 2 ? 0 : 5;
  const fullCount = currentStep ? currentStep.full : scenarioId === 2 ? 5 : 0;
  const mutexOwner = currentStep?.mutexOwner ?? null;
  const writePos = currentStep ? currentStep.writePos : 0;
  const readPos = currentStep ? currentStep.readPos : 0;
  const slots = currentStep
    ? currentStep.slots
    : scenarioId === 2
      ? [
          { id: 'O01', name: 'Masala Dosa', producer: 'P1' },
          { id: 'O02', name: 'Idli & Sambar', producer: 'P2' },
          { id: 'O03', name: 'Vegetable Sandwich', producer: 'P3' },
          { id: 'O04', name: 'Samosa', producer: 'P4' },
          { id: 'O05', name: 'Rice Bowl', producer: 'P5' }
        ]
      : [null, null, null, null, null];

  const waitersEmpty = currentStep?.waitersEmpty ?? [];
  const waitersFull = currentStep?.waitersFull ?? [];
  const waitersMutex = currentStep?.waitersMutex ?? [];

  const producerState = currentStep?.producerState ?? {
    state: 'READY',
    action: scenarioId === 2 ? 'Ready to submit 6th order' : 'Ready to create order'
  };
  const consumerState = currentStep?.consumerState ?? {
    state: 'IDLE',
    action: scenarioId === 3 ? 'Ready to request order' : 'Waiting for kitchen orders'
  };

  const activeFlow = currentStep?.activeFlow ?? null;

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || (activeSection !== 'semaphores' && activeSection !== 'solution')) return undefined;
    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= scenarioSteps.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => clearInterval(timer);
  }, [isPlaying, speed, scenarioSteps.length, activeSection]);

  const handleNextStep = () => {
    if (stepIndex < scenarioSteps.length) {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setStepIndex(0);
  };

  const handleChangeScenario = (newId) => {
    setIsPlaying(false);
    setScenarioId(newId);
    setStepIndex(0);
  };

  const isComplete = stepIndex >= scenarioSteps.length;

  return (
    <div className="sl-section-content sl-solution-container">
      {/* SECTION HEADER */}
      <div className="sl-section-heading">
        <div className="sl-eyebrow-row">
          <span className="sl-eyebrow">03 / SYNCHRONIZATION LAB</span>
          <span className="sl-header-badge">SEMAPHORES & MUTEX</span>
        </div>
        <h2>Semaphore and Mutex Laboratory</h2>
        <p>
          Observe real coordination between student producers, kitchen consumers, and the 5-slot bounded buffer.
          See how <code>empty = 5</code> tracks capacity, <code>full = 0</code> tracks ready orders, and <code>mutex = 1</code> prevents race conditions.
        </p>
      </div>

      {/* TOP CONTROLS & SCENARIO SELECTOR */}
      <div className="sl-solution-controls-card">
        <div className="sl-scenario-btn-group">
          <button
            type="button"
            className={`sl-scenario-tab ${scenarioId === 1 ? 'active' : ''}`}
            onClick={() => handleChangeScenario(1)}
          >
            <span className="sl-tab-num">01</span>
            <div className="sl-tab-text">
              <strong>Normal Order Journey</strong>
              <small>Complete End-to-End Cycle</small>
            </div>
          </button>
          <button
            type="button"
            className={`sl-scenario-tab ${scenarioId === 2 ? 'active' : ''}`}
            onClick={() => handleChangeScenario(2)}
          >
            <span className="sl-tab-num">02</span>
            <div className="sl-tab-text">
              <strong>Queue Full (Producer Blocks)</strong>
              <small>Backpressure on wait(empty)</small>
            </div>
          </button>
          <button
            type="button"
            className={`sl-scenario-tab ${scenarioId === 3 ? 'active' : ''}`}
            onClick={() => handleChangeScenario(3)}
          >
            <span className="sl-tab-num">03</span>
            <div className="sl-tab-text">
              <strong>Queue Empty (Consumer Blocks)</strong>
              <small>Sleep state on wait(full)</small>
            </div>
          </button>

          {onNavigateSection && (
            <button
              type="button"
              className="sl-flowcharts-link-pill"
              onClick={() => onNavigateSection('solution')}
              title="Open Solution & Analysis"
            >
              <GitCommit size={14} />
              <span>Solution & Flowcharts</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        <div className="sl-playback-bar">
          <div className="sl-playback-buttons">
            <button
              type="button"
              className={`sl-play-btn ${isPlaying ? 'is-playing' : ''}`}
              onClick={() => setIsPlaying((p) => !p)}
              disabled={isComplete}
              aria-label={isPlaying ? 'Pause simulation' : 'Auto Play simulation'}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
            </button>
            <button
              type="button"
              className="sl-step-btn"
              onClick={handleNextStep}
              disabled={isPlaying || isComplete}
              aria-label="Next Step"
            >
              <SkipForward size={14} />
              <span>Next Step ({stepIndex}/{scenarioSteps.length})</span>
            </button>
            <button
              type="button"
              className="sl-reset-btn"
              onClick={handleReset}
              aria-label="Reset scenario"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>

          <div className="sl-speed-control">
            <label htmlFor="sl-solution-speed-select">Speed:</label>
            <select
              id="sl-solution-speed-select"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value="1400">Slow (1.4s)</option>
              <option value="1000">Normal (1.0s)</option>
              <option value="500">Fast (0.5s)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SYNCHRONIZATION RESOURCES METRIC HUD (4 COLUMNS) */}
      <div className="sl-resources-bar">
        {/* Resource 1: empty */}
        <div className="sl-resource-col">
          <div className="sl-res-header">
            <span className="sl-resource-label">Slot Permits (empty)</span>
            <span className={`sl-res-pill ${emptyCount === 0 ? 'warning' : 'ok'}`}>
              {emptyCount === 0 ? 'Saturated' : 'Available'}
            </span>
          </div>
          <div className="sl-res-meter-row">
            <strong className={`sl-resource-val ${emptyCount === 0 ? 'amber' : 'green'}`}>
              {emptyCount} <span className="sl-res-denom">/ 5</span>
            </strong>
            <div className="sl-segmented-meter" aria-label={`empty permit meter: ${emptyCount} of 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`sl-meter-segment ${i < emptyCount ? 'filled empty-seg' : 'unfilled'}`}
                />
              ))}
            </div>
          </div>
          <small className="sl-res-subtext">
            {emptyCount === 0
              ? '⚠️ Buffer Saturated (Producers block)'
              : 'Permits available for order placement'}
          </small>
        </div>

        {/* Resource 2: full */}
        <div className="sl-resource-col">
          <div className="sl-res-header">
            <span className="sl-resource-label">Item Permits (full)</span>
            <span className={`sl-res-pill ${fullCount === 0 ? 'warning' : 'ok'}`}>
              {fullCount === 0 ? 'Empty' : 'In Queue'}
            </span>
          </div>
          <div className="sl-res-meter-row">
            <strong className={`sl-resource-val ${fullCount === 0 ? 'amber' : 'green'}`}>
              {fullCount} <span className="sl-res-denom">/ 5</span>
            </strong>
            <div className="sl-segmented-meter" aria-label={`full permit meter: ${fullCount} of 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`sl-meter-segment ${i < fullCount ? 'filled full-seg' : 'unfilled'}`}
                />
              ))}
            </div>
          </div>
          <small className="sl-res-subtext">
            {fullCount === 0
              ? '⚠️ Buffer Empty (Consumers block)'
              : 'Orders available for kitchen claim'}
          </small>
        </div>

        {/* Resource 3: mutex */}
        <div className="sl-resource-col">
          <div className="sl-res-header">
            <span className="sl-resource-label">Critical Section Lock (mutex)</span>
            <span className={`sl-res-pill ${mutexOwner ? 'locked' : 'unlocked'}`}>
              {mutexOwner ? 'Locked' : 'Unlocked'}
            </span>
          </div>
          <div className="sl-res-meter-row">
            <strong className={`sl-resource-val ${mutexOwner ? 'red' : 'green'}`}>
              {mutexOwner ? (
                <span className="sl-lock-val">
                  <Lock size={15} /> 0 · Held by {mutexOwner}
                </span>
              ) : (
                <span className="sl-lock-val">
                  <Unlock size={15} /> 1 · Unlocked (Free)
                </span>
              )}
            </strong>
          </div>
          <small className="sl-res-subtext">
            {mutexOwner
              ? `Exclusive queue access by ${mutexOwner}`
              : 'Any waiter can acquire next'}
          </small>
        </div>

        {/* Resource 4: waiters */}
        <div className="sl-resource-col waiters-col">
          <div className="sl-res-header">
            <span className="sl-resource-label">Active Wait Queues</span>
            <span className="sl-res-pill neutral">
              {waitersEmpty.length + waitersFull.length + waitersMutex.length > 0 ? 'Blocked' : 'Clear'}
            </span>
          </div>
          <div className="sl-waiters-grid">
            <div className="sl-wait-item">
              <span className="sl-wait-tag">empty:</span>
              <strong className={waitersEmpty.length ? 'blocked' : 'clear'}>
                {waitersEmpty.length ? waitersEmpty.join(', ') : 'none'}
              </strong>
            </div>
            <div className="sl-wait-item">
              <span className="sl-wait-tag">full:</span>
              <strong className={waitersFull.length ? 'blocked' : 'clear'}>
                {waitersFull.length ? waitersFull.join(', ') : 'none'}
              </strong>
            </div>
            <div className="sl-wait-item">
              <span className="sl-wait-tag">mutex:</span>
              <strong className={waitersMutex.length ? 'blocked' : 'clear'}>
                {waitersMutex.length ? waitersMutex.join(', ') : 'none'}
              </strong>
            </div>
          </div>
          <small className="sl-res-subtext">
            Threads suspended on POSIX wait queues
          </small>
        </div>
      </div>

      {/* STEP EXPLANATION BANNER */}
      <div className="sl-solution-step-banner">
        <div className="sl-solution-step-header">
          <div className="sl-step-tags-cluster">
            <span className="sl-step-tag">
              {stepIndex === 0 ? 'INITIAL INVARIANTS' : `STEP ${stepIndex} / ${scenarioSteps.length}`}
            </span>
            <span className="sl-step-op-name">
              {currentStep ? currentStep.op : 'Starting Conditions'}
            </span>
          </div>
          <span className="sl-step-concept">
            <CheckCircle2 size={13} />
            <span>{currentStep ? currentStep.concept : 'Initial Invariants'}</span>
          </span>
        </div>
        <p className="sl-solution-step-text">
          {currentStep ? currentStep.explanation : (
            scenarioId === 1
              ? 'Scenario 1: Start with an empty queue. Click "Next Step" to walk through one complete order placement and collection cycle.'
              : scenarioId === 2
                ? 'Scenario 2: The buffer is completely full (5 orders). Watch how the 6th student producer blocks on wait(empty) without corrupting memory, and how the kitchen frees a slot.'
                : 'Scenario 3: The buffer is empty. Watch how a kitchen consumer blocks on wait(full) without busy-waiting, and how a new student order wakes it up.'
          )}
        </p>
        {currentStep && (
          <div className="sl-solution-step-code">
            <Code size={13} />
            <code>{currentStep.code}</code>
          </div>
        )}
      </div>

      {/* CONNECTED 3-WAY VISUAL MODEL: PRODUCER | BOUNDED QUEUE | CONSUMER */}
      <div className="sl-solution-model-grid">
        {/* STUDENT PRODUCER WORKSTATION */}
        <div
          className={`sl-actor-column producer-card ${
            activeFlow?.actor === 'P1' || activeFlow?.actor === 'P6' ? 'active-actor' : ''
          }`}
        >
          <div className="sl-actor-header">
            <div className="sl-actor-icon student">
              <Users size={18} />
            </div>
            <div className="sl-actor-meta">
              <h4>Student Producer ({scenarioId === 2 ? 'P6' : 'P1'})</h4>
              <small>Orders Food · Produces Items</small>
            </div>
            <span className={`sl-actor-state-badge state-${producerState.state.toLowerCase()}`}>
              {producerState.state}
            </span>
          </div>

          <div className="sl-actor-detail">
            <span className="sl-detail-label">Current Action:</span>
            <strong className="sl-detail-value">{producerState.action}</strong>
          </div>

          <div className="sl-actor-flow-track">
            <div className="sl-flow-track-header">
              <span className="sl-eyebrow">PRODUCER SYNCHRONIZATION ALGORITHM</span>
            </div>
            <div className="sl-flow-steps">
              {[
                { id: 'waitEmpty', label: '1. wait(empty)', desc: 'Reserve slot permit', inLock: false },
                { id: 'waitMutex', label: '2. wait(mutex)', desc: 'Enter critical section', inLock: true, isBoundary: 'start' },
                { id: 'insert', label: '3. insert(order)', desc: 'Write buffer[write]', inLock: true },
                { id: 'advanceWrite', label: '4. write = (write+1)%5', desc: 'Modulo advance', inLock: true },
                { id: 'signalMutex', label: '5. signal(mutex)', desc: 'Exit critical section', inLock: true, isBoundary: 'end' },
                { id: 'signalFull', label: '6. signal(full)', desc: 'Publish order item', inLock: false }
              ].map((step) => {
                const isActive = activeFlow?.step === step.id;
                const isBlocked = isActive && producerState.state === 'BLOCKED';
                return (
                  <div
                    key={step.id}
                    className={`sl-flow-step ${isActive ? 'active' : ''} ${isBlocked ? 'blocked' : ''} ${
                      step.inLock ? 'in-critical-section' : ''
                    }`}
                  >
                    <div className="sl-step-label-row">
                      <b>{step.label}</b>
                      {step.inLock && <span className="sl-cs-mini-tag">🔒 CS</span>}
                    </div>
                    <small>{step.desc}</small>
                    {isBlocked && (
                      <span className="sl-blocked-pill">
                        <AlertTriangle size={11} /> BLOCKED · WAITING
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 5-SLOT BOUNDED BUFFER QUEUE */}
        <div className="sl-queue-center-panel">
          <div className="sl-queue-header">
            <div>
              <span className="sl-eyebrow">SHARED MEMORY · CIRCULAR BUFFER</span>
              <h4>Bounded Queue (Capacity 5)</h4>
            </div>
            <div className="sl-queue-pointers-legend">
              <span className="sl-legend-pill write">
                Write: <strong>Slot {writePos}</strong>
              </span>
              <span className="sl-legend-pill read">
                Read: <strong>Slot {readPos}</strong>
              </span>
            </div>
          </div>

          <div className="sl-queue-slots-row">
            {slots.map((slot, idx) => {
              const isWrite = writePos === idx;
              const isRead = readPos === idx;
              return (
                <div
                  key={idx}
                  className={`sl-q-slot ${slot ? 'filled' : 'empty'} ${isWrite ? 'target-write' : ''} ${
                    isRead ? 'target-read' : ''
                  }`}
                >
                  <div className="sl-q-slot-top">
                    <span className="sl-q-idx">SLOT {idx}</span>
                    {slot && <span className="sl-q-badge">QUEUED</span>}
                  </div>
                  <div className="sl-q-slot-body">
                    {slot ? (
                      <>
                        <b className="sl-q-dish-name">{slot.name}</b>
                        <span className="sl-q-id">
                          {slot.id} · {slot.producer}
                        </span>
                      </>
                    ) : (
                      <div className="sl-q-empty-body">
                        <Utensils size={14} />
                        <span>Empty Slot</span>
                      </div>
                    )}
                  </div>
                  <div className="sl-q-pointers">
                    {isWrite && <span className="sl-ptr write">WRITE</span>}
                    {isRead && <span className="sl-ptr read">READ</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sl-queue-notes">
            <CheckCircle2 size={14} className="green" />
            <span>
              Circular indexing uses modulo arithmetic: <code>next = (current + 1) % 5</code>. Wraps around automatically!
            </span>
          </div>
        </div>

        {/* KITCHEN CONSUMER WORKSTATION */}
        <div
          className={`sl-actor-column consumer-card ${
            activeFlow?.actor === 'C1' ? 'active-actor' : ''
          }`}
        >
          <div className="sl-actor-header">
            <div className="sl-actor-icon kitchen">
              <ChefHat size={18} />
            </div>
            <div className="sl-actor-meta">
              <h4>Kitchen Staff Consumer (C1)</h4>
              <small>Prepares Food · Consumes Items</small>
            </div>
            <span className={`sl-actor-state-badge state-${consumerState.state.toLowerCase()}`}>
              {consumerState.state}
            </span>
          </div>

          <div className="sl-actor-detail">
            <span className="sl-detail-label">Current Action:</span>
            <strong className="sl-detail-value">{consumerState.action}</strong>
          </div>

          <div className="sl-actor-flow-track">
            <div className="sl-flow-track-header">
              <span className="sl-eyebrow">CONSUMER SYNCHRONIZATION ALGORITHM</span>
            </div>
            <div className="sl-flow-steps">
              {[
                { id: 'waitFull', label: '1. wait(full)', desc: 'Reserve item permit', inLock: false },
                { id: 'waitMutex', label: '2. wait(mutex)', desc: 'Enter critical section', inLock: true, isBoundary: 'start' },
                { id: 'remove', label: '3. remove(order)', desc: 'Read buffer[read]', inLock: true },
                { id: 'advanceRead', label: '4. read = (read+1)%5', desc: 'Modulo advance', inLock: true },
                { id: 'signalMutex', label: '5. signal(mutex)', desc: 'Exit critical section', inLock: true, isBoundary: 'end' },
                { id: 'signalEmpty', label: '6. signal(empty)', desc: 'Free buffer slot', inLock: false },
                { id: 'cook', label: '7. cook_food(order)', desc: 'COOK OUTSIDE LOCK!', inLock: false, isSpecial: true }
              ].map((step) => {
                const isActive = activeFlow?.step === step.id;
                const isBlocked = isActive && consumerState.state === 'BLOCKED';
                return (
                  <div
                    key={step.id}
                    className={`sl-flow-step ${isActive ? 'active' : ''} ${isBlocked ? 'blocked' : ''} ${
                      step.inLock ? 'in-critical-section' : ''
                    } ${step.isSpecial ? 'special-cook' : ''}`}
                  >
                    <div className="sl-step-label-row">
                      <b>{step.label}</b>
                      {step.inLock && <span className="sl-cs-mini-tag">🔒 CS</span>}
                      {step.isSpecial && <span className="sl-cook-mini-tag">🍳 OUTSIDE LOCK</span>}
                    </div>
                    <small>{step.desc}</small>
                    {isBlocked && (
                      <span className="sl-blocked-pill">
                        <AlertTriangle size={11} /> BLOCKED · WAITING
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* TECHNICAL DETAILS EXPANDABLE ACCORDION (POSIX PSEUDOCODE) */}
      <div className="sl-pseudocode-drawer">
        <button
          type="button"
          className="sl-drawer-toggle"
          onClick={() => setCodeDrawerOpen((o) => !o)}
          aria-expanded={codeDrawerOpen}
        >
          <div className="sl-toggle-left">
            <Code size={16} />
            <span>Show Complete POSIX Semaphore C Pseudocode</span>
          </div>
          {codeDrawerOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {codeDrawerOpen && (
          <div className="sl-drawer-content">
            <div className="sl-code-columns">
              <div className="sl-code-block">
                <h5>Producer Thread Function (Student)</h5>
                <pre>{POSIX_PSEUDOCODE.producer}</pre>
              </div>

              <div className="sl-code-block">
                <h5>Consumer Thread Function (Kitchen Worker)</h5>
                <pre>{POSIX_PSEUDOCODE.consumer}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
