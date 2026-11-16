import React from 'react';
import { Html } from '@react-three/drei';

// Restrained architectural palette
const ARCH_COLORS = {
  kitchenFloor: '#F8FAFC',
  kitchenGrid: '#E2E8F0',
  terraceFloor: '#ECEFF1',
  terraceBorder: '#CBD5E1',
  wallFace: '#FFFFFF',
  wallTrim: '#1E293B',
  wallBase: '#CBD5E1',
  hatchLintel: '#334155',
  counterMarble: '#E2E8F0',
  mutexUnlocked: '#10B981',
  mutexLocked: '#EF4444',
  textPrimary: '#0F172A',
  textMuted: '#64748B',
};

export function SimulationRoom({
  room = {
    width: 13,
    interiorDepth: 5.5,
    terraceDepth: 5.2,
    wallHeight: 0.95,
    wallThickness: 0.15,
    hatchWidth: 8.0,
    backWallZ: -5.5,
  },
  counterAccess = {
    isLocked: false,
    ownerId: null,
    ownerType: null,
    label: 'Counter Free (Mutex Available)',
  },
}) {
  const { width, interiorDepth, terraceDepth, wallHeight, wallThickness, hatchWidth, backWallZ } = room;
  const isLocked = counterAccess.isLocked;
  const ownerId = counterAccess.ownerId;
  const ownerType = counterAccess.ownerType;

  // Front wall segments flanking the service hatch
  const sideWallLen = Math.max(0.5, (width - hatchWidth) / 2);
  const leftWallCenterX = -width / 2 + sideWallLen / 2;
  const rightWallCenterX = width / 2 - sideWallLen / 2;

  return (
    <group name="SimulationRoom">
      {/* 1. KITCHEN INTERIOR FLOOR (Z <= 0) */}
      <mesh
        position={[0, -0.01, -interiorDepth / 2]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, interiorDepth]} />
        <meshStandardMaterial
          color={ARCH_COLORS.kitchenFloor}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* Interior Floor Accent Border */}
      <mesh position={[0, 0.002, -interiorDepth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.08, interiorDepth - 0.08]} />
        <meshBasicMaterial color={ARCH_COLORS.kitchenFloor} />
      </mesh>

      {/* 2. OUTSIDE TERRACE / PATIO FLOOR (Z >= 0) */}
      <mesh
        position={[0, -0.015, terraceDepth / 2]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width + 4.0, terraceDepth + 1.0]} />
        <meshStandardMaterial
          color={ARCH_COLORS.terraceFloor}
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>

      {/* Outside Patio Subtle Walkway Markings */}
      <mesh
        position={[0, -0.012, 2.5]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width + 2.0, 1.4]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>

      {/* 3. PERIMETER WALLS (Low Cutaway for Clean Sightlines) */}
      {/* North Wall (Kitchen Back Wall) */}
      <group position={[0, wallHeight / 2, backWallZ]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, wallHeight, wallThickness]} />
          <meshStandardMaterial color={ARCH_COLORS.wallFace} roughness={0.6} />
        </mesh>
        <mesh position={[0, wallHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[width + 0.04, 0.04, wallThickness + 0.04]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.5} />
        </mesh>
      </group>

      {/* West Wall (Kitchen Left Side) */}
      <group position={[-width / 2, wallHeight / 2, -interiorDepth / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[wallThickness, wallHeight, interiorDepth]} />
          <meshStandardMaterial color={ARCH_COLORS.wallFace} roughness={0.6} />
        </mesh>
        <mesh position={[0, wallHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[wallThickness + 0.04, 0.04, interiorDepth + 0.04]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.5} />
        </mesh>
      </group>

      {/* East Wall (Kitchen Right Side) */}
      <group position={[width / 2, wallHeight / 2, -interiorDepth / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[wallThickness, wallHeight, interiorDepth]} />
          <meshStandardMaterial color={ARCH_COLORS.wallFace} roughness={0.6} />
        </mesh>
        <mesh position={[0, wallHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[wallThickness + 0.04, 0.04, interiorDepth + 0.04]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.5} />
        </mesh>
      </group>

      {/* Front Wall (Z = 0) with Service Hatch Opening */}
      {/* Left Front Wall Segment */}
      <group position={[leftWallCenterX, wallHeight / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[sideWallLen, wallHeight, wallThickness]} />
          <meshStandardMaterial color={ARCH_COLORS.wallFace} roughness={0.6} />
        </mesh>
        <mesh position={[0, wallHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[sideWallLen + 0.02, 0.04, wallThickness + 0.04]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.5} />
        </mesh>
      </group>

      {/* Right Front Wall Segment */}
      <group position={[rightWallCenterX, wallHeight / 2, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[sideWallLen, wallHeight, wallThickness]} />
          <meshStandardMaterial color={ARCH_COLORS.wallFace} roughness={0.6} />
        </mesh>
        <mesh position={[0, wallHeight / 2 + 0.02, 0]}>
          <boxGeometry args={[sideWallLen + 0.02, 0.04, wallThickness + 0.04]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.5} />
        </mesh>
      </group>

      {/* Service Hatch Lintel Arch (Spanning Above the 5-slot counter) */}
      <group position={[0, 1.45, 0]}>
        <mesh castShadow>
          <boxGeometry args={[hatchWidth + 0.2, 0.18, wallThickness + 0.08]} />
          <meshStandardMaterial color={ARCH_COLORS.hatchLintel} roughness={0.4} />
        </mesh>

        {/* Lintel Label Plate */}
        <Html position={[0, 0.16, 0.12]} center distanceFactor={13} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: '#0F172A',
              color: '#F8FAFC',
              padding: '2px 10px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              border: '1px solid #334155',
            }}
          >
            SERVICE HATCH · BOUNDED BUFFER (N = 5)
          </div>
        </Html>
      </group>

      {/* Hatch Side Pillars */}
      <group position={[-hatchWidth / 2, 0.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 1.4, wallThickness + 0.08]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.4} />
        </mesh>
      </group>
      <group position={[hatchWidth / 2, 0.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 1.4, wallThickness + 0.08]} />
          <meshStandardMaterial color={ARCH_COLORS.wallTrim} roughness={0.4} />
        </mesh>
      </group>

      {/* 4. MUTEX COUNTER ACCESS BEACON & INDICATOR */}
      <group position={[0, 1.15, 0]}>
        {/* Luminous LED Spheres */}
        <mesh position={[-0.45, 0, 0.1]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color={isLocked ? ARCH_COLORS.mutexLocked : ARCH_COLORS.mutexUnlocked} />
        </mesh>
        <mesh position={[0.45, 0, 0.1]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color={isLocked ? ARCH_COLORS.mutexLocked : ARCH_COLORS.mutexUnlocked} />
        </mesh>

        {/* Dynamic Overhead Mutex Status Banner */}
        <Html position={[0, 0.02, 0.12]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isLocked ? '#FEF2F2' : '#F0FDF4',
              border: `1.5px solid ${isLocked ? ARCH_COLORS.mutexLocked : ARCH_COLORS.mutexUnlocked}`,
              borderRadius: '20px',
              padding: '2px 8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isLocked ? ARCH_COLORS.mutexLocked : ARCH_COLORS.mutexUnlocked,
                boxShadow: `0 0 6px ${isLocked ? ARCH_COLORS.mutexLocked : ARCH_COLORS.mutexUnlocked}`,
              }}
            />
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: isLocked ? '#991B1B' : '#065F46',
                letterSpacing: '0.02em',
              }}
            >
              {isLocked
                ? (ownerType === 'PRODUCER'
                    ? `Counter Access: Student ${ownerId} (Writing)`
                    : `Counter Access: Kitchen ${ownerId} (Reading)`)
                : 'Counter Free (Mutex Available)'}
            </span>
          </div>
        </Html>
      </group>

      {/* Outside Patio Orientation Signs */}
      <Html position={[-4.5, 0.15, 4.2]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 600,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Student Order Lineup (Outside)
        </div>
      </Html>

      <Html position={[4.5, 0.15, 3.8]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '9px',
            fontWeight: 600,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Exit Route (Outside) ──►
        </div>
      </Html>
    </group>
  );
}


