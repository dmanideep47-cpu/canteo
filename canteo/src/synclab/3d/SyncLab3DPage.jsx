import React, { useState, useMemo, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Box,
  Compass,
  RotateCcw,
  Layers,
  Eye,
  Utensils,
  Lock,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { computeSceneState } from './SimulationSceneAdapter.js';
import { useProcessDepartures } from './useProcessDepartures.js';
import { SimulationRoom } from './SimulationRoom.jsx';
import { BufferTrays } from './BufferTrays.jsx';
import { ConsumerWorkstations } from './ConsumerWorkstations.jsx';
import { ProcessTokens } from './ProcessTokens.jsx';
import { WaitingAreas } from './WaitingAreas.jsx';
import { CameraControls } from './CameraControls.jsx';
import { SchematicRoomFallback } from './SchematicRoomFallback.jsx';
import { ProcessStepperBar } from '../arena/ProcessStepperBar.jsx';
import { ControlDock } from '../arena/ControlDock.jsx';
import '../styles/synclab3d.css';

// WebGL Error Boundary to catch device/driver limitations gracefully
class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('WebGL Rendering Error caught by boundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function SyncLab3DPage({
  state = null,
  isPlaying = false,
  onTogglePlay = () => {},
  onStep = () => {},
  speed = 900,
  onChangeSpeed = () => {},
  onReset = () => {},
  onClearSession = () => {},
  producerCount = 0,
  stoppingProducersCount = 0,
  consumerCount = 0,
  stoppingConsumersCount = 0,
  onAddProducer = () => {},
  onRemoveProducer = () => {},
  onAddConsumer = () => {},
  onRemoveConsumer = () => {},
  selectedSlotIndex = null,
  onSelectSlot = () => {},
  selectedProcessId = null,
  onSelectProcess = () => {},
  onInspectProcess = () => {},
  onOpenProcessManager = () => {},
  systemStatus = '',
  stepCount = 0,
  currentScenario = 'normal',
  onSelectScenario = () => {},
}) {
  // Camera view mode: 'overview' | 'counter' | 'kitchen' | 'topDown'
  const [viewMode, setViewMode] = useState('overview');
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  const [force2D, setForce2D] = useState(false);

  // Animated visual departures controller
  const { departuresMap, departedIds, resetDepartures, departureTick } = useProcessDepartures(
    state,
    isPlaying,
    { speed }
  );

  // Authoritative 3D Scene mapping
  const scene = useMemo(
    () =>
      computeSceneState(state, {
        selectedProcessId,
        selectedSlotIndex,
        departingMap: departuresMap,
        departedIds,
      }),
    [state, selectedProcessId, selectedSlotIndex, departuresMap, departedIds, departureTick]
  );

  const handleResetWrapped = () => {
    resetDepartures();
    onReset();
  };

  const processes = state?.processes ?? [];
  const consumerWorkstationCount = scene.workstations.length;

  return (
    <div
      className="synclab-3d-page"
      role="region"
      aria-label="3D Canteen Kitchen & Service Hatch Simulation"
      data-simulation-revision={state?.revision ?? 0}
    >
      {/* 1. Subheader: Viewport Toolbar & Camera Switcher */}
      <div className="synclab-3d-toolbar">
        <div className="synclab-3d-title-group">
          <h2 className="synclab-3d-heading">
            <Box size={16} aria-hidden="true" />
            <span>3D Spatial Synchronization Room</span>
          </h2>
          <p className="synclab-3d-subtitle">
            Shared 5-slot counter at service hatch · Students outside · Kitchen workers at {consumerWorkstationCount} interior workstation{consumerWorkstationCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="synclab-3d-camera-actions">
          <button
            type="button"
            className={`synclab-3d-btn ${viewMode === 'overview' && !force2D ? 'active' : ''}`}
            onClick={() => {
              setForce2D(false);
              setViewMode('overview');
            }}
            title="Elevated three-quarter perspective of patio, counter, and kitchen"
          >
            <Box size={13} aria-hidden="true" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            className={`synclab-3d-btn ${viewMode === 'counter' && !force2D ? 'active' : ''}`}
            onClick={() => {
              setForce2D(false);
              setViewMode('counter');
            }}
            title="Close-up focus on the 5-slot shared service counter"
          >
            <Eye size={13} aria-hidden="true" />
            <span>Counter</span>
          </button>

          <button
            type="button"
            className={`synclab-3d-btn ${viewMode === 'kitchen' && !force2D ? 'active' : ''}`}
            onClick={() => {
              setForce2D(false);
              setViewMode('kitchen');
            }}
            title="Focus inside the kitchen on consumer workstations"
          >
            <Utensils size={13} aria-hidden="true" />
            <span>Kitchen</span>
          </button>

          <button
            type="button"
            className={`synclab-3d-btn ${viewMode === 'topDown' && !force2D ? 'active' : ''}`}
            onClick={() => {
              setForce2D(false);
              setViewMode('topDown');
            }}
            title="Overhead architectural floor-plan view"
          >
            <Compass size={13} aria-hidden="true" />
            <span>Top-Down</span>
          </button>

          <button
            type="button"
            className="synclab-3d-btn"
            onClick={() => setResetCameraTrigger((c) => c + 1)}
            title="Reset camera zoom and orientation"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Reset Camera</span>
          </button>

          <button
            type="button"
            className={`synclab-3d-btn ${force2D ? 'active' : ''}`}
            onClick={() => setForce2D((v) => !v)}
            title="Toggle between WebGL 3D canvas and accessible 2D schematic"
          >
            <Layers size={13} aria-hidden="true" />
            <span>{force2D ? 'Return to 3D' : '2D Schematic'}</span>
          </button>
        </div>
      </div>

      {/* 2. Process Stepper Count Controls (Producers [-] N [+]  Consumers [-] N [+]) */}
      <ProcessStepperBar
        producerCount={producerCount}
        stoppingProducersCount={stoppingProducersCount}
        consumerCount={consumerCount}
        stoppingConsumersCount={stoppingConsumersCount}
        onAddProducer={onAddProducer}
        onRemoveProducer={onRemoveProducer}
        onAddConsumer={onAddConsumer}
        onRemoveConsumer={onRemoveConsumer}
        onOpenProcessManager={onOpenProcessManager}
      />

      {/* Fast Process Inspector Pill Row for Dense Scenes */}
      {processes.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            padding: '6px 12px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Quick Select:
          </span>
          {processes.map((p) => {
            const isSel = selectedProcessId === p.id;
            const isProd = p.type === 'PRODUCER';
            return (
              <button
                key={`quick-${p.id}`}
                type="button"
                onClick={() => {
                  onSelectProcess(p.id);
                  if (onInspectProcess) onInspectProcess(p);
                }}
                style={{
                  background: isSel ? '#1E40AF' : isProd ? '#ECFDF5' : '#FEF3C7',
                  color: isSel ? '#FFFFFF' : isProd ? '#065F46' : '#92400E',
                  border: `1px solid ${isSel ? '#1D4ED8' : isProd ? '#A7F3D0' : '#FDE68A'}`,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.id} ({isProd ? 'Student' : 'Kitchen'})
              </button>
            );
          })}
        </div>
      )}

      {/* 3. The 3D Canvas Viewport (or 2D Schematic Fallback) */}
      <div className="synclab-3d-canvas-container">
        {force2D ? (
          <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
            <SchematicRoomFallback
              scene={scene}
              onSelectSlot={onSelectSlot}
              onSelectProcess={(id) => {
                onSelectProcess(id);
                const proc = state?.processes?.find((p) => p.id === id);
                if (proc && onInspectProcess) onInspectProcess(proc);
              }}
            />
          </div>
        ) : (
          <WebGLErrorBoundary
            fallback={
              <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
                <SchematicRoomFallback
                  scene={scene}
                  onSelectSlot={onSelectSlot}
                  onSelectProcess={(id) => {
                    onSelectProcess(id);
                    const proc = state?.processes?.find((p) => p.id === id);
                    if (proc && onInspectProcess) onInspectProcess(proc);
                  }}
                />
              </div>
            }
          >
            <Canvas
              shadows
              camera={{
                position: [0.0, 9.8, 12.5],
                fov: 34,
                near: 0.1,
                far: 100,
              }}
              style={{ width: '100%', height: '100%', background: '#F8FAFC' }}
            >
              {/* Lighting */}
              <ambientLight intensity={0.8} />
              <directionalLight
                position={[8, 16, 12]}
                intensity={1.25}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-far={35}
                shadow-camera-left={-14}
                shadow-camera-right={14}
                shadow-camera-top={14}
                shadow-camera-bottom={-14}
              />
              <directionalLight position={[-8, 12, -10]} intensity={0.4} />

              {/* Camera Controls & Presets */}
              <CameraControls viewMode={viewMode} resetTrigger={resetCameraTrigger} />

              {/* Architectural Open-Roof Kitchen Room & Outside Patio */}
              <SimulationRoom
                room={scene.room}
                counterAccess={scene.counterAccess}
              />

              {/* Fixed 5 Bounded Buffer Trays at Service Hatch (Z = 0) */}
              <BufferTrays slots={scene.slots} onSelectSlot={onSelectSlot} />

              {/* Dynamic Consumer Workstations Inside Kitchen (Z < 0) */}
              <ConsumerWorkstations
                workstations={scene.workstations}
                selectedProcessId={selectedProcessId}
                onSelectProcess={(id) => {
                  onSelectProcess(id);
                  const proc = state?.processes?.find((p) => p.id === id);
                  if (proc && onInspectProcess) onInspectProcess(proc);
                }}
              />

              {/* Waiting Areas (Outside Capacity Bay & Lineup; Inside Collection Aisle) */}
              <WaitingAreas
                waitingSummary={scene.waitingSummary}
                room={scene.room}
              />

              {/* Process Tokens (Students outside, kitchen workers inside) */}
              <ProcessTokens
                tokens={scene.tokens}
                onSelectProcess={(id) => {
                  onSelectProcess(id);
                  const proc = state?.processes?.find((p) => p.id === id);
                  if (proc && onInspectProcess) onInspectProcess(proc);
                }}
              />
            </Canvas>

            <div className="synclab-3d-canvas-hint">
              <span>Drag to rotate · Scroll to zoom · Click trays or tokens to inspect</span>
            </div>
          </WebGLErrorBoundary>
        )}
      </div>

      {/* 4. Execution Controls (Authoritative Control Dock) */}
      <ControlDock
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onStep={onStep}
        onReset={handleResetWrapped}
        stepCount={stepCount}
        systemStatus={systemStatus}
        speed={speed}
        onChangeSpeed={onChangeSpeed}
        onOpenProcessManager={onOpenProcessManager}
        workloadMode={workloadMode}
        onChangeWorkloadMode={onChangeWorkloadMode}
        prepDuration={prepDuration}
        onChangePrepDuration={onChangePrepDuration}
        schedulingMode={schedulingMode}
        onChangeSchedulingMode={onChangeSchedulingMode}
      />

      {/* 5. Visual Semantics Legend */}
      <div className="synclab-3d-legend-grid">
        <div className="synclab-3d-legend-card">
          <span className="synclab-3d-legend-title">
            <Lock size={13} color="#059669" />
            <span>Service Counter Access (Mutex)</span>
          </span>
          <p className="synclab-3d-legend-desc">
            The <code>mutex</code> lock serializes access to the service counter. Exactly one process accesses the counter at a time (student writing or worker reading).
          </p>
        </div>

        <div className="synclab-3d-legend-card">
          <span className="synclab-3d-legend-title">
            <Layers size={13} color="#2563EB" />
            <span>Five Shared Positions [0]–[4]</span>
          </span>
          <p className="synclab-3d-legend-desc">
            The bounded buffer has a <strong>fixed capacity of 5</strong>. Modulo pointers (<code>WRITE</code> and <code>READ</code>) track insertion and removal.
          </p>
        </div>

        <div className="synclab-3d-legend-card">
          <span className="synclab-3d-legend-title">
            <Utensils size={13} color="#D97706" />
            <span>Inside: {consumerWorkstationCount} Consumer Workstation{consumerWorkstationCount === 1 ? '' : 's'}</span>
          </span>
          <p className="synclab-3d-legend-desc">
            Kitchen workers remain inside the kitchen at their own workstations, cooking dishes <strong>concurrently outside the mutex lock</strong>.
          </p>
        </div>

        <div className="synclab-3d-legend-card">
          <span className="synclab-3d-legend-title">
            <Clock size={13} color="#059669" />
            <span>Outside: Students & Queue</span>
          </span>
          <p className="synclab-3d-legend-desc">
            Student producers stay outside. They queue at the service hatch, submit orders into the 5-slot counter, and leave along the outside exit path.
          </p>
        </div>
      </div>

      {/* 6. Accessible Tabular Data Summary */}
      <section aria-labelledby="synclab-3d-summary-heading" style={{ marginTop: '16px' }}>
        <h3 id="synclab-3d-summary-heading" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', margin: '0 0 6px' }}>
          Current Simulation State Table
        </h3>
        <table className="synclab-3d-accessible-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status / Value</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Counter Mutex Access</strong></td>
              <td>{scene.counterAccess.isLocked ? `LOCKED by ${scene.counterAccess.ownerId}` : 'AVAILABLE (1)'}</td>
              <td>Serializes access to the 5-slot service counter at the hatch.</td>
            </tr>
            <tr>
              <td><strong>Shared Order Counter</strong></td>
              <td>{scene.counts.occupiedSlots} / 5 Occupied (Capacity Fixed at 5)</td>
              <td>Read pointer: [{state?.readPosition ?? 0}], Write pointer: [{state?.writePosition ?? 0}]</td>
            </tr>
            <tr>
              <td><strong>Kitchen Workstations</strong></td>
              <td>{consumerWorkstationCount} Workstations ({scene.counts.preparing} Cooking)</td>
              <td>Each consumer has its own identifiable workstation inside the kitchen.</td>
            </tr>
            <tr>
              <td><strong>Waiting Queues</strong></td>
              <td>
                {scene.waitingSummary.capacityWaiters.length} capacity · {scene.waitingSummary.orderWaiters.length} orders · {scene.waitingSummary.mutexWaiters.length} mutex
              </td>
              <td>Producers wait outside on capacity; consumers wait inside at their workstations.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
