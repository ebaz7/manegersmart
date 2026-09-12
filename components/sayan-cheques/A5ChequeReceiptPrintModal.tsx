import React, { useRef, useState } from 'react';
import { 
    Printer, 
    X, 
    Download, 
    FileText, 
    CheckCircle2, 
    Copy, 
    Check, 
    Building2, 
    User, 
    Calendar, 
    CreditCard, 
    MessageSquare, 
    Send,
    Paperclip,
    Image as ImageIcon,
    Layers,
    Eye
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
import { formatChequeAmountInWords } from '../../utils/persianNumberToWords';
import { shareElementToChat, openSendToChat } from '../../services/chatShareService';

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
    attachments?: Array<{
        id?: string;
        fileName: string;
        fileType?: string;
        fileSize?: number;
        fileData?: string;
        url?: string;
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
    const [sharingToChat, setSharingToChat] = useState(false);
    const [printTarget, setPrintTarget] = useState<'all' | 'receipt' | 'attachments'>('all');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    if (!isOpen || !receipt) return null;

    const attachments = Array.isArray(receipt.attachments) ? receipt.attachments : [];
    const hasAttachments = attachments.length > 0;

    const handlePrint = (target: 'all' | 'receipt' | 'attachments' = 'all') => {
        setPrintTarget(target);
        setTimeout(() => {
            window.print();
        }, 80);
    };

    const handleCopySummary = () => {
        if (!receipt) return;
        const text = `رسید دریافت چک #${receipt.receiptNo || receipt.id}\nشرکت لپان بافت\nطرف حساب: ${receipt.personName} (کد: ${receipt.personCode})\nشماره پشت‌نمره: ${receipt.poshtNomreh || '-'}\nتعداد چک: ${receipt.cheques.length} فقره\nجمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال\nتعداد فایل‌های پیوست: ${attachments.length} مورد\nبابت: ${receipt.description || '-'}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShareToChat = async () => {
        if (!receipt) return;
        setSharingToChat(true);
        try {
            const el = document.getElementById('a5-cheque-receipt-print-area');
            const summaryText = `📄 رسید دریافت چک #${receipt.receiptNo || receipt.id} - شرکت لپان بافت\n👤 طرف حساب: ${receipt.personName} (کد ${receipt.personCode})\n🏷️ شماره پشت‌نمره: ${receipt.poshtNomreh || '-'}\n💳 تعداد چک: ${receipt.cheques.length} فقره\n💰 جمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال\n📎 پیوست‌ها: ${attachments.length} فایل\n📝 بابت: ${receipt.description || '-'}`;
            if (el) {
                await shareElementToChat(
                    el,
                    `Cheque_Receipt_${receipt.receiptNo || receipt.id}.jpg`,
                    {
                        defaultMessage: summaryText,
                        title: 'ارسال رسید چک به گفتگو'
                    }
                );
            } else {
                openSendToChat({
                    defaultMessage: summaryText,
                    title: 'ارسال رسید چک به گفتگو'
                });
            }
        } catch (err) {
            console.error('Error sharing receipt to chat:', err);
            openSendToChat({
                defaultMessage: `📄 رسید دریافت چک #${receipt.receiptNo || receipt.id} - شرکت لپان بافت\n👤 طرف حساب: ${receipt.personName}\n💰 جمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال`,
                title: 'ارسال رسید چک به گفتگو'
            });
        } finally {
            setSharingToChat(false);
        }
    };

    const totalAmount = Number(receipt.totalAmount) || 0;
    const amountInWords = formatChequeAmountInWords(totalAmount);
    const receiptDate = receipt.docDateShamsi || toShamsiStr(receipt.createdAt) || toShamsiStr(new Date().toISOString());

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto animate-fade-in">
            {/* Print & Screen CSS specific to A5 Landscape - Pure White Multi-Page Print */}
            <style>{`
                @page {
                    size: A5 landscape;
                    margin: 2mm 3mm;
                }
                
                /* Screen view isolation */
                .a5-screen-paper {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                }
                .a5-screen-paper * {
                    color: #000000 !important;
                    text-shadow: none !important;
                }

                @media print {
                    @page {
                        size: A5 landscape;
                        margin: 2mm 3mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, html.dark, body, body.dark, #root {
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Tahoma, sans-serif !important;
                    }
                    /* Completely neutralize background overlays */
                    .fixed, .relative, [class*="backdrop-blur"], [class*="bg-slate-950"], [class*="bg-slate-900"] {
                        background: transparent !important;
                        background-color: transparent !important;
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #a5-print-wrapper,
                    #a5-print-wrapper * {
                        visibility: visible !important;
                    }
                    #a5-print-wrapper {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                        background: #ffffff !important;
                    }

                    /* Receipt Page Print Styling */
                    .print-target-attachments #a5-cheque-receipt-print-area {
                        display: none !important;
                    }
                    .print-target-receipt .a5-attachment-print-page {
                        display: none !important;
                    }

                    #a5-cheque-receipt-print-area {
                        position: relative !important;
                        width: 100% !important;
                        height: 144mm !important;
                        max-height: 146mm !important;
                        padding: 2mm 3.5mm !important;
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1.5px solid #000000 !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: ${hasAttachments && printTarget !== 'receipt' ? 'always' : 'auto'} !important;
                        break-after: ${hasAttachments && printTarget !== 'receipt' ? 'page' : 'auto'} !important;
                        overflow: hidden !important;
                    }

                    #a5-cheque-receipt-print-area table {
                        border: 1.5px solid #000000 !important;
                        border-collapse: collapse !important;
                        width: 100% !important;
                        background-color: #ffffff !important;
                    }
                    #a5-cheque-receipt-print-area th {
                        background-color: #f1f5f9 !important;
                        background: #f1f5f9 !important;
                        padding: 2px 3px !important;
                        line-height: 1.2 !important;
                        font-size: 11px !important;
                        font-weight: 900 !important;
                        border: 1px solid #000000 !important;
                        color: #000000 !important;
                    }
                    #a5-cheque-receipt-print-area td {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        padding: 2px 3.5px !important;
                        line-height: 1.25 !important;
                        font-size: 11.5px !important;
                        font-weight: 800 !important;
                        border: 1px solid #000000 !important;
                        color: #000000 !important;
                    }
                    .signature-box {
                        height: 26px !important;
                        min-height: 26px !important;
                        max-height: 28px !important;
                        padding: 2px 4px !important;
                        font-size: 9.5px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        border: 1px solid #000000 !important;
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }

                    /* Attachments Print Pages */
                    .a5-attachment-print-page {
                        position: relative !important;
                        width: 100% !important;
                        height: 144mm !important;
                        max-height: 146mm !important;
                        padding: 3mm 4mm !important;
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: 1.5px solid #000000 !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        page-break-before: always !important;
                        break-before: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        overflow: hidden !important;
                    }
                    .a5-attachment-print-page:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }

                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto text-slate-100 max-h-[95vh]">
                {/* Modal Top Control Bar (Hidden on Print) */}
                <div className="no-print p-4 bg-slate-800/95 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
                                {hasAttachments && (
                                    <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 text-[11px] font-mono font-bold border border-indigo-800 flex items-center gap-1">
                                        <Paperclip className="w-3 h-3" />
                                        <span>{toPersianDigits(attachments.length)} پیوست</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400">
                                شرکت لپان بافت • ابعاد استاندارد A5 افقی • آماده چاپ و بایگانی رسمی
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                            onClick={handleShareToChat}
                            disabled={sharingToChat}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                            title="ارسال رسید به گفتگوی درون‌برنامه‌ای"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span>{sharingToChat ? 'در حال ارسال...' : 'ارسال به گفتگو'}</span>
                        </button>

                        {/* Print Group Buttons */}
                        {hasAttachments ? (
                            <div className="flex items-center bg-emerald-700 p-0.5 rounded-xl shadow-lg shadow-emerald-600/30">
                                <button
                                    type="button"
                                    onClick={() => handlePrint('all')}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-all active:scale-95"
                                    title="چاپ همزمان برگه رسید A5 و تمام فایل‌ها/تصاویر پیوست شده"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>چاپ کامل (رسید + پیوست‌ها)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePrint('receipt')}
                                    className="px-2.5 py-2 text-emerald-100 hover:text-white hover:bg-emerald-600/60 rounded-lg text-xs font-bold transition-colors"
                                    title="فقط چاپ برگه رسید"
                                >
                                    فقط رسید
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePrint('attachments')}
                                    className="px-2.5 py-2 text-emerald-100 hover:text-white hover:bg-emerald-600/60 rounded-lg text-xs font-bold transition-colors"
                                    title="فقط چاپ تصاویر پیوست"
                                >
                                    فقط پیوست
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handlePrint('all')}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                            >
                                <Printer className="w-4 h-4" />
                                <span>چاپ رسید (A5 افقی)</span>
                            </button>
                        )}

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

                {/* Printable Scroll Container */}
                <div 
                    id="a5-print-wrapper"
                    className={`flex-1 p-3 sm:p-6 bg-slate-950/60 overflow-y-auto space-y-6 ${
                        printTarget === 'attachments' ? 'print-target-attachments' : printTarget === 'receipt' ? 'print-target-receipt' : ''
                    }`}
                >
                    {/* PAGE 1: Official A5 Landscape Cheque Receipt */}
                    <div className="flex justify-center items-center">
                        <div
                            id="a5-cheque-receipt-print-area"
                            className="a5-screen-paper w-full max-w-[880px] aspect-[210/148] min-h-[560px] bg-white text-slate-900 rounded-xl shadow-2xl p-3 sm:p-4 border-2 border-slate-400 flex flex-col justify-between select-text"
                        >
                            {/* 1. Header Section */}
                            <div className="border-b-2 border-slate-900 pb-2">
                                <div className="flex items-center justify-between">
                                    {/* Company Logo & Identity */}
                                    <div className="text-right w-1/3">
                                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                                            شرکت لپان بافت
                                        </h2>
                                        <p className="text-[11px] sm:text-xs text-slate-700 font-bold leading-tight mt-0.5">
                                            سیستم مدیریت مالی و خزانه‌داری
                                        </p>
                                        <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-tight">
                                            واحد اعتبارات و دریافت اسناد تجاری
                                        </p>
                                    </div>

                                    {/* Main Title Badge */}
                                    <div className="text-center w-1/3 flex flex-col items-center">
                                        <div className="px-4 py-1 rounded-xl border-2 border-slate-900 bg-slate-100/80 shadow-xs">
                                            <h1 className="text-sm sm:text-base font-black text-slate-900">
                                                رسید دریافت چک
                                            </h1>
                                        </div>
                                        <span className="text-[10px] sm:text-[11px] text-slate-700 font-bold mt-1">
                                            (اسناد دریافتنی نزد صندوق خزانه‌داری)
                                        </span>
                                    </div>

                                    {/* Tracking & Date Metadata */}
                                    <div className="text-left w-1/3 text-[11px] sm:text-xs font-mono space-y-1">
                                        <div className="flex justify-end items-center gap-1.5 font-bold">
                                            <span className="text-slate-700 font-sans text-[11px]">شماره رسید:</span>
                                            <span className="text-slate-900 font-black text-xs sm:text-sm font-mono px-1.5 py-0.2 rounded bg-slate-100 border border-slate-400">
                                                #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                            </span>
                                        </div>
                                        <div className="flex justify-end items-center gap-1.5">
                                            <span className="text-slate-700 font-sans text-[11px] font-bold">شماره پشت‌نمره:</span>
                                            <span className="text-slate-900 font-black font-mono text-xs sm:text-[13px]">
                                                {toPersianDigits(receipt.poshtNomreh || '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-end items-center gap-1.5">
                                            <span className="text-slate-700 font-sans text-[11px] font-bold">تاریخ صدور:</span>
                                            <span className="text-slate-900 font-black font-mono text-xs sm:text-[13px]">
                                                {toPersianDigits(receiptDate)}
                                            </span>
                                        </div>
                                        <div className="flex justify-end items-center gap-1.5">
                                            <span className="text-slate-700 font-sans text-[10.5px]">سال مالی:</span>
                                            <span className="text-slate-900 font-bold font-mono text-[11px]">
                                                {toPersianDigits(receipt.fiscalYear || '۱۴۰۳')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Party & Account Details Strip */}
                                <div className="mt-2 pt-1.5 border-t border-dashed border-slate-400 grid grid-cols-12 gap-1.5 text-xs sm:text-[13px]">
                                    <div className="col-span-12 sm:col-span-5 flex items-center gap-1.5">
                                        <span className="text-slate-700 text-xs shrink-0 font-bold">دریافت شد از:</span>
                                        <span className="font-black text-slate-900 truncate text-xs sm:text-sm">
                                            {receipt.personName || 'شخص نامشخص'}
                                        </span>
                                        <span className="text-slate-700 font-mono text-[11px] bg-slate-100 px-1 py-0.2 rounded border border-slate-300 shrink-0 font-bold">
                                            (کد: {toPersianDigits(receipt.personCode)})
                                        </span>
                                    </div>

                                    <div className="col-span-6 sm:col-span-3 flex items-center gap-1.5">
                                        <span className="text-slate-700 text-xs shrink-0 font-bold">صندوق مقصد:</span>
                                        <span className="font-bold text-slate-900 text-xs sm:text-[12.5px] truncate">
                                            {receipt.cashboxTitle || (receipt.cashboxCode === '11001' ? 'صندوق دفتر مرکزی' : `صندوق کد ${toPersianDigits(receipt.cashboxCode)}`)}
                                        </span>
                                    </div>

                                    <div className="col-span-6 sm:col-span-4 flex items-center gap-1.5">
                                        <span className="text-slate-700 text-xs shrink-0 font-bold">بابت / شرح:</span>
                                        <span className="text-slate-900 font-medium truncate text-xs sm:text-[12px]" title={receipt.description}>
                                            {receipt.description || 'تسویه حساب و واریز اسناد دریافتنی'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Detailed Table of Cheques */}
                            <div className="my-1.5 flex-1 flex flex-col justify-center overflow-x-auto">
                                <table className="w-full text-right border-2 border-slate-900 border-collapse bg-white">
                                    <thead>
                                        <tr className="bg-slate-100 border-b-2 border-slate-900 text-xs sm:text-[12px] font-black text-slate-900">
                                            <th className="py-1 px-1.5 border-l border-slate-900 text-center w-8">ردیف</th>
                                            <th className="py-1 px-2 border-l border-slate-900 text-right">شماره چک / صیادی</th>
                                            <th className="py-1 px-2 border-l border-slate-900 text-center w-24">تاریخ سررسید</th>
                                            <th className="py-1 px-2 border-l border-slate-900 text-left w-36">مبلغ چک (ریال)</th>
                                            <th className="py-1 px-2 border-l border-slate-900 text-center w-28">نام بانک / شعبه</th>
                                            <th className="py-1 px-2 border-l border-slate-900 text-right">صاحب حساب / در وجه</th>
                                            <th className="py-1 px-2 text-right">شرح / پشت‌نمره</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receipt.cheques.map((ch, idx) => (
                                            <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50 transition-colors text-xs sm:text-[13px]">
                                                <td className="py-1 px-1.5 border-l border-slate-300 font-mono font-black text-slate-900 text-center">
                                                    {toPersianDigits(ch.rowSeq || (idx + 1))}
                                                </td>
                                                <td className="py-1 px-2 border-l border-slate-300 font-mono font-black text-slate-900 text-right dir-ltr tracking-wider text-xs sm:text-[13px]">
                                                    {toPersianDigits(ch.chequeNumber)}
                                                </td>
                                                <td className="py-1 px-2 border-l border-slate-300 font-mono font-bold text-slate-900 text-center text-xs sm:text-[12.5px]">
                                                    {toPersianDigits(toShamsiStr(ch.dueDate))}
                                                </td>
                                                <td className="py-1 px-2 border-l border-slate-300 font-mono font-black text-slate-900 text-left dir-ltr text-xs sm:text-[13.5px]">
                                                    {toPersianDigits(Number(ch.amount).toLocaleString('fa-IR'))}
                                                </td>
                                                <td className="py-1 px-2 border-l border-slate-300 font-bold text-slate-900 text-center text-xs sm:text-[12.5px]">
                                                    {ch.bankName}
                                                </td>
                                                <td className="py-1 px-2 border-l border-slate-300 font-bold text-slate-900 text-right truncate max-w-[150px] text-xs sm:text-[12.5px]">
                                                    {ch.inNameOf || receipt.personName || '-'}
                                                </td>
                                                <td className="py-1 px-2 text-slate-800 font-medium text-right truncate max-w-[140px] text-[11px] sm:text-xs">
                                                    {ch.description || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* 3. Summary & Financial Totals */}
                            <div className="border-2 border-slate-900 rounded-lg p-2 bg-slate-50 space-y-1 text-xs sm:text-[13px]">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-800 font-bold text-xs sm:text-[13px]">جمع کل مبالغ:</span>
                                        <span className="font-mono font-black text-sm sm:text-base text-slate-900">
                                            {toPersianDigits(totalAmount.toLocaleString('fa-IR'))} ریال
                                        </span>
                                        <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                                            ({toPersianDigits(Math.floor(totalAmount / 10).toLocaleString('fa-IR'))} تومان)
                                        </span>
                                    </div>

                                    <div className="text-xs sm:text-[13px]">
                                        <span className="text-slate-700 font-bold">مجموع تعداد: </span>
                                        <span className="font-mono font-black text-slate-900">
                                            {toPersianDigits(receipt.cheques.length)} فقره
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs sm:text-[13px] pt-1 border-t border-slate-300 flex items-start gap-1.5">
                                    <span className="font-bold text-slate-800 shrink-0">مبلغ کل به حروف:</span>
                                    <span className="font-black text-slate-900 leading-tight">
                                        {amountInWords.rialWords} ({amountInWords.tomanWords})
                                    </span>
                                </div>

                                <p className="text-[9.5px] sm:text-[10px] text-slate-600 leading-tight font-medium">
                                    * اسناد و چک‌های فوق‌الذکر جهت واریز به حساب و طی تشریفات بانکی دریافت گردید. تسویه نهایی منوط به وصول قطعی وجه در سررسیدهای مقرر در سامانه صیاد خواهد بود.
                                </p>
                            </div>

                            {/* 4. Official Compact Signature & Stamp Strips */}
                            <div className="mt-1.5 pt-1 grid grid-cols-4 gap-2 text-center text-xs">
                                {/* Box 1: Depositor / Customer */}
                                <div className="signature-box border-2 border-slate-900 rounded-lg p-1.5 flex items-center justify-between px-2 h-8 sm:h-9 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                    <span className="font-black text-slate-900 text-[11px] sm:text-xs leading-none shrink-0">
                                        امضای واگذارکننده:
                                    </span>
                                    <span className="text-[10.5px] sm:text-[11.5px] text-slate-900 font-bold truncate max-w-[100px]">
                                        {receipt.personName || 'طرف‌حساب'}
                                    </span>
                                </div>

                                {/* Box 2: Receiver / User */}
                                <div className="signature-box border-2 border-slate-900 rounded-lg p-1.5 flex items-center justify-between px-2 h-8 sm:h-9 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                    <span className="font-black text-slate-900 text-[11px] sm:text-xs leading-none shrink-0">
                                        تحویل‌گیرنده:
                                    </span>
                                    <span className="text-[10.5px] sm:text-[11.5px] text-slate-900 font-bold font-mono truncate max-w-[90px]">
                                        {receipt.createdByName || 'کاربر'}
                                    </span>
                                </div>

                                {/* Box 3: Accounting / Treasury */}
                                <div className="signature-box border-2 border-slate-900 rounded-lg p-1.5 flex items-center justify-between px-2 h-8 sm:h-9 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                    <span className="font-black text-slate-900 text-[11px] sm:text-xs leading-none shrink-0">
                                        امور مالی و خزانه:
                                    </span>
                                    <span className="text-[10.5px] sm:text-[11px] text-slate-800 font-bold">
                                        تایید شد
                                    </span>
                                </div>

                                {/* Box 4: Management / CEO */}
                                <div className="signature-box border-2 border-slate-900 rounded-lg p-1.5 flex items-center justify-between px-2 h-8 sm:h-9 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                    <span className="font-black text-slate-900 text-[11px] sm:text-xs leading-none shrink-0">
                                        مدیرعامل / مالی:
                                    </span>
                                    <span className="text-[10.5px] sm:text-[11px] text-slate-800 font-bold">
                                        مهر و امضا
                                    </span>
                                </div>
                            </div>

                            {/* Footer Bar Code / System Meta */}
                            <div className="mt-0.5 pt-0.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-mono">
                                <span>سامانه هوشمند خزانه‌داری و چک لپان بافت</span>
                                <span>شناسه رهگیری سند: {receipt.id || receipt.receiptNo}</span>
                                <span>زمان چاپ: {toPersianDigits(new Date().toLocaleTimeString('fa-IR'))}</span>
                            </div>
                        </div>
                    </div>

                    {/* PAGES 2+: Attached Cheque Images / Files (Printable sheets) */}
                    {hasAttachments && attachments.map((att, idx) => {
                        const isImg = att.fileType?.startsWith('image/') || att.fileData?.startsWith('data:image');
                        const src = att.fileData || att.url || (att.fileName ? `/uploads/${att.fileName}` : '');

                        return (
                            <div key={att.id || idx} className="flex justify-center items-center">
                                <div className="a5-attachment-print-page a5-screen-paper w-full max-w-[880px] aspect-[210/148] min-h-[560px] bg-white text-slate-900 rounded-xl shadow-2xl p-4 sm:p-5 border-2 border-slate-400 flex flex-col justify-between select-text">
                                    {/* Attachment Sheet Header */}
                                    <div className="border-b-2 border-slate-900 pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-right">
                                                <h3 className="text-base font-black text-slate-900">
                                                    شرکت لپان بافت
                                                </h3>
                                                <p className="text-xs text-slate-700 font-bold mt-0.5">
                                                    پیوست رسمی سند دریافت چک • برگه {toPersianDigits(idx + 1)} از {toPersianDigits(attachments.length)}
                                                </p>
                                            </div>

                                            <div className="text-center">
                                                <span className="px-3 py-1 rounded-lg border border-slate-900 font-black text-xs bg-slate-100">
                                                    تصویر و مدارک پیوست چک
                                                </span>
                                            </div>

                                            <div className="text-left font-mono text-xs space-y-0.5">
                                                <div>
                                                    <span className="font-sans text-slate-700">پیوست رسید: </span>
                                                    <span className="font-black text-slate-900">#{toPersianDigits(receipt.receiptNo || receipt.id)}</span>
                                                </div>
                                                <div>
                                                    <span className="font-sans text-slate-700">پشت‌نمره: </span>
                                                    <span className="font-bold text-slate-900">{toPersianDigits(receipt.poshtNomreh || '-')}</span>
                                                </div>
                                                <div>
                                                    <span className="font-sans text-slate-700">تاریخ: </span>
                                                    <span className="font-bold text-slate-900">{toPersianDigits(receiptDate)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-2 pt-1.5 border-t border-dashed border-slate-300 flex items-center justify-between text-xs text-slate-800">
                                            <div>
                                                <span className="font-bold text-slate-700">طرف‌حساب: </span>
                                                <span className="font-black text-slate-900">{receipt.personName} (کد {toPersianDigits(receipt.personCode)})</span>
                                            </div>
                                            <div className="truncate max-w-[300px]">
                                                <span className="font-bold text-slate-700">نام فایل: </span>
                                                <span className="font-mono font-bold text-slate-900">{att.fileName}</span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-700">مجموع رسید: </span>
                                                <span className="font-mono font-black text-emerald-700">{toPersianDigits(totalAmount.toLocaleString('fa-IR'))} ریال</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attachment Sheet Image Body */}
                                    <div className="flex-1 my-2 flex items-center justify-center overflow-hidden bg-slate-50 border border-slate-300 rounded-lg p-2 min-h-[300px]">
                                        {isImg && src ? (
                                            <img
                                                src={src}
                                                alt={att.fileName}
                                                referrerPolicy="no-referrer"
                                                className="max-h-[320px] sm:max-h-[380px] max-w-full object-contain mx-auto rounded shadow-xs"
                                                onClick={() => setPreviewImage(src)}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-6 text-slate-600 space-y-2">
                                                <FileText className="w-16 h-16 text-indigo-500" />
                                                <p className="font-bold text-sm text-slate-800">{att.fileName}</p>
                                                <p className="text-xs text-slate-500 font-mono">
                                                    فرمت فایل: {att.fileType || 'سند ضمیمه'} • حجم: {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : '-'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Attachment Sheet Footer */}
                                    <div className="border-t border-slate-300 pt-1.5 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-600 font-mono">
                                        <span>سامانه هوشمند خزانه‌داری و چک لپان بافت</span>
                                        <span>ضمیمه معتبر سند حسابداری و بایگانی</span>
                                        <span>تاریخ و ساعت چاپ: {toPersianDigits(receiptDate)} - {toPersianDigits(new Date().toLocaleTimeString('fa-IR'))}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Dismiss / Next Action */}
                <div className="no-print p-3 bg-slate-800/90 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
                    <span className="flex items-center gap-1 text-[11px]">
                        <span>شرکت </span>
                        <strong className="text-white font-bold">لپان بافت</strong>
                        <span> • سایز کاغذ پرینتر روی </span>
                        <strong className="text-white font-bold">A5</strong>
                        <span> و جهت </span>
                        <strong className="text-white font-bold">افقی (Landscape)</strong>
                        <span> تنظیم گردیده است.</span>
                    </span>

                    <div className="flex items-center gap-2">
                        {hasAttachments && (
                            <button
                                type="button"
                                onClick={() => handlePrint('all')}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>چاپ همه ({toPersianDigits(1 + attachments.length)} برگه)</span>
                            </button>
                        )}
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

            {/* Optional Fullscreen Zoom Preview */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img 
                            src={previewImage} 
                            alt="Preview" 
                            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
                        />
                        <button
                            type="button"
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-3 left-3 p-2 bg-slate-900/80 text-white rounded-full hover:bg-slate-800"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
