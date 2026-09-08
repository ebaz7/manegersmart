import React, { useState, useEffect, useMemo } from 'react';
import { 
    RefreshCw, CheckCircle2, AlertTriangle, Play, Settings, 
    ShieldCheck, Clock, Layers, ArrowRight, Eye, ChevronDown, 
    ChevronUp, Sparkles, Filter, Check, AlertCircle, FileText,
    Building2, Hash, Calendar, DollarSign, ArrowLeftRight, Loader2,
    Package, Database, CheckSquare, Search, Sliders, ExternalLink,
    FileSpreadsheet, ArrowUpRight, History, X
} from 'lucide-react';
import { formatDate } from '../constants';
import { User } from '../types';

interface PendingRequest {
    doc53Id: string;
    fiscalYear: string;
    docNo: string;
    subNo: string;
    subCode: string;
    docDate: string;
    note: string;
    descText: string;
    regDate: string;
    itemsCount: number;
    totalQty: number;
    detectedVendor: {
        personCode: string | null;
        personName: string | null;
        confidence: number;
        reason: string;
    };
    isReady: boolean;
}

interface ArchivedRequest {
    doc53Id: string;
    fiscalYear: string;
    docNo: string;
    subNo: string;
    subCode: string;
    docDate: string;
    note: string;
    descText: string;
    regDate: string;
    itemsCount: number;
    totalQty: number;
    hasPreInvoice: boolean;
    preInvoiceDocNo: string | null;
    preInvoiceDocId: string | null;
    preInvoiceDate: string | null;
    preInvoiceVendorCode: string | null;
    preInvoiceVendorName: string | null;
}

interface RequestItemDetail {
    ItemRowId: string;
    ItemCode: string;
    Qty: number;
    SecondaryQty: number;
    TrackingCode: string;
    ItemDesc: string;
    ItemName: string;
    UnitName: string;
    WarehouseCode: string;
}

interface AutomationConfig {
    enabled: boolean;
    intervalMinutes: number;
    defaultFee: number;
    autoVendorMatching: boolean;
    dryRunMode: boolean;
    fiscalYear: string;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunSummary: any;
}

interface AutomationLog {
    id: string;
    timestamp: string;
    action: string;
    doc53Id?: string;
    doc53No?: string;
    note?: string;
    vendorCode?: string;
    vendorName?: string;
    itemsCount?: number;
    created57DocId?: string;
    created57DocNo?: string;
    fee?: number;
    user?: string;
    success: boolean;
    error?: string;
}

interface Props {
    currentUser: User;
    settings?: any;
}

