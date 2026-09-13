import React, { useState } from 'react';
import { 
  X, Columns, LayoutDashboard, Receipt, Truck, FileText, 
  Warehouse, ArrowLeftRight, MessageSquare, Briefcase, 
  Users, Settings, Shield, ShoppingCart, Calendar, Mail, 
  Sparkles, CheckCircle2, LayoutGrid, BadgePlus, ScrollText,
  ClipboardCheck, ShieldCheck, CalendarDays, FolderArchive,
  Banknote, MessagesSquare, BookOpen, Globe, Wallet,
  Boxes, Handshake, Headset, UserCog, BarChart3, FileCheck2,
  Layers, Check
} from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';

interface SplitViewSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  secondaryTab: string | null;
  tertiaryTab?: string | null;
  quaternaryTab?: string | null;
  splitLayoutMode?: 'dual' | 'quad';
  onSelectSecondaryTab?: (tabId: string) => void;
  onSelectModuleForSplit?: (tabId: string) => void;
  onSelectSlotTab?: (slotIndex: number, tabId: string) => void;
  onApplyQuadPreset?: (panes: [string, string, string, string]) => void;
  onCloseSplit?: () => void;
  currentUser?: User | null;
  allowedItems?: Array<{ id: string; label: string; icon?: any }>;
}

