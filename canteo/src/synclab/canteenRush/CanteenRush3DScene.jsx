import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';

// Stylized Canteo Color Palette
const COLORS = {
  bg: '#F5EFEB',
  floor: '#EAE1D3',
  floorBorder: '#D2C4B0',
  woodCounter: '#B89B7B',
  counterTop: '#F8F5EE',
  stainlessCounter: '#B0B9BE',
  studentShirt: '#4A7C59',
  chefShirt: '#F0EFEB',
  chefPants: '#36454F',
  chefApron: '#B89B7B',
  pan: '#2C3539',
  dosa: '#E1A95F',
  idli: '#FFFFFF',
  sandwich: '#C49A45',
  leaf: '#4F7942',
  mutexFree: '#10B981',
  mutexLocked: '#EF4444',
  writePointer: '#059669',
  readPointer: '#D97706',
};

// 3D Dish Token for Slot Rack or Pan
function FoodTokenMesh({ foodName, scale = 1 }) {
  const isDosa = foodName?.toLowerCase().includes('dosa');
  const isIdli = foodName?.toLowerCase().includes('idli');
  const isSandwich = foodName?.toLowerCase().includes('sandwich');

  if (isDosa) {
    return (
      <group scale={scale}>
        {/* Banana Leaf Base */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, 0.35]} />
          <meshStandardMaterial color={COLORS.leaf} roughness={0.6} />
        </mesh>
        {/* Golden Rolled Dosa Cylinder */}
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.45, 16]} />
          <meshStandardMaterial color={COLORS.dosa} roughness={0.4} />
        </mesh>
      </group>
    );
  }

  if (isIdli) {
    return (
      <group scale={scale}>
        {/* Banana Leaf Base */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color={COLORS.leaf} roughness={0.6} />
        </mesh>
        {/* Twin Idlis */}
        <mesh position={[-0.08, 0.06, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
          <meshStandardMaterial color={COLORS.idli} roughness={0.3} />
        </mesh>
        <mesh position={[0.08, 0.06, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
          <meshStandardMaterial color={COLORS.idli} roughness={0.3} />
        </mesh>
      </group>
    );
  }

  if (isSandwich) {
    return (
      <group scale={scale}>
        {/* Triangle Sandwich Wedge */}
        <mesh position={[0, 0.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.28]} />
          <meshStandardMaterial color={COLORS.sandwich} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  // Generic Bowl
  return (
    <group scale={scale}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.1, 0.1, 16]} />
        <meshStandardMaterial color={COLORS.woodCounter} roughness={0.4} />
      </mesh>
    </group>
  );
}

// Student Character Model
function StudentMesh({ process, isSelected, onClick }) {
  const pId = process?.id || 'P1';
  const food = process?.foodName || 'Order';
  const state = process?.state || 'READY';
  const isCompleted = state === 'COMPLETED';
  const isBlocked = state === 'BLOCKED' || state === 'WAITING';

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: 'pointer' }}>
      {/* Ground Selection Halo */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.55, 32]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      )}

      {/* Stylized Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.5, 8, 16]} />
        <meshStandardMaterial color={isCompleted ? '#94A3B8' : isBlocked ? '#DC2626' : COLORS.studentShirt} roughness={0.5} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#E8C39E" roughness={0.6} />
      </mesh>

      {/* Backpack Mesh */}
      <mesh position={[0, 0.6, -0.22]} castShadow>
        <boxGeometry args={[0.26, 0.35, 0.14]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>

      {/* Interactive Overhead Badge */}
      <Html position={[0, 1.45, 0]} center distanceFactor={14}>
        <div
          className={`cr-char-badge ${isSelected ? 'selected' : ''} ${isBlocked ? 'blocked' : ''} ${isCompleted ? 'completed' : ''}`}
          onClick={onClick}
          role="button"
          tabIndex={0}
        >
          <div className="cr-char-badge-header">
            <strong>{pId}</strong>
            <span className={`cr-state-pill ${state.toLowerCase()}`}>{state}</span>
          </div>
          <div className="cr-char-food">{food}</div>
        </div>
      </Html>
    </group>
  );
}

