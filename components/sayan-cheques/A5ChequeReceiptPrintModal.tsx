import React, { useRef } from 'react';
import { Printer, X, Download, FileText, CheckCircle2, Copy, Check, Building2, User, Calendar, CreditCard } from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { formatChequeAmountInWords } from '../../utils/persianNumberToWords';

export interface A5ChequeData {
    id?: string | number;
    receiptNo?: string | number;
    poshtNomreh?: string;
    personCode?: string;
    personName?: string;
    cashboxCode?: string;
    cashboxTitle?: string;
    fiscalYear?: string;
    totalAmount: number;
    docDateShamsi?: string;
    createdAt?: string;
    description?: string;
    createdByName?: string;
    cheques: Array<{
        chequeNumber: string;
        amount: number | string;
        dueDate: string;
        bankName: string;
        inNameOf?: string;
        description?: string;
        rowSeq?: number;
    }>;
}

interface Props {
    isOpen?: boolean;
    receipt: A5ChequeData | null;
    onClose: () => void;
    onRegisterNewNext?: () => void;
}

const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const toShamsiStr = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return dateStr;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const mm = String(j.jm).padStart(2, '0');
        const dd = String(j.jd).padStart(2, '0');
        return `${j.jy}/${mm}/${dd}`;
    } catch {
        return dateStr || '';
    }
};

