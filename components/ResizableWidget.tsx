import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronUp, ChevronDown, X, Maximize2, Minimize2, Move, RotateCcw, 
  Columns, GripHorizontal, ArrowLeftRight, Check
} from 'lucide-react';

export interface WidgetSize {
  widthPercent?: number; // 25 to 100
  minHeight?: number;    // in pixels
}

interface ResizableWidgetProps {
  id: string;
  title: string;
  orderIndex: number;
  isFirst: boolean;
  isLast: boolean;
  isCustomizing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  size?: WidgetSize;
  onSizeChange: (newSize: WidgetSize) => void;
  onResetSize: () => void;
  children: React.ReactNode;
  defaultWidthPercent?: number;
  className?: string;
}

export const ResizableWidget: React.FC<ResizableWidgetProps> = ({
  id,
  title,
  orderIndex,
  isFirst,
  isLast,
  isCustomizing,
  onMoveUp,
  onMoveDown,
  onRemove,
  size,
  onSizeChange,
  onResetSize,
  children,
  defaultWidthPercent = 100,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeMode, setResizeMode] = useState<'both' | 'width' | 'height' | null>(null);
  const [tempSize, setTempSize] = useState<WidgetSize | null>(null);
  const [showQuickSizes, setShowQuickSizes] = useState(false);

  // Active size calculation
  const currentWidthPercent = tempSize?.widthPercent ?? size?.widthPercent ?? defaultWidthPercent;
  const currentMinHeight = tempSize?.minHeight ?? size?.minHeight;

  // Mouse Drag Resize Handler
  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    mode: 'both' | 'width' | 'height'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = containerRef.current.getBoundingClientRect();
    const initialWidthPx = rect.width;
    const initialHeightPx = rect.height;

    // Get parent width to calculate percentage
    const parent = containerRef.current.parentElement;
    const parentWidthPx = parent ? parent.getBoundingClientRect().width : window.innerWidth;

    setIsResizing(true);
    setResizeMode(mode);

    // Temporarily disable text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'both' ? 'nwse-resize' : mode === 'width' ? 'ew-resize' : 'ns-resize';

    let lastCalculatedSize: WidgetSize = {
      widthPercent: currentWidthPercent,
      minHeight: currentMinHeight ?? initialHeightPx,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidthPercent = currentWidthPercent;
      let newHeightPx = currentMinHeight ?? initialHeightPx;

      // In Persian RTL layout: dragging mouse to the LEFT increases width
      // and dragging to the RIGHT decreases width
      if (mode === 'both' || mode === 'width') {
        const adjustedDeltaX = -deltaX; // In RTL, left is positive growth
        const newWidthPx = Math.max(260, Math.min(parentWidthPx, initialWidthPx + adjustedDeltaX));
        let rawPercent = Math.round((newWidthPx / parentWidthPx) * 100);

        // Snap to common clean steps if close (33%, 50%, 66%, 75%, 100%)
        if (Math.abs(rawPercent - 33.33) < 4) rawPercent = 33.33;
        else if (Math.abs(rawPercent - 50) < 4) rawPercent = 50;
        else if (Math.abs(rawPercent - 66.66) < 4) rawPercent = 66.66;
        else if (Math.abs(rawPercent - 75) < 4) rawPercent = 75;
        else if (rawPercent > 92) rawPercent = 100;
        else if (rawPercent < 28) rawPercent = 25;

        newWidthPercent = Math.min(100, Math.max(25, rawPercent));
      }

      if (mode === 'both' || mode === 'height') {
        newHeightPx = Math.max(90, Math.min(1200, Math.round(initialHeightPx + deltaY)));
      }

      lastCalculatedSize = {
        widthPercent: newWidthPercent,
        minHeight: newHeightPx,
      };

      setTempSize(lastCalculatedSize);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      setIsResizing(false);
      setResizeMode(null);
      setTempSize(null);

      onSizeChange(lastCalculatedSize);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [currentWidthPercent, currentMinHeight, onSizeChange]);

  // Clean responsive width style
  const getResponsiveStyle = (): React.CSSProperties => {
    const style: React.CSSProperties = {
      order: orderIndex,
    };

    // On desktop, apply width percentage and flex-basis
    if (currentWidthPercent && currentWidthPercent < 100) {
      style.flex = `0 0 calc(${currentWidthPercent}% - 0.9rem)`;
      style.maxWidth = `calc(${currentWidthPercent}% - 0.9rem)`;
      style.minWidth = '280px';
    } else {
      style.flex = '1 1 100%';
      style.width = '100%';
      style.maxWidth = '100%';
    }

    if (currentMinHeight) {
      style.minHeight = `${currentMinHeight}px`;
    }

    return style;
  };

  const isCustomizedSize = size?.widthPercent !== undefined || size?.minHeight !== undefined;

  return (
    <div
      ref={containerRef}
      id={`widget-${id}`}
      style={getResponsiveStyle()}
      className={`relative group transition-[flex,width,max-width] duration-150 ease-out flex flex-col ${
        isResizing ? 'ring-2 ring-blue-500 shadow-xl z-30' : ''
      } ${className}`}
    >
      {/* Real-time floating dimension badge while dragging with mouse */}
      {isResizing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg border border-blue-400 flex items-center gap-2 animate-fade-in pointer-events-none">
          <ArrowLeftRight size={12} />
          <span>عرض: {Math.round(currentWidthPercent)}٪</span>
          {currentMinHeight && (
            <>
              <span className="opacity-40">|</span>
              <span>ارتفاع: {Math.round(currentMinHeight)}px</span>
            </>
          )}
        </div>
      )}

      {/* Top Customizer Bar (visible in customize mode or on desktop hover) */}
      {(isCustomizing || showQuickSizes) && (
        <div className="absolute -top-3.5 right-3 z-40 flex items-center gap-1 bg-zinc-900/90 hover:bg-zinc-900 text-white rounded-xl px-2 py-1 shadow-lg border border-zinc-700/60 backdrop-blur-md animate-fade-in text-[10px]">
          <span className="font-bold text-zinc-300 ml-1 hidden sm:inline max-w-[120px] truncate">{title}</span>

          {/* Quick preset width buttons */}
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5 mr-1">
            <button
              type="button"
              onClick={() => onSizeChange({ widthPercent: 33.33, minHeight: currentMinHeight })}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                Math.round(currentWidthPercent) === 33 ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="سایز ۳۳٪ (یک‌سوم صفحه)"
            >
              ۳۳٪
            </button>
            <button
              type="button"
              onClick={() => onSizeChange({ widthPercent: 50, minHeight: currentMinHeight })}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                Math.round(currentWidthPercent) === 50 ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="سایز ۵۰٪ (نیم‌صفحه)"
            >
              ۵۰٪
            </button>
            <button
              type="button"
              onClick={() => onSizeChange({ widthPercent: 75, minHeight: currentMinHeight })}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                Math.round(currentWidthPercent) === 75 ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="سایز ۷۵٪"
            >
              ۷۵٪
            </button>
            <button
              type="button"
              onClick={() => onSizeChange({ widthPercent: 100, minHeight: currentMinHeight })}
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold transition-all cursor-pointer ${
                Math.round(currentWidthPercent) === 100 ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
              title="سایز ۱۰۰٪ (تمام‌عرض)"
            >
              ۱۰۰٪
            </button>
          </div>

          {/* Reset button if custom size exists */}
          {isCustomizedSize && (
            <button
              type="button"
              onClick={onResetSize}
              className="p-1 hover:bg-zinc-800 rounded text-amber-400 transition-all cursor-pointer flex items-center gap-0.5 text-[9px]"
              title="بازنشانی اندازه به حالت پیش‌فرض"
            >
              <RotateCcw size={11} />
              <span className="hidden md:inline">پیش‌فرض</span>
            </button>
          )}

          {/* Reordering and remove buttons */}
          <div className="flex items-center gap-0.5 border-r border-zinc-700 pr-1 mr-0.5">
            <button
              type="button"
              disabled={isFirst}
              onClick={onMoveUp}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer text-zinc-300"
              title="انتقال به جلو"
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              disabled={isLast}
              onClick={onMoveDown}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-30 transition-all flex items-center justify-center cursor-pointer text-zinc-300"
              title="انتقال به عقب"
            >
              <ChevronDown size={12} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="p-1 hover:bg-red-600 rounded transition-all flex items-center justify-center cursor-pointer bg-red-500/80 text-white"
              title="حذف ابزارک از پیشخوان"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Widget Content Container */}
      <div 
        className="w-full flex-1 flex flex-col relative"
        style={{ minHeight: currentMinHeight ? `${currentMinHeight}px` : undefined }}
      >
        {children}
      </div>

      {/* --- MOUSE DRAG RESIZE HANDLES --- */}
      {/* 1. Bottom-Left Corner Resize Handle (in RTL, left is where dragging expands width and bottom expands height) */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'both')}
        onDoubleClick={onResetSize}
        className="absolute -bottom-1 -left-1 z-30 w-5 h-5 flex items-center justify-center cursor-nesw-resize opacity-0 group-hover:opacity-90 hover:!opacity-100 transition-opacity select-none"
        title="بکشید تا اندازه (عرض و ارتفاع) تغییر کند (دابل‌کلیک برای بازنشانی)"
      >
        <div className="w-3.5 h-3.5 rounded-bl-md border-b-2 border-l-2 border-blue-500 bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center">
          <div className="w-1 h-1 bg-blue-500 rounded-full" />
        </div>
      </div>

      {/* 2. Bottom-Right Corner Handle (alternate corner) */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'both')}
        onDoubleClick={onResetSize}
        className="absolute -bottom-1 -right-1 z-30 w-5 h-5 flex items-center justify-center cursor-nwse-resize opacity-0 group-hover:opacity-90 hover:!opacity-100 transition-opacity select-none"
        title="بکشید تا اندازه تغییر کند"
      >
        <div className="w-3.5 h-3.5 rounded-br-md border-b-2 border-r-2 border-blue-500 bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center">
          <div className="w-1 h-1 bg-blue-500 rounded-full" />
        </div>
      </div>

      {/* 3. Bottom Edge Resize Handle (Adjust height) */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'height')}
        onDoubleClick={onResetSize}
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 w-16 h-3 flex items-center justify-center cursor-ns-resize opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-opacity select-none"
        title="بکشید تا ارتفاع تنظیم شود"
      >
        <div className="w-10 h-1 rounded-full bg-blue-500/70 shadow-sm" />
      </div>

      {/* 4. Left Edge Resize Handle (Adjust width) */}
      <div
        onMouseDown={(e) => handleMouseDown(e, 'width')}
        onDoubleClick={onResetSize}
        className="absolute top-1/2 -left-1.5 -translate-y-1/2 z-20 w-3 h-16 flex items-center justify-center cursor-ew-resize opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-opacity select-none"
        title="بکشید تا عرض تنظیم شود"
      >
        <div className="w-1 h-10 rounded-full bg-blue-500/70 shadow-sm" />
      </div>
    </div>
  );
};