export const SayanRegistrationsModule: React.FC<Props> = ({ currentUser }) => {
    // Main module sub-navigation: Tab 1 = Purchase Pre-Invoices (53 -> 57), Tab 2 = Other future Sayan registrations
    const [mainSubTab, setMainSubTab] = useState<'PURCHASE_PREINVOICES' | 'FUTURE_DOCS'>('PURCHASE_PREINVOICES');

    // State for Purchase Pre-Invoices automation
    const [selectedFiscalYear, setSelectedFiscalYear] = useState<'4' | '3'>('4');
    const [loading, setLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [pendingList, setPendingList] = useState<PendingRequest[]>([]);
    const [archivedList, setArchivedList] = useState<ArchivedRequest[]>([]);
    const [config, setConfig] = useState<AutomationConfig | null>(null);
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [activeTab, setActiveTab] = useState<'READY' | 'MANUAL' | 'ARCHIVED' | 'LOGS'>('READY');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Item Details Modal
    const [selectedDocForItems, setSelectedDocForItems] = useState<{ docNo: string; fiscalYear: string; note?: string } | null>(null);
    const [docItems, setDocItems] = useState<RequestItemDetail[]>([]);

    // Vendor override modal
    const [editingDoc, setEditingDoc] = useState<PendingRequest | null>(null);
    const [overrideVendorCode, setOverrideVendorCode] = useState('');
    const [overrideVendorName, setOverrideVendorName] = useState('');

    // Settings drawer / expandable
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    const [configForm, setConfigForm] = useState({
        intervalMinutes: 60,
        dryRunMode: false,
        autoVendorMatching: true,
        defaultFee: 1
    });

    // Feedback banner
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 5000);
    };

    const fetchStatusAndData = async (targetFy?: '4' | '3') => {
        const fy = targetFy || selectedFiscalYear;
        setLoading(true);
        try {
            // Status & config
            const statusRes = await fetch('/api/sayan/order-automation/status');
            const statusData = await statusRes.json();
            if (statusData.success) {
                setConfig(statusData.config);
                setConfigForm({
                    intervalMinutes: statusData.config?.intervalMinutes || 60,
                    dryRunMode: statusData.config?.dryRunMode || false,
                    autoVendorMatching: statusData.config?.autoVendorMatching ?? true,
                    defaultFee: statusData.config?.defaultFee || 1
                });
                if (statusData.recentLogs) {
                    setLogs(statusData.recentLogs);
                }
            }

            // Pending list (در جریان - strictly requests without pre-invoices)
            const pendingRes = await fetch(`/api/sayan/order-automation/pending?fiscalYear=${fy}`);
            const pendingData = await pendingRes.json();
            if (pendingData.success) {
                setPendingList(pendingData.items || []);
            }

            // Archived list (بایگانی - requests that already have pre-invoice 57 issued)
            const archivedRes = await fetch(`/api/sayan/order-automation/archived?fiscalYear=${fy}`);
            const archivedData = await archivedRes.json();
            if (archivedData.success) {
                setArchivedList(archivedData.items || []);
            }
        } catch (err: any) {
            console.error('Failed to load Sayan registrations data:', err);
            showToast('خطا در دریافت اطلاعات از سرور سایان: ' + (err.message || 'نامشخص'), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatusAndData();
    }, []);

    const readyItems = useMemo(() => pendingList.filter(item => item.isReady), [pendingList]);
    const manualItems = useMemo(() => pendingList.filter(item => !item.isReady), [pendingList]);

    const filteredReady = useMemo(() => {
        if (!searchQuery.trim()) return readyItems;
        const q = searchQuery.toLowerCase().trim();
        return readyItems.filter(item => 
            item.docNo?.toLowerCase().includes(q) ||
            item.note?.toLowerCase().includes(q) ||
            item.detectedVendor?.personName?.toLowerCase().includes(q) ||
            item.detectedVendor?.personCode?.toLowerCase().includes(q)
        );
    }, [readyItems, searchQuery]);

    const filteredManual = useMemo(() => {
        if (!searchQuery.trim()) return manualItems;
        const q = searchQuery.toLowerCase().trim();
        return manualItems.filter(item => 
            item.docNo?.toLowerCase().includes(q) ||
            item.note?.toLowerCase().includes(q) ||
            item.descText?.toLowerCase().includes(q)
        );
    }, [manualItems, searchQuery]);

    const filteredArchived = useMemo(() => {
        if (!searchQuery.trim()) return archivedList;
        const q = searchQuery.toLowerCase().trim();
        return archivedList.filter(item => 
            item.docNo?.toLowerCase().includes(q) ||
            item.note?.toLowerCase().includes(q) ||
            item.preInvoiceDocNo?.toLowerCase().includes(q) ||
            item.preInvoiceVendorName?.toLowerCase().includes(q) ||
            item.preInvoiceVendorCode?.toLowerCase().includes(q)
        );
    }, [archivedList, searchQuery]);

    const handleToggleAutomation = async () => {
        if (!config) return;
        const newEnabled = !config.enabled;
        setActionLoading('toggle');
        try {
            const res = await fetch('/api/sayan/order-automation/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                showToast(newEnabled ? 'اتوماسیون ساعتی با موفقیت فعال شد.' : 'اتوماسیون ساعتی غیرفعال شد.', 'success');
            } else {
                showToast(data.message || 'خطا در تغییر وضعیت اتوماسیون', 'error');
            }
        } catch (err: any) {
            showToast('خطای شبکه: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveConfig = async () => {
        setActionLoading('save_config');
        try {
            const res = await fetch('/api/sayan/order-automation/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configForm)
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                setShowConfigPanel(false);
                showToast('تنظیمات اتوماسیون با موفقیت ذخیره شد.', 'success');
            } else {
                showToast(data.message || 'خطا در ذخیره تنظیمات', 'error');
            }
        } catch (err: any) {
            showToast('خطای شبکه: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRunNow = async (dryRun: boolean = false) => {
        setActionLoading(dryRun ? 'run_dry' : 'run_live');
        try {
            const res = await fetch('/api/sayan/order-automation/run-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dryRun,
                    fiscalYear: selectedFiscalYear,
                    triggeredBy: currentUser?.fullName || currentUser?.username || 'کاربر سیستم'
                })
            });
            const data = await res.json();
            if (data.success) {
                const summary = data.summary;
                showToast(
                    `عملیات انجام شد: ${summary.processed} سند بررسی، ${summary.converted} تبدیل موفق، ${summary.errors} خطا`,
                    summary.errors > 0 ? 'info' : 'success'
                );
                await fetchStatusAndData();
            } else {
                showToast(data.message || 'خطا در اجرای فرآیند', 'error');
            }
        } catch (err: any) {
            showToast('خطای شبکه: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConvertSingle = async (doc: PendingRequest, vendorCode: string, vendorName: string, dryRun: boolean = false) => {
        if (!vendorCode) {
            showToast('لطفاً ابتدا کد تفصیلی تامین‌کننده را مشخص نمایید.', 'error');
            return;
        }

        setActionLoading(`convert_${doc.doc53Id}`);
        try {
            const res = await fetch('/api/sayan/order-automation/convert-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doc53Id: doc.doc53Id,
                    vendorCode,
                    vendorName,
                    dryRun,
                    requestedBy: currentUser?.fullName || currentUser?.username || 'کاربر سیستم'
                })
            });
            const data = await res.json();
            if (data.success) {
                if (dryRun) {
                    showToast(`[شبیه‌سازی] پیش‌فاکتور برای سند ${doc.docNo} با موفقیت اعتبارسنجی شد.`, 'info');
                } else {
                    showToast(`پیش‌فاکتور جدید با شماره ${data.createdDocNo} در سایان صادر شد و سند بایگانی گردید.`, 'success');
                    setEditingDoc(null);
                    await fetchStatusAndData();
                }
            } else {
                showToast(data.message || 'خطا در صدور پیش‌فاکتور در سایان', 'error');
            }
        } catch (err: any) {
            showToast('خطای سرور سایان: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewItems = async (doc: { docNo: string; fiscalYear: string; note?: string }) => {
        setSelectedDocForItems(doc);
        setItemsLoading(true);
        try {
            const res = await fetch(`/api/sayan/order-automation/items/${doc.docNo}?fiscalYear=${doc.fiscalYear}`);
            const data = await res.json();
            if (data.success) {
                setDocItems(data.items || []);
            } else {
                showToast(data.message || 'خطا در دریافت اقلام سند', 'error');
            }
        } catch (err: any) {
            showToast('خطا در ارتباط با سایان: ' + err.message, 'error');
        } finally {
            setItemsLoading(false);
        }
    };

    const openVendorEditModal = (doc: PendingRequest) => {
        setEditingDoc(doc);
        setOverrideVendorCode(doc.detectedVendor?.personCode || '');
        setOverrideVendorName(doc.detectedVendor?.personName || '');
    };

    return (
        <div className="w-full flex flex-col flex-1 min-h-0 space-y-4 pb-20 animate-fade-in select-text">
            
            {/* Top Enterprise Navigation Header */}
            <div className="glass-panel p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md shadow-blue-500/20">
                        <Database className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                                بخش ثبت‌های سایان
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                ERP سایان
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            مرکز ثبت، تایید و صدور مستقیم اسناد مالی و انبار در پایگاه‌داده سایان ERP
                        </p>
                    </div>
                </div>

                {/* Sub-Module Switcher */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1 border border-slate-200 dark:border-slate-700/60 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => setMainSubTab('PURCHASE_PREINVOICES')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                            mainSubTab === 'PURCHASE_PREINVOICES'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>ثبت پیش‌فاکتورهای درخواست خرید</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMainSubTab('FUTURE_DOCS')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                            mainSubTab === 'FUTURE_DOCS'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Layers className="w-4 h-4 text-slate-400" />
                        <span>سایر ثبت‌ها و عملیات اسناد</span>
                    </button>
                </div>
            </div>

            {/* TAB 2: Future Document Types Placeholder */}
            {mainSubTab === 'FUTURE_DOCS' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900">
                        <Layers className="w-8 h-8" />
                    </div>
                    <div className="max-w-md mx-auto">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            بخش ثبت‌های آتی اسناد سایان
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            این زیرمجموعه جهت پایه‌گذاری و گسترش ثبت سایر اسناد مستقل در سایان نظیر صدور فاکتور خرید از پیش‌فاکتور، صدور حواله و رسید انبار و اسناد تسویه تعبیه شده است.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setMainSubTab('PURCHASE_PREINVOICES')}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-2 transition-all shadow-sm"
                        >
                            <ArrowRight className="w-4 h-4" />
                            <span>بازگشت به ثبت پیش‌فاکتورهای درخواست خرید</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 1: Main Purchase Request to Pre-Invoice Feature */}
            {mainSubTab === 'PURCHASE_PREINVOICES' && (
                <div className="space-y-4">
                    {/* Automation Status & Control Header Bar */}
                    <div className="bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            
                            {/* Cron Switch & Status Indicator */}
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={handleToggleAutomation}
                                    disabled={actionLoading === 'toggle'}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                                        config?.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                    title={config?.enabled ? 'کلیک جهت غیرفعال‌سازی اتوماسیون ساعتی' : 'کلیک جهت فعال‌سازی اتوماسیون ساعتی'}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                            config?.enabled ? '-translate-x-6' : '-translate-x-1'
                                        }`}
                                    />
                                </button>
                                
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            اتوماسیون ساعتی صدور ۵۷
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            config?.enabled 
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' 
                                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {config?.enabled ? 'فعال (اجرای خودکار)' : 'غیرفعال (فقط دستی)'}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                        <span>بازه اجرا: هر {config?.intervalMinutes || 60} دقیقه</span>
                                        <span>•</span>
                                        <span>فی پیش‌فاکتور: {config?.defaultFee || 1} ریال</span>
                                        {config?.lastRunAt && (
                                            <>
                                                <span>•</span>
                                                <span className="font-mono">آخرین اجرا: {formatDate(config.lastRunAt)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Fiscal Year Selector */}
                                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold">
                                    <span className="text-slate-400 dark:text-slate-500 px-1.5 flex items-center gap-1 text-[11px]">
                                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="hidden sm:inline">سال مالی سایان:</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFiscalYear('4');
                                            fetchStatusAndData('4');
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                                            selectedFiscalYear === '4'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                                        }`}
                                        title="سال مالی ۱۴۰۵ (سال ۴ در دیتابیس سایان)"
                                    >
                                        ۱۴۰۵ (سال ۴)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedFiscalYear('3');
                                            fetchStatusAndData('3');
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                                            selectedFiscalYear === '3'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                                        }`}
                                        title="سال مالی ۱۴۰۴ (سال ۳ در دیتابیس سایان)"
                                    >
                                        ۱۴۰۴ (سال ۳)
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowConfigPanel(!showConfigPanel)}
                                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    <span>تنظیمات اتوماسیون</span>
                                    {showConfigPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                    onClick={() => handleRunNow(true)}
                                    disabled={loading || actionLoading !== null}
                                    className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                    title="تست بدون ثبت در پایگاه‌داده سایان"
                                >
                                    {actionLoading === 'run_dry' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                    <span>شبیه‌سازی آزمایشی</span>
                                </button>

                                <button
                                    onClick={() => handleRunNow(false)}
                                    disabled={loading || actionLoading !== null}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                                >
                                    {actionLoading === 'run_live' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                    <span>اجرای فوری صدور ۵۷</span>
                                </button>

                                <button
                                    onClick={() => fetchStatusAndData()}
                                    disabled={loading}
                                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
                                    title="بروزرسانی داده‌ها از سایان"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Expandable Configuration Form */}
                        {showConfigPanel && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in text-xs">
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        بازه اجرای خودکار (دقیقه):
                                    </label>
                                    <input
                                        type="number"
                                        min="5"
                                        max="1440"
                                        value={configForm.intervalMinutes}
                                        onChange={(e) => setConfigForm({ ...configForm, intervalMinutes: Number(e.target.value) })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        فی پیش‌فرض اقلام (ریال):
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={configForm.defaultFee}
                                        onChange={(e) => setConfigForm({ ...configForm, defaultFee: Number(e.target.value) })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        استخراج هوشمند تامین‌کننده:
                                    </label>
                                    <select
                                        value={configForm.autoVendorMatching ? 'yes' : 'no'}
                                        onChange={(e) => setConfigForm({ ...configForm, autoVendorMatching: e.target.value === 'yes' })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    >
                                        <option value="yes">فعال (بر اساس شرح و تطبیق با تفصیلی)</option>
                                        <option value="no">غیرفعال (فقط دستی)</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleSaveConfig}
                                        disabled={actionLoading === 'save_config'}
                                        className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        {actionLoading === 'save_config' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        <span>ذخیره تنظیمات</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Toast / Notification Banner */}
                    {toastMessage && (
                        <div className={`p-3.5 rounded-xl text-xs flex items-center justify-between border animate-fade-in ${
                            toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                            toastMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                            'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                            <div className="flex items-center gap-2">
                                {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                                {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 shrink-0" />}
                                <span className="font-medium">{toastMessage.text}</span>
                            </div>
                            <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100 mr-2">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* 4 Smart KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">کل معلق در جریان (۵۳)</span>
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                                    <Layers className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                                    {pendingList.length}
                                </span>
                                <span className="text-xs text-slate-400">سند منتظر ۵۷</span>
                            </div>
                            <div className="mt-2 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                اقلام کل معوق: {pendingList.reduce((sum, p) => sum + (p.itemsCount || 0), 0)} ردیف
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('READY')}
                            className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                                activeTab === 'READY' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">در جریان: آماده تبدیل مستقیم</span>
                                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    {readyItems.length}
                                </span>
                                <span className="text-xs text-slate-400">سند تایید شده</span>
                            </div>
                            <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                تامین‌کننده مشخص و قابل صدور
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('MANUAL')}
                            className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                                activeTab === 'MANUAL' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">در جریان: نیازمند بررسی دستی</span>
                                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                                    {manualItems.length}
                                </span>
                                <span className="text-xs text-slate-400">سند</span>
                            </div>
                            <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                فاقد کد تامین‌کننده مشخص
                            </div>
                        </div>

                        <div 
                            onClick={() => setActiveTab('ARCHIVED')}
                            className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                                activeTab === 'ARCHIVED' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">صادرشده در سایان (بایگانی)</span>
                                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                                    {archivedList.length}
                                </span>
                                <span className="text-xs text-slate-400">پیش‌فاکتور صادرشده</span>
                            </div>
                            <div className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                                اسناد ۵۳ تکمیل شده در سایان
                            </div>
                        </div>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('READY')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    activeTab === 'READY' 
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>در جریان: آماده تبدیل ({readyItems.length})</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('MANUAL')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    activeTab === 'MANUAL' 
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>در جریان: نیازمند بررسی دستی ({manualItems.length})</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('ARCHIVED')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    activeTab === 'ARCHIVED' 
                                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>بایگانی (صادرشده در سایان) ({archivedList.length})</span>
                            </button>

                            <button
                                onClick={() => setActiveTab('LOGS')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                    activeTab === 'LOGS' 
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>سوابق و لاگ‌ها ({logs.length})</span>
                            </button>
                        </div>

                        {/* Search Input */}
                        {activeTab !== 'LOGS' && (
                            <div className="relative w-full md:w-72">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="جستجو در شماره سند، پیش‌فاکتور، شرح یا شخص..."
                                    className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Data Display Content */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="py-20 flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <span className="text-xs text-slate-500">در حال دریافت اسناد و پیش‌فاکتورها از دیتابیس سایان...</span>
                            </div>
                        ) : activeTab === 'LOGS' ? (
                            /* Logs Table */
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">زمان</th>
                                            <th className="py-3 px-4">عملیات</th>
                                            <th className="py-3 px-4">شماره درخواست (۵۳)</th>
                                            <th className="py-3 px-4">پیش‌فاکتور صادره (۵۷)</th>
                                            <th className="py-3 px-4">تامین‌کننده</th>
                                            <th className="py-3 px-4">کاربر / محرک</th>
                                            <th className="py-3 px-4">وضعیت</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-slate-400">
                                                    هنوز سابقه‌ای در این نشست ثبت نشده است.
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="py-3 px-4 text-slate-500 font-mono">
                                                        {formatDate(log.timestamp)}
                                                    </td>
                                                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                                        {log.action}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold">
                                                        {log.doc53No ? `#${log.doc53No}` : '-'}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                                                        {log.created57DocNo ? `#${log.created57DocNo}` : '-'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {log.vendorName || log.vendorCode || '-'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500">
                                                        {log.user || 'اتوماسیون سیستم'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {log.success ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                موفق
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-rose-600 font-bold" title={log.error}>
                                                                <AlertCircle className="w-3.5 h-3.5" />
                                                                خطا: {log.error?.substring(0, 30)}...
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : activeTab === 'ARCHIVED' ? (
                            /* Archived Table */
                            <div className="overflow-x-auto">
                                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border-b border-purple-200/50 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between">
                                    <span className="font-medium flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                        <span>اسناد درخواست خرید (۵۳) که در دیتابیس سایان برای آن‌ها پیش‌فاکتور (۵۷) صادر شده و از لیست در جریان خارج شده‌اند.</span>
                                    </span>
                                    <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 shrink-0">
                                        {filteredArchived.length} سند صادرشده
                                    </span>
                                </div>
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">شماره درخواست (۵۳)</th>
                                            <th className="py-3 px-4">تاریخ درخواست ۵۳</th>
                                            <th className="py-3 px-4">پیش‌فاکتور صادرشده در سایان (۵۷)</th>
                                            <th className="py-3 px-4">تاریخ صدور ۵۷</th>
                                            <th className="py-3 px-4">تامین‌کننده</th>
                                            <th className="py-3 px-4">شرح سند</th>
                                            <th className="py-3 px-4">اقلام کالا</th>
                                            <th className="py-3 px-4 text-center">وضعیت در سایان</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredArchived.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                                    سند بایگانی‌شده‌ای با این مشخصات یافت نشد.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredArchived.map((doc) => (
                                                <tr key={doc.doc53Id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                        درخواست #{doc.docNo}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 font-mono">
                                                        {formatDate(doc.docDate)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold border border-blue-200 dark:border-blue-800">
                                                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                            پیش‌فاکتور #{doc.preInvoiceDocNo}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 font-mono">
                                                        {formatDate(doc.preInvoiceDate)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{doc.preInvoiceVendorName || doc.preInvoiceVendorCode || '-'}</span>
                                                        </div>
                                                        {doc.preInvoiceVendorCode && (
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                کد تفصیلی: {doc.preInvoiceVendorCode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={doc.note}>
                                                        {doc.note || <span className="text-slate-400 italic">بدون متن توضیحات</span>}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => handleViewItems(doc)}
                                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>{doc.itemsCount} ردیف کالا</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                            صادرشده (بایگانی)
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* Pending Documents Table (Ready or Manual) */
                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">شماره درخواست (۵۳)</th>
                                            <th className="py-3 px-4">تاریخ ثبت</th>
                                            <th className="py-3 px-4">تامین‌کننده طرف حساب</th>
                                            <th className="py-3 px-4">شرح / توضیحات</th>
                                            <th className="py-3 px-4">تعداد اقلام</th>
                                            <th className="py-3 px-4">وضعیت تطبیق</th>
                                            <th className="py-3 px-4 text-center">عملیات صدور در سایان</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(activeTab === 'READY' ? filteredReady : filteredManual).length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-16 text-center text-slate-400">
                                                    {activeTab === 'READY' 
                                                        ? 'هیچ درخواست معوقی در وضعیت «آماده صدور مستقیم» وجود ندارد.'
                                                        : 'هیچ درخواست معوقی در وضعیت «نیازمند بررسی دستی» وجود ندارد.'
                                                    }
                                                </td>
                                            </tr>
                                        ) : (
                                            (activeTab === 'READY' ? filteredReady : filteredManual).map((doc) => (
                                                <tr key={doc.doc53Id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                        درخواست #{doc.docNo}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500 font-mono">
                                                        {formatDate(doc.docDate)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {doc.detectedVendor?.personName ? (
                                                            <div>
                                                                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                                    <span>{doc.detectedVendor.personName}</span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 font-mono">
                                                                    کد تفصیلی: {doc.detectedVendor.personCode}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                                نامشخص (نیاز به تعیین دستی)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={doc.note}>
                                                        {doc.note || <span className="text-slate-400 italic">بدون متن توضیحات</span>}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button
                                                            onClick={() => handleViewItems(doc)}
                                                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>{doc.itemsCount} قلم کالا</span>
                                                        </button>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {doc.isReady ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                <Check className="w-3 h-3 text-emerald-500" />
                                                                آماده صدور
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                                بررسی تفصیلی
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {doc.isReady ? (
                                                                <button
                                                                    onClick={() => handleConvertSingle(doc, doc.detectedVendor.personCode!, doc.detectedVendor.personName!)}
                                                                    disabled={actionLoading !== null}
                                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm active:scale-95"
                                                                    title="صدور فوری پیش‌فاکتور ۵۷ در سایان"
                                                                >
                                                                    {actionLoading === `convert_${doc.doc53Id}` ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>تایید و صدور ۵۷</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => openVendorEditModal(doc)}
                                                                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                                                                >
                                                                    <Building2 className="w-3.5 h-3.5" />
                                                                    <span>تعیین تامین‌کننده</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => openVendorEditModal(doc)}
                                                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                                title="تغییر تامین‌کننده یا شبیه‌سازی"
                                                            >
                                                                <Sliders className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Item Details Modal */}
            {selectedDocForItems && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                                    اقلام درخواست خرید #{selectedDocForItems.docNo}
                                </h3>
                                <span className="text-xs text-slate-400 font-mono">
                                    (سال مالی {selectedDocForItems.fiscalYear})
                                </span>
                            </div>
                            <button
                                onClick={() => setSelectedDocForItems(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1">
                            {itemsLoading ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                                    <span className="text-xs text-slate-500">در حال دریافت اقلام کالا از پایگاه‌داده سایان...</span>
                                </div>
                            ) : docItems.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    هیچ قلم کالایی برای این سند یافت نشد.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {docItems.map((item, idx) => (
                                        <div key={idx} className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mt-0.5">
                                                    <Package className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                        {item.ItemName || item.ItemCode}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2 font-mono">
                                                        <span>کد کالا: <b className="text-slate-700 dark:text-slate-200">{item.ItemCode}</b></span>
                                                        <span>•</span>
                                                        <span>انبار: <b className="text-slate-700 dark:text-slate-200">{item.WarehouseCode || '-'}</b></span>
                                                        {item.TrackingCode && (
                                                            <>
                                                                <span>•</span>
                                                                <span>کد ردیابی: {item.TrackingCode}</span>
                                                            </>
                                                        )}
                                                        {item.ItemDesc && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-slate-400 font-sans">{item.ItemDesc}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left shrink-0">
                                                <div className="font-black text-slate-900 dark:text-white text-sm font-mono">
                                                    {Number(item.Qty || 0).toLocaleString('fa-IR')} {item.UnitName || 'واحد'}
                                                </div>
                                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                                    فی در ۵۷: ۱ ریال
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-left">
                            <button
                                onClick={() => setSelectedDocForItems(null)}
                                className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Vendor Override / Manual Action Modal */}
            {editingDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-amber-600" />
                                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                                    تعیین یا تغییر تامین‌کننده درخواست #{editingDoc.docNo}
                                </h3>
                            </div>
                            <button
                                onClick={() => setEditingDoc(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                    شرح سند درخواست خرید در سایان:
                                </div>
                                <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {editingDoc.note || editingDoc.descText || 'توضیحاتی ثبت نشده است.'}
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    کد تفصیلی تامین‌کننده در سایان:
                                </label>
                                <input
                                    type="text"
                                    value={overrideVendorCode}
                                    onChange={(e) => setOverrideVendorCode(e.target.value)}
                                    placeholder="مثال: 001004"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    نام تامین‌کننده / طرف حساب:
                                </label>
                                <input
                                    type="text"
                                    value={overrideVendorName}
                                    onChange={(e) => setOverrideVendorName(e.target.value)}
                                    placeholder="نام شخص یا شرکت..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-between gap-2">
                                <button
                                    onClick={() => handleConvertSingle(editingDoc, overrideVendorCode, overrideVendorName, true)}
                                    disabled={actionLoading !== null || !overrideVendorCode}
                                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition-colors"
                                >
                                    تست شبیه‌سازی
                                </button>
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingDoc(null)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 transition-colors"
                                    >
                                        انصراف
                                    </button>
                                    <button
                                        onClick={() => handleConvertSingle(editingDoc, overrideVendorCode, overrideVendorName, false)}
                                        disabled={actionLoading !== null || !overrideVendorCode}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md flex items-center gap-1.5"
                                    >
                                        {actionLoading === `convert_${editingDoc.doc53Id}` ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        <span>تایید و صدور پیش‌فاکتور ۵۷</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SayanRegistrationsModule;
