import React from 'react';
import { Lock, Unlock, ChevronRight } from 'lucide-react';

export function StateLegend({
  emptyCount = 5,
  fullCount = 0,
  capacity = 5,
  mutexOwner = null,
  raceMode = false,
  isProtected = true,
  onClickInspect = () => {},
}) {
  return (
    <div
      className="arena-state-bar inspect-semaphores-btn"
      onClick={onClickInspect}
      role="button"
      tabIndex={0}
      title="Click to view semaphore and concurrency details in the inspector"
      aria-label="Inspect Semaphores"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClickInspect();
        }
      }}
    >
      <div className="state-bar-items">
        <div className="state-item">
          <span className="state-dot empty" />
          <span className="state-label">sem_t empty:</span>
          <strong className="state-value">{emptyCount}</strong>
        </div>

        <span className="state-sep">·</span>

        <div className="state-item">
          <span className="state-dot full" />
          <span className="state-label">sem_t full:</span>
          <strong className="state-value">{fullCount}</strong>
        </div>

        <span className="state-sep">·</span>

        <div className="state-item">
          {mutexOwner ? <Lock size={12} className="text-purple-600" /> : <Unlock size={12} className="text-emerald-600" />}
          <span className="state-label">mutex:</span>
          <strong className={`state-value ${mutexOwner ? 'locked' : ''}`}>
            {mutexOwner ? `Held by ${mutexOwner}` : '1 (Unlocked)'}
          </strong>
        </div>

        <span className="state-sep">·</span>

        <div className="state-item">
          <span className="state-label">capacity:</span>
          <strong className="state-value">{capacity}</strong>
        </div>
      </div>

      <div className="state-bar-action">
        <span>Inspect Semaphores</span>
        <ChevronRight size={13} />
      </div>
    </div>
  );
}
