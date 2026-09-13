import { LucideIcon } from 'lucide-react';
import { 
  LayoutDashboard, BadgePlus, Receipt, ArrowLeftRight, Truck, ScrollText, 
  ClipboardCheck, Warehouse, BarChart3, FileCheck2, ShieldCheck, CalendarDays, 
  ShoppingCart, FolderArchive, Banknote, MessagesSquare, BookOpen, Globe, 
  Wallet, Boxes, Handshake, Headset, UserCog, Settings 
} from 'lucide-react';
import { User, UserRole, SystemSettings } from '../types';
import { getRolePermissions, hasPermission } from '../services/authService';

export interface AppNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

// Canonical Sidebar Item Definitions (Single Source of Truth for titles, icons, and descriptions)
export const ALL_NAVIGATION_ITEMS: Record<string, AppNavItem> = {
  'dashboard': { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, desc: 'آمار، شاخص‌ها و وضعیت کلی سازمان' },
  'create': { id: 'create', label: 'ثبت پرداخت', icon: BadgePlus, desc: 'ثبت دستور پرداخت و حواله جدید' },
  'manage': { id: 'manage', label: 'سوابق پرداخت', icon: Receipt, desc: 'حواله‌ها، فاکتورها و تسویه‌ها' },
  'ccti': { id: 'ccti', label: 'تبدیل CCTI', icon: ArrowLeftRight, desc: 'تبدیل و خروجی فایل‌های سی‌سی‌تی‌آی' },
  'create-exit': { id: 'create-exit', label: 'ثبت خروج', icon: Truck, desc: 'صدور مجوز خروج کالا از کارخانه' },
  'manage-invoices': { id: 'manage-invoices', label: 'مدیریت فاکتورها', icon: ScrollText, desc: 'کارتابل و بررسی فاکتورهای فروش' },
  'manage-exit': { id: 'manage-exit', label: 'سوابق خروج', icon: ClipboardCheck, desc: 'کارتابل و سوابق خروج کالا' },
  'warehouse': { id: 'warehouse', label: 'مدیریت انبار', icon: Warehouse, desc: 'موجودی انبار، بیجک و ورود/خروج کالا' },
  'sayan': { id: 'sayan', label: 'گزارشات سایان', icon: BarChart3, desc: 'تراز، فروش، تولید و چک‌ها' },
  'sayan-operations': { id: 'sayan-operations', label: 'ثبت‌های سایان', icon: FileCheck2, desc: 'پیش‌فاکتور، دریافت چک و اسناد معلق' },
  'security': { id: 'security', label: 'انتظامات', icon: ShieldCheck, desc: 'حراست، تردد و ثبت ورود/خروج' },
  'meetings': { id: 'meetings', label: 'جلسات تولید', icon: CalendarDays, desc: 'تقویم جلسات و صورتجلسات' },
  'purchase': { id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart, desc: 'درخواست‌های خرید و تامین قطعات' },
  'secretariat': { id: 'secretariat', label: 'دبیرخانه اداری', icon: FolderArchive, desc: 'مکاتبات اداری، نامه‌ها و کارتابل' },
  'cheque-receipts': { id: 'cheque-receipts', label: 'رسید دریافت چک', icon: Banknote, desc: 'چک‌های صیادی و کارتابل تاییدیه' },
  'chat': { id: 'chat', label: 'گفتگو', icon: MessagesSquare, desc: 'پیام‌ها، کارگروه‌ها و هماهنگی سازمانی' },
  'knowledge': { id: 'knowledge', label: 'اطلاعات و یادداشت ها', icon: BookOpen, desc: 'دفترچه یادداشت، تسک‌ها و پایگاه دانش' },
  'notes': { id: 'notes', label: 'اطلاعات و یادداشت ها', icon: BookOpen, desc: 'دفترچه یادداشت، تسک‌ها و پایگاه دانش' },
  'trade': { id: 'trade', label: 'بازرگانی', icon: Globe, desc: 'پروفرم‌ها و پرونده‌های بازرگانی' },
  'balances': { id: 'balances', label: 'مانده حساب مشتریان', icon: Wallet, desc: 'وضعیت بدهی و اعتبار مشتریان' },
  'products': { id: 'products', label: 'کالاها', icon: Boxes, desc: 'کاتالوگ و مشخصات کالاها' },
  'sales': { id: 'sales', label: 'مشتریان', icon: Handshake, desc: 'مدیریت مشتریان و فروش' },
  'tickets': { id: 'tickets', label: 'تیکت‌ها', icon: Headset, desc: 'پشتیبانی و تیکت‌های سازمانی' },
  'users': { id: 'users', label: 'کاربران', icon: UserCog, desc: 'مدیریت کاربران و دسترسی‌ها' },
  'settings': { id: 'settings', label: 'تنظیمات', icon: Settings, desc: 'تنظیمات سیستم و پیکربندی' },
};

/**
 * Calculates the exact allowed navigation items for a given user and settings.
 * This is the SINGLE SOURCE OF TRUTH across Sidebar, Split View, and Taskbar Dock.
 */
