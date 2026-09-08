import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, RefreshCw, CheckCircle2, AlertTriangle, Play, Settings, 
    ShieldCheck, Clock, Layers, ArrowRight, Eye, ChevronDown, 
    ChevronUp, Sparkles, Filter, Check, AlertCircle, FileText,
    Building2, Hash, Calendar, DollarSign, ArrowLeftRight, Loader2
} from 'lucide-react';
import { formatDate } from '../constants';

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
    isOpen: boolean;
    onClose: () => void;
    currentUser: any;
}

export const SayanOrderAutomationModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
    const [loading, setLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [pendingList, setPendingList] = useState<PendingRequest[]>([]);
    const [config, setConfig] = useState<AutomationConfig | null>(null);
    const [logs, setLogs] = useState<AutomationLog[]>([]);
    const [activeTab, setActiveTab] = useState<'READY' | 'MANUAL' | 'LOGS'>('READY');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Item Details Modal
    const [selectedDocForItems, setSelectedDocForItems] = useState<PendingRequest | null>(null);
    const [docItems, setDocItems] = useState<RequestItemDetail[]>([]);

    // Vendor override modal
    const [editingDoc, setEditingDoc] = useState<PendingRequest | null>(null);
    const [overrideVendorCode, setOverrideVendorCode] = useState('');
    const [overrideVendorName, setOverrideVendorName] = useState('');

    // Feedback banner
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 5000);
    };

    const fetchStatusAndData = async () => {
        setLoading(true);
        try {
            // Status & config
            const statusRes = await fetch('/api/sayan/order-automation/status');
            const statusData = await statusRes.json();
            if (statusData.success) {
                setConfig(statusData.config);
                if (statusData.recentLogs) {
                    setLogs(statusData.recentLogs);
                }
            }

            // Pending list
            const pendingRes = await fetch('/api/sayan/order-automation/pending');
            const pendingData = await pendingRes.json();
            if (pendingData.success) {
                setPendingList(pendingData.items || []);
            }
        } catch (err: any) {
            console.error('Error fetching order automation status:', err);
            showToast('خطا در دریافت وضعیت اتوماسیون سفارشات سایان', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchStatusAndData();
        }
    }, [isOpen]);

    const handleToggleCron = async () => {
        if (!config) return;
        const newEnabled = !config.enabled;
        try {
            const res = await fetch('/api/sayan/order-automation/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.config);
                showToast(newEnabled ? 'اتوماسیون ساعتی فعال شد (هر ۱ ساعت به صورت خودکار اجرا می‌شود)' : 'اتوماسیون ساعتی موقتاً غیرفعال شد', 'success');
            }
        } catch (err: any) {
            showToast('خطا در ذخیره تنظیمات: ' + err.message, 'error');
        }
    };

    const handleViewItems = async (doc: PendingRequest) => {
        setSelectedDocForItems(doc);
        setItemsLoading(true);
        try {
            const res = await fetch(`/api/sayan/order-automation/items/${doc.docNo}?fiscalYear=${doc.fiscalYear}`);
            const data = await res.json();
            if (data.success) {
                setDocItems(data.items || []);
            } else {
                setDocItems([]);
            }
        } catch (err) {
            console.error('Error loading items:', err);
            setDocItems([]);
        } finally {
            setItemsLoading(false);
        }
    };

    const handleConvertSingle = async (doc: PendingRequest, isDryRun: boolean = false, customVendor?: { code: string; name: string }) => {
        const vendorCode = customVendor?.code || doc.detectedVendor.personCode;
        const vendorName = customVendor?.name || doc.detectedVendor.personName;

        if (!vendorCode) {
            showToast('کد تامین‌کننده مشخص نیست. لطفاً ابتدا تامین‌کننده را تعیین کنید.', 'error');
            return;
        }

        const confirmText = isDryRun 
            ? `آیا از اجرای شبیه‌سازی برای درخواست شماره ${doc.docNo} با فی ۱ ریال اطمینان دارید؟ (هیچ دیتایی در سایان ذخیره نمی‌شود)`
            : `آیا از ثبت قطعی پیش‌فاکتور (کد ۵۷) برای درخواست خرید شماره ${doc.docNo} در دیتابیس سایان با فی ۱ ریال اطمینان دارید؟`;

        if (!window.confirm(confirmText)) return;

        setActionLoading(doc.doc53Id);
        try {
            const res = await fetch('/api/sayan/order-automation/convert-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doc53Id: doc.doc53Id,
                    vendorCode,
                    vendorName,
                    isDryRun,
                    user: currentUser?.name || 'کاربر سیستم'
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message, 'success');
                setEditingDoc(null);
                fetchStatusAndData();
            } else {
                showToast('خطا در تبدیل: ' + (data.error || 'خطای ناشناخته'), 'error');
            }
        } catch (err: any) {
            showToast('خطا در ارسال درخواست: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRunBatch = async (isDryRun: boolean = false) => {
        const readyCount = pendingList.filter(p => p.isReady).length;
        if (readyCount === 0) {
            showToast('هیچ درخواست آماده‌ای با تامین‌کننده معتبر برای تبدیل وجود ندارد.', 'info');
            return;
        }

        const confirmMsg = isDryRun
            ? `آیا می‌خواهید تبدیل آزمایشی (بدون ثبت) را برای ${readyCount} درخواست خرید انجام دهید؟`
            : `⚠️ هشدار مهم: آیا از تبدیل و ثبت نهایی ${readyCount} درخواست خرید به پیش‌فاکتور (کد ۵۷) با فی ۱ ریال در دیتابیس سایان اطمینان دارید؟`;

        if (!window.confirm(confirmMsg)) return;

        setActionLoading('BATCH');
        try {
            const res = await fetch('/api/sayan/order-automation/run-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isDryRun,
                    user: currentUser?.name || 'اجرای دستی گروهی'
                })
            });
            const data = await res.json();
            if (data.success) {
                const s = data.summary;
                showToast(
                    `عملیات پایان یافت. موفق: ${s.convertedCount} مورد | ناموفق: ${s.failedCount} مورد | رد شده: ${s.skippedCount} مورد`,
                    s.failedCount === 0 ? 'success' : 'info'
                );
                fetchStatusAndData();
            } else {
                showToast('خطا در اجرای گروهی: ' + (data.error || 'خطای نامشخص'), 'error');
            }
        } catch (err: any) {
            showToast('خطا در اجرای گروهی: ' + err.message, 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredPending = useMemo(() => {
        return pendingList.filter(item => {
            const matchesTab = activeTab === 'READY' ? item.isReady : !item.isReady;
            if (!matchesTab) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                item.docNo.toLowerCase().includes(q) ||
                item.note.toLowerCase().includes(q) ||
                (item.detectedVendor.personName || '').toLowerCase().includes(q) ||
                (item.detectedVendor.personCode || '').toLowerCase().includes(q)
            );
        });
    }, [pendingList, activeTab, searchQuery]);

    if (!isOpen) return null;

    const readyCount = pendingList.filter(p => p.isReady).length;
    const manualCount = pendingList.filter(p => !p.isReady).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    اتوماسیون ثبت پیش‌فاکتور (کد ۵۷) بر مبنای درخواست خرید کالا (کد ۵۳) در سایان
                                </h2>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    اتصال مستقیم آنلاین
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                بررسی ساعتی هوشمند، استخراج نام تامین‌کننده از توضیحات سند، و ثبت رسمی با فی ۱ ریال بدون تغییر یا آسیب به اسناد اصلی
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchStatusAndData}
                            disabled={loading}
                            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="بروزرسانی داده‌ها"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                {toastMessage && (
                    <div className={`px-6 py-2.5 text-sm font-medium flex items-center justify-between border-b ${
                        toastMessage.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                            : toastMessage.type === 'error'
                            ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                            : 'bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-200 border-blue-200 dark:border-blue-800'
                    }`}>
                        <div className="flex items-center gap-2">
                            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                            {toastMessage.type === 'info' && <AlertTriangle className="w-4 h-4 text-blue-600" />}
                            <span>{toastMessage.text}</span>
                        </div>
                        <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100">بستن</button>
                    </div>
                )}

                {/* Top Metrics & Automation Bar */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Metric 1 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                            <span>کل درخواست‌های معلق ۵۳</span>
                            <Layers className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {pendingList.length}
                            </span>
                            <span className="text-xs text-slate-500">سند در سال مالی ۱۴۰۵</span>
                        </div>
                    </div>

                    {/* Metric 2 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            <span>آماده تبدیل هوشمند (فی ۱ ریال)</span>
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {readyCount}
                            </span>
                            <span className="text-xs text-slate-500">تامین‌کننده شناسایی شد</span>
                        </div>
                    </div>

                    {/* Metric 3 */}
                    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-medium">
                            <span>نیازمند تعیین دستی تامین‌کننده</span>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                {manualCount}
                            </span>
                            <span className="text-xs text-slate-500">بدون شرح یا شرح نامشخص</span>
                        </div>
                    </div>

                    {/* Metric 4: Automation Toggle & Controls */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950/40 border border-blue-200/80 dark:border-indigo-800/60 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                وضعیت اجرای خودکار ساعتی
                            </span>
                            <button
                                onClick={handleToggleCron}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    config?.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        config?.enabled ? 'translate-x-1' : 'translate-x-6'
                                    }`}
                                />
                            </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">
                                {config?.enabled ? '🟢 فعال (هر ۶۰ دقیقه)' : '⚪ غیرفعال (دستی)'}
                            </span>
                            <button
                                onClick={() => handleRunBatch(false)}
                                disabled={actionLoading === 'BATCH' || readyCount === 0}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                            >
                                {actionLoading === 'BATCH' ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Play className="w-3 h-3 fill-current" />
                                )}
                                <span>اجرای فوری گروهی</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-tabs & Search Header */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl">
                        <button
                            onClick={() => setActiveTab('READY')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'READY'
                                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            آماده تبدیل ({readyCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('MANUAL')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'MANUAL'
                                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            نیاز به بررسی دستی ({manualCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('LOGS')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'LOGS'
                                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            سوابق و لاگ‌های ثبت ({logs.length})
                        </button>
                    </div>

                    {/* Search & Batch simulation */}
                    {activeTab !== 'LOGS' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="جستجوی شماره سند، توضیحات، تامین‌کننده..."
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            />
                            <button
                                onClick={() => handleRunBatch(true)}
                                disabled={actionLoading === 'BATCH' || readyCount === 0}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                            >
                                شبیه‌سازی آزمایشی (بدون ثبت)
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                            <p className="text-sm font-medium">در حال واکشی اطلاعات و پردازش تامین‌کنندگان سایان...</p>
                        </div>
                    ) : activeTab === 'LOGS' ? (
                        /* Logs Table */
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">زمان ثبت</th>
                                        <th className="py-3 px-4">نوع عملیات</th>
                                        <th className="py-3 px-4">شماره درخواست ۵۳</th>
                                        <th className="py-3 px-4">پیش‌فاکتور ثبت‌شده ۵۷</th>
                                        <th className="py-3 px-4">تامین‌کننده</th>
                                        <th className="py-3 px-4">فی واحد</th>
                                        <th className="py-3 px-4">اقلام</th>
                                        <th className="py-3 px-4">کاربر / مجری</th>
                                        <th className="py-3 px-4">وضعیت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400">
                                                هنوز لاگی برای ثبت پیش‌فاکتور ثبت نشده است.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="py-2.5 px-4 text-slate-500 font-mono">
                                                    {new Date(log.timestamp).toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-4 font-semibold">
                                                    {log.action === 'LIVE_CONVERT' ? (
                                                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                            ثبت واقعی در سایان
                                                        </span>
                                                    ) : log.action === 'DRY_RUN_CONVERT' ? (
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                            شبیه‌سازی آزمایشی
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                                            خطا در ثبت
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                    {log.doc53No || '-'}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                    {log.created57DocNo ? `سند ۵۷ شماره ${log.created57DocNo}` : '-'}
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                                                    {log.vendorName ? `${log.vendorName} (${log.vendorCode})` : log.vendorCode || '-'}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-emerald-600 font-bold">
                                                    ۱ ریال
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-500">
                                                    {log.itemsCount || '-'} ردیف
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-500">
                                                    {log.user || 'اتوماسیون'}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {log.success ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            موفق
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium" title={log.error}>
                                                            <AlertCircle className="w-3.5 h-3.5" />
                                                            خطا
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Pending Documents Table */
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">شماره درخواست (۵۳)</th>
                                        <th className="py-3 px-4">تاریخ سند</th>
                                        <th className="py-3 px-4">توضیحات ثبت‌شده در سایان</th>
                                        <th className="py-3 px-4">تامین‌کننده شناسایی‌شده</th>
                                        <th className="py-3 px-4">تعداد اقلام</th>
                                        <th className="py-3 px-4">فی تنظیمی</th>
                                        <th className="py-3 px-4 text-center">عملیات تبدیل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredPending.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                موردی در این دسته یافت نشد.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPending.map((doc) => (
                                            <tr key={doc.doc53Id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                                                    درخواست #{doc.docNo}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 font-mono">
                                                    {formatDate(doc.docDate)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-800 dark:text-slate-200 max-w-xs truncate" title={doc.note}>
                                                    {doc.note || <span className="text-slate-400 italic">بدون متن توضیحات</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {doc.detectedVendor.personCode ? (
                                                        <div>
                                                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                                                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                                                                <span>{doc.detectedVendor.personName || doc.detectedVendor.personCode}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                                <span>کد تفصیلی: {doc.detectedVendor.personCode}</span>
                                                                <span>•</span>
                                                                <span className="text-emerald-600 font-medium">اطمینان {doc.detectedVendor.confidence}٪</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            نیاز به انتخاب دستی
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                    <button
                                                        onClick={() => handleViewItems(doc)}
                                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium hover:underline"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>{doc.itemsCount} ردیف کالا</span>
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                                                    ۱ ریال
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {doc.isReady ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleConvertSingle(doc, false)}
                                                                    disabled={actionLoading === doc.doc53Id}
                                                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                                                >
                                                                    {actionLoading === doc.doc53Id ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>ثبت ۵۷</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleConvertSingle(doc, true)}
                                                                    disabled={actionLoading === doc.doc53Id}
                                                                    title="شبیه‌سازی بدون ذخیره در دیتابیس"
                                                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                                                                >
                                                                    <Play className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDoc(doc);
                                                                    setOverrideVendorCode('');
                                                                    setOverrideVendorName('');
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors"
                                                            >
                                                                تعیین تامین‌کننده
                                                            </button>
                                                        )}
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

                {/* Footer Security Notice */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>
                            <b>امنیت و یکپارچگی ۱۰۰٪:</b> اسناد ۵۳ اصلی ویرایش نمی‌شوند؛ سند ۵۷ در سربرگ و اقلام درج شده و زنجیره در جدول ۲۹ ثبت می‌گردد.
                        </span>
                    </div>
                    <div className="font-mono text-[11px]">
                        نسخه اتوماسیون سایان: v1.0.0 (Enterprise Safe)
                    </div>
                </div>

            </div>

            {/* Modal: View Items of Document */}
            {selectedDocForItems && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">
                                    اقلام درخواست خرید شماره {selectedDocForItems.docNo}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    شرح سند: {selectedDocForItems.note || 'ندارد'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedDocForItems(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-3">
                            {itemsLoading ? (
                                <div className="py-10 text-center text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                                    <span>در حال خواندن اقلام از جدول انبار سایان...</span>
                                </div>
                            ) : docItems.length === 0 ? (
                                <div className="py-8 text-center text-slate-400">ردیفی برای این سند یافت نشد.</div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                                    {docItems.map((item, idx) => (
                                        <div key={idx} className="py-2.5 flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {item.ItemName || 'کالای بدون عنوان'}
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                    کد کالا: {item.ItemCode} | انبار: {item.WarehouseCode}
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                                                    {item.Qty} {item.UnitName}
                                                </div>
                                                <div className="text-[10px] text-emerald-600 font-bold">
                                                    فی در ۵۷: ۱ ریال
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={() => setSelectedDocForItems(null)}
                                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Manual Vendor Override */}
            {editingDoc && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
                    <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white">
                                تعیین تامین‌کننده برای درخواست #{editingDoc.docNo}
                            </h3>
                            <button onClick={() => setEditingDoc(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="py-4 space-y-3 text-xs">
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <span className="text-slate-500">توضیحات اصلی سند:</span>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                                    {editingDoc.note || 'ندارد'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                                    کد تفصیلی تامین‌کننده در سایان (PersonCode):
                                </label>
                                <input
                                    type="text"
                                    value={overrideVendorCode}
                                    onChange={(e) => setOverrideVendorCode(e.target.value)}
                                    placeholder="مثلاً: 2334 یا 1355"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                                    نام تامین‌کننده (اختیاری جهت لاگ):
                                </label>
                                <input
                                    type="text"
                                    value={overrideVendorName}
                                    onChange={(e) => setOverrideVendorName(e.target.value)}
                                    placeholder="مثلاً: کارتن سازان عدل البرز"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setEditingDoc(null)}
                                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                انصراف
                            </button>
                            <button
                                onClick={() => handleConvertSingle(editingDoc, false, { code: overrideVendorCode, name: overrideVendorName })}
                                disabled={!overrideVendorCode.trim()}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
                            >
                                ثبت پیش‌فاکتور (کد ۵۷) با فی ۱ ریال
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
