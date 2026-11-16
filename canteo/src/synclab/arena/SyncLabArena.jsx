import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ProducerConsumerEngine } from '../engine/ProducerConsumerEngine.js';
import { loadSimulatorScenario } from '../scenarios.js';
import { ArenaHeader } from './ArenaHeader.jsx';
import { StateLegend } from './StateLegend.jsx';
import { ProcessStepperBar } from './ProcessStepperBar.jsx';
import { CircularBuffer } from './CircularBuffer.jsx';
import { ProcessOrbit } from './ProcessOrbit.jsx';
import { LiveQueueFlow } from './LiveQueueFlow.jsx';
import { ControlDock } from './ControlDock.jsx';
import { ContextInspector } from './ContextInspector.jsx';
import { RaceConditionArena } from './RaceConditionArena.jsx';
import { SynchronizationFlowchartsView } from '../SynchronizationFlowchartsView.jsx';
import { SyncLab3DPage } from '../3d/SyncLab3DPage.jsx';
import {
  deriveSystemStatus,
  deriveLastEventDetails,
  deriveSessionSummary,
  filterRecentLifecycleEvents,
  createMulberry32,
} from './simulatorStatusHelper.js';
import '../styles/arena.css';

export function SyncLabArena({
  engine: externalEngine = null,
  state: externalState = null,
  refresh: externalRefresh = null,
}) {
  const [internalEngine] = useState(() => {
    const eng = new ProducerConsumerEngine({ persistentConsumers: true });
    eng.addProducer(2);
    eng.addConsumer(2);
    return eng;
  });
  const engine = externalEngine ?? internalEngine;

  const [localState, setLocalState] = useState(() => {
    if (externalState) return externalState;
    return engine.snapshot();
  });

  const state = externalState ?? localState;

  const refreshState = useCallback(() => {
    if (externalRefresh) {
      externalRefresh();
    } else {
      setLocalState(engine.snapshot());
    }
  }, [engine, externalRefresh]);

  // Navigation view: 'arena' | 'race' | 'flowcharts' | 'overview'
  const [view, setView] = useState('arena');

  // Inspector state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState('concurrency');
  const [inspectorTarget, setInspectorTarget] = useState(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);

  // Process Manager Dialog state
  const [isProcessManagerOpen, setIsProcessManagerOpen] = useState(false);

  // Experiment Settings state
  const [workloadMode, setWorkloadMode] = useState('single'); // 'single' | 'continuous'
  const [prepDuration, setPrepDuration] = useState(3); // 1 (Fast), 3 (Normal), 5 (Relaxed)
  const [producerDelay, setProducerDelay] = useState(0); // 0 (Instant), 1 (Staged)
  const [randomSeed, setRandomSeed] = useState(1337);
  const prngRef = useRef(createMulberry32(1337));

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(900);
  const [stepCount, setStepCount] = useState(0);

  // Scheduling & Selection
  const [schedulingMode, setSchedulingMode] = useState('roundRobin');
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [currentScenario, setCurrentScenario] = useState('normal');

  // Scheduler message / diagnostics
  const [schedulerWarning, setSchedulerWarning] = useState(null);

  // Ref to hold the freshest handleStep function for the interval
  const handleStepRef = useRef();

  // Step logic
  const handleStep = useCallback(() => {
    setSchedulerWarning(null);

    // Query active engine directly to avoid stale state lag
    const activeProcesses = engine.processes || [];
    const activeWorkers = engine.workers || [];
    const candidates = activeProcesses.filter(
      (p) => p.state === 'READY' || p.state === 'RUNNING'
    );

    if (schedulingMode === 'manual' && !isPlaying) {
      if (!selectedProcessId) {
        setSchedulerWarning('Manual mode requires process selection. Click a student producer or kitchen consumer card to step.');
        return;
      }
      const proc = activeProcesses.find((p) => p.id === selectedProcessId);
      if (!proc) {
        setSchedulerWarning(`Process ${selectedProcessId} not found.`);
      } else if (proc.state === 'BLOCKED' || proc.state === 'WAITING') {
        const reason = proc.waitingFor === 'full'
          ? 'waiting for an order (sem_wait(&full))'
          : proc.waitingFor === 'empty'
          ? 'waiting for empty buffer slot (sem_wait(&empty))'
          : `waiting for mutex held by ${state.mutexOwner || 'another thread'}`;
        setSchedulerWarning(`Cannot dispatch ${proc.id}: thread is ${proc.state} (${reason}). Select a READY thread or publish an order.`);
      } else if (proc.state === 'PREPARING') {
        try {
          engine.tickKitchen();
          setStepCount((c) => c + 1);
        } catch (err) {}
      } else if (proc.state === 'COMPLETED') {
        setSchedulerWarning(`Cannot dispatch ${proc.id}: routine has completed.`);
      } else {
        engine.step(proc.id);
        setStepCount((c) => c + 1);
      }
    } else if (schedulingMode === 'random') {
      if (candidates.length > 0) {
        const randVal = prngRef.current();
        const randomIndex = Math.floor(randVal * candidates.length);
        engine.step(candidates[randomIndex].id);
        setStepCount((c) => c + 1);
      } else {
        const prep = activeWorkers.filter((w) => w.state === 'PREPARING');
        if (prep.length > 0) {
          try {
            engine.tickKitchen();
            setStepCount((c) => c + 1);
          } catch (err) {}
        } else {
          if (isPlaying) {
            setIsPlaying(false);
          }
          if (engine.integrityFailure) {
            setSchedulerWarning(`Synchronization failure: ${engine.integrityFailure.invariant}.`);
          } else if (activeProcesses.length === 0) {
            setSchedulerWarning('Simulation idle: No processes exist. Add a student producer or kitchen consumer to begin.');
          } else if (activeProcesses.every((p) => p.state === 'COMPLETED')) {
            setSchedulerWarning('All processes have completed their operations. Session complete.');
          } else if (activeProcesses.some((p) => p.state === 'BLOCKED' || p.state === 'WAITING')) {
            setSchedulerWarning('Remaining processes are waiting for synchronization resources (sem_wait / mutex). Playback paused.');
          }
        }
      }
    } else {
      // Round Robin mode (and Play continuous playback)
      if (candidates.length > 0) {
        engine.step();
        setStepCount((c) => c + 1);
      } else {
        const prep = activeWorkers.filter((w) => w.state === 'PREPARING');
        if (prep.length > 0) {
          try {
            engine.tickKitchen();
            setStepCount((c) => c + 1);
          } catch (err) {}
        } else {
          if (isPlaying) {
            setIsPlaying(false);
          }
          if (engine.integrityFailure) {
            setSchedulerWarning(`Synchronization failure: ${engine.integrityFailure.invariant}.`);
          } else if (activeProcesses.length === 0) {
            setSchedulerWarning('Simulation idle: No processes exist. Add a student producer or kitchen consumer to begin.');
          } else if (activeProcesses.every((p) => p.state === 'COMPLETED')) {
            setSchedulerWarning('All processes have completed their operations. Session complete.');
          } else if (activeProcesses.some((p) => p.state === 'BLOCKED' || p.state === 'WAITING')) {
            setSchedulerWarning('Remaining processes are waiting for synchronization resources (sem_wait / mutex). Playback paused.');
          }
        }
      }
    }

    refreshState();
  }, [engine, selectedProcessId, schedulingMode, isPlaying, state.mutexOwner, refreshState]);

  handleStepRef.current = handleStep;

  // Auto-play interval using handleStepRef to guarantee fresh closures
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      handleStepRef.current?.();
    }, speed);
    return () => clearInterval(timer);
  }, [isPlaying, speed]);

  // Reset logic (resets current scenario or initial active processes)
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSchedulerWarning(null);
    prngRef.current = createMulberry32(randomSeed);
    engine.reset();
    engine.addProducer(2, { workloadMode, preparationDuration: prepDuration });
    engine.addConsumer(2);
    setStepCount(0);
    setSelectedProcessId(null);
    setSelectedSlotIndex(null);
    setInspectorOpen(false);
    setInspectorTarget(null);
    refreshState();
  }, [engine, workloadMode, prepDuration, randomSeed, refreshState]);

  // Clear Session logic (returns to empty canvas with 0 processes)
  const handleClearSession = useCallback(() => {
    const hasWork = (state.processes?.length > 0) || (state.occupancy > 0);
    if (hasWork) {
      const confirmed = window.confirm('Clear active session? This will remove all processes and reset the shared buffer.');
      if (!confirmed) return;
    }
    setIsPlaying(false);
    setSchedulerWarning(null);
    prngRef.current = createMulberry32(randomSeed);
    engine.reset();
    setStepCount(0);
    setSelectedProcessId(null);
    setSelectedSlotIndex(null);
    setInspectorOpen(false);
    setInspectorTarget(null);
    refreshState();
  }, [engine, state.processes, state.occupancy, randomSeed, refreshState]);

  // Scenario Loader (pauses execution and confirms before replacing a nonempty session)
  const handleSelectScenario = useCallback((scenarioId) => {
    setIsPlaying(false);
    const hasWork = (state.processes && state.processes.length > 0) || (state.occupancy > 0);
    if (hasWork) {
      const confirmed = window.confirm(
        'Switch scenario? Active session has running processes or buffer orders. Switching will replace the active session.'
      );
      if (!confirmed) {
        return;
      }
    }

    setSchedulerWarning(null);
    setCurrentScenario(scenarioId);

    if (scenarioId === 'race') {
      setView('race');
      return;
    }

    setView('arena');
    loadSimulatorScenario(scenarioId, engine);
    setStepCount(0);
    setSelectedProcessId(null);
    setSelectedSlotIndex(null);
    setInspectorOpen(false);
    setInspectorTarget(null);
    refreshState();
  }, [engine, state.processes, state.occupancy, refreshState]);

  // Add Producer
  const handleAddProducer = useCallback((count = 1) => {
    setSchedulerWarning(null);
    const res = engine.addProducer(count, { workloadMode, preparationDuration: prepDuration });
    refreshState();
    if (!isPlaying) {
      setSchedulerWarning(`${res.ids.join(', ')} added · Press Play or Step to run`);
    }
  }, [engine, workloadMode, prepDuration, isPlaying, refreshState]);

  // Add Consumer
  const handleAddConsumer = useCallback((count = 1) => {
    setSchedulerWarning(null);
    const res = engine.addConsumer(count, { workloadMode, preparationDuration: prepDuration });
    refreshState();
    if (!isPlaying) {
      setSchedulerWarning(`${res.ids.join(', ')} added · Press Play or Step to run`);
    }
  }, [engine, workloadMode, prepDuration, isPlaying, refreshState]);

  // Safe Process Removal
  const handleRemoveProcess = useCallback((target) => {
    setSchedulerWarning(null);
    const res = engine.removeProcess(target);
    refreshState();
    if (!res || !res.success) {
      if (res?.reason) {
        setSchedulerWarning(res.reason);
      }
      return;
    }
    const pid = res.processId;
    if (res.graceful) {
      setSchedulerWarning(`${pid} owns resources; will finish its current operation before retiring.`);
    } else {
      setSchedulerWarning(`${pid} removed safely.`);
    }
    if (selectedProcessId === pid) {
      setSelectedProcessId(null);
    }
    if (inspectorTarget?.id === pid && !res.graceful) {
      setInspectorOpen(false);
      setInspectorTarget(null);
    }
  }, [engine, selectedProcessId, inspectorTarget, refreshState]);

  // Inspect slot
  const handleSelectSlot = useCallback((index, slot) => {
    setIsProcessManagerOpen(false);
    setSelectedSlotIndex(index);
    setInspectorTarget({ index, slot });
    setInspectorMode('slot');
    setInspectorOpen(true);
  }, []);

  // Inspect process
  const handleInspectProcess = useCallback((process) => {
    setIsProcessManagerOpen(false);
    setSelectedProcessId(process.id);
    setInspectorTarget(process);
    setInspectorMode('process');
    setInspectorOpen(true);
  }, []);

  // Inspect hub
  const handleOpenHubInspector = useCallback(() => {
    setIsProcessManagerOpen(false);
    setInspectorMode('concurrency');
    setInspectorTarget(null);
    setInspectorOpen(true);
  }, []);

  // Toggle Activity Drawer
  const handleToggleActivity = useCallback(() => {
    setIsProcessManagerOpen(false);
    setInspectorMode('activity');
    setInspectorTarget(null);
    setInspectorOpen((prev) => !prev);
  }, []);

  // Accurate semaphore extraction
  const emptyVal = typeof state.empty === 'number' ? state.empty : (state.empty?.value ?? 5);
  const fullVal = typeof state.full === 'number' ? state.full : (state.full?.value ?? 0);
  const mutexOwner = state.mutexOwner ?? (state.mutex === 0 ? state.lastScheduledId : null);
  const capacity = state.buffer?.capacity ?? state.capacity ?? 5;

  // Process counts and pending stopping counts for steppers
  const producers = useMemo(() => (state.processes || []).filter((p) => p.type === 'PRODUCER'), [state.processes]);
  const consumers = useMemo(() => (state.processes || []).filter((p) => p.type === 'CONSUMER'), [state.processes]);
  const producerCount = producers.length;
  const stoppingProducersCount = useMemo(() => producers.filter((p) => p.stoppingRequested).length, [producers]);
  const consumerCount = consumers.length;
  const stoppingConsumersCount = useMemo(() => consumers.filter((p) => p.stoppingRequested).length, [consumers]);

  // Derived system status line (adheres to actual state without false recommendations)
  const systemStatus = useMemo(
    () =>
      deriveSystemStatus({
        state,
        isPlaying,
        schedulingMode,
        selectedProcessId,
        integrityFailure: engine.integrityFailure,
      }),
    [state, isPlaying, schedulingMode, selectedProcessId, engine.integrityFailure]
  );

  // Derived last executed event details (Who, What, Changed)
  const lastEventDetails = useMemo(() => deriveLastEventDetails(state), [state]);

  // Derived session summary (Produced · Collected · Completed)
  const sessionSummary = useMemo(
    () => deriveSessionSummary(state.events, state.orders),
    [state.events, state.orders]
  );

  // Filtered recent lifecycle events for expandable activity drawer
  const recentEvents = useMemo(
    () => filterRecentLifecycleEvents(state.events, 8),
    [state.events]
  );

  // Compute concise next action preview line
  const nextActionText = useMemo(() => {
    if (schedulerWarning) {
      return schedulerWarning;
    }

    const candidates = (state.processes || []).filter(
      (p) => p.state === 'READY' || p.state === 'RUNNING'
    );
    const proc = (selectedProcessId && (state.processes || []).find((p) => p.id === selectedProcessId)) || candidates[0];

    if (!proc) {
      const prepCount = (state.processes || []).filter((p) => p.state === 'PREPARING').length;
      if (prepCount > 0) {
        return `Kitchen preparing ${prepCount} order(s). Click Step or Play to advance preparation.`;
      }
      const waitingConsumers = (state.processes || []).filter(
        (p) => p.type === 'CONSUMER' && (p.state === 'BLOCKED' || p.waitingFor === 'full')
      ).length;
      if (waitingConsumers > 0 && fullVal === 0) {
        return `${waitingConsumers} consumer(s) waiting for orders. Add or run a student producer to continue.`;
      }
      const waitingProducers = (state.processes || []).filter(
        (p) => p.type === 'PRODUCER' && (p.state === 'BLOCKED' || p.waitingFor === 'empty')
      ).length;
      if (waitingProducers > 0 && emptyVal === 0) {
        return `Buffer full. ${waitingProducers} producer(s) waiting for empty slots. Run a kitchen consumer.`;
      }
      return 'All processes waiting or complete. Add a student producer or kitchen consumer.';
    }

    if (proc.stoppingRequested) {
      return `${proc.id} marked for graceful removal. Completing current operation before retiring.`;
    }

    if (proc.state === 'BLOCKED' || proc.state === 'WAITING') {
      if (proc.waitingFor === 'full') {
        return `${proc.id} is blocked waiting for an order (sem_wait(&full)). Publish an order to wake this consumer.`;
      }
      if (proc.waitingFor === 'empty') {
        return `${proc.id} is blocked waiting for an empty buffer slot (sem_wait(&empty)). Consume an order to free capacity.`;
      }
      return `${proc.id} is waiting for mutex lock held by ${mutexOwner || 'another thread'}.`;
    }

    if (proc.state === 'PREPARING') {
      const worker = (state.workers || []).find((w) => w.id === proc.id);
      return `${proc.id} is preparing ${proc.foodName || 'order'} in kitchen (${worker?.preparationProgress ?? 0}/${worker?.preparationDuration ?? 3} steps).`;
    }

    if (proc.state === 'COMPLETED') {
      return `${proc.id} has completed its routine.`;
    }

    const pc = proc.pc ?? 0;
    const isProducer = proc.type === 'PRODUCER';
    const writePos = state.writePosition ?? state.buffer?.writePosition ?? 0;
    const readPos = state.readPosition ?? state.buffer?.readPosition ?? 0;

    if (isProducer) {
      if (pc === 0) {
        return emptyVal > 0
          ? `${proc.id} will execute sem_wait(&empty) — succeeds, reserving slot.`
          : `${proc.id} will execute sem_wait(&empty) — blocks, buffer is full.`;
      }
      if (pc === 1) {
        return !mutexOwner || mutexOwner === proc.id
          ? `${proc.id} will execute pthread_mutex_lock(&mutex) — acquires lock.`
          : `${proc.id} will execute pthread_mutex_lock(&mutex) — waits for mutex held by ${mutexOwner}.`;
      }
      if (pc === 2) {
        return `${proc.id} will execute buffer[${writePos}] = order — writes to slot [${writePos}].`;
      }
      if (pc === 3) {
        return `${proc.id} will execute in = (in + 1) % 5 — advances write pointer to ${(writePos + 1) % 5}.`;
      }
      if (pc === 4) {
        return `${proc.id} will execute pthread_mutex_unlock(&mutex) — leaves Critical Section.`;
      }
      if (pc === 5) {
        return `${proc.id} will execute sem_post(&full) — signals available order.`;
      }
    } else {
      if (pc === 0) {
        return fullVal > 0
          ? `${proc.id} will execute sem_wait(&full) — succeeds, reserving order.`
          : `${proc.id} will execute sem_wait(&full) — blocks, buffer is empty.`;
      }
      if (pc === 1) {
        return !mutexOwner || mutexOwner === proc.id
          ? `${proc.id} will execute pthread_mutex_lock(&mutex) — acquires lock.`
          : `${proc.id} will execute pthread_mutex_lock(&mutex) — waits for mutex held by ${mutexOwner}.`;
      }
      if (pc === 2) {
        return `${proc.id} will execute order = buffer[${readPos}] — dequeues from slot [${readPos}].`;
      }
      if (pc === 3) {
        return `${proc.id} will execute out = (out + 1) % 5 — advances read pointer to ${(readPos + 1) % 5}.`;
      }
      if (pc === 4) {
        return `${proc.id} will execute pthread_mutex_unlock(&mutex) — leaves Critical Section.`;
      }
      if (pc === 5) {
        return `${proc.id} will execute sem_post(&empty) — frees slot for producers.`;
      }
    }

    return `${proc.id} ready to step.`;
  }, [state, selectedProcessId, emptyVal, fullVal, mutexOwner, schedulerWarning]);

  return (
    <div className="synclab-arena-root" data-simulation-revision={state.revision ?? 0}>
      {/* Level 1: Page Identity & Navigation */}
      <ArenaHeader
        activeView={view}
        onChangeView={setView}
        onAddProducer={() => handleAddProducer(1)}
        onAddConsumer={() => handleAddConsumer(1)}
        onReset={handleReset}
        onClearSession={handleClearSession}
        onOpenProcessManager={() => setIsProcessManagerOpen(true)}
        processCount={(state.processes || []).length}
      />

      {/* Level 2 & 3: Arena Workspace Canvas */}
      <div
        className="arena-canvas-container"
        style={{ display: view === 'arena' ? 'block' : 'none' }}
      >
        {/* Subtle Technical Semaphore Bar */}
        <StateLegend
          emptyCount={emptyVal}
          fullCount={fullVal}
          capacity={capacity}
          mutexOwner={mutexOwner}
          onClickInspect={handleOpenHubInspector}
        />

        {/* Stepper Count Controls: Producers [−] 2 [+]    Consumers [−] 3 [+] */}
        <ProcessStepperBar
          producerCount={producerCount}
          stoppingProducersCount={stoppingProducersCount}
          consumerCount={consumerCount}
          stoppingConsumersCount={stoppingConsumersCount}
          onAddProducer={() => handleAddProducer(1)}
          onRemoveProducer={() => handleRemoveProcess('PRODUCER')}
          onAddConsumer={() => handleAddConsumer(1)}
          onRemoveConsumer={() => handleRemoveProcess('CONSUMER')}
          onOpenProcessManager={() => {
            setInspectorOpen(false);
            setIsProcessManagerOpen(true);
          }}
        />

        {/* Centerpiece: Circular Buffer Visualization */}
        <div className="arena-stage-area">
          <CircularBuffer
            state={state}
            selectedSlotIndex={selectedSlotIndex}
            onSelectSlot={handleSelectSlot}
            onOpenHubInspector={handleOpenHubInspector}
          />

          {/* Orbiting Processes (Producers & Consumers) */}
          <ProcessOrbit
            processes={state.processes ?? []}
            selectedProcessId={selectedProcessId}
            onSelectProcess={(id) => setSelectedProcessId(id)}
            onInspectProcess={handleInspectProcess}
            onRemoveProcess={handleRemoveProcess}
            onAddProducer={handleAddProducer}
            onAddConsumer={handleAddConsumer}
            onClearSession={handleClearSession}
            isManagerOpen={isProcessManagerOpen}
            onOpenManager={() => {
              setInspectorOpen(false);
              setIsProcessManagerOpen(true);
            }}
            onCloseManager={() => setIsProcessManagerOpen(false)}
          />
        </div>

        {/* Level 3: Execution Controls (Stable Compact Dock) */}
        <ControlDock
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onStep={handleStep}
          onReset={handleReset}
          stepCount={stepCount}
          systemStatus={systemStatus}
          sessionSummary={sessionSummary}
          lastEventDetails={lastEventDetails}
          nextActionText={nextActionText}
          selectedProcessId={selectedProcessId}
          processes={state.processes ?? []}
          onSelectProcess={(id) => setSelectedProcessId(id)}
          schedulingMode={schedulingMode}
          onChangeSchedulingMode={setSchedulingMode}
          speed={speed}
          onChangeSpeed={setSpeed}
          currentScenario={currentScenario}
          onSelectScenario={handleSelectScenario}
          onToggleActivityDrawer={handleToggleActivity}
          isActivityDrawerOpen={inspectorOpen && inspectorMode === 'activity'}
          recentEvents={recentEvents}
          workloadMode={workloadMode}
          onChangeWorkloadMode={setWorkloadMode}
          prepDuration={prepDuration}
          onChangePrepDuration={setPrepDuration}
          producerDelay={producerDelay}
          onChangeProducerDelay={setProducerDelay}
          randomSeed={randomSeed}
          onChangeRandomSeed={setRandomSeed}
        />

        {/* Synchronized Explanation Layer: Live Queue Flow */}
        <LiveQueueFlow
          state={state}
          isPlaying={isPlaying}
          selectedSlotIndex={selectedSlotIndex}
          onSelectSlot={handleSelectSlot}
          selectedProcessId={selectedProcessId}
          onSelectProcess={(id) => setSelectedProcessId(id)}
          onInspectProcess={handleInspectProcess}
          onOpenProcessManager={() => {
            setInspectorOpen(false);
            setIsProcessManagerOpen(true);
          }}
        />
      </div>

      {/* Dedicated 3D Spatial Simulation View */}
      <div
        className="arena-3d-view-wrapper"
        style={{ display: view === '3d' ? 'block' : 'none' }}
      >
        <SyncLab3DPage
          state={state}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onStep={handleStep}
          speed={speed}
          onChangeSpeed={setSpeed}
          onReset={handleReset}
          onClearSession={handleClearSession}
          producerCount={producerCount}
          stoppingProducersCount={stoppingProducersCount}
          consumerCount={consumerCount}
          stoppingConsumersCount={stoppingConsumersCount}
          onAddProducer={() => handleAddProducer(1)}
          onRemoveProducer={() => handleRemoveProcess('PRODUCER')}
          onAddConsumer={() => handleAddConsumer(1)}
          onRemoveConsumer={() => handleRemoveProcess('CONSUMER')}
          selectedSlotIndex={selectedSlotIndex}
          onSelectSlot={handleSelectSlot}
          selectedProcessId={selectedProcessId}
          onSelectProcess={(id) => setSelectedProcessId(id)}
          onInspectProcess={handleInspectProcess}
          onOpenProcessManager={() => {
            setInspectorOpen(false);
            setIsProcessManagerOpen(true);
          }}
          systemStatus={systemStatus}
          stepCount={stepCount}
          currentScenario={currentScenario}
          onSelectScenario={handleSelectScenario}
          workloadMode={workloadMode}
          onChangeWorkloadMode={setWorkloadMode}
          prepDuration={prepDuration}
          onChangePrepDuration={setPrepDuration}
          schedulingMode={schedulingMode}
          onChangeSchedulingMode={setSchedulingMode}
        />
      </div>

      {/* Dedicated Race Condition View */}
      {view === 'race' && (
        <div className="arena-subview-wrapper">
          <RaceConditionArena onBackToNormal={() => setView('arena')} />
        </div>
      )}

      {/* Flowcharts View */}
      {view === 'flowcharts' && (
        <div className="arena-subview-wrapper">
          <SynchronizationFlowchartsView onNavigateSection={(sec) => setView(sec === 'simulator' ? 'arena' : sec)} />
        </div>
      )}

      {/* Case Study Overview View */}
      {view === 'overview' && (
        <div className="arena-subview-wrapper">
          <div className="arena-overview-placeholder">
            <h2 className="overview-title">Case Study 3 — College Canteen Digital Ordering System</h2>
            <p className="overview-desc">
              Demonstrating the classical Producer–Consumer Synchronization Problem using student order submissions (producers)
              and bounded kitchen prep stations (consumers) coordinated through mutex locks and counting semaphores.
            </p>
            <button
              type="button"
              className="arena-return-btn"
              onClick={() => setView('arena')}
            >
              Return to Arena Simulator
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Context Inspector */}
      <ContextInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        mode={inspectorMode}
        target={inspectorTarget}
        state={state}
      />
    </div>
  );
}