// Kitchen Chef Character Model
function ChefMesh({ worker, process, isSelected, onClick }) {
  const cId = worker?.id || 'C1';
  const state = worker?.state || 'IDLE';
  const isCooking = state === 'PREPARING';
  const isWaiting = process?.state === 'BLOCKED';

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: 'pointer' }}>
      {/* Ground Selection Halo */}
      {isSelected && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.55, 32]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      )}

      {/* Body / Chef Uniform */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.5, 8, 16]} />
        <meshStandardMaterial color={COLORS.chefShirt} roughness={0.4} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#D7A97B" roughness={0.6} />
      </mesh>

      {/* Chef Hat (Toque Blanche) */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.15, 0.3, 16]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </mesh>

      {/* Overhead Badge */}
      <Html position={[0, 1.7, 0]} center distanceFactor={14}>
        <div
          className={`cr-char-badge chef ${isSelected ? 'selected' : ''} ${isCooking ? 'cooking' : ''} ${isWaiting ? 'blocked' : ''}`}
          onClick={onClick}
          role="button"
          tabIndex={0}
        >
          <div className="cr-char-badge-header">
            <strong>{cId}</strong>
            <span className={`cr-state-pill ${isCooking ? 'preparing' : isWaiting ? 'blocked' : 'idle'}`}>
              {isCooking ? 'COOKING' : isWaiting ? 'BLOCKED' : state}
            </span>
          </div>
          {worker?.assignedOrderId ? (
            <div className="cr-char-food">{worker.assignedOrderId}: {worker.foodName}</div>
          ) : (
            <div className="cr-char-food cr-muted">Awaiting order</div>
          )}
        </div>
      </Html>
    </group>
  );
}

