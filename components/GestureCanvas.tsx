"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Hand, Paintbrush, Eraser, Loader2 } from "lucide-react";

type Gesture = "Idle" | "Drawing" | "Peace" | "Open Palm";

const COLORS = ["#ff00ff", "#00ffff", "#00ff00"];

export default function GestureCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gesture, setGesture] = useState<Gesture>("Idle");
  const [activeColorIndex, setActiveColorIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef(-1);
  const activeColorIndexRef = useRef(activeColorIndex);

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Gesture state tracking
  const gestureStateRef = useRef<{
    type: Gesture;
    startTime: number;
    triggered: boolean;
  }>({ type: "Idle", startTime: 0, triggered: false });

  useEffect(() => {
    activeColorIndexRef.current = activeColorIndex;
  }, [activeColorIndex]);

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

        // Initialize webcam
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
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
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const predictWebcam = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      // Ensure canvas dimensions match video display dimensions for exact overlay
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const results = landmarkerRef.current.detectForVideo(video, performance.now());
      processResults(results);
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const processResults = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results.landmarks || results.landmarks.length === 0) {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      setGesture("Idle");
      return;
    }

    const landmarks = results.landmarks[0]; // Process first hand
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Detect gestures
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
        // Swap color after 1 second
        setActiveColorIndex((prev) => (prev + 1) % COLORS.length);
        state.triggered = true;
      }
    } else {
      state.type = currentGesture;
      state.triggered = false;
    }

    // Handle Open Palm to clear
    if (currentGesture === "Open Palm") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Handle Drawing
    if (currentGesture === "Drawing") {
      // Index tip is landmark 8
      const indexTip = landmarks[8];
      
      // Calculate coordinates (mirrored horizontally)
      const rawX = (1 - indexTip.x) * canvas.width;
      const rawY = indexTip.y * canvas.height;

      if (!isDrawingRef.current) {
        isDrawingRef.current = true;
        lastPosRef.current = { x: rawX, y: rawY };
      } else if (lastPosRef.current) {
        // Apply exponential smoothing to reduce jitter
        const smoothing = 0.25; 
        const x = lastPosRef.current.x + (rawX - lastPosRef.current.x) * smoothing;
        const y = lastPosRef.current.y + (rawY - lastPosRef.current.y) * smoothing;

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = COLORS[activeColorIndexRef.current];
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS[activeColorIndexRef.current];
        ctx.stroke();

        // Reset shadow for next strokes
        ctx.shadowBlur = 0;

        lastPosRef.current = { x, y };
      }
    } else {
      isDrawingRef.current = false;
      lastPosRef.current = null;
    }
  };

  const detectGesture = (landmarks: any[]): Gesture => {
    // MediaPipe Hand Landmarks:
    // 4: Thumb tip
    // 8: Index tip, 6: Index PIP
    // 12: Middle tip, 10: Middle PIP
    // 16: Ring tip, 14: Ring PIP
    // 20: Pinky tip, 18: Pinky PIP
    // 0: Wrist

    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const ringPip = landmarks[14];
    const pinkyTip = landmarks[20];
    const pinkyPip = landmarks[18];

    // Distance between thumb and index tip
    const pinchDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + 
      Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Fingers extended check (y is inverted, so smaller y is higher)
    // For a robust check, compare to wrist (0) or PIPs
    const isIndexExtended = indexTip.y < indexPip.y;
    const isMiddleExtended = middleTip.y < middlePip.y;
    const isRingExtended = ringTip.y < ringPip.y;
    const isPinkyExtended = pinkyTip.y < pinkyPip.y;
    // Thumb is trickier, simplified check for open palm
    const isThumbExtended = Math.abs(thumbTip.x - landmarks[2].x) > 0.05;

    if (pinchDist < 0.05) {
      return "Drawing";
    }

    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return "Peace";
    }

    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended && isThumbExtended) {
      return "Open Palm";
    }

    return "Idle";
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {error && (
        <div className="absolute z-50 p-4 bg-red-900/80 text-white rounded-xl border border-red-500 shadow-lg text-center max-w-md backdrop-blur-sm">
          <p>{error}</p>
        </div>
      )}

      {!isLoaded && !error && (
        <div className="absolute z-10 flex flex-col items-center text-slate-400 gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="animate-pulse">Loading Hand Tracking Model...</p>
        </div>
      )}

      {/* Video and Canvas container */}
      <div className={cn("relative w-full max-w-6xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black/50 transition-opacity duration-1000", isLoaded ? "opacity-100" : "opacity-0")}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        />
      </div>

      {/* Floating Bottom Toolbar */}
      <div className="absolute bottom-10 z-20 flex items-center justify-center px-6 py-4 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] gap-8">
        
        {/* Active Gesture Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-white/5">
            <AnimatePresence mode="wait">
              <motion.div
                key={gesture}
                initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                transition={{ duration: 0.2 }}
                className="text-slate-300"
              >
                {gesture === "Drawing" && <Paintbrush size={20} />}
                {gesture === "Open Palm" && <Eraser size={20} />}
                {(gesture === "Idle" || gesture === "Peace") && <Hand size={20} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Current Gesture</span>
            <span className="text-sm font-medium text-slate-200">
              {gesture === "Peace" ? "Hold to swap color..." : gesture}
            </span>
          </div>
        </div>

        <div className="w-px h-10 bg-white/10" />

        {/* Color Palette Indicator */}
        <div className="flex items-center gap-3">
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
                  className="w-6 h-6 rounded-full border-2 border-slate-900 z-10"
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
