"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { X, Hand, HandMetal, Move, MousePointer2, Maximize, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GestureGuideModal({ isOpen, onClose }: GestureGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"2D" | "3D">("2D");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 pointer-events-auto"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="p-6 sm:p-8 pb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                Gesture Guide <span className="text-cyan-400">✨</span>
              </h2>
            </div>

            <div className="flex border-b border-slate-800 px-6 sm:px-8">
              <button 
                onClick={() => setActiveTab("2D")}
                className={cn(
                  "px-4 py-3 font-semibold text-sm transition-colors border-b-2",
                  activeTab === "2D" ? "border-cyan-400 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-300"
                )}
              >
                2D Canvas Mode
              </button>
              <button 
                onClick={() => setActiveTab("3D")}
                className={cn(
                  "px-4 py-3 font-semibold text-sm transition-colors border-b-2",
                  activeTab === "3D" ? "border-pink-400 text-pink-400" : "border-transparent text-slate-400 hover:text-slate-300"
                )}
              >
                3D Spatial Mode
              </button>
            </div>

            <div className="p-6 sm:p-8 min-h-[350px]">
              <AnimatePresence mode="wait">
                {activeTab === "2D" && (
                  <motion.div 
                    key="2D"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-cyan-900/30 text-cyan-400 rounded-xl border border-cyan-800/50 mt-1">
                        <HandMetal size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Draw</h3>
                        <p className="text-slate-300 text-sm mt-1">Pinch your Index Finger and Thumb together and move to draw.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-cyan-900/30 text-cyan-400 rounded-xl border border-cyan-800/50 mt-1">
                        <CircleDashed size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Auto-Shape</h3>
                        <p className="text-slate-300 text-sm mt-1">Draw a rough circle or square and connect the ends to snap into a perfect geometric shape.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-cyan-900/30 text-cyan-400 rounded-xl border border-cyan-800/50 mt-1">
                        <Hand size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Erase</h3>
                        <p className="text-slate-300 text-sm mt-1">Open your palm completely (5 fingers) and wave side-to-side to clear the canvas.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "3D" && (
                  <motion.div 
                    key="3D"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-pink-900/30 text-pink-400 rounded-xl border border-pink-800/50 mt-1">
                        <MousePointer2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Draw / Spawn</h3>
                        <p className="text-slate-300 text-sm mt-1">Extend ONLY your Index Finger to draw a 3D spline in the air.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-pink-900/30 text-pink-400 rounded-xl border border-pink-800/50 mt-1">
                        <CircleDashed size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Math Snap</h3>
                        <p className="text-slate-300 text-sm mt-1">Close the 3D spline to snap it into a 3D Sphere or Cube and reveal its volume and area.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-pink-900/30 text-pink-400 rounded-xl border border-pink-800/50 mt-1">
                        <Maximize size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Zoom / Scale</h3>
                        <p className="text-slate-300 text-sm mt-1">Pinch your Index Finger and Thumb together, then move your hand UP or DOWN to scale the active object.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-pink-900/30 text-pink-400 rounded-xl border border-pink-800/50 mt-1">
                        <Move size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">Erase Scene</h3>
                        <p className="text-slate-300 text-sm mt-1">Open your palm completely and wave side-to-side to delete the 3D objects.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
