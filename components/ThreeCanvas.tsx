"use client";

import { useThree, Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, Line, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { useState, useRef, useEffect } from "react";
import { HandData } from "./GestureCanvas";

interface SceneObject {
  id: string;
  type: "Spline" | "Box" | "Sphere";
  points: THREE.Vector3[];
  color: string;
  position: THREE.Vector3;
  scale: number;
}

function getR3FPosition(landmark: any): THREE.Vector3 {
  // Map normalized screen coordinates to 3D frustum
  const x = (1 - landmark.x - 0.5) * 20;
  const y = -(landmark.y - 0.5) * 12;
  const z = -landmark.z * 15; // Exaggerate depth
  return new THREE.Vector3(x, y, z);
}

function MathHUD({ object }: { object: SceneObject }) {
  let text = "";
  if (object.type === "Sphere") {
    const r = object.scale;
    const v = (4 / 3) * Math.PI * Math.pow(r, 3);
    const a = 4 * Math.PI * Math.pow(r, 2);
    text = `Sphere Math\n-----------\nRadius = ${r.toFixed(2)} units\nVolume = ${v.toFixed(2)} units³\nS.Area = ${a.toFixed(2)} units²`;
  } else if (object.type === "Box") {
    const s = object.scale;
    const v = Math.pow(s, 3);
    const a = 6 * Math.pow(s, 2);
    text = `Cube Math\n---------\nSide = ${s.toFixed(2)} units\nVolume = ${v.toFixed(2)} units³\nS.Area = ${a.toFixed(2)} units²`;
  } else {
    let len = 0;
    for(let i=1; i<object.points.length; i++) {
      len += object.points[i].distanceTo(object.points[i-1]);
    }
    len = len * object.scale;
    text = `3D Spline\n---------\nLength = ${len.toFixed(2)} units`;
  }

  const offset = object.type === "Spline" ? 0 : object.scale + 0.5;

  return (
    <Html position={[0, offset, 0]} center zIndexRange={[100, 0]}>
      <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/50 p-4 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)] min-w-[160px] whitespace-pre-wrap text-sm font-mono text-cyan-300 pointer-events-none select-none transition-all duration-75">
        {text}
      </div>
    </Html>
  );
}

function ShapeRenderer({ object }: { object: SceneObject }) {
  if (object.type === "Spline") {
    return (
      <group position={object.position} scale={object.scale}>
         <Line points={object.points} color={object.color} lineWidth={8} toneMapped={false} />
         <group position={object.points[object.points.length - 1]}>
           <MathHUD object={object} />
         </group>
      </group>
    );
  }

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh position={object.position} castShadow receiveShadow>
        {object.type === "Box" ? (
          <boxGeometry args={[object.scale, object.scale, object.scale]} />
        ) : (
          <sphereGeometry args={[object.scale, 32, 32]} />
        )}
        <meshStandardMaterial 
          color={object.color} 
          emissive={object.color} 
          emissiveIntensity={3} 
          toneMapped={false} 
          roughness={0.8} 
          metalness={0.2} 
        />
        <MathHUD object={object} />
      </mesh>
    </Float>
  );
}

function ActiveDrawing({ handDataRef, onFinish }: { handDataRef: React.MutableRefObject<HandData>; onFinish: (pts: THREE.Vector3[], color: string) => void }) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const colorRef = useRef<string>("#fff");
  const isDrawingRef = useRef(false);

  useFrame(() => {
    const data = handDataRef.current;
    if (!data.landmarks) return;
    
    if (data.gesture === "Drawing") {
      if (!isDrawingRef.current) {
        isDrawingRef.current = true;
        colorRef.current = data.color;
        setPoints([getR3FPosition(data.landmarks[8])]);
      } else {
        const newPos = getR3FPosition(data.landmarks[8]);
        setPoints(prev => {
           if (prev.length === 0) return [newPos];
           const last = prev[prev.length - 1];
           // Only add point if moved enough (smoothing)
           if (last.distanceTo(newPos) > 0.15) {
             return [...prev, newPos];
           }
           return prev;
        });
      }
    } else {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setPoints(prev => {
          if (prev.length > 5) {
            onFinish(prev, colorRef.current);
          }
          return [];
        });
      }
    }
  });

  if (points.length < 2) return null;

  return (
    <Line 
      points={points} 
      color={colorRef.current} 
      lineWidth={8} 
      toneMapped={false}
    />
  );
}

