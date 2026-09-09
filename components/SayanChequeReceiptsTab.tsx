import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    CreditCard, Plus, Trash2, CheckCircle2, AlertCircle, Clock, ShieldCheck,
    Search, RefreshCw, Eye, Download, Upload, Calendar, Building2, User,
    FileCheck, ArrowRight, ExternalLink, X, ChevronDown, Check, Sparkles,
    Hash, Layers, ShieldAlert, ArrowUpRight, Copy, Printer, Edit3, CornerUpLeft,
    CheckSquare, FileText, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as jalaali from 'jalaali-js';
import { UserRole } from '../types';
import { getRolePermissions } from '../services/authService';
import { ChequeItemRow, ChequeItemInput, COMMON_IRANIAN_BANKS } from './sayan-cheques/ChequeItemRow';
import { RealSayanDocumentModal } from './sayan-cheques/RealSayanDocumentModal';
import { AccountingReviewModal } from './sayan-cheques/AccountingReviewModal';
import { ChequeReceiptDetailModal } from './sayan-cheques/ChequeReceiptDetailModal';
import { A5ChequeReceiptPrintModal } from './sayan-cheques/A5ChequeReceiptPrintModal';

interface SayanPerson {
    personCode: string;
    fullName: string;
    nationalId?: string;
    mobile?: string;
}

interface ChequeReceiptRecord {
    id: string;
    receiptNo?: number | string;
    source: 'APP_DRAFT' | 'SAYAN_DB';
    status: 'PENDING_ACCOUNTING' | 'PENDING_CEO' | 'APPROVED' | 'REGISTERED_IN_SAYAN' | 'REJECTED' | 'PENDING_APPROVAL';
    fiscalYear: string;
    docNo: string | number;
    archiveCode: string | number;
    poshtNomreh: string;
    docDate: string;
    personCode: string;
    personName: string;
    totalAmount: number;
    description: string;
    cheques: Array<{
        chequeId?: string;
        rowId?: string;
        chequeNumber: string;
        amount: number;
        dueDate: string;
        bankName: string;
        inNameOf: string;
        poshtNomreh?: string;
        description?: string;
    }>;
    attachments?: Array<{
        fileName: string;
        fileData: string;
        fileType?: string;
        uploadedAt?: string;
    }>;
    accountingReview?: {
        approved: boolean;
        byUserId?: string;
        byName?: string;
        date?: string;
        note?: string;
    };
    ceoApproval?: {
        approved: boolean;
        byUserId?: string;
        byName?: string;
        date?: string;
    };
    sayanDocNo?: number;
    sayanArchiveCode?: number;
    sayanError?: string;
    sayanRegisteredAt?: string;
    createdAt?: string;
    createdByName?: string;
}

interface Props {
    currentUser: any;
    fiscalYear?: string;
    settings?: any;
}

const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

const getTodayShamsi = (): string => {
    const now = new Date();
    const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const mm = String(j.jm).padStart(2, '0');
    const dd = String(j.jd).padStart(2, '0');
    return `${j.jy}/${mm}/${dd}`;
};

const getShamsiPlusMonths = (months: number): string => {
    const base = new Date();
    base.setMonth(base.getMonth() + months);
    const j = jalaali.toJalaali(base.getFullYear(), base.getMonth() + 1, base.getDate());
    const mm = String(j.jm).padStart(2, '0');
    const dd = String(j.jd).padStart(2, '0');
    return `${j.jy}/${mm}/${dd}`;
};

