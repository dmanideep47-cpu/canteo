import { PROCESS_INSTRUCTIONS } from '../engine/ProducerConsumerEngine.js';

export function CanteenRush2DFallback({
  snapshot,
  selectedEntityId,
  onSelectEntity,
  onPickUpOrder,
}) {
  const {
    slots = [null, null, null, null, null],
    writePosition = 0,
    readPosition = 0,
    mutexOwner = null,
    empty = 5,
    full = 0,
    processes = [],
    workers = [],
    readyOrders = [],
    completedOrders = [],
  } = snapshot || {};

  const isLocked = Boolean(mutexOwner);
  const students = processes?.filter((p) => p.type === 'PRODUCER') || [];

  return (
    <div className="cr-2d-container" role="region" aria-label="Accessible 2D Canteen Layout">
      {/* Top Resource HUD */}
      <div className="cr-2d-resource-bar">
        <div className={`cr-2d-mutex ${isLocked ? 'locked' : 'free'}`}>
          {isLocked ? (
            <span>🔒 Mutex: <b>LOCKED by {mutexOwner}</b></span>
          ) : (
            <span>🔓 Mutex: <b>FREE (Queue Unlocked)</b></span>
          )}
        </div>
        <div className="cr-2d-semaphores">
          <span className="cr-sem-pill empty">
            <small>empty permits:</small> <b>{empty} / 5</b>
          </span>
          <span className="cr-sem-pill full">
            <small>full permits:</small> <b>{full} / 5</b>
          </span>
        </div>
      </div>

      {/* 3 Main Stations Grid */}
      <div className="cr-2d-grid">
        {/* Left: Students Arrival Counter */}
        <section className="cr-2d-section" aria-label="Student Arrival Counter">
          <div className="cr-2d-section-header">
            <h4>1. Students (Producers)</h4>
            <span className="cr-tag-sub">Arriving Orders</span>
          </div>
          <div className="cr-2d-entity-list">
            {students.map((p) => {
              const isSelected = selectedEntityId === p.id;
              const nextOp = PROCESS_INSTRUCTIONS.PRODUCER[p.pc]?.label || 'Completed';
              const isBlocked = p.state === 'BLOCKED';
              const isDone = p.state === 'COMPLETED';

              return (
                <button
                  type="button"
                  key={p.id}
                  className={`cr-2d-entity-card ${isSelected ? 'selected' : ''} ${isBlocked ? 'blocked' : ''} ${isDone ? 'done' : ''}`}
                  onClick={() => onSelectEntity(p.id)}
                  aria-pressed={isSelected}
                >
                  <div className="cr-card-top">
                    <strong>{p.id}</strong>
                    <span className={`cr-status-badge ${p.state.toLowerCase()}`}>{p.state}</span>
                  </div>
                  <div className="cr-card-food">{p.orderId}: {p.foodName}</div>
                  <div className="cr-card-next">
                    <small>Next step:</small> <code>{nextOp}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Center: 5-Slot Shared Bounded Rack */}
        <section className="cr-2d-section rack" aria-label="5-Slot Shared Bounded Order Rack">
          <div className="cr-2d-section-header">
            <h4>2. Shared Order Rack (Bounded Buffer N = 5)</h4>
            <span className="cr-tag-sub">Critical Section</span>
          </div>
          <div className="cr-2d-slots-list">
            {slots.map((item, idx) => {
              const isWrite = writePosition === idx;
              const isRead = readPosition === idx;

              return (
                <div key={idx} className={`cr-2d-slot-row ${item ? 'occupied' : 'empty'}`}>
                  <div className="cr-slot-idx-col">
                    <b>Slot {idx}</b>
                    <div className="cr-slot-pointers">
                      {isWrite && <span className="cr-ptr-badge write">W</span>}
                      {isRead && <span className="cr-ptr-badge read">R</span>}
                    </div>
                  </div>
                  <div className="cr-slot-content-col">
                    {item ? (
                      <div className="cr-occupied-ticket">
                        <strong>{item.id}</strong> · {item.foodName}
                      </div>
                    ) : (
                      <div className="cr-empty-ticket">[ Empty Slot ]</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Kitchen Workstations */}
        <section className="cr-2d-section" aria-label="Kitchen Workstations">
          <div className="cr-2d-section-header">
            <h4>3. Kitchen Workers (Consumers)</h4>
            <span className="cr-tag-sub">Independent Prep</span>
          </div>
          <div className="cr-2d-entity-list">
            {workers.map((w) => {
              const isSelected = selectedEntityId === w.id;
              const isCooking = w.state === 'PREPARING';
              const process = processes.find((p) => p.id === w.id);
              const isBlocked = process?.state === 'BLOCKED';
              const nextOp = isCooking ? 'Cooking on workstation' : (PROCESS_INSTRUCTIONS.CONSUMER[process?.pc]?.label || 'Ready');

              return (
                <button
                  type="button"
                  key={w.id}
                  className={`cr-2d-entity-card chef ${isSelected ? 'selected' : ''} ${isCooking ? 'cooking' : ''} ${isBlocked ? 'blocked' : ''}`}
                  onClick={() => onSelectEntity(w.id)}
                  aria-pressed={isSelected}
                >
                  <div className="cr-card-top">
                    <strong>{w.id} (Chef)</strong>
                    <span className={`cr-status-badge ${isCooking ? 'preparing' : isBlocked ? 'blocked' : 'idle'}`}>
                      {isCooking ? 'COOKING' : isBlocked ? 'BLOCKED' : w.state}
                    </span>
                  </div>
                  {w.assignedOrderId ? (
                    <div className="cr-card-food">Cooking: {w.assignedOrderId} ({w.foodName})</div>
                  ) : (
                    <div className="cr-card-food cr-muted">Awaiting order assignment</div>
                  )}

                  {isCooking && (
                    <div className="cr-2d-prep-box">
                      <div className="cr-prep-bar">
                        <div
                          className="cr-prep-fill"
                          style={{ width: `${Math.round((w.preparationProgress / Math.max(1, w.preparationDuration)) * 100)}%` }}
                        />
                      </div>
                      <small>{w.preparationProgress} / {w.preparationDuration} ticks ({Math.round((w.preparationProgress / Math.max(1, w.preparationDuration)) * 100)}%)</small>
                    </div>
                  )}

                  <div className="cr-card-next">
                    <small>Next step:</small> <code>{nextOp}</code>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom Zone: Pickup Counter */}
      <section className="cr-2d-pickup-area" aria-label="Pickup Counter">
        <div className="cr-2d-pickup-header">
          <h4>4. Ready for Pickup Counter</h4>
          <span className="cr-tag-sub">{readyOrders.length} Ready · {completedOrders.length} Completed</span>
        </div>
        <div className="cr-2d-pickup-cards">
          {readyOrders.length ? (
            readyOrders.map((ro) => (
              <div key={ro.id} className="cr-2d-ready-item">
                <div className="cr-ready-item-details">
                  <b>{ro.id}</b>
                  <span>{ro.foodName}</span>
                </div>
                <button
                  type="button"
                  className="cr-pickup-btn"
                  onClick={() => onPickUpOrder(ro.id)}
                >
                  Pick Up Order
                </button>
              </div>
            ))
          ) : (
            <p className="cr-muted-notice">No orders currently waiting for pickup. Food appears here once cooking reaches 100%.</p>
          )}
        </div>
      </section>
    </div>
  );
}

