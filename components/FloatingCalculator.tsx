import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calculator, X, Minus, Copy, Check, RotateCcw, Keyboard } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../constants';

interface FloatingCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}

export const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({
  isOpen,
  onClose,
  onMinimize,
  isMinimized
}) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  const displayRef = useRef(display);
  const equationRef = useRef(equation);
  const isCalculatedRef = useRef(isCalculated);

  useEffect(() => {
    displayRef.current = display;
    equationRef.current = equation;
    isCalculatedRef.current = isCalculated;
  }, [display, equation, isCalculated]);

  const handleDigit = useCallback((d: string) => {
    if (isCalculatedRef.current || displayRef.current === '0') {
      setDisplay(d);
      setIsCalculated(false);
    } else {
      if (displayRef.current.length < 15) {
        setDisplay(prev => prev + d);
      }
    }
  }, []);

  const handleDot = useCallback(() => {
    if (isCalculatedRef.current) {
      setDisplay('0.');
      setIsCalculated(false);
      return;
    }
    if (!displayRef.current.includes('.')) {
      setDisplay(prev => prev + '.');
    }
  }, []);

  const handleOperator = useCallback((op: string) => {
    setIsCalculated(false);
    setEquation(displayRef.current + ' ' + op + ' ');
    setDisplay('0');
  }, []);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setIsCalculated(false);
  }, []);

  const handleCalculate = useCallback(() => {
    const curEq = equationRef.current;
    if (!curEq) return;
    try {
      const parts = curEq.trim().split(' ');
      const num1 = parseFloat(parts[0]);
      const op = parts[1];
      const num2 = parseFloat(displayRef.current);
      let res = 0;
      if (op === '+') res = num1 + num2;
      else if (op === '-') res = num1 - num2;
      else if (op === '×' || op === '*') res = num1 * num2;
      else if (op === '÷' || op === '/') {
        if (num2 === 0) {
          setDisplay('خطای تقسیم بر صفر');
          setIsCalculated(true);
          return;
        }
        res = num1 / num2;
      } else if (op === '%') {
        res = (num1 * num2) / 100;
      }
      const finalVal = Math.round(res * 10000) / 10000;
      setDisplay(String(finalVal));
      setEquation(curEq + displayRef.current + ' =');
      setIsCalculated(true);
    } catch {
      setDisplay('خطا');
    }
  }, []);

  const handleBackspace = useCallback(() => {
    if (isCalculatedRef.current) {
      setDisplay('0');
      setIsCalculated(false);
      return;
    }
    setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }, []);

  const windowRef = useRef<HTMLDivElement>(null);

  // Auto-focus calculator container when opened or un-minimized
  useEffect(() => {
    if (isOpen && !isMinimized) {
      const timer = setTimeout(() => {
        windowRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMinimized]);

  // Global Alt+C shortcut to focus or toggle calculator from anywhere
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'ç')) || e.key === 'F4') {
        e.preventDefault();
        if (!isOpen) {
          onMinimize(); // If controlled by parent or toggle
        } else if (isMinimized) {
          onMinimize();
        } else {
          windowRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isOpen, isMinimized, onMinimize]);

  // Keyboard navigation & Numpad support
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in a form input or textarea outside, check if activeElement is an input/textarea
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      
      // If focus is specifically on an input that isn't the calculator, ignore
      if (isInput && !target.closest('#floating-calculator-window')) {
        return;
      }

      const key = e.key;

      // Digits (0-9) and Persian digits (۰-۹)
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        handleDigit(key);
      } else if (/^[۰-۹]$/.test(key)) {
        e.preventDefault();
        const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        handleDigit(String(farsiDigits.indexOf(key)));
      } else if (key === '.' || key === '/') {
        if (key === '.') {
          e.preventDefault();
          handleDot();
        } else if (key === '/') {
          e.preventDefault();
          handleOperator('÷');
        }
      } else if (key === '+' || key === '-') {
        e.preventDefault();
        handleOperator(key);
      } else if (key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (key === '%') {
        e.preventDefault();
        handleOperator('%');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === 'Escape') {
        e.preventDefault();
        if (displayRef.current !== '0' || equationRef.current) {
          handleClear();
        } else {
          onMinimize();
        }
      } else if (key === 'Delete' || key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isMinimized, handleDigit, handleDot, handleOperator, handleCalculate, handleBackspace, handleClear, onMinimize]);

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div 
        onClick={onMinimize}
        className="fixed bottom-16 left-6 z-[9999] bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-2xl shadow-xl flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95 border border-emerald-400/40"
        title="ماشین‌حساب (کوچک شده - میانبر Alt+C)"
      >
        <Calculator size={18} />
        <span className="text-xs font-bold font-mono dir-ltr">{formatCurrency(parseFloat(display.replace(/,/g, '')) || 0)}</span>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(display.replace(/,/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      ref={windowRef}
      id="floating-calculator-window"
      tabIndex={0}
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-20 left-4 sm:left-8 z-[9999] w-72 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl rounded-2xl border-2 border-emerald-500/70 dark:border-emerald-500/50 shadow-2xl overflow-hidden text-zinc-800 dark:text-zinc-100 flex flex-col focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
    >
      {/* Header */}
      <div className="bg-zinc-100/90 dark:bg-zinc-900/90 px-3.5 py-2.5 flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-emerald-500" />
          <span className="text-xs font-bold">ماشین‌حساب مالی</span>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5" title="کلیدهای کیبورد و Numpad متصل است (میانبر Alt+C)">
            <Keyboard size={10} />
            <span>Numpad فعال</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            type="button" 
            onClick={handleCopy} 
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-zinc-500 transition-colors" 
            title="کپی نتیجه (Ctrl+C)"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          <button 
            type="button" 
            onClick={onMinimize} 
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-zinc-500 transition-colors" 
            title="کوچک کردن"
          >
            <Minus size={14} />
          </button>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-500 rounded-md transition-colors" 
            title="بستن (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Screen */}
      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 flex flex-col items-end justify-end min-h-[76px] border-b border-zinc-200/40 dark:border-zinc-800/40">
        <div className="text-[11px] text-zinc-400 font-mono h-4 truncate dir-ltr">{equation}</div>
        <div className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white truncate max-w-full dir-ltr">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="p-3 grid grid-cols-4 gap-1.5 text-xs font-bold">
        <button type="button" onClick={handleClear} className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 transition-colors" title="پاک کردن (C / Delete)">C</button>
        <button type="button" onClick={() => handleOperator('%')} className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 transition-colors" title="درصد (%)">%</button>
        <button type="button" onClick={() => handleOperator('÷')} className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors" title="تقسیم (/)">÷</button>
        <button type="button" onClick={() => handleOperator('×')} className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors" title="ضرب (*)">×</button>

        <button type="button" onClick={() => handleDigit('7')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">7</button>
        <button type="button" onClick={() => handleDigit('8')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">8</button>
        <button type="button" onClick={() => handleDigit('9')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">9</button>
        <button type="button" onClick={() => handleOperator('-')} className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors" title="تفریق (-)">-</button>

        <button type="button" onClick={() => handleDigit('4')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">4</button>
        <button type="button" onClick={() => handleDigit('5')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">5</button>
        <button type="button" onClick={() => handleDigit('6')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">6</button>
        <button type="button" onClick={() => handleOperator('+')} className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors" title="جمع (+)">+</button>

        <button type="button" onClick={() => handleDigit('1')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">1</button>
        <button type="button" onClick={() => handleDigit('2')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">2</button>
        <button type="button" onClick={() => handleDigit('3')} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">3</button>
        <button type="button" onClick={handleCalculate} className="row-span-2 p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black text-base shadow-md transition-colors" title="محاسبه (Enter / =)">=</button>

        <button type="button" onClick={() => handleDigit('0')} className="col-span-2 p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors">0</button>
        <button type="button" onClick={handleDot} className="p-2.5 bg-zinc-100/80 dark:bg-zinc-900/60 rounded-xl hover:bg-zinc-200 transition-colors" title="نقطه (.)">.</button>
      </div>
    </motion.div>
  );
};
