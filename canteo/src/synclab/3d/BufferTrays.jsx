import React from 'react';
import { Html } from '@react-three/drei';

const TRAY_WIDTH = 1.35;
const TRAY_DEPTH = 1.6;
const TRAY_HEIGHT = 0.12;

export function BufferTrays({ slots = [], onSelectSlot = null }) {
  return (
    <group name="BufferTrays">
      {/* Central Countertop Foundation (Long marble/wood counter supporting all 5 trays) */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[8.8, 0.1, 2.2]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Counter Base plinth */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[8.9, 0.04, 2.3]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.7} />
      </mesh>

      {/* 5 Individual Shallow Buffer Trays */}
      {slots.map((slot) => {
        const [x, y, z] = slot.position;
        const isOccupied = slot.isOccupied;
        const isWrite = slot.isWritePointer;
        const isRead = slot.isReadPointer;
        const isSelected = slot.isSelected;
        const item = slot.item;

        return (
          <group
            key={`tray-slot-${slot.index}`}
            position={[x, y, z]}
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectSlot) onSelectSlot(slot.index, item);
            }}
          >
            {/* Shallow Tray Basin */}
            <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
              <boxGeometry args={[TRAY_WIDTH, TRAY_HEIGHT, TRAY_DEPTH]} />
              <meshStandardMaterial
                color={isSelected ? '#F8FAFC' : '#F1F5F9'}
                roughness={0.5}
                metalness={0.1}
              />
            </mesh>

            {/* Tray Rim / Frame */}
            <mesh position={[0, 0.10, 0]}>
              <boxGeometry args={[TRAY_WIDTH + 0.04, 0.02, TRAY_DEPTH + 0.04]} />
              <meshStandardMaterial
                color={isSelected ? '#2563EB' : isOccupied ? '#94A3B8' : '#CBD5E1'}
                roughness={0.4}
                metalness={0.2}
              />
            </mesh>

            {/* Selection Highlight Ring */}
            {isSelected && (
              <mesh position={[0, 0.11, 0]}>
                <boxGeometry args={[TRAY_WIDTH + 0.08, 0.01, TRAY_DEPTH + 0.08]} />
                <meshStandardMaterial color="#3B82F6" emissive="#3B82F6" emissiveIntensity={0.5} />
              </mesh>
            )}

            {/* Front Slot Number Label (Architectural Metal Plaque) */}
            <mesh position={[0, 0.04, TRAY_DEPTH / 2 + 0.015]}>
              <planeGeometry args={[0.42, 0.16]} />
              <meshStandardMaterial color="#1E293B" roughness={0.4} />
            </mesh>

            {/* 3D Ticket / Parcel inside tray if occupied */}
            {isOccupied && item && (
              <group position={[0, 0.12, 0]}>
                {/* Physical Ticket Parcel Base */}
                <mesh castShadow position={[0, 0.08, 0]}>
                  <boxGeometry args={[0.95, 0.12, 1.1]} />
                  <meshStandardMaterial color="#FFFFFF" roughness={0.3} metalness={0.05} />
                </mesh>

                {/* Decorative Dish Accent Stripe */}
                <mesh position={[0, 0.145, -0.42]}>
                  <boxGeometry args={[0.95, 0.01, 0.12]} />
                  <meshStandardMaterial color="#D97706" roughness={0.5} />
                </mesh>

                {/* Stylized Miniature Meal Dish Cylinder */}
                <mesh position={[0, 0.16, 0.1]} castShadow>
                  <cylinderGeometry args={[0.26, 0.28, 0.08, 16]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.4} />
                </mesh>
              </group>
            )}

            {/* Overhead HTML Labels: Pointer Badges and Slot Status */}
            <Html position={[0, 0.45, 0]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {/* Pointer Indicators (W / R) */}
                <div style={{ display: 'flex', gap: '3px' }}>
                  {isWrite && (
                    <span
                      style={{
                        background: '#059669',
                        color: '#FFFFFF',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      }}
                      title="Write Pointer (Next slot to write)"
                    >
                      WRITE
                    </span>
                  )}
                  {isRead && (
                    <span
                      style={{
                        background: '#D97706',
                        color: '#FFFFFF',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      }}
                      title="Read Pointer (Next slot to remove)"
                    >
                      READ
                    </span>
                  )}
                </div>

                {/* Slot Tag & Content Badge */}
                <div
                  style={{
                    background: isOccupied ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
                    border: `1.5px solid ${isSelected ? '#2563EB' : isOccupied ? '#0F172A' : '#CBD5E1'}`,
                    borderRadius: '5px',
                    padding: '3px 7px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    textAlign: 'center',
                    minWidth: '82px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isOccupied ? '#0F172A' : '#64748B',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Bay [{slot.index}]
                  </div>

                  {isOccupied && item ? (
                    <>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: '1px 0',
                        }}
                      >
                        {item.id}
                      </div>
                      <div
                        style={{
                          fontSize: '9.5px',
                          color: '#475569',
                          maxWidth: '90px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.foodName}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        fontSize: '9px',
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Empty
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
