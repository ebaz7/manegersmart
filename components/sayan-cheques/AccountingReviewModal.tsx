import React, { useState, useEffect } from 'react';
import { 
    Edit3, 
    X, 
    CreditCard, 
    Plus, 
    Trash2, 
    Check, 
    Sparkles, 
    Building2, 
    Hash, 
    FileText, 
    Save, 
    Calendar,
    DollarSign,
    UserCheck,
    Send
} from 'lucide-react';
import { ChequeItemInput, COMMON_IRANIAN_BANKS } from './ChequeItemRow';
import { MobileAttachmentUploader, ReceiptAttachment } from './MobileAttachmentUploader';
import * as jalaali from 'jalaali-js';

interface SayanPerson {
    personCode: string;
    fullName: string;
    nationalId?: string;
    mobile?: string;
}

interface Props {
    receipt: any;
    fiscalYear: string;
    onClose: () => void;
    onSaveReview: (receiptId: string, updatedData: any, isApproveForCEO: boolean) => Promise<void>;
    actionLoading: string | null;
}

const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

export const AccountingReviewModal: React.FC<Props> = ({
    receipt,
    fiscalYear,
    onClose,
    onSaveReview,
    actionLoading
}) => {
    const [editPersonQuery, setEditPersonQuery] = useState(receipt.personName || '');
    const [editPerson, setEditPerson] = useState<SayanPerson | null>({
        personCode: String(receipt.personCode || ''),
        fullName: receipt.personName || ''
    });
    const [editPersonResults, setEditPersonResults] = useState<SayanPerson[]>([]);
    const [editPoshtNomreh, setEditPoshtNomreh] = useState(String(receipt.poshtNomreh || ''));
    const [editDescription, setEditDescription] = useState(receipt.description || '');
    const [accountingNote, setAccountingNote] = useState(receipt.accountingReview?.note || '');
    const [editCashboxCode, setEditCashboxCode] = useState(receipt.cashboxCode || '11001');
    const [cashboxes, setCashboxes] = useState<Array<{ code: string; title: string }>>([
        { code: '11001', title: 'صندوق دفتر' },
        { code: '11002', title: 'صندوق سکه و کارت هدیه' },
        { code: '11003', title: 'صندوق آقای مقدم' },
        { code: '11004', title: 'صندوق ارزی' },
        { code: '11005', title: 'صندوق چک های برگشتی' }
    ]);

    // Attachments state (images, mobile camera shots & PDF documents)
    const [editAttachments, setEditAttachments] = useState<ReceiptAttachment[]>(() => {
        if (Array.isArray(receipt.attachments)) {
            return receipt.attachments;
        }
        return [];
    });

    useEffect(() => {
        const fetchBox = async () => {
            try {
                const res = await fetch('/api/sayan/cheque-receipts/cashboxes');
                const data = await res.json();
                if (data.success && Array.isArray(data.cashboxes) && data.cashboxes.length > 0) {
                    setCashboxes(data.cashboxes);
                }
            } catch (err) {
                // silent
            }
        };
        fetchBox();
    }, []);

    const [editCheques, setEditCheques] = useState<ChequeItemInput[]>(() => {
        if (receipt.cheques && receipt.cheques.length > 0) {
            return receipt.cheques.map((c: any, idx: number) => ({
                id: c.chequeId || c.rowId || String(idx + 1),
                chequeNumber: c.chequeNumber || '',
                amount: c.amount || '',
                dueDate: c.dueDate ? c.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
                bankName: c.bankName || 'سامان',
                inNameOf: c.inNameOf || receipt.personName || '',
                accountNo: c.accountNo || '',
                description: c.description || ''
            }));
        }
        return [
            {
                id: '1',
                chequeNumber: '',
                amount: receipt.totalAmount || '',
                dueDate: new Date().toISOString().slice(0, 10),
                bankName: 'سامان',
                inNameOf: receipt.personName || '',
                accountNo: '',
                description: ''
            }
        ];
    });

    // Search persons for accounting editing
    useEffect(() => {
        if (!editPersonQuery || editPersonQuery.trim().length === 0) {
            setEditPersonResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/sayan/cheque-receipts/persons?query=${encodeURIComponent(editPersonQuery.trim())}&fiscalYear=${fiscalYear}`);
                const data = await res.json();
                if (data.success && Array.isArray(data.persons)) {
                    setEditPersonResults(data.persons);
                }
            } catch (err) {
                // silent
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [editPersonQuery, fiscalYear]);

    const editTotalAmount = editCheques.reduce((sum, ch) => sum + (Number(ch.amount) || 0), 0);

    const handleSave = (isApproveForCEO: boolean) => {
        const finalPersonCode = editPerson ? editPerson.personCode : receipt.personCode;
        const finalPersonName = editPerson ? editPerson.fullName : receipt.personName;

        if (!finalPersonCode) {
            alert('انتخاب طرف حساب معتبر از سیستم سایان الزامی است.');
            return;
        }

        const payload = {
            personCode: finalPersonCode,
            personName: finalPersonName,
            poshtNomreh: editPoshtNomreh,
            cashboxCode: editCashboxCode,
            description: editDescription,
            totalAmount: editTotalAmount,
            cheques: editCheques.map((ch, idx) => ({
                chequeNumber: ch.chequeNumber,
                amount: Number(ch.amount) || 0,
                dueDate: ch.dueDate,
                bankName: ch.bankName,
                inNameOf: ch.inNameOf || finalPersonName,
                poshtNomreh: editPoshtNomreh,
                rowSeq: idx + 1,
                description: ch.description
            })),
            attachments: editAttachments,
            accountingNote
        };
        onSaveReview(receipt.id, payload, isApproveForCEO);
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/60">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <Edit3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>ویرایش اطلاعات و پیوست‌های رسید چک</span>
                                <span className="font-mono text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
                                    #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                </span>
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                ویرایش در همین مرحله ذخیره می‌شود و وضعیت رسید بدون تایید ناخواسته حفظ خواهد شد.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* General Receipt Metadata Panel */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700/60">
                            <Building2 className="w-5 h-5 text-amber-500" />
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                مشخصات طرف حساب، صندوق و سربرگ رسید
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Person Selection */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    طرف حساب سایان (پرداخت کننده) *
                                </label>
                                <input
                                    type="text"
                                    value={editPersonQuery}
                                    onChange={(e) => {
                                        setEditPersonQuery(e.target.value);
                                        if (editPerson && editPerson.fullName !== e.target.value) {
                                            setEditPerson(null);
                                        }
                                    }}
                                    placeholder="جستجوی کد یا نام طرف حساب در سایان..."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-amber-500 transition-colors"
                                />
                                {editPerson && (
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
                                        <span>طرف حساب انتخاب شد: {editPerson.fullName}</span>
                                        <span className="font-mono">کد: {toPersianDigits(editPerson.personCode)}</span>
                                    </div>
                                )}

                                {editPersonResults.length > 0 && !editPerson && (
                                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                                        {editPersonResults.map(p => (
                                            <div
                                                key={p.personCode}
                                                onClick={() => {
                                                    setEditPerson(p);
                                                    setEditPersonQuery(p.fullName);
                                                    setEditPersonResults([]);
                                                }}
                                                className="p-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between text-xs"
                                            >
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.fullName}</span>
                                                <span className="font-mono text-slate-400 text-[11px]">کد: {toPersianDigits(p.personCode)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Posht Nomreh */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    پشت‌نمره رسید در سایان *
                                </label>
                                <input
                                    type="text"
                                    value={editPoshtNomreh}
                                    onChange={(e) => setEditPoshtNomreh(e.target.value)}
                                    placeholder="مثال: ۱۰۲۴"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-amber-500"
                                />
                            </div>

                            {/* Cashbox Selection */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    صندوق دریافت کننده *
                                </label>
                                <select
                                    value={editCashboxCode}
                                    onChange={(e) => setEditCashboxCode(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-amber-500"
                                >
                                    {cashboxes.map(cb => (
                                        <option key={cb.code} value={cb.code}>
                                            {cb.title} (کد: {cb.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                شرح و بابت رسید
                            </label>
                            <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="شرح بابت سند رسید چک در سایان..."
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Cheque Rows Panel */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-indigo-500" />
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    اقلام و برگ‌های چک در این رسید ({toPersianDigits(editCheques.length)} برگ)
                                </h4>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setEditCheques(prev => [
                                        ...prev,
                                        {
                                            id: String(Date.now()),
                                            chequeNumber: '',
                                            amount: '',
                                            dueDate: new Date().toISOString().slice(0, 10),
                                            bankName: 'سامان',
                                            inNameOf: editPerson ? editPerson.fullName : receipt.personName || '',
                                            accountNo: '',
                                            description: ''
                                        }
                                    ]);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>افزودن برگ چک جدید</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {editCheques.map((ch, idx) => {
                                let shamsiDate = '';
                                try {
                                    if (ch.dueDate) {
                                        const d = new Date(ch.dueDate);
                                        const j = jalaali.toJalaali(d);
                                        shamsiDate = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
                                    }
                                } catch (e) {
                                    shamsiDate = '';
                                }

                                return (
                                    <div 
                                        key={ch.id || idx}
                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3"
                                    >
                                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-[11px] text-slate-600 dark:text-slate-300">
                                                    {idx + 1}
                                                </span>
                                                <span>برگ چک شماره {toPersianDigits(idx + 1)}</span>
                                            </span>

                                            {editCheques.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditCheques(prev => prev.filter((_, i) => i !== idx))}
                                                    className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>حذف این برگ</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    شماره صیاد / سریال چک *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={ch.chequeNumber}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditCheques(prev => prev.map((item, i) => i === idx ? { ...item, chequeNumber: val } : item));
                                                    }}
                                                    placeholder="۱۶ رقم صیادی یا سریال"
                                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono font-bold outline-none focus:border-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    مبلغ چک (ریال) *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={ch.amount ? Number(ch.amount).toLocaleString('en-US') : ''}
                                                    onChange={(e) => {
                                                        const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                                        setEditCheques(prev => prev.map((item, i) => i === idx ? { ...item, amount: clean === '' ? '' : Number(clean) } : item));
                                                    }}
                                                    placeholder="مبلغ به ریال"
                                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:border-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    تاریخ سررسید (شمسی)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={shamsiDate}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        try {
                                                            const parts = val.split('/').map(Number);
                                                            if (parts.length === 3 && parts[0] > 1300 && parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31) {
                                                                const g = jalaali.toGregorian(parts[0], parts[1], parts[2]);
                                                                const iso = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
                                                                setEditCheques(prev => prev.map((item, i) => i === idx ? { ...item, dueDate: iso } : item));
                                                            }
                                                        } catch (err) {
                                                            // silent
                                                        }
                                                    }}
                                                    placeholder="۱۴۰۳/۰۶/۱۵"
                                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono font-bold outline-none focus:border-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                    بانک صادرکننده
                                                </label>
                                                <select
                                                    value={ch.bankName || 'سامان'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditCheques(prev => prev.map((item, i) => i === idx ? { ...item, bankName: val } : item));
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                                                >
                                                    {COMMON_IRANIAN_BANKS.map(b => (
                                                        <option key={b} value={b}>{b}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Total Amount Summary */}
                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                جمع کل مبلغ چک‌های این رسید:
                            </span>
                            <span className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                                {toPersianDigits(editTotalAmount.toLocaleString('fa-IR'))} <span className="text-xs font-normal">ریال</span>
                            </span>
                        </div>
                    </div>

                    {/* Mobile-Optimized File & Photo Attachments Component */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <MobileAttachmentUploader
                            attachments={editAttachments}
                            onChange={setEditAttachments}
                            label="تصاویر و اسناد پیوست چک (بهینه شده برای گوشی و کامپیوتر)"
                            helperText="می‌توانید مستقیماً با دوربین موبایل از چک عکس بگیرید یا فایل‌های PDF و تصاویر را انتخاب نمایید."
                        />
                    </div>

                    {/* Accounting Review Note */}
                    <div className="space-y-1.5">
                        <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                            یادداشت و توضیحات کارشناس
                        </label>
                        <input
                            type="text"
                            value={accountingNote}
                            onChange={(e) => setAccountingNote(e.target.value)}
                            placeholder="توضیحات و یادداشت‌های مربوط به این ویرایش..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                        انصراف
                    </button>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Primary Action: Pure Save Edits within Current Stage */}
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={actionLoading === 'accounting_review'}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 cursor-pointer"
                        >
                            <Save className="w-4 h-4" />
                            <span>ذخیره تغییرات رسید (در همین مرحله)</span>
                        </button>

                        {/* Optional Approval Action (Only when receipt is in PENDING_ACCOUNTING) */}
                        {receipt.status === 'PENDING_ACCOUNTING' && (
                            <button
                                type="button"
                                onClick={() => handleSave(true)}
                                disabled={actionLoading === 'accounting_review'}
                                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                            >
                                <Send className="w-4 h-4" />
                                <span>تایید و ارسال به مدیرعامل (مرحله ۲)</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