function SceneManager({ handDataRef }: { handDataRef: React.MutableRefObject<HandData> }) {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const lastPinchYRef = useRef<number | null>(null);

  useFrame(() => {
    const data = handDataRef.current;
    
    if (data.triggerWipe) {
      setObjects([]);
      data.triggerWipe = false;
    }

    if (!data.landmarks) {
      lastPinchYRef.current = null;
      return;
    }

    if (data.gesture === "Pinch") {
      const pinchY = data.landmarks[8].y; 
      if (lastPinchYRef.current !== null) {
        const dy = pinchY - lastPinchYRef.current; 
        const scaleDelta = -dy * 10; // moving hand up (dy < 0) increases scale
        
        setObjects(prev => {
          if (prev.length === 0) return prev;
          const newObjs = [...prev];
          const last = newObjs[newObjs.length - 1];
          last.scale = Math.max(0.1, last.scale + scaleDelta);
          return newObjs;
        });
      }
      lastPinchYRef.current = pinchY;
    } else {
      lastPinchYRef.current = null;
    }
  });

  const handleFinishDrawing = (pts: THREE.Vector3[], color: string) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    pts.forEach(p => {
      if(p.x < minX) minX = p.x;
      if(p.x > maxX) maxX = p.x;
      if(p.y < minY) minY = p.y;
      if(p.y > maxY) maxY = p.y;
      if(p.z < minZ) minZ = p.z;
      if(p.z > maxZ) maxZ = p.z;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    const maxDim = Math.max(w, h, d);
    
    const center = new THREE.Vector3(minX + w/2, minY + h/2, minZ + d/2);

    let type: "Spline" | "Box" | "Sphere" = "Spline";
    let scale = 1;

    const first = pts[0];
    const last = pts[pts.length - 1];
    const dist = first.distanceTo(last);
    
    // Auto-Snap Detection
    if (dist < 4 && maxDim > 2) { 
      // Calculate total path length to determine if it's a circle or square
      let pathLength = 0;
      for (let i = 1; i < pts.length; i++) {
         pathLength += pts[i].distanceTo(pts[i-1]);
      }
      
      const ratio = pathLength / maxDim;
      
      // A circle circumference is ~3.14 * diameter. A square perimeter is 4 * diameter.
      if (ratio > 3.6) {
         type = "Box";
      } else {
         type = "Sphere";
      }
      scale = maxDim / 2;
    }

    setObjects(prev => [...prev, {
      id: Math.random().toString(),
      type,
      points: pts,
      color,
      position: type === "Spline" ? new THREE.Vector3(0,0,0) : center,
      scale: type === "Spline" ? 1 : scale
    }]);
  };

  return (
    <>
      <ActiveDrawing handDataRef={handDataRef} onFinish={handleFinishDrawing} />
      {objects.map(obj => (
        <ShapeRenderer key={obj.id} object={obj} />
      ))}
    </>
  );
}

export default function ThreeCanvas({ handDataRef }: { handDataRef: React.MutableRefObject<HandData> }) {
  return (
    <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto">
      <Canvas camera={{ position: [0, 0, 18], fov: 50 }}>
        <OrbitControls makeDefault enableZoom={true} />
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={0.5} castShadow />
        
        <SceneManager handDataRef={handDataRef} />

        <EffectComposer>
          <Bloom luminanceThreshold={0} mipmapBlur intensity={1.5} />
        </EffectComposer>

        <ContactShadows position={[0, -5, 0]} opacity={0.5} scale={20} blur={2} far={10} />
      </Canvas>
    </div>
  );
}
