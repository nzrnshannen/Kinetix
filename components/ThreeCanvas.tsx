"use client";

import { useThree, Canvas } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

export interface Stroke3D {
  points: { x: number; y: number }[];
  color: string;
  isShape?: "Circle" | "Rectangle";
  bbox?: { x: number; y: number; w: number; h: number };
}

interface ThreeCanvasProps {
  strokes: Stroke3D[];
  canvasWidth: number;
  canvasHeight: number;
}

function ShapeManager({ strokes, canvasWidth, canvasHeight }: ThreeCanvasProps) {
  const { viewport } = useThree();

  return (
    <>
      {strokes.filter(s => s.isShape && s.bbox).map((stroke, i) => {
        const { x, y, w, h } = stroke.bbox!;
        
        // Map 2D pixel coordinates to 3D viewport coordinates
        const cx = x + w / 2;
        const cy = y + h / 2;
        
        const nx = cx / canvasWidth;
        const ny = cy / canvasHeight;

        const vx = (nx - 0.5) * viewport.width;
        const vy = -(ny - 0.5) * viewport.height;
        
        const vw = (w / canvasWidth) * viewport.width;
        const vh = (h / canvasHeight) * viewport.height;
        const size = Math.max(vw, vh);

        return (
          <Float key={i} speed={2} rotationIntensity={2} floatIntensity={2}>
            <mesh position={[vx, vy, 0]} castShadow receiveShadow>
              {stroke.isShape === "Rectangle" ? (
                <boxGeometry args={[size, size, size]} />
              ) : (
                <sphereGeometry args={[size / 2, 32, 32]} />
              )}
              <meshStandardMaterial 
                color={stroke.color} 
                emissive={stroke.color} 
                emissiveIntensity={3} 
                toneMapped={false} 
                roughness={0.8} 
                metalness={0.2} 
              />
            </mesh>
          </Float>
        );
      })}
    </>
  );
}

export default function ThreeCanvas(props: ThreeCanvasProps) {
  return (
    <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        <OrbitControls enableZoom={true} makeDefault />
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={0.5} castShadow />
        
        <ShapeManager {...props} />

        <EffectComposer>
          <Bloom luminanceThreshold={0} mipmapBlur intensity={1.5} />
        </EffectComposer>

        <ContactShadows position={[0, -4, 0]} opacity={0.5} scale={20} blur={2} far={10} />
      </Canvas>
    </div>
  );
}