// 5-Slot Shared Order Rack
function SharedRackMesh({ slots, writePos, readPos, mutexOwner, emptyVal, fullVal }) {
  const isLocked = Boolean(mutexOwner);

  return (
    <group position={[0, 0, 0]}>
      {/* Rack Base Frame */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.7, 5.2]} />
        <meshStandardMaterial color="#3E4C59" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Top Counter Plate */}
      <mesh position={[0, 0.72, 0]} receiveShadow>
        <boxGeometry args={[1.3, 0.05, 5.3]} />
        <meshStandardMaterial color="#222B32" roughness={0.3} />
      </mesh>

      {/* Floating Mutex Lock Indicator */}
      <group position={[0, 2.3, 0]}>
        {/* Padlock base */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.4, 0.32, 0.18]} />
          <meshStandardMaterial color={isLocked ? COLORS.mutexLocked : COLORS.mutexFree} metalness={0.3} roughness={0.3} />
        </mesh>
        {/* Padlock shackle */}
        <mesh position={[0, 0.22, 0]}>
          <torusGeometry args={[0.13, 0.04, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.2} />
        </mesh>
        <Html position={[0, 0.45, 0]} center distanceFactor={13}>
          <div className={`cr-mutex-hud-badge ${isLocked ? 'locked' : 'free'}`}>
            {isLocked ? (
              <span>🔒 MUTEX: LOCKED by <b>{mutexOwner}</b></span>
            ) : (
              <span>🔓 MUTEX: FREE (Queue Unlocked)</span>
            )}
          </div>
        </Html>
      </group>

      {/* 5 Distinct Order Slots along Z axis */}
      {[-2.0, -1.0, 0.0, 1.0, 2.0].map((zPos, idx) => {
        const item = slots?.[idx];
        const isWrite = writePos === idx;
        const isRead = readPos === idx;

        return (
          <group key={idx} position={[0, 0.75, zPos]}>
            {/* Slot Metal Tray Plate */}
            <mesh position={[0, 0.02, 0]} receiveShadow>
              <boxGeometry args={[0.9, 0.04, 0.8]} />
              <meshStandardMaterial color={item ? '#F1E9DB' : '#334155'} roughness={0.6} />
            </mesh>

            {/* Food Mesh if occupied */}
            {item && (
              <group position={[0, 0.05, 0]}>
                <FoodTokenMesh foodName={item.foodName} scale={0.9} />
                <Html position={[0, 0.35, 0]} center distanceFactor={12}>
                  <div className="cr-slot-ticket">
                    <b>{item.id}</b>
                    <small>{item.foodName}</small>
                  </div>
                </Html>
              </group>
            )}

            {/* Slot Number Label */}
            <Html position={[0.55, 0.05, 0]} center distanceFactor={12}>
              <div className="cr-slot-idx-label">Slot {idx}</div>
            </Html>

            {/* Write Pointer Indicator */}
            {isWrite && (
              <Html position={[-0.65, 0.2, 0]} center distanceFactor={12}>
                <div className="cr-pointer-tag write" title="Write Pointer (Next insertion)">
                  <b>W</b> → Slot {idx}
                </div>
              </Html>
            )}

            {/* Read Pointer Indicator */}
            {isRead && (
              <Html position={[0, 0.2, -0.45]} center distanceFactor={12}>
                <div className="cr-pointer-tag read" title="Read Pointer (Next removal)">
                  <b>R</b> → Slot {idx}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Semaphore Permit Counters at Rack Front */}
      <Html position={[0, 0.35, 2.75]} center distanceFactor={13}>
        <div className="cr-semaphore-hud-box">
          <div className="cr-hud-pill empty">
            <span>empty</span>
            <strong>{emptyVal} / 5</strong>
          </div>
          <div className="cr-hud-pill full">
            <span>full</span>
            <strong>{fullVal} / 5</strong>
          </div>
        </div>
      </Html>
    </group>
  );
}

// Kitchen Workstations with Stove Burners, Pans, and Progress Rings
function KitchenWorkstations({ workers, selectedEntityId, onSelect }) {
  return (
    <group position={[4.2, 0, 0]}>
      {/* Long Kitchen Stainless Counter Table */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.8, 4.4]} />
        <meshStandardMaterial color={COLORS.stainlessCounter} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Workstation 1 (C1) at z = -1.2 */}
      <group position={[0, 0, -1.2]}>
        <ChefMesh
          worker={workers?.[0]}
          process={workers?.[0]}
          isSelected={selectedEntityId === 'C1'}
          onClick={() => onSelect('C1')}
        />
        {/* Stove Burner */}
        <mesh position={[-0.35, 0.82, 0]} receiveShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 16]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        {/* Frying Pan */}
        <mesh position={[-0.35, 0.86, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.08, 16]} />
          <meshStandardMaterial color={COLORS.pan} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Cooking Food in Pan */}
        {workers?.[0]?.state === 'PREPARING' && (
          <group position={[-0.35, 0.92, 0]}>
            <FoodTokenMesh foodName={workers[0].foodName} scale={0.7} />
            {/* Progress Meter */}
            <Html position={[0, 0.5, 0]} center distanceFactor={12}>
              <div className="cr-prep-ring-hud">
                <div className="cr-prep-ring-title">🍳 Cooking: {workers[0].assignedOrderId}</div>
                <div className="cr-prep-ring-bar">
                  <div
                    className="cr-prep-ring-fill"
                    style={{ width: `${Math.round((workers[0].preparationProgress / Math.max(1, workers[0].preparationDuration)) * 100)}%` }}
                  />
                </div>
                <small>{workers[0].preparationProgress} / {workers[0].preparationDuration} ticks</small>
              </div>
            </Html>
          </group>
        )}
      </group>

      {/* Workstation 2 (C2) at z = 1.2 */}
      <group position={[0, 0, 1.2]}>
        <ChefMesh
          worker={workers?.[1]}
          process={workers?.[1]}
          isSelected={selectedEntityId === 'C2'}
          onClick={() => onSelect('C2')}
        />
        {/* Stove Burner */}
        <mesh position={[-0.35, 0.82, 0]} receiveShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 16]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        {/* Frying Pan */}
        <mesh position={[-0.35, 0.86, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.08, 16]} />
          <meshStandardMaterial color={COLORS.pan} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Cooking Food in Pan */}
        {workers?.[1]?.state === 'PREPARING' && (
          <group position={[-0.35, 0.92, 0]}>
            <FoodTokenMesh foodName={workers[1].foodName} scale={0.7} />
            <Html position={[0, 0.5, 0]} center distanceFactor={12}>
              <div className="cr-prep-ring-hud">
                <div className="cr-prep-ring-title">🍳 Cooking: {workers[1].assignedOrderId}</div>
                <div className="cr-prep-ring-bar">
                  <div
                    className="cr-prep-ring-fill"
                    style={{ width: `${Math.round((workers[1].preparationProgress / Math.max(1, workers[1].preparationDuration)) * 100)}%` }}
                  />
                </div>
                <small>{workers[1].preparationProgress} / {workers[1].preparationDuration} ticks</small>
              </div>
            </Html>
          </group>
        )}
      </group>
    </group>
  );
}

