import { useState, useRef, useEffect, useCallback } from 'react';
import {
  WORKSTATION_GRID,
  computeRoomBounds,
  getWorkstationCoords,
  COUNTER_SLOT_POSITIONS,
} from './SimulationSceneAdapter.js';

/**
 * Linearly interpolates a position along a series of 3D waypoints based on progress t in [0, 1].
 */
export function interpolateWaypoints(waypoints, t) {
  if (!waypoints || waypoints.length === 0) return [0, 0, 0];
  if (waypoints.length === 1 || t <= 0) return [...waypoints[0]];
  if (t >= 1) return [...waypoints[waypoints.length - 1]];

  const numSegments = waypoints.length - 1;
  const scaledT = t * numSegments;
  const segmentIndex = Math.min(Math.floor(scaledT), numSegments - 1);
  const segmentT = scaledT - segmentIndex;

  const p0 = waypoints[segmentIndex];
  const p1 = waypoints[segmentIndex + 1];

  return [
    p0[0] + (p1[0] - p0[0]) * segmentT,
    p0[1] + (p1[1] - p0[1]) * segmentT,
    p0[2] + (p1[2] - p0[2]) * segmentT,
  ];
}

/**
 * Hook to manage process visual departure lifecycles (Working -> Leaving -> Visually Removed).
 * 
 * Rules:
 * - Engine remains authoritative (completion/order counts are not delayed).
 * - Pausing freezes departure movement; resuming continues smoothly.
 * - Reduced motion or reset completes/clears departures immediately.
 * - Finished finite producers walk along outside exit path: [4.5, 0.35, 2.6] -> [9.5, 0.35, 2.6].
 * - Finished finite or retired consumers walk through interior aisle to staff exit door: [width/2 + 1.2, 0.35, -2.5].
 * - Workstations persist during consumer departure, then are released cleanly upon exit.
 */
