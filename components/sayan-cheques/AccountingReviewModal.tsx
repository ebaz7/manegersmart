import React, { useState, useEffect, useRef } from 'react';
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
    Paperclip, 
    UploadCloud, 
    Eye, 
    Image as ImageIcon, 
    File as FileIcon, 
    Calendar,
    DollarSign,
    UserCheck
} from 'lucide-react';
import { ChequeItemInput, COMMON_IRANIAN_BANKS } from './ChequeItemRow';
import { FileViewerModal } from '../FileViewerModal';
import * as jalaali from 'jalaali-js';

interface SayanPerson {
    personCode: string;
    fullName: string;
    nationalId?: string;
    mobile?: string;
}

interface AttachmentItem {
    id?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData: string;
    url?: string;
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

    // Attachments state
    const [editAttachments, setEditAttachments] = useState<AttachmentItem[]>(() => {
        if (Array.isArray(receipt.attachments)) {
            return receipt.attachments;
        }
        return [];
    });
    const [isDragging, setIsDragging] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileUpload = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (file.size > 25 * 1024 * 1024) {
                alert(`فایل ${file.name} بیشتر از ۲۵ مگابایت است.`);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const base64Data = reader.result as string;
                setEditAttachments(prev => [
                    ...prev,
                    {
                        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        fileName: file.name,
                        fileType: file.type || 'application/octet-stream',
                        fileSize: file.size,
                        fileData: base64Data
                    }
                ]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleDeleteAttachment = (indexToRemove: number) => {
        setEditAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

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
                                <span>ویرایش و بررسی کارشناسی حسابداری رسید چک</span>
                                <span className="font-mono text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
                                    #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                </span>
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                مشخصات چک‌ها، مبالغ، طرف‌حساب و همچنین مدارک و تصاویر پیوست چک را ویرایش یا تکمیل نمایید.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {/* General Receipt Metadata Panel */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                            <Building2 className="w-4 h-4 text-amber-500" />
                            <span>اطلاعات پایه و طرف‌حساب رسید</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                            {/* Person Query & Selector */}
                            <div className="md:col-span-5 relative">
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                    طرف‌حساب (انتخاب از سایان) *
                                </label>
                                <input
                                    type="text"
                                    value={editPersonQuery}
                                    onChange={(e) => {
                                        setEditPersonQuery(e.target.value);
                                        if (editPerson && e.target.value !== editPerson.fullName) {
                                            setEditPerson(null);
                                        }
                                    }}
                                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors ${
                                        editPerson || receipt.personCode
                                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 font-black text-slate-900 dark:text-white'
                                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-amber-500'
                                    }`}
                                    placeholder="جستجوی نام یا کد شخص در سایان..."
                                />
                                {editPerson ? (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-bold flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            <span>طرف حساب معتبر سایان</span>
                                        </span>
                                        <span className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-xs font-bold">
                                            کد: {toPersianDigits(editPerson.personCode)}
                                        </span>
                                    </div>
                                ) : receipt.personCode ? (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-mono font-bold">
                                        کد فعلی: {toPersianDigits(receipt.personCode)}
                                    </div>
                                ) : (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-bold">
                                        * انتخاب طرف حساب از سایان الزامی است
                                    </div>
                                )}
                                {editPersonResults.length > 0 && !editPerson && (
                                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border-2 border-amber-400 dark:border-amber-500 rounded-2xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                        {editPersonResults.map(p => (
                                            <button
                                                key={p.personCode}
                                                type="button"
                                                onClick={() => {
                                                    setEditPerson(p);
                                                    setEditPersonQuery(p.fullName);
                                                    setEditPersonResults([]);
                                                }}
                                                className="w-full text-right px-4 py-2.5 text-xs sm:text-sm hover:bg-amber-50 dark:hover:bg-slate-700 flex justify-between items-center transition-colors"
                                            >
                                                <div>
                                                    <div className="font-black text-slate-900 dark:text-white">{p.fullName}</div>
                                                    {p.nationalId && <div className="text-xs text-slate-400">کدملی: {p.nationalId}</div>}
                                                </div>
                                                <span className="text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-lg text-xs font-mono font-black border border-blue-300">
                                                    کد: {toPersianDigits(p.personCode)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Cashbox Selector */}
                            <div className="md:col-span-3">
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                    صندوق خزانه‌داری *
                                </label>
                                <select
                                    value={editCashboxCode}
                                    onChange={(e) => setEditCashboxCode(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold outline-none focus:border-amber-500 cursor-pointer text-right text-slate-900 dark:text-white"
                                >
                                    {cashboxes.map(box => (
                                        <option key={box.code} value={box.code}>
                                            {box.title} ({toPersianDigits(box.code)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* PoshtNomreh */}
                            <div className="md:col-span-2">
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                    پشت‌نمره *
                                </label>
                                <input
                                    type="text"
                                    value={editPoshtNomreh}
                                    onChange={(e) => setEditPoshtNomreh(e.target.value)}
                                    placeholder="۷۶۶"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 dark:text-white outline-none focus:border-amber-500"
                                />
                            </div>

                            {/* Receipt Description */}
                            <div className="md:col-span-2">
                                <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                                    شرح سند
                                </label>
                                <input
                                    type="text"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-amber-500"
                                    placeholder="بابت تسویه فاکتور..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cheques Rows Panel */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-500" />
                                <span>ردیف‌های چک ({toPersianDigits(editCheques.length)} فقره)</span>
                            </h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditCheques(prev => [
                                        ...prev,
                                        {
                                            id: String(Date.now()),
                                            chequeNumber: '',
                                            amount: '',
                                            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                                            bankName: 'سامان',
                                            inNameOf: editPerson ? editPerson.fullName : '',
                                            accountNo: '',
                                            description: ''
                                        }
                                    ]);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-sm flex items-center gap-1.5 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>افزودن برگه چک جدید</span>
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {editCheques.map((ch, idx) => (
                                <div key={ch.id || idx} className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs sm:text-sm">
                                    <div className="sm:col-span-1 flex items-center justify-center font-mono font-black text-sm text-slate-600 bg-slate-200/80 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                        #{toPersianDigits(idx + 1)}
                                    </div>

                                    <div className="sm:col-span-3">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">شماره صیادی / چک *</span>
                                        <input
                                            type="text"
                                            value={ch.chequeNumber}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].chequeNumber = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            placeholder="۱۶ رقم شناسه صیاد"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-black text-blue-600 dark:text-blue-400 text-sm dir-ltr text-right"
                                        />
                                    </div>

                                    <div className="sm:col-span-3">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">مبلغ (ریال) *</span>
                                        <input
                                            type="text"
                                            value={ch.amount ? Number(ch.amount).toLocaleString('en-US') : ''}
                                            onChange={(e) => {
                                                const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                                const next = [...editCheques];
                                                next[idx].amount = clean ? Number(clean) : '';
                                                setEditCheques(next);
                                            }}
                                            placeholder="مبلغ به ریال"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm dir-ltr text-left"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">سررسید *</span>
                                        <input
                                            type="date"
                                            value={ch.dueDate}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].dueDate = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1 font-bold">نام بانک *</span>
                                        <input
                                            type="text"
                                            value={ch.bankName}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].bankName = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white text-xs sm:text-sm"
                                        />
                                    </div>

                                    <div className="sm:col-span-1 flex items-center justify-end">
                                        {editCheques.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setEditCheques(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-xl transition-colors"
                                                title="حذف این چک"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total Summary */}
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                            <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                                مجموع کل مبالغ چک‌های رسید:
                            </span>
                            <div className="flex items-baseline gap-2.5">
                                <span className="font-mono font-black text-xl text-emerald-700 dark:text-emerald-300">
                                    {toPersianDigits(editTotalAmount.toLocaleString('fa-IR'))} ریال
                                </span>
                                <span className="text-xs font-mono font-black text-emerald-700 bg-white/90 dark:bg-slate-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700">
                                    ({toPersianDigits(Math.floor(editTotalAmount / 10).toLocaleString('fa-IR'))} تومان)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* File Attachments Section (NEW: موقع ویرایش بشه فایل اتچ کرد) */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                            <div className="flex items-center gap-2">
                                <Paperclip className="w-5 h-5 text-indigo-500" />
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    فایل‌ها و تصاویر پیوست چک ({toPersianDigits(editAttachments.length)} مورد)
                                </h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                            >
                                <UploadCloud className="w-4 h-4" />
                                <span>افزودن فایل پیوست</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,application/pdf"
                                onChange={(e) => handleFileUpload(e.target.files)}
                                className="hidden"
                            />
                        </div>

                        {/* Drag and Drop Zone */}
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                handleFileUpload(e.dataTransfer.files);
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
                                isDragging 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' 
                                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-white dark:bg-slate-900/50'
                            }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <UploadCloud className="w-6 h-6" />
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                    برای آپلود فایل یا تصویر چک، آن را اینجا رها کنید یا کلیک نمایید
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    فرمت‌های مجاز: انواع تصویر (JPG, PNG, WEBP) و اسناد PDF (حداکثر ۲۵ مگابایت)
                                </p>
                            </div>
                        </div>

                        {/* Attachments List */}
                        {editAttachments.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                {editAttachments.map((att, idx) => {
                                    const isImg = att.fileType?.startsWith('image/') || att.fileData?.startsWith('data:image');
                                    const src = att.fileData || att.url || (att.fileName ? `/uploads/${att.fileName}` : '');

                                    return (
                                        <div
                                            key={att.id || idx}
                                            className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2.5 flex items-center gap-3 shadow-xs hover:shadow-md transition-all"
                                        >
                                            <div 
                                                onClick={() => setPreviewAttachment({ ...att, resolvedSrc: src })}
                                                className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer border border-slate-200 dark:border-slate-700"
                                            >
                                                {isImg && src ? (
                                                    <img
                                                        src={src}
                                                        alt={att.fileName}
                                                        referrerPolicy="no-referrer"
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                                    />
                                                ) : (
                                                    <FileText className="w-6 h-6 text-indigo-500" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div 
                                                    onClick={() => setPreviewAttachment({ ...att, resolvedSrc: src })}
                                                    className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                                                    title={att.fileName}
                                                >
                                                    {att.fileName}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                    {att.fileSize ? `${Math.round(att.fileSize / 1024)} KB` : 'پیوست سند'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewAttachment({ ...att, resolvedSrc: src })}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                                                    title="مشاهده پیش‌نمایش"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAttachment(idx)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                                    title="حذف پیوست"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Accounting Review Note */}
                    <div className="space-y-1.5">
                        <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                            یادداشت و تاییدیه کارشناس حسابداری
                        </label>
                        <input
                            type="text"
                            value={accountingNote}
                            onChange={(e) => setAccountingNote(e.target.value)}
                            placeholder="مثال: اصالت چک‌ها، مبالغ و طرف حساب با فاکتورهای فروش بررسی و تایید گردید."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors"
                    >
                        انصراف
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={actionLoading === 'accounting_review'}
                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-300 dark:border-slate-600 transition-colors"
                        >
                            ذخیره تغییرات و فایل‌ها (پیش‌نویس)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={actionLoading === 'accounting_review'}
                            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all active:scale-95"
                        >
                            <Check className="w-4 h-4" />
                            <span>تایید حسابداری و ارسال به مدیرعامل (مرحله ۲)</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Standard File Viewer Modal for Attached Documents / Cheque Images */}
            <FileViewerModal
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                fileUrl={previewAttachment?.resolvedSrc || previewAttachment?.fileData || previewAttachment?.url || (previewAttachment?.fileName ? `/uploads/${previewAttachment.fileName}` : '')}
                fileName={previewAttachment?.fileName || 'پیش‌نمایش تصویر چک'}
            />
        </div>
    );
};
