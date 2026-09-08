import React, { useState, useRef, useEffect } from 'react';
import { CreditCard, Trash2, Calendar, Building2, User, ChevronDown, Check, Plus, Hash } from 'lucide-react';
import * as jalaali from 'jalaali-js';

export interface ChequeItemInput {
    id: string;
    chequeNumber: string;
    amount: number | '';
    dueDate: string; // ISO date or YYYY-MM-DD
    bankName: string;
    inNameOf: string;
    accountNo?: string;
    description?: string;
}

export const COMMON_IRANIAN_BANKS = [
    'سامان',
    'ملی ایران',
    'ملت',
    'صادرات ایران',
    'تجارت',
    'سپه',
    'پاسارگاد',
    'پارسیان',
    'کشاورزی',
    'مسکن',
    'رفاه کارگران',
    'آینده',
    'شهر',
    'سینا',
    'کارآفرین',
    'خاورمیانه',
    'دی',
    'انصار',
    'سرمایه',
    'گردشگری',
    'صنعت و معدن',
    'توسعه صادرات',
    'قرض‌الحسنه مهر ایران',
    'قرض‌الحسنه رسالت',
    'ایران زمین',
    'پست بانک ایران',
    'موسسه اعتباری نور',
    'موسسه اعتباری ملل',
    'موسسه اعتباری کاسپین'
];

interface Props {
    index: number;
    totalRows: number;
    item: ChequeItemInput;
    defaultInNameOf: string;
    onChange: (index: number, field: keyof ChequeItemInput, value: any) => void;
    onDelete: (index: number) => void;
    onEnterNext: (currentIndex: number, currentField: string) => void;
}

const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const toShamsiStr = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const mm = String(j.jm).padStart(2, '0');
        const dd = String(j.jd).padStart(2, '0');
        return `${j.jy}/${mm}/${dd}`;
    } catch {
        return dateStr;
    }
};

const fromShamsiStr = (shamsiStr: string): string => {
    if (!shamsiStr) return '';
    const clean = shamsiStr.replace(/[^0-9]/g, '/');
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 3) {
        const jy = parseInt(parts[0], 10);
        const jm = parseInt(parts[1], 10);
        const jd = parseInt(parts[2], 10);
        if (jy >= 1350 && jy <= 1500 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
            const g = jalaali.toGregorian(jy, jm, jd);
            const gm = String(g.gm).padStart(2, '0');
            const gd = String(g.gd).padStart(2, '0');
            return `${g.gy}-${gm}-${gd}`;
        }
    }
    return '';
};

