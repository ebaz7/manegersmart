import React, { useState, useEffect } from 'react';
import { Columns, LayoutDashboard, ArrowLeft, ArrowRight, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SplitViewDragOverlayProps {
  onDropLeft: (tabId: string) => void;
  onDropRight: (tabId: string) => void;
  activeTab: string;
}

export const SplitViewDragOverlay: React.FC<SplitViewDragOverlayProps> = ({
  onDropLeft,
  onDropRight,
  activeTab
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<'left' | 'right' | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  useEffect(() => {
    let isTabDragActive = false;

    const handleCustomStart = (e: any) => {
      const tabId = e.detail?.tabId;
      if (tabId) {
        setDraggedTabId(tabId);
        setIsDragging(true);
        isTabDragActive = true;
      }
    };

    const handleCustomEnd = () => {
      isTabDragActive = false;
      setIsDragging(false);
      setHoveredZone(null);
      setDraggedTabId(null);
    };

    const handleDragEnter = (e: DragEvent) => {
      // ONLY trigger split overlay if dragging a workstation tab specifically
      if (e.dataTransfer?.types.includes('application/x-workstation-tab') || isTabDragActive) {
        e.preventDefault();
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false);
        setHoveredZone(null);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/x-workstation-tab') || isTabDragActive) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
      }
    };

    const handleDrop = (e: DragEvent) => {
      setIsDragging(false);
      setHoveredZone(null);
      setDraggedTabId(null);
      isTabDragActive = false;
    };

    window.addEventListener('workstation-tab-drag-start', handleCustomStart);
    window.addEventListener('workstation-tab-drag-end', handleCustomEnd);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('workstation-tab-drag-start', handleCustomStart);
      window.removeEventListener('workstation-tab-drag-end', handleCustomEnd);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto flex flex-row">
      {/* Right Drop Zone (Primary Side in RTL) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (hoveredZone !== 'right') setHoveredZone('right');
        }}
        onDragLeave={() => {
          if (hoveredZone === 'right') setHoveredZone(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const tabId = e.dataTransfer.getData('text/plain') || draggedTabId;
          setIsDragging(false);
          setHoveredZone(null);
          if (tabId) {
            onDropRight(tabId);
          }
        }}
        className={`w-1/2 h-full transition-all duration-200 border-4 border-dashed m-3 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md ${
          hoveredZone === 'right'
            ? 'bg-blue-600/30 border-blue-500 scale-[0.98] shadow-2xl shadow-blue-500/30'
            : 'bg-blue-900/10 border-blue-400/50'
        }`}
      >
        <div className="p-4 rounded-2xl bg-white/90 dark:bg-zinc-900/90 text-blue-600 dark:text-blue-400 shadow-xl flex flex-col items-center gap-2 max-w-xs text-center border border-blue-200 dark:border-blue-800 pointer-events-none">
          <Columns size={32} className="animate-bounce" />
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">
            رها کنید تا در پنجره سمت راست باز شود
          </h3>
          <p className="text-[11px] text-zinc-500 font-medium">
            قرارگیری به عنوان برنامه اصلی (راست)
          </p>
        </div>
      </div>

      {/* Left Drop Zone (Secondary / Split Side) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (hoveredZone !== 'left') setHoveredZone('left');
        }}
        onDragLeave={() => {
          if (hoveredZone === 'left') setHoveredZone(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const tabId = e.dataTransfer.getData('text/plain') || draggedTabId;
          setIsDragging(false);
          setHoveredZone(null);
          if (tabId) {
            onDropLeft(tabId);
          }
        }}
        className={`w-1/2 h-full transition-all duration-200 border-4 border-dashed m-3 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md ${
          hoveredZone === 'left'
            ? 'bg-purple-600/30 border-purple-500 scale-[0.98] shadow-2xl shadow-purple-500/30'
            : 'bg-purple-900/10 border-purple-400/50'
        }`}
      >
        <div className="p-4 rounded-2xl bg-white/90 dark:bg-zinc-900/90 text-purple-600 dark:text-purple-400 shadow-xl flex flex-col items-center gap-2 max-w-xs text-center border border-purple-200 dark:border-purple-800 pointer-events-none">
          <Columns size={32} className="animate-bounce" />
          <h3 className="font-black text-sm text-zinc-900 dark:text-white">
            رها کنید تا در پنجره کناری (اسپلیت ویو) باز شود
          </h3>
          <p className="text-[11px] text-zinc-500 font-medium">
            مشاهده و کار همزمان با پنجره فعال جاری
          </p>
        </div>
      </div>
    </div>
  );
};
