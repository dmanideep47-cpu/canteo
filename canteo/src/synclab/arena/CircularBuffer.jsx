import React from 'react';

const CAPACITY = 5;
const RADIUS = 175;
const CENTER_X = 300;
const CENTER_Y = 255;

export function CircularBuffer({
  state,
  raceMode = false,
  raceState = null,
  activeProcessId = null,
  selectedSlotIndex = null,
  onSelectSlot = null,
  onOpenHubInspector = null,
}) {
  const occupancy = raceMode
    ? (raceState?.buffer?.filter(Boolean)?.length ?? 0)
    : (typeof state?.occupancy === 'number'
      ? state.occupancy
      : (state?.slots?.filter(Boolean)?.length ?? 0));

  const writePos = raceMode
    ? (raceState?.writePosition ?? 0)
    : (state?.writePosition ?? state?.buffer?.writePosition ?? 0);

  const readPos = raceMode
    ? (raceState?.readPosition ?? 0)
    : (state?.readPosition ?? state?.buffer?.readPosition ?? 0);

  const mutexOwner = raceMode
    ? (raceState?.mutexOwner ?? null)
    : (state?.mutexOwner ?? (state?.mutex === 0 ? state?.lastScheduledId : null) ?? null);

  const slots = raceMode
    ? (raceState?.buffer ?? Array(5).fill(null))
    : (state?.slots ?? state?.buffer?.slots ?? Array(5).fill(null));

  // 5 evenly spaced coordinates around circle: 0 at top (-90 deg), clockwise
  const slotCoords = Array.from({ length: CAPACITY }, (_, i) => {
    const angleRad = (i * (2 * Math.PI / CAPACITY)) - (Math.PI / 2);
    const x = Math.round(CENTER_X + RADIUS * Math.cos(angleRad));
    const y = Math.round(CENTER_Y + RADIUS * Math.sin(angleRad));
    return { x, y, angleRad, index: i };
  });

  return (
    <div className="arena-counter-wrapper">
      <svg
        className="arena-counter-svg"
        viewBox="0 0 600 530"
        aria-label="Circular Shared Buffer Counter"
      >
        {/* Subtle, quiet circular track */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="1.5"
        />

        {/* ============================================================== */}
        {/* FIVE BUFFER POSITIONS                                         */}
        {/* ============================================================== */}
        {slotCoords.map((coord, i) => {
          const slot = slots[i];
          const isOccupied = Boolean(slot);
          const isWrite = writePos === i;
          const isRead = readPos === i;
          const isSelected = selectedSlotIndex === i;
          const isOverwritten = raceMode && raceState?.overwritten?.includes(i);

          // Pointer position: cleanly positioned outside the circular track
          const pointerRadialOffset = 58;
          const ptrOffsetX = Math.round(pointerRadialOffset * Math.cos(coord.angleRad));
          const ptrOffsetY = Math.round(pointerRadialOffset * Math.sin(coord.angleRad));

          return (
            <g
              key={`slot-${i}`}
              className={`arena-slot-node ${isOccupied ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}`}
              transform={`translate(${coord.x}, ${coord.y})`}
              onClick={() => onSelectSlot && onSelectSlot(i, slot)}
              style={{ cursor: 'pointer' }}
            >
              {/* Outer Selection Ring */}
              {isSelected && (
                <circle
                  r="46"
                  fill="none"
                  stroke="#09090B"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}

              {/* Main Slot Circle */}
              <circle
                r="38"
                fill={isOverwritten ? "#FEF2F2" : isOccupied ? "#18181B" : "#FAFAFA"}
                stroke={isOverwritten ? "#DC2626" : isOccupied ? "#27272A" : "#E4E4E7"}
                strokeWidth="1.5"
              />

              {/* Slot Index Badge */}
              <text
                x="0"
                y="-15"
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
                fontWeight="600"
                fill={isOverwritten ? "#DC2626" : isOccupied ? "#A1A1AA" : "#71717A"}
              >
                [{i}]
              </text>

              {/* Content label */}
              {isOverwritten ? (
                <g>
                  <text x="0" y="2" textAnchor="middle" fontSize="11" fontWeight="700" fill="#DC2626">
                    OVERWRITE
                  </text>
                  <text x="0" y="16" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono, monospace)" fill="#DC2626">
                    Order lost
                  </text>
                </g>
              ) : isOccupied ? (
                <g>
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fontFamily="var(--font-mono, monospace)"
                    fill="#FAFAFA"
                  >
                    {slot.id ?? slot.orderId ?? `ORD #${100 + i}`}
                  </text>
                  <text
                    x="0"
                    y="18"
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="500"
                    fill="#A1A1AA"
                  >
                    {slot.foodName ?? slot.itemName ?? slot.label ?? 'Order'}
                  </text>
                </g>
              ) : (
                <text
                  x="0"
                  y="7"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="500"
                  letterSpacing="0.02em"
                  fill="#71717A"
                >
                  Empty
                </text>
              )}

              {/* Labeled Pointers attached to physical slot (Radial Placement) */}
              {isWrite && isRead ? (
                <g transform={`translate(${ptrOffsetX}, ${ptrOffsetY})`}>
                  <rect x="-56" y="-11" width="112" height="22" rx="6" fill="#18181B" stroke="#3F3F46" strokeWidth="1" />
                  <circle cx="-42" cy="0" r="3" fill="#60A5FA" />
                  <circle cx="-33" cy="0" r="3" fill="#4ADE80" />
                  <text x="7" y="4" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono, monospace)" fill="#FAFAFA">
                    IN · OUT [{i}]
                  </text>
                </g>
              ) : isWrite ? (
                <g transform={`translate(${ptrOffsetX}, ${ptrOffsetY})`}>
                  <rect x="-48" y="-11" width="96" height="22" rx="6" fill="#18181B" stroke="#2563EB" strokeWidth="1" />
                  <circle cx="-34" cy="0" r="3" fill="#60A5FA" />
                  <text x="6" y="4" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono, monospace)" fill="#93C5FD">
                    IN: write [{i}]
                  </text>
                </g>
              ) : isRead ? (
                <g transform={`translate(${ptrOffsetX}, ${ptrOffsetY})`}>
                  <rect x="-48" y="-11" width="96" height="22" rx="6" fill="#18181B" stroke="#16A34A" strokeWidth="1" />
                  <circle cx="-34" cy="0" r="3" fill="#4ADE80" />
                  <text x="6" y="4" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono, monospace)" fill="#86EFAC">
                    OUT: read [{i}]
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* RESTRAINED CENTER STATUS HUB                                   */}
        {/* ============================================================== */}
        <g
          className="arena-center-hub"
          transform={`translate(${CENTER_X}, ${CENTER_Y})`}
          onClick={onOpenHubInspector}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          aria-label="Inspect Shared Buffer Semaphores"
        >
          {/* Main Disc (diameter 124px) */}
          <circle
            r="62"
            fill="#18181B"
            stroke="#27272A"
            strokeWidth="1.5"
          />

          {/* Large Occupancy Value: e.g. "2 / 5" */}
          <text
            x="0"
            y="-10"
            textAnchor="middle"
            fontSize="26"
            fontWeight="700"
            fontFamily="var(--font-mono, monospace)"
            fill="#FAFAFA"
          >
            {occupancy} / {CAPACITY}
          </text>

          {/* Subtitle: "occupied" */}
          <text
            x="0"
            y="9"
            textAnchor="middle"
            fontSize="12"
            fontWeight="400"
            fill="#A1A1AA"
          >
            occupied
          </text>

          {/* Mutex Ownership Line */}
          {raceMode && !raceState?.protected ? (
            <g transform="translate(0, 30)">
              <circle cx="-42" cy="-4" r="3" fill="#EF4444" />
              <text x="-34" y="0" textAnchor="start" fontSize="11" fontWeight="600" fill="#EF4444">
                Mutex Disabled
              </text>
            </g>
          ) : mutexOwner ? (
            <g transform="translate(0, 30)">
              <circle cx="-38" cy="-4" r="3" fill="#C084FC" />
              <text x="-30" y="0" textAnchor="start" fontSize="11" fontWeight="500" fill="#D8B4FE">
                Held by {mutexOwner}
              </text>
            </g>
          ) : (
            <g transform="translate(0, 30)">
              <circle cx="-32" cy="-4" r="3" fill="#4ADE80" />
              <text x="-24" y="0" textAnchor="start" fontSize="11" fontWeight="500" fill="#D4D4D8">
                Unlocked
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
