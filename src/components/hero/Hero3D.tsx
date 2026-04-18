"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Building({ position, scale, color }: { position: [number, number, number]; scale: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });
  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={ref} position={position} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <MeshDistortMaterial color={color} transparent opacity={0.35} distort={0.2} speed={2} />
      </mesh>
    </Float>
  );
}

export default function Hero3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 45 }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <Building position={[-3, 1, -2]} scale={[1.5, 2.5, 1.5]} color="#3b5bdb" />
      <Building position={[3, -1, -3]} scale={[1, 3, 1]} color="#5c7cff" />
      <Building position={[-1, -2, -1]} scale={[2, 1.5, 2]} color="#8ba6ff" />
      <Building position={[2, 2, -4]} scale={[1.2, 2, 1.2]} color="#3b5bdb" />
      <Building position={[0, 0, -5]} scale={[1.8, 2.8, 1.8]} color="#b9c9ff" />
      <Building position={[-2.5, -1.5, -3]} scale={[1, 1.8, 1]} color="#5c7cff" />
    </Canvas>
  );
}
