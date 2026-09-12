import React, { useRef, useState } from 'react';
import { Printer, X, Download, FileText, CheckCircle2, Copy, Check, Building2, User, Calendar, CreditCard, MessageSquare, Send } from 'lucide-react';
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

    const handleShareToChat = async () => {
        if (!receipt) return;
        setSharingToChat(true);
        try {
            const el = document.getElementById('a5-cheque-receipt-print-area');
            const summaryText = `📄 رسید دریافت چک #${receipt.receiptNo || receipt.id}\n👤 طرف حساب: ${receipt.personName} (کد ${receipt.personCode})\n🏷️ شماره پشت‌نمره: ${receipt.poshtNomreh || '-'}\n💳 تعداد چک: ${receipt.cheques.length} فقره\n💰 جمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال\n📝 بابت: ${receipt.description || '-'}`;
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
                defaultMessage: `📄 رسید دریافت چک #${receipt.receiptNo || receipt.id}\n👤 طرف حساب: ${receipt.personName}\n💰 جمع کل: ${Number(receipt.totalAmount).toLocaleString('fa-IR')} ریال`,
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fade-in">
            {/* Print & Screen CSS specific to A5 Landscape - Strictly Theme-Agnostic */}
            <style>{`
                @page {
                    size: A5 landscape;
                    margin: 3mm 4mm;
                }
                
                /* Guarantee that the print area looks identical on screen in all themes (light/dark/etc.) */
                #a5-cheque-receipt-print-area {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    border: 2px solid #000000 !important;
                    border-radius: 12px !important;
                    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
                }
                #a5-cheque-receipt-print-area * {
                    color: #000000 !important;
                    border-color: #000000 !important;
                    text-shadow: none !important;
                    box-shadow: none !important;
                }
                #a5-cheque-receipt-print-area input {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                    border-color: #000000 !important;
                }
                #a5-cheque-receipt-print-area table {
                    border: 1.5px solid #000000 !important;
                    border-collapse: collapse !important;
                    background-color: #ffffff !important;
                }
                #a5-cheque-receipt-print-area th {
                    background-color: #f1f5f9 !important; /* slate-100 */
                    background: #f1f5f9 !important;
                    color: #000000 !important;
                    font-weight: 900 !important;
                    border: 1px solid #000000 !important;
                }
                #a5-cheque-receipt-print-area td {
                    background-color: #ffffff !important;
                    color: #000000 !important;
                    border: 1px solid #000000 !important;
                }
                #a5-cheque-receipt-print-area .signature-box {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    border: 1px solid #000000 !important;
                    color: #000000 !important;
                }
                #a5-cheque-receipt-print-area .bg-slate-50 {
                    background-color: #f8fafc !important; /* slate-50 */
                    background: #f8fafc !important;
                    border: 1px solid #000000 !important;
                }
                #a5-cheque-receipt-print-area .border-slate-900,
                #a5-cheque-receipt-print-area .border-b-2 {
                    border-color: #000000 !important;
                }
                #a5-cheque-receipt-print-area .text-slate-600,
                #a5-cheque-receipt-print-area .text-slate-500,
                #a5-cheque-receipt-print-area .text-slate-700 {
                    color: #1e293b !important; /* slate-800 - dark enough for high contrast */
                }

                @media print {
                    @page {
                        size: A5 landscape;
                        margin: 3mm 4mm;
                    }
                    html, body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Tahoma, sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
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
                        position: relative !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        max-height: 140mm !important;
                        margin: 0 !important;
                        padding: 2mm 3mm !important;
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        box-shadow: none !important;
                        border: 1px solid #000000 !important;
                        border-radius: 4px !important;
                        box-sizing: border-box !important;
                        z-index: 999999 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        page-break-before: avoid !important;
                        break-before: avoid !important;
                        overflow: hidden !important;
                    }
                    #a5-cheque-receipt-print-area table {
                        border: 1px solid #000000 !important;
                        border-collapse: collapse !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    #a5-cheque-receipt-print-area tr {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    #a5-cheque-receipt-print-area th,
                    #a5-cheque-receipt-print-area td {
                        padding: 1px 3px !important;
                        line-height: 1.2 !important;
                        font-size: 8.5px !important;
                        border: 1px solid #000000 !important;
                    }
                    .signature-box {
                        height: 24px !important;
                        min-height: 24px !important;
                        max-height: 26px !important;
                        padding: 1px 3px !important;
                        font-size: 7.5px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        border: 1px solid #000000 !important;
                        background-color: #ffffff !important;
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
                            onClick={handleShareToChat}
                            disabled={sharingToChat}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                            title="ارسال رسید به گفتگوی درون‌برنامه‌ای"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span>{sharingToChat ? 'در حال ارسال...' : 'ارسال به گفتگو'}</span>
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
                    {/* A5 Landscape Printable Sheet: 210mm x 148mm */}
                    <div
                        id="a5-cheque-receipt-print-area"
                        className="w-full max-w-[920px] bg-white text-slate-900 rounded-xl shadow-2xl p-2.5 sm:p-3.5 border-2 border-slate-300 flex flex-col justify-start select-text gap-1"
                    >
                        {/* 1. Header Section */}
                        <div className="border-b-2 border-slate-900 pb-1">
                            <div className="flex items-center justify-between">
                                {/* Company Logo & Identity */}
                                <div className="text-right w-1/3">
                                    <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                                        شرکت لیان بافت
                                    </h2>
                                    <p className="text-[8.5px] text-slate-600 font-bold">
                                        سیستم مدیریت مالی و خزانه‌داری
                                    </p>
                                    <p className="text-[8px] text-slate-500">
                                        واحد اعتبارات و دریافت اسناد تجاری
                                    </p>
                                </div>

                                {/* Main Title Badge */}
                                <div className="text-center w-1/3 flex flex-col items-center">
                                    <div className="px-2.5 py-0.5 rounded-lg border-2 border-slate-900 bg-slate-50">
                                        <h1 className="text-xs sm:text-sm font-black text-slate-900">
                                            رسید دریافت چک
                                        </h1>
                                    </div>
                                    <span className="text-[8px] text-slate-600 font-bold mt-0.5">
                                        (اسناد دریافتنی نزد صندوق خزانه‌داری)
                                    </span>
                                </div>

                                {/* Tracking & Date Metadata */}
                                <div className="text-left w-1/3 text-[9.5px] font-mono space-y-0.5">
                                    <div className="flex justify-end items-center gap-1.5 font-bold">
                                        <span className="text-slate-600 font-sans text-[9px]">شماره رسید:</span>
                                        <span className="text-slate-900 font-black text-[10.5px] font-mono">
                                            #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[9px]">شماره پشت‌نمره:</span>
                                        <span className="text-slate-900 font-bold font-mono">
                                            {toPersianDigits(receipt.poshtNomreh || '-')}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[9px]">تاریخ صدور:</span>
                                        <span className="text-slate-900 font-bold font-mono">
                                            {toPersianDigits(receiptDate)}
                                        </span>
                                    </div>
                                    <div className="flex justify-end items-center gap-1.5">
                                        <span className="text-slate-600 font-sans text-[9px]">سال مالی:</span>
                                        <span className="text-slate-900 font-mono">
                                            {toPersianDigits(receipt.fiscalYear || '۱۴۰۳')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Party & Account Details Strip */}
                            <div className="mt-1 pt-1 border-t border-dashed border-slate-300 grid grid-cols-12 gap-1.5 text-[10.5px]">
                                <div className="col-span-12 sm:col-span-5 flex items-center gap-1.5">
                                    <span className="text-slate-600 text-[10px] shrink-0 font-bold">دریافت شد از:</span>
                                    <span className="font-black text-slate-900 truncate text-[10.5px]">
                                        {receipt.personName || 'شخص نامشخص'}
                                    </span>
                                    {receipt.personCode && (
                                        <span className="text-[9px] font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                            کد: {toPersianDigits(receipt.personCode)}
                                        </span>
                                    )}
                                </div>

                                <div className="col-span-12 sm:col-span-4 flex items-center gap-1.5">
                                    <span className="text-slate-600 text-[10px] shrink-0 font-bold">صندوق مقصد:</span>
                                    <span className="font-bold text-slate-800 text-[10px] truncate">
                                        {receipt.cashboxTitle || `صندوق خزانه‌داری (${receipt.cashboxCode || '11001'})`}
                                    </span>
                                </div>

                                <div className="col-span-12 sm:col-span-3 flex items-center gap-1.5 justify-end">
                                    <span className="text-slate-600 text-[10px] shrink-0 font-bold">تعداد فقره:</span>
                                    <span className="font-mono font-black text-xs text-slate-900">
                                        {toPersianDigits(receipt.cheques.length)} فقره چک
                                    </span>
                                </div>

                                {receipt.description && (
                                    <div className="col-span-12 flex items-center gap-1.5 pt-0.5">
                                        <span className="text-slate-600 text-[10px] shrink-0 font-bold">بابت / شرح:</span>
                                        <span className="text-slate-800 text-[10px] font-medium truncate">
                                            {receipt.description}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Cheques Table */}
                        <div className="my-0.5 overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-400 text-center text-[9.5px] sm:text-[10px]">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-400 text-slate-800 font-bold text-[9px] sm:text-[9.5px]">
                                        <th className="py-0.5 px-1 border-l border-slate-400 w-7">ردیف</th>
                                        <th className="py-0.5 px-1.5 border-l border-slate-400">شماره صیادی / چک</th>
                                        <th className="py-0.5 px-1.5 border-l border-slate-400 w-20">تاریخ سررسید</th>
                                        <th className="py-0.5 px-1.5 border-l border-slate-400 w-28">مبلغ چک (ریال)</th>
                                        <th className="py-0.5 px-1.5 border-l border-slate-400">بانک صادرکننده</th>
                                        <th className="py-0.5 px-1.5 border-l border-slate-400">صاحب حساب / صادرکننده</th>
                                        <th className="py-0.5 px-1.5">بابت / توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipt.cheques.map((ch, idx) => (
                                        <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50 transition-colors text-[9.5px] sm:text-[10px]">
                                            <td className="py-0.5 px-1 border-l border-slate-300 font-mono font-bold text-slate-700">
                                                {toPersianDigits(ch.rowSeq || (idx + 1))}
                                            </td>
                                            <td className="py-0.5 px-1.5 border-l border-slate-300 font-mono font-black text-slate-900 text-right dir-ltr">
                                                {toPersianDigits(ch.chequeNumber)}
                                            </td>
                                            <td className="py-0.5 px-1.5 border-l border-slate-300 font-mono font-bold text-slate-800">
                                                {toPersianDigits(toShamsiStr(ch.dueDate))}
                                            </td>
                                            <td className="py-0.5 px-1.5 border-l border-slate-300 font-mono font-black text-slate-900 text-left dir-ltr">
                                                {toPersianDigits(Number(ch.amount).toLocaleString('fa-IR'))}
                                            </td>
                                            <td className="py-0.5 px-1.5 border-l border-slate-300 font-bold text-slate-800">
                                                {ch.bankName}
                                            </td>
                                            <td className="py-0.5 px-1.5 border-l border-slate-300 font-medium text-slate-800 text-right truncate max-w-[140px]">
                                                {ch.inNameOf || receipt.personName || '-'}
                                            </td>
                                            <td className="py-0.5 px-1.5 text-slate-600 text-right truncate max-w-[140px] text-[9px]">
                                                {ch.description || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 3. Summary & Financial Totals */}
                        <div className="border border-slate-900 rounded p-1 sm:p-1.5 bg-slate-50 space-y-0.5 text-[10px]">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-slate-700 font-bold text-[10px]">جمع کل مبالغ:</span>
                                    <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                                        {toPersianDigits(totalAmount.toLocaleString('fa-IR'))} ریال
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-slate-600 bg-white px-1 py-0.5 rounded border border-slate-300">
                                        ({toPersianDigits(Math.floor(totalAmount / 10).toLocaleString('fa-IR'))} تومان)
                                    </span>
                                </div>

                                <div className="text-[10px]">
                                    <span className="text-slate-600 font-bold">مجموع تعداد: </span>
                                    <span className="font-mono font-bold text-slate-900">
                                        {toPersianDigits(receipt.cheques.length)} فقره
                                    </span>
                                </div>
                            </div>

                            <div className="text-[10px] pt-0.5 border-t border-slate-300 flex items-start gap-1">
                                <span className="font-bold text-slate-700 shrink-0">مبلغ کل به حروف:</span>
                                <span className="font-bold text-slate-900">
                                    {amountInWords.rialWords} ({amountInWords.tomanWords})
                                </span>
                            </div>

                            <p className="text-[7.5px] text-slate-500 leading-tight">
                                * اسناد و چک‌های فوق‌الذکر جهت واریز به حساب و طی تشریفات بانکی دریافت گردید. تسویه نهایی منوط به وصول قطعی وجه در سررسیدهای مقرر در سامانه صیاد خواهد بود.
                            </p>
                        </div>

                        {/* 4. Official Compact Signature & Stamp Strips (4 Symmetrical Low-Profile Pillars) */}
                        <div className="mt-0.5 pt-0.5 grid grid-cols-4 gap-1.5 text-center text-[8.5px]">
                            {/* Box 1: Depositor / Customer */}
                            <div className="signature-box border border-slate-900 rounded p-1 flex items-center justify-between px-1.5 h-7 sm:h-8 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                <span className="font-bold text-slate-900 text-[8.5px] leading-none shrink-0">
                                    امضای واگذارکننده:
                                </span>
                                <span className="text-[8px] text-slate-700 font-medium truncate max-w-[85px]">
                                    {receipt.personName || 'طرف‌حساب'}
                                </span>
                            </div>

                            {/* Box 2: Receiver / User */}
                            <div className="signature-box border border-slate-900 rounded p-1 flex items-center justify-between px-1.5 h-7 sm:h-8 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                <span className="font-bold text-slate-900 text-[8.5px] leading-none shrink-0">
                                    تحویل‌گیرنده:
                                </span>
                                <span className="text-[8px] text-slate-700 font-mono truncate max-w-[75px]">
                                    {receipt.createdByName || 'کاربر'}
                                </span>
                            </div>

                            {/* Box 3: Accounting / Treasury */}
                            <div className="signature-box border border-slate-900 rounded p-1 flex items-center justify-between px-1.5 h-7 sm:h-8 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                <span className="font-bold text-slate-900 text-[8.5px] leading-none shrink-0">
                                    امور مالی و خزانه‌داری:
                                </span>
                                <span className="text-[7.5px] text-slate-600">
                                    تایید شد
                                </span>
                            </div>

                            {/* Box 4: Management / CEO */}
                            <div className="signature-box border border-slate-900 rounded p-1 flex items-center justify-between px-1.5 h-7 sm:h-8 bg-white text-slate-900" style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#000000' }}>
                                <span className="font-bold text-slate-900 text-[8.5px] leading-none shrink-0">
                                    مدیرعامل / مالی:
                                </span>
                                <span className="text-[7.5px] text-slate-600">
                                    مهر و امضا
                                </span>
                            </div>
                        </div>

                        {/* Footer Bar Code / System Meta */}
                        <div className="mt-0.5 pt-0.5 border-t border-slate-200 flex items-center justify-between text-[7px] text-slate-400 font-mono">
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
