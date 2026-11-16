import React, { useState, useEffect } from 'react';
import { User, ChefHat, Lock, X, Eye, ChevronRight, Trash2, Plus, Clock, CheckCircle2 } from 'lucide-react';

export function ProcessOrbit({
  processes = [],
  selectedProcessId = null,
  activeProcessId = null,
  onSelectProcess = null,
  onInspectProcess = null,
  onRemoveProcess = null,
  onAddProducer = null,
  onAddConsumer = null,
  onClearSession = null,
  isManagerOpen = false,
  onOpenManager = null,
  onCloseManager = null,
}) {
  const [internalSector, setInternalSector] = useState(null); // 'producers' | 'consumers' | 'all' | null
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'producers' | 'consumers'

  const overflowSector = isManagerOpen ? 'all' : internalSector;
  const setOverflow = (val) => {
    if (val === null) {
      handleCloseDialog();
    } else {
      setInternalSector(val);
      if (val === 'producers' || val === 'consumers') {
        setFilterTab(val);
      }
      if (onOpenManager) {
        onOpenManager();
      }
    }
  };

  const handleCloseDialog = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    setInternalSector(null);
    setFilterTab('all');
    if (onCloseManager) {
      onCloseManager();
    }
  };

  // Dismiss overflow modal on Escape key
  useEffect(() => {
    if (!overflowSector) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseDialog(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [overflowSector]);

  const producers = processes.filter((p) => p.type === 'PRODUCER');
  const consumers = processes.filter((p) => p.type === 'CONSUMER');

  const visibleProducers = producers.slice(0, 4);
  const visibleConsumers = consumers.slice(0, 4);

  const renderProcessNode = (process) => {
    const isSelected = selectedProcessId === process.id;
    const isActive = activeProcessId === process.id;
    const isBlocked = process.state === 'BLOCKED' || process.state === 'WAITING';
    const isCritical = process.state === 'CRITICAL' || process.acquiredMutex;
    const isRunning = process.state === 'RUNNING';
    const isProducer = process.type === 'PRODUCER';
    const isStopping = Boolean(process.stoppingRequested);

    return (
      <div
        key={process.id}
        className={`arena-process-node ${isProducer ? 'producer' : 'consumer'} ${isSelected ? 'selected' : ''} ${isRunning ? 'running' : ''} ${isBlocked ? 'blocked' : ''} ${isCritical ? 'critical' : ''} ${isStopping ? 'stopping' : ''}`}
        onClick={() => {
          if (onSelectProcess) onSelectProcess(process.id);
          if (onInspectProcess) onInspectProcess(process);
        }}
        role="button"
        tabIndex={0}
        aria-label={`${isProducer ? 'Student' : 'Kitchen'} ${process.id}`}
      >
        <div className="proc-node-header-row">
          <div className="proc-node-title">
            <span className="proc-node-id">{process.id}</span>
            <span className="proc-node-sep">·</span>
            <span className="proc-node-role">{isProducer ? 'Student' : 'Kitchen'}</span>
          </div>

          {onRemoveProcess && (
            <button
              type="button"
              className="proc-node-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveProcess(process.id);
              }}
              title={isStopping ? 'Stopping requested after cycle' : 'Remove process safely'}
              aria-label={`Remove ${process.id}`}
            >
              <X size={11} />
            </button>
          )}
        </div>

        <div className="proc-node-status">
          {isStopping ? (
            <span className="status-text stopping">Stopping after cycle</span>
          ) : isCritical ? (
            <span className="status-text critical">
              <Lock size={10} /> Critical Section
            </span>
          ) : isBlocked ? (
            <span className="status-text blocked">
              {process.waitingFor === 'mutex'
                ? 'Waiting for lock'
                : isProducer
                ? 'Waiting for capacity'
                : 'Waiting for an order'}
            </span>
          ) : isRunning ? (
            <span className="status-text running">Running</span>
          ) : process.state === 'PREPARING' ? (
            <span className="status-text cooking">
              {process.foodName ? `Prep: ${process.foodName}` : 'Preparing'}
            </span>
          ) : process.state === 'COMPLETED' ? (
            <span className="status-text completed">Completed</span>
          ) : (
            <span className="status-text ready">Ready</span>
          )}
        </div>
      </div>
    );
  };

  const getFilteredModalProcesses = () => {
    if (overflowSector === 'producers') return producers;
    if (overflowSector === 'consumers') return consumers;
    if (filterTab === 'producers') return producers;
    if (filterTab === 'consumers') return consumers;
    return processes;
  };

  const modalProcesses = getFilteredModalProcesses();

  return (
    <div className="arena-process-orbit-container">
      {/* Upper-Left Sector: Student Producers */}
      <div className="arena-orbit-sector producers-sector">
        <div className="arena-sector-tag-row">
          <div className="arena-sector-tag">
            <User size={14} />
            <h2 className="arena-sector-heading">
              Producers <span className="arena-sector-count">({producers.length})</span>
            </h2>
            {producers.length > 4 && (
              <span className="arena-sector-visible-hint">4 visible</span>
            )}
          </div>
          {producers.length > 4 && (
            <button
              type="button"
              className="arena-overflow-view-all-btn"
              onClick={() => setOverflow('producers')}
              title="View all producers"
            >
              View all ({producers.length})
            </button>
          )}
        </div>

        <div className="arena-process-grid">
          {producers.length === 0 ? (
            <div className="arena-process-empty">No active producers</div>
          ) : (
            <>
              {visibleProducers.map(renderProcessNode)}
              {producers.length > 4 && (
                <div
                  className="arena-process-overflow-card"
                  onClick={() => setOverflow('producers')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="overflow-card-count">+{producers.length - 4} more producers</span>
                  <span className="overflow-card-action">View all ({producers.length}) <ChevronRight size={12} /></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lower-Right Sector: Kitchen Consumers */}
      <div className="arena-orbit-sector consumers-sector">
        <div className="arena-sector-tag-row">
          <div className="arena-sector-tag">
            <ChefHat size={14} />
            <h2 className="arena-sector-heading">
              Consumers <span className="arena-sector-count">({consumers.length})</span>
            </h2>
            {consumers.length > 4 && (
              <span className="arena-sector-visible-hint">4 visible</span>
            )}
          </div>
          {consumers.length > 4 && (
            <button
              type="button"
              className="arena-overflow-view-all-btn"
              onClick={() => setOverflow('consumers')}
              title="View all consumers"
            >
              View all ({consumers.length})
            </button>
          )}
        </div>

        <div className="arena-process-grid">
          {consumers.length === 0 ? (
            <div className="arena-process-empty">No active consumers</div>
          ) : (
            <>
              {visibleConsumers.map(renderProcessNode)}
              {consumers.length > 4 && (
                <div
                  className="arena-process-overflow-card"
                  onClick={() => setOverflow('consumers')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="overflow-card-count">+{consumers.length - 4} more consumers</span>
                  <span className="overflow-card-action">View all ({consumers.length}) <ChevronRight size={12} /></span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full Process Manager & Overflow Dialog */}
      {overflowSector && (
        <div
          className="arena-overflow-backdrop"
          onClick={handleCloseDialog}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="arena-overflow-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="arena-overflow-dialog-header">
              <div className="dialog-title-group">
                <div className="dialog-title-with-icon">
                  <User size={16} />
                  <h3 className="dialog-title">
                    Process Management ({processes.length} Active Threads)
                  </h3>
                </div>
                <p className="dialog-subtitle">
                  Inspect thread registers, schedule execution, or safely retire processes without corrupting synchronization state.
                </p>
              </div>
              <button
                type="button"
                className="arena-dialog-close-btn"
                onClick={handleCloseDialog}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleCloseDialog(e);
                  }
                }}
                data-testid="process-manager-close-btn"
                aria-label="Close dialog"
                title="Close (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="dialog-filter-tabs">
              <button
                type="button"
                className={`filter-tab-btn ${filterTab === 'all' ? 'active' : ''}`}
                onClick={() => setFilterTab('all')}
              >
                All Threads ({processes.length})
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${filterTab === 'producers' ? 'active' : ''}`}
                onClick={() => setFilterTab('producers')}
              >
                Producers ({producers.length})
              </button>
              <button
                type="button"
                className={`filter-tab-btn ${filterTab === 'consumers' ? 'active' : ''}`}
                onClick={() => setFilterTab('consumers')}
              >
                Consumers ({consumers.length})
              </button>
            </div>

            <div className="arena-overflow-list">
              {modalProcesses.length === 0 ? (
                <div className="arena-overflow-empty">No processes in this category</div>
              ) : (
                modalProcesses.map((proc, index) => {
                  const isSelected = selectedProcessId === proc.id;
                  const isBlocked = proc.state === 'BLOCKED' || proc.state === 'WAITING';
                  const isCritical = proc.state === 'CRITICAL' || proc.acquiredMutex;
                  const isRunning = proc.state === 'RUNNING';
                  const isStopping = Boolean(proc.stoppingRequested);
                  const isProducer = proc.type === 'PRODUCER';

                  return (
                    <div
                      key={proc.id}
                      className={`arena-overflow-row ${isSelected ? 'selected' : ''} ${isStopping ? 'stopping-row' : ''}`}
                      onClick={() => {
                        if (onSelectProcess) onSelectProcess(proc.id);
                        if (onInspectProcess) onInspectProcess(proc);
                        setOverflow(null);
                      }}
                    >
                      <div className="row-id-cell">
                        <span className="row-index">#{index + 1}</span>
                        <span className="row-id-badge">{proc.id}</span>
                        <span className="row-role-label">
                          {isProducer ? 'Student' : 'Kitchen'}
                        </span>
                      </div>

                      <div className="row-state-cell">
                        {isStopping ? (
                          <span className="row-badge stopping">
                            <Clock size={11} /> Stopping after cycle
                          </span>
                        ) : isCritical ? (
                          <span className="row-badge critical">
                            <Lock size={11} /> Critical Section
                          </span>
                        ) : isBlocked ? (
                          <span className="row-badge blocked" title={proc.waitingFor === 'full' ? 'Waiting for order to be published' : proc.waitingFor === 'empty' ? 'Waiting for slot to be freed' : 'Waiting for mutex lock'}>
                            Blocked: {proc.waitingFor === 'full' ? 'sem_wait(&full) · waiting for order' : proc.waitingFor === 'empty' ? 'sem_wait(&empty) · waiting for slot' : 'mutex · waiting for lock'}
                          </span>
                        ) : isRunning ? (
                          <span className="row-badge running">Running</span>
                        ) : proc.state === 'PREPARING' ? (
                          <span className="row-badge cooking">Preparing</span>
                        ) : proc.state === 'COMPLETED' ? (
                          <span className="row-badge completed">
                            <CheckCircle2 size={11} /> Completed
                          </span>
                        ) : (
                          <span className="row-badge ready">Ready</span>
                        )}
                      </div>

                      <div className="row-detail-cell">
                        <div className="row-detail-text">
                          {proc.foodName ? (
                            <span className="row-food-text">{proc.foodName}</span>
                          ) : proc.orderId ? (
                            <span className="row-food-text">{proc.orderId}</span>
                          ) : (
                            <span className="row-muted-text">None</span>
                          )}
                          <span className="row-count-badge">
                            {proc.completedCount ? `${proc.completedCount} done` : `${proc.workloadMode || 'single'}`}
                          </span>
                        </div>
                      </div>

                      <div className="row-action-cell">
                        <button
                          type="button"
                          className="arena-row-inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectProcess) onSelectProcess(proc.id);
                            if (onInspectProcess) onInspectProcess(proc);
                            setOverflow(null);
                          }}
                          title="Inspect registers and C code"
                        >
                          <Eye size={12} /> Inspect
                        </button>

                        {onRemoveProcess && (
                          <button
                            type="button"
                            className={`arena-row-remove-btn ${isStopping ? 'disabled' : ''}`}
                            disabled={isStopping}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveProcess(proc.id);
                            }}
                            title={
                              isStopping
                                ? 'Stop requested; retiring after current cycle'
                                : proc.permit || proc.acquiredMutex || proc.state === 'PREPARING'
                                ? 'Process owns resources; request graceful stop after cycle'
                                : `Remove ${proc.id} immediately`
                            }
                          >
                            <Trash2 size={11} />
                            <span>
                              {isStopping
                                ? 'Stopping...'
                                : proc.permit || proc.acquiredMutex || proc.state === 'PREPARING'
                                ? 'Stop after cycle'
                                : 'Remove'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Batch Controls & Footer */}
            <div className="arena-overflow-dialog-footer">
              <div className="footer-batch-actions">
                <span className="batch-label">Quick Add:</span>
                {onAddProducer && (
                  <>
                    <button
                      type="button"
                      className="batch-add-btn"
                      onClick={() => onAddProducer(1)}
                    >
                      +1 Student
                    </button>
                    <button
                      type="button"
                      className="batch-add-btn"
                      onClick={() => onAddProducer(3)}
                    >
                      +3 Students
                    </button>
                  </>
                )}
                {onAddConsumer && (
                  <>
                    <button
                      type="button"
                      className="batch-add-btn"
                      onClick={() => onAddConsumer(1)}
                    >
                      +1 Kitchen
                    </button>
                    <button
                      type="button"
                      className="batch-add-btn"
                      onClick={() => onAddConsumer(3)}
                    >
                      +3 Kitchen
                    </button>
                  </>
                )}
              </div>

              <div className="footer-right-actions">
                {onClearSession && processes.length > 0 && (
                  <button
                    type="button"
                    className="arena-footer-clear-btn"
                    onClick={() => {
                      onClearSession();
                      setOverflow(null);
                    }}
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  className="arena-footer-close-btn"
                  onClick={() => setOverflow(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
