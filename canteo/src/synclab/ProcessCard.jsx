import React from 'react';
import { Users, ChefHat, LockKeyhole, Clock, CheckCircle2 } from 'lucide-react';

export default function ProcessCard({
  process,
  isSelected = false,
  isActing = false,
  isMutexOwner = false,
  onSelect = () => {},
}) {
  const isProducer = process.type === 'PRODUCER';
  const isBlocked = process.state === 'BLOCKED' || Boolean(process.waitingFor);
  const isCritical = isMutexOwner || process.state === 'CRITICAL';

  let stateStyle = 'ready';
  if (process.state === 'DONE') stateStyle = 'done';
  else if (isCritical) stateStyle = 'critical';
  else if (isBlocked) stateStyle = 'waiting';
  else if (process.state === 'RUNNING' || isActing) stateStyle = 'running';

  return (
    <div
      className={`sl2-process-card ${isSelected ? 'selected' : ''} ${isCritical ? 'active-cs' : ''} ${isBlocked ? 'active-blocked' : ''} ${isActing ? 'active-run' : ''}`}
      onClick={() => onSelect(process.id)}
      role="button"
      tabIndex={0}
    >
      <div className="sl2-proc-header">
        <div className="sl2-proc-id-wrap">
          {isProducer ? (
            <Users size={14} color="var(--producer)" />
          ) : (
            <ChefHat size={14} color="var(--consumer)" />
          )}
          <span className="sl2-proc-id">{process.id}</span>
          <span className="sl2-proc-role">{isProducer ? 'Student' : 'Kitchen'}</span>
        </div>
        <span className={`sl2-state-badge ${stateStyle}`}>
          {isCritical ? 'CRITICAL' : isBlocked ? `WAIT (${process.waitingFor || 'SEMAPHORE'})` : process.state}
        </span>
      </div>

      <div className={`sl2-proc-instruction ${isCritical ? 'cs' : ''}`}>
        <span>
          PC {process.pc}: {process.currentInstructionLabel || 'Ready'}
        </span>
        {isCritical && <LockKeyhole size={11} />}
        {isBlocked && <Clock size={11} />}
        {process.state === 'DONE' && <CheckCircle2 size={11} />}
      </div>

      {isBlocked && (
        <div style={{ fontSize: '10.5px', color: 'var(--waiting)', fontFamily: 'var(--font-mono)' }}>
          Blocked on: <b>sem_wait(&{process.waitingFor})</b> (No busy-waiting)
        </div>
      )}

      {isCritical && (
        <div style={{ fontSize: '10.5px', color: 'var(--critical)', fontFamily: 'var(--font-mono)' }}>
          Holds Mutex · Exclusive queue memory access
        </div>
      )}
    </div>
  );
}

