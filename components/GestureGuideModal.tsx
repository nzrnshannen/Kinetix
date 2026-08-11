"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Hand, HandMetal, Move, MousePointer2, Maximize, CircleDashed, ChevronRight, ChevronLeft, Pencil, Cuboid } from "lucide-react";
import { cn } from "@/lib/utils";

interface GestureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GestureGuideModal({ isOpen, onClose }: GestureGuideModalProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const pages = [
    {
      title: "2D Canvas Mode",
      icon: <Pencil className="text-cyan-400" size={28} />,
      iconBg: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
      topBar: "from-cyan-400 to-blue-600",
      instructions: [
        { icon: <HandMetal size={20} />, title: "Draw", desc: "Pinch your Index Finger and Thumb together and move to draw." },
        { icon: <CircleDashed size={20} />, title: "Auto-Shape", desc: "Draw a rough circle or square and connect the ends to snap into a perfect geometric shape." },
        { icon: <Hand size={20} />, title: "Erase", desc: "Open your palm completely (5 fingers) and wave side-to-side to clear the canvas." },
      ]
    },
    {
      title: "3D Spatial Mode",
      icon: <Cuboid className="text-purple-400" size={28} />,
      iconBg: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
      topBar: "from-purple-500 to-pink-500",
      instructions: [
        { icon: <MousePointer2 size={20} />, title: "Draw / Spawn", desc: "Extend ONLY your Index Finger to draw a 3D spline in the air." },
        { icon: <CircleDashed size={20} />, title: "Math Snap", desc: "Close the 3D spline to snap it into a 3D Sphere or Cube and reveal its volume and area." },
        { icon: <Maximize size={20} />, title: "Zoom / Scale", desc: "Pinch your Index Finger and Thumb together, then move your hand UP or DOWN to scale the active object." },
        { icon: <Move size={20} />, title: "Erase Scene", desc: "Open your palm completely and wave side-to-side to delete the 3D objects." },
      ]
    }
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      onClose();
      setTimeout(() => setCurrentPage(0), 300);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const activePage = pages[currentPage];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-[#0f0f11] rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-white/5 animate-in zoom-in-95 duration-300">
        
        {/* Neon Top Bar */}
        <div className={cn("absolute top-0 inset-x-0 h-1 bg-gradient-to-r", activePage.topBar)} />

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center transition-all duration-300">
          
          {/* Circular Icon */}
          <div className={cn("w-16 h-16 rounded-full flex items-center justify-center border mb-6 transition-all duration-300", activePage.iconBg, activePage.borderColor)}>
            {activePage.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white mb-2 text-center transition-all duration-300">
            {activePage.title}
          </h2>

          {/* Instructions List */}
          <div className="w-full mt-6 min-h-[220px]">
            <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in duration-300" key={currentPage}>
              {activePage.instructions.map((inst, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={cn("mt-0.5 p-2 rounded-lg bg-white/5 text-slate-300")}>
                    {inst.icon}
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">{inst.title}</h4>
                    <p className="text-slate-400 text-sm leading-snug mt-0.5">{inst.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="w-full flex items-center justify-between mt-8">
            {currentPage > 0 ? (
              <button 
                onClick={handlePrev}
                className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            ) : (
              <div className="w-12" /> // spacer
            )}
            
            {/* Page Dots */}
            <div className="flex gap-2">
              {pages.map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    idx === currentPage ? "bg-white w-4" : "bg-white/20"
                  )}
                />
              ))}
            </div>

            <button 
              onClick={handleNext}
              className={cn(
                "p-3 rounded-full transition-all flex items-center justify-center",
                currentPage === pages.length - 1 
                  ? "bg-white text-black hover:bg-slate-200 px-6 font-semibold" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {currentPage === pages.length - 1 ? (
                "Let's Draw"
              ) : (
                <ChevronRight size={24} />
              )}
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}
