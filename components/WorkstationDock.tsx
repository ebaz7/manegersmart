import React, { useState } from 'react';
import { 
  Columns, LayoutDashboard, Receipt, Truck, FileText, 
  Warehouse, ArrowLeftRight, MessageSquare, Briefcase, 
  Users, Settings, Shield, ShoppingCart, Calendar, Mail, 
  Sparkles, X, Minus, Maximize2, Calculator, StickyNote, 
  ChevronUp, ChevronDown, CheckSquare, Layers, Monitor,
  LayoutGrid, BadgePlus, ScrollText, ClipboardCheck,
  ShieldCheck, CalendarDays, FolderArchive, Banknote,
  MessagesSquare, BookOpen, Globe, Wallet, Boxes,
  Handshake, Headset, UserCog, BarChart3, FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';

interface WorkstationDockProps {
  activeTab: string;
  secondaryTab: string | null;
  tertiaryTab?: string | null;
  quaternaryTab?: string | null;
  splitLayoutMode?: 'dual' | 'quad';
  openTabs: string[];
  onSelectTab: (tabId: string) => void;
  onOpenSplitView: () => void;
  onCloseSecondaryTab: () => void;
  onCloseSplitPane?: (slot: number) => void;
  onFloatTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onToggleCalculator: () => void;
  isCalculatorOpen: boolean;
  floatingTab: string | null;
  currentUser: User | null;
  allowedItems?: Array<{ id: string; label: string; icon?: any }>;
}

export const WorkstationDock: React.FC<WorkstationDockProps> = ({
  activeTab,
  secondaryTab,
  tertiaryTab,
  quaternaryTab,
  splitLayoutMode = 'dual',
  openTabs,
  onSelectTab,
  onOpenSplitView,
  onCloseSecondaryTab,
  onCloseSplitPane,
  onFloatTab,
  onCloseTab,
  onToggleCalculator,
  isCalculatorOpen,
  floatingTab,
  allowedItems
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Exact Sidebar labels and icon mapping
  const getTabInfo = (tabId: string) => {
    const found = allowedItems?.find(i => i.id === tabId);
    if (found) return { label: found.label, Icon: found.icon || FileText };

    switch (tabId) {
      case 'dashboard': return { label: 'داشبورد', Icon: LayoutDashboard };
      case 'create': return { label: 'ثبت پرداخت', Icon: BadgePlus };
      case 'manage': return { label: 'سوابق پرداخت', Icon: Receipt };
      case 'ccti': return { label: 'تبدیل CCTI', Icon: ArrowLeftRight };
      case 'create-exit': return { label: 'ثبت خروج', Icon: Truck };
      case 'manage-invoices': return { label: 'مدیریت فاکتورها', Icon: ScrollText };
      case 'manage-exit': return { label: 'سوابق خروج', Icon: ClipboardCheck };
      case 'warehouse': return { label: 'مدیریت انبار', Icon: Warehouse };
      case 'sayan': return { label: 'گزارشات سایان', Icon: BarChart3 };
      case 'sayan-operations': return { label: 'ثبت‌های سایان', Icon: FileCheck2 };
      case 'security': return { label: 'انتظامات', Icon: ShieldCheck };
      case 'meetings': return { label: 'جلسات تولید', Icon: CalendarDays };
      case 'purchase': return { label: 'درخواست خرید', Icon: ShoppingCart };
      case 'secretariat': return { label: 'دبیرخانه اداری', Icon: FolderArchive };
      case 'cheque-receipts': return { label: 'رسید دریافت چک', Icon: Banknote };
      case 'chat': return { label: 'گفتگو', Icon: MessagesSquare };
      case 'knowledge':
      case 'notes': return { label: 'اطلاعات و یادداشت ها', Icon: BookOpen };
      case 'trade': return { label: 'بازرگانی', Icon: Globe };
      case 'balances': return { label: 'مانده حساب مشتریان', Icon: Wallet };
      case 'products': return { label: 'کالاها', Icon: Boxes };
      case 'sales': return { label: 'مشتریان', Icon: Handshake };
      case 'tickets': return { label: 'تیکت‌ها', Icon: Headset };
      case 'users': return { label: 'کاربران', Icon: UserCog };
      case 'settings': return { label: 'تنظیمات', Icon: Settings };
      default: return { label: tabId, Icon: Layers };
    }
  };

  const isSplitActive = Boolean(secondaryTab || tertiaryTab || quaternaryTab);
  const isQuadSplit = isSplitActive && (splitLayoutMode === 'quad' || Boolean(tertiaryTab || quaternaryTab));

  // Permitted tabs whitelist for current user
  const allowedTabIds = allowedItems && allowedItems.length > 0 
    ? new Set(allowedItems.map(i => i.id)) 
    : null;

  // Unique list of open tabs to show in the taskbar dock (filtered strictly by user permissions)
  const displayTabs = Array.from(new Set([
    'dashboard',
    activeTab,
    ...(secondaryTab ? [secondaryTab] : []),
    ...(tertiaryTab ? [tertiaryTab] : []),
    ...(quaternaryTab ? [quaternaryTab] : []),
    ...(floatingTab ? [floatingTab] : []),
    ...openTabs
  ])).filter(tabId => {
    if (!tabId) return false;
    if (tabId === 'dashboard') return true;
    if (allowedTabIds) return allowedTabIds.has(tabId);
    return true;
  });

  if (isCollapsed) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9995] hidden md:block">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="bg-zinc-900/90 hover:bg-zinc-900 text-white px-3 py-1.5 rounded-full shadow-2xl border border-zinc-700/60 backdrop-blur-2xl flex items-center gap-1.5 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
          title="نمایش نوار وظیفه چندپنجره‌ای (Taskbar)"
        >
          <Monitor size={13} className="text-blue-400" />
          <span>میز کار ({displayTabs.length})</span>
          <ChevronUp size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9995] hidden md:flex items-center gap-1.5 bg-white/95 dark:bg-zinc-950/95 border border-zinc-200/90 dark:border-zinc-800/90 p-1.5 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.22)] backdrop-blur-2xl max-w-[94vw] animate-slide-up select-none pointer-events-auto">
      {/* Workspace Indicator & Collapse toggle */}
      <div className="flex items-center gap-1 pl-1.5 border-l border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          title="جمع‌کردن نوار میز کار"
        >
          <ChevronDown size={14} />
        </button>
        <div className="flex items-center gap-1.5 px-1">
          <Monitor size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tight">وظایف</span>
        </div>
      </div>

      {/* Open Tabs on the Taskbar */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-[65vw] custom-scrollbar py-0.5 px-1">
        {displayTabs.map((tabId) => {
          const { label, Icon } = getTabInfo(tabId);
          const isPrimary = activeTab === tabId;
          const isSecondary = secondaryTab === tabId;
          const isTertiary = tertiaryTab === tabId;
          const isQuaternary = quaternaryTab === tabId;
          const isFloating = floatingTab === tabId;
          const isActive = isPrimary || isSecondary || isTertiary || isQuaternary;

          return (
            <div
              key={tabId}
              draggable
              data-tab-id={tabId}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', tabId);
                e.dataTransfer.effectAllowed = 'copyMove';
              }}
              onClick={() => onSelectTab(tabId)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none group relative ${
                isPrimary
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/50'
                  : isSecondary
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/50'
                    : isTertiary
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/50'
                      : isQuaternary
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25 ring-1 ring-amber-400/50'
                        : isFloating
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                          : 'bg-zinc-100/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 border border-transparent'
              }`}
              title={`${label} ${isPrimary ? '(پنجره ۱ اصلی)' : isSecondary ? '(پنجره ۲)' : isTertiary ? '(پنجره ۳)' : isQuaternary ? '(پنجره ۴)' : isFloating ? '(پنجره شناور)' : ''} - برای اسپلیت به چپ یا راست بکشید`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-zinc-500 group-hover:text-blue-500'} />
              <span className="truncate max-w-[110px]">{label}</span>

              {/* Status Badges */}
              {isPrimary && isSplitActive && (
                <span className="text-[8px] bg-white/25 px-1 py-0.2 rounded font-mono">پنجره ۱</span>
              )}
              {isSecondary && (
                <span className="text-[8px] bg-white/25 px-1 py-0.2 rounded font-mono">پنجره ۲</span>
              )}
              {isTertiary && (
                <span className="text-[8px] bg-white/25 px-1 py-0.2 rounded font-mono">پنجره ۳</span>
              )}
              {isQuaternary && (
                <span className="text-[8px] bg-white/25 px-1 py-0.2 rounded font-mono">پنجره ۴</span>
              )}
              {isFloating && (
                <span className="text-[8px] bg-amber-500 text-white px-1 py-0.2 rounded font-mono">شناور</span>
              )}

              {/* Quick Close option on hover */}
              {!isPrimary && tabId !== 'dashboard' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSecondary) {
                      if (onCloseSplitPane) onCloseSplitPane(2);
                      else onCloseSecondaryTab();
                    } else if (isTertiary) {
                      if (onCloseSplitPane) onCloseSplitPane(3);
                    } else if (isQuaternary) {
                      if (onCloseSplitPane) onCloseSplitPane(4);
                    } else if (onCloseTab) {
                      onCloseTab(tabId);
                    }
                  }}
                  className="p-0.5 hover:bg-black/20 dark:hover:bg-white/20 rounded-md transition-colors ml-0.5 opacity-60 group-hover:opacity-100"
                  title="بستن پنجره"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Dock Actions Right Side */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-zinc-200 dark:border-zinc-800">
        {/* Split View Button */}
        <button
          type="button"
          onClick={onOpenSplitView}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            isSplitActive
              ? isQuadSplit
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30'
          }`}
          title={isSplitActive ? 'مدیریت و تنظیمات اسپلیت ویو (۲تایی یا ۴تایی)' : 'مشاهده همزمان منوها (اسپلیت ۲تایی یا ۴تایی)'}
        >
          {isQuadSplit ? (
            <LayoutGrid size={14} className="text-emerald-600 animate-pulse" />
          ) : (
            <Columns size={14} className={isSplitActive ? 'text-purple-600' : 'text-blue-600'} />
          )}
          <span className="hidden lg:inline">
            {isQuadSplit ? 'اسپلیت ۴ تایی' : isSplitActive ? 'اسپلیت ۲ تایی' : 'اسپلیت ویو'}
          </span>
        </button>

        {/* Floating Calculator Button */}
        <button
          type="button"
          onClick={onToggleCalculator}
          className={`p-1.5 rounded-xl text-xs font-bold transition-all ${
            isCalculatorOpen
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          }`}
          title="ماشین‌حساب شناور"
        >
          <Calculator size={15} />
        </button>

        {/* Close Split View (if open) */}
        {isSplitActive && (
          <button
            type="button"
            onClick={onCloseSecondaryTab}
            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors"
            title="بستن اسپلیت و بازگشت به تک‌پنجره"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