export function useProcessDepartures(snapshot, isPlaying = false, options = {}) {
  const { speed = 900 } = options;
  const [tick, setTick] = useState(0);

  // Map of active departures: processId -> DepartureRecord
  const departuresRef = useRef(new Map());
  // Set of process IDs that have completely finished visual departure
  const departedIdsRef = useRef(new Set());
  // Previous snapshot processes to detect removals
  const prevProcessesRef = useRef([]);
  // Previous revision to detect resets
  const prevRevisionRef = useRef(snapshot?.revision ?? 0);

  // Check for reduced motion preference
  const isReducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Detect Resets and Scenario Changes
  const currentRevision = snapshot?.revision ?? 0;
  if ((currentRevision === 0 && prevRevisionRef.current !== 0) || currentRevision < prevRevisionRef.current) {
    departuresRef.current.clear();
    departedIdsRef.current.clear();
  }
  prevRevisionRef.current = currentRevision;

  // 2. Identify newly completed or retired processes from authoritative snapshot
  useEffect(() => {
    if (!snapshot) return;

    const currentProcesses = snapshot.processes ?? [];
    const prevProcesses = prevProcessesRef.current;
    const consumerList = currentProcesses.filter((p) => p.type === 'CONSUMER');
    const roomBounds = computeRoomBounds(Math.max(1, consumerList.length));
    const staffDoorX = roomBounds.width / 2 + 1.2;

    // A. Check current processes that reached COMPLETED or RETIRED
    currentProcesses.forEach((proc) => {
      const isCompleted = proc.state === 'COMPLETED';
      const isRetired = proc.state === 'RETIRED';

      if ((isCompleted || isRetired) && !departuresRef.current.has(proc.id) && !departedIdsRef.current.has(proc.id)) {
        const isProducer = proc.type === 'PRODUCER';
        let waypoints = [];
        let startPos = [0, 0.35, 0];

        if (isProducer) {
          // Producer: exit via outside terrace path to the right
          const writePos = snapshot.writePosition ?? 0;
          const hatchX = COUNTER_SLOT_POSITIONS[writePos] ?? 0.0;
          startPos = [hatchX, 0.35, 1.2];
          waypoints = [
            startPos,
            [4.5, 0.35, 2.6],
            [9.5, 0.35, 2.6],
          ];
        } else {
          // Consumer: exit via staff exit door on East wall (width/2, -2.5)
          const cIndex = consumerList.findIndex((p) => p.id === proc.id);
          const wsCoords = cIndex >= 0 ? getWorkstationCoords(cIndex, Math.max(1, consumerList.length)) : null;
          const wsX = wsCoords ? wsCoords.position[0] : 0.0;
          const wsZ = wsCoords ? wsCoords.position[2] : -2.8;

          startPos = [wsX, 0.35, wsZ];
          waypoints = [
            startPos,
            [wsX, 0.35, -1.5],              // Step into interior collection aisle
            [staffDoorX - 1.5, 0.35, -2.5],  // Walk along interior aisle to East wall
            [staffDoorX, 0.35, -2.5],        // Step through Staff Exit Door to outside landing pad
          ];
        }

        // Departure duration scales with playback speed
        const durationMs = isReducedMotion ? 0 : Math.max(600, Math.min(2200, 1600 * (speed / 900)));

        departuresRef.current.set(proc.id, {
          id: proc.id,
          type: proc.type,
          role: isProducer ? 'Student Producer' : 'Kitchen Worker',
          startPosition: startPos,
          waypoints,
          currentPosition: [...startPos],
          progress: isReducedMotion ? 1.0 : 0.0,
          durationMs,
          stateLabel: isProducer ? 'Order Submitted · Leaving' : 'Finished · Leaving',
          createdAt: Date.now(),
          departed: Boolean(isReducedMotion),
        });

        if (isReducedMotion) {
          departedIdsRef.current.add(proc.id);
        }
      }
    });

    // B. Check processes that were in previous snapshot but removed (graceful or immediate retirement)
    prevProcesses.forEach((prevProc) => {
      const isStillPresent = currentProcesses.some((p) => p.id === prevProc.id);
      if (!isStillPresent && !departuresRef.current.has(prevProc.id) && !departedIdsRef.current.has(prevProc.id)) {
        const isProducer = prevProc.type === 'PRODUCER';
        let waypoints = [];
        let startPos = [0, 0.35, 0];

        if (isProducer) {
          startPos = [3.0, 0.35, 1.5];
          waypoints = [
            startPos,
            [4.5, 0.35, 2.6],
            [9.5, 0.35, 2.6],
          ];
        } else {
          startPos = [0.0, 0.35, -2.8];
          waypoints = [
            startPos,
            [0.0, 0.35, -1.5],
            [staffDoorX - 1.5, 0.35, -2.5],
            [staffDoorX, 0.35, -2.5],
          ];
        }

        const durationMs = isReducedMotion ? 0 : Math.max(600, Math.min(2200, 1600 * (speed / 900)));

        departuresRef.current.set(prevProc.id, {
          id: prevProc.id,
          type: prevProc.type,
          role: isProducer ? 'Student Producer' : 'Kitchen Worker',
          startPosition: startPos,
          waypoints,
          currentPosition: [...startPos],
          progress: isReducedMotion ? 1.0 : 0.0,
          durationMs,
          stateLabel: isProducer ? 'Order Submitted · Leaving' : 'Finished · Leaving',
          createdAt: Date.now(),
          departed: Boolean(isReducedMotion),
        });

        if (isReducedMotion) {
          departedIdsRef.current.add(prevProc.id);
        }
      }
    });

    prevProcessesRef.current = currentProcesses.map((p) => ({ ...p }));
  }, [snapshot, speed, isReducedMotion]);

  // 3. Animation loop: advance progress when simulation is playing
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const deltaSec = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying && departuresRef.current.size > 0 && !isReducedMotion) {
        let changed = false;

        departuresRef.current.forEach((dep, id) => {
          if (dep.departed) return;

          const progressDelta = deltaSec / Math.max(0.1, dep.durationMs / 1000);
          dep.progress = Math.min(1.0, dep.progress + progressDelta);
          dep.currentPosition = interpolateWaypoints(dep.waypoints, dep.progress);

          if (dep.progress >= 1.0) {
            dep.departed = true;
            departedIdsRef.current.add(id);
          }
          changed = true;
        });

        if (changed) {
          setTick((t) => t + 1);
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isReducedMotion]);

  // 4. Stepping while paused: advance departing processes on step
  useEffect(() => {
    if (!isPlaying && departuresRef.current.size > 0 && !isReducedMotion) {
      let changed = false;
      departuresRef.current.forEach((dep, id) => {
        if (dep.departed) return;
        dep.progress = Math.min(1.0, dep.progress + 0.35);
        dep.currentPosition = interpolateWaypoints(dep.waypoints, dep.progress);
        if (dep.progress >= 1.0) {
          dep.departed = true;
          departedIdsRef.current.add(id);
        }
        changed = true;
      });
      if (changed) {
        setTick((t) => t + 1);
      }
    }
  }, [snapshot?.revision, isPlaying, isReducedMotion]);

  // Public reset method
  const resetDepartures = useCallback(() => {
    departuresRef.current.clear();
    departedIdsRef.current.clear();
    prevProcessesRef.current = [];
    setTick((t) => t + 1);
  }, []);

  return {
    departuresMap: departuresRef.current,
    departedIds: departedIdsRef.current,
    resetDepartures,
    departureTick: tick,
  };
}
