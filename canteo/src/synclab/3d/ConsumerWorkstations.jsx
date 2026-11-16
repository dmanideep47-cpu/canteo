import React from 'react';
import { Html } from '@react-three/drei';

const TABLE_WIDTH = 1.9;
const TABLE_DEPTH = 1.1;
const TABLE_HEIGHT = 0.65;

export function ConsumerWorkstations({
  workstations = [],
  selectedProcessId = null,
  onSelectProcess = null,
}) {
  if (!workstations || workstations.length === 0) {
    return null;
  }

  return (
    <group name="ConsumerWorkstations">
      {workstations.map((ws) => {
        const [x, y, z] = ws.position;
        const isSelected = selectedProcessId === ws.consumerId;
        const assigned = ws.assignedProcess;
        const isPreparing = ws.isPreparing;
        const isStopping = ws.isStopping;
        const percent = assigned?.percent ?? 0;
        const foodName = assigned?.foodName || 'Meal';
        const orderId = assigned?.orderId || null;

        return (
          <group
            key={ws.id}
            position={[x, 0, z]}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectProcess) onSelectProcess(ws.consumerId);
            }}
          >
            {/* 1. STAINLESS STEEL PREP TABLETOP */}
            <mesh position={[0, TABLE_HEIGHT, 0]} castShadow receiveShadow>
              <boxGeometry args={[TABLE_WIDTH, 0.06, TABLE_DEPTH]} />
              <meshStandardMaterial
                color={isSelected ? '#F8FAFC' : '#E2E8F0'}
                roughness={0.25}
                metalness={0.65}
              />
            </mesh>

            {/* Tabletop Accent Trim */}
            <mesh position={[0, TABLE_HEIGHT + 0.035, 0]}>
              <boxGeometry args={[TABLE_WIDTH + 0.02, 0.01, TABLE_DEPTH + 0.02]} />
              <meshStandardMaterial
                color={isSelected ? '#2563EB' : isPreparing ? '#D97706' : '#94A3B8'}
                roughness={0.4}
              />
            </mesh>

            {/* Selection Base Indicator Ring */}
            {isSelected && (
              <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.1, 1.25, 32]} />
                <meshBasicMaterial color="#3B82F6" />
              </mesh>
            )}

            {/* 2. TABLE LEGS (4 Stainless Cylinders) */}
            {[
              [-TABLE_WIDTH / 2 + 0.08, -TABLE_DEPTH / 2 + 0.08],
              [TABLE_WIDTH / 2 - 0.08, -TABLE_DEPTH / 2 + 0.08],
              [-TABLE_WIDTH / 2 + 0.08, TABLE_DEPTH / 2 - 0.08],
              [TABLE_WIDTH / 2 - 0.08, TABLE_DEPTH / 2 - 0.08],
            ].map(([lx, lz], i) => (
              <mesh key={`leg-${i}`} position={[lx, TABLE_HEIGHT / 2, lz]} castShadow>
                <cylinderGeometry args={[0.03, 0.03, TABLE_HEIGHT, 12]} />
                <meshStandardMaterial color="#64748B" roughness={0.3} metalness={0.8} />
              </mesh>
            ))}

            {/* 3. UNDER-TABLE EQUIPMENT SHELF */}
            <mesh position={[0, TABLE_HEIGHT * 0.35, 0]} receiveShadow>
              <boxGeometry args={[TABLE_WIDTH - 0.1, 0.02, TABLE_DEPTH - 0.1]} />
              <meshStandardMaterial color="#CBD5E1" roughness={0.4} metalness={0.5} />
            </mesh>

            {/* 4. WORKSTATION PROPS (Pan, Cutting Board, Completed Plate) */}
            {/* Cutting Board */}
            <mesh position={[-0.45, TABLE_HEIGHT + 0.045, 0.05]} castShadow>
              <boxGeometry args={[0.55, 0.02, 0.65]} />
              <meshStandardMaterial color="#D4A373" roughness={0.7} />
            </mesh>

            {/* Cooking Pan / Induction Burner */}
            <group position={[0.35, TABLE_HEIGHT + 0.045, 0.05]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.26, 0.28, 0.05, 16]} />
                <meshStandardMaterial
                  color={isPreparing ? '#1E293B' : '#475569'}
                  roughness={0.3}
                  metalness={0.8}
                />
              </mesh>
              {/* Pan Handle */}
              <mesh position={[0.32, 0.02, 0]} rotation={[0, 0, -0.1]}>
                <boxGeometry args={[0.22, 0.025, 0.04]} />
                <meshStandardMaterial color="#0F172A" roughness={0.6} />
              </mesh>
              {/* Sizzle Glow when preparing */}
              {isPreparing && (
                <mesh position={[0, 0.03, 0]}>
                  <cylinderGeometry args={[0.22, 0.22, 0.01, 16]} />
                  <meshBasicMaterial color="#F59E0B" />
                </mesh>
              )}
            </group>

            {/* Completed Dish Holding Tray (Back-right corner) */}
            <mesh position={[0.55, TABLE_HEIGHT + 0.045, -0.32]}>
              <boxGeometry args={[0.42, 0.015, 0.32]} />
              <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.4} />
            </mesh>

            {/* 5. WORKSTATION FRONT IDENTIFICATION PLAQUE */}
            <mesh position={[0, TABLE_HEIGHT - 0.08, TABLE_DEPTH / 2 + 0.01]}>
              <planeGeometry args={[0.7, 0.12]} />
              <meshStandardMaterial color="#0F172A" roughness={0.4} />
            </mesh>

            {/* 6. OVERHEAD WORKSTATION & STATUS BADGE */}
            <Html
              position={[0, TABLE_HEIGHT + 0.85, 0]}
              center
              distanceFactor={11}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {/* Station ID Tag */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isSelected ? '#1E40AF' : '#0F172A',
                    color: '#FFFFFF',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: isPreparing ? '#F59E0B' : isStopping ? '#EF4444' : '#10B981',
                    }}
                  />
                  <span>WORKSTATION {ws.consumerId}</span>
                </div>

                {/* Status Box */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.94)',
                    border: `1.5px solid ${
                      isSelected
                        ? '#2563EB'
                        : isPreparing
                        ? '#F59E0B'
                        : isStopping
                        ? '#EF4444'
                        : '#CBD5E1'
                    }`,
                    borderRadius: '5px',
                    padding: '4px 8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    minWidth: '110px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isPreparing ? (
                    <div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0F172A',
                        }}
                      >
                        {foodName}
                      </div>
                      <div
                        style={{
                          fontSize: '9.5px',
                          color: '#64748B',
                          margin: '1px 0',
                        }}
                      >
                        {orderId ? `Order ${orderId}` : 'Cooking'}
                      </div>

                      {/* Progress Bar */}
                      <div
                        style={{
                          width: '100%',
                          height: '5px',
                          background: '#E2E8F0',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginTop: '3px',
                        }}
                      >
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: '#D97706',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '8.5px',
                          fontWeight: 700,
                          color: '#B45309',
                          marginTop: '2px',
                        }}
                      >
                        {percent}% Prepared
                      </div>
                    </div>
                  ) : isStopping ? (
                    <div
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        color: '#B91C1C',
                      }}
                    >
                      Stopping after dish
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 600,
                        color: '#64748B',
                      }}
                    >
                      {ws.statusText}
                    </div>
                  )}
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
