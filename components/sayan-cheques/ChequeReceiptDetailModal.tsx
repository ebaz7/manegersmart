import React from 'react';
import {
    FileText, X, CheckCircle2, AlertCircle, Clock, ShieldCheck,
    CreditCard, Building2, User, Hash, Layers, Eye, Download, Printer,
    ArrowRight, Check, Sparkles, CornerUpLeft, Edit3, Trash2
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { UserRole } from '../../types';

interface Props {
    receipt: any;
    currentUser: any;
    onClose: () => void;
    onOpenRealSayanDoc: (archiveCode: string | number, docNo?: string | number) => void;
    onOpenAccountingReview: (receipt: any) => void;
    onApproveByCeo: (receiptId: string) => void;
    onReject: (receiptId: string) => void;
    onDelete?: (receiptId: string) => void;
    actionLoading: string | null;
}

const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const toShamsiDateStr = (dateInput: string | Date | null | undefined): string => {
    if (!dateInput) return '-';
    try {
        const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(d.getTime())) return String(dateInput);
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const mm = String(j.jm).padStart(2, '0');
        const dd = String(j.jd).padStart(2, '0');
        return `${j.jy}/${mm}/${dd}`;
    } catch {
        return String(dateInput);
    }
};

export const ChequeReceiptDetailModal: React.FC<Props> = ({
    receipt,
    currentUser,
    onClose,
    onOpenRealSayanDoc,
    onOpenAccountingReview,
    onApproveByCeo,
    onReject,
    onDelete,
    actionLoading
}) => {
    const isFinancialOrAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCIAL || currentUser.roles?.includes('financial') || currentUser.roles?.includes('admin');
    const isCeoOrAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || currentUser.role === 'CEO' || currentUser.role === 'MANAGER' || currentUser.roles?.includes('ceo') || currentUser.roles?.includes('admin');

    const statusBadge = () => {
        switch (receipt.status) {
            case 'REGISTERED_IN_SAYAN':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ثبت شده در سایان</span>
                    </span>
                );
            case 'PENDING_CEO':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>در انتظار تایید مدیرعامل (مرحله ۲)</span>
                    </span>
                );
            case 'PENDING_ACCOUNTING':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>در انتظار بررسی کارمند حسابداری (مرحله ۱)</span>
                    </span>
                );
            case 'REJECTED':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>عدم تایید / عودت</span>
                    </span>
                );
            default:
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {receipt.status}
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    رسید دریافت چک #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                </h3>
                                {statusBadge()}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                طرف حساب: {receipt.personName} | جمع کل: {toPersianDigits(Number(receipt.totalAmount || 0).toLocaleString('fa-IR'))} ریال
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Workflow Timeline */}
                <div className="p-4 bg-slate-100/70 dark:bg-slate-800/30 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    {/* Step 1: Creation */}
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                            ✓
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">۱. ثبت اولیه رسید چک</div>
                            <div className="text-[10px] text-slate-500">
                                {receipt.createdByName || 'کاربر سیستم'} ({toPersianDigits(toShamsiDateStr(receipt.createdAt))})
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block text-slate-400">←</div>

                    {/* Step 2: Accounting Review */}
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            receipt.accountingReview?.approved
                                ? 'bg-emerald-500 text-white'
                                : receipt.status === 'PENDING_ACCOUNTING'
                                ? 'bg-amber-500 text-white animate-pulse'
                                : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                            {receipt.accountingReview?.approved ? '✓' : '۲'}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">۲. بررسی کارمند حسابداری</div>
                            <div className="text-[10px] text-slate-500">
                                {receipt.accountingReview?.approved
                                    ? `تایید توسط ${receipt.accountingReview.byName || 'حسابداری'} (${toPersianDigits(toShamsiDateStr(receipt.accountingReview.date))})`
                                    : 'در انتظار بررسی و ویرایش کارشناس'}
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block text-slate-400">←</div>

                    {/* Step 3: CEO Approval & Sayan Sync */}
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                            receipt.status === 'REGISTERED_IN_SAYAN'
                                ? 'bg-emerald-500 text-white'
                                : receipt.status === 'PENDING_CEO'
                                ? 'bg-blue-500 text-white animate-pulse'
                                : 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                            {receipt.status === 'REGISTERED_IN_SAYAN' ? '✓' : '۳'}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white">۳. تایید مدیرعامل و ثبت در سایان</div>
                            <div className="text-[10px] text-slate-500">
                                {receipt.status === 'REGISTERED_IN_SAYAN'
                                    ? `سند ${toPersianDigits(receipt.docNo || '-')} در سایان صادر شد`
                                    : 'در انتظار تایید نهایی مدیرعامل'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {receipt.sayanError && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold space-y-1.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                                <span className="font-black text-sm">خطای آخرین تلاش ثبت در سایان:</span>
                            </div>
                            <p className="font-mono bg-white/60 dark:bg-slate-900/40 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900 leading-relaxed text-[11px] select-all">
                                {receipt.sayanError}
                            </p>
                            <span className="text-[10px] text-slate-400 block mt-1 font-sans">
                                می‌توانید اطلاعات رسید را ویرایش کنید، رسید را جهت اصلاح به حسابداری عودت دهید یا پس از رفع مشکل مجدداً تایید و ثبت نمایید.
                            </span>
                        </div>
                    )}

                    {/* Header Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block mb-1 font-bold">شماره رسید / پشت‌نمره</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-mono font-black text-blue-600 text-base">
                                    #{toPersianDigits(receipt.poshtNomreh || receipt.receiptNo || '766')}
                                </span>
                                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200">
                                    یکسان (۷۶۶)
                                </span>
                            </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-400 block mb-1 font-bold">کد بایگانی / سند سایان</span>
                            <span className="font-mono font-black text-purple-600 text-base">
                                {receipt.archiveCode ? toPersianDigits(receipt.archiveCode) : 'در انتظار ثبت نهایی'}
                            </span>
                        </div>

                        <div className="sm:col-span-2 p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200/80 dark:border-emerald-800 flex flex-col justify-center">
                            <span className="text-emerald-800 dark:text-emerald-300 block text-xs font-black mb-1">
                                مبلغ کل رسید چک (بزرگ و برجسته)
                            </span>
                            <div className="flex flex-wrap items-baseline gap-2">
                                <span className="font-mono font-black text-xl sm:text-2xl text-emerald-600 dark:text-emerald-400">
                                    {toPersianDigits(Number(receipt.totalAmount || 0).toLocaleString('fa-IR'))}
                                </span>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300">ریال</span>
                                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-2.5 py-0.5 rounded-lg border border-emerald-200/60">
                                    {toPersianDigits(Math.floor(Number(receipt.totalAmount || 0) / 10).toLocaleString('fa-IR'))} تومان
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Person & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                            <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 border-b pb-2 text-sm">
                                <User className="w-4 h-4 text-blue-500" />
                                <span>مشخصات طرف حساب و صادرکننده چک</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                                <span className="text-slate-500 font-bold">نام طرف حساب:</span>
                                <span className="font-black text-sm text-slate-900 dark:text-white">{receipt.personName}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                                <span className="text-slate-500 font-bold">کد تفصیلی در سایان:</span>
                                <span className="font-mono font-black text-blue-600 text-xs">{toPersianDigits(receipt.personCode || '-')}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/60">
                                <span className="text-slate-500 font-bold">صندوق خزانه‌داری سایان:</span>
                                <span className="font-black text-purple-600 text-xs">
                                    {receipt.cashboxCode === '11001' ? 'صندوق دفتر (۱۱۰۰۱)' : 
                                     receipt.cashboxCode === '11002' ? 'صندوق سکه و کارت هدیه (۱۱۰۰۲)' :
                                     receipt.cashboxCode === '11003' ? 'صندوق آقای مقدم (۱۱۰۰۳)' :
                                     receipt.cashboxCode === '11004' ? 'صندوق ارزی (۱۱۰۰۴)' :
                                     receipt.cashboxCode === '11005' ? 'صندوق چک های برگشتی (۱۱۰۰۵)' :
                                     receipt.cashboxCode ? `صندوق ${toPersianDigits(receipt.cashboxCode)}` : 'صندوق دفتر (۱۱۰۰۱)'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-slate-500 font-bold">تاریخ دریافت:</span>
                                <span className="font-mono font-bold">{toPersianDigits(toShamsiDateStr(receipt.docDate || receipt.createdAt))}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 border-b pb-2 text-sm">
                                <FileText className="w-4 h-4 text-emerald-500" />
                                <span>شرح رسید و یادداشت‌ها</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl font-medium">
                                {receipt.description || 'بدون شرح ثبت شده'}
                            </p>
                            {receipt.accountingReview?.note && (
                                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                                    <span className="font-bold block mb-0.5">یادداشت حسابداری:</span>
                                    {receipt.accountingReview.note}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CEO Approval Review Box (مدیرعامل موقع تایید ببیند و سپس تایید کند) */}
                    {receipt.status === 'PENDING_CEO' && isCeoOrAdmin && (
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800 pb-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                    <span className="font-black text-sm text-emerald-950 dark:text-emerald-100">
                                        بررسی و تایید نهایی مدیرعامل جهت صدور سند در سایان
                                    </span>
                                </div>
                                <span className="text-xs bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-3 py-1 rounded-full font-bold">
                                    مرحله نهایی
                                </span>
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-1">
                                <p className="font-medium">
                                    مدیرعامل محترم، اطلاعات چک، مبلغ کل (<strong className="text-emerald-700 dark:text-emerald-400 font-mono">{toPersianDigits(Number(receipt.totalAmount || 0).toLocaleString('fa-IR'))} ریال</strong>) و مشخصات صادرکننده را بررسی فرمایید. پس از تایید شما، سند به طور قطعی در پایگاه‌داده سایان ثبت خواهد شد.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => onReject(receipt.id)}
                                    disabled={actionLoading === receipt.id}
                                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-rose-600 border border-rose-300 dark:border-rose-800 font-bold text-xs hover:bg-rose-50"
                                >
                                    عدم تایید / عودت به حسابداری
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onApproveByCeo(receipt.id)}
                                    disabled={actionLoading === receipt.id}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50"
                                >
                                    <ShieldCheck className="w-5 h-5" />
                                    <span>
                                        {actionLoading === receipt.id ? 'در حال ثبت در پایگاه سایان...' : 'تایید نهایی مدیرعامل و ثبت در ERP سایان'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cheques Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span className="font-black text-sm">برگه‌های چک درج شده در رسید ({toPersianDigits(receipt.cheques?.length || 1)} فقره)</span>
                            <span className="text-[11px] text-emerald-600 font-mono font-bold">
                                جمع کل چک‌ها: {toPersianDigits(Number(receipt.totalAmount || 0).toLocaleString('fa-IR'))} ریال
                            </span>
                        </div>
                        <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3 py-3">ردیف</th>
                                        <th className="px-3 py-3">شماره چک (صیادی)</th>
                                        <th className="px-3 py-3">مبلغ چک (ریال)</th>
                                        <th className="px-3 py-3">سررسید (شمسی)</th>
                                        <th className="px-3 py-3">بانک صادرکننده</th>
                                        <th className="px-3 py-3">در وجه / صادرکننده چک</th>
                                        <th className="px-3 py-3">بابت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {receipt.cheques?.map((ch: any, idx: number) => (
                                        <tr key={ch.chequeId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-3 py-3.5 text-slate-400 font-mono font-bold">{toPersianDigits(idx + 1)}</td>
                                            <td className="px-3 py-3.5 font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                                                {toPersianDigits(ch.chequeNumber || '-')}
                                            </td>
                                            <td className="px-3 py-3.5 font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                                                {toPersianDigits(Number(ch.amount || 0).toLocaleString('fa-IR'))}
                                            </td>
                                            <td className="px-3 py-3.5 font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                                                {toPersianDigits(toShamsiDateStr(ch.dueDate))}
                                            </td>
                                            <td className="px-3 py-3.5 font-bold text-sm text-slate-800 dark:text-slate-200">{ch.bankName || '-'}</td>
                                            <td className="px-3 py-3.5 font-black text-sm text-slate-900 dark:text-white">{ch.inNameOf || receipt.personName || '-'}</td>
                                            <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">{ch.description || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Attachments Section (PDF / Image) */}
                    {receipt.attachments && receipt.attachments.length > 0 && (
                        <div className="space-y-2 text-xs">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">
                                فایل‌های پیوست شده چک‌ها و رسید ({toPersianDigits(receipt.attachments.length)} فایل)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {receipt.attachments.map((att: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-4 h-4 text-purple-500 shrink-0" />
                                            <span className="truncate font-medium">{att.fileName || `پیوست شماره ${idx + 1}`}</span>
                                        </div>
                                        {att.fileData && (
                                            <a
                                                href={att.fileData}
                                                download={att.fileName || `cheque-receipt-${receipt.id}.pdf`}
                                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1 shrink-0"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span>دانلود / مشاهده</span>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                        >
                            بستن
                        </button>

                        {receipt.status !== 'REGISTERED_IN_SAYAN' && isFinancialOrAdmin && onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(receipt.id)}
                                disabled={actionLoading === receipt.id}
                                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 hover:text-rose-700 transition-colors"
                                title="حذف کامل این رسید چک"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>حذف کامل رسید</span>
                            </button>
                        )}

                        {receipt.archiveCode && (
                            <button
                                type="button"
                                onClick={() => onOpenRealSayanDoc(receipt.archiveCode, receipt.docNo)}
                                className="px-3.5 py-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 hover:bg-purple-200 transition-colors"
                            >
                                <Layers className="w-4 h-4" />
                                <span>مشاهده سند واقعی در سایان</span>
                            </button>
                        )}
                    </div>

                    {/* Step Actions */}
                    <div className="flex items-center gap-2">
                        {/* Step 1: Accounting can edit and approve */}
                        {receipt.status === 'PENDING_ACCOUNTING' && isFinancialOrAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onReject(receipt.id)}
                                    disabled={actionLoading === receipt.id}
                                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs hover:bg-rose-100"
                                >
                                    رد / بازگشت
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenAccountingReview(receipt)}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    <span>ویرایش و تایید حسابداری</span>
                                </button>
                            </>
                        )}

                        {/* Edit button for Accounting/Admin on pending/failed receipts */}
                        {receipt.status !== 'REGISTERED_IN_SAYAN' && receipt.status !== 'PENDING_ACCOUNTING' && isFinancialOrAdmin && (
                            <button
                                type="button"
                                onClick={() => onOpenAccountingReview(receipt)}
                                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                            >
                                <Edit3 className="w-4 h-4" />
                                <span>ویرایش اطلاعات رسید</span>
                            </button>
                        )}

                        {/* Step 2: CEO Approves and registers in Sayan DB */}
                        {receipt.status === 'PENDING_CEO' && isCeoOrAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onReject(receipt.id)}
                                    disabled={actionLoading === receipt.id}
                                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 font-bold text-xs hover:bg-rose-100"
                                >
                                    عدم تایید مدیرعامل
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onApproveByCeo(receipt.id)}
                                    disabled={actionLoading === receipt.id}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{actionLoading === receipt.id ? 'در حال ثبت در پایگاه سایان...' : 'تایید نهایی مدیرعامل و ثبت در ERP سایان'}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
