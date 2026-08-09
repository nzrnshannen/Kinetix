"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Hand, Paintbrush, Eraser, Loader2, Maximize, Cuboid, Pencil, HelpCircle } from "lucide-react";
import Telemetry from "./Telemetry";
import ThreeCanvas from "./ThreeCanvas";
import GestureGuideModal from "./GestureGuideModal";

export type Gesture = "Idle" | "Drawing" | "Pinch" | "Open Palm" | "OK" | "Peace";

export interface HandData {
  landmarks: any[] | null;
  gesture: Gesture;
  color: string;
  triggerWipe: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  isShape?: "Circle" | "Rectangle";
  bbox?: { x: number; y: number; w: number; h: number };
}

const COLORS = [
  "#06b6d4", // Cyberpunk Cyan
  "#f472b6", // Neon Pink
  "#a3e635", // Toxic Lime
  "#a855f7", // Electric Purple
  "#fde047", // Solar Yellow
  "#f97316", // Blaze Orange
  "#ffffff", // Plasma White
];

export default function GestureCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [appMode, setAppMode] = useState<"2D" | "3D">("2D");
  const [gesture, setGesture] = useState<Gesture>("Idle");
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const [fps, setFps] = useState(0);
  const [handPos, setHandPos] = useState<{x: number, y: number} | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameTimeRef = useRef(performance.now());
  const activeColorIndexRef = useRef(activeColorIndex);
  const appModeRef = useRef(appMode);

  // 2D State
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const is2DDrawingRef = useRef(false);

  // 3D Shared Ref
  const handDataRef = useRef<HandData>({
    landmarks: null,
    gesture: "Idle",
    color: COLORS[0],
    triggerWipe: false,
  });

  const waveTrackerRef = useRef<{ x: number, time: number, direction: number, changes: number } | null>(null);

  const gestureStateRef = useRef<{ type: Gesture; startTime: number; triggered: boolean }>({
    type: "Idle", startTime: 0, triggered: false
  });

  useEffect(() => {
    activeColorIndexRef.current = activeColorIndex;
    handDataRef.current.color = COLORS[activeColorIndex];
  }, [activeColorIndex]);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (showGuide) return;
    let stream: MediaStream | null = null;

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", () => {
            setIsLoaded(true);
            predictWebcam();
          });
        }
      } catch (err: any) {
        console.error(err);
        setError("Could not access webcam or load AI model. Ensure camera permissions are granted.");
      }
    };

    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [showGuide]);

  const drawStrokes = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);

    const allStrokes = [...strokesRef.current];
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current);
    }

    allStrokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowBlur = 10;
      ctx.shadowColor = stroke.color;

      ctx.beginPath();
      if (stroke.isShape && stroke.bbox) {
        const { x, y, w, h } = stroke.bbox;
        if (stroke.isShape === "Circle") {
          const radius = Math.max(w, h) / 2;
          ctx.arc(x + w/2, y + h/2, radius, 0, 2 * Math.PI);
        } else if (stroke.isShape === "Rectangle") {
          ctx.rect(x, y, w, h);
        }
      } else {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    if (!video || !landmarkerRef.current) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      requestRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    const now = performance.now();
    const delta = now - lastFrameTimeRef.current;
    if (delta > 0) {
      setFps(1000 / delta);
    }
    lastFrameTimeRef.current = now;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = landmarkerRef.current.detectForVideo(video, now);
      processResults(results, now);
    } else {
      if (appModeRef.current === "2D") {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) drawStrokes(ctx, canvas.width, canvas.height);
        }
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const handlePinchRelease = () => {
    if (is2DDrawingRef.current && currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;
      if (stroke.points.length > 10) {
        const first = stroke.points[0];
        const last = stroke.points[stroke.points.length - 1];
        const dist = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
        
        if (dist < 60) {
          const xs = stroke.points.map(p => p.x);
          const ys = stroke.points.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const w = maxX - minX;
          const h = maxY - minY;

          if (w > 20 && h > 20) {
            stroke.bbox = { x: minX, y: minY, w, h };
            if (Math.abs(w - h) < 40) {
              stroke.isShape = "Circle";
            } else {
              stroke.isShape = "Rectangle";
            }
          }
        }
      }
      strokesRef.current.push(stroke);
    }
    is2DDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const processResults = (results: any, now: number) => {
    const canvas = canvasRef.current;
    
    if (!results.landmarks || results.landmarks.length === 0) {
      setGesture("Idle");
      setHandPos(null);
      handDataRef.current.landmarks = null;
      handDataRef.current.gesture = "Idle";
      
      if (appModeRef.current === "2D") {
        handlePinchRelease();
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) drawStrokes(ctx, canvas.width, canvas.height);
        }
      }
      return;
    }

    const landmarks = results.landmarks[0];
    setHandPos({ x: 1 - landmarks[8].x, y: landmarks[8].y });
    
    let currentGesture = detectGesture(landmarks, appModeRef.current);

    // Wave detection logic
    if (currentGesture === "Open Palm") {
      const wristX = landmarks[0].x;
      if (waveTrackerRef.current) {
        const dx = wristX - waveTrackerRef.current.x;
        const dt = now - waveTrackerRef.current.time;
        if (Math.abs(dx) > 0.05 && dt < 200) {
          const dir = Math.sign(dx);
          if (dir !== waveTrackerRef.current.direction) {
            waveTrackerRef.current.changes += 1;
            waveTrackerRef.current.direction = dir;
            waveTrackerRef.current.x = wristX;
            waveTrackerRef.current.time = now;
            
            if (waveTrackerRef.current.changes > 3) {
              if (appModeRef.current === "2D") {
                strokesRef.current = [];
                currentStrokeRef.current = null;
              } else {
                handDataRef.current.triggerWipe = true;
              }
              waveTrackerRef.current.changes = 0;
            }
          }
        } else if (dt >= 200) {
          waveTrackerRef.current = { x: wristX, time: now, direction: 0, changes: 0 };
        }
      } else {
        waveTrackerRef.current = { x: wristX, time: now, direction: 0, changes: 0 };
      }
    } else {
      waveTrackerRef.current = null;
    }

    const state = gestureStateRef.current;
    if (currentGesture === "OK") {
      if (state.type !== "OK") {
        if (now - state.startTime > 1000) {
          state.type = "OK";
          state.startTime = now;
          state.triggered = false;
        }
      } else if (!state.triggered && now - state.startTime > 500) {
        setActiveColorIndex((prev) => (prev + 1) % COLORS.length);
        state.triggered = true;
        state.startTime = now;
      }
    } else {
      if (state.type !== "OK" || (state.type === "OK" && now - state.startTime > 1000)) {
        state.type = currentGesture;
        state.triggered = false;
      }
    }

    if (appModeRef.current === "2D" && canvas) {
      if (currentGesture === "Drawing") {
        const indexTip = landmarks[8];
        const rawX = (1 - indexTip.x) * canvas.width;
        const rawY = indexTip.y * canvas.height;

        if (!is2DDrawingRef.current) {
          is2DDrawingRef.current = true;
          currentStrokeRef.current = {
            points: [{ x: rawX, y: rawY }],
            color: COLORS[activeColorIndexRef.current],
          };
        } else if (currentStrokeRef.current) {
          const pts = currentStrokeRef.current.points;
          const lastPos = pts[pts.length - 1];
          const smoothing = 0.25; 
          const x = lastPos.x + (rawX - lastPos.x) * smoothing;
          const y = lastPos.y + (rawY - lastPos.y) * smoothing;
          pts.push({ x, y });
        }
      } else {
        handlePinchRelease();
      }
      
      const ctx = canvas.getContext("2d");
      if (ctx) drawStrokes(ctx, canvas.width, canvas.height);
    }

    setGesture(currentGesture);
    handDataRef.current.landmarks = landmarks;
    // Don't pass 2D drawing gestures to 3D engine to prevent accidental splines
    handDataRef.current.gesture = appModeRef.current === "3D" ? currentGesture : "Idle";
  };

  const detectGesture = (landmarks: any[], mode: "2D" | "3D"): Gesture => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;

    const pinchDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2) +
      Math.pow(thumbTip.z - indexTip.z, 2)
    );

    if (pinchDist < 0.05 && isMiddleExtended && isRingExtended && isPinkyExtended) return "OK";
    
    // In 2D Mode, pinch draws. In 3D Mode, pinch scales.
    if (pinchDist < 0.06 && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return mode === "2D" ? "Drawing" : "Pinch";
    }

    // In 3D Mode, index finger extended draws.
    if (mode === "3D" && isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return "Drawing";
    }

    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) return "Open Palm";
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) return "Peace";

    return "Idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden overscroll-none">
      
      <GestureGuideModal 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
      />

      <Telemetry fps={fps} handPos={handPos} />

      {error && (
        <div className="absolute z-50 p-4 bg-red-900/80 text-white rounded-xl border border-red-500 shadow-lg text-center max-w-md backdrop-blur-sm">
          <p>{error}</p>
        </div>
      )}

      {!isLoaded && !error && !showGuide && (
        <div className="absolute z-10 flex flex-col items-center text-slate-400 gap-4 max-w-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
          <div>
            <p className="animate-pulse text-lg font-semibold text-slate-200">Loading AI Tracking Engine...</p>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className={cn(
          "relative w-full h-full sm:max-w-7xl sm:aspect-video sm:h-auto sm:rounded-3xl overflow-hidden sm:shadow-2xl sm:border border-white/10 bg-black/50 transition-opacity duration-1000", 
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-40"
          autoPlay
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
          className={cn("absolute inset-0 w-full h-full z-10 pointer-events-none", appMode === "3D" && "hidden")}
        />

        {appMode === "3D" && <ThreeCanvas handDataRef={handDataRef} />}
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-6 sm:bottom-10 z-20 flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] gap-4 sm:gap-8 overflow-x-auto max-w-[95vw]">
        
        {/* Help Button */}
        <button
          onClick={() => setShowGuide(true)}
          className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/5 text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <HelpCircle size={18} />
        </button>

        <div className="w-px h-8 bg-white/10 shrink-0" />

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 border border-white/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={gesture}
                initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                transition={{ duration: 0.2 }}
                className="text-slate-300"
              >
                {gesture === "Drawing" && <Paintbrush size={18} />}
                {gesture === "Pinch" && <Maximize size={18} />}
                {gesture === "Open Palm" && <Eraser size={18} />}
                {(gesture === "Idle" || gesture === "Peace" || gesture === "OK") && <Hand size={18} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Gesture</span>
            <span className="text-xs sm:text-sm font-medium text-slate-200 w-16">
              {gesture === "OK" ? "Cycling" : gesture}
            </span>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 shrink-0" />

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {COLORS.map((color, idx) => {
            const isActive = idx === activeColorIndex;
            return (
              <motion.div
                key={color}
                className="relative flex items-center justify-center cursor-pointer"
                animate={{ scale: isActive ? 1.2 : 1 }}
                onClick={() => setActiveColorIndex(idx)}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeColorGlow"
                    className="absolute inset-0 rounded-full blur-md"
                    style={{ backgroundColor: color, opacity: 0.6 }}
                  />
                )}
                <div
                  className={cn("w-5 h-5 sm:w-6 sm:h-6 rounded-full z-10 transition-colors", isActive ? "border-2 border-white" : "border-2 border-slate-900")}
                  style={{ backgroundColor: color }}
                />
              </motion.div>
            );
          })}
        </div>

        <div className="w-px h-8 bg-white/10 shrink-0" />

        {/* 2D / 3D Toggle */}
        <button 
          onClick={() => setAppMode(prev => prev === "2D" ? "3D" : "2D")}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/5 shrink-0"
        >
          {appMode === "2D" ? (
            <>
              <Pencil size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">2D Mode</span>
            </>
          ) : (
            <>
              <Cuboid size={14} className="text-pink-400" />
              <span className="text-xs font-semibold text-slate-200">3D Mode</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}
