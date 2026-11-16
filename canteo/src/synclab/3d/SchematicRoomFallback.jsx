import React from 'react';

export function SchematicRoomFallback({
  scene = null,
  onSelectSlot = null,
  onSelectProcess = null,
}) {
  if (!scene) return null;

  const {
    slots = [],
    counterAccess = {},
    workstations = [],
    tokens = [],
    waitingSummary = {},
    counts = {},
  } = scene;

  const isLocked = counterAccess.isLocked;
  const ownerId = counterAccess.ownerId;
  const ownerType = counterAccess.ownerType;

  const outsideProducers = tokens.filter((t) => t.type === 'PRODUCER');
  const insideConsumers = tokens.filter((t) => t.type === 'CONSUMER');

  return (
    <div
      className="schematic-room-container"
      role="region"
      aria-label="2D Schematic Spatial View"
      style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '20px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            2D Architectural Schematic
          </span>
          <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
            Canteen Kitchen & Service Hatch · Corrected Spatial Model
          </h3>
        </div>
        <div
          style={{
            background: isLocked ? '#FEF2F2' : '#ECFDF5',
            border: `1.5px solid ${isLocked ? '#EF4444' : '#10B981'}`,
            color: isLocked ? '#991B1B' : '#065F46',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isLocked ? '#EF4444' : '#10B981',
            }}
          />
          <span>{counterAccess.label}</span>
        </div>
      </div>

      {/* 1. TOP: INSIDE KITCHEN INTERIOR (Dynamic Consumer Workstations) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #0F172A',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Inside Kitchen Interior · {workstations.length} Consumer Workstations
          </div>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            Workers remain inside · Prepare food concurrently outside mutex
          </span>
        </div>

        {workstations.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
            0 Consumer Workstations (Add kitchen workers using controls above)
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))`,
              gap: '12px',
            }}
          >
            {workstations.map((ws) => {
              const assigned = ws.assignedProcess;
              const isPreparing = ws.isPreparing;
              const isStopping = ws.isStopping;

              return (
                <div
                  key={ws.id}
                  onClick={() => onSelectProcess && onSelectProcess(ws.consumerId)}
                  style={{
                    background: isPreparing ? '#FFFBEB' : '#F8FAFC',
                    border: `1.5px solid ${isPreparing ? '#F59E0B' : isStopping ? '#EF4444' : '#E2E8F0'}`,
                    borderRadius: '6px',
                    padding: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '11px', color: '#0F172A' }}>Workstation {ws.consumerId}</strong>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: isPreparing ? '#D97706' : '#94A3B8',
                        color: '#FFFFFF',
                      }}
                    >
                      {isPreparing ? `${assigned?.percent ?? 0}%` : 'Idle'}
                    </span>
                  </div>

                  <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#334155' }}>
                    {isPreparing ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{assigned?.foodName || 'Dish'}</div>
                        <div
                          style={{
                            width: '100%',
                            height: '4px',
                            background: '#E2E8F0',
                            borderRadius: '2px',
                            marginTop: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${assigned?.percent ?? 0}%`,
                              height: '100%',
                              background: '#D97706',
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#64748B', fontSize: '10px' }}>{ws.statusText}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. MIDDLE: SHARED 5-SLOT COUNTER AT SERVICE HATCH */}
      <div
        style={{
          background: '#F1F5F9',
          border: '2px solid #334155',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Service Hatch Boundary · Shared Order Queue (Capacity N = 5)
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569' }}>
            {counts.occupiedSlots ?? 0} / 5 slots occupied
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
          }}
        >
          {slots.map((slot) => {
            const isOccupied = slot.isOccupied;
            const isWrite = slot.isWritePointer;
            const isRead = slot.isReadPointer;
            const isSelected = slot.isSelected;
            const item = slot.item;

            return (
              <div
                key={`schem-slot-${slot.index}`}
                onClick={() => onSelectSlot && onSelectSlot(slot.index, item)}
                style={{
                  background: isOccupied ? '#FEF3C7' : '#FFFFFF',
                  border: `2px solid ${
                    isSelected ? '#2563EB' : isOccupied ? '#D97706' : '#CBD5E1'
                  }`,
                  borderRadius: '6px',
                  padding: '8px 6px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B' }}>
                  Bay [{slot.index}]
                </div>

                <div style={{ margin: '4px 0', minHeight: '28px' }}>
                  {isOccupied && item ? (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
                        {item.id}
                      </div>
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#475569',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.foodName}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '9px', color: '#CBD5E1', textTransform: 'uppercase' }}>
                      Empty
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '3px' }}>
                  {isWrite && (
                    <span
                      style={{
                        background: '#059669',
                        color: '#FFFFFF',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '8.5px',
                        fontWeight: 800,
                      }}
                    >
                      WRITE
                    </span>
                  )}
                  {isRead && (
                    <span
                      style={{
                        background: '#D97706',
                        color: '#FFFFFF',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '8.5px',
                        fontWeight: 800,
                      }}
                    >
                      READ
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. BOTTOM: OUTSIDE STUDENT TERRACE */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '14px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
          Outside Student Terrace · Order Submission & Exit Route
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Left: Queue & Capacity Waiters */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Students Waiting ({outsideProducers.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
              {outsideProducers.length === 0 ? (
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>0 active student producers</span>
              ) : (
                outsideProducers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectProcess && onSelectProcess(t.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: t.isMutexOwner ? '#ECFDF5' : '#FFFFFF',
                      border: `1px solid ${t.isMutexOwner ? '#059669' : '#CBD5E1'}`,
                      borderRadius: '4px',
                      padding: '3px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{t.id}</strong>
                    <span style={{ fontSize: '9px', color: '#475569' }}>{t.stateLabel}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Architectural Semantics Summary */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Key Invariants
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>
              <li><strong>Queue Capacity:</strong> Strictly 5 slots at service hatch.</li>
              <li><strong>Producers:</strong> Stay outside, submit through hatch, exit right.</li>
              <li><strong>Consumers:</strong> Work inside at dedicated workstations.</li>
              <li><strong>Mutex Lock:</strong> Serializes service counter access only.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
