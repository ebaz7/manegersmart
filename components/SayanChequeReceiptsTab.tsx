import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    FileText, Plus, Trash2, CheckCircle2, AlertCircle, Clock, ShieldCheck,
    Search, RefreshCw, Eye, Download, Upload, Calendar, Building2, User,
    FileCheck, ArrowRight, ExternalLink, X, ChevronDown, Check, Sparkles,
    CreditCard, Hash, Layers, ShieldAlert, ArrowUpRight, Copy, Printer, Edit3, CornerUpLeft, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

interface ChequeItemInput {
    id: string;
    chequeNumber: string;
    amount: number | '';
    dueDate: string; // YYYY-MM-DD or Jalali string
    bankName: string;
    inNameOf: string;
    accountNo?: string;
    description?: string;
}

interface SayanPerson {
    personCode: string;
    fullName: string;
    nationalId?: string;
    mobile?: string;
}

interface ChequeReceiptRecord {
    id: string;
    receiptNo?: number | string; // شماره رسید دریافت نرم‌افزار خودمان
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
        rowSeq?: number;
        description?: string;
    }>;
    attachments?: Array<{
        name: string;
        url: string;
        type: string;
        size?: number;
    }>;
    createdBy?: {
        id: string;
        name: string;
        role: string;
    };
    accountingReview?: {
        id: string;
        name: string;
        role: string;
        note?: string;
        reviewedAt?: string;
    };
    ceoApproval?: {
        id: string;
        name: string;
        role: string;
        note?: string;
        approvedAt?: string;
    };
    rejectionReason?: {
        id: string;
        name: string;
        role: string;
        reason?: string;
        rejectedAt?: string;
    };
    createdAt?: string;
    approvedBy?: {
        id: string;
        name: string;
        role: string;
        note?: string;
    };
    approvedAt?: string;
    registeredAt?: string;
    sayanHeaderId?: string;
}

interface Props {
    currentUser?: any;
    settings?: any;
}

