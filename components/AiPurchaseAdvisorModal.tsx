import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Sparkles, 
    Search, 
    Globe, 
    ExternalLink, 
    Phone, 
    MapPin, 
    Tag, 
    CheckCircle2, 
    ShieldAlert, 
    Copy, 
    Check, 
    MessageSquare, 
    Share2, 
    FileText, 
    X, 
    Loader2, 
    Building2, 
    ArrowRight,
    Send,
    PlusCircle,
    ShoppingBag,
    HelpCircle,
    ChevronDown,
    Zap,
    Info
} from 'lucide-react';
import { searchSuppliersWithAi, sendRfqMessage, AiPurchaseSearchResult, SupplierResult } from '../services/purchaseAiService';
import { PurchaseRequest, PurchaseItem, Part } from '../types';

interface AiPurchaseAdvisorModalProps {
    request: PurchaseRequest;
    parts?: Part[];
    onClose: () => void;
    onApplyProforma?: (proformaData: { vendorName: string; vendorPhone: string; unitPrice?: number; description?: string }) => void;
}

export const AiPurchaseAdvisorModal: React.FC<AiPurchaseAdvisorModalProps> = ({
    request,
    parts = [],
    onClose,
    onApplyProforma
}) => {
    // Select initial item (single item or first item of multi-item request)
    const itemsList: (PurchaseItem | any)[] = (request.items && request.items.length > 0) 
        ? request.items 
        : [{ 
            id: '1', 
            itemName: request.itemName, 
            quantity: request.quantity, 
            unit: request.unit, 
            specifications: request.specifications,
            itemCode: (request as any).itemCode || ''
        }];

    const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
    const selectedItem = itemsList[selectedItemIndex] || itemsList[0];

    // Find linked part from coding catalog if available
    const matchedPart = parts.find(p => 
        (selectedItem.partId && p.id === selectedItem.partId) ||
        (selectedItem.itemCode && p.code === selectedItem.itemCode) ||
        (p.name && p.name.trim().toLowerCase() === selectedItem.itemName?.trim().toLowerCase())
    );

    // Optional user-specified additional descriptions
    const [additionalNotes, setAdditionalNotes] = useState<string>('');
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [searchResult, setSearchResult] = useState<AiPurchaseSearchResult | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    // RFQ and messaging state
    const [copiedRfq, setCopiedRfq] = useState<boolean>(false);
    const [activeRfqText, setActiveRfqText] = useState<string>('');
    
    // Quick send modal
    const [sendingSupplier, setSendingSupplier] = useState<SupplierResult | null>(null);
    const [sendPlatform, setSendPlatform] = useState<'whatsapp' | 'bale' | 'telegram'>('whatsapp');
    const [targetPhone, setTargetPhone] = useState<string>('');
    const [isSendingMsg, setIsSendingMsg] = useState<boolean>(false);
    const [sendFeedback, setSendFeedback] = useState<{ success: boolean; msg: string; directUrl?: string } | null>(null);

    // Quick suggestion chips
    const quickChips = [
        'برندهای معتبر ایرانی و خارجی',
        'موجودی فوری در انبار جهت تحویل سریع',
        'همراه با برگه آنالیز، سرتیفیکیت و ضمانت اصالت',
        'پایین‌ترین قیمت عمده و رقابتی بازار',
        'تامین‌کنندگان بازار تهران (شادآباد / لاله‌زار) و زنجان'
    ];

    const handleAddChip = (chip: string) => {
        if (!additionalNotes.includes(chip)) {
            setAdditionalNotes(prev => prev ? `${prev}، ${chip}` : chip);
        }
    };

    const handleExecuteSearch = async () => {
        setSearchLoading(true);
        setSearchError(null);
        setSendFeedback(null);

        try {
            // Merge item specifications with coding catalog specs if available
            const combinedSpecs = [
                selectedItem.specifications,
                matchedPart?.dimensions ? `ابعاد در شناسنامه: ${matchedPart.dimensions}` : '',
                matchedPart?.category ? `گروه کالا: ${matchedPart.category}` : '',
                matchedPart?.brand ? `برند متداول: ${matchedPart.brand}` : '',
                matchedPart?.technicalSpecs ? `مشخصات فنی: ${JSON.stringify(matchedPart.technicalSpecs)}` : ''
            ].filter(Boolean).join(' | ');

            const itemPayload = {
                itemName: selectedItem.itemName,
                specifications: combinedSpecs || selectedItem.specifications || '',
                itemCode: selectedItem.itemCode || matchedPart?.code || '',
                quantity: selectedItem.quantity || request.quantity || 1,
                unit: selectedItem.unit || request.unit || 'عدد',
                category: request.category || matchedPart?.category || ''
            };

            const result = await searchSuppliersWithAi({
                item: itemPayload,
                items: itemsList,
                additionalNotes: additionalNotes.trim()
            });

            if (result && result.success) {
                setSearchResult(result);
                setActiveRfqText(result.rfqTemplate || '');
            } else {
                setSearchError('نتیجه‌ای از موتور هوش مصنوعی دریافت نشد. لطفاً مجدداً تلاش نمایید.');
            }
        } catch (err: any) {
            console.error("AI Search Error:", err);
            setSearchError(err.message || 'خطا در برقراری ارتباط با سرویس هوش مصنوعی و جستجوی وب');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleCopyRfq = () => {
        if (!activeRfqText) return;
        navigator.clipboard.writeText(activeRfqText);
        setCopiedRfq(true);
        setTimeout(() => setCopiedRfq(false), 2500);
    };

    const openSendDialog = (supplier: SupplierResult, defaultPlatform: 'whatsapp' | 'bale' | 'telegram' = 'whatsapp') => {
        setSendingSupplier(supplier);
        setSendPlatform(defaultPlatform);
        setTargetPhone(supplier.phone || '');
        setSendFeedback(null);
    };

    const handleSendMessage = async () => {
        if (!targetPhone.trim()) {
            alert('لطفاً شماره تلفن یا شناسه مقصد را وارد نمایید.');
            return;
        }

        setIsSendingMsg(true);
        setSendFeedback(null);

        try {
            const resp = await sendRfqMessage({
                platform: sendPlatform,
                target: targetPhone.trim(),
                message: activeRfqText,
                supplierName: sendingSupplier?.name,
                requestNumber: request.requestNumber
            });

            if (resp.sent) {
                setSendFeedback({
                    success: true,
                    msg: `پیام استعلام قیمت با موفقیت از طریق ${sendPlatform === 'whatsapp' ? 'واتساپ' : sendPlatform === 'bale' ? 'بله' : 'تلگرام'} ارسال گردید.`,
                    directUrl: resp.directUrl
                });
            } else if (resp.directUrl) {
                setSendFeedback({
                    success: true,
                    msg: 'لینک ارسال مستقیم آماده است. می‌توانید مستقیماً گفتگو را باز کنید:',
                    directUrl: resp.directUrl
                });
            } else {
                setSendFeedback({
                    success: false,
                    msg: resp.errorMsg || 'خطا در ارسال پیام'
                });
            }
        } catch (err: any) {
            setSendFeedback({
                success: false,
                msg: err.message || 'خطا در برقراری ارتباط با پیام‌رسان'
            });
        } finally {
            setIsSendingMsg(false);
        }
    };

    const handleImportToProforma = (supplier: SupplierResult) => {
        if (onApplyProforma) {
            // Parse numeric price if available
            let priceNum = 0;
            if (supplier.estimatedPrice) {
                const clean = supplier.estimatedPrice.replace(/\D/g, '');
                if (clean) priceNum = parseInt(clean, 10);
            }

            onApplyProforma({
                vendorName: supplier.name,
                vendorPhone: supplier.phone || '',
                unitPrice: priceNum,
                description: `${supplier.title || supplier.name} - ${supplier.description || ''} (${supplier.website || ''})`
            });
            onClose();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100000010] flex items-stretch sm:items-start justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto pt-0 sm:pt-12 md:pt-16">
            <div className="bg-white dark:bg-gray-900 rounded-none sm:rounded-[2.5rem] w-full max-w-full lg:max-w-5xl xl:max-w-6xl overflow-hidden shadow-2xl border-0 sm:border border-white/20 animate-in fade-in zoom-in min-h-screen sm:min-h-[70vh] sm:max-h-[92vh] flex flex-col relative mb-0 sm:mb-8">
                
                {/* Header with AI Gradient */}
                <div className="p-4 md:p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex justify-between items-center shrink-0 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="p-2.5 md:p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                            <Sparkles size={24} className="text-yellow-300 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base md:text-xl font-black italic tracking-wide">دستیار هوشمند استعلام کالا و تامین‌کنندگان (AI Sourcing)</h2>
                                <span className="bg-yellow-400/20 text-yellow-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-300/30">Google Gemini</span>
                            </div>
                            <p className="text-[10px] md:text-xs text-purple-100 font-medium opacity-90 mt-0.5">
                                جستجوی هوشمند در سایت‌های معتبر ایران، استخراج لینک‌ها، مقایسه قیمت و ارسال استعلام به واتساپ/بله
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 md:p-2 bg-white/10 hover:bg-white/20 hover:rotate-90 rounded-xl transition-all text-white border border-white/20 shrink-0"
                    >
                        <X size={22} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Main Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/60 dark:bg-gray-950/60 no-scrollbar">
                    
                    {/* Item Information Context Card */}
                    <div className="glass-panel p-4 md:p-5 rounded-3xl border border-indigo-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4">
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="text-indigo-600 dark:text-indigo-400" size={18} />
                                <span className="text-xs font-black text-gray-800 dark:text-gray-200">مشخصات کالا در درخواست خرید #{request.requestNumber}</span>
                            </div>
                            
                            {/* Item Selector if multi-item */}
                            {itemsList.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-500">انتخاب قلم کالا:</span>
                                    <select 
                                        className="text-xs font-bold bg-indigo-50 dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-gray-700 rounded-xl px-3 py-1.5 outline-none"
                                        value={selectedItemIndex}
                                        onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
                                    >
                                        {itemsList.map((it, idx) => (
                                            <option key={it.id || idx} value={idx}>
                                                {idx + 1}. {it.itemName} ({it.quantity} {it.unit})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            <div className="bg-indigo-50/50 dark:bg-gray-800/40 p-3 rounded-2xl border border-indigo-100/60 dark:border-gray-700">
                                <span className="text-[10px] text-gray-400 block font-bold mb-1">نام کالا / قطعه:</span>
                                <span className="font-black text-gray-800 dark:text-gray-100 text-sm">{selectedItem.itemName}</span>
                            </div>

                            <div className="bg-indigo-50/50 dark:bg-gray-800/40 p-3 rounded-2xl border border-indigo-100/60 dark:border-gray-700">
                                <span className="text-[10px] text-gray-400 block font-bold mb-1">تعداد و واحد درخواستی:</span>
                                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">{selectedItem.quantity} {selectedItem.unit}</span>
                            </div>

                            <div className="bg-indigo-50/50 dark:bg-gray-800/40 p-3 rounded-2xl border border-indigo-100/60 dark:border-gray-700">
                                <span className="text-[10px] text-gray-400 block font-bold mb-1">کدینگ کالا / انبار:</span>
                                <span className="font-mono font-bold text-gray-700 dark:text-gray-300 text-xs">
                                    {selectedItem.itemCode || matchedPart?.code || 'بدون کد شناسنامه'}
                                </span>
                            </div>

                            <div className="bg-indigo-50/50 dark:bg-gray-800/40 p-3 rounded-2xl border border-indigo-100/60 dark:border-gray-700">
                                <span className="text-[10px] text-gray-400 block font-bold mb-1">دسته‌بندی کلی:</span>
                                <span className="font-bold text-gray-700 dark:text-gray-300 text-xs truncate block">
                                    {request.category || matchedPart?.category || 'عمومی / صنعتی'}
                                </span>
                            </div>
                        </div>

                        {/* Existing Technical Specifications from request & catalog */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                                <Tag size={12} className="text-indigo-500" />
                                مشخصات ثبت‌شده در سیستم و شناسنامه کالا:
                            </span>
                            <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                {selectedItem.specifications || matchedPart?.dimensions || 'مشخصات ابعادی اولیه‌ای ثبت نشده است.'}
                                {matchedPart?.brand && ` | برند پیش‌فرض: ${matchedPart.brand}`}
                            </p>
                        </div>
                    </div>

                    {/* Optional Additional Specifications & AI Prompt Enhancer */}
                    <div className="glass-panel p-4 md:p-6 rounded-3xl border border-purple-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Zap className="text-purple-600" size={16} />
                                توضیحات و مشخصات تکمیلی کالا (اختیاری):
                            </label>
                            <span className="text-[10px] text-gray-400">کمک به جستجوی دقیق‌تر هوش مصنوعی</span>
                        </div>

                        <textarea
                            className="w-full border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-purple-50/20 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 leading-relaxed h-24 placeholder:text-gray-400"
                            placeholder="مثلاً: ترجیحاً برند معتبر مانند SKF یا پارس، گرید صنعتی ضدسایش، تحویل فوری در تهران یا زنجان، نیاز به ارائه فاکتور رسمی با مالیات بر ارزش افزوده..."
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                        />

                        {/* Quick Suggestion Chips */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 block">افزودن سریع شروط جستجو:</span>
                            <div className="flex flex-wrap gap-1.5">
                                {quickChips.map((chip, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleAddChip(chip)}
                                        className="text-[11px] font-bold bg-gray-100 hover:bg-purple-100 hover:text-purple-700 text-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-purple-900/40 dark:hover:text-purple-300 px-3 py-1 rounded-xl transition-all border border-gray-200/60 dark:border-gray-700 active:scale-95"
                                    >
                                        + {chip}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Action Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleExecuteSearch}
                                disabled={searchLoading}
                                className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
                            >
                                {searchLoading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>در حال جستجوی هوشمند در وب و استخراج تامین‌کنندگان...</span>
                                    </>
                                ) : (
                                    <>
                                        <Search size={18} />
                                        <span>جستجوی هوشمند در وب، استخراج تامین‌کنندگان و مقایسه قیمت</span>
                                        <Sparkles size={16} className="text-yellow-300" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Search Error Notification */}
                    {searchError && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-700 dark:text-red-300 text-xs flex items-center gap-3">
                            <ShieldAlert size={20} className="shrink-0 text-red-500" />
                            <span>{searchError}</span>
                        </div>
                    )}

                    {/* Non-blocking Warning Banner */}
                    {searchResult && searchResult.warning && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                            <Info size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
                            <span className="font-medium leading-relaxed">{searchResult.warning}</span>
                        </div>
                    )}

                    {/* AI Results Display */}
                    {searchResult && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            
                            {/* Summary & Market Overview */}
                            <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 p-5 rounded-3xl border border-indigo-100 dark:border-gray-700 space-y-3">
                                <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-black text-sm">
                                    <Sparkles size={18} />
                                    <span>تحلیل هوشمند بازار و خلاصه منبع‌یابی:</span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                    {searchResult.summary}
                                </p>
                                
                                {searchResult.searchKeywords && searchResult.searchKeywords.length > 0 && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-indigo-100/60 dark:border-gray-700 text-[10px] text-gray-500">
                                        <span className="font-bold">کلیدواژه‌های جستجو:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {searchResult.searchKeywords.map((kw, idx) => (
                                                <span key={idx} className="bg-white/80 dark:bg-gray-800 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 font-mono">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Technical & QC Tips */}
                            {searchResult.technicalTips && searchResult.technicalTips.length > 0 && (
                                <div className="glass-panel p-4 md:p-5 rounded-3xl border border-emerald-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-3">
                                    <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                                        <CheckCircle2 size={16} />
                                        <span>راهنمای فنی و چک‌لیست بازرسی خرید:</span>
                                    </h3>
                                    <ul className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                                        {searchResult.technicalTips.map((tip, idx) => (
                                            <li key={idx} className="flex items-start gap-2 bg-emerald-50/40 dark:bg-gray-800/40 p-2.5 rounded-xl border border-emerald-100/50 dark:border-gray-700">
                                                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{idx + 1}</span>
                                                <span className="leading-relaxed">{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Discovered Suppliers & Direct Links */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Globe className="text-blue-600" size={18} />
                                        <span>تامین‌کنندگان، فروشگاه‌ها و وب‌سایت‌های یافته‌شده</span>
                                        <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                                            {searchResult.suppliers.length} مورد
                                        </span>
                                    </h3>
                                </div>

                                {searchResult.suppliers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs border border-dashed rounded-2xl bg-white dark:bg-gray-900">
                                        تامین‌کننده مستقیمی در این جستجو یافت نشد. می‌توانید با کلیدواژه‌های بیشتر جستجو کنید.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {searchResult.suppliers.map((sup, idx) => (
                                            <div 
                                                key={idx}
                                                className="glass-panel p-4 md:p-5 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition-all flex flex-col justify-between space-y-4"
                                            >
                                                <div className="space-y-2.5">
                                                    {/* Header: Name and Location/Status */}
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div>
                                                            <h4 className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                                                <Building2 size={16} className="text-indigo-600" />
                                                                {sup.name}
                                                            </h4>
                                                            {sup.title && sup.title !== sup.name && (
                                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-1 mt-0.5">
                                                                    {sup.title}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {sup.stockStatus && (
                                                            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                                                {sup.stockStatus}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Specs & Pricing Grid */}
                                                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-2xl">
                                                        <div>
                                                            <span className="text-gray-400 font-bold block text-[10px]">حدود قیمت:</span>
                                                            <span className="font-black text-indigo-700 dark:text-indigo-300">
                                                                {sup.estimatedPrice || 'استعلام تلفنی'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400 font-bold block text-[10px]">موقعیت / شهر:</span>
                                                            <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                                                <MapPin size={10} className="text-gray-400" />
                                                                {sup.city || 'آنلاین'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Description & Advantages */}
                                                    {sup.description && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                                                            {sup.description}
                                                        </p>
                                                    )}
                                                    {sup.pros && (
                                                        <div className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl font-bold flex items-center gap-1.5">
                                                            <span>مزیت: {sup.pros}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                    
                                                    {/* Website External Link */}
                                                    {sup.website && (
                                                        <a
                                                            href={sup.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                                        >
                                                            <ExternalLink size={14} />
                                                            <span>مشاهده وب‌سایت / صفحه محصول</span>
                                                        </a>
                                                    )}

                                                    {/* Messaging and Proforma Actions */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                                                        {/* WhatsApp Action */}
                                                        <button
                                                            onClick={() => openSendDialog(sup, 'whatsapp')}
                                                            className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                                            title="ارسال استعلام قیمت در واتساپ"
                                                        >
                                                            <MessageSquare size={13} />
                                                            <span>واتساپ</span>
                                                        </button>

                                                        {/* Bale Action */}
                                                        <button
                                                            onClick={() => openSendDialog(sup, 'bale')}
                                                            className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                                            title="ارسال استعلام قیمت در بله"
                                                        >
                                                            <Send size={13} />
                                                            <span>بله</span>
                                                        </button>

                                                        {/* Apply to Proforma Action */}
                                                        {onApplyProforma && (
                                                            <button
                                                                onClick={() => handleImportToProforma(sup)}
                                                                className="col-span-2 sm:col-span-1 py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95"
                                                                title="ثبت این تامین‌کننده در پیش‌فاکتور"
                                                            >
                                                                <PlusCircle size={13} />
                                                                <span>تبدیل به پیش‌فاکتور</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Formal RFQ Template Box */}
                            <div className="glass-panel p-4 md:p-6 rounded-3xl border border-indigo-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <FileText size={16} className="text-indigo-600" />
                                        <span>متن استاندارد استعلام قیمت و درخواست پیش‌فاکتور (RFQ):</span>
                                    </h3>
                                    <button
                                        onClick={handleCopyRfq}
                                        className="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-gray-800 dark:text-indigo-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
                                    >
                                        {copiedRfq ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                        <span>{copiedRfq ? 'کپی شد' : 'کپی متن استعلام'}</span>
                                    </button>
                                </div>

                                <textarea
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 leading-relaxed h-32"
                                    value={activeRfqText}
                                    onChange={(e) => setActiveRfqText(e.target.value)}
                                />
                            </div>

                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
                    <span className="text-[11px] text-gray-400 font-medium">
                        پشتیبانی از جستجوی همزمان در دایرکتوری‌های صنعتی و پلتفرم‌های پیام‌رسان
                    </span>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs transition-colors"
                    >
                        بستن
                    </button>
                </div>
            </div>

            {/* Submodal: Send RFQ to WhatsApp / Bale Dialog */}
            {sendingSupplier && (
                <div className="fixed inset-0 z-[100000020] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 text-right">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Send size={16} className="text-emerald-600" />
                                ارسال استعلام به {sendingSupplier.name}
                            </h4>
                            <button onClick={() => setSendingSupplier(null)} className="p-1 hover:bg-gray-100 rounded-full">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Platform Selector */}
                        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl text-xs font-black">
                            <button
                                onClick={() => setSendPlatform('whatsapp')}
                                className={`flex-1 py-2.5 rounded-xl transition-all ${sendPlatform === 'whatsapp' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500'}`}
                            >
                                واتساپ (WhatsApp)
                            </button>
                            <button
                                onClick={() => setSendPlatform('bale')}
                                className={`flex-1 py-2.5 rounded-xl transition-all ${sendPlatform === 'bale' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500'}`}
                            >
                                بله (Bale)
                            </button>
                            <button
                                onClick={() => setSendPlatform('telegram')}
                                className={`flex-1 py-2.5 rounded-xl transition-all ${sendPlatform === 'telegram' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}
                            >
                                تلگرام
                            </button>
                        </div>

                        {/* Target Phone / Chat ID input */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">
                                شماره موبایل / شناسه تامین‌کننده:
                            </label>
                            <input
                                type="text"
                                dir="ltr"
                                placeholder="مثال: 09121234567"
                                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                value={targetPhone}
                                onChange={(e) => setTargetPhone(e.target.value)}
                            />
                        </div>

                        {/* Feedback message if any */}
                        {sendFeedback && (
                            <div className={`p-3 rounded-xl text-xs ${sendFeedback.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                <p className="font-bold">{sendFeedback.msg}</p>
                                {sendFeedback.directUrl && (
                                    <a
                                        href={sendFeedback.directUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex items-center gap-1 text-emerald-700 font-black underline"
                                    >
                                        <ExternalLink size={12} />
                                        <span>کلیک جهت باز کردن مستقیم گفتگو در {sendPlatform === 'whatsapp' ? 'واتساپ' : sendPlatform === 'bale' ? 'بله' : 'تلگرام'}</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Modal Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSendMessage}
                                disabled={isSendingMsg}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-2"
                            >
                                {isSendingMsg ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                <span>ارسال استعلام</span>
                            </button>
                            <button
                                onClick={() => setSendingSupplier(null)}
                                className="px-5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-xs"
                            >
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