// Student Order Counter (Left Zone)
function StudentCounter({ processes, selectedEntityId, onSelect }) {
  const students = processes?.filter((p) => p.type === 'PRODUCER') || [];

  return (
    <group position={[-4.2, 0, 0]}>
      {/* Wooden Service Counter */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.8, 4.4]} />
        <meshStandardMaterial color={COLORS.woodCounter} roughness={0.7} />
      </mesh>
      {/* Cream Marble Top */}
      <mesh position={[0, 0.82, 0]} receiveShadow>
        <boxGeometry args={[1.6, 0.04, 4.5]} />
        <meshStandardMaterial color={COLORS.counterTop} roughness={0.3} />
      </mesh>

      {/* 3 Student Positions */}
      {students.map((p, idx) => {
        const zPos = (idx - 1) * 1.5; // -1.5, 0, 1.5
        return (
          <group key={p.id} position={[0, 0, zPos]}>
            <StudentMesh
              process={p}
              isSelected={selectedEntityId === p.id}
              onClick={() => onSelect(p.id)}
            />
          </group>
        );
      })}

      {/* Counter Zone Sign */}
      <Html position={[0, 0.85, 2.4]} center distanceFactor={13}>
        <div className="cr-zone-tag">STUDENT ORDER COUNTER</div>
      </Html>
    </group>
  );
}

// Pickup Counter at Front
function PickupCounter({ readyOrders, onPickUp }) {
  return (
    <group position={[0, 0, 4.2]}>
      {/* Front Service Counter Table */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 0.7, 1.0]} />
        <meshStandardMaterial color={COLORS.woodCounter} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.72, 0]} receiveShadow>
        <boxGeometry args={[4.9, 0.05, 1.1]} />
        <meshStandardMaterial color={COLORS.counterTop} roughness={0.3} />
      </mesh>

      <Html position={[0, 0.76, 0]} center distanceFactor={12}>
        <div className="cr-zone-tag pickup">READY FOR PICKUP</div>
      </Html>

      {/* Display Ready Order Plates */}
      {readyOrders?.map((ro, idx) => {
        const xOffset = (idx - (readyOrders.length - 1) / 2) * 1.3;
        return (
          <group key={ro.id} position={[xOffset, 0.75, 0]}>
            {/* Ceramic Plate */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.26, 0.22, 0.03, 16]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.2} />
            </mesh>
            <FoodTokenMesh foodName={ro.foodName} scale={0.8} />

            <Html position={[0, 0.45, 0]} center distanceFactor={12}>
              <div className="cr-pickup-card">
                <b>{ro.id}</b>
                <span>{ro.foodName}</span>
                <button
                  type="button"
                  className="cr-pickup-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickUp(ro.id);
                  }}
                >
                  Pick Up
                </button>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export function CanteenRush3DScene({
  snapshot,
  selectedEntityId,
  onSelectEntity,
  onPickUpOrder,
}) {
  const controlsRef = useRef();

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
  } = snapshot || {};

  return (
    <div className="cr-canvas-wrapper" style={{ width: '100%', height: '520px', position: 'relative' }}>
      <Canvas
        camera={{ position: [11, 14, 15], fov: 28 }}
        shadows
        style={{ background: COLORS.bg, borderRadius: '12px' }}
      >
        <ambientLight intensity={1.4} color="#FFF8EF" />
        <directionalLight
          position={[10, 20, 12]}
          intensity={1.6}
          color="#FFFDF7"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-12, 10, -10]} intensity={0.5} color="#B4C6BD" />

        {/* Orbit Camera Controls with restricted angles */}
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          maxPolarAngle={Math.PI / 2.3}
          minPolarAngle={Math.PI / 6}
          minDistance={10}
          maxDistance={30}
        />

        {/* Stylized Floor Plane */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[18, 14]} />
          <meshStandardMaterial color={COLORS.floor} roughness={0.8} />
        </mesh>
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[18.4, 14.4]} />
          <meshBasicMaterial color={COLORS.floorBorder} />
        </mesh>

        {/* Left: Student Arrival Counter */}
        <StudentCounter
          processes={processes}
          selectedEntityId={selectedEntityId}
          onSelect={onSelectEntity}
        />

        {/* Center: Bounded Order Rack (5 Slots) */}
        <SharedRackMesh
          slots={slots}
          writePos={writePosition}
          readPos={readPosition}
          mutexOwner={mutexOwner}
          emptyVal={empty}
          fullVal={full}
        />

        {/* Right: Kitchen Workstations */}
        <KitchenWorkstations
          workers={workers}
          selectedEntityId={selectedEntityId}
          onSelect={onSelectEntity}
        />

        {/* Front: Pickup Counter */}
        <PickupCounter
          readyOrders={readyOrders}
          onPickUp={onPickUpOrder}
        />
      </Canvas>
    </div>
  );
}

