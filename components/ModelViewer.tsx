"use client";

import { Canvas } from "@react-three/fiber";
import { Bounds, Grid, OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { LoadedModel } from "@/lib/loadModel";
import type { FitResult, Printer } from "@/lib/printers";

interface Props {
  model: LoadedModel;
  scale: number; // file units -> mm
  printer?: Printer;
  fit?: FitResult;
}

function BuildVolume({ printer, fit }: { printer: Printer; fit?: FitResult }) {
  const { x, y, z } = printer.build;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(x, z, y)), [x, y, z]);
  const color = fit === "fits" ? "#3fb98a" : fit === "rotate" ? "#e0a43a" : "#e5534b";
  return (
    <group>
      <lineSegments geometry={edges} position={[0, z / 2, 0]}>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </lineSegments>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <planeGeometry args={[x, y]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function ModelViewer({ model, scale, printer, fit }: Props) {
  const maxDim = Math.max(model.size.x, model.size.y, model.size.z) * scale;
  return (
    <Canvas
      camera={{ position: [1, 0.8, 1.2], fov: 40, near: 0.1, far: 100000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#6b7488", 1.6]} />
      <directionalLight position={[300, 500, 200]} intensity={2.8} />
      <directionalLight position={[-300, 200, -300]} intensity={1.2} />

      <Bounds key={`${model.id}-${scale}`} fit clip observe margin={1.5}>
        <mesh geometry={model.geometry} scale={scale}>
          <meshStandardMaterial color="#8fb4ff" roughness={0.42} metalness={0.05} />
        </mesh>
      </Bounds>

      {printer && <BuildVolume printer={printer} fit={fit} />}

      <Grid
        infiniteGrid
        cellSize={maxDim > 400 ? 50 : 10}
        sectionSize={maxDim > 400 ? 250 : 50}
        cellColor="#8a93a6"
        sectionColor="#5d6680"
        cellThickness={0.6}
        sectionThickness={1}
        fadeDistance={Math.max(600, maxDim * 6)}
        fadeStrength={1.5}
      />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}
