import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export const CAMERA_PRESETS = {
  overview: {
    name: 'Overview',
    position: [0.0, 9.8, 12.5],
    target: [0.0, 0.4, 0.2],
    fov: 34,
  },
  counter: {
    name: 'Counter Close-up',
    position: [0.0, 4.8, 5.8],
    target: [0.0, 0.6, 0.0],
    fov: 32,
  },
  kitchen: {
    name: 'Kitchen Interior',
    position: [0.0, 8.5, 3.8],
    target: [0.0, 0.4, -3.5],
    fov: 35,
  },
  topDown: {
    name: 'Top-Down',
    position: [0.0, 16.5, 0.01],
    target: [0.0, 0.0, -1.2],
    fov: 32,
  },
};

export function CameraControls({ viewMode = 'overview', resetTrigger = 0 }) {
  const controlsRef = useRef();
  const { camera } = useThree();

  // Smoothly transition camera when viewMode or resetTrigger changes
  const targetConfig = CAMERA_PRESETS[viewMode] || CAMERA_PRESETS.overview;

  useEffect(() => {
    if (!controlsRef.current) return;
    const [tx, ty, tz] = targetConfig.target;
    const [cx, cy, cz] = targetConfig.position;

    camera.position.set(cx, cy, cz);
    controlsRef.current.target.set(tx, ty, tz);
    controlsRef.current.update();
  }, [viewMode, resetTrigger, camera, targetConfig]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={4}
      maxDistance={28}
      maxPolarAngle={Math.PI / 2.08} // Prevent viewing under floor
      minPolarAngle={0.05}
      dampingFactor={0.08}
    />
  );
}
