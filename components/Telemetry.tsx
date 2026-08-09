"use client";

import { motion } from "motion/react";
import { Activity } from "lucide-react";

interface TelemetryProps {
  fps: number;
  handPos: { x: number; y: number } | null;
}

export default function Telemetry({ fps, handPos }: TelemetryProps) {
  return (
    <div className="absolute top-6 right-6 z-30 flex flex-col gap-2 items-end pointer-events-none">
      <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
        <Activity size={14} className={fps > 30 ? "text-green-400" : "text-yellow-400"} />
        <span className="text-xs font-mono text-slate-300">
          {Math.round(fps)} FPS
        </span>
      </div>

      <div className="relative w-24 h-16 bg-slate-900/60 backdrop-blur-md rounded-xl border border-white/10 shadow-lg overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPHBhdGggZD0iTTAgMEw4IDhNMCA4TDggMCIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPgo8L3N2Zz4=')] bg-repeat" />
        {handPos && (
          <motion.div
            className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_#00ffff]"
            style={{
              left: `${handPos.x * 100}%`,
              top: `${handPos.y * 100}%`,
              transform: "translate(-50%, -50%)"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
        )}
      </div>
    </div>
  );
}
