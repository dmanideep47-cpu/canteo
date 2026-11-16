import React from 'react';
import { Html } from '@react-three/drei';

export function WaitingAreas({
  waitingSummary = { capacityWaiters: [], orderWaiters: [], mutexWaiters: [] },
  room = { width: 13, terraceDepth: 5.2 },
}) {
  const { capacityWaiters = [], mutexWaiters = [] } = waitingSummary;

  return (
    <group name="WaitingAreas">
      {/* -------------------------------------------------------------
          1. OUTSIDE CAPACITY WAITING ZONE (sem_wait(&empty))
          Located on the outside terrace to the left of the service hatch
          ------------------------------------------------------------- */}
      <group position={[-5.8, 0.003, 3.6]}>
        {/* Floor Pad */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.8, 2.2]} />
          <meshStandardMaterial
            color={capacityWaiters.length > 0 ? '#FEF3C7' : '#F1F5F9'}
            roughness={0.8}
          />
        </mesh>
        {/* Perimeter Frame */}
        <mesh position={[0, 0.005, 0]}>
          <boxGeometry args={[3.84, 0.01, 2.24]} />
          <meshStandardMaterial
            color={capacityWaiters.length > 0 ? '#D97706' : '#CBD5E1'}
          />
        </mesh>

        {/* Overhead Capacity Signpost */}
        <Html position={[0, 1.25, 0]} center distanceFactor={13} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: capacityWaiters.length > 0 ? '#FFFBEB' : '#FFFFFF',
              border: `1.5px solid ${capacityWaiters.length > 0 ? '#F59E0B' : '#CBD5E1'}`,
              borderRadius: '6px',
              padding: '3px 9px',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: capacityWaiters.length > 0 ? '#92400E' : '#475569',
              }}
            >
              OUTSIDE CAPACITY WAIT
            </div>
            <div
              style={{
                fontSize: '9px',
                color: capacityWaiters.length > 0 ? '#B45309' : '#64748B',
                marginTop: '1px',
              }}
            >
              sem_wait(&empty) · {capacityWaiters.length} students blocked
            </div>
          </div>
        </Html>
      </group>

      {/* -------------------------------------------------------------
          2. OUTSIDE ORDER QUEUE (Leading to Service Hatch)
          Center-left runway in front of the counter
          ------------------------------------------------------------- */}
      <group position={[-2.2, 0.003, 2.2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3.6, 1.2]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.85} />
        </mesh>

        {/* Floor Guidance Lines */}
        <mesh position={[0, 0.005, -0.6]}>
          <boxGeometry args={[3.6, 0.01, 0.03]} />
          <meshStandardMaterial color="#94A3B8" />
        </mesh>
        <mesh position={[0, 0.005, 0.6]}>
          <boxGeometry args={[3.6, 0.01, 0.03]} />
          <meshStandardMaterial color="#94A3B8" />
        </mesh>

        <Html position={[0, 1.15, 0]} center distanceFactor={13} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#334155',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            Student Queue ──► Service Hatch
          </div>
        </Html>
      </group>

      {/* -------------------------------------------------------------
          3. INSIDE CONSUMER COLLECTION AISLE (Behind Counter)
          Kitchen workers step here to collect orders from the 5 slots
          ------------------------------------------------------------- */}
      <group position={[0, 0.002, -1.2]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[8.8, 0.9]} />
          <meshStandardMaterial color="#F1F5F9" roughness={0.7} />
        </mesh>

        {/* Boundary Floor Marking */}
        <mesh position={[0, 0.004, -0.45]}>
          <boxGeometry args={[8.8, 0.008, 0.02]} />
          <meshStandardMaterial color="#CBD5E1" />
        </mesh>
      </group>
    </group>
  );
}
