import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Single Process Token with smooth spatial interpolation
function ProcessTokenMesh({ token, onSelectProcess = null }) {
  const meshRef = useRef();
  const [targetX, targetY, targetZ] = token.position;
  const isProducer = token.type === 'PRODUCER';
  const isMutexOwner = token.isMutexOwner;
  const isSelected = token.isSelected;
  const isAtWorkstation = token.zone === 'WORKSTATION';

  // Primary semantic colors: Emerald for students, Amber for kitchen workers
  const primaryColor = isProducer ? '#059669' : '#D97706';
  const bodyColor = isProducer ? '#E6F4EA' : '#FEF3C7';
  const trimColor = isProducer ? '#047857' : '#B45309';

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // Smooth lerp towards authoritative target position
    const lerpSpeed = 12.0;
    meshRef.current.position.x = THREE.MathUtils.damp(meshRef.current.position.x, targetX, lerpSpeed, delta);
    meshRef.current.position.y = THREE.MathUtils.damp(meshRef.current.position.y, targetY, lerpSpeed, delta);
    meshRef.current.position.z = THREE.MathUtils.damp(meshRef.current.position.z, targetZ, lerpSpeed, delta);
  });

  return (
    <group
      ref={meshRef}
      position={[targetX, targetY, targetZ]}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelectProcess) onSelectProcess(token.id);
      }}
    >
      {/* Selection Base Ring */}
      {isSelected && (
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.04, 24]} />
          <meshStandardMaterial color="#2563EB" emissive="#3B82F6" emissiveIntensity={0.6} />
        </mesh>
      )}

      {/* Mutex Owner Beacon Ring (pulsing gold/emerald ring when accessing counter) */}
      {isMutexOwner && (
        <mesh position={[0, -0.21, 0]}>
          <cylinderGeometry args={[0.52, 0.52, 0.03, 24]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.8} />
        </mesh>
      )}

      {/* Main Token Body: Cylinder for Student Producer, Hex Prism for Kitchen Worker */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        {isProducer ? (
          <cylinderGeometry args={[0.30, 0.36, 0.52, 24]} />
        ) : (
          <cylinderGeometry args={[0.30, 0.36, 0.52, 6]} />
        )}
        <meshStandardMaterial
          color={isSelected ? '#EFF6FF' : bodyColor}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Base Accent Ring */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.37, 0.39, 0.08, isProducer ? 24 : 6]} />
        <meshStandardMaterial color={trimColor} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Top Cap with Collar Disc */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.04, isProducer ? 24 : 6]} />
        <meshStandardMaterial color={primaryColor} roughness={0.2} metalness={0.3} />
      </mesh>

      {/* Chef Hat / Student Head */}
      <mesh position={[0, 0.40, 0]} castShadow>
        {isProducer ? (
          <sphereGeometry args={[0.13, 16, 16]} />
        ) : (
          <cylinderGeometry args={[0.14, 0.12, 0.16, 12]} />
        )}
        <meshStandardMaterial color="#F8FAFC" roughness={0.3} />
      </mesh>

      {/* Overhead Process Badge (ID & Status Tag) - shown when token is mobile or accessing counter */}
      {(!isAtWorkstation || isSelected) && (
        <Html position={[0, 0.85, 0]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Main ID Pill */}
            <div
              style={{
                background: isSelected ? '#1D4ED8' : primaryColor,
                color: '#FFFFFF',
                borderRadius: '12px',
                padding: '2px 9px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{token.id}</span>
              <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 600 }}>
                {isProducer ? 'Student' : 'Kitchen'}
              </span>
            </div>

            {/* Status Label Tag */}
            <div
              style={{
                background: '#FFFFFF',
                border: `1px solid ${isSelected ? '#3B82F6' : '#CBD5E1'}`,
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '8.5px',
                fontWeight: 600,
                color: isMutexOwner ? '#065F46' : '#334155',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {token.stateLabel}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export function ProcessTokens({ tokens = [], onSelectProcess = null }) {
  return (
    <group name="ProcessTokens">
      {tokens.map((token) => (
        <ProcessTokenMesh
          key={`token-${token.id}`}
          token={token}
          onSelectProcess={onSelectProcess}
        />
      ))}
    </group>
  );
}