export const A5ChequeReceiptPrintModal: React.FC<Props> = ({
    isOpen = true,
    receipt,
    onClose,
    onRegisterNewNext
}) => {
    const [copied, setCopied] = React.useState(false);

    if (!isOpen || !receipt) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleCopySummary = () => {
        if (!receipt) return;
        const text = `رسید دریافت چک #${receipt.receiptNo || receipt.id}\nطرف حساب: ${receipt.personName} (کد: ${receipt.personCode})\nشماره پشت‌نمره: ${receipt.poshtNomreh || '-'}\nتعداد چک: ${receipt.cheques.length} فقره\nجمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال\nبابت: ${receipt.description || '-'}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const totalAmount = Number(receipt.totalAmount) || 0;
    const amountInWords = formatChequeAmountInWords(totalAmount);
    const receiptDate = receipt.docDateShamsi || toShamsiStr(receipt.createdAt) || toShamsiStr(new Date().toISOString());

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fade-in">
            {/* Print CSS specific to A5 Landscape */}
            <style>{`
                @page {
                    size: A5 landscape;
                    margin: 4mm 6mm;
                }
                @media print {
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                    }
                    /* Hide everything outside print container */
                    body * {
                        visibility: hidden !important;
                    }
                    #a5-cheque-receipt-print-area,
                    #a5-cheque-receipt-print-area * {
                        visibility: visible !important;
                    }
                    #a5-cheque-receipt-print-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100vw !important;
                        max-width: 100vw !important;
                        height: 100vh !important;
                        margin: 0 !important;
                        padding: 4mm 6mm !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        z-index: 999999 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100">
                {/* Modal Top Control Bar (Hidden on Print) */}
                <div className="no-print p-4 bg-slate-800/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-white">
                                    رسید دریافت چک با موفقیت ثبت شد
                                </h3>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[11px] font-mono font-bold border border-emerald-800">
                                    رسید شماره #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                پیش‌نمایش استاندارد سند دریافت اسناد تجاری در ابعاد A5 افقی (آماده پرینت و بایگانی)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCopySummary}
                            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="کپی خلاصه رسید"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copied ? 'کپی شد' : 'کپی خلاصه'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                        >
                            <Printer className="w-4 h-4" />
                            <span>چاپ رسید (A5 افقی)</span>
                        </button>

                        {onRegisterNewNext && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onRegisterNewNext();
                                }}
                                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                            >
                                ثبت رسید بعدی
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="بستن پنجره"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Paper Canvas (Desk style presentation) */}
                <div className="p-3 sm:p-6 bg-slate-950/60 overflow-x-auto flex justify-center items-center">
                    {/* A5 Landscape Printable Sheet: 210mm x 148mm aspect ratio ~ 1.419 */}
                    <div
                        id="a5-cheque-receipt-print-area"
                        className="w-full max-w-[920px] bg-white text-slate-900 rounded-xl shadow-2xl p-5 sm:p-6 border-2 border-slate-300 flex flex-col justify-between select-text"
                        style={{ minHeight: '520px' }}
                    >
                        {/* 1. Header Section */}
                        <div className="border-b-2 border-slate-900 pb-3">
                            <div className="flex items-center justify-between">
                                {/* Company Logo & Identity */}
                                <div className="text-right w-1/3">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                        شرکت لیان بافت
                                    </h2>
                                    <p className="text-[10px] text-slate-600 font-bold">
                                        سیستم مدیریت مالی و خزانه‌داری
                                    </p>
                                    <p className="text-[9px] text-slate-500">
                                        واحد اعتبارات و دریافت اسناد تجاری
                                    </p>
                                </div>

                                {/* Main Title Badge */}
                                <div className="text-center w-1/3 flex flex-col items-center">
                                    <div className="px-4 py-1 rounded-lg border-2 border-slate-900 bg-slate-50">
                                        <h1 className="text-sm sm:text-base font-black text-slate-900">
                                            رسید دریافت چک
                                        </h1>
                                    </div>
                                    <span className="text-[9px] text-slate-600 font-bold mt-1">
                                        (اسناد دریافتنی نزد صندوق خزانه‌داری)
                                    </span>
                                </div>

                                {/* Tracking & Date Metadata */}
                                <div className="text-left w-1/3 text-[11px] font-mono space-y-0.5">
                                    <div className="flex justify-end items-center gap-1.5 font-bold">
                                        <span className="text-slate-600 font-sans text-[10px]">شماره رسید:</span>
                                        <span className="text-slate-900 font-black text-xs font-mono">
                                            #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[10px]">شماره پشت‌نمره:</span>
                                        <span className="text-slate-900 font-bold font-mono">
                                            {toPersianDigits(receipt.poshtNomreh || '-')}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[10px]">تاریخ صدور:</span>
                                        <span className="text-slate-900 font-bold font-mono">
                                            {toPersianDigits(receiptDate)}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[10px]">سال مالی:</span>
                                        <span className="text-slate-900 font-mono">
                                            {toPersianDigits(receipt.fiscalYear || '۱۴۰۳')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Party & Account Details Strip */}
                            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 grid grid-cols-12 gap-2 text-xs">
                                <div className="col-span-12 sm:col-span-5 flex items-center gap-1.5">
                                    <span className="text-slate-600 text-[11px] shrink-0 font-bold">دریافت شد از:</span>
                                    <span className="font-black text-slate-900 truncate">
                                        {receipt.personName || 'شخص نامشخص'}
                                    </span>
                                    {receipt.personCode && (
                                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            کد: {toPersianDigits(receipt.personCode)}
                                        </span>
                                    )}
                                </div>

                                <div className="col-span-12 sm:col-span-4 flex items-center gap-1.5">
                                    <span className="text-slate-600 text-[11px] shrink-0 font-bold">صندوق مقصد:</span>
                                    <span className="font-bold text-slate-800 text-[11px] truncate">
                                        {receipt.cashboxTitle || `صندوق خزانه‌داری (${receipt.cashboxCode || '11001'})`}
                                    </span>
                                </div>

                                <div className="col-span-12 sm:col-span-3 flex items-center gap-1.5 justify-end">
                                    <span className="text-slate-600 text-[11px] shrink-0 font-bold">تعداد فقره:</span>
                                    <span className="font-mono font-black text-xs text-slate-900">
                                        {toPersianDigits(receipt.cheques.length)} فقره چک
                                    </span>
                                </div>

                                {receipt.description && (
                                    <div className="col-span-12 flex items-center gap-1.5 pt-1">
                                        <span className="text-slate-600 text-[11px] shrink-0 font-bold">بابت / شرح:</span>
                                        <span className="text-slate-800 text-[11px] font-medium truncate">
                                            {receipt.description}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Cheques Table */}
                        <div className="my-2.5 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-400 text-center text-xs">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-400 text-slate-800 font-bold text-[10px] sm:text-[11px]">
                                        <th className="py-1.5 px-1 border-l border-slate-400 w-8">ردیف</th>
                                        <th className="py-1.5 px-2 border-l border-slate-400">شماره صیادی / چک</th>
                                        <th className="py-1.5 px-2 border-l border-slate-400 w-24">تاریخ سررسید</th>
                                        <th className="py-1.5 px-2 border-l border-slate-400 w-32">مبلغ چک (ریال)</th>
                                        <th className="py-1.5 px-2 border-l border-slate-400">بانک صادرکننده</th>
                                        <th className="py-1.5 px-2 border-l border-slate-400">صاحب حساب / صادرکننده</th>
                                        <th className="py-1.5 px-2">بابت / توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipt.cheques.map((ch, idx) => (
                                        <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50 transition-colors text-[11px]">
                                            <td className="py-1.5 px-1 border-l border-slate-300 font-mono font-bold text-slate-700">
                                                {toPersianDigits(ch.rowSeq || (idx + 1))}
                                            </td>
                                            <td className="py-1.5 px-2 border-l border-slate-300 font-mono font-black text-slate-900 text-right dir-ltr">
                                                {toPersianDigits(ch.chequeNumber)}
                                            </td>
                                            <td className="py-1.5 px-2 border-l border-slate-300 font-mono font-bold text-slate-800">
                                                {toPersianDigits(toShamsiStr(ch.dueDate))}
                                            </td>
                                            <td className="py-1.5 px-2 border-l border-slate-300 font-mono font-black text-slate-900 text-left dir-ltr">
                                                {toPersianDigits(Number(ch.amount).toLocaleString('fa-IR'))}
                                            </td>
                                            <td className="py-1.5 px-2 border-l border-slate-300 font-bold text-slate-800">
                                                {ch.bankName}
                                            </td>
                                            <td className="py-1.5 px-2 border-l border-slate-300 font-medium text-slate-800 text-right truncate max-w-[140px]">
                                                {ch.inNameOf || receipt.personName || '-'}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-600 text-right truncate max-w-[140px] text-[10px]">
                                                {ch.description || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Summary & Financial Totals */}
                        <div className="border border-slate-900 rounded-lg p-2.5 bg-slate-50 space-y-1.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-700 font-bold text-[11px]">جمع کل مبالغ:</span>
                                    <span className="font-mono font-black text-sm text-slate-900">
                                        {toPersianDigits(totalAmount.toLocaleString('fa-IR'))} ریال
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-300">
                                        ({toPersianDigits(Math.floor(totalAmount / 10).toLocaleString('fa-IR'))} تومان)
                                    </span>
                                </div>

                                <div className="text-[11px]">
                                    <span className="text-slate-600 font-bold">مجموع تعداد: </span>
                                    <span className="font-mono font-bold text-slate-900">
                                        {toPersianDigits(receipt.cheques.length)} فقره
                                    </span>
                                </div>
                            </div>

                            <div className="text-[11px] pt-1 border-t border-slate-300 flex items-start gap-1.5">
                                <span className="font-bold text-slate-700 shrink-0">مبلغ کل به حروف:</span>
                                <span className="font-bold text-slate-900">
                                    {amountInWords.rialWords} ({amountInWords.tomanWords})
                                </span>
                            </div>

                            <p className="text-[9px] text-slate-500 leading-relaxed pt-0.5">
                                * اسناد و چک‌های فوق‌الذکر جهت واریز به حساب و طی تشریفات بانکی دریافت گردید. تسویه نهایی حساب منوط به وصول قطعی وجه در سررسیدهای مقرر در شبکه بانکی (سامانه صیاد) خواهد بود.
                            </p>
                        </div>

                        {/* 4. Official Signature Boxes (4 Symmetrical Pillars for A5 Landscape) */}
                        <div className="mt-4 pt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
                            {/* Box 1: Depositor / Customer */}
                            <div className="border border-slate-400 rounded-lg p-2 flex flex-col justify-between h-20 bg-white">
                                <span className="font-bold text-slate-800">
                                    امضا و اثرانگشت واگذارکننده
                                </span>
                                <span className="text-[9px] text-slate-500">
                                    ({receipt.personName || 'طرف‌حساب'})
                                </span>
                            </div>

                            {/* Box 2: Receiver / User */}
                            <div className="border border-slate-400 rounded-lg p-2 flex flex-col justify-between h-20 bg-white">
                                <span className="font-bold text-slate-800">
                                    تحویل‌گیرنده / ثبت‌کننده
                                </span>
                                <span className="text-[9px] text-slate-500 font-mono">
                                    {receipt.createdByName || 'کاربر سیستم'}
                                </span>
                            </div>

                            {/* Box 3: Accounting / Treasury */}
                            <div className="border border-slate-400 rounded-lg p-2 flex flex-col justify-between h-20 bg-white">
                                <span className="font-bold text-slate-800">
                                    امور مالی و خزانه‌داری
                                </span>
                                <span className="text-[9px] text-slate-400">
                                    (تایید وصول و کارتابل)
                                </span>
                            </div>

                            {/* Box 4: Management / CEO */}
                            <div className="border border-slate-400 rounded-lg p-2 flex flex-col justify-between h-20 bg-white">
                                <span className="font-bold text-slate-800">
                                    مدیریت مالی / مدیرعامل
                                </span>
                                <span className="text-[9px] text-slate-400">
                                    (مهر و امضای نهایی)
                                </span>
                            </div>
                        </div>

                        {/* Footer Bar Code / System Meta */}
                        <div className="mt-2 pt-1 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400 font-mono">
                            <span>سامانه هوشمند خزانه‌داری و چک لیان بافت</span>
                            <span>شناسه رهگیری سند: {receipt.id || receipt.receiptNo}</span>
                            <span>زمان چاپ: {toPersianDigits(new Date().toLocaleTimeString('fa-IR'))}</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Dismiss / Next Action */}
                <div className="no-print p-3 bg-slate-800/60 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-[11px]">
                        <span>راهنما: برای پرینت، سایز کاغذ روی </span>
                        <strong className="text-white">A5</strong>
                        <span> و جهت روی </span>
                        <strong className="text-white">افقی (Landscape)</strong>
                        <span> تنظیم شده است.</span>
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition-colors"
                        >
                            بستن
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