// Persian Numbers Helper
const toPersianDigits = (num: string | number | undefined | null): string => {
    if (num === undefined || num === null || num === '') return '';
    return String(num).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

// Convert number to Persian words
const numberToPersianWords = (num: number): string => {
    if (!num || num === 0) return 'صفر ریال';
    const letters = [
        ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'],
        ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'],
        ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
        ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
    ];
    const splitted: number[] = [];
    let n = Math.floor(num);
    while (n > 0) {
        splitted.push(n % 1000);
        n = Math.floor(n / 1000);
    }
    const units = ['', ' هزار', ' میلیون', ' میلیارد', ' تریلیون'];
    let res = '';
    for (let i = 0; i < splitted.length; i++) {
        const val = splitted[i];
        if (val === 0) continue;
        let text = '';
        const s = val % 10;
        const d = Math.floor((val % 100) / 10);
        const h = Math.floor(val / 100);

        if (h > 0) text += letters[3][h];
        if (d > 0) {
            if (text !== '') text += ' و ';
            if (d === 1) {
                text += letters[1][s];
            } else {
                text += letters[2][d];
                if (s > 0) text += ' و ' + letters[0][s];
            }
        } else if (s > 0) {
            if (text !== '') text += ' و ';
            text += letters[0][s];
        }
        res = text + units[i] + (res !== '' ? ' و ' : '') + res;
    }
    return (res.trim() || 'صفر') + ' ریال';
};

const COMMON_BANKS = [
    'ملی', 'ملت', 'صادرات', 'تجارت', 'سپه', 'سامان', 'پاسارگاد',
    'پارسیان', 'کشاورزی', 'مسکن', 'رفاه', 'آینده', 'شهر', 'سینا'
];

export const SayanChequeReceiptsTab: React.FC<Props> = ({ currentUser, settings }) => {
    // Role permissions
    const isFinancialOrAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.FINANCIAL || currentUser?.roles?.includes('financial') || currentUser?.roles?.includes('admin');
    const isCEOOrAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.CEO || currentUser?.role === 'CEO' || currentUser?.role === 'MANAGER' || currentUser?.roles?.includes('ceo') || currentUser?.roles?.includes('admin');

    const [activeView, setActiveView] = useState<'NEW_RECEIPT' | 'ARCHIVE_LIST'>('NEW_RECEIPT');
    const [fiscalYear, setFiscalYear] = useState<string>('4');

    // Metadata & Counters
    const [metaLoading, setMetaLoading] = useState(false);
    const [metaData, setMetaData] = useState<{
        nextAppReceiptNo: number;
        nextDocNo: number;
        nextArchiveCode: number;
        nextPoshtNomreh: number;
        commonBanks: string[];
    }>({
        nextAppReceiptNo: 1,
        nextDocNo: 812,
        nextArchiveCode: 1866,
        nextPoshtNomreh: 766,
        commonBanks: COMMON_BANKS
    });

    // Person Search State
    const [personQuery, setPersonQuery] = useState('');
    const [personResults, setPersonResults] = useState<SayanPerson[]>([]);
    const [isSearchingPersons, setIsSearchingPersons] = useState(false);
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);
    const [selectedPerson, setSelectedPerson] = useState<SayanPerson | null>(null);

    // Form State (New Draft)
    const [poshtNomreh, setPoshtNomreh] = useState<string>('766');
    const [receiptNote, setReceiptNote] = useState<string>('');
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

    // Attachments (PDF / Image Preview)
    const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
    const [previewFile, setPreviewFile] = useState<{ name: string; url: string; type: string } | null>(null);

    // History & Archive State
    const [history, setHistory] = useState<ChequeReceiptRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ACCOUNTING' | 'PENDING_CEO' | 'APPROVED' | 'REGISTERED_IN_SAYAN'>('ALL');

    // Action / Modal State
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [selectedDetailReceipt, setSelectedDetailReceipt] = useState<ChequeReceiptRecord | null>(null);
    const [dryRunResult, setDryRunResult] = useState<any | null>(null);

    // Edit Modal State (for Accounting Staff / Admin)
    const [editingReceipt, setEditingReceipt] = useState<ChequeReceiptRecord | null>(null);
    const [editPerson, setEditPerson] = useState<SayanPerson | null>(null);
    const [editPersonQuery, setEditPersonQuery] = useState('');
    const [editPersonResults, setEditPersonResults] = useState<SayanPerson[]>([]);
    const [editPoshtNomreh, setEditPoshtNomreh] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editCheques, setEditCheques] = useState<ChequeItemInput[]>([]);
    const [editAttachments, setEditAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
    const [accountingNote, setAccountingNote] = useState('');
    const [rejectionReasonInput, setRejectionReasonInput] = useState('');
    const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    // Show toast helper
    const showToast = (type: 'success' | 'error' | 'info', text: string) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 5000);
    };

    // Calculate total amount from new rows
    const totalAmount = useMemo(() => {
        return chequeRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    }, [chequeRows]);

    // Calculate total amount in edit modal
    const editTotalAmount = useMemo(() => {
        return editCheques.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    }, [editCheques]);

    // Fetch Meta (Next Numbers)
    const fetchMeta = async (fy: string = fiscalYear) => {
        setMetaLoading(true);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/meta?fiscalYear=${fy}`);
            const data = await res.json();
            if (data.success) {
                setMetaData({
                    nextAppReceiptNo: data.nextAppReceiptNo || 1,
                    nextDocNo: data.nextDocNo || 812,
                    nextArchiveCode: data.nextArchiveCode || 1866,
                    nextPoshtNomreh: data.nextPoshtNomreh || 766,
                    commonBanks: data.commonBanks || COMMON_BANKS
                });
                if (!poshtNomreh || poshtNomreh === '766') {
                    setPoshtNomreh(String(data.nextPoshtNomreh || 766));
                }
            }
        } catch (err: any) {
            console.error('Error fetching meta:', err);
        } finally {
            setMetaLoading(false);
        }
    };

    // Fetch History
    const fetchHistory = async (fy: string = fiscalYear) => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/sayan/cheque-receipts/history?fiscalYear=${fy}&search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.history || []);
            }
        } catch (err: any) {
            console.error('Error fetching history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchMeta(fiscalYear);
        fetchHistory(fiscalYear);
    }, [fiscalYear]);

    // Debounced Person Search for New Receipt
    useEffect(() => {
        if (!personQuery.trim()) {
            setPersonResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingPersons(true);
            try {
                const res = await fetch(`/api/sayan/cheque-receipts/persons?q=${encodeURIComponent(personQuery.trim())}&limit=20`);
                const data = await res.json();
                if (data.success) {
                    setPersonResults(data.persons || []);
                    setShowPersonDropdown(true);
                }
            } catch (err) {
                console.error('Error searching persons:', err);
            } finally {
                setIsSearchingPersons(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [personQuery]);

    // Debounced Person Search for Edit Modal
    useEffect(() => {
        if (!editPersonQuery.trim()) {
            setEditPersonResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/sayan/cheque-receipts/persons?q=${encodeURIComponent(editPersonQuery.trim())}&limit=20`);
                const data = await res.json();
                if (data.success) {
                    setEditPersonResults(data.persons || []);
                }
            } catch (err) {
                console.error('Error searching persons in edit:', err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [editPersonQuery]);

    // Add new cheque row
    const handleAddRow = () => {
        const lastRow = chequeRows[chequeRows.length - 1];
        setChequeRows(prev => [
            ...prev,
            {
                id: String(Date.now()),
                chequeNumber: '',
                amount: '',
                dueDate: lastRow ? lastRow.dueDate : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                bankName: lastRow ? lastRow.bankName : 'سامان',
                inNameOf: selectedPerson ? selectedPerson.fullName : '',
                accountNo: '',
                description: ''
            }
        ]);
    };

    // Remove cheque row
    const handleRemoveRow = (index: number) => {
        if (chequeRows.length <= 1) {
            showToast('info', 'رسید باید حداقل شامل یک ردیف چک باشد.');
            return;
        }
        setChequeRows(prev => prev.filter((_, i) => i !== index));
    };

    // Update row field
    const handleUpdateRow = (index: number, field: keyof ChequeItemInput, value: any) => {
        setChequeRows(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    // Handle File Upload for PDF / Image Cheques (Preview & Reference)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles: Array<{ name: string; url: string; type: string; size: number }> = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const objectUrl = URL.createObjectURL(file);
            newFiles.push({
                name: file.name,
                url: objectUrl,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
                size: file.size
            });
        }
        setAttachments(prev => [...prev, ...newFiles]);
        showToast('success', `${files.length} فایل پیوست چک بارگذاری شد.`);
    };

    // Dry-Run Validation
    const handleDryRun = async () => {
        if (!selectedPerson) {
            showToast('error', 'لطفاً ابتدا شخص طرف حساب را مشخص و انتخاب فرمایید.');
            return;
        }
        setActionLoading('dry-run');
        try {
            const payload = {
                fiscalYear,
                personCode: selectedPerson.personCode,
                personName: selectedPerson.fullName,
                poshtNomreh,
                description: receiptNote,
                cheques: chequeRows
            };
            const res = await fetch('/api/sayan/cheque-receipts/dry-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setDryRunResult(data.validation);
                if (data.validation.isValid) {
                    showToast('success', 'ساختار رسید چک و اتصال به جداول سایان ۱۰۰٪ معتبر است.');
                } else {
                    showToast('error', data.validation.errors.join(' | '));
                }
            } else {
                showToast('error', data.error || 'خطا در اعتبارسنجی رسید');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Save as Draft / Submit for Stage 1 (Accounting) or Stage 2 (CEO)
    const handleSubmitDraft = async (submitDirectlyToCEO: boolean = false) => {
        if (!selectedPerson) {
            showToast('error', 'لطفاً نام یا کد شخص طرف حساب را انتخاب فرمایید.');
            return;
        }
        if (totalAmount <= 0) {
            showToast('error', 'مبلغ چک‌ها نمی‌تواند صفر یا خالی باشد.');
            return;
        }
        const hasEmptyChequeNo = chequeRows.some(r => !r.chequeNumber.trim());
        if (hasEmptyChequeNo) {
            showToast('error', 'شماره سریال چک در تمامی ردیف‌ها الزامی است.');
            return;
        }

        setActionLoading('submit');
        try {
            const initialStatus = submitDirectlyToCEO ? 'PENDING_CEO' : 'PENDING_ACCOUNTING';
            const receiptPayload = {
                receiptNo: metaData.nextAppReceiptNo,
                fiscalYear,
                docNo: metaData.nextDocNo,
                archiveCode: metaData.nextArchiveCode,
                poshtNomreh: poshtNomreh.trim() || String(metaData.nextPoshtNomreh),
                personCode: selectedPerson.personCode,
                personName: selectedPerson.fullName,
                description: receiptNote,
                cheques: chequeRows,
                attachments,
                status: initialStatus
            };

            const res = await fetch('/api/sayan/cheque-receipts/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receipt: receiptPayload, currentUser })
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', `رسید دریافت چک شماره #${data.receipt?.receiptNo || metaData.nextAppReceiptNo} با موفقیت ثبت شد و در مرحله ${submitDirectlyToCEO ? 'تایید مدیرعامل' : 'بررسی حسابداری'} قرار گرفت.`);
                fetchHistory();
                fetchMeta();
                // Reset form
                setReceiptNote('');
                setChequeRows([{
                    id: '1',
                    chequeNumber: '',
                    amount: '',
                    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    bankName: 'سامان',
                    inNameOf: '',
                    accountNo: '',
                    description: ''
                }]);
                setSelectedPerson(null);
                setPersonQuery('');
                setAttachments([]);
                setActiveView('ARCHIVE_LIST');
            } else {
                showToast('error', data.error || 'خطا در ذخیره رسید');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Open Edit Modal for Accounting Staff
    const handleOpenEditModal = (receipt: ChequeReceiptRecord) => {
        setEditingReceipt(receipt);
        setEditPerson({
            personCode: receipt.personCode,
            fullName: receipt.personName
        });
        setEditPersonQuery(receipt.personName);
        setEditPoshtNomreh(receipt.poshtNomreh || '');
        setEditDescription(receipt.description || '');
        setEditCheques(
            (receipt.cheques || []).map((ch, idx) => ({
                id: ch.chequeId || ch.rowId || String(idx + 1),
                chequeNumber: ch.chequeNumber,
                amount: ch.amount,
                dueDate: ch.dueDate ? ch.dueDate.slice(0, 10) : '',
                bankName: ch.bankName,
                inNameOf: ch.inNameOf || receipt.personName,
                accountNo: '',
                description: ch.description || ''
            }))
        );
        setEditAttachments(receipt.attachments || []);
        setAccountingNote(receipt.accountingReview?.note || '');
    };

    // Save Changes and/or Approve by Accounting Staff (Stage 1)
    const handleSaveAccountingReview = async (shouldApproveToCEO: boolean = true) => {
        if (!editingReceipt) return;
        if (!editPerson) {
            showToast('error', 'طرف حساب نباید خالی باشد.');
            return;
        }
        if (editTotalAmount <= 0) {
            showToast('error', 'مبلغ چک‌ها نامعتبر است.');
            return;
        }

        setActionLoading('accounting_review');
        try {
            const updatePayload = {
                id: editingReceipt.id,
                receiptNo: editingReceipt.receiptNo,
                fiscalYear: editingReceipt.fiscalYear,
                poshtNomreh: editPoshtNomreh,
                personCode: editPerson.personCode,
                personName: editPerson.fullName,
                description: editDescription,
                cheques: editCheques,
                attachments: editAttachments,
                status: shouldApproveToCEO ? 'PENDING_CEO' : 'PENDING_ACCOUNTING'
            };

            if (shouldApproveToCEO) {
                // Call stage 1 accounting approval endpoint
                const res = await fetch('/api/sayan/cheque-receipts/accounting-approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        receiptId: editingReceipt.id,
                        currentUser,
                        note: accountingNote || 'بررسی و تایید حسابداری انجام شد.',
                        updatePayload
                    })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('success', `رسید شماره #${editingReceipt.receiptNo || editingReceipt.id} توسط کارمند حسابداری تایید و به کارتابل مدیرعامل ارسال گردید.`);
                    setEditingReceipt(null);
                    fetchHistory();
                } else {
                    showToast('error', data.error || 'خطا در ثبت تایید حسابداری');
                }
            } else {
                // Just save draft changes
                const res = await fetch('/api/sayan/cheque-receipts/draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ receipt: updatePayload, currentUser })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('success', 'تغییرات رسید با موفقیت در سیستم ذخیره شد.');
                    setEditingReceipt(null);
                    fetchHistory();
                } else {
                    showToast('error', data.error || 'خطا در ذخیره ویرایش');
                }
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // CEO Approval (Stage 2) & Direct Sayan Registration
    const handleCEOApprove = async (receiptId: string, registerNow: boolean = false) => {
        setActionLoading(`approve_${receiptId}`);
        try {
            const res = await fetch('/api/sayan/cheque-receipts/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiptId,
                    currentUser,
                    registerImmediately: registerNow,
                    note: 'تایید نهایی توسط مدیرعامل'
                })
            });
            const data = await res.json();
            if (data.success) {
                if (registerNow && data.sayanResult?.success) {
                    showToast('success', `رسید تایید و سند شماره ${data.sayanResult.docNo} (کد بایگانی ${data.sayanResult.archiveCode}) با موفقیت در سایان ثبت و بایگانی شد.`);
                } else {
                    showToast('success', 'رسید چک توسط مدیرعامل تایید گردید و آماده ثبت در سایان است.');
                }
                fetchHistory();
                fetchMeta();
                if (selectedDetailReceipt && selectedDetailReceipt.id === receiptId) {
                    setSelectedDetailReceipt(null);
                }
            } else {
                showToast('error', data.error || 'خطا در تایید مدیرعامل');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Reject / Return Receipt for Revision
    const handleRejectReceipt = async (receiptId: string) => {
        setActionLoading(`reject_${receiptId}`);
        try {
            const res = await fetch('/api/sayan/cheque-receipts/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiptId,
                    currentUser,
                    reason: rejectionReasonInput || 'جهت بازبینی و اصلاح به حسابداری عودت داده شد.',
                    returnTo: 'ACCOUNTING'
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('info', 'رسید جهت اصلاح به کارتابل حسابداری بازگردانده شد.');
                setShowRejectionModal(null);
                setRejectionReasonInput('');
                fetchHistory();
                if (selectedDetailReceipt && selectedDetailReceipt.id === receiptId) {
                    setSelectedDetailReceipt(null);
                }
            } else {
                showToast('error', data.error || 'خطا در عودت رسید');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Register already approved receipt in Sayan
    const handleRegisterToSayan = async (receiptId: string) => {
        setActionLoading(`reg_${receiptId}`);
        try {
            const res = await fetch('/api/sayan/cheque-receipts/register-in-sayan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptId, currentUser })
            });
            const data = await res.json();
            if (data.success) {
                showToast('success', `سند رسید چک شماره ${data.docNo} و کد بایگانی ${data.archiveCode} با موفقیت در سایان ثبت و بایگانی شد.`);
                fetchHistory();
                fetchMeta();
                if (selectedDetailReceipt && selectedDetailReceipt.id === receiptId) {
                    setSelectedDetailReceipt(null);
                }
            } else {
                showToast('error', data.error || 'خطا در ثبت در سایان');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // Filtered history list
    const filteredHistory = useMemo(() => {
        return history.filter(item => {
            if (statusFilter === 'ALL') return true;
            if (statusFilter === 'PENDING_ACCOUNTING') {
                return item.status === 'PENDING_ACCOUNTING' || item.status === 'PENDING_APPROVAL' || item.status === 'REJECTED';
            }
            return item.status === statusFilter;
        });
    }, [history, statusFilter]);

    // Statistics
    const stats = useMemo(() => {
        const totalItems = history.length;
        const pendingAccounting = history.filter(h => h.status === 'PENDING_ACCOUNTING' || h.status === 'PENDING_APPROVAL' || h.status === 'REJECTED').length;
        const pendingCEO = history.filter(h => h.status === 'PENDING_CEO').length;
        const approved = history.filter(h => h.status === 'APPROVED').length;
        const registered = history.filter(h => h.status === 'REGISTERED_IN_SAYAN').length;
        const totalValue = history.reduce((sum, h) => sum + (Number(h.totalAmount) || 0), 0);
        return { totalItems, pendingAccounting, pendingCEO, approved, registered, totalValue };
    }, [history]);

    return (
        <div className="space-y-6">
            {/* TOAST NOTIFICATION */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold border backdrop-blur-md ${
                            toastMessage.type === 'success'
                                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-500/40'
                                : toastMessage.type === 'error'
                                ? 'bg-rose-900/90 text-rose-100 border-rose-500/40'
                                : 'bg-slate-900/90 text-slate-100 border-slate-700'
                        }`}
                    >
                        {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                        {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
                        {toastMessage.type === 'info' && <Sparkles className="w-5 h-5 text-amber-400" />}
                        <span>{toastMessage.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP STATS & QUICK BANNER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. App Receipt Number (Internal software numbering) */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">شماره رسید بعدی نرم‌افزار</div>
                        <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1.5 font-mono">
                            <span>#{toPersianDigits(metaData.nextAppReceiptNo)}</span>
                            <span className="text-[10px] text-slate-400 font-sans font-normal">(داخلی سیستم)</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900">
                        <FileText className="w-5 h-5" />
                    </div>
                </div>

                {/* 2. Sayan Next Document & Archive */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">سند و کد بایگانی سایان ERP</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                            <span>سند {toPersianDigits(metaData.nextDocNo)}</span>
                            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800">
                                بایگانی {toPersianDigits(metaData.nextArchiveCode)}
                            </span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900">
                        <FileCheck className="w-5 h-5" />
                    </div>
                </div>

                {/* 3. Two-Step Approval Workflow Counters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">گردش کار تایید ۲ مرحله‌ای</div>
                        <div className="text-xs font-black mt-1.5 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                حسابداری: {toPersianDigits(stats.pendingAccounting)}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                مدیرعامل: {toPersianDigits(stats.pendingCEO)}
                            </span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>

                {/* 4. Total Value */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">مجموع مبالغ چک‌های سال مالی {toPersianDigits(fiscalYear)}</div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                            {toPersianDigits(stats.totalValue.toLocaleString('fa-IR'))} <span className="text-[10px] text-slate-400">ریال</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
                        <CreditCard className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* TAB SWITCHER: NEW RECEIPT vs ARCHIVE */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveView('NEW_RECEIPT')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                            activeView === 'NEW_RECEIPT'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>فرم صدور رسید دریافت چک جدید</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveView('ARCHIVE_LIST');
                            fetchHistory();
                        }}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                            activeView === 'ARCHIVE_LIST'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>بایگانی و پیگیری گردش کار رسیدها</span>
                        {(stats.pendingAccounting > 0 || stats.pendingCEO > 0) && (
                            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                                {stats.pendingAccounting + stats.pendingCEO}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Fiscal Year Switcher */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-slate-500 dark:text-slate-400">سال مالی سایان:</span>
                        <select
                            value={fiscalYear}
                            onChange={(e) => setFiscalYear(e.target.value)}
                            className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer"
                        >
                            <option value="4">سال مالی ۴ (جاری)</option>
                            <option value="3">سال مالی ۳</option>
                            <option value="2">سال مالی ۲</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            fetchMeta();
                            fetchHistory();
                        }}
                        disabled={metaLoading || historyLoading}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                        title="بروزرسانی داده‌ها از سایان"
                    >
                        <RefreshCw className={`w-4 h-4 ${(metaLoading || historyLoading) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* VIEW 1: NEW CHEQUE RECEIPT FORM */}
            {activeView === 'NEW_RECEIPT' && (
                <div className="space-y-6">
                    {/* FORM HEADER CARD */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>مشخصات سربرگ رسید دریافت چک</span>
                                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900">
                                            رسید #{toPersianDigits(metaData.nextAppReceiptNo)}
                                        </span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        شماره رسید بر اساس سیستم داخلی ما تولید می‌شود و پس از تایید حسابداری و مدیرعامل در سایان ثبت می‌گردد.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    سند سایان: <strong className="text-blue-600 dark:text-blue-400">{metaData.nextDocNo}</strong>
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    بایگانی: <strong className="text-purple-600 dark:text-purple-400">{metaData.nextArchiveCode}</strong>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Person / Tafsili Autocomplete */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-blue-500" />
                                    <span>شخص / طرف حساب دریافت‌کننده (پرداخت‌کننده چک) *</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={personQuery}
                                        onChange={(e) => {
                                            setPersonQuery(e.target.value);
                                            if (selectedPerson && e.target.value !== selectedPerson.fullName) {
                                                setSelectedPerson(null);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (personResults.length > 0) setShowPersonDropdown(true);
                                        }}
                                        placeholder="جستجوی نام شخص یا کد تفصیلی در سایان..."
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    />
                                    {isSearchingPersons && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                {selectedPerson && (
                                    <div className="mt-1.5 flex items-center justify-between text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-900">
                                        <span>طرف حساب انتخاب شد: <strong>{selectedPerson.fullName}</strong> (کد: {selectedPerson.personCode})</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedPerson(null);
                                                setPersonQuery('');
                                            }}
                                            className="text-blue-500 hover:text-blue-700 font-bold"
                                        >
                                            تغییر
                                        </button>
                                    </div>
                                )}

                                {/* Search Dropdown */}
                                {showPersonDropdown && personResults.length > 0 && (
                                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                                        {personResults.map((p) => (
                                            <button
                                                key={p.personCode}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPerson(p);
                                                    setPersonQuery(p.fullName);
                                                    setShowPersonDropdown(false);
                                                    // Auto fill InNameOf in rows if empty
                                                    setChequeRows(prev => prev.map(r => ({
                                                        ...r,
                                                        inNameOf: r.inNameOf || p.fullName
                                                    })));
                                                }}
                                                className="w-full text-right px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between text-xs transition-colors"
                                            >
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{p.fullName}</span>
                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                                                    کد: {p.personCode}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Posht-Nomreh Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-amber-500" />
                                    <span>شماره پشت‌نمره رسید (رد/...) *</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={poshtNomreh}
                                        onChange={(e) => setPoshtNomreh(e.target.value)}
                                        placeholder="مثال: 766"
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                                        رد/
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    شماره پشت‌نمره اختصاصی به این رسید و چک‌های مندرج در آن در سایان متصل می‌شود.
                                </p>
                            </div>

                            {/* Receipt Note / Subject */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>توضیحات و بابت رسید (اختیاری)</span>
                                </label>
                                <input
                                    type="text"
                                    value={receiptNote}
                                    onChange={(e) => setReceiptNote(e.target.value)}
                                    placeholder="مثال: بابت تسویه فاکتور فروش / پیش‌دریافت سفارش..."
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* CHEQUE ROWS TABLE CARD */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <CreditCard className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                        ردیف‌های چک مندرج در رسید (جدول BUR_TBL_012 و اقلام سند)
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        شماره سریال، مبلغ، تاریخ سررسید، نام بانک و صاحب حساب
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition-all shadow-xs"
                            >
                                <Plus className="w-4 h-4" />
                                <span>افزودن ردیف چک جدید</span>
                            </button>
                        </div>

                        {/* ROWS LIST */}
                        <div className="space-y-3">
                            {chequeRows.map((row, index) => (
                                <div
                                    key={row.id}
                                    className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">
                                                {toPersianDigits(index + 1)}
                                            </span>
                                            <span>ردیف {toPersianDigits(index + 1)}</span>
                                        </span>

                                        {chequeRows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(index)}
                                                className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                title="حذف این ردیف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {/* Cheque Serial Number */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                شماره چک (سریال صیادی / فیزیکی) *
                                            </label>
                                            <input
                                                type="text"
                                                value={row.chequeNumber}
                                                onChange={(e) => handleUpdateRow(index, 'chequeNumber', e.target.value)}
                                                placeholder="مثال: 818708"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        {/* Amount */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                مبلغ چک (ریال) *
                                            </label>
                                            <input
                                                type="text"
                                                value={row.amount ? Number(row.amount).toLocaleString('en-US') : ''}
                                                onChange={(e) => {
                                                    const clean = e.target.value.replace(/,/g, '').replace(/[^0-9]/g, '');
                                                    handleUpdateRow(index, 'amount', clean ? Number(clean) : '');
                                                }}
                                                placeholder="مثال: 130,000,000"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500"
                                            />
                                            {row.amount ? (
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                    {numberToPersianWords(Number(row.amount))}
                                                </p>
                                            ) : null}
                                        </div>

                                        {/* Due Date */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                تاریخ سررسید چک *
                                            </label>
                                            <input
                                                type="date"
                                                value={row.dueDate}
                                                onChange={(e) => handleUpdateRow(index, 'dueDate', e.target.value)}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                            />
                                            {/* Quick Due Shortcuts */}
                                            <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
                                                        handleUpdateRow(index, 'dueDate', d);
                                                    }}
                                                    className="hover:text-blue-500 font-bold underline"
                                                >
                                                    ۱ ماه بعد
                                                </button>
                                                <span>•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
                                                        handleUpdateRow(index, 'dueDate', d);
                                                    }}
                                                    className="hover:text-blue-500 font-bold underline"
                                                >
                                                    ۲ ماه بعد
                                                </button>
                                                <span>•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
                                                        handleUpdateRow(index, 'dueDate', d);
                                                    }}
                                                    className="hover:text-blue-500 font-bold underline"
                                                >
                                                    ۳ ماه بعد
                                                </button>
                                            </div>
                                        </div>

                                        {/* Bank Name */}
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                                نام بانک صادرکننده *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={row.bankName}
                                                    onChange={(e) => handleUpdateRow(index, 'bankName', e.target.value)}
                                                    placeholder="مثال: سامان، صادرات..."
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                                />
                                            </div>
                                            {/* Quick Banks */}
                                            <div className="flex items-center gap-1 mt-1 overflow-x-auto text-[9px] text-slate-400 scrollbar-none">
                                                {['سامان', 'ملی', 'ملت', 'تجارت', 'صادرات', 'پاسارگاد'].map(b => (
                                                    <button
                                                        key={b}
                                                        type="button"
                                                        onClick={() => handleUpdateRow(index, 'bankName', b)}
                                                        className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                                                    >
                                                        {b}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Secondary Row: InNameOf & Account */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                صاحب چک / در وجه (پرداخت‌کننده)
                                            </label>
                                            <input
                                                type="text"
                                                value={row.inNameOf}
                                                onChange={(e) => handleUpdateRow(index, 'inNameOf', e.target.value)}
                                                placeholder={selectedPerson ? selectedPerson.fullName : 'نام درج شده روی چک'}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                                شماره حساب / شعبه / توضیحات ردیف
                                            </label>
                                            <input
                                                type="text"
                                                value={row.description || ''}
                                                onChange={(e) => handleUpdateRow(index, 'description', e.target.value)}
                                                placeholder="شعبه یا شناسه صیادی..."
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* TOTAL BAR */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-blue-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                    جمع کل مبلغ چک‌های این رسید ({toPersianDigits(chequeRows.length)} فقره):
                                </span>
                                <div className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
                                    {toPersianDigits(totalAmount.toLocaleString('fa-IR'))} <span className="text-xs font-medium">ریال</span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    {numberToPersianWords(totalAmount)}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-xs"
                            >
                                <Plus className="w-4 h-4 text-emerald-500" />
                                <span>افزودن چک دیگر به این رسید</span>
                            </button>
                        </div>
                    </div>

                    {/* ATTACHMENTS & PDF PREVIEW CARD */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                        پیوست فایل PDF یا تصویر چک‌ها (پیش‌نمایش زنده در نرم‌افزار)
                                    </h3>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        مشاهده و بررسی سریع لاشه و رسید چک بدون ذخیره بیهوده حجم بر روی دیتابیس سایان
                                    </p>
                                </div>
                            </div>

                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    multiple
                                    accept="application/pdf,image/*"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 border border-purple-200 dark:border-purple-800 transition-all shadow-xs"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>انتخاب فایل PDF / تصاویر چک</span>
                                </button>
                            </div>
                        </div>

                        {/* Attachments List */}
                        {attachments.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {attachments.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                                    >
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                                {file.type === 'pdf' ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                                                    {file.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {file.type === 'pdf' ? 'سند PDF' : 'تصویر'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFile(file)}
                                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                title="پیش‌نمایش فایل"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                title="حذف پیوست"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    فایلی پیوست نشده است. می‌توانید فایل PDF اسکن چک‌ها یا تصاویر رسید را اینجا ضمیمه نمایید.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ACTIONS FOOTER */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                        <button
                            type="button"
                            onClick={handleDryRun}
                            disabled={actionLoading === 'dry-run'}
                            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all"
                        >
                            <ShieldCheck className="w-4 h-4 text-indigo-500" />
                            <span>تست آزمایشی و اعتبارسنجی ساختار (Dry Run)</span>
                        </button>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleSubmitDraft(false)}
                                disabled={actionLoading === 'submit'}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
                            >
                                <Check className="w-4 h-4 text-white" />
                                <span>ثبت رسید و ارسال به کارتابل حسابداری (مرحله ۱)</span>
                            </button>

                            {isCEOOrAdmin && (
                                <button
                                    type="button"
                                    onClick={() => handleSubmitDraft(true)}
                                    disabled={actionLoading === 'submit'}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-500/20"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    <span>ثبت و ارسال مستقیم به تایید مدیرعامل (مرحله ۲)</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 2: ARCHIVE AND FILTER LIST */}
            {activeView === 'ARCHIVE_LIST' && (
                <div className="space-y-4">
                    {/* Filters Bar */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="relative w-full">
                                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') fetchHistory();
                                    }}
                                    placeholder="جستجوی شماره رسید (#...)، سند، پشت‌نمره، شخص یا شماره چک..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchHistory()}
                                className="px-3 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
                            >
                                جستجو
                            </button>
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 text-xs font-bold overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                                    statusFilter === 'ALL'
                                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                همه ({history.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('PENDING_ACCOUNTING')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                                    statusFilter === 'PENDING_ACCOUNTING'
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                <span>بررسی حسابداری</span>
                                {stats.pendingAccounting > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px]">
                                        {stats.pendingAccounting}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('PENDING_CEO')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                                    statusFilter === 'PENDING_CEO'
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                <span>تایید مدیرعامل</span>
                                {stats.pendingCEO > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[9px]">
                                        {stats.pendingCEO}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('APPROVED')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                                    statusFilter === 'APPROVED'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                آماده ثبت در سایان ({stats.approved})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('REGISTERED_IN_SAYAN')}
                                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                                    statusFilter === 'REGISTERED_IN_SAYAN'
                                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                ثبت شده در سایان ({stats.registered})
                            </button>
                        </div>
                    </div>

                    {/* HISTORY TABLE */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">شماره رسید (سیستم ما)</th>
                                        <th className="px-4 py-3">سند / بایگانی سایان</th>
                                        <th className="px-4 py-3">شماره پشت‌نمره</th>
                                        <th className="px-4 py-3">طرف حساب (شخص)</th>
                                        <th className="px-4 py-3">تعداد چک</th>
                                        <th className="px-4 py-3">جمع کل مبلغ (ریال)</th>
                                        <th className="px-4 py-3">وضعیت گردش کار</th>
                                        <th className="px-4 py-3 text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredHistory.length > 0 ? (
                                        filteredHistory.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                                            >
                                                {/* App Receipt Number */}
                                                <td className="px-4 py-3.5">
                                                    <div className="font-mono font-black text-blue-600 dark:text-blue-400 text-sm">
                                                        #{toPersianDigits(item.receiptNo || item.id.replace('RCPT_', '').slice(0, 5))}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {item.docDate ? new Date(item.docDate).toLocaleDateString('fa-IR') : '-'}
                                                    </div>
                                                </td>

                                                {/* Sayan Doc No & Archive */}
                                                <td className="px-4 py-3.5">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        سند: {toPersianDigits(item.docNo || '-')}
                                                    </div>
                                                    <div className="text-[10px] text-purple-600 dark:text-purple-400">
                                                        بایگانی: {toPersianDigits(item.archiveCode || '-')}
                                                    </div>
                                                </td>

                                                {/* Posht-Nomreh */}
                                                <td className="px-4 py-3.5">
                                                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                                                        رد/{toPersianDigits(item.poshtNomreh || '-')}
                                                    </span>
                                                </td>

                                                {/* Person */}
                                                <td className="px-4 py-3.5">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        {item.personName || `کد ${item.personCode}`}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        کد شخص: {toPersianDigits(item.personCode)}
                                                    </div>
                                                </td>

                                                {/* Cheques Count */}
                                                <td className="px-4 py-3.5">
                                                    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                                                        {toPersianDigits(item.cheques?.length || 1)} فقره
                                                    </span>
                                                </td>

                                                {/* Total Amount */}
                                                <td className="px-4 py-3.5">
                                                    <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                                        {toPersianDigits(Number(item.totalAmount || 0).toLocaleString('fa-IR'))}
                                                    </div>
                                                </td>

                                                {/* Status with step indicators */}
                                                <td className="px-4 py-3.5">
                                                    {item.status === 'REGISTERED_IN_SAYAN' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-max">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>ثبت قطعی در سایان</span>
                                                        </span>
                                                    )}
                                                    {item.status === 'APPROVED' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1 w-max">
                                                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                                            <span>تایید مدیرعامل (آماده ثبت)</span>
                                                        </span>
                                                    )}
                                                    {item.status === 'PENDING_CEO' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 flex items-center gap-1 w-max">
                                                            <Clock className="w-3 h-3 text-blue-600" />
                                                            <span>در انتظار تایید مدیرعامل</span>
                                                        </span>
                                                    )}
                                                    {(item.status === 'PENDING_ACCOUNTING' || item.status === 'PENDING_APPROVAL') && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 w-max">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>در انتظار بررسی حسابداری</span>
                                                        </span>
                                                    )}
                                                    {item.status === 'REJECTED' && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 w-max">
                                                            <CornerUpLeft className="w-3 h-3 text-rose-600" />
                                                            <span>جهت اصلاح عودت شد</span>
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {/* View Details */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDetailReceipt(item)}
                                                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                                                            title="مشاهده جزئیات و پیش‌نمایش"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>

                                                        {/* Edit by Accounting Staff */}
                                                        {item.status !== 'REGISTERED_IN_SAYAN' && isFinancialOrAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditModal(item)}
                                                                className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
                                                                title="ویرایش اقلام چک و بررسی حسابداری"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {/* Step 1: Accounting Staff Approval Button */}
                                                        {(item.status === 'PENDING_ACCOUNTING' || item.status === 'PENDING_APPROVAL' || item.status === 'REJECTED') && isFinancialOrAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditModal(item)}
                                                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all"
                                                                title="بررسی، ویرایش و تایید حسابداری"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                <span>تایید حسابداری</span>
                                                            </button>
                                                        )}

                                                        {/* Step 2: CEO Approval Buttons */}
                                                        {item.status === 'PENDING_CEO' && isCEOOrAdmin && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCEOApprove(item.id, true)}
                                                                disabled={actionLoading === `approve_${item.id}`}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-xs"
                                                                title="تایید مدیرعامل و ثبت فوری در سایان"
                                                            >
                                                                <Sparkles className="w-3 h-3" />
                                                                <span>تایید و ثبت سایان</span>
                                                            </button>
                                                        )}

                                                        {/* Register to Sayan Action */}
                                                        {item.status === 'APPROVED' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRegisterToSayan(item.id)}
                                                                disabled={actionLoading === `reg_${item.id}`}
                                                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 transition-all"
                                                                title="ثبت مستقیم در دیتابیس سایان"
                                                            >
                                                                <FileCheck className="w-3 h-3" />
                                                                <span>ثبت سایان</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400">
                                                {historyLoading ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                                                        <span>در حال بارگذاری اطلاعات از پایگاه‌داده...</span>
                                                    </div>
                                                ) : (
                                                    <span>هیچ رسیدی با مشخصات فیلتر شده یافت نشد.</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT & ACCOUNTING REVIEW MODAL */}
            {editingReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>ویرایش و بررسی حسابداری رسید دریافت چک</span>
                                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200">
                                            #{toPersianDigits(editingReceipt.receiptNo || editingReceipt.id)}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        کارمند حسابداری امکان ویرایش مبالغ، اقلام چک، طرف حساب و تایید جهت ارسال به مدیرعامل را دارد.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingReceipt(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Person, PoshtNomreh & Description in Edit */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                            {/* Person autocomplete in Edit */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    طرف حساب (شخص) *
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
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                                    placeholder="جستجو و انتخاب شخص..."
                                />
                                {editPerson && (
                                    <div className="text-[10px] text-emerald-600 mt-1 font-bold">
                                        انتخاب شده: {editPerson.fullName} (کد {editPerson.personCode})
                                    </div>
                                )}
                                {editPersonResults.length > 0 && !editPerson && (
                                    <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-40 overflow-y-auto">
                                        {editPersonResults.map(p => (
                                            <button
                                                key={p.personCode}
                                                type="button"
                                                onClick={() => {
                                                    setEditPerson(p);
                                                    setEditPersonQuery(p.fullName);
                                                    setEditPersonResults([]);
                                                }}
                                                className="w-full text-right px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex justify-between"
                                            >
                                                <span>{p.fullName}</span>
                                                <span className="text-slate-400">کد: {p.personCode}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Posht Nomreh */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    شماره پشت‌نمره *
                                </label>
                                <input
                                    type="text"
                                    value={editPoshtNomreh}
                                    onChange={(e) => setEditPoshtNomreh(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    توضیحات و بابت
                                </label>
                                <input
                                    type="text"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        {/* Cheques Rows in Edit */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-emerald-500" />
                                    <span>ردیف‌های چک مندرج در رسید ({toPersianDigits(editCheques.length)} فقره)</span>
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
                                    <span>افزودن چک</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                {editCheques.map((ch, idx) => (
                                    <div key={ch.id || idx} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-xs">
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
                                                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 font-mono font-bold"
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
                                                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 font-mono font-black text-emerald-600"
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
                                                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1 font-mono"
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
                                                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-lg px-2 py-1"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 justify-end pt-3 sm:pt-0">
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

                            {/* Total in Edit */}
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    مجموع مبلغ رسید:
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
                                placeholder="مثال: اقلام چک و طرف حساب با فاکتور فروش مطابقت داده شد و تایید گردید."
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-amber-500"
                            />
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setEditingReceipt(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                            >
                                انصراف
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveAccountingReview(false)}
                                    disabled={actionLoading === 'accounting_review'}
                                    className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs"
                                >
                                    ذخیره ویرایش‌ها (پیش‌نویس)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveAccountingReview(true)}
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
            )}

            {/* DETAIL & WORKFLOW MODAL */}
            {selectedDetailReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>رسید دریافت چک #{toPersianDigits(selectedDetailReceipt.receiptNo || selectedDetailReceipt.id)}</span>
                                        {selectedDetailReceipt.docNo && (
                                            <span className="text-xs text-slate-500 font-normal">
                                                (سند سایان {toPersianDigits(selectedDetailReceipt.docNo)})
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        کد بایگانی {toPersianDigits(selectedDetailReceipt.archiveCode)} | سال مالی {selectedDetailReceipt.fiscalYear}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDetailReceipt(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 4-Step Approval Stepper Progress */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">
                                وضعیت مراحل ثبت، تایید و بایگانی در سایان:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                {/* Step 1: Draft Creation */}
                                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs">
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>۱. ثبت رسید</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {selectedDetailReceipt.createdBy?.name || 'صادرکننده'}
                                    </div>
                                </div>

                                {/* Step 2: Accounting Review */}
                                <div className={`p-2.5 rounded-xl border text-xs ${
                                    selectedDetailReceipt.accountingReview || selectedDetailReceipt.status === 'APPROVED' || selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                                }`}>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {selectedDetailReceipt.accountingReview ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        <span>۲. تایید حسابداری</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 truncate">
                                        {selectedDetailReceipt.accountingReview ? selectedDetailReceipt.accountingReview.name : 'در انتظار بررسی'}
                                    </div>
                                </div>

                                {/* Step 3: CEO Approval */}
                                <div className={`p-2.5 rounded-xl border text-xs ${
                                    selectedDetailReceipt.ceoApproval || selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {selectedDetailReceipt.ceoApproval || selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                        <span>۳. تایید مدیرعامل</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 truncate">
                                        {selectedDetailReceipt.ceoApproval ? selectedDetailReceipt.ceoApproval.name : 'در انتظار تایید'}
                                    </div>
                                </div>

                                {/* Step 4: Sayan DB Registration */}
                                <div className={`p-2.5 rounded-xl border text-xs ${
                                    selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}>
                                    <div className="flex items-center gap-1.5 font-bold">
                                        {selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN' ? <CheckCircle2 className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
                                        <span>۴. بایگانی سایان</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {selectedDetailReceipt.status === 'REGISTERED_IN_SAYAN' ? 'ثبت قطعی شد' : 'منتظر تاییدات'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            <div>
                                <div className="text-[11px] text-slate-400">شخص طرف حساب</div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                                    {selectedDetailReceipt.personName}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-400">شماره پشت‌نمره</div>
                                <div className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                    رد/{selectedDetailReceipt.poshtNomreh}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-400">جمع کل مبلغ</div>
                                <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    {Number(selectedDetailReceipt.totalAmount).toLocaleString('fa-IR')} ریال
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] text-slate-400">شماره رسید نرم‌افزار</div>
                                <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                                    #{selectedDetailReceipt.receiptNo || selectedDetailReceipt.id}
                                </div>
                            </div>
                        </div>

                        {/* Cheques Items List */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                چک‌های ثبت شده در این رسید ({selectedDetailReceipt.cheques?.length || 0} فقره)
                            </h4>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                {selectedDetailReceipt.cheques?.map((ch, idx) => (
                                    <div key={idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900">
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-400">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    <span>بانک {ch.bankName || 'نامشخص'}</span>
                                                    <span className="font-mono text-blue-600 dark:text-blue-400">شماره: {ch.chequeNumber}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                    سررسید: {ch.dueDate ? ch.dueDate.slice(0, 10) : '-'} | صاحب چک: {ch.inNameOf || selectedDetailReceipt.personName}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                            {Number(ch.amount).toLocaleString('fa-IR')} ریال
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Attachments Section in Detail Modal */}
                        {selectedDetailReceipt.attachments && selectedDetailReceipt.attachments.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-purple-500" />
                                    <span>فایل‌های پیوست چک</span>
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {selectedDetailReceipt.attachments.map((att, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setPreviewFile(att)}
                                            className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5 hover:bg-purple-100"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>{att.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSelectedDetailReceipt(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                            >
                                بستن
                            </button>

                            <div className="flex items-center gap-2">
                                {/* Accounting Review trigger */}
                                {(selectedDetailReceipt.status === 'PENDING_ACCOUNTING' || selectedDetailReceipt.status === 'PENDING_APPROVAL' || selectedDetailReceipt.status === 'REJECTED') && isFinancialOrAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const r = selectedDetailReceipt;
                                            setSelectedDetailReceipt(null);
                                            handleOpenEditModal(r);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        <span>ویرایش و تایید حسابداری</span>
                                    </button>
                                )}

                                {/* CEO Approval trigger */}
                                {selectedDetailReceipt.status === 'PENDING_CEO' && isCEOOrAdmin && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowRejectionModal(selectedDetailReceipt.id);
                                            }}
                                            className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 text-xs font-bold flex items-center gap-1"
                                        >
                                            <CornerUpLeft className="w-3.5 h-3.5" />
                                            <span>عودت به حسابداری</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCEOApprove(selectedDetailReceipt.id, true)}
                                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span>تایید مدیرعامل و ثبت فوری در سایان</span>
                                        </button>
                                    </>
                                )}

                                {/* Sayan Registration for already approved */}
                                {selectedDetailReceipt.status === 'APPROVED' && (
                                    <button
                                        type="button"
                                        onClick={() => handleRegisterToSayan(selectedDetailReceipt.id)}
                                        className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                                    >
                                        <FileCheck className="w-4 h-4" />
                                        <span>ثبت در دیتابیس سایان</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECTION / RETURN MODAL */}
            {showRejectionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4 shadow-2xl">
                        <h4 className="text-sm font-black text-rose-600 flex items-center gap-2">
                            <CornerUpLeft className="w-4 h-4" />
                            <span>عودت رسید به حسابداری جهت اصلاح</span>
                        </h4>
                        <p className="text-xs text-slate-500">
                            لطفاً دلیل عودت یا موارد نیازمند اصلاح را جهت اطلاع کارشناس حسابداری درج نمایید:
                        </p>
                        <textarea
                            value={rejectionReasonInput}
                            onChange={(e) => setRejectionReasonInput(e.target.value)}
                            rows={3}
                            placeholder="مثال: مبلغ چک ردیف ۱ با مبلغ فاکتور تطابق ندارد..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:border-rose-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowRejectionModal(null)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold"
                            >
                                انصراف
                            </button>
                            <button
                                type="button"
                                onClick={() => handleRejectReceipt(showRejectionModal)}
                                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700"
                            >
                                ثبت عودت
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF / IMAGE PREVIEW MODAL */}
            {previewFile && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-500" />
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    پیش‌نمایش: {previewFile.name}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewFile(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-auto flex items-center justify-center">
                            {previewFile.type === 'pdf' ? (
                                <iframe
                                    src={previewFile.url}
                                    title={previewFile.name}
                                    className="w-full h-full rounded-xl border border-slate-300 dark:border-slate-800"
                                />
                            ) : (
                                <img
                                    src={previewFile.url}
                                    alt={previewFile.name}
                                    className="max-w-full max-h-full object-contain rounded-xl"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SayanChequeReceiptsTab;
