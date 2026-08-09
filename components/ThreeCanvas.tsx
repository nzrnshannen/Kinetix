"use client";

import { useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

interface ThreeCanvasProps {
  isPinching: boolean;
  pinchPos: { x: number; y: number } | null;
  activeColor: string;
}

interface ShapeData {
  id: string;
  position: THREE.Vector3;
  color: string;
  size: number;
}

function ShapeManager({ isPinching, pinchPos, activeColor }: ThreeCanvasProps) {
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const { viewport, camera } = useThree();
  const lastPinchRef = useRef(false);

  useEffect(() => {
    if (isPinching && !lastPinchRef.current && pinchPos) {
      // Just started pinching - spawn a new shape!
      
      // Map normalized 2D coords (0-1) to 3D Viewport coords
      // X: 0 is left, 1 is right -> viewport.width / -2 to viewport.width / 2
      // Y: 0 is top, 1 is bottom -> viewport.height / 2 to viewport.height / -2
      
      const x = (pinchPos.x - 0.5) * viewport.width;
      const y = -(pinchPos.y - 0.5) * viewport.height;
      const z = (Math.random() - 0.5) * 5; // Spawn at random depth

      const newShape: ShapeData = {
        id: crypto.randomUUID(),
        position: new THREE.Vector3(x, y, z),
        color: activeColor,
        size: Math.random() * 0.5 + 0.5, // 0.5 to 1.0 size
      };

      setShapes((prev) => [...prev, newShape]);
    }
    
    lastPinchRef.current = isPinching;
  }, [isPinching, pinchPos, activeColor, viewport]);

  return (
    <>
      {shapes.map((shape) => (
        <Float key={shape.id} speed={2} rotationIntensity={2} floatIntensity={2}>
          <mesh position={shape.position} castShadow receiveShadow>
            {Math.random() > 0.5 ? (
              <boxGeometry args={[shape.size, shape.size, shape.size]} />
            ) : (
              <sphereGeometry args={[shape.size / 2, 32, 32]} />
            )}
            <meshStandardMaterial 
              color={shape.color} 
              emissive={shape.color} 
              emissiveIntensity={2} 
              toneMapped={false} 
              roughness={0.1} 
              metalness={0.8} 
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

export default function ThreeCanvas(props: ThreeCanvasProps) {
  return (
    <div className="absolute inset-0 w-full h-full z-10">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <Environment preset="city" />
        
        <ShapeManager {...props} />

        <EffectComposer disableNormalPass>
          <Bloom luminanceThreshold={0} mipmapBlur intensity={1.5} />
        </EffectComposer>

        <ContactShadows position={[0, -4, 0]} opacity={0.5} scale={20} blur={2} far={10} />
      </Canvas>
    </div>
  );
}
