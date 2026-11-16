import { useState, useId } from 'react';
import {
  GitCommit,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Lock,
  Unlock,
  ShieldAlert,
  Utensils,
  ChefHat,
  Users,
  Layers,
  Info,
  Clock
} from 'lucide-react';
import {
  PRODUCER_FLOW_NODES,
  CONSUMER_FLOW_NODES,
  COMBINED_SYSTEM_NODES
} from './flowchartData.js';

export function SynchronizationFlowchartsView({ onNavigateSection }) {
  const [activeTab, setActiveTab] = useState('producer'); // 'producer' | 'consumer' | 'combined'
  const [selectedNodeId, setSelectedNodeId] = useState('p_wait_empty');
  const uid = useId().replace(/:/g, '');

  const nodes = activeTab === 'producer'
    ? PRODUCER_FLOW_NODES
    : activeTab === 'consumer'
      ? CONSUMER_FLOW_NODES
      : COMBINED_SYSTEM_NODES;

  const currentIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const activeIndex = currentIndex !== -1 ? currentIndex : 0;
  const activeNode = nodes[activeIndex] || nodes[0];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'producer') setSelectedNodeId('p_wait_empty');
    else if (tab === 'consumer') setSelectedNodeId('c_wait_full');
    else setSelectedNodeId('comb_buffer');
  };

  const handlePrevNode = () => {
    const prevIdx = activeIndex > 0 ? activeIndex - 1 : nodes.length - 1;
    setSelectedNodeId(nodes[prevIdx].id);
  };

  const handleNextNode = () => {
    const nextIdx = activeIndex < nodes.length - 1 ? activeIndex + 1 : 0;
    setSelectedNodeId(nodes[nextIdx].id);
  };

  return (
    <div className="sl-section-content sl-flowcharts-view">
      {/* SECTION HEADING */}
      <div className="sl-section-heading">
        <span className="sl-eyebrow">05 / SOLUTION & ANALYSIS</span>
        <h2>Synchronization Solution & Architecture Flowcharts</h2>
        <p>
          Complete educational explanation and interactive 2D flowcharts mapping the student producer protocol, the kitchen consumer
          protocol, and the combined 5-slot bounded buffer system. Select any node to inspect operating system semantics,
          POSIX instructions, affected resources, and canteen analogies.
        </p>
      </div>

      {/* TOP CONTROLS & DIAGRAM SELECTOR */}
      <div className="sl-panel sl-flowcharts-controls">
        <div className="sl-flowcharts-tabs">
          <button
            type="button"
            className={`sl-btn ${activeTab === 'producer' ? 'primary active' : ''}`}
            onClick={() => handleTabChange('producer')}
          >
            <Users size={15} /> 1. Student Producer
          </button>
          <button
            type="button"
            className={`sl-btn ${activeTab === 'consumer' ? 'primary active' : ''}`}
            onClick={() => handleTabChange('consumer')}
          >
            <ChefHat size={15} /> 2. Kitchen Consumer
          </button>
          <button
            type="button"
            className={`sl-btn ${activeTab === 'combined' ? 'primary active' : ''}`}
            onClick={() => handleTabChange('combined')}
          >
            <GitCommit size={15} /> 3. Combined System Architecture
          </button>
          {onNavigateSection && (
            <button
              type="button"
              className="sl-btn quiet sl-flowcharts-link-btn"
              onClick={() => onNavigateSection('semaphores')}
            >
              ← Synchronization Lab
            </button>
          )}
        </div>

        {/* DIAGRAM WALKTHROUGH CONTROLS */}
        <div className="sl-walkthrough-bar">
          <div className="sl-walkthrough-left">
            <span className="sl-walkthrough-tag">
              <span className="sl-step-pill">Step {activeNode?.stepNumber || activeIndex + 1}</span>{' '}
              <strong>{activeNode?.label}</strong>
            </span>
            <small>Educational Inspector · Step through nodes without altering simulator state</small>
          </div>
          <div className="sl-walkthrough-btns">
            <button
              type="button"
              className="sl-btn quiet"
              onClick={handlePrevNode}
              aria-label="Previous flowchart node"
            >
              <ArrowLeft size={14} /> Previous
            </button>
            <button
              type="button"
              className="sl-btn"
              onClick={handleNextNode}
              aria-label="Next flowchart node"
            >
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* FLOWCHART CANVAS & INTERACTIVE SVG */}
      <div className="sl-flowchart-stage-grid">
        <div className="sl-panel sl-diagram-card">
          <div className="sl-diagram-header">
            <div className="sl-diagram-title-group">
              <h3>
                {activeTab === 'producer' && 'Student Producer — Bounded Buffer Order Submission Protocol'}
                {activeTab === 'consumer' && 'Kitchen Consumer — Order Retrieval & Two-Stage Kitchen Protocol'}
                {activeTab === 'combined' && 'Combined System Coordination — 3-Lane Architecture & Semaphores'}
              </h3>
            </div>
            <span className="sl-badge-instruction">Click any node to inspect</span>
          </div>

          <div className="sl-svg-scroll">
            {/* ========================================== */}
            {/* 1. STUDENT PRODUCER FLOWCHART */}
            {/* ========================================== */}
            {activeTab === 'producer' && (
              <svg
                className="sl-flow-svg"
                viewBox="0 0 660 740"
                role="img"
                aria-label="Student producer synchronization flowchart"
              >
                <defs>
                  <marker id={`arrow-prod-${uid}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#a68c61" />
                  </marker>
                </defs>

                {/* CRITICAL SECTION GROUPING */}
                <rect
                  x="160"
                  y="330"
                  width="340"
                  height="165"
                  rx="8"
                  fill="#faf6ee"
                  stroke="#c39a5a"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x="330" y="350" textAnchor="middle" className="sl-cs-group-label">
                  CRITICAL SECTION (Mutual Exclusion Held)
                </text>

                {/* FLOW CONNECTOR LINES */}
                <g className="sl-flow-lines" markerEnd={`url(#arrow-prod-${uid})`}>
                  {/* Start -> Create */}
                  <path d="M330 45 V78" />
                  {/* Create -> wait(empty) */}
                  <path d="M330 120 V152" />
                  {/* wait(empty) YES -> wait(mutex) */}
                  <path d="M330 204 V238" />
                  {/* wait(empty) NO -> Blocked */}
                  <path d="M425 178 H475" />
                  {/* Blocked -> wait(empty) resume loopback */}
                  <path d="M555 157 V132 H330 V152" />
                  {/* wait(mutex) YES -> Critical Section Insert */}
                  <path d="M330 290 V368" />
                  {/* wait(mutex) NO -> Blocked */}
                  <path d="M425 264 H475" />
                  {/* Blocked -> wait(mutex) resume loopback */}
                  <path d="M555 243 V218 H330 V238" />
                  {/* Insert -> Advance write */}
                  <path d="M330 412 V436" />
                  {/* Advance write -> signal(mutex) */}
                  <path d="M330 480 V515" />
                  {/* signal(mutex) -> signal(full) */}
                  <path d="M330 562 V595" />
                  {/* signal(full) -> Loop */}
                  <path d="M330 642 V674" />
                  {/* Loop back to top */}
                  <path d="M230 695 H90 V25 H230" />
                </g>

                {/* DECISION LABELS */}
                <text className="sl-flow-label" x="342" y="222">YES (permit &gt; 0)</text>
                <text className="sl-flow-label" x="435" y="168">NO · WAIT (Queue Full)</text>
                <text className="sl-flow-label" x="342" y="310">YES (lock free)</text>
                <text className="sl-flow-label" x="435" y="254">NO · WAIT (Locked)</text>

                {/* NODES */}
                <FlowNodeSvg
                  x={330} y={25} width={190} height={42} shape="terminal"
                  label="Student Producer Starts" sub="Process initializes"
                  isSelected={selectedNodeId === 'p_start'}
                  onClick={() => setSelectedNodeId('p_start')}
                />
                <FlowNodeSvg
                  x={330} y={99} width={230} height={44} shape="box"
                  label="Create Student Order" sub="order = create_order() · Private memory"
                  isSelected={selectedNodeId === 'p_create'}
                  onClick={() => setSelectedNodeId('p_create')}
                />
                <FlowNodeSvg
                  x={330} y={178} width={200} height={52} shape="decision"
                  label="empty permit > 0?" sub="wait(empty)"
                  isSelected={selectedNodeId === 'p_wait_empty'}
                  onClick={() => setSelectedNodeId('p_wait_empty')}
                />
                <FlowNodeSvg
                  x={555} y={178} width={150} height={42} shape="box"
                  label="BLOCKED on empty" sub="Sleep until slot freed"
                  isSelected={selectedNodeId === 'p_blocked_empty'}
                  onClick={() => setSelectedNodeId('p_blocked_empty')}
                />
                <FlowNodeSvg
                  x={330} y={264} width={200} height={52} shape="decision"
                  label="mutex available?" sub="wait(mutex)"
                  isSelected={selectedNodeId === 'p_wait_mutex'}
                  onClick={() => setSelectedNodeId('p_wait_mutex')}
                />
                <FlowNodeSvg
                  x={555} y={264} width={150} height={42} shape="box"
                  label="WAITING on mutex" sub="Lock held by other"
                  isSelected={selectedNodeId === 'p_blocked_mutex'}
                  onClick={() => setSelectedNodeId('p_blocked_mutex')}
                />
                <FlowNodeSvg
                  x={330} y={390} width={250} height={44} shape="box"
                  label="Insert Order at write" sub="buffer[writePosition] = order"
                  isSelected={selectedNodeId === 'p_insert'}
                  onClick={() => setSelectedNodeId('p_insert')}
                />
                <FlowNodeSvg
                  x={330} y={458} width={250} height={44} shape="box"
                  label="Advance Write Pointer" sub="write = (write + 1) mod 5"
                  isSelected={selectedNodeId === 'p_advance_write'}
                  onClick={() => setSelectedNodeId('p_advance_write')}
                />
                <FlowNodeSvg
                  x={330} y={538} width={270} height={46} shape="box"
                  label="signal(mutex) · Leave CS" sub="Release exclusive queue lock"
                  isSelected={selectedNodeId === 'p_signal_mutex'}
                  onClick={() => setSelectedNodeId('p_signal_mutex')}
                />
                <FlowNodeSvg
                  x={330} y={618} width={250} height={46} shape="box"
                  label="signal(full)" sub="Publish ready order permit"
                  isSelected={selectedNodeId === 'p_signal_full'}
                  onClick={() => setSelectedNodeId('p_signal_full')}
                />
                <FlowNodeSvg
                  x={330} y={695} width={200} height={40} shape="terminal"
                  label="Repeat while running" sub="Next student order"
                  isSelected={selectedNodeId === 'p_loop'}
                  onClick={() => setSelectedNodeId('p_loop')}
                />
              </svg>
            )}

            {/* ========================================== */}
            {/* 2. KITCHEN CONSUMER FLOWCHART */}
            {/* ========================================== */}
            {activeTab === 'consumer' && (
              <svg
                className="sl-flow-svg"
                viewBox="0 0 660 830"
                role="img"
                aria-label="Kitchen consumer synchronization flowchart"
              >
                <defs>
                  <marker id={`arrow-cons-${uid}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#a68c61" />
                  </marker>
                </defs>

                {/* STAGE A CONTAINER (SHARED QUEUE ACCESS) */}
                <rect
                  x="80"
                  y="70"
                  width="470"
                  height="490"
                  rx="10"
                  fill="#faf7f0"
                  stroke="#ded4c3"
                  strokeWidth="1.2"
                />
                <text x="95" y="90" className="sl-stage-heading">
                  STAGE A · SHARED QUEUE ACCESS (CRITICAL SECTION MUTEX)
                </text>

                {/* CRITICAL SECTION GROUPING */}
                <rect
                  x="160"
                  y="248"
                  width="340"
                  height="165"
                  rx="8"
                  fill="#fffdf8"
                  stroke="#c39a5a"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x="330" y="268" textAnchor="middle" className="sl-cs-group-label">
                  CRITICAL SECTION (Mutual Exclusion Held)
                </text>

                {/* TRANSITION ANNOTATION */}
                <g transform="translate(170, 580)">
                  <rect x="0" y="0" width="320" height="28" rx="6" fill="#edf7f2" stroke="#bce4d0" />
                  <text x="160" y="18" textAnchor="middle" fill="#2e7d5b" fontSize="10" fontWeight="700">
                    ✓ Queue lock released — cooking proceeds independently
                  </text>
                </g>

                {/* STAGE B CONTAINER (INDEPENDENT FOOD PREPARATION) */}
                <rect
                  x="80"
                  y="622"
                  width="470"
                  height="145"
                  rx="10"
                  fill="#f4f9f6"
                  stroke="#c6decb"
                  strokeWidth="1.2"
                />
                <text x="95" y="642" className="sl-stage-heading" fill="#2e7d5b">
                  STAGE B · INDEPENDENT FOOD PREPARATION (ZERO LOCKS HELD)
                </text>

                {/* FLOW CONNECTOR LINES */}
                <g className="sl-flow-lines" markerEnd={`url(#arrow-cons-${uid})`}>
                  {/* Start -> wait(full) */}
                  <path d="M330 45 V98" />
                  {/* wait(full) YES -> wait(mutex) */}
                  <path d="M330 152 V186" />
                  {/* wait(full) NO -> Blocked */}
                  <path d="M425 125 H475" />
                  {/* Blocked -> wait(full) resume loopback */}
                  <path d="M555 104 V78 H330 V98" />
                  {/* wait(mutex) YES -> Critical Section Remove */}
                  <path d="M330 238 V286" />
                  {/* wait(mutex) NO -> Blocked */}
                  <path d="M425 212 H475" />
                  {/* Blocked -> wait(mutex) resume loopback */}
                  <path d="M555 191 V166 H330 V186" />
                  {/* Remove -> Advance read */}
                  <path d="M330 330 V354" />
                  {/* Advance read -> signal(mutex) */}
                  <path d="M330 398 V432" />
                  {/* signal(mutex) -> signal(empty) */}
                  <path d="M330 478 V510" />
                  {/* signal(empty) -> Stage Transition -> Cook Food */}
                  <path d="M330 556 V580 M330 608 V660" />
                  {/* Cook Food -> Mark ready */}
                  <path d="M330 706 V730" />
                  {/* Mark ready -> Loop */}
                  <path d="M330 768 V786" />
                  {/* Loop back to top */}
                  <path d="M230 805 H70 V25 H230" />
                </g>

                {/* DECISION LABELS */}
                <text className="sl-flow-label" x="342" y="170">YES (order ready)</text>
                <text className="sl-flow-label" x="435" y="115">NO · WAIT (Queue Empty)</text>
                <text className="sl-flow-label" x="342" y="258">YES (lock free)</text>
                <text className="sl-flow-label" x="435" y="202">NO · WAIT (Locked)</text>

                {/* NODES */}
                <FlowNodeSvg
                  x={330} y={25} width={190} height={42} shape="terminal"
                  label="Kitchen Consumer Starts" sub="Worker thread ready"
                  isSelected={selectedNodeId === 'c_start'}
                  onClick={() => setSelectedNodeId('c_start')}
                />
                <FlowNodeSvg
                  x={330} y={125} width={200} height={52} shape="decision"
                  label="full permit > 0?" sub="wait(full)"
                  isSelected={selectedNodeId === 'c_wait_full'}
                  onClick={() => setSelectedNodeId('c_wait_full')}
                />
                <FlowNodeSvg
                  x={555} y={125} width={150} height={42} shape="box"
                  label="BLOCKED on full" sub="Sleep until order placed"
                  isSelected={selectedNodeId === 'c_blocked_full'}
                  onClick={() => setSelectedNodeId('c_blocked_full')}
                />
                <FlowNodeSvg
                  x={330} y={212} width={200} height={52} shape="decision"
                  label="mutex available?" sub="wait(mutex)"
                  isSelected={selectedNodeId === 'c_wait_mutex'}
                  onClick={() => setSelectedNodeId('c_wait_mutex')}
                />
                <FlowNodeSvg
                  x={555} y={212} width={150} height={42} shape="box"
                  label="WAITING on mutex" sub="Lock held by other"
                  isSelected={selectedNodeId === 'c_blocked_mutex'}
                  onClick={() => setSelectedNodeId('c_blocked_mutex')}
                />
                <FlowNodeSvg
                  x={330} y={308} width={250} height={44} shape="box"
                  label="Remove Order at read" sub="order = buffer[readPosition]"
                  isSelected={selectedNodeId === 'c_remove'}
                  onClick={() => setSelectedNodeId('c_remove')}
                />
                <FlowNodeSvg
                  x={330} y={376} width={250} height={44} shape="box"
                  label="Advance Read Pointer" sub="read = (read + 1) mod 5"
                  isSelected={selectedNodeId === 'c_advance_read'}
                  onClick={() => setSelectedNodeId('c_advance_read')}
                />
                <FlowNodeSvg
                  x={330} y={455} width={270} height={46} shape="box"
                  label="signal(mutex) · Leave CS" sub="Release lock / unlock queue immediately"
                  isSelected={selectedNodeId === 'c_signal_mutex'}
                  onClick={() => setSelectedNodeId('c_signal_mutex')}
                />
                <FlowNodeSvg
                  x={330} y={533} width={250} height={46} shape="box"
                  label="signal(empty) · Free Slot" sub="Increment empty / wake waiting student"
                  isSelected={selectedNodeId === 'c_signal_empty'}
                  onClick={() => setSelectedNodeId('c_signal_empty')}
                />
                <FlowNodeSvg
                  x={330} y={683} width={260} height={46} shape="prep"
                  label="Cook Food Outside Lock!" sub="cook_dish(order) · Private workstation"
                  isSelected={selectedNodeId === 'c_cook'}
                  onClick={() => setSelectedNodeId('c_cook')}
                />
                <FlowNodeSvg
                  x={330} y={749} width={240} height={42} shape="prep"
                  label="Mark Order Ready" sub="Move to pickup counter"
                  isSelected={selectedNodeId === 'c_ready'}
                  onClick={() => setSelectedNodeId('c_ready')}
                />
                <FlowNodeSvg
                  x={330} y={805} width={190} height={38} shape="terminal"
                  label="Repeat while running" sub="Next kitchen order"
                  isSelected={selectedNodeId === 'c_loop'}
                  onClick={() => setSelectedNodeId('c_loop')}
                />
              </svg>
            )}

            {/* ========================================== */}
            {/* 3. COMBINED SYSTEM ARCHITECTURE */}
            {/* ========================================== */}
            {activeTab === 'combined' && (
              <svg
                className="sl-combined-svg"
                viewBox="0 0 1050 520"
                role="img"
                aria-label="Combined producer consumer synchronization flowchart around five-slot circular buffer"
              >
                <defs>
                  <marker id={`comb-arrow-${uid}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#183d38" />
                  </marker>
                  <marker id={`comb-sig-${uid}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="#c39a5a" />
                  </marker>
                </defs>

                {/* 3 BALANCED ARCHITECTURAL LANES */}
                {/* Lane 1: Producers */}
                <rect x="20" y="20" width="310" height="480" rx="10" fill="#fcfaf6" stroke="#ded6c5" strokeWidth="1.2" />
                <text x="35" y="45" className="sl-lane-title">LANE 1 · STUDENT PRODUCERS</text>
                <text x="35" y="60" className="sl-lane-desc">Order creation &amp; slot reservation</text>

                {/* Lane 2: Bounded Buffer & Semaphores */}
                <rect x="360" y="20" width="330" height="480" rx="10" fill="#f7f3ec" stroke="#cfc3af" strokeWidth="1.2" />
                <text x="375" y="45" className="sl-lane-title" fill="#183d38">LANE 2 · SHARED BOUNDED BUFFER</text>
                <text x="375" y="60" className="sl-lane-desc">Capacity N=5 · Modulo circular queue</text>

                {/* Lane 3: Consumers */}
                <rect x="720" y="20" width="310" height="480" rx="10" fill="#fcfaf6" stroke="#ded6c5" strokeWidth="1.2" />
                <text x="735" y="45" className="sl-lane-title">LANE 3 · KITCHEN CONSUMERS</text>
                <text x="735" y="60" className="sl-lane-desc">Order retrieval &amp; independent cooking</text>

                {/* LANE 2: STATIC INITIAL SEMAPHORES PANEL */}
                <g className="sl-static-sem-panel" transform="translate(375, 75)">
                  <rect x="0" y="0" width="300" height="100" rx="8" fill="#183d38" stroke="#25544b" />
                  <text x="15" y="22" fill="#dcb36f" fontSize="10" fontWeight="700" letterSpacing="0.8px">
                    INITIAL EMPTY-BUFFER STATE (CAPACITY N = 5)
                  </text>

                  <g transform="translate(10, 32)">
                    {/* empty */}
                    <rect x="0" y="0" width="86" height="58" rx="5" fill="#102b27" stroke="#356157" />
                    <text x="43" y="16" textAnchor="middle" fill="#dcb36f" fontSize="9" fontWeight="700">empty</text>
                    <text x="43" y="36" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" fontFamily="JetBrains Mono, monospace">5</text>
                    <text x="43" y="50" textAnchor="middle" fill="#9dbfb1" fontSize="8">slots free</text>

                    {/* mutex */}
                    <rect x="96" y="0" width="86" height="58" rx="5" fill="#102b27" stroke="#356157" />
                    <text x="139" y="16" textAnchor="middle" fill="#71c390" fontSize="9" fontWeight="700">mutex</text>
                    <text x="139" y="36" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" fontFamily="JetBrains Mono, monospace">1</text>
                    <text x="139" y="50" textAnchor="middle" fill="#9dbfb1" fontSize="8">unlocked</text>

                    {/* full */}
                    <rect x="192" y="0" width="86" height="58" rx="5" fill="#102b27" stroke="#356157" />
                    <text x="235" y="16" textAnchor="middle" fill="#f0c984" fontSize="9" fontWeight="700">full</text>
                    <text x="235" y="36" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="700" fontFamily="JetBrains Mono, monospace">0</text>
                    <text x="235" y="50" textAnchor="middle" fill="#9dbfb1" fontSize="8">items ready</text>
                  </g>
                </g>

                {/* LANE 2: SHARED 5-SLOT CIRCULAR BUFFER STRIP */}
                <g className="sl-buffer-strip" transform="translate(375, 195)">
                  <rect x="0" y="0" width="300" height="90" rx="8" fill="#ffffff" stroke="#d5c8b2" strokeWidth="1.2" />
                  <text x="15" y="18" fill="#7d6a52" fontSize="9" fontWeight="700" letterSpacing="0.6px">
                    CIRCULAR QUEUE (writePos: 0, readPos: 0)
                  </text>

                  <g transform="translate(10, 32)">
                    {[0, 1, 2, 3, 4].map((slot) => (
                      <g key={slot} transform={`translate(${slot * 56}, 0)`}>
                        <rect x="0" y="0" width="48" height="44" rx="4" fill="#f5f0e6" stroke="#cbbfa9" />
                        <text x="24" y="18" textAnchor="middle" fill="#183d38" fontSize="9" fontWeight="700">SLOT {slot}</text>
                        <text x="24" y="34" textAnchor="middle" fill="#8f7e68" fontSize="8">empty</text>
                      </g>
                    ))}
                  </g>
                </g>

                {/* Inspect Buffer Trigger */}
                <FlowNodeSvg
                  x={525} y={325} width={260} height={40} shape="box"
                  label="Inspect Circular Buffer Primitives" sub="Capacity 5 · Circular Modulo Arithmetic"
                  isSelected={selectedNodeId === 'comb_buffer'}
                  onClick={() => setSelectedNodeId('comb_buffer')}
                />

                {/* LANE 1 NODES */}
                <FlowNodeSvg
                  x={175} y={115} width={240} height={48} shape="box"
                  label="Student Producer" sub="Create meal order"
                  isSelected={selectedNodeId === 'comb_producer'}
                  onClick={() => setSelectedNodeId('comb_producer')}
                />
                <FlowNodeSvg
                  x={175} y={205} width={240} height={48} shape="box"
                  label="wait(empty)" sub="Reserve free slot permit"
                  isSelected={selectedNodeId === 'comb_sem_empty'}
                  onClick={() => setSelectedNodeId('comb_sem_empty')}
                />
                <FlowNodeSvg
                  x={175} y={295} width={240} height={50} shape="box"
                  label="wait(mutex) → Insert" sub="write = (write + 1) mod 5"
                  isSelected={selectedNodeId === 'comb_mutex'}
                  onClick={() => setSelectedNodeId('comb_mutex')}
                />
                <FlowNodeSvg
                  x={175} y={395} width={240} height={48} shape="box"
                  label="signal(full)" sub="Publish item permit"
                  isSelected={selectedNodeId === 'comb_sem_full'}
                  onClick={() => setSelectedNodeId('comb_sem_full')}
                />

                {/* LANE 3 NODES */}
                <FlowNodeSvg
                  x={875} y={115} width={240} height={48} shape="box"
                  label="Kitchen Consumer" sub="Claim orders from queue"
                  isSelected={selectedNodeId === 'comb_consumer'}
                  onClick={() => setSelectedNodeId('comb_consumer')}
                />
                <FlowNodeSvg
                  x={875} y={205} width={240} height={48} shape="box"
                  label="wait(full)" sub="Block when 0 orders ready"
                  isSelected={selectedNodeId === 'comb_sem_full'}
                  onClick={() => setSelectedNodeId('comb_sem_full')}
                />
                <FlowNodeSvg
                  x={875} y={295} width={240} height={50} shape="box"
                  label="wait(mutex) → Remove" sub="read = (read + 1) mod 5"
                  isSelected={selectedNodeId === 'comb_mutex'}
                  onClick={() => setSelectedNodeId('comb_mutex')}
                />
                <FlowNodeSvg
                  x={875} y={395} width={240} height={48} shape="prep"
                  label="Cook Outside Lock" sub="signal(empty) → cook → ready"
                  isSelected={selectedNodeId === 'comb_prep_rack'}
                  onClick={() => setSelectedNodeId('comb_prep_rack')}
                />

                {/* SOLID DATA ARROWS */}
                <g className="sl-flow-lines" markerEnd={`url(#comb-arrow-${uid})`}>
                  {/* Producer Insert to Buffer */}
                  <path d="M295 295 H375" />
                  {/* Buffer to Consumer Remove */}
                  <path d="M675 295 H755" />
                </g>

                {/* DASHED SYNCHRONIZATION SIGNALS */}
                <g className="sl-signal-connectors" markerEnd={`url(#comb-sig-${uid})`}>
                  <path d="M295 395 H345 V455 H700 V205 H755" strokeDasharray="5 4" stroke="#c39a5a" fill="none" strokeWidth="1.8" />
                  <path d="M755 395 H705 V475 H345 V205 H295" strokeDasharray="5 4" stroke="#c39a5a" fill="none" strokeWidth="1.8" />
                </g>

                <text className="sl-flow-label" x="525" y="445" textAnchor="middle">
                  signal(full) wakes sleeping kitchen consumer
                </text>
                <text className="sl-flow-label" x="525" y="490" textAnchor="middle">
                  signal(empty) wakes sleeping student producer
                </text>
              </svg>
            )}
          </div>
        </div>

        {/* DETAILED NODE EXPLANATION INSPECTOR CARD */}
        <div className="sl-panel sl-node-detail-panel">
          <div className="sl-node-detail-header">
            <div className="sl-inspector-eyebrow-row">
              <span className="sl-eyebrow">NODE INSPECTOR</span>
              {activeNode?.stepNumber && (
                <span className="sl-step-badge">STEP {activeNode.stepNumber}</span>
              )}
            </div>
            <h3>{activeNode?.label}</h3>
            {activeNode?.stage && (
              <span className="sl-stage-tag">{activeNode.stage}</span>
            )}
            <span className={`sl-cs-badge ${activeNode?.cs === 'inside' ? 'inside-cs' : activeNode?.cs === 'boundary' ? 'boundary-cs' : 'outside-cs'}`}>
              {activeNode?.cs === 'inside' ? <><Lock size={12} /> INSIDE CRITICAL SECTION</> : activeNode?.cs === 'boundary' ? <><ShieldAlert size={12} /> LOCK ACQUISITION / RELEASE</> : <><Unlock size={12} /> OUTSIDE CRITICAL SECTION</>}
            </span>
          </div>

          <div className="sl-node-instruction-block">
            <span className="sl-instruction-label">RELEVANT OS OPERATION / INSTRUCTION:</span>
            <code>{activeNode?.op}</code>
          </div>

          <div className="sl-node-detail-body">
            <div className="sl-detail-row">
              <strong>
                <Info size={12} className="sl-muted-icon" /> Plain-Language Meaning:
              </strong>
              <p>{activeNode?.meaning}</p>
            </div>

            <div className="sl-detail-row">
              <strong>
                <Clock size={12} className="sl-muted-icon" /> Blocking &amp; Resume Behavior:
              </strong>
              <p className="sl-blocking-desc">{activeNode?.blocking || 'Non-blocking local execution.'}</p>
            </div>

            <div className="sl-detail-row">
              <strong>
                <Layers size={12} className="sl-muted-icon" /> Resource Affected:
              </strong>
              <span className="sl-resource-pill">{activeNode?.resource}</span>
            </div>

            <div className="sl-detail-row">
              <strong>
                <Utensils size={12} className="sl-muted-icon" /> College Canteen Analogy:
              </strong>
              <p className="sl-canteen-analogy">
                <span>{activeNode?.canteen}</span>
              </p>
            </div>
          </div>

          <div className="sl-flowcharts-footer-note">
            <BookOpen size={15} />
            <p>
              Walk through the diagram using <strong>Next</strong> and <strong>Previous</strong> to inspect how POSIX semaphores coordinate concurrent orders without altering active simulation state.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNodeSvg({ x, y, width = 200, height = 44, shape = 'box', label, sub, isSelected, onClick }) {
  const halfW = width / 2;
  const halfH = height / 2;

  return (
    <g
      className={`sl-flow-node ${shape} ${isSelected ? 'active' : ''} clickable`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {shape === 'decision' ? (
        <polygon points={`${x},${y - halfH} ${x + halfW},${y} ${x},${y + halfH} ${x - halfW},${y}`} />
      ) : shape === 'terminal' ? (
        <ellipse cx={x} cy={y} rx={halfW} ry={halfH} />
      ) : (
        <rect x={x - halfW} y={y - halfH} width={width} height={height} rx="7" />
      )}
      <text x={x} y={y - (sub ? 4 : -4)} textAnchor="middle" className="sl-node-text-main">
        {label}
      </text>
      {sub && (
        <text x={x} y={y + 11} textAnchor="middle" className="sub">
          {sub}
        </text>
      )}
    </g>
  );
}
