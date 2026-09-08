import React, { useState, useEffect } from 'react';
import { Edit3, X, CreditCard, Plus, Trash2, Check, Sparkles, Building2, Hash, FileText } from 'lucide-react';
import { ChequeItemInput, COMMON_IRANIAN_BANKS } from './ChequeItemRow';
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
        personCode: String(receipt.personCode),
        fullName: receipt.personName
    });
    const [editPersonResults, setEditPersonResults] = useState<SayanPerson[]>([]);
    const [editPoshtNomreh, setEditPoshtNomreh] = useState(String(receipt.poshtNomreh || ''));
    const [editDescription, setEditDescription] = useState(receipt.description || '');
    const [accountingNote, setAccountingNote] = useState(receipt.accountingReview?.note || '');
    const [editCheques, setEditCheques] = useState<ChequeItemInput[]>(() => {
        if (receipt.cheques && receipt.cheques.length > 0) {
            return receipt.cheques.map((c: any, idx: number) => ({
                id: c.chequeId || c.rowId || String(idx),
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
            accountingNote
        };
        onSaveReview(receipt.id, payload, isApproveForCEO);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-scale-in">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>ویرایش و بررسی کارشناسی حسابداری رسید چک</span>
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200">
                                    #{toPersianDigits(receipt.receiptNo || receipt.id)}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                کارشناس حسابداری می‌تواند مبالغ، شماره چک‌ها، تاریخ‌ها و طرف حساب را قبل از ارسال به مدیرعامل اصلاح و تایید نماید.
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

                {/* Body Form */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Person & PoshtNomreh */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                        <div className="relative">
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                طرف حساب (انتخاب از سایان) *
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
                                className={`w-full border rounded-xl px-3 py-2 text-xs outline-none transition-colors ${
                                    editPerson || receipt.personCode
                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 font-bold'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-amber-500'
                                }`}
                                placeholder="جستجوی نام یا کد شخص در سایان..."
                            />
                            {editPerson ? (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-bold flex items-center justify-between">
                                    <span>طرف حساب معتبر سایان</span>
                                    <span>کد: {toPersianDigits(editPerson.personCode)}</span>
                                </div>
                            ) : receipt.personCode ? (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                                    کد فعلی: {toPersianDigits(receipt.personCode)}
                                </div>
                            ) : (
                                <div className="text-[10px] text-amber-600 mt-1">
                                    * انتخاب طرف حساب از سایان الزامی است
                                </div>
                            )}
                            {editPersonResults.length > 0 && !editPerson && (
                                <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                    {editPersonResults.map(p => (
                                        <button
                                            key={p.personCode}
                                            type="button"
                                            onClick={() => {
                                                setEditPerson(p);
                                                setEditPersonQuery(p.fullName);
                                                setEditPersonResults([]);
                                            }}
                                            className="w-full text-right px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 flex justify-between items-center transition-colors"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{p.fullName}</div>
                                                {p.nationalId && <div className="text-[10px] text-slate-400">کدملی: {p.nationalId}</div>}
                                            </div>
                                            <span className="text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[11px] font-mono border border-blue-200">
                                                کد: {toPersianDigits(p.personCode)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                شماره پشت‌نمره *
                            </label>
                            <input
                                type="text"
                                value={editPoshtNomreh}
                                onChange={(e) => setEditPoshtNomreh(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                شرح سند و بابت
                            </label>
                            <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Cheques Rows */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-emerald-500" />
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
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold border border-emerald-200 flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>افزودن برگه چک</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            {editCheques.map((ch, idx) => (
                                <div key={ch.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-0.5">شماره چک</span>
                                        <input
                                            type="text"
                                            value={ch.chequeNumber}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].chequeNumber = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-0.5">مبلغ (ریال)</span>
                                        <input
                                            type="text"
                                            value={ch.amount ? Number(ch.amount).toLocaleString('en-US') : ''}
                                            onChange={(e) => {
                                                const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                                const next = [...editCheques];
                                                next[idx].amount = clean ? Number(clean) : '';
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 font-mono font-black text-emerald-600"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-0.5">تاریخ سررسید</span>
                                        <input
                                            type="date"
                                            value={ch.dueDate}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].dueDate = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 font-mono"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block mb-0.5">نام بانک</span>
                                        <input
                                            type="text"
                                            value={ch.bankName}
                                            onChange={(e) => {
                                                const next = [...editCheques];
                                                next[idx].bankName = e.target.value;
                                                setEditCheques(next);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0">
                                        {editCheques.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setEditCheques(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total Summary */}
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                مجموع کل مبالغ چک‌های رسید:
                            </span>
                            <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                                {toPersianDigits(editTotalAmount.toLocaleString('fa-IR'))} ریال
                            </span>
                        </div>
                    </div>

                    {/* Accounting Review Note */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            یادداشت و تاییدیه کارشناس حسابداری
                        </label>
                        <input
                            type="text"
                            value={accountingNote}
                            onChange={(e) => setAccountingNote(e.target.value)}
                            placeholder="مثال: اصالت چک‌ها و طرف حساب با فاکتور بررسی و تایید گردید."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
                    >
                        انصراف
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleSave(false)}
                            disabled={actionLoading === 'accounting_review'}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                        >
                            ذخیره تغییرات (پیش‌نویس)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave(true)}
                            disabled={actionLoading === 'accounting_review'}
                            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                        >
                            <Check className="w-4 h-4" />
                            <span>تایید حسابداری و ارسال به مدیرعامل (مرحله ۲)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