export const ChequeItemRow: React.FC<Props> = ({
    index,
    totalRows,
    item,
    defaultInNameOf,
    onChange,
    onDelete,
    onEnterNext
}) => {
    // Bank autocomplete state
    const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
    const [highlightedBankIdx, setHighlightedBankIdx] = useState(0);
    const bankDropdownRef = useRef<HTMLDivElement>(null);
    const bankInputRef = useRef<HTMLInputElement>(null);

    // Shamsi Date editing state
    const [shamsiInput, setShamsiInput] = useState(() => toShamsiStr(item.dueDate));

    useEffect(() => {
        setShamsiInput(toShamsiStr(item.dueDate));
    }, [item.dueDate]);

    // Filtered banks based on input
    const filteredBanks = COMMON_IRANIAN_BANKS.filter(b =>
        b.toLowerCase().includes((item.bankName || '').trim().toLowerCase())
    );

    // Close bank dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
                setBankDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectBank = (bank: string) => {
        onChange(index, 'bankName', bank);
        setBankDropdownOpen(false);
        // Move to inNameOf
        onEnterNext(index, 'bankName');
    };

    const handleBankKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setBankDropdownOpen(true);
            setHighlightedBankIdx(prev => Math.min(prev + 1, filteredBanks.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setBankDropdownOpen(true);
            setHighlightedBankIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (bankDropdownOpen && filteredBanks.length > 0 && highlightedBankIdx >= 0) {
                handleSelectBank(filteredBanks[highlightedBankIdx]);
            } else {
                onEnterNext(index, 'bankName');
            }
        }
    };

    const handleQuickAddMonths = (monthsToAdd: number) => {
        const base = new Date();
        base.setMonth(base.getMonth() + monthsToAdd);
        const iso = base.toISOString().slice(0, 10);
        onChange(index, 'dueDate', iso);
    };

    return (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 relative group">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-black font-mono flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                        {toPersianDigits(index + 1)}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        برگه چک شماره {toPersianDigits(item.chequeNumber || (index + 1))}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Quick Shamsi Month Buttons */}
                    <div className="hidden sm:flex items-center gap-1 text-[10px]">
                        <span className="text-slate-400 ml-1">سررسید سریع:</span>
                        {[1, 2, 3, 4, 6].map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => handleQuickAddMonths(m)}
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                                {toPersianDigits(m)} ماهه
                            </button>
                        ))}
                    </div>

                    {totalRows > 1 && (
                        <button
                            type="button"
                            onClick={() => onDelete(index)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="حذف این ردیف چک"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                {/* 1. Cheque Number */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره چک (صیادی) *
                    </label>
                    <input
                        id={`cheque-${index}-number`}
                        type="text"
                        value={item.chequeNumber}
                        onChange={(e) => onChange(index, 'chequeNumber', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEnterNext(index, 'number');
                            }
                        }}
                        placeholder="مثال: ۱۲۳۴۵۶۷۸"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                    />
                </div>

                {/* 2. Amount */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مبلغ چک (ریال) *
                    </label>
                    <input
                        id={`cheque-${index}-amount`}
                        type="text"
                        value={item.amount ? Number(item.amount).toLocaleString('en-US') : ''}
                        onChange={(e) => {
                            const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                            onChange(index, 'amount', clean ? Number(clean) : '');
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEnterNext(index, 'amount');
                            }
                        }}
                        placeholder="مبلغ به ریال"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                    />
                </div>

                {/* 3. Due Date (Shamsi) */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تاریخ سررسید (شمسی) *
                    </label>
                    <div className="relative">
                        <input
                            id={`cheque-${index}-dueDate`}
                            type="text"
                            value={shamsiInput}
                            onChange={(e) => {
                                const val = e.target.value;
                                setShamsiInput(val);
                                const greg = fromShamsiStr(val);
                                if (greg) {
                                    onChange(index, 'dueDate', greg);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onEnterNext(index, 'dueDate');
                                }
                            }}
                            placeholder="۱۴۰۵/۰۶/۱۸"
                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                        />
                        <span className="absolute left-2.5 top-2.5 text-[10px] text-slate-400 pointer-events-none">
                            شمسی
                        </span>
                    </div>
                </div>

                {/* 4. Bank Name with Autocomplete */}
                <div className="relative" ref={bankDropdownRef}>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نام بانک *
                    </label>
                    <div className="relative">
                        <input
                            ref={bankInputRef}
                            id={`cheque-${index}-bankName`}
                            type="text"
                            value={item.bankName}
                            onFocus={() => setBankDropdownOpen(true)}
                            onChange={(e) => {
                                onChange(index, 'bankName', e.target.value);
                                setBankDropdownOpen(true);
                                setHighlightedBankIdx(0);
                            }}
                            onKeyDown={handleBankKeyDown}
                            placeholder="نام بانک (تایپ جهت جستجو)"
                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                            className="absolute left-2 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Bank Autocomplete Dropdown */}
                    {bankDropdownOpen && filteredBanks.length > 0 && (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredBanks.map((bank, bIdx) => (
                                <button
                                    key={bank}
                                    type="button"
                                    onClick={() => handleSelectBank(bank)}
                                    className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                                        bIdx === highlightedBankIdx
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <span>بانک {bank}</span>
                                    {item.bankName === bank && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 5. In Name Of (صاحب حساب / در وجه) */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        صاحب چک / در وجه
                    </label>
                    <input
                        id={`cheque-${index}-inNameOf`}
                        type="text"
                        value={item.inNameOf || defaultInNameOf}
                        onChange={(e) => onChange(index, 'inNameOf', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEnterNext(index, 'inNameOf');
                            }
                        }}
                        placeholder="نام صادرکننده چک"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                    />
                </div>

                {/* 6. Description / Note for row */}
                <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        بابت / توضیحات چک
                    </label>
                    <input
                        id={`cheque-${index}-description`}
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => onChange(index, 'description', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onEnterNext(index, 'description');
                            }
                        }}
                        placeholder="مثال: قسط ۲ فاکتور ۴۰۵"
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                    />
                </div>
            </div>
        </div>
    );
};
