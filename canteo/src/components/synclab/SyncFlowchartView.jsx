import { useState } from 'react';
import { THREAD_ROLE, THREAD_STATUS } from '../../logic/syncLabEngine';

/**
 * Interactive SVG/HTML Synchronization Flowchart (Light Theme)
 * Traces the Producer (Student) and Consumer (Kitchen Staff) execution routines.
 * Highlights the active instruction, shows blocked branches, and displays live semaphore values.
 */
export default function SyncFlowchartView({ state, activeThreadId = 'P1' }) {
  const [activeTab, setActiveTab] = useState('PRODUCER'); // 'PRODUCER' | 'CONSUMER'

  const currentThread = state.threads[activeThreadId] || state.threads.P1;
  const isProducerTab = activeTab === 'PRODUCER';

  const threadToTrack = isProducerTab
    ? (currentThread.role === THREAD_ROLE.PRODUCER ? currentThread : state.threads.P1)
    : (currentThread.role === THREAD_ROLE.CONSUMER ? currentThread : state.threads.C1);

  const pc = threadToTrack?.pc ?? 0;
  const isBlocked = threadToTrack?.status === THREAD_STATUS.BLOCKED;
  const waitingFor = threadToTrack?.waitingFor;

  const emptyVal = state.empty ?? state.semaphores?.empty?.value ?? 5;
  const fullVal = state.full ?? state.semaphores?.full?.value ?? 0;
  const mutexVal = typeof state.mutex === 'object' ? state.mutex.value : state.mutex ?? 1;
  const isMutexMode = !state.withoutMutex;

  return (
    <div className="flex flex-col h-full bg-white text-[#263843] rounded-xl p-4 border border-[#DEE6E8]">
      {/* Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DEE6E8] mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-[#167D8D]">
            OS Synchronization Flowchart
          </div>
          <div className="text-sm font-semibold text-[#263843]">
            {isProducerTab ? 'Producer Routine: Student (P1 / P2)' : 'Consumer Routine: Kitchen Staff (C1 / C2)'}
          </div>
        </div>

        <div className="flex bg-[#F0F4F5] p-1 rounded-lg border border-[#DEE6E8] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('PRODUCER')}
            className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
              isProducerTab
                ? 'bg-[#167D8D] text-white font-semibold shadow-xs'
                : 'text-[#62747C] hover:text-[#263843]'
            }`}
          >
            Producer Flow (Student)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONSUMER')}
            className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
              !isProducerTab
                ? 'bg-[#167D8D] text-white font-semibold shadow-xs'
                : 'text-[#62747C] hover:text-[#263843]'
            }`}
          >
            Consumer Flow (Kitchen)
          </button>
        </div>
      </div>

      {/* Live State Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-xs font-mono">
        <div className="p-2 rounded-lg bg-[#F0F4F5] border border-[#DEE6E8] flex flex-col">
          <span className="text-[#62747C] text-[11px]">Tracking Thread</span>
          <span className="text-[#167D8D] font-bold">{threadToTrack.id} ({threadToTrack.role})</span>
        </div>
        <div className="p-2 rounded-lg bg-[#F0F4F5] border border-[#DEE6E8] flex flex-col">
          <span className="text-[#62747C] text-[11px]">sem_t empty</span>
          <span className={`font-bold ${emptyVal === 0 ? 'text-[#B43D3D]' : 'text-[#23704B]'}`}>
            {emptyVal} / 5 free
          </span>
        </div>
        <div className="p-2 rounded-lg bg-[#F0F4F5] border border-[#DEE6E8] flex flex-col">
          <span className="text-[#62747C] text-[11px]">sem_t full</span>
          <span className={`font-bold ${fullVal === 0 ? 'text-[#8B6508]' : 'text-[#23704B]'}`}>
            {fullVal} / 5 queued
          </span>
        </div>
        <div className="p-2 rounded-lg bg-[#F0F4F5] border border-[#DEE6E8] flex flex-col">
          <span className="text-[#62747C] text-[11px]">pthread_mutex</span>
          <span className={`font-bold ${mutexVal === 0 ? 'text-[#8B6508]' : 'text-[#23704B]'}`}>
            {isMutexMode ? (mutexVal === 1 ? '1 (Unlocked)' : `0 (Locked by ${state.mutexOwner || 'Thread'})`) : 'Bypassed (Unsafe)'}
          </span>
        </div>
      </div>

      {/* Flowchart Diagram SVG */}
      <div className="flex-1 overflow-auto bg-[#F7F8FA] rounded-lg p-3 border border-[#DEE6E8] flex justify-center">
        {isProducerTab ? (
          <ProducerFlowchartSvg
            pc={pc}
            isBlocked={isBlocked && waitingFor === 'empty'}
            isMutexBlocked={isBlocked && waitingFor === 'mutex'}
            emptyVal={emptyVal}
            isMutexMode={isMutexMode}
          />
        ) : (
          <ConsumerFlowchartSvg
            pc={pc}
            isBlocked={isBlocked && waitingFor === 'full'}
            isMutexBlocked={isBlocked && waitingFor === 'mutex'}
            fullVal={fullVal}
            isMutexMode={isMutexMode}
            isDecomposed={Boolean(state.useDecomposedConsumer)}
          />
        )}
      </div>

      {/* Legend / Status Footer */}
      <div className="mt-3 pt-2 border-t border-[#DEE6E8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#62747C]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#167D8D]"></span>
            <span>Current Instruction (pc: {pc})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B6508]"></span>
            <span>Waiting Branch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border border-[#167D8D] bg-[#E4F3F3]"></span>
            <span>Critical Section</span>
          </div>
        </div>

        {isBlocked && (
          <span className="text-[#8B6508] font-semibold bg-[#FFF3D6] px-2 py-0.5 rounded-full border border-[#8B6508]/30">
            ⏳ Thread {threadToTrack.id} is waiting for &quot;{waitingFor}&quot;
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Producer Flowchart SVG (Light Theme)
 */
function ProducerFlowchartSvg({ pc, isBlocked, isMutexBlocked, emptyVal, isMutexMode }) {
  const isNodeActive = (step) => pc === step;

  return (
    <svg viewBox="0 0 540 680" className="w-full max-w-lg select-none font-sans" style={{ minHeight: '620px' }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#62747C" />
        </marker>
        <marker id="arrow-teal" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#167D8D" />
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#8B6508" />
        </marker>
      </defs>

      {/* Critical Section Container Box */}
      <rect
        x="90"
        y="300"
        width="360"
        height="180"
        rx="8"
        fill="#E4F3F3"
        stroke="#167D8D"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <text x="105" y="320" fill="#167D8D" fontSize="11" fontWeight="bold" letterSpacing="0.05em">
        CRITICAL SECTION (MUTEX PROTECTED)
      </text>

      {/* Step 0: Start / Local Item */}
      <g>
        <rect
          x="170"
          y="20"
          width="200"
          height="45"
          rx="6"
          fill={isNodeActive(0) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(0) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="48"
          textAnchor="middle"
          fill={isNodeActive(0) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight={isNodeActive(0) ? 'bold' : 'normal'}
        >
          pc=0: Create local order item
        </text>
      </g>

      {/* Arrow Step 0 -> Step 1 */}
      <line x1="270" y1="65" x2="270" y2="100" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Step 1: Decision sem_wait(&empty) */}
      <g>
        <polygon
          points="270,105 380,150 270,195 160,150"
          fill={isNodeActive(1) ? (isBlocked ? '#FFF3D6' : '#167D8D') : '#FFFFFF'}
          stroke={isBlocked ? '#8B6508' : isNodeActive(1) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="145"
          textAnchor="middle"
          fill={isNodeActive(1) ? (isBlocked ? '#8B6508' : '#FFFFFF') : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          sem_wait(&amp;empty)
        </text>
        <text
          x="270"
          y="162"
          textAnchor="middle"
          fill={isNodeActive(1) ? (isBlocked ? '#8B6508' : '#E4F3F3') : '#62747C'}
          fontSize="10"
        >
          empty &gt; 0? (now: {emptyVal})
        </text>
      </g>

      {/* Blocked branch to right: empty == 0 */}
      <path d="M 380 150 L 480 150 L 480 200" fill="none" stroke={isBlocked ? '#8B6508' : '#62747C'} strokeWidth="1.5" markerEnd="url(#arrow-amber)" />
      <text x="405" y="142" fill="#8B6508" fontSize="10" fontWeight="bold">No (empty==0)</text>
      <rect
        x="420"
        y="200"
        width="110"
        height="40"
        rx="6"
        fill={isBlocked ? '#FFF3D6' : '#FFFFFF'}
        stroke={isBlocked ? '#8B6508' : '#DEE6E8'}
        strokeWidth="1.5"
      />
      <text x="475" y="218" textAnchor="middle" fill="#8B6508" fontSize="10" fontWeight="bold">
        WAITING (sleep)
      </text>
      <text x="475" y="232" textAnchor="middle" fill="#8B6508" fontSize="9">
        wait queue for &amp;empty
      </text>

      {/* Pass branch down: empty > 0 */}
      <line x1="270" y1="195" x2="270" y2="235" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />
      <text x="280" y="215" fill="#167D8D" fontSize="10" fontWeight="bold">Yes (decrement)</text>

      {/* Step 2: pthread_mutex_lock(&mutex) */}
      <g>
        <rect
          x="150"
          y="235"
          width="240"
          height="45"
          rx="6"
          fill={isNodeActive(2) ? (isMutexBlocked ? '#FFF3D6' : '#167D8D') : '#FFFFFF'}
          stroke={isMutexBlocked ? '#8B6508' : isNodeActive(2) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="262"
          textAnchor="middle"
          fill={isNodeActive(2) ? (isMutexBlocked ? '#8B6508' : '#FFFFFF') : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          {isMutexMode ? 'pthread_mutex_lock(&mutex)' : '[Mutex Omitted]'}
        </text>
      </g>

      {/* Arrow into Critical Section */}
      <line x1="270" y1="280" x2="270" y2="335" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />

      {/* Step 3: Insert item in buffer */}
      <g>
        <rect
          x="160"
          y="335"
          width="220"
          height="45"
          rx="6"
          fill={isNodeActive(3) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(3) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="362"
          textAnchor="middle"
          fill={isNodeActive(3) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          pc=3: buffer[in] = order_ticket
        </text>
      </g>

      {/* Arrow Step 3 -> Step 4 */}
      <line x1="270" y1="380" x2="270" y2="415" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />

      {/* Step 4: Advance IN pointer */}
      <g>
        <rect
          x="160"
          y="415"
          width="220"
          height="45"
          rx="6"
          fill={isNodeActive(4) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(4) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="442"
          textAnchor="middle"
          fill={isNodeActive(4) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          pc=4: in = (in + 1) % 5
        </text>
      </g>

      {/* Arrow Step 4 -> Step 5 */}
      <line x1="270" y1="460" x2="270" y2="505" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Step 5: pthread_mutex_unlock(&mutex) */}
      <g>
        <rect
          x="150"
          y="505"
          width="240"
          height="40"
          rx="6"
          fill={isNodeActive(5) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(5) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="530"
          textAnchor="middle"
          fill={isNodeActive(5) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          {isMutexMode ? 'pthread_mutex_unlock(&mutex)' : '[Mutex Omitted]'}
        </text>
      </g>

      {/* Arrow Step 5 -> Step 6 */}
      <line x1="270" y1="545" x2="270" y2="575" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Step 6: sem_post(&full) */}
      <g>
        <rect
          x="170"
          y="575"
          width="200"
          height="40"
          rx="6"
          fill={isNodeActive(6) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(6) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="600"
          textAnchor="middle"
          fill={isNodeActive(6) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          sem_post(&amp;full) (signals staff)
        </text>
      </g>

      {/* Arrow Step 6 -> Done */}
      <line x1="270" y1="615" x2="270" y2="640" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="270" y="655" textAnchor="middle" fill="#62747C" fontSize="11">
        Order queued on shared counter
      </text>
    </svg>
  );
}

/**
 * Consumer Flowchart SVG (Light Theme)
 */
function ConsumerFlowchartSvg({ pc, isBlocked, isMutexBlocked, fullVal, isMutexMode, isDecomposed }) {
  const isNodeActive = (step) => pc === step;

  return (
    <svg viewBox="0 0 540 680" className="w-full max-w-lg select-none font-sans" style={{ minHeight: '620px' }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#62747C" />
        </marker>
        <marker id="arrow-teal" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#167D8D" />
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#8B6508" />
        </marker>
      </defs>

      {/* Critical Section Container Box */}
      <rect
        x="90"
        y="290"
        width="360"
        height="190"
        rx="8"
        fill="#E4F3F3"
        stroke="#167D8D"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <text x="105" y="310" fill="#167D8D" fontSize="11" fontWeight="bold" letterSpacing="0.05em">
        CRITICAL SECTION (MUTEX PROTECTED)
      </text>

      {/* Step 0: Ready to take order */}
      <g>
        <rect
          x="170"
          y="20"
          width="200"
          height="45"
          rx="6"
          fill={isNodeActive(0) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(0) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="48"
          textAnchor="middle"
          fill={isNodeActive(0) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight={isNodeActive(0) ? 'bold' : 'normal'}
        >
          pc=0: Kitchen staff idle / ready
        </text>
      </g>

      {/* Arrow Step 0 -> Step 1 */}
      <line x1="270" y1="65" x2="270" y2="100" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Step 1: Decision sem_wait(&full) */}
      <g>
        <polygon
          points="270,105 380,150 270,195 160,150"
          fill={isNodeActive(1) ? (isBlocked ? '#FFF3D6' : '#167D8D') : '#FFFFFF'}
          stroke={isBlocked ? '#8B6508' : isNodeActive(1) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="145"
          textAnchor="middle"
          fill={isNodeActive(1) ? (isBlocked ? '#8B6508' : '#FFFFFF') : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          sem_wait(&amp;full)
        </text>
        <text
          x="270"
          y="162"
          textAnchor="middle"
          fill={isNodeActive(1) ? (isBlocked ? '#8B6508' : '#E4F3F3') : '#62747C'}
          fontSize="10"
        >
          full &gt; 0? (now: {fullVal})
        </text>
      </g>

      {/* Blocked branch to right: full == 0 */}
      <path d="M 380 150 L 480 150 L 480 200" fill="none" stroke={isBlocked ? '#8B6508' : '#62747C'} strokeWidth="1.5" markerEnd="url(#arrow-amber)" />
      <text x="405" y="142" fill="#8B6508" fontSize="10" fontWeight="bold">No (full==0)</text>
      <rect
        x="420"
        y="200"
        width="110"
        height="40"
        rx="6"
        fill={isBlocked ? '#FFF3D6' : '#FFFFFF'}
        stroke={isBlocked ? '#8B6508' : '#DEE6E8'}
        strokeWidth="1.5"
      />
      <text x="475" y="218" textAnchor="middle" fill="#8B6508" fontSize="10" fontWeight="bold">
        WAITING (sleep)
      </text>
      <text x="475" y="232" textAnchor="middle" fill="#8B6508" fontSize="9">
        wait queue for &amp;full
      </text>

      {/* Pass branch down: full > 0 */}
      <line x1="270" y1="195" x2="270" y2="230" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />
      <text x="280" y="215" fill="#167D8D" fontSize="10" fontWeight="bold">Yes (decrement)</text>

      {/* Step 2: pthread_mutex_lock(&mutex) */}
      <g>
        <rect
          x="150"
          y="230"
          width="240"
          height="45"
          rx="6"
          fill={isNodeActive(2) ? (isMutexBlocked ? '#FFF3D6' : '#167D8D') : '#FFFFFF'}
          stroke={isMutexBlocked ? '#8B6508' : isNodeActive(2) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="257"
          textAnchor="middle"
          fill={isNodeActive(2) ? (isMutexBlocked ? '#8B6508' : '#FFFFFF') : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          {isMutexMode ? 'pthread_mutex_lock(&mutex)' : '[Mutex Omitted — UNSAFE]'}
        </text>
      </g>

      {/* Arrow into Critical Section */}
      <line x1="270" y1="275" x2="270" y2="325" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />

      {/* Critical Step: Remove/Claim Order */}
      <g>
        <rect
          x="150"
          y="325"
          width="240"
          height="45"
          rx="6"
          fill={(isNodeActive(3) || (isDecomposed && (isNodeActive(2) || isNodeActive(3) || isNodeActive(4)))) ? '#167D8D' : '#FFFFFF'}
          stroke={(isNodeActive(3) || (isDecomposed && (isNodeActive(2) || isNodeActive(3) || isNodeActive(4)))) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="352"
          textAnchor="middle"
          fill={(isNodeActive(3) || (isDecomposed && (isNodeActive(2) || isNodeActive(3) || isNodeActive(4)))) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          {isDecomposed ? 'Read out & Claim ticket from slot' : 'ticket = buffer[out]; buffer[out]=null'}
        </text>
      </g>

      {/* Arrow to Advance OUT */}
      <line x1="270" y1="370" x2="270" y2="405" stroke="#167D8D" strokeWidth="1.5" markerEnd="url(#arrow-teal)" />

      {/* Step 4/5: Advance OUT pointer */}
      <g>
        <rect
          x="160"
          y="405"
          width="220"
          height="45"
          rx="6"
          fill={(isNodeActive(4) || (isDecomposed && (isNodeActive(5) || isNodeActive(4)))) ? '#167D8D' : '#FFFFFF'}
          stroke={(isNodeActive(4) || (isDecomposed && (isNodeActive(5) || isNodeActive(4)))) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="432"
          textAnchor="middle"
          fill={(isNodeActive(4) || (isDecomposed && (isNodeActive(5) || isNodeActive(4)))) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          out = (out + 1) % 5
        </text>
      </g>

      {/* Arrow out of Critical Section */}
      <line x1="270" y1="450" x2="270" y2="495" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Release Mutex */}
      <g>
        <rect
          x="150"
          y="495"
          width="240"
          height="40"
          rx="6"
          fill={isNodeActive(isDecomposed ? 6 : 5) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(isDecomposed ? 6 : 5) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="520"
          textAnchor="middle"
          fill={isNodeActive(isDecomposed ? 6 : 5) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          {isMutexMode ? 'pthread_mutex_unlock(&mutex)' : '[Mutex Omitted]'}
        </text>
      </g>

      {/* Arrow to sem_post(&empty) */}
      <line x1="270" y1="535" x2="270" y2="565" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Step: sem_post(&empty) */}
      <g>
        <rect
          x="170"
          y="565"
          width="200"
          height="40"
          rx="6"
          fill={isNodeActive(isDecomposed ? 7 : 6) ? '#167D8D' : '#FFFFFF'}
          stroke={isNodeActive(isDecomposed ? 7 : 6) ? '#116674' : '#DEE6E8'}
          strokeWidth="1.5"
        />
        <text
          x="270"
          y="590"
          textAnchor="middle"
          fill={isNodeActive(isDecomposed ? 7 : 6) ? '#FFFFFF' : '#263843'}
          fontSize="12"
          fontWeight="bold"
        >
          sem_post(&amp;empty) (releases capacity)
        </text>
      </g>

      {/* Arrow to Cooking/Preparing */}
      <line x1="270" y1="605" x2="270" y2="635" stroke="#62747C" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="270" y="650" textAnchor="middle" fill="#62747C" fontSize="11">
        Cook order outside critical section &amp; deliver
      </text>
    </svg>
  );
}
