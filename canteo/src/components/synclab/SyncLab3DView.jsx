import { useRef, useEffect, Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';

// WebGL Error Boundary with clean light styling
class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF7F2] text-[#263843] p-6 text-center font-sans text-xs space-y-2">
          <p className="text-[#B43D3D] font-bold">3D canvas unavailable on this device.</p>
          <p className="text-[#62747C]">Showing 2D schematic fallback.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * CALIBRATED 3D APPARATUS GEOMETRY CONSTANTS
 * Stage 1B: High-clarity static canteen models
 * Camera position: [0.3, 2.1, 5.2] looking at [0, 0.75, 0] with FOV 25.5°
 */
const SLOT_X_POSITIONS = [-0.88, -0.44, 0.0, 0.44, 0.88];
const CAMERA_DEFAULT_POS = [0.3, 2.1, 5.2];
const CAMERA_DEFAULT_TARGET = [0, 0.75, 0];
const CAMERA_DEFAULT_FOV = 25.5;

/**
 * Physical Order Ticket Paper (Clamped in Holder)
 */
function OrderTicketCard({ item, slotIndex, isSelected, onClick }) {
  const orderId = item?.id || `ORD-${100 + slotIndex}`;
  const itemCount = item?.items?.length || 1;
  const isPriority = item?.isPriority || false;

  return (
    <group position={[0, 0.28, 0]}>
      {/* Paper Card */}
      <mesh
        position={[0, 0, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <boxGeometry args={[0.30, 0.36, 0.016]} />
        <meshStandardMaterial
          color={isSelected ? '#FFFDF5' : '#FFFFFF'}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>

      {/* Ticket Header Red / Terracotta Stripe */}
      <mesh position={[0, 0.155, 0.009]}>
        <planeGeometry args={[0.28, 0.03]} />
        <meshBasicMaterial color={isPriority ? '#B43D3D' : '#A94D36'} />
      </mesh>

      {/* Printed text lines simulation (subtle receipt texture) */}
      <mesh position={[0, 0.06, 0.009]}>
        <planeGeometry args={[0.22, 0.015]} />
        <meshBasicMaterial color="#334155" />
      </mesh>
      <mesh position={[-0.03, 0.01, 0.009]}>
        <planeGeometry args={[0.16, 0.012]} />
        <meshBasicMaterial color="#94A3B8" />
      </mesh>
      <mesh position={[-0.05, -0.04, 0.009]}>
        <planeGeometry args={[0.12, 0.012]} />
        <meshBasicMaterial color="#CBD5E1" />
      </mesh>
      <mesh position={[0.02, -0.09, 0.009]}>
        <planeGeometry args={[0.20, 0.015]} />
        <meshBasicMaterial color="#64748B" />
      </mesh>

      {/* Ticket ID HTML label */}
      <Html position={[0, 0.07, 0.018]} center distanceFactor={3.6} pointerEvents="none">
        <div
          className="select-none text-center font-mono font-bold text-[10px] text-[#1E293B] leading-none tracking-tight"
          style={{ pointerEvents: 'none' }}
        >
          {orderId}
          <div className="text-[8px] font-normal text-[#64748B] mt-0.5">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </div>
        </div>
      </Html>
    </group>
  );
}

/**
 * Ticket Holder Clip (Slot 0 - 4)
 * Empty holders are visibly open metal clips; occupied holders display paper ticket.
 */
function FixedTicketHolder({
  index,
  item,
  inPointer,
  outPointer,
  isSelected,
  onSelectSlot,
}) {
  const x = SLOT_X_POSITIONS[index];
  const isPointerIn = inPointer === index;
  const isPointerOut = outPointer === index;

  return (
    <group position={[x, 0.46, 0]}>
      {/* Heavy Brass Base Footplate */}
      <mesh
        position={[0, 0.02, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectSlot(index);
        }}
      >
        <cylinderGeometry args={[0.11, 0.13, 0.04, 24]} />
        <meshStandardMaterial
          color={isSelected ? '#167D8D' : '#D4AF37'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Stepped Collar */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.02, 16]} />
        <meshStandardMaterial color="#B8860B" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Upright Brushed Stainless Steel Post */}
      <mesh
        position={[0, 0.20, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectSlot(index);
        }}
      >
        <cylinderGeometry args={[0.018, 0.018, 0.28, 16]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Top Clip Mechanism */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.09, 0.04, 0.05]} />
        <meshStandardMaterial color="#64748B" metalness={0.6} roughness={0.3} />
      </mesh>

      {item ? (
        // Occupied State: Display clamped white paper ticket card
        <OrderTicketCard
          item={item}
          slotIndex={index}
          isSelected={isSelected}
          onClick={() => onSelectSlot(index)}
        />
      ) : (
        // Empty State: Visibly open spring wire clip with clamp notch
        <group position={[0, 0.38, 0]}>
          <mesh>
            <torusGeometry args={[0.045, 0.008, 12, 24, Math.PI * 1.5]} />
            <meshStandardMaterial color="#A0AEC0" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Slot Number Badge: Placed neatly on counter front */}
      <Html position={[0, -0.34, 0.38]} center distanceFactor={3.6}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectSlot(index);
          }}
          className={`w-5 h-5 rounded-full font-mono text-[11px] font-bold flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-xs ${
            isSelected
              ? 'bg-[#167D8D] text-white ring-2 ring-[#E4F3F3]'
              : item
              ? 'bg-[#1E293B] text-white border border-[#334155]'
              : 'bg-white text-[#263843] border border-[#CBD5E1] hover:bg-[#F8FAFC]'
          }`}
          title={`Slot ${index} (${item ? 'Occupied' : 'Empty'})`}
        >
          {index}
        </button>
      </Html>

      {/* IN Pointer Badge (Positioned high at Y = 1.65 world space) */}
      {isPointerIn && (
        <Html position={[0, 1.19, 0]} center distanceFactor={3.8} pointerEvents="none">
          <div
            className="flex items-center gap-1 bg-[#FBECE5] text-[#A94D36] border border-[#A94D36]/60 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs select-none whitespace-nowrap"
            style={{ pointerEvents: 'none' }}
          >
            <span>IN</span>
            <span>▼</span>
          </div>
        </Html>
      )}

      {/* OUT Pointer Badge (Positioned low at Y = 1.05 world space - strictly separated from IN) */}
      {isPointerOut && (
        <Html position={[0, 0.59, 0]} center distanceFactor={3.8} pointerEvents="none">
          <div
            className="flex items-center gap-1 bg-[#EAF1FB] text-[#3268A8] border border-[#3268A8]/60 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs select-none whitespace-nowrap"
            style={{ pointerEvents: 'none' }}
          >
            <span>OUT</span>
            <span>▲</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Recognizable Brass Key on Stand (Mutex Semaphore)
 * Positioned cleanly behind slot 2 to avoid blocking slots from default camera view.
 */
function BrassKeyStand({
  mutexOwner,
  isMutexFree,
  withoutMutex = false,
  isSelected,
  onSelect,
}) {
  return (
    <group position={[0.18, 0.46, -0.28]}>
      {/* Turned Brass Spindle Base */}
      <mesh
        position={[0, 0.02, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect();
        }}
      >
        <cylinderGeometry args={[0.07, 0.09, 0.04, 20]} />
        <meshStandardMaterial color="#B8860B" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Brass Upright Stand Post */}
      <mesh
        position={[0, 0.22, 0]}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect && onSelect();
        }}
      >
        <cylinderGeometry args={[0.02, 0.02, 0.38, 16]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Curved Hanging Hook */}
      <group position={[0, 0.39, 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.007, 10, 20, Math.PI]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Brass Key hanging from hook: ONLY displayed when mutex is enabled (!withoutMutex) AND free (isMutexFree) */}
      {!withoutMutex && isMutexFree && (
        <group position={[0, 0.28, 0.05]} castShadow>
          {/* Key Bow (Ring Head) */}
          <mesh position={[0, 0.06, 0]}>
            <torusGeometry args={[0.03, 0.007, 12, 24]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Key Shaft / Blade */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.11, 12]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Key Bits / Teeth */}
          <mesh position={[0.016, -0.05, 0]}>
            <boxGeometry args={[0.024, 0.035, 0.008]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Mutex Status Badge */}
      <Html position={[0, 0.56, 0]} center distanceFactor={3.8}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect && onSelect();
          }}
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap shadow-xs cursor-pointer transition-transform hover:scale-105 ${
            isSelected
              ? 'bg-[#167D8D] text-white ring-2 ring-[#E4F3F3]'
              : withoutMutex
              ? 'bg-[#FEF2F2] text-[#B43D3D] border border-[#FCA5A5]'
              : isMutexFree
              ? 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]'
              : 'bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]'
          }`}
          title={
            withoutMutex
              ? 'Queue Mutex Disabled: critical section is unprotected'
              : isMutexFree
              ? 'Mutex Key: Free (Queue Unlocked)'
              : `Mutex Key: Owned by ${mutexOwner}`
          }
        >
          {withoutMutex ? 'MUTEX: DISABLED' : isMutexFree ? 'KEY: FREE' : `KEY: ${mutexOwner || 'BUSY'}`}
        </button>
      </Html>
    </group>
  );
}

/**
 * Shared Order Counter (Centerpiece of Apparatus)
 * Light-wood counter, polished brass trim, 5 ticket holders, restrained wraparound hint.
 */
function CanteenSharedCounter({
  slots,
  inPointer,
  outPointer,
  mutexOwner,
  isMutexFree,
  withoutMutex = false,
  selectedSlot,
  selectedComponent,
  onSelectSlot,
  onSelectCounter,
  onSelectMutex,
}) {
  const isSelected = selectedComponent === 'COUNTER';

  return (
    <group position={[0, 0, 0]}>
      {/* Wooden Countertop (Light Beech/Oak) */}
      <mesh
        position={[0, 0.44, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectCounter();
        }}
      >
        <boxGeometry args={[2.20, 0.05, 0.85]} />
        <meshStandardMaterial
          color={isSelected ? '#DFBE95' : '#E5CFB0'}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>

      {/* Polished Brass Edge Trim Band around tabletop */}
      <mesh position={[0, 0.44, 0.428]}>
        <boxGeometry args={[2.21, 0.045, 0.015]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.44, -0.428]}>
        <boxGeometry args={[2.21, 0.045, 0.015]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Main Counter Base Cabinet (Cream architectural panels) */}
      <mesh
        position={[0, 0.21, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelectCounter();
        }}
      >
        <boxGeometry args={[2.14, 0.40, 0.79]} />
        <meshStandardMaterial color="#F4EFEA" roughness={0.7} />
      </mesh>

      {/* Counter Plinth / Kickplate (Recessed warm metal) */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[2.10, 0.04, 0.75]} />
        <meshStandardMaterial color="#C5A059" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Restrained Wraparound Flow Indicator (4 → 0 circular buffer reminder) */}
      <group position={[0, 0.22, 0.40]}>
        <mesh>
          <planeGeometry args={[0.70, 0.08]} />
          <meshBasicMaterial color="#EAE3D9" />
        </mesh>
        <Html position={[0, 0, 0.01]} center distanceFactor={3.8} pointerEvents="none">
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono font-semibold text-[#8C7A6B] uppercase tracking-wider select-none whitespace-nowrap"
            style={{ pointerEvents: 'none' }}
          >
            <span>circular queue</span>
            <span className="font-bold text-[#A94D36]">4 → 0</span>
          </div>
        </Html>
      </group>

      {/* 5 Large Fixed Ticket Holders */}
      {slots.map((item, idx) => (
        <FixedTicketHolder
          key={idx}
          index={idx}
          item={item}
          inPointer={inPointer}
          outPointer={outPointer}
          isSelected={selectedSlot === idx}
          onSelectSlot={onSelectSlot}
        />
      ))}

      {/* Brass Key on Hook (Mutex) */}
      <BrassKeyStand
        mutexOwner={mutexOwner}
        isMutexFree={isMutexFree}
        withoutMutex={withoutMutex}
        isSelected={selectedComponent === 'MUTEX'}
        onSelect={onSelectMutex}
      />
    </group>
  );
}

/**
 * Student Figure (P1 / P2)
 * Rounded anatomical forms, terracotta jacket/shirt, small student backpack, ordering tablet.
 */
function StudentFigure({
  id,
  label,
  position,
  isSelected,
  isActive = false,
  isBlocked = false,
  isKeyOwner = false,
  localItem = null,
  onSelect,
}) {
  return (
    <group position={position}>
      {/* Clickable bounding interaction zone */}
      <mesh
        position={[0, 0.725, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
      >
        <boxGeometry args={[0.5, 1.45, 0.5]} />
      </mesh>

      {/* Floor Active / Amber Blocked Ring */}
      {(isActive || isBlocked) && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.33, 24]} />
          <meshBasicMaterial color={isBlocked ? '#F59E0B' : '#167D8D'} />
        </mesh>
      )}

      {/* Shoes / Feet */}
      <mesh position={[-0.07, 0.04, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.16]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} />
      </mesh>
      <mesh position={[0.07, 0.04, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.16]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} />
      </mesh>

      {/* Legs / Charcoal Trousers */}
      <mesh position={[-0.07, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.50, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      <mesh position={[0.07, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.50, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* Torso: Terracotta Jacket with curved silhouette */}
      <mesh position={[0, 0.76, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.44, 20]} />
        <meshStandardMaterial
          color={isSelected ? '#C85A3C' : '#A94D36'}
          roughness={0.6}
        />
      </mesh>

      {/* White Shirt Collar Accent */}
      <mesh position={[0, 0.97, 0.03]}>
        <cylinderGeometry args={[0.07, 0.08, 0.03, 16]} />
        <meshStandardMaterial color="#FAF7F2" roughness={0.5} />
      </mesh>

      {/* Student Backpack on Back */}
      <group position={[0, 0.76, -0.15]} castShadow>
        <mesh>
          <boxGeometry args={[0.22, 0.30, 0.12]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        {/* Backpack Pocket & Brass Buckle */}
        <mesh position={[0, -0.06, -0.04]}>
          <boxGeometry args={[0.18, 0.12, 0.05]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.04, -0.07]}>
          <boxGeometry args={[0.04, 0.02, 0.01]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* Arms angled forward towards kiosk tablet */}
      <mesh position={[-0.15, 0.72, 0.08]} rotation={[0.4, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.30, 12]} />
        <meshStandardMaterial color="#A94D36" roughness={0.6} />
      </mesh>
      <mesh position={[0.15, 0.72, 0.08]} rotation={[0.4, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.30, 12]} />
        <meshStandardMaterial color="#A94D36" roughness={0.6} />
      </mesh>

      {/* Brass Key held by Student Producer when mutex is owned */}
      {isKeyOwner && (
        <group position={[0.20, 0.72, 0.18]} rotation={[0, 0, -0.3]} castShadow>
          <mesh position={[0, 0.04, 0]}>
            <torusGeometry args={[0.024, 0.005, 10, 20]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.015, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.09, 10]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0.012, -0.04, 0]}>
            <boxGeometry args={[0.018, 0.025, 0.006]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* Stylized Rounded Head & Hair */}
      <group position={[0, 1.08, 0]} castShadow>
        {/* Face / Head */}
        <mesh>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color="#F3D0B5" roughness={0.5} />
        </mesh>
        {/* Dark Hair */}
        <mesh position={[0, 0.04, -0.02]}>
          <sphereGeometry args={[0.115, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#1E293B" roughness={0.8} />
        </mesh>
      </group>

      {/* Compact Ordering Kiosk Stand in front of Student */}
      <group position={[0, 0, 0.28]}>
        {/* Pedestal Base */}
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <cylinderGeometry args={[0.11, 0.13, 0.03, 16]} />
          <meshStandardMaterial color="#64748B" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Pedestal Upright */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.80, 16]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Angled Touch Tablet */}
        <group position={[0, 0.84, 0]} rotation={[-0.45, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.26, 0.20, 0.016]} />
            <meshStandardMaterial color="#1E293B" roughness={0.4} />
          </mesh>
          {/* Tablet Screen */}
          <mesh position={[0, 0, 0.009]}>
            <planeGeometry args={[0.23, 0.17]} />
            <meshBasicMaterial color="#FAF9F6" />
          </mesh>

          {/* Local Order Ticket displayed on Tablet if prepared */}
          {localItem && (
            <group position={[0, 0, 0.012]}>
              <mesh>
                <planeGeometry args={[0.18, 0.12]} />
                <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
              </mesh>
              <Html position={[0, 0, 0.01]} center distanceFactor={3.8} pointerEvents="none">
                <div className="bg-white/95 px-1 py-0.5 rounded border border-[#A94D36] text-[8px] font-mono font-bold text-[#A94D36] whitespace-nowrap shadow-xs select-none">
                  {localItem.id}
                </div>
              </Html>
            </group>
          )}

          {/* Screen UI accent */}
          {!localItem && (
            <mesh position={[0, -0.05, 0.01]}>
              <planeGeometry args={[0.18, 0.03]} />
              <meshBasicMaterial color="#A94D36" />
            </mesh>
          )}
        </group>
      </group>

      {/* P1 / P2 Identification Label */}
      <Html position={[0, 1.62, 0]} center distanceFactor={3.8}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          className={`px-2 py-0.5 rounded text-[12px] font-mono font-bold shadow-xs cursor-pointer transition-transform hover:scale-105 ${
            isSelected
              ? 'bg-[#167D8D] text-white ring-2 ring-[#E4F3F3]'
              : isBlocked
              ? 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] shadow-md ring-2 ring-[#F59E0B]/50'
              : isActive
              ? 'bg-[#167D8D] text-white shadow-md ring-2 ring-[#D4AF37]'
              : 'bg-[#FBECE5] text-[#A94D36] border border-[#A94D36]/60'
          }`}
          title={`${id} (Student Producer)${isBlocked ? ' — BLOCKED (Waiting for empty permit)' : isActive ? ' — ACTIVE' : ''}${isKeyOwner ? ' — HOLDS MUTEX' : ''}`}
        >
          {label} {isKeyOwner ? '🔑' : ''} {isBlocked ? '⏳' : ''}
        </button>
      </Html>
    </group>
  );
}

/**
 * Kitchen Staff Figure (C1 / C2)
 * White chef uniform, royal blue apron, chef cap, kitchen prep counter.
 */
function KitchenStaffFigure({
  id,
  label,
  position,
  isSelected,
  isActive = false,
  isBlocked = false,
  isKeyOwner = false,
  claimedItem = null,
  onSelect,
}) {
  return (
    <group position={position}>
      {/* Clickable bounding interaction zone */}
      <mesh
        position={[0, 0.725, 0]}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
      >
        <boxGeometry args={[0.5, 1.45, 0.5]} />
      </mesh>

      {/* Floor Active / Amber Blocked Ring */}
      {(isActive || isBlocked) && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.33, 24]} />
          <meshBasicMaterial color={isBlocked ? '#F59E0B' : '#167D8D'} />
        </mesh>
      )}

      {/* Kitchen Safety Shoes */}
      <mesh position={[-0.07, 0.035, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.16]} />
        <meshStandardMaterial color="#0F172A" roughness={0.9} />
      </mesh>
      <mesh position={[0.07, 0.035, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.07, 0.16]} />
        <meshStandardMaterial color="#0F172A" roughness={0.9} />
      </mesh>

      {/* Pants / Dark Trousers */}
      <mesh position={[-0.07, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.50, 16]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>
      <mesh position={[0.07, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.50, 16]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>

      {/* Torso: Crisp White Chef Coat */}
      <mesh position={[0, 0.76, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.15, 0.44, 20]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
      </mesh>

      {/* Blue Chef Apron (Wraps front and sides) */}
      <group position={[0, 0.65, 0.03]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.135, 0.145, 0.46, 20, 1, false, -Math.PI * 0.4, Math.PI * 0.8]} />
          <meshStandardMaterial
            color={isSelected ? '#1D4ED8' : '#2563EB'}
            roughness={0.5}
          />
        </mesh>
        {/* Apron Pocket */}
        <mesh position={[0, -0.04, 0.12]}>
          <boxGeometry args={[0.14, 0.10, 0.015]} />
          <meshStandardMaterial color="#1D4ED8" roughness={0.5} />
        </mesh>
      </group>

      {/* Arms in White Chef Sleeves */}
      <mesh position={[-0.15, 0.74, 0.06]} rotation={[0.3, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.28, 12]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 0.74, 0.06]} rotation={[0.3, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.28, 12]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
      </mesh>

      {/* Head & Chef Cap */}
      <group position={[0, 1.08, 0]} castShadow>
        {/* Face */}
        <mesh>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color="#F3D0B5" roughness={0.5} />
        </mesh>
        {/* White Chef Toque / Cap */}
        <mesh position={[0, 0.10, 0]}>
          <cylinderGeometry args={[0.12, 0.11, 0.14, 20]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
        {/* Blue Cap Ribbon Band */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.113, 0.113, 0.025, 20]} />
          <meshStandardMaterial color="#2563EB" roughness={0.4} />
        </mesh>
      </group>

      {/* Kitchen Pass / Preparation Counter Table */}
      <group position={[0, 0, -0.28]}>
        {/* Stainless Steel Prep Surface */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.04, 0.28]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Light Wood Cutting Board on Counter */}
        <mesh position={[0, 0.445, 0]}>
          <boxGeometry args={[0.26, 0.015, 0.18]} />
          <meshStandardMaterial color="#E2CEAE" roughness={0.7} />
        </mesh>

        {/* Claimed/Processed Ticket on Cutting Board */}
        {claimedItem && (
          <group position={[0, 0.46, 0]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[0.18, 0.005, 0.12]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
            </mesh>
            <Html position={[0, 0.02, 0]} center distanceFactor={3.8} pointerEvents="none">
              <div className="bg-white/95 px-1 py-0.5 rounded border border-[#2563EB] text-[8px] font-mono font-bold text-[#2563EB] whitespace-nowrap shadow-xs select-none">
                {claimedItem.id}
              </div>
            </Html>
          </group>
        )}

        {/* Brass Key on prep counter if owned by this chef */}
        {isKeyOwner && (
          <group position={[0.10, 0.465, -0.04]} rotation={[-Math.PI / 2, 0, 0.4]} castShadow>
            <mesh position={[0, 0.03, 0]}>
              <torusGeometry args={[0.02, 0.004, 10, 20]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.07, 10]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0.01, -0.03, 0]}>
              <boxGeometry args={[0.014, 0.02, 0.005]} />
              <meshStandardMaterial color="#D4AF37" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        )}

        {/* Metal Legs */}
        <mesh position={[-0.15, 0.20, -0.11]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.40, 8]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.15, 0.20, -0.11]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.40, 8]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* C1 / C2 Identification Label */}
      <Html position={[0, 1.62, 0]} center distanceFactor={3.8}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          className={`px-2 py-0.5 rounded text-[12px] font-mono font-bold shadow-xs cursor-pointer transition-transform hover:scale-105 ${
            isSelected
              ? 'bg-[#167D8D] text-white ring-2 ring-[#E4F3F3]'
              : isBlocked
              ? 'bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] shadow-md ring-2 ring-[#F59E0B]/50'
              : isActive
              ? 'bg-[#167D8D] text-white shadow-md ring-2 ring-[#D4AF37]'
              : 'bg-[#EAF1FB] text-[#3268A8] border border-[#3268A8]/60'
          }`}
          title={`${id} (Kitchen Consumer)${isBlocked ? ' — BLOCKED (Waiting for order ticket)' : isActive ? ' — ACTIVE' : ''}${isKeyOwner ? ' — HOLDS MUTEX' : ''}`}
        >
          {label} {isKeyOwner ? '🔑' : ''} {isBlocked ? '⏳' : ''}
        </button>
      </Html>
    </group>
  );
}

/**
 * Stage 1B SyncLab3DView: High-clarity static canteen apparatus models
 */
export default function SyncLab3DView({
  syncState,
  selectedSlot,
  selectedThreadId,
  selectedComponent,
  onSelectSlot,
  onSelectThread,
  onSelectComponent,
  resetTrigger = 0,
  hideHeaderBadge = false,
  hideLegend = false,
  paneBadge = null,
  withoutMutex: withoutMutexProp,
}) {
  const controlsRef = useRef(null);

  // Unified Camera Reset listener - returns to exact default fitted camera position & target
  // Routine resizing or state changes do NOT reset user orbit!
  useEffect(() => {
    if (resetTrigger > 0 && controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [resetTrigger]);

  const withoutMutex = withoutMutexProp !== undefined ? Boolean(withoutMutexProp) : Boolean(syncState?.withoutMutex);
  const mutexOwner = syncState?.mutexOwner ?? null;
  const mutexVal = typeof syncState?.mutex === 'object' ? syncState?.mutex?.value : syncState?.mutex ?? 1;
  const isMutexFree = mutexVal === 1 && !withoutMutex;
  const slots = syncState?.slots || [null, null, null, null, null];
  const inPointer = syncState?.in ?? 0;
  const outPointer = syncState?.out ?? 0;
  const occupancy = syncState?.occupancy ?? slots.filter(Boolean).length;

  return (
    <div className="absolute inset-0 w-full h-full bg-[#FAF7F2] select-none overflow-hidden">
      <WebGLErrorBoundary>
        <Canvas
          shadows
          camera={{
            position: CAMERA_DEFAULT_POS,
            fov: CAMERA_DEFAULT_FOV,
          }}
          dpr={[1, 2]}
          className="w-full h-full"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {/* Warm, balanced studio lighting */}
          <ambientLight intensity={1.3} color="#FFFBF7" />
          <directionalLight
            position={[4, 8, 5]}
            intensity={1.4}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0001}
          />
          <directionalLight position={[-4, 6, -3]} intensity={0.5} color="#E2E8F0" />

          {/* Smooth OrbitControls: only resets when user explicitly clicks Reset Camera */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.05}
            minDistance={2.5}
            maxDistance={12}
            target={CAMERA_DEFAULT_TARGET}
          />

          {/* Platform Floor Plinth: closely fitted to apparatus bounds (extends <= 8% beyond apparatus) */}
          <mesh position={[0, -0.02, 0]} receiveShadow>
            <boxGeometry args={[3.92, 0.04, 1.30]} />
            <meshStandardMaterial color="#EDE8E1" roughness={0.8} />
          </mesh>

          {/* Thread and resource entities with active highlight and dynamic ownership */}
          <StudentFigure
            id="P1"
            label="P1"
            position={[-1.71, 0, -0.15]}
            isSelected={selectedThreadId === 'P1'}
            isActive={(syncState?.scheduledThreadId || syncState?.events?.[0]?.threadId) === 'P1'}
            isBlocked={syncState?.threads?.P1?.status === 'BLOCKED'}
            isKeyOwner={mutexOwner === 'P1'}
            localItem={syncState?.threads?.P1?.localItem}
            onSelect={onSelectThread}
          />
          <StudentFigure
            id="P2"
            label="P2"
            position={[-1.32, 0, 0.45]}
            isSelected={selectedThreadId === 'P2'}
            isActive={(syncState?.scheduledThreadId || syncState?.events?.[0]?.threadId) === 'P2'}
            isBlocked={syncState?.threads?.P2?.status === 'BLOCKED'}
            isKeyOwner={mutexOwner === 'P2'}
            localItem={syncState?.threads?.P2?.localItem}
            onSelect={onSelectThread}
          />

          {/* CENTER: The Shared Order Counter (5 Fixed Ticket Holders, Brass Trim, Key/Hook) */}
          <CanteenSharedCounter
            slots={slots}
            inPointer={inPointer}
            outPointer={outPointer}
            mutexOwner={mutexOwner}
            isMutexFree={isMutexFree}
            withoutMutex={withoutMutex}
            selectedSlot={selectedSlot}
            selectedComponent={selectedComponent}
            onSelectSlot={onSelectSlot}
            onSelectCounter={() => onSelectComponent && onSelectComponent('COUNTER')}
            onSelectMutex={() => onSelectComponent && onSelectComponent('MUTEX')}
          />

          {/* RIGHT: Kitchen Staff (C1 and C2, staggered with Prep Counters) */}
          <KitchenStaffFigure
            id="C1"
            label="C1"
            position={[1.32, 0, -0.15]}
            isSelected={selectedThreadId === 'C1'}
            isActive={(syncState?.scheduledThreadId || syncState?.events?.[0]?.threadId) === 'C1'}
            isBlocked={syncState?.threads?.C1?.status === 'BLOCKED'}
            isKeyOwner={mutexOwner === 'C1'}
            claimedItem={syncState?.threads?.C1?.localItem || syncState?.threads?.C1?.candidateItem}
            onSelect={onSelectThread}
          />
          <KitchenStaffFigure
            id="C2"
            label="C2"
            position={[1.71, 0, 0.45]}
            isSelected={selectedThreadId === 'C2'}
            isActive={(syncState?.scheduledThreadId || syncState?.events?.[0]?.threadId) === 'C2'}
            isBlocked={syncState?.threads?.C2?.status === 'BLOCKED'}
            isKeyOwner={mutexOwner === 'C2'}
            claimedItem={syncState?.threads?.C2?.localItem || syncState?.threads?.C2?.candidateItem}
            onSelect={onSelectThread}
          />
        </Canvas>
      </WebGLErrorBoundary>

      {/* Top Left: Clean Scene Header Badge */}
      {!hideHeaderBadge && (
        <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none select-none z-10">
          <div className="bg-white/95 backdrop-blur-xs border border-[#DEE6E8] px-3 py-1 rounded-full text-xs font-sans text-[#263843] shadow-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#167D8D]" />
            <span className="font-bold">The Shared Order Counter</span>
            <span className="text-[#62747C] font-mono text-[11px]">
              ({occupancy} / 5 slots full)
            </span>
          </div>
        </div>
      )}

      {/* Optional Custom Pane Badge */}
      {paneBadge && (
        <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none select-none z-10">
          {typeof paneBadge === 'string' ? (
            <div className="bg-white/95 backdrop-blur-xs border border-[#DEE6E8] px-2.5 py-0.5 rounded-full text-[11px] font-mono text-[#263843] shadow-xs flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  paneBadge.includes('WITHOUT') ? 'bg-[#B43D3D]' : 'bg-[#167D8D]'
                }`}
              />
              <span className="font-bold">{paneBadge}</span>
            </div>
          ) : (
            paneBadge
          )}
        </div>
      )}

      {/* Bottom Scene Legend */}
      {!hideLegend && (
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-sans text-[#62747C] pointer-events-none bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full border border-[#DEE6E8] shadow-xs z-10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#A94D36]" />
              <span>P1, P2 (Students) / IN</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#3268A8]" />
              <span>C1, C2 (Kitchen) / OUT</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span>5 Slots (0–4) + Mutex</span>
            </span>
          </div>
          <div className="text-[10px] hidden sm:block">
            <span>Click to inspect • Drag to orbit view</span>
          </div>
        </div>
      )}
    </div>
  );
}
