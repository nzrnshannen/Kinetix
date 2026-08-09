"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Hand, Paintbrush, Eraser, Loader2, Maximize, Palette } from "lucide-react";
import Telemetry from "./Telemetry";
import ThreeCanvas from "./ThreeCanvas";

export type Gesture = "Idle" | "Drawing" | "Pinch" | "Open Palm" | "OK" | "Peace";

export interface HandData {
  landmarks: any[] | null;
  gesture: Gesture;
  color: string;
  triggerWipe: boolean;
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
  
  const [gesture, setGesture] = useState<Gesture>("Idle");
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const [fps, setFps] = useState(0);
  const [handPos, setHandPos] = useState<{x: number, y: number} | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const lastFrameTimeRef = useRef(performance.now());
  const activeColorIndexRef = useRef(activeColorIndex);

  // Shared ref for the 3D engine to poll at 60fps without React re-renders
  const handDataRef = useRef<HandData>({
    landmarks: null,
    gesture: "Idle",
    color: COLORS[0],
    triggerWipe: false,
  });

  // Wave to erase tracking
  const waveTrackerRef = useRef<{ x: number, time: number, direction: number, changes: number } | null>(null);

  const gestureStateRef = useRef<{ type: Gesture; startTime: number; triggered: boolean }>({
    type: "Idle", startTime: 0, triggered: false
  });

  useEffect(() => {
    activeColorIndexRef.current = activeColorIndex;
    handDataRef.current.color = COLORS[activeColorIndex];
  }, [activeColorIndex]);

  useEffect(() => {
    if (showInstructions) return;
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
  }, [showInstructions]);

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
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (results: any, now: number) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setGesture("Idle");
      setHandPos(null);
      handDataRef.current.landmarks = null;
      handDataRef.current.gesture = "Idle";
      return;
    }

    const landmarks = results.landmarks[0];
    setHandPos({ x: 1 - landmarks[8].x, y: landmarks[8].y });
    
    let currentGesture = detectGesture(landmarks);

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
              handDataRef.current.triggerWipe = true;
              waveTrackerRef.current.changes = 0; // reset
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

    // OK Sign Color Cycle Logic
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

    setGesture(currentGesture);
    handDataRef.current.landmarks = landmarks;
    handDataRef.current.gesture = currentGesture;
  };

  const detectGesture = (landmarks: any[]): Gesture => {
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
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

    // OK Sign: index and thumb pinched, other fingers extended
    if (pinchDist < 0.05 && isMiddleExtended && isRingExtended && isPinkyExtended) return "OK";
    
    // Pinch to Scale: index and thumb pinched, others mostly closed
    if (pinchDist < 0.06 && !isMiddleExtended && !isRingExtended && !isPinkyExtended) return "Pinch";

    // Index Finger Drawing: Only index finger extended
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) return "Drawing";

    // Open Palm (Wave): All fingers extended
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) return "Open Palm";

    // Peace Sign
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) return "Peace";

    return "Idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden overscroll-none">
      <AnimatePresence>
        {showInstructions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-3xl max-w-lg w-full shadow-2xl flex flex-col gap-6"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">3D Math & Gesture Sculptor 🧊</h2>
              <div className="flex flex-col gap-4 text-slate-300">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">☝️</div>
                  <div><strong className="text-white">Index Finger:</strong> Draw 3D Splines in space.</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-3xl">🤏</div>
                  <div><strong className="text-white">Pinch & Move Y:</strong> Scale the active object.</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-3xl">👋</div>
                  <div><strong className="text-white">Wave (Side to side):</strong> Erase entire scene.</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-3xl">👌</div>
                  <div><strong className="text-white">"OK" Sign:</strong> Hold to cycle colors.</div>
                </div>
              </div>
              <button 
                onClick={() => setShowInstructions(false)}
                className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-lg py-3 rounded-xl transition-colors"
              >
                Start Sculpting
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Telemetry fps={fps} handPos={handPos} />

      {error && (
        <div className="absolute z-50 p-4 bg-red-900/80 text-white rounded-xl border border-red-500 shadow-lg text-center max-w-md backdrop-blur-sm">
          <p>{error}</p>
        </div>
      )}

      {!isLoaded && !error && !showInstructions && (
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
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-30"
          autoPlay
          playsInline
          muted
        />

        {/* 3D Canvas handles all rendering autonomously */}
        <ThreeCanvas handDataRef={handDataRef} />
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-6 sm:bottom-10 z-20 flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] gap-4 sm:gap-8 overflow-x-auto max-w-[90vw]">
        
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

      </div>
    </div>
  );
}
