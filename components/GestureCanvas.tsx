"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Hand, Paintbrush, Eraser, Loader2, Cuboid, Pencil } from "lucide-react";
import Telemetry from "./Telemetry";
import ThreeCanvas from "./ThreeCanvas";

type Gesture = "Idle" | "Drawing" | "Peace" | "Open Palm";
type AppMode = "2D" | "3D";

const COLORS = ["#ff00ff", "#00ffff", "#00ff00"];

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

export default function GestureCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [mode, setMode] = useState<AppMode>("2D");
  const [gesture, setGesture] = useState<Gesture>("Idle");
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Telemetry state
  const [fps, setFps] = useState(0);
  const [handPos, setHandPos] = useState<Point | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameTimeRef = useRef(performance.now());
  const activeColorIndexRef = useRef(activeColorIndex);

  // Advanced Engine State
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  
  // Undo gesture tracking
  const lastWristRef = useRef<{ x: number, time: number } | null>(null);

  // Gesture duration tracking
  const gestureStateRef = useRef<{ type: Gesture; startTime: number; triggered: boolean }>({
    type: "Idle", startTime: 0, triggered: false
  });

  useEffect(() => {
    activeColorIndexRef.current = activeColorIndex;
  }, [activeColorIndex]);

  // Handle ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        const canvas = canvasRef.current;
        if (canvas) {
          // Adjust internal resolution to match physical pixels, preserve strokes
          canvas.width = width;
          canvas.height = height;
          // Trigger a re-render of strokes automatically in the next frame
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
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
        setError("Could not access webcam or load AI model. Please ensure camera permissions are granted.");
      }
    };

    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      ctx.shadowBlur = 0; // reset
    });
  };

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) return;

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

      // Update canvas resolution only if it doesn't match the client bounding box
      const rect = video.getBoundingClientRect();
      if (rect.width > 0 && (canvas.width !== rect.width || canvas.height !== rect.height)) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const results = landmarkerRef.current.detectForVideo(video, now);
      processResults(results, canvas);
    } else {
      // Still need to re-render 2D strokes even if no new video frame
      if (mode === "2D") {
        const ctx = canvas.getContext("2d");
        if (ctx) drawStrokes(ctx, canvas.width, canvas.height);
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (results: any, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!results.landmarks || results.landmarks.length === 0) {
      handlePinchRelease();
      setGesture("Idle");
      setHandPos(null);
      if (mode === "2D") drawStrokes(ctx, canvas.width, canvas.height);
      return;
    }

    const landmarks = results.landmarks[0];
    
    // Telemetry normalized coordinates (mirrored)
    setHandPos({ x: 1 - landmarks[8].x, y: landmarks[8].y });

    const currentGesture = detectGesture(landmarks);
    setGesture(currentGesture);

    const now = performance.now();
    const state = gestureStateRef.current;

    // Track gesture duration for peace sign (color swap)
    if (currentGesture === "Peace") {
      if (state.type !== "Peace") {
        state.type = "Peace";
        state.startTime = now;
        state.triggered = false;
      } else if (!state.triggered && now - state.startTime > 1000) {
        setActiveColorIndex((prev) => (prev + 1) % COLORS.length);
        state.triggered = true;
      }
    } else {
      state.type = currentGesture;
      state.triggered = false;
    }

    // Handle Open Palm to clear
    if (currentGesture === "Open Palm") {
      strokesRef.current = [];
      currentStrokeRef.current = null;
    }

    // Handle Left Swipe to Undo (rapid movement of wrist x from > to <)
    const wrist = landmarks[0];
    const mirroredWristX = 1 - wrist.x;
    if (lastWristRef.current) {
      const dt = now - lastWristRef.current.time;
      const dx = mirroredWristX - lastWristRef.current.x;
      // If moved left quickly (-x direction since it's mirrored, wait: 
      // mirrored X: 0 is left edge, 1 is right edge. 
      // Movement from right to left means X goes from high to low. So dx < 0.
      if (dx < -0.15 && dt < 150) { 
        // Trigger undo
        strokesRef.current.pop();
        lastWristRef.current = null; // debounce
      } else {
        lastWristRef.current = { x: mirroredWristX, time: now };
      }
    } else {
      lastWristRef.current = { x: mirroredWristX, time: now };
    }

    // Handle Drawing (2D Mode only)
    if (mode === "2D") {
      if (currentGesture === "Drawing") {
        const indexTip = landmarks[8];
        const rawX = (1 - indexTip.x) * canvas.width;
        const rawY = indexTip.y * canvas.height;

        if (!isDrawingRef.current) {
          isDrawingRef.current = true;
          currentStrokeRef.current = {
            points: [{ x: rawX, y: rawY }],
            color: COLORS[activeColorIndexRef.current],
          };
        } else if (currentStrokeRef.current) {
          const pts = currentStrokeRef.current.points;
          const lastPos = pts[pts.length - 1];
          // Exponential smoothing
          const smoothing = 0.25; 
          const x = lastPos.x + (rawX - lastPos.x) * smoothing;
          const y = lastPos.y + (rawY - lastPos.y) * smoothing;
          pts.push({ x, y });
        }
      } else {
        handlePinchRelease();
      }

      drawStrokes(ctx, canvas.width, canvas.height);
    }
  };

  const handlePinchRelease = () => {
    if (isDrawingRef.current && currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;
      if (stroke.points.length > 10) {
        // Auto-Snap Logic
        const first = stroke.points[0];
        const last = stroke.points[stroke.points.length - 1];
        const dist = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
        
        if (dist < 60) {
          // Closed loop, check bounds
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
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  };

  const detectGesture = (landmarks: any[]): Gesture => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    const pinchDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;
    const isThumbExtended = Math.abs(thumbTip.x - landmarks[2].x) > 0.05;

    if (pinchDist < 0.05) return "Drawing";
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) return "Peace";
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && isThumbExtended) return "Open Palm";

    return "Idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden overscroll-none">
      <Telemetry fps={fps} handPos={handPos} />

      {error && (
        <div className="absolute z-50 p-4 bg-red-900/80 text-white rounded-xl border border-red-500 shadow-lg text-center max-w-md backdrop-blur-sm">
          <p>{error}</p>
        </div>
      )}

      {!isLoaded && !error && (
        <div className="absolute z-10 flex flex-col items-center text-slate-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="animate-pulse">Loading Hand Tracking Engine...</p>
        </div>
      )}

      {/* Main Container */}
      <div 
        ref={containerRef}
        className={cn(
          "relative w-full h-full sm:max-w-6xl sm:aspect-video sm:h-auto sm:rounded-3xl overflow-hidden sm:shadow-2xl sm:border border-white/10 bg-black/50 transition-opacity duration-1000", 
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          autoPlay
          playsInline
          muted
        />
        
        <canvas
          ref={canvasRef}
          className={cn("absolute inset-0 w-full h-full z-10 pointer-events-none", mode === "3D" && "hidden")}
        />

        {mode === "3D" && (
          <ThreeCanvas 
            isPinching={gesture === "Drawing"} 
            pinchPos={handPos} 
            activeColor={COLORS[activeColorIndex]} 
          />
        )}
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-6 sm:bottom-10 z-20 flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] gap-4 sm:gap-8 overflow-x-auto max-w-[90vw]">
        
        {/* Active Gesture Indicator */}
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
                {gesture === "Open Palm" && <Eraser size={18} />}
                {(gesture === "Idle" || gesture === "Peace") && <Hand size={18} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Gesture</span>
            <span className="text-xs sm:text-sm font-medium text-slate-200">
              {gesture === "Peace" ? "Hold..." : gesture}
            </span>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 shrink-0" />

        {/* Color Palette Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {COLORS.map((color, idx) => {
            const isActive = idx === activeColorIndex;
            return (
              <motion.div
                key={color}
                className="relative flex items-center justify-center"
                animate={{ scale: isActive ? 1.2 : 1 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeColorGlow"
                    className="absolute inset-0 rounded-full blur-md"
                    style={{ backgroundColor: color, opacity: 0.6 }}
                  />
                )}
                <div
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-slate-900 z-10"
                  style={{ backgroundColor: color }}
                />
              </motion.div>
            );
          })}
        </div>

        <div className="w-px h-8 bg-white/10 shrink-0" />

        {/* 2D / 3D Toggle */}
        <button 
          onClick={() => setMode(prev => prev === "2D" ? "3D" : "2D")}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 transition-colors px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/5 shrink-0"
        >
          {mode === "2D" ? (
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
