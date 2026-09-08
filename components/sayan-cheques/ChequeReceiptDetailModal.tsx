import React from 'react';
import {
    FileText, X, CheckCircle2, AlertCircle, Clock, ShieldCheck,
    CreditCard, Building2, User, Hash, Layers, Eye, Download, Printer,
    ArrowRight, Check, Sparkles, CornerUpLeft, Edit3
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
                    {/* Header Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                        <div>
                            <span className="text-slate-400 block mb-1">شماره رسید نرم‌افزار</span>
                            <span className="font-mono font-black text-blue-600 text-sm">
                                #{toPersianDigits(receipt.receiptNo || receipt.id)}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">شماره پشت‌نمره</span>
                            <span className="font-mono font-bold text-amber-600 text-sm">
                                {toPersianDigits(receipt.poshtNomreh || '-')}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">کد بایگانی / سند سایان</span>
                            <span className="font-mono font-bold text-purple-600 text-sm">
                                {receipt.archiveCode ? toPersianDigits(receipt.archiveCode) : 'هنوز ثبت نشده'}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">مجموع کل مبلغ رسید</span>
                            <span className="font-mono font-black text-emerald-600 text-sm">
                                {toPersianDigits(Number(receipt.totalAmount || 0).toLocaleString('fa-IR'))} ریال
                            </span>
                        </div>
                    </div>

                    {/* Person & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b pb-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <span>مشخصات طرف حساب و تحویل دهنده</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                                <span className="text-slate-400">نام شخص / شرکت:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{receipt.personName}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                                <span className="text-slate-400">کد تفصیلی شخص در سایان:</span>
                                <span className="font-mono font-bold text-blue-600">{toPersianDigits(receipt.personCode || '-')}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-slate-400">تاریخ دریافت:</span>
                                <span className="font-mono">{toPersianDigits(toShamsiDateStr(receipt.docDate || receipt.createdAt))}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b pb-2">
                                <FileText className="w-4 h-4 text-emerald-500" />
                                <span>شرح رسید و یادداشت‌ها</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
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

                    {/* Cheques Table */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span>برگه‌های چک درج شده در رسید ({toPersianDigits(receipt.cheques?.length || 1)} فقره)</span>
                        </div>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-3 py-2.5">ردیف</th>
                                        <th className="px-3 py-2.5">شماره چک (صیادی)</th>
                                        <th className="px-3 py-2.5">مبلغ چک (ریال)</th>
                                        <th className="px-3 py-2.5">سررسید (شمسی)</th>
                                        <th className="px-3 py-2.5">بانک صادرکننده</th>
                                        <th className="px-3 py-2.5">در وجه / صاحب حساب</th>
                                        <th className="px-3 py-2.5">بابت</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {receipt.cheques?.map((ch: any, idx: number) => (
                                        <tr key={ch.chequeId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-3 py-2.5 text-slate-400 font-mono">{toPersianDigits(idx + 1)}</td>
                                            <td className="px-3 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                                                {toPersianDigits(ch.chequeNumber || '-')}
                                            </td>
                                            <td className="px-3 py-2.5 font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                {toPersianDigits(Number(ch.amount || 0).toLocaleString('fa-IR'))}
                                            </td>
                                            <td className="px-3 py-2.5 font-mono">
                                                {toPersianDigits(toShamsiDateStr(ch.dueDate))}
                                            </td>
                                            <td className="px-3 py-2.5">{ch.bankName || '-'}</td>
                                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{ch.inNameOf || receipt.personName || '-'}</td>
                                            <td className="px-3 py-2.5 text-slate-500">{ch.description || '-'}</td>
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