export const SayanChequeReceiptsTab: React.FC<Props> = ({
    currentUser,
    fiscalYear = '4',
    settings
}) => {
    // Current Active Tab
    const [activeSubTab, setActiveSubTab] = useState<'NEW_RECEIPT' | 'CARTABLE' | 'ARCHIVE'>('NEW_RECEIPT');

    // Dynamic Permissions based on Settings & Roles
    const resolvedPermissions = useMemo(() => {
        let perms = currentUser?.rolePermissions || {};
        if (settings) {
            try {
                perms = getRolePermissions(currentUser?.role, settings, currentUser);
            } catch (e) {
                console.error("Error resolving role permissions in SayanChequeReceiptsTab:", e);
            }
        }
        
        const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.roles?.includes(UserRole.ADMIN) || currentUser?.roles?.includes('admin');
        
        return {
            canSayanRegisterCheque: isAdmin || perms.canSayanRegisterCheque !== false, // default to true if not explicitly restricted
            canSayanApproveAccounting: isAdmin || perms.canSayanApproveAccounting === true || (perms.canSayanApproveAccounting === undefined && (currentUser?.role === UserRole.FINANCIAL || currentUser?.roles?.includes('financial'))),
            canSayanApproveCeo: isAdmin || perms.canSayanApproveCeo === true || (perms.canSayanApproveCeo === undefined && (currentUser?.role === UserRole.CEO || currentUser?.role === 'CEO' || currentUser?.role === 'MANAGER' || currentUser?.roles?.includes('ceo'))),
            canSayanDeleteReceipt: isAdmin || perms.canSayanDeleteReceipt === true || (perms.canSayanDeleteReceipt === undefined && (currentUser?.role === UserRole.FINANCIAL || currentUser?.roles?.includes('financial')))
        };
    }, [currentUser, settings]);

    const isFinancialOrAdmin = resolvedPermissions.canSayanApproveAccounting;
    const isCeoOrAdmin = resolvedPermissions.canSayanApproveCeo;
    const canDeleteReceipt = resolvedPermissions.canSayanDeleteReceipt;
    const canRegisterReceipt = resolvedPermissions.canSayanRegisterCheque;

    // Redirect to Cartable if registration is not allowed
    useEffect(() => {
        if (!canRegisterReceipt && activeSubTab === 'NEW_RECEIPT') {
            setActiveSubTab('CARTABLE');
        }
    }, [canRegisterReceipt, activeSubTab]);

    // Form States
    const [personQuery, setPersonQuery] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<SayanPerson | null>(null);
    const [personSearchResults, setPersonSearchResults] = useState<SayanPerson[]>([]);
    const [searchingPersons, setSearchingPersons] = useState(false);
    const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
    const personContainerRef = useRef<HTMLDivElement>(null);

    const [poshtNomreh, setPoshtNomreh] = useState('');
    const [targetTotalAmount, setTargetTotalAmount] = useState<number | ''>('');
    const [docDateShamsi, setDocDateShamsi] = useState(getTodayShamsi());
    const [description, setDescription] = useState('');
    const [attachments, setAttachments] = useState<Array<{ fileName: string; fileData: string; fileType: string }>>([]);
    const [previewFile, setPreviewFile] = useState<{ fileName: string; fileData: string; fileType: string } | null>(null);

    // Cashbox states
    const [cashboxCode, setCashboxCode] = useState('11001');
    const [cashboxesList, setCashboxesList] = useState<Array<{ code: string; title: string }>>([
        { code: '11001', title: 'صندوق دفتر' },
        { code: '11002', title: 'صندوق سکه و کارت هدیه' },
        { code: '11003', title: 'صندوق آقای مقدم' },
        { code: '11004', title: 'صندوق ارزی' },
        { code: '11005', title: 'صندوق چک های برگشتی' }
    ]);

    const fetchCashboxes = async () => {
        try {
            const res = await fetch('/api/sayan/cheque-receipts/cashboxes');
            const data = await res.json();
            if (data.success && Array.isArray(data.cashboxes) && data.cashboxes.length > 0) {
                setCashboxesList(data.cashboxes);
            }
        } catch (err) {
            console.error('Failed to fetch cashboxes', err);
        }
    };

    // Cheque Rows
    const [chequeRows, setChequeRows] = useState<ChequeItemInput[]>([
        {
            id: '1',
            chequeNumber: '',
            amount: '',
            dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            bankName: 'سامان',
            inNameOf: '',
            accountNo: '',
            description: ''
        }
    ]);

    // Data lists
    const [receiptsList, setReceiptsList] = useState<ChequeReceiptRecord[]>([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Filters & Search in Archive
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ACCOUNTING' | 'PENDING_CEO' | 'REGISTERED_IN_SAYAN'>('ALL');

    // Modals
    const [inspectingArchiveCode, setInspectingArchiveCode] = useState<{ archiveCode: string | number; docNo?: string | number } | null>(null);
    const [reviewingReceipt, setReviewingReceipt] = useState<ChequeReceiptRecord | null>(null);
    const [selectedDetailReceipt, setSelectedDetailReceipt] = useState<ChequeReceiptRecord | null>(null);
    const [printReceipt, setPrintReceipt] = useState<any>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [highlightedPersonIdx, setHighlightedPersonIdx] = useState(0);

    // Fetch Receipts
    const fetchMetaNumbers = async () => {
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/meta?fiscalYear=${fiscalYear}`);
            const data = await res.json();
            if (data.success && data.nextPoshtNomreh) {
                setPoshtNomreh(String(data.nextPoshtNomreh));
            }
        } catch (err) {
            console.error('Failed to fetch next posht nomreh', err);
        }
    };

    const fetchReceipts = async (silent = false) => {
        if (!silent) setLoadingReceipts(true);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts?fiscalYear=${fiscalYear}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setReceiptsList(data.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch cheque receipts', err);
        } finally {
            if (!silent) setLoadingReceipts(false);
        }
    };

    useEffect(() => {
        fetchReceipts();
        fetchMetaNumbers();
        fetchCashboxes();
        const interval = setInterval(() => {
            fetchReceipts(true);
        }, 30000); // 30s gentle poll
        return () => clearInterval(interval);
    }, [fiscalYear]);

    // Person Search
    const fetchPersons = async (q: string) => {
        setSearchingPersons(true);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/persons?query=${encodeURIComponent(q)}&fiscalYear=${fiscalYear}`);
            const data = await res.json();
            if (data.success && Array.isArray(data.persons)) {
                setPersonSearchResults(data.persons);
                setPersonDropdownOpen(true);
            }
        } catch (err) {
            console.error('Person search error', err);
        } finally {
            setSearchingPersons(false);
        }
    };

    useEffect(() => {
        if (!personQuery || personQuery.trim().length === 0) {
            setPersonSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            fetchPersons(personQuery.trim());
        }, 200);
        return () => clearTimeout(timer);
    }, [personQuery, fiscalYear]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (personContainerRef.current && !personContainerRef.current.contains(e.target as Node)) {
                setPersonDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sum of cheque rows
    const sumChequesAmount = useMemo(() => {
        return chequeRows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }, [chequeRows]);

    const amountDiff = (Number(targetTotalAmount) || 0) - sumChequesAmount;

    // Global shortcut Ctrl+Enter to submit receipt from anywhere in the form
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (activeSubTab === 'NEW_RECEIPT') {
                    e.preventDefault();
                    document.getElementById('btn-submit-cheque-receipt')?.click();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [activeSubTab]);

    // Handle Keyboard Enter Navigation across fields
    const handleEnterNext = (rowIdx: number, field: string) => {
        if (field === 'person') {
            const el = document.getElementById('input-posht-nomreh') as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'poshtNomreh') {
            const el = document.getElementById('input-target-amount') as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'targetAmount') {
            const el = document.getElementById('input-doc-desc') as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'docDesc') {
            const el = document.getElementById('cheque-0-number') as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'number') {
            const el = document.getElementById(`cheque-${rowIdx}-amount`) as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'amount') {
            const el = document.getElementById(`cheque-${rowIdx}-dueDate`) as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'dueDate') {
            const el = document.getElementById(`cheque-${rowIdx}-bankName`) as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'bankName') {
            const el = document.getElementById(`cheque-${rowIdx}-inNameOf`) as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'inNameOf') {
            const el = document.getElementById(`cheque-${rowIdx}-description`) as HTMLInputElement | null;
            el?.focus();
            el?.select?.();
        } else if (field === 'description') {
            if (rowIdx === chequeRows.length - 1) {
                // If row has content, add next row; if empty, focus submit
                if (chequeRows[rowIdx]?.chequeNumber || chequeRows[rowIdx]?.amount) {
                    handleAddChequeRow(true);
                } else {
                    document.getElementById('btn-submit-cheque-receipt')?.focus();
                }
            } else {
                const el = document.getElementById(`cheque-${rowIdx + 1}-number`) as HTMLInputElement | null;
                el?.focus();
                el?.select?.();
            }
        }
    };

    // 4-Way Arrow Key Navigation across rows and columns
    const handleArrowNavigate = (rowIdx: number, field: string, direction: 'up' | 'down' | 'left' | 'right') => {
        const columns = ['number', 'amount', 'dueDate', 'bankName', 'inNameOf', 'description'];
        const colIdx = columns.indexOf(field);

        if (direction === 'up') {
            if (rowIdx > 0) {
                const prevInput = document.getElementById(`cheque-${rowIdx - 1}-${field}`) as HTMLInputElement | null;
                if (prevInput) {
                    prevInput.focus();
                    prevInput.select?.();
                }
            } else {
                // Moving up from Row 0 to Header
                if (field === 'number') {
                    const el = document.getElementById('input-posht-nomreh') as HTMLInputElement | null;
                    el?.focus();
                    el?.select?.();
                } else if (field === 'amount') {
                    const el = document.getElementById('input-target-amount') as HTMLInputElement | null;
                    el?.focus();
                    el?.select?.();
                } else if (field === 'dueDate') {
                    const el = document.getElementById('input-doc-date') as HTMLInputElement | null;
                    el?.focus();
                    el?.select?.();
                } else {
                    const el = document.getElementById('input-doc-desc') as HTMLInputElement | null;
                    el?.focus();
                    el?.select?.();
                }
            }
        } else if (direction === 'down') {
            if (rowIdx < chequeRows.length - 1) {
                const nextInput = document.getElementById(`cheque-${rowIdx + 1}-${field}`) as HTMLInputElement | null;
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select?.();
                }
            } else {
                // If on last row, auto-add row if current row has data, or focus submit button
                if (chequeRows[rowIdx]?.chequeNumber || chequeRows[rowIdx]?.amount) {
                    handleAddChequeRow(false);
                    setTimeout(() => {
                        const target = document.getElementById(`cheque-${rowIdx + 1}-${field}`) as HTMLInputElement | null;
                        if (target) {
                            target.focus();
                            target.select?.();
                        }
                    }, 60);
                } else {
                    document.getElementById('btn-submit-cheque-receipt')?.focus();
                }
            }
        } else if (direction === 'left') {
            // In Persian RTL: left arrow is forward (next column)
            if (colIdx >= 0 && colIdx < columns.length - 1) {
                const nextField = columns[colIdx + 1];
                const nextEl = document.getElementById(`cheque-${rowIdx}-${nextField}`) as HTMLInputElement | null;
                if (nextEl) {
                    nextEl.focus();
                    nextEl.select?.();
                }
            } else if (colIdx === columns.length - 1) {
                if (rowIdx < chequeRows.length - 1) {
                    const nextRowEl = document.getElementById(`cheque-${rowIdx + 1}-number`) as HTMLInputElement | null;
                    if (nextRowEl) {
                        nextRowEl.focus();
                        nextRowEl.select?.();
                    }
                } else {
                    document.getElementById('btn-submit-cheque-receipt')?.focus();
                }
            }
        } else if (direction === 'right') {
            // In Persian RTL: right arrow is backward (previous column)
            if (colIdx > 0) {
                const prevField = columns[colIdx - 1];
                const prevEl = document.getElementById(`cheque-${rowIdx}-${prevField}`) as HTMLInputElement | null;
                if (prevEl) {
                    prevEl.focus();
                    prevEl.select?.();
                }
            } else if (colIdx === 0) {
                if (rowIdx > 0) {
                    const prevRowEl = document.getElementById(`cheque-${rowIdx - 1}-description`) as HTMLInputElement | null;
                    if (prevRowEl) {
                        prevRowEl.focus();
                        prevRowEl.select?.();
                    }
                } else {
                    const descEl = document.getElementById('input-doc-desc') as HTMLInputElement | null;
                    descEl?.focus();
                    descEl?.select?.();
                }
            }
        }
    };

    // Row management
    const handleChequeRowChange = (index: number, field: keyof ChequeItemInput, value: any) => {
        setChequeRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleAddChequeRow = (autoFocus = false) => {
        const newId = String(Date.now());
        setChequeRows(prev => [
            ...prev,
            {
                id: newId,
                chequeNumber: '',
                amount: '',
                dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                bankName: 'سامان',
                inNameOf: selectedPerson ? selectedPerson.fullName : '',
                accountNo: '',
                description: ''
            }
        ]);
        if (autoFocus) {
            setTimeout(() => {
                document.getElementById(`cheque-${chequeRows.length}-number`)?.focus();
            }, 50);
        }
    };

    const handleDeleteChequeRow = (index: number) => {
        if (chequeRows.length <= 1) return;
        setChequeRows(prev => prev.filter((_, i) => i !== index));
    };

    // File attachments handler (PDF / Images)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setAttachments(prev => [
                        ...prev,
                        {
                            fileName: file.name,
                            fileData: ev.target!.result as string,
                            fileType: file.type
                        }
                    ]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    // Form Submission: Create Cheque Receipt
    const handleSubmitReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        if (!selectedPerson) {
            setErrorMessage('انتخاب طرف حساب از بین اشخاص معتبر سیستم سایان اجباری است. لطفاً نام یا کد شخص را جستجو کرده و از لیست پیشنهادها انتخاب کنید.');
            document.getElementById('input-person-name')?.focus();
            return;
        }

        if (chequeRows.some(r => !r.chequeNumber.trim() || !r.amount)) {
            setErrorMessage('شماره چک و مبلغ برای تمامی ردیف‌های چک الزامی است.');
            return;
        }

        if (targetTotalAmount && Number(targetTotalAmount) !== sumChequesAmount) {
            const proceed = window.confirm(
                `مجموع مبالغ ردیف‌ها (${sumChequesAmount.toLocaleString('fa-IR')} ریال) با جمع کل کلیک شده (${Number(targetTotalAmount).toLocaleString('fa-IR')} ریال) مغایرت دارد.\nآیا مایل به ثبت رسید بر اساس جمع کل ردیف‌ها هستید؟`
            );
            if (!proceed) return;
        }

        setActionLoading('submit_new');

        try {
            const payload = {
                fiscalYear,
                poshtNomreh: poshtNomreh.trim() || '1',
                personCode: selectedPerson ? selectedPerson.personCode : '101',
                personName: selectedPerson ? selectedPerson.fullName : personQuery.trim(),
                cashboxCode,
                totalAmount: sumChequesAmount,
                description: description.trim() || `رسید دریافت چک - ${selectedPerson?.fullName || personQuery}`,
                cheques: chequeRows.map((r, idx) => ({
                    chequeNumber: r.chequeNumber.trim(),
                    amount: Number(r.amount),
                    dueDate: r.dueDate,
                    bankName: r.bankName.trim() || 'سامان',
                    inNameOf: r.inNameOf.trim() || (selectedPerson?.fullName || personQuery),
                    poshtNomreh: poshtNomreh.trim() || '1',
                    rowSeq: idx + 1,
                    description: r.description?.trim() || ''
                })),
                attachments,
                createdByName: currentUser?.name || 'کاربر سیستم'
            };

            const res = await fetch('/api/sayan/cheque-receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                const createdReceipt = data.receipt || {
                    id: data.id || data.receiptNo || String(Date.now()),
                    receiptNo: data.receiptNo || data.id,
                    poshtNomreh: payload.poshtNomreh,
                    personCode: payload.personCode,
                    personName: payload.personName,
                    cashboxCode: payload.cashboxCode,
                    cashboxTitle: cashboxesList.find(b => b.code === cashboxCode)?.title || 'صندوق چک',
                    totalAmount: payload.totalAmount,
                    description: payload.description,
                    docDateShamsi: docDateShamsi,
                    createdAt: new Date().toISOString(),
                    cheques: payload.cheques,
                    status: 'PENDING_ACCOUNTING',
                    createdByName: currentUser?.name || 'ثبت‌کننده'
                };

                setSuccessMessage(`رسید دریافت چک با شماره #${toPersianDigits(data.receiptNo || data.id)} ثبت شد و به کارتابل حسابداری ارسال گردید.`);

                // Immediately open the A5 print & inspection modal
                setPrintReceipt(createdReceipt);
                setIsPrintModalOpen(true);

                // Reset form for next entry
                setPersonQuery('');
                setSelectedPerson(null);
                setPoshtNomreh('');
                setCashboxCode('11001');
                setTargetTotalAmount('');
                setDescription('');
                setAttachments([]);
                setChequeRows([
                    {
                        id: '1',
                        chequeNumber: '',
                        amount: '',
                        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                        bankName: 'سامان',
                        inNameOf: '',
                        accountNo: '',
                        description: ''
                    }
                ]);
                fetchReceipts(true);
                fetchMetaNumbers();
            } else {
                setErrorMessage(data.error || 'خطا در ثبت رسید چک');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'خطا در ارتباط با سرور');
        } finally {
            setActionLoading(null);
        }
    };

    // Accounting Review / Save
    const handleSaveAccountingReview = async (receiptId: string, updatedData: any, isApproveForCEO: boolean) => {
        setActionLoading('accounting_review');
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/${receiptId}/accounting-review`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...updatedData,
                    approveForCEO: isApproveForCEO,
                    reviewerId: currentUser?.id,
                    reviewerName: currentUser?.name || 'کارشناس حسابداری'
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMessage(isApproveForCEO ? 'رسید چک با موفقیت تایید و جهت تایید نهایی به کارتابل مدیرعامل ارسال گردید.' : 'تغییرات رسید ذخیره شد.');
                setReviewingReceipt(null);
                fetchReceipts(true);
            } else {
                setErrorMessage(data.error || 'خطا در ذخیره بررسی حسابداری');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'خطا در برقراری ارتباط');
        } finally {
            setActionLoading(null);
        }
    };

    // CEO Approval & Direct Sayan Registration
    const handleApproveByCeo = async (receiptId: string) => {
        const proceed = window.confirm('آیا از تایید نهایی این رسید چک و صدور سند در پایگاه‌داده سایان اطمینان دارید؟');
        if (!proceed) return;

        setActionLoading(receiptId);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/${receiptId}/ceo-approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    approverId: currentUser?.id,
                    approverName: currentUser?.name || 'مدیرعامل'
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`رسید تایید شد و سند سایان با شماره ${toPersianDigits(data.sayanDocNo || data.docNo)} و کد بایگانی ${toPersianDigits(data.sayanArchiveCode || data.archiveCode)} در ERP سایان صادر گردید.`);
                setSelectedDetailReceipt(null);
                fetchReceipts(true);
            } else {
                setErrorMessage(data.error || 'خطا در ثبت سند در سایان');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'خطا در ثبت نهایی');
        } finally {
            setActionLoading(null);
        }
    };

    // Reject / Return
    const handleReject = async (receiptId: string) => {
        const reason = window.prompt('لطفاً دلیل عدم تایید یا عودت رسید را وارد نمایید:');
        if (reason === null) return;

        setActionLoading(receiptId);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/${receiptId}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rejectReason: reason,
                    rejectedBy: currentUser?.name || 'کاربر'
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMessage('رسید چک عودت داده شد.');
                setSelectedDetailReceipt(null);
                fetchReceipts(true);
            } else {
                setErrorMessage(data.error || 'خطا در عودت رسید');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'خطا در عودت');
        } finally {
            setActionLoading(null);
        }
    };

    // Full Draft / Receipt Delete
    const handleDeleteReceipt = async (receiptId: string) => {
        const proceed = window.confirm('آیا از حذف کامل این رسید دریافت چک اطمینان دارید؟ این عملیات غیرقابل بازگشت است.');
        if (!proceed) return;

        setActionLoading(receiptId);
        try {
            const res = await fetch('/api/sayan/cheque-receipts/delete-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptId })
            });

            const data = await res.json();
            if (data.success) {
                setSuccessMessage('رسید دریافت چک با موفقیت حذف گردید.');
                setSelectedDetailReceipt(null);
                fetchReceipts(true);
            } else {
                setErrorMessage(data.error || 'خطا در حذف رسید');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'خطا در برقراری ارتباط جهت حذف');
        } finally {
            setActionLoading(null);
        }
    };

    // Filtered lists
    const pendingAccountingList = useMemo(() => {
        return receiptsList.filter(r => r.status === 'PENDING_ACCOUNTING');
    }, [receiptsList]);

    const pendingCeoList = useMemo(() => {
        return receiptsList.filter(r => r.status === 'PENDING_CEO');
    }, [receiptsList]);

    const archiveList = useMemo(() => {
        return receiptsList.filter(r => {
            const matchSearch = !searchTerm ||
                r.personName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(r.poshtNomreh || '').includes(searchTerm) ||
                String(r.docNo || '').includes(searchTerm) ||
                String(r.archiveCode || '').includes(searchTerm) ||
                r.cheques?.some(c => c.chequeNumber?.includes(searchTerm));

            if (!matchSearch) return false;

            if (statusFilter === 'ALL') return true;
            return r.status === statusFilter;
        });
    }, [receiptsList, searchTerm, statusFilter]);

    return (
        <div className="space-y-6">
            {/* Header Notifications */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-xs"
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span>{successMessage}</span>
                        </div>
                        <button type="button" onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
                {errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center justify-between shadow-xs"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                        <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Navigation Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">
                            ثبت و مدیریت رسید دریافت چک (خزانه‌داری سایان)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            فرم هوشمند ثبت چک، پشت‌نمره، تایید دومرحله‌ای کارمند حسابداری و مدیرعامل با امکان مشاهده سند واقعی سایان
                        </p>
                    </div>
                </div>

                {/* Sub-tab Switcher */}
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs font-bold w-full sm:w-auto overflow-x-auto">
                    {canRegisterReceipt && (
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('NEW_RECEIPT')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                                activeSubTab === 'NEW_RECEIPT'
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            <Plus className="w-4 h-4" />
                            <span>ثبت رسید جدید</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('CARTABLE')}
                        className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap relative ${
                            activeSubTab === 'CARTABLE'
                                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <CheckSquare className="w-4 h-4" />
                        <span>کارتابل تایید چک‌ها</span>
                        {(pendingAccountingList.length > 0 || pendingCeoList.length > 0) && (
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-mono text-[10px] flex items-center justify-center font-black animate-pulse">
                                {toPersianDigits(pendingAccountingList.length + pendingCeoList.length)}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('ARCHIVE')}
                        className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeSubTab === 'ARCHIVE'
                                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                    >
                        <FileCheck className="w-4 h-4" />
                        <span>بایگانی و استعلام اسناد سایان</span>
                        <span className="text-[10px] opacity-70 font-mono">({toPersianDigits(receiptsList.length)})</span>
                    </button>
                </div>
            </div>

            {/* Sub-tab 1: NEW CHEQUE RECEIPT FORM */}
            {activeSubTab === 'NEW_RECEIPT' && (
                <form onSubmit={handleSubmitReceipt} className="space-y-5">
                    {/* Sayan Operation & Cashbox Selector Dashboard Card */}
                    <div className="bg-gradient-to-l from-slate-50 to-emerald-50/20 dark:from-slate-900/60 dark:to-slate-900/10 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-4">
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                            
                            {/* Step Indicators */}
                            <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                <div className="flex items-center gap-1.5 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl font-bold text-emerald-800 dark:text-emerald-300">
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-[10px]">۱۱</span>
                                    <span>مرحله ۱: عملیات دریافت</span>
                                </div>
                                
                                <span className="text-slate-400 font-bold">←</span>
                                
                                <div className="flex items-center gap-1.5 bg-blue-100/80 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl font-bold text-blue-800 dark:text-blue-300">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">۱۲</span>
                                    <span>مرحله ۲: عامل دریافت چک</span>
                                </div>

                                <span className="text-slate-400 font-bold">←</span>

                                <div className="flex items-center gap-1.5 bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl font-bold text-purple-800 dark:text-purple-300">
                                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-[10px]">۳</span>
                                    <span>مرحله ۳: صندوق دریافت چک *</span>
                                </div>
                            </div>

                            {/* Actual Dropdown Selection for Cashbox */}
                            <div className="min-w-[240px] relative">
                                <label className="block text-[11px] font-black text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                                    <span>صندوق دریافت (خزانه‌داری سایان) *</span>
                                </label>
                                <div className="relative font-sans">
                                    <select
                                        value={cashboxCode}
                                        onChange={(e) => setCashboxCode(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border-2 border-purple-200 dark:border-purple-900 rounded-xl px-3 py-2.5 text-xs font-black text-slate-800 dark:text-slate-100 outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none pr-8 text-right"
                                    >
                                        {cashboxesList.map(box => (
                                            <option key={box.code} value={box.code}>
                                                {box.title} (کد: {toPersianDigits(box.code)})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-purple-500 absolute left-2.5 top-3.5 pointer-events-none" />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Top General Information Card */}
                    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    مشخصات کلی رسید و طرف حساب
                                </h3>
                            </div>
                            <span className="text-[11px] text-slate-400">
                                با زدن کلید Enter به فیلد بعدی هدایت می‌شوید
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            {/* 1. Person Search Autocomplete */}
                            <div ref={personContainerRef} className="relative">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    طرف حساب (انتخاب اجباری از سایان) *
                                </label>
                                <div className="relative">
                                    <input
                                        id="input-person-name"
                                        type="text"
                                        value={personQuery}
                                        onChange={(e) => {
                                            setPersonQuery(e.target.value);
                                            if (selectedPerson && e.target.value !== selectedPerson.fullName) {
                                                setSelectedPerson(null);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (personSearchResults.length > 0) {
                                                setPersonDropdownOpen(true);
                                            } else if (personQuery.trim().length > 0) {
                                                fetchPersons(personQuery.trim());
                                            } else {
                                                fetchPersons('');
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (!selectedPerson && personSearchResults.length > 0) {
                                                    const first = personSearchResults[0];
                                                    setSelectedPerson(first);
                                                    setPersonQuery(first.fullName);
                                                    setPersonDropdownOpen(false);
                                                    setChequeRows(prev => prev.map(r => ({ ...r, inNameOf: r.inNameOf || first.fullName })));
                                                    document.getElementById('input-posht-nomreh')?.focus();
                                                } else {
                                                    handleEnterNext(0, 'person');
                                                }
                                            }
                                        }}
                                        placeholder="نام یا کد تفصیلی (جستجو در سایان)..."
                                        className={`w-full border rounded-xl px-3 py-2.5 text-xs outline-none transition-colors ${
                                            selectedPerson
                                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold'
                                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900'
                                        }`}
                                    />
                                    {searchingPersons && (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin absolute left-3 top-3 text-emerald-500" />
                                    )}
                                </div>

                                {selectedPerson ? (
                                    <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                        <span>طرف حساب معتبر سایان</span>
                                        <span className="font-mono">کد تفصیلی: {toPersianDigits(selectedPerson.personCode)}</span>
                                    </div>
                                ) : (
                                    <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        * انتخاب از میان طرف‌های حساب سایان الزامی است
                                    </div>
                                )}

                                {/* Person Dropdown */}
                                {personDropdownOpen && (
                                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
                                        {personSearchResults.length > 0 ? (
                                            personSearchResults.map(p => (
                                                <button
                                                    key={p.personCode}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPerson(p);
                                                        setPersonQuery(p.fullName);
                                                        setPersonDropdownOpen(false);
                                                        // Autofill InNameOf in cheque rows if empty
                                                        setChequeRows(prev => prev.map(r => ({ ...r, inNameOf: r.inNameOf || p.fullName })));
                                                        document.getElementById('input-posht-nomreh')?.focus();
                                                    }}
                                                    className="w-full text-right p-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{p.fullName}</div>
                                                        {p.nationalId && <div className="text-[10px] text-slate-400 font-mono">کدملی: {p.nationalId}</div>}
                                                    </div>
                                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 border border-blue-200">
                                                        کد: {toPersianDigits(p.personCode)}
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            !searchingPersons && (
                                                <div className="p-3 text-center text-xs text-slate-400">
                                                    هیچ حسابی در سایان با این عنوان یافت نشد
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Posht-Nomreh */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    شماره پشت‌نمره رسید *
                                </label>
                                <input
                                    id="input-posht-nomreh"
                                    type="text"
                                    value={poshtNomreh}
                                    onChange={(e) => setPoshtNomreh(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleEnterNext(0, 'poshtNomreh');
                                        }
                                    }}
                                    placeholder="مثال: ۱۰۲۴"
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                                />
                            </div>

                            {/* 3. Target Total Amount */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    جمع چک (ریال) - کنترلی
                                </label>
                                <input
                                    id="input-target-amount"
                                    type="text"
                                    value={targetTotalAmount ? Number(targetTotalAmount).toLocaleString('en-US') : ''}
                                    onChange={(e) => {
                                        const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                        setTargetTotalAmount(clean ? Number(clean) : '');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleEnterNext(0, 'targetAmount');
                                        }
                                    }}
                                    placeholder="جمع اولیه چک‌ها"
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                                />
                            </div>

                            {/* 4. Receipt Date (Shamsi) */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    تاریخ ثبت رسید (شمسی)
                                </label>
                                <input
                                    id="input-doc-date"
                                    type="text"
                                    value={docDateShamsi}
                                    onChange={(e) => setDocDateShamsi(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Description & File Attachments */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 text-xs">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    شرح کلی رسید و بابت
                                </label>
                                <input
                                    id="input-doc-desc"
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleEnterNext(0, 'docDesc');
                                        }
                                    }}
                                    placeholder="مثال: تسویه فاکتور فروش شماره ۵۸۰"
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    پیوست تصویر یا فایل PDF چک‌ها
                                </label>
                                <div className="flex items-center gap-2">
                                    <label className="flex-1 cursor-pointer bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 transition-colors">
                                        <Upload className="w-4 h-4 text-purple-500" />
                                        <span>انتخاب فایل (PDF / تصویر)</span>
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {attachments.map((att, aIdx) => (
                                            <span key={aIdx} className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/50">
                                                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                                <span className="truncate max-w-[140px]">{att.fileName}</span>
                                                
                                                <div className="flex items-center gap-1 mr-1.5 border-r border-indigo-200 dark:border-indigo-800 pr-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewFile(att)}
                                                        className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition-colors"
                                                        title="پیش‌نمایش"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const link = document.createElement('a');
                                                            link.href = att.fileData;
                                                            link.download = att.fileName;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                        }}
                                                        className="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition-colors"
                                                        title="دانلود فایل"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== aIdx))}
                                                        className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
                                                        title="حذف"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cheque Rows Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    اقلام و برگه‌های چک رسید ({toPersianDigits(chequeRows.length)} فقره)
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleAddChequeRow(true)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                <span>افزودن برگه چک بعدی</span>
                            </button>
                        </div>

                        {/* Rows */}
                        <div className="space-y-3">
                            {chequeRows.map((item, idx) => (
                                <ChequeItemRow
                                    key={item.id}
                                    index={idx}
                                    totalRows={chequeRows.length}
                                    item={item}
                                    defaultInNameOf={selectedPerson ? selectedPerson.fullName : personQuery}
                                    onChange={handleChequeRowChange}
                                    onDelete={handleDeleteChequeRow}
                                    onEnterNext={handleEnterNext}
                                    onArrowNavigate={handleArrowNavigate}
                                />
                            ))}
                        </div>

                        {/* Summary & Discrepancy Bar */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-bold">تعداد برگ چک:</span>
                                    <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                                        {toPersianDigits(chequeRows.length)} برگ
                                    </span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-bold">مجموع مبالغ کل چک‌ها:</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">
                                            {toPersianDigits(sumChequesAmount.toLocaleString('fa-IR'))} ریال
                                        </span>
                                        <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            ({toPersianDigits(Math.floor(sumChequesAmount / 10).toLocaleString('fa-IR'))} تومان)
                                        </span>
                                    </div>
                                </div>
                                {selectedPerson && (
                                    <>
                                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400 block mb-0.5 font-bold">طرف حساب / صادرکننده:</span>
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                {selectedPerson.fullName}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {targetTotalAmount !== '' && (
                                <div className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                                    amountDiff === 0
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                    {amountDiff === 0 ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            <span>جمع چک‌ها با مبلغ کنترلی کاملاً منطبق است.</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-4 h-4 text-amber-600" />
                                            <span>
                                                مغایرت: {toPersianDigits(Math.abs(amountDiff).toLocaleString('fa-IR'))} ریال
                                                {amountDiff > 0 ? ' (کمتر از مبلغ کنترلی)' : ' (بیشتر از مبلغ کنترلی)'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={actionLoading === 'submit_new'}
                            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                        >
                            <ShieldCheck className="w-5 h-5" />
                            <span>
                                {actionLoading === 'submit_new'
                                    ? 'در حال ثبت و ارسال به کارتابل حسابداری...'
                                    : 'ثبت رسید چک و ارسال به کارتابل حسابداری (مرحله ۱)'}
                            </span>
                        </button>
                    </div>
                </form>
            )}

            {/* Sub-tab 2: CARTABLE (ACCOUNTING & CEO APPROVALS) */}
            {activeSubTab === 'CARTABLE' && (
                <div className="space-y-6">
                    {/* 1. Accounting Pending Items */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs font-mono">
                                    {toPersianDigits(pendingAccountingList.length)}
                                </span>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                        مرحله ۱: رسیدهای چک منتظر بررسی و تایید کارشناس حسابداری
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        کارمند حسابداری می‌تواند مبالغ، اقلام و مشخصات چک‌ها را قبل از ارسال به مدیرعامل ویرایش نماید.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {pendingAccountingList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                در حال حاضر رسیدی در انتظار تایید حسابداری وجود ندارد.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingAccountingList.map(rec => (
                                    <div key={rec.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                                    <span>{rec.personName}</span>
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                                        #{toPersianDigits(rec.receiptNo || rec.id)}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                    پشت‌نمره: {toPersianDigits(rec.poshtNomreh || '-')} | تاریخ: {toPersianDigits(rec.docDate)}
                                                </div>
                                            </div>
                                            <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                {toPersianDigits(Number(rec.totalAmount || 0).toLocaleString('fa-IR'))} ریال
                                            </span>
                                        </div>

                                        <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                            {rec.description || `${toPersianDigits(rec.cheques?.length || 1)} فقره چک`}
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDetailReceipt(rec)}
                                                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>مشاهده جزئیات</span>
                                            </button>

                                            {isFinancialOrAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => setReviewingReceipt(rec)}
                                                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    <span>ویرایش و تایید حسابداری</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 2. CEO Pending Items */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs font-mono">
                                    {toPersianDigits(pendingCeoList.length)}
                                </span>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                        مرحله ۲: رسیدهای چک تایید حسابداری شده و منتظر تایید مدیرعامل و ثبت در سایان
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        پس از تایید مدیرعامل، سند بلافاصله در دیتابیس ERP سایان بدون خطا ثبت و بایگانی می‌گردد.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {pendingCeoList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                در حال حاضر رسیدی در انتظار تایید مدیرعامل وجود ندارد.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingCeoList.map(rec => {
                                    const hasError = !!rec.sayanError;
                                    return (
                                        <div 
                                            key={rec.id} 
                                            className={`p-4 rounded-2xl border transition-all space-y-3 hover:shadow-md ${
                                                hasError 
                                                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800' 
                                                    : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                                                        <span>{rec.personName}</span>
                                                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                                            hasError 
                                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300' 
                                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                        }`}>
                                                            {hasError ? 'خطای ثبت سایان' : 'تایید حسابداری شده'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                                        پشت‌نمره: {toPersianDigits(rec.poshtNomreh || '-')} | رسید: #{toPersianDigits(rec.receiptNo || rec.id)}
                                                    </div>
                                                </div>
                                                <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                    {toPersianDigits(Number(rec.totalAmount || 0).toLocaleString('fa-IR'))} ریال
                                                </span>
                                            </div>

                                            {hasError && (
                                                <div className="text-[11px] text-rose-800 dark:text-rose-300 bg-rose-100/50 dark:bg-rose-900/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                                                    <div className="font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                                        <span>خطای بازگشتی از پایگاه‌داده ERP سایان:</span>
                                                    </div>
                                                    <p className="font-mono leading-relaxed break-all text-right select-all">{rec.sayanError}</p>
                                                </div>
                                            )}

                                            {rec.accountingReview?.note && (
                                                <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/40 p-2 rounded-xl">
                                                    <b>تاییدیه حسابداری:</b> {rec.accountingReview.note}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedDetailReceipt(rec)}
                                                    className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>مشاهده چک‌ها</span>
                                                </button>

                                                <div className="flex items-center gap-1.5">
                                                    {/* Delete Draft Option if failed or pending */}
                                                    {isFinancialOrAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteReceipt(rec.id)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold"
                                                            title="حذف کامل این رسید پیش‌نویس"
                                                        >
                                                            حذف
                                                        </button>
                                                    )}

                                                    {/* Edit option for financial/admin to fix the fields */}
                                                    {isFinancialOrAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setReviewingReceipt(rec)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-bold"
                                                            title="اصلاح مشخصات یا مبالغ چک جهت رفع خطا"
                                                        >
                                                            اصلاح و ویرایش
                                                        </button>
                                                    )}

                                                    {isCeoOrAdmin && (
                                                        <>
                                                            {!hasError && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReject(rec.id)}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100"
                                                                >
                                                                    عدم تایید
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApproveByCeo(rec.id)}
                                                                disabled={actionLoading === rec.id}
                                                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20"
                                                            >
                                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {actionLoading === rec.id 
                                                                        ? 'در حال ارسال...' 
                                                                        : hasError ? 'تلاش مجدد ثبت سایان' : 'تایید و ثبت سایان'}
                                                                </span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sub-tab 3: ARCHIVE & REAL SAYAN LIVE INSPECTOR */}
            {activeSubTab === 'ARCHIVE' && (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <div className="relative w-full sm:w-80">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="جستجو در طرف حساب، شماره چک، سند، پشت نمره..."
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs outline-none focus:border-emerald-500"
                            />
                            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs font-bold">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl transition-colors ${
                                    statusFilter === 'ALL'
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                }`}
                            >
                                همه ({toPersianDigits(receiptsList.length)})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('REGISTERED_IN_SAYAN')}
                                className={`px-3 py-1.5 rounded-xl transition-colors ${
                                    statusFilter === 'REGISTERED_IN_SAYAN'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                }`}
                            >
                                ثبت شده در سایان
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('PENDING_CEO')}
                                className={`px-3 py-1.5 rounded-xl transition-colors ${
                                    statusFilter === 'PENDING_CEO'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                }`}
                            >
                                منتظر تایید مدیرعامل
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('PENDING_ACCOUNTING')}
                                className={`px-3 py-1.5 rounded-xl transition-colors ${
                                    statusFilter === 'PENDING_ACCOUNTING'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                                }`}
                            >
                                منتظر تایید حسابداری
                            </button>

                            <button
                                type="button"
                                onClick={() => fetchReceipts(false)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600"
                                title="بروزرسانی لیست"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingReceipts ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Archive Table */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-3 py-3">شماره رسید</th>
                                    <th className="px-3 py-3">پشت‌نمره</th>
                                    <th className="px-3 py-3">طرف حساب (شخص)</th>
                                    <th className="px-3 py-3">مبلغ کل (ریال)</th>
                                    <th className="px-3 py-3">تعداد چک</th>
                                    <th className="px-3 py-3">سند / بایگانی سایان</th>
                                    <th className="px-3 py-3">وضعیت فرآیند</th>
                                    <th className="px-3 py-3 text-center">عملیات و استعلام</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {archiveList.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                        <td className="px-3 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                            #{toPersianDigits(r.receiptNo || r.id)}
                                        </td>
                                        <td className="px-3 py-3 font-mono font-bold text-amber-600">
                                            {toPersianDigits(r.poshtNomreh || '-')}
                                        </td>
                                        <td className="px-3 py-3 font-bold text-slate-800 dark:text-slate-200">
                                            {r.personName}
                                        </td>
                                        <td className="px-3 py-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            {toPersianDigits(Number(r.totalAmount || 0).toLocaleString('fa-IR'))}
                                        </td>
                                        <td className="px-3 py-3 font-mono text-slate-500">
                                            {toPersianDigits(r.cheques?.length || 1)} برگ
                                        </td>
                                        <td className="px-3 py-3 font-mono">
                                            {r.archiveCode ? (
                                                <div className="flex items-center gap-1 text-purple-600 font-bold">
                                                    <span>سند: {toPersianDigits(r.docNo || '-')}</span>
                                                    <span className="text-[10px] text-slate-400">({toPersianDigits(r.archiveCode)})</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {r.status === 'REGISTERED_IN_SAYAN' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                                    ثبت شده در سایان
                                                </span>
                                            ) : r.status === 'PENDING_CEO' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                                    منتظر مدیرعامل
                                                </span>
                                            ) : r.status === 'PENDING_ACCOUNTING' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                                                    منتظر حسابداری
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                                    {r.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedDetailReceipt(r)}
                                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                    title="مشاهده جزئیات کامل رسید"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>

                                                {r.archiveCode ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setInspectingArchiveCode({ archiveCode: r.archiveCode, docNo: r.docNo })}
                                                        className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold text-[11px] border border-purple-200 dark:border-purple-800 flex items-center gap-1 hover:bg-purple-100"
                                                        title="استعلام زنده سند واقعی از جداول سایان"
                                                    >
                                                        <Layers className="w-3.5 h-3.5" />
                                                        <span>سند واقعی سایان</span>
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            {inspectingArchiveCode && (
                <RealSayanDocumentModal
                    archiveCode={inspectingArchiveCode.archiveCode}
                    docNo={inspectingArchiveCode.docNo}
                    fiscalYear={fiscalYear}
                    onClose={() => setInspectingArchiveCode(null)}
                />
            )}

            {reviewingReceipt && (
                <AccountingReviewModal
                    receipt={reviewingReceipt}
                    fiscalYear={fiscalYear}
                    onClose={() => setReviewingReceipt(null)}
                    onSaveReview={handleSaveAccountingReview}
                    actionLoading={actionLoading}
                />
            )}

            {selectedDetailReceipt && (
                <ChequeReceiptDetailModal
                    receipt={selectedDetailReceipt}
                    currentUser={currentUser}
                    onClose={() => setSelectedDetailReceipt(null)}
                    onOpenRealSayanDoc={(arch, doc) => {
                        setSelectedDetailReceipt(null);
                        setInspectingArchiveCode({ archiveCode: arch, docNo: doc });
                    }}
                    onOpenAccountingReview={(rec) => {
                        setSelectedDetailReceipt(null);
                        setReviewingReceipt(rec);
                    }}
                    onPrintA5={(rec) => {
                        setSelectedDetailReceipt(null);
                        setPrintReceipt(rec);
                        setIsPrintModalOpen(true);
                    }}
                    onApproveByCeo={handleApproveByCeo}
                    onReject={handleReject}
                    onDelete={handleDeleteReceipt}
                    actionLoading={actionLoading}
                    isFinancialOrAdmin={isFinancialOrAdmin}
                    isCeoOrAdmin={isCeoOrAdmin}
                    canDeleteReceipt={canDeleteReceipt}
                />
            )}

            {/* A5 Landscape Cheque Receipt Print & Preview Modal */}
            {isPrintModalOpen && printReceipt && (
                <A5ChequeReceiptPrintModal
                    receipt={printReceipt}
                    onClose={() => {
                        setIsPrintModalOpen(false);
                        setPrintReceipt(null);
                    }}
                />
            )}

            {/* Local Attachment Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <span>پیش‌نمایش فایل: {previewFile.fileName}</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 flex-1 overflow-y-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950/40">
                            {previewFile.fileType.startsWith('image/') ? (
                                <img
                                    src={previewFile.fileData}
                                    alt={previewFile.fileName}
                                    className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-md border border-slate-200 dark:border-slate-800"
                                />
                            ) : previewFile.fileType === 'application/pdf' ? (
                                <iframe
                                    src={previewFile.fileData}
                                    title={previewFile.fileName}
                                    className="w-full h-[55vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                                />
                            ) : (
                                <div className="text-center py-12 space-y-4">
                                    <FileText className="w-16 h-16 text-indigo-400 mx-auto animate-pulse" />
                                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                                        امکان پیش‌نمایش مستقیم این نوع فایل وجود ندارد. لطفاً آن را دانلود کنید.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/60 rounded-b-3xl">
                            <button
                                type="button"
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = previewFile.fileData;
                                    link.download = previewFile.fileName;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                            >
                                <Download className="w-4 h-4" />
                                <span>دانلود این فایل</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SayanChequeReceiptsTab;