export const SplitViewSelectorModal: React.FC<SplitViewSelectorModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  secondaryTab,
  tertiaryTab,
  quaternaryTab,
  splitLayoutMode = 'dual',
  onSelectSecondaryTab,
  onSelectModuleForSplit,
  onSelectSlotTab,
  onApplyQuadPreset,
  onCloseSplit,
  allowedItems
}) => {
  const [currentMode, setCurrentMode] = useState<'dual' | 'quad'>(
    splitLayoutMode === 'quad' || Boolean(tertiaryTab || quaternaryTab) ? 'quad' : 'dual'
  );
  const [selectedTargetSlot, setSelectedTargetSlot] = useState<number>(2); // 1, 2, 3, 4

  if (!isOpen) return null;

  // Exact Sidebar items and icons
  const defaultAvailableItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, desc: 'آمار و وضعیت کلی سازمان' },
    { id: 'create', label: 'ثبت پرداخت', icon: BadgePlus, desc: 'ثبت حواله و واریز جدید' },
    { id: 'manage', label: 'سوابق پرداخت', icon: Receipt, desc: 'حواله‌ها، فاکتورها و تسویه‌ها' },
    { id: 'ccti', label: 'تبدیل CCTI', icon: ArrowLeftRight, desc: 'تبدیل و خروجی فایل‌های سی‌سی‌تی‌آی' },
    { id: 'create-exit', label: 'ثبت خروج', icon: Truck, desc: 'ثبت مجوز خروج و بارگیری کالا' },
    { id: 'manage-invoices', label: 'مدیریت فاکتورها', icon: ScrollText, desc: 'کارتابل و بررسی فاکتورهای فروش' },
    { id: 'manage-exit', label: 'سوابق خروج', icon: ClipboardCheck, desc: 'کارتابل و سوابق خروج کالا' },
    { id: 'warehouse', label: 'مدیریت انبار', icon: Warehouse, desc: 'موجودی انبار، بیجک و ورود/خروج کالا' },
    { id: 'sayan', label: 'گزارشات سایان', icon: BarChart3, desc: 'تراز، فروش، تولید و چک‌های سایان' },
    { id: 'sayan-operations', label: 'ثبت‌های سایان', icon: FileCheck2, desc: 'پیش‌فاکتور و عملیات مرتبط با سایان' },
    { id: 'security', label: 'انتظامات', icon: ShieldCheck, desc: 'ورود و خروج تریلی و بازرسی انتظامات' },
    { id: 'meetings', label: 'جلسات تولید', icon: CalendarDays, desc: 'تقویم جلسات و مصوبات خط تولید' },
    { id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart, desc: 'درخواست‌های خرید و تدارکات قطعات' },
    { id: 'secretariat', label: 'دبیرخانه اداری', icon: FolderArchive, desc: 'مکاتبات اداری، نامه‌ها و کارتابل' },
    { id: 'cheque-receipts', label: 'رسید دریافت چک', icon: Banknote, desc: 'رسید چک‌های صیادی و کارتابل تاییدیه' },
    { id: 'chat', label: 'گفتگو', icon: MessagesSquare, desc: 'پیام‌ها، کارگروه‌ها و هماهنگی' },
    { id: 'knowledge', label: 'اطلاعات و یادداشت ها', icon: BookOpen, desc: 'دفترچه یادداشت و پایگاه دانش' },
    { id: 'trade', label: 'بازرگانی', icon: Globe, desc: 'پروفرم‌ها و پرونده‌های بازرگانی' },
    { id: 'balances', label: 'مانده حساب مشتریان', icon: Wallet, desc: 'وضعیت بدهی و اعتبار مشتریان' },
    { id: 'products', label: 'کالاها', icon: Boxes, desc: 'کاتالوگ و مشخصات محصولات' },
    { id: 'sales', label: 'مشتریان', icon: Handshake, desc: 'بانک اطلاعات مشتریان و سرنخ‌ها' },
    { id: 'tickets', label: 'تیکت‌ها', icon: Headset, desc: 'تیکت‌های پشتیبانی و پیگیری' },
    { id: 'users', label: 'کاربران', icon: UserCog, desc: 'مدیریت کاربران و دسترسی‌ها' },
    { id: 'settings', label: 'تنظیمات', icon: Settings, desc: 'تنظیمات سامانه و سال مالی' },
  ];

  const items = allowedItems && allowedItems.length > 0 
    ? allowedItems.map(ai => ({
        ...ai,
        desc: defaultAvailableItems.find(d => d.id === ai.id)?.desc || 'بخش سازمانی'
      }))
    : defaultAvailableItems;

  const handleSelectModule = (tabId: string) => {
    if (onSelectSlotTab) {
      onSelectSlotTab(selectedTargetSlot, tabId);
    } else if (onSelectModuleForSplit) {
      onSelectModuleForSplit(tabId);
    } else if (onSelectSecondaryTab) {
      onSelectSecondaryTab(tabId);
    }
    onClose();
  };

  const handleCloseActiveSplit = () => {
    if (onCloseSplit) {
      onCloseSplit();
    } else if (onSelectSecondaryTab) {
      onSelectSecondaryTab('');
    }
    onClose();
  };

  const currentPanes = [
    activeTab,
    secondaryTab || 'manage',
    tertiaryTab || 'sayan',
    quaternaryTab || 'chat'
  ];

  const quickPresets: Array<{
    title: string;
    desc: string;
    panes: [string, string, string, string];
    color: string;
  }> = [
    {
      title: 'میز کار جامع مالی و چک',
      desc: 'سوابق پرداخت + گزارشات سایان + رسید دریافت چک + مانده حساب',
      panes: ['manage', 'sayan', 'cheque-receipts', 'balances'],
      color: 'from-blue-600 to-indigo-600'
    },
    {
      title: 'میز کار بازرگانی و فروش',
      desc: 'داشبورد + بازرگانی + ثبت‌های سایان + گفتگو',
      panes: ['dashboard', 'trade', 'sayan-operations', 'chat'],
      color: 'from-purple-600 to-pink-600'
    },
    {
      title: 'میز کار انبارداری و خروج',
      desc: 'مدیریت انبار + سوابق خروج + درخواست خرید + انتظامات',
      panes: ['warehouse', 'manage-exit', 'purchase', 'security'],
      color: 'from-emerald-600 to-teal-600'
    },
    {
      title: 'میز کار اداری و مدیریت',
      desc: 'داشبورد + جلسات تولید + دبیرخانه اداری + کاربران',
      panes: ['dashboard', 'meetings', 'secretariat', 'users'],
      color: 'from-amber-600 to-orange-600'
    }
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-3xl bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
              {currentMode === 'quad' ? <LayoutGrid size={22} /> : <Columns size={22} />}
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>مشاهده همزمان منوها (Split View)</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  {currentMode === 'quad' ? '۴ قسمتی ۲×۲' : '۲ قسمتی'}
                </span>
              </h3>
              <p className="text-[11px] text-blue-100 mt-0.5">
                صفحه را به ۲ یا ۴ قسمت همزمان تقسیم کنید و در هر بخش برنامه دلخواه را مشاهده و مدیریت نمایید
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Layout Mode Switcher */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200/70 dark:border-zinc-800/70 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">چیدمان صفحه:</span>
            <div className="flex items-center bg-zinc-200/80 dark:bg-zinc-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCurrentMode('dual')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentMode === 'dual'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <Columns size={13} />
                <span>۲ پنجره (کنار هم)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentMode('quad')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  currentMode === 'quad'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                <LayoutGrid size={13} />
                <span>۴ پنجره (شبکه ۲×۲)</span>
              </button>
            </div>
          </div>

          {(secondaryTab || tertiaryTab || quaternaryTab) && (
            <button
              type="button"
              onClick={handleCloseActiveSplit}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
            >
              خروج از حالت اسپلیت (تک‌پنجره)
            </button>
          )}
        </div>

        {/* Slot Selector Banner */}
        <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              انتخاب کنید کدام پنجره را می‌خواهید تغییر دهید:
            </span>
          </div>

          <div className={`grid ${currentMode === 'quad' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-2`}>
            {/* Slot 1 */}
            <button
              type="button"
              onClick={() => setSelectedTargetSlot(1)}
              className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                selectedTargetSlot === 1
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[11px] font-bold">پنجره ۱:</span>
                <span className="text-xs font-black truncate">{items.find(i => i.id === activeTab)?.label || activeTab}</span>
              </div>
              {selectedTargetSlot === 1 && <Check size={14} className="shrink-0" />}
            </button>

            {/* Slot 2 */}
            <button
              type="button"
              onClick={() => setSelectedTargetSlot(2)}
              className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                selectedTargetSlot === 2
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-500/30'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-[11px] font-bold">پنجره ۲:</span>
                <span className="text-xs font-black truncate">{items.find(i => i.id === secondaryTab)?.label || (secondaryTab ? secondaryTab : 'انتخاب نشده')}</span>
              </div>
              {selectedTargetSlot === 2 && <Check size={14} className="shrink-0" />}
            </button>

            {/* Slot 3 (Quad Mode) */}
            {currentMode === 'quad' && (
              <button
                type="button"
                onClick={() => setSelectedTargetSlot(3)}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                  selectedTargetSlot === 3
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-bold">پنجره ۳:</span>
                  <span className="text-xs font-black truncate">{items.find(i => i.id === tertiaryTab)?.label || (tertiaryTab ? tertiaryTab : 'انتخاب نشده')}</span>
                </div>
                {selectedTargetSlot === 3 && <Check size={14} className="shrink-0" />}
              </button>
            )}

            {/* Slot 4 (Quad Mode) */}
            {currentMode === 'quad' && (
              <button
                type="button"
                onClick={() => setSelectedTargetSlot(4)}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between ${
                  selectedTargetSlot === 4
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-bold">پنجره ۴:</span>
                  <span className="text-xs font-black truncate">{items.find(i => i.id === quaternaryTab)?.label || (quaternaryTab ? quaternaryTab : 'انتخاب نشده')}</span>
                </div>
                {selectedTargetSlot === 4 && <Check size={14} className="shrink-0" />}
              </button>
            )}
          </div>
        </div>

        {/* 1-Click Quick Presets for Quad Mode */}
        {currentMode === 'quad' && onApplyQuadPreset && (
          <div className="p-3 bg-zinc-100/70 dark:bg-zinc-900/50 border-b border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
            <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-1">
              <Sparkles size={13} className="text-amber-500" />
              <span>چیدمان‌های پیشنهادی سریع (۱ کلیک):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {quickPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onApplyQuadPreset(preset.panes);
                    onClose();
                  }}
                  className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 text-right transition-all hover:shadow-sm group"
                >
                  <div className="text-xs font-black text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600">
                    {preset.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                    {preset.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List of Modules */}
        <div className="p-4 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {items.map((item) => {
            const Icon = item.icon || FileText;
            const isSlot1 = activeTab === item.id;
            const isSlot2 = secondaryTab === item.id;
            const isSlot3 = tertiaryTab === item.id;
            const isSlot4 = quaternaryTab === item.id;
            const isAssigned = isSlot1 || isSlot2 || isSlot3 || isSlot4;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 relative group ${
                  isAssigned
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 hover:shadow-xs'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${
                  isAssigned 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-blue-100 group-hover:text-blue-700'
                }`}>
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 truncate">
                      {item.label}
                    </span>
                    {isSlot1 && (
                      <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded">
                        پنجره ۱
                      </span>
                    )}
                    {isSlot2 && (
                      <span className="text-[9px] bg-purple-600 text-white font-black px-1.5 py-0.2 rounded">
                        پنجره ۲
                      </span>
                    )}
                    {isSlot3 && (
                      <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded">
                        پنجره ۳
                      </span>
                    )}
                    {isSlot4 && (
                      <span className="text-[9px] bg-amber-600 text-white font-black px-1.5 py-0.2 rounded">
                        پنجره ۴
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] text-zinc-500">
            برای تخصیص هر برنامه، کافیست روی نام آن کلیک کنید تا در پنجره انتخابی بارگذاری شود.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold transition-colors"
          >
            بستن
          </button>
        </div>
      </motion.div>
    </div>
  );
};