export const getAppNavItems = (currentUser: User | null, settings: SystemSettings | null): AppNavItem[] => {
  if (!currentUser) return [];

  const perms = settings 
    ? getRolePermissions(currentUser.role, settings, currentUser) 
    : { canCreatePaymentOrder: false, canViewPaymentOrders: false };

  const canCreatePayment = perms.canCreatePaymentOrder === true;
  const canViewPayment = perms.canViewPaymentOrders === true;
  const canCreateExit = perms.canCreateExitPermit === true;
  const canViewInvoices = perms.canViewInvoices === true;
  const canViewExit = perms.canViewExitPermits === true;
  const canManageWarehouse = currentUser.role === UserRole.ADMIN || perms.canManageWarehouse === true;
  const canSeeTrade = currentUser.role === UserRole.ADMIN || perms.canManageTrade === true;
  const canSeeBalances = currentUser.role === UserRole.ADMIN || (perms as any).canViewCustomerBalances === true;
  const canSeeProducts = currentUser.role === UserRole.ADMIN || perms.canManageSales === true;
  const canSeeSettings = currentUser.role === UserRole.ADMIN || perms.canManageSettings === true || perms.canManageTradeSettings === true;
  const canSeeSecurity = currentUser.role === UserRole.ADMIN || perms.canViewSecurity === true;
  const canSeeKnowledgeBase = currentUser.role === UserRole.ADMIN || perms.canViewKnowledgeBase === true || perms.canManageKnowledgeBase === true;
  const canSeeMeetings = currentUser.role === UserRole.ADMIN || perms.canViewMeetings === true;
  const canSeePurchase = currentUser.role === UserRole.ADMIN || (perms.canView === true);
  const canSeeCcti = currentUser.role === UserRole.ADMIN || perms.canAccessCcti === true;
  const canSeeSayan = currentUser.role === UserRole.ADMIN || 
    perms.canViewSayan === true || 
    perms.canViewSayanTraz === true || 
    perms.canViewSayanSales === true || 
    perms.canViewSayanProduction === true || 
    perms.canViewSayanProdReturns === true || 
    perms.canViewSayanCheques === true || 
    perms.canViewSayanRemittances === true || 
    perms.canViewSayanWarehouseOverview === true || 
    perms.canAccessSayanReports === true;

  const canSeeSayanOps = currentUser.role === UserRole.ADMIN || 
    perms.canAccessSayanRegistrations === true || 
    perms.canSayanPreInvoices === true || 
    perms.canSayanRegisterCheque === true || 
    perms.canSayanEditReceipt === true || 
    perms.canSayanDeleteReceipt === true || 
    perms.canSayanApproveAccounting === true || 
    perms.canSayanApproveCeo === true || 
    perms.canAccessSayanPendingDocs === true;

  const canSeeChequeReceipts = currentUser.role === UserRole.ADMIN || perms.canAccessChequeReceipts === true;

  const items: AppNavItem[] = [
    ALL_NAVIGATION_ITEMS['dashboard']
  ];

  if (canCreatePayment) items.push(ALL_NAVIGATION_ITEMS['create']);
  if (canViewPayment) items.push(ALL_NAVIGATION_ITEMS['manage']);
  if (canSeeCcti) items.push(ALL_NAVIGATION_ITEMS['ccti']);
  if (canCreateExit) items.push(ALL_NAVIGATION_ITEMS['create-exit']);
  if (canViewInvoices) items.push(ALL_NAVIGATION_ITEMS['manage-invoices']);
  if (canViewExit) items.push(ALL_NAVIGATION_ITEMS['manage-exit']);
  if (canManageWarehouse) items.push(ALL_NAVIGATION_ITEMS['warehouse']);
  if (canSeeSayan) items.push(ALL_NAVIGATION_ITEMS['sayan']);
  if (canSeeSayanOps) items.push(ALL_NAVIGATION_ITEMS['sayan-operations']);
  if (canSeeSecurity) items.push(ALL_NAVIGATION_ITEMS['security']);
  if (canSeeMeetings) items.push(ALL_NAVIGATION_ITEMS['meetings']);
  if (canSeePurchase) items.push(ALL_NAVIGATION_ITEMS['purchase']);
  items.push(ALL_NAVIGATION_ITEMS['secretariat']);
  if (canSeeChequeReceipts) items.push(ALL_NAVIGATION_ITEMS['cheque-receipts']);
  items.push(ALL_NAVIGATION_ITEMS['chat']);
  if (canSeeKnowledgeBase) items.push(ALL_NAVIGATION_ITEMS['knowledge']);
  if (canSeeTrade) items.push(ALL_NAVIGATION_ITEMS['trade']);
  if (canSeeBalances) items.push(ALL_NAVIGATION_ITEMS['balances']);
  if (canSeeProducts) {
    items.push(ALL_NAVIGATION_ITEMS['products']);
    items.push(ALL_NAVIGATION_ITEMS['sales']);
    items.push(ALL_NAVIGATION_ITEMS['tickets']);
  }
  if (hasPermission(currentUser, 'manage_users')) items.push(ALL_NAVIGATION_ITEMS['users']);
  if (canSeeSettings) items.push(ALL_NAVIGATION_ITEMS['settings']);

  return items;
};

/**
 * Returns the exact title/label of an item as it appears in the sidebar.
 */
export const getSidebarLabel = (tabId: string, allowedItems?: AppNavItem[]): string => {
  if (allowedItems && allowedItems.length > 0) {
    const found = allowedItems.find(i => i.id === tabId);
    if (found) return found.label;
  }
  return ALL_NAVIGATION_ITEMS[tabId]?.label || tabId;
};

/**
 * Returns the exact icon of an item as it appears in the sidebar.
 */
export const getSidebarIcon = (tabId: string, allowedItems?: AppNavItem[]): LucideIcon => {
  if (allowedItems && allowedItems.length > 0) {
    const found = allowedItems.find(i => i.id === tabId);
    if (found?.icon) return found.icon;
  }
  return ALL_NAVIGATION_ITEMS[tabId]?.icon || LayoutDashboard;
};
