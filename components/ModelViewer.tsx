"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { LoadedModel } from "@/lib/loadModel";

interface Props {
  model: LoadedModel;
  scale: number; // file units -> mm
}

/** Front-right, slightly above: a classic product three-quarter view. */
const VIEW_DIR = new THREE.Vector3(0.9, 0.65, 1.25).normalize();

/** Frames the model from a fixed, flattering angle whenever it (or its scale) changes. */
function FrameModel({ model, scale, controls }: Props & { controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const box = model.geometry.boundingBox!.clone();
    box.min.multiplyScalar(scale);
    box.max.multiplyScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, 1e-3);

    const vFov = THREE.MathUtils.degToRad(cam.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / Math.max(size.height, 1)));
    const distance = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.15;

    cam.position.copy(center).addScaledVector(VIEW_DIR, distance);
    cam.near = Math.max(distance / 1000, 0.01);
    cam.far = distance * 100;
    cam.updateProjectionMatrix();

    const c = controls.current;
    if (c) {
      c.target.copy(center);
      c.minDistance = radius * 0.3;
      c.maxDistance = distance * 6;
      c.update();
    } else {
      cam.lookAt(center);
    }
    // Only re-frame for a new model or unit change, not on resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.id, scale, camera, controls]);

  return null;
}

export default function ModelViewer({ model, scale }: Props) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const maxDim = Math.max(model.size.x, model.size.y, model.size.z) * scale;
  return (
    <Canvas camera={{ position: [1, 1, 1], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#6b7488", 1.6]} />
      <directionalLight position={[300, 500, 200]} intensity={2.8} />
      <directionalLight position={[-300, 200, -300]} intensity={1.2} />

      <mesh geometry={model.geometry} scale={scale}>
        <meshStandardMaterial color="#ece7dc" roughness={0.55} metalness={0.05} />
      </mesh>

      <Grid
        infiniteGrid
        cellSize={maxDim > 400 ? 50 : 10}
        sectionSize={maxDim > 400 ? 250 : 50}
        cellColor="#4a4a4a"
        sectionColor="#6b6b6b"
        cellThickness={0.6}
        sectionThickness={1}
        fadeDistance={Math.max(600, maxDim * 6)}
        fadeStrength={1.5}
      />
      <OrbitControls ref={controls} makeDefault enableDamping maxPolarAngle={Math.PI * 0.95} />
      <FrameModel model={model} scale={scale} controls={controls} />
    </Canvas>
  );
}
