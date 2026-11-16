import React from 'react';
import { Html } from '@react-three/drei';

export function PreparationStations({ prepStations = [], completedOrders = [] }) {
  return (
    <group name="PreparationStations">
      {/* Station Zone Title Sign */}
      <Html position={[7.8, 1.8, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: '5px',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textAlign: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}
        >
          KITCHEN PREPARATION AREA (OUTSIDE MUTEX)
        </div>
      </Html>

      {/* Individual Preparation Workstations */}
      {prepStations.map((station) => {
        const [x, y, z] = station.position;
        const isOccupied = station.isOccupied;
        const proc = station.assignedProcess;

        return (
          <group key={station.id} position={[x, 0, z]}>
            {/* Stainless Steel Prep Counter Base */}
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.3, 0.7, 1.3]} />
              <meshStandardMaterial color="#E2E8F0" roughness={0.3} metalness={0.6} />
            </mesh>

            {/* Counter Surface Top Rim */}
            <mesh position={[0, 0.71, 0]}>
              <boxGeometry args={[1.36, 0.03, 1.36]} />
              <meshStandardMaterial color="#94A3B8" roughness={0.2} metalness={0.8} />
            </mesh>

            {/* Cooking Pan / Cutting Board */}
            <mesh position={[0, 0.73, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.38, 0.05, 20]} />
              <meshStandardMaterial
                color={isOccupied ? '#1E293B' : '#64748B'}
                roughness={0.4}
                metalness={0.5}
              />
            </mesh>

            {/* If cooking, show visual dish token in pan */}
            {isOccupied && proc && (
              <mesh position={[0, 0.78, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.25, 0.08, 16]} />
                <meshStandardMaterial color="#F59E0B" roughness={0.5} />
              </mesh>
            )}

            {/* Overhead Station Label and Live Progress Bar */}
            <Html position={[0, 1.35, 0]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: isOccupied ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                  border: `1.5px solid ${isOccupied ? '#D97706' : '#CBD5E1'}`,
                  borderRadius: '6px',
                  padding: '4px 8px',
                  minWidth: '105px',
                  textAlign: 'center',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  {station.name}
                </div>

                {isOccupied && proc ? (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0F172A', marginTop: '1px' }}>
                      {proc.foodName}
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#B45309', fontWeight: 600 }}>
                      Worker {proc.id} · {proc.orderId}
                    </div>

                    {/* Progress Bar Container */}
                    <div
                      style={{
                        background: '#E2E8F0',
                        borderRadius: '3px',
                        height: '5px',
                        width: '100%',
                        marginTop: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          background: '#D97706',
                          height: '100%',
                          width: `${proc.percent}%`,
                          transition: 'width 200ms ease',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '8.5px', color: '#64748B', marginTop: '2px' }}>
                      {proc.progress} / {proc.duration} steps ({proc.percent}%)
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px' }}>
                    Station Free
                  </div>
                )}
              </div>
            </Html>
          </group>
        );
      })}

      {/* -------------------------------------------------------------
          COMPLETED ORDERS PICKUP COUNTER
          ------------------------------------------------------------- */}
      <group position={[8.4, 0, 3.0]}>
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.7, 1.2]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.71, 0]}>
          <boxGeometry args={[2.46, 0.03, 1.26]} />
          <meshStandardMaterial color="#059669" roughness={0.3} metalness={0.5} />
        </mesh>

        <Html position={[0, 1.2, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: '#ECFDF5',
              border: '1.5px solid #10B981',
              borderRadius: '6px',
              padding: '4px 10px',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#065F46' }}>
              READY FOR PICKUP
            </div>
            <div style={{ fontSize: '9px', color: '#059669' }}>
              {completedOrders.length} Completed Total
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
