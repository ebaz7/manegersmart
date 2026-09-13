import React, { useState, useMemo } from 'react';
import { 
  Columns, X, Calculator, ChevronUp, ChevronDown, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, SystemSettings } from '../types';
import { AppNavItem, getAppNavItems, getSidebarLabel, getSidebarIcon, ALL_NAVIGATION_ITEMS } from '../utils/navigationItems';

interface WorkstationDockProps {
  activeTab: string;
  secondaryTab: string | null;
  openTabs: string[];
  onSelectTab: (tabId: string) => void;
  onOpenSplitView: () => void;
  onCloseSecondaryTab: () => void;
  onFloatTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onToggleCalculator: () => void;
  isCalculatorOpen: boolean;
  floatingTab: string | null;
  currentUser: User | null;
  settings?: SystemSettings | null;
  allowedItems?: AppNavItem[];
}

export const WorkstationDock: React.FC<WorkstationDockProps> = ({
  activeTab,
  secondaryTab,
  openTabs,
  onSelectTab,
  onOpenSplitView,
  onCloseSecondaryTab,
  onFloatTab,
  onCloseTab,
  onToggleCalculator,
  isCalculatorOpen,
  floatingTab,
  currentUser,
  settings,
  allowedItems
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Derive allowed navigation items for current user
  const permittedItems = useMemo(() => {
    if (allowedItems && allowedItems.length > 0) {
      return allowedItems;
    }
    if (currentUser) {
      return getAppNavItems(currentUser, settings || null);
    }
    return [ALL_NAVIGATION_ITEMS['dashboard']];
  }, [allowedItems, currentUser, settings]);

  const allowedSet = useMemo(() => new Set(permittedItems.map(i => i.id)), [permittedItems]);

  // Tab label and icon strictly matched with the sidebar
  const getTabInfo = (tabId: string) => {
    const label = getSidebarLabel(tabId, permittedItems);
    const Icon = getSidebarIcon(tabId, permittedItems);
    return { label, Icon };
  };

  // Unique list of open tabs to show in the taskbar dock - STRICTLY FILTERED BY USER PERMISSIONS
  const displayTabs = Array.from(new Set([
    'dashboard',
    activeTab,
    ...(secondaryTab ? [secondaryTab] : []),
    ...(floatingTab ? [floatingTab] : []),
    ...openTabs
  ])).filter(tabId => Boolean(tabId) && allowedSet.has(tabId));

  if (isCollapsed) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9980] hidden md:block">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="bg-zinc-900/85 hover:bg-zinc-900 text-white px-3 py-1.5 rounded-full shadow-lg border border-zinc-700/60 backdrop-blur-xl flex items-center gap-1.5 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
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
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-[9980] hidden md:flex items-center gap-1.5 bg-white/85 dark:bg-zinc-950/85 border border-zinc-200/80 dark:border-zinc-800/80 p-1.5 rounded-2xl shadow-[0_12px_30px_rgba(0,0,0,0.15)] backdrop-blur-xl max-w-[94vw] animate-slide-up select-none">
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
          const isFloating = floatingTab === tabId;
          const isActive = isPrimary || isSecondary;

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
                    : isFloating
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                      : 'bg-zinc-100/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-800/80 border border-transparent'
              }`}
              title={`${label} ${isPrimary ? '(پنجره فعال)' : isSecondary ? '(پنجره اسپلیت)' : isFloating ? '(پنجره شناور)' : ''} - برای اسپلیت به چپ یا راست بکشید`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-zinc-500 group-hover:text-blue-500'} />
              <span className="truncate max-w-[90px]">{label}</span>

              {/* Status Badge */}
              {isSecondary && (
                <span className="text-[8px] bg-white/25 px-1 py-0.2 rounded font-mono">اسپلیت</span>
              )}
              {isFloating && (
                <span className="text-[8px] bg-amber-500 text-white px-1 py-0.2 rounded font-mono">شناور</span>
              )}

              {/* Quick Split / Close options on hover */}
              {!isPrimary && tabId !== 'dashboard' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSecondary) onCloseSecondaryTab();
                    else if (onCloseTab) onCloseTab(tabId);
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
            secondaryTab
              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30'
          }`}
          title={secondaryTab ? 'تغییر یا مدیریت صفحه همزمان (Split View)' : 'مشاهده همزمان منوها (Split View)'}
        >
          <Columns size={14} className={secondaryTab ? 'text-purple-600' : 'text-blue-600'} />
          <span className="hidden lg:inline">{secondaryTab ? 'همزمان (فعال)' : 'مشاهده همزمان'}</span>
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

        {/* Close Secondary Pane (if open) */}
        {secondaryTab && (
          <button
            type="button"
            onClick={onCloseSecondaryTab}
            className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors"
            title="بستن پنجره دوم و بازگشت به تک‌پنجره"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
