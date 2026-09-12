import React, { useRef, useState } from 'react';
import { 
    Camera, 
    UploadCloud, 
    FileText, 
    Image as ImageIcon, 
    Trash2, 
    Eye, 
    Download, 
    Loader2, 
    Plus, 
    CheckCircle2, 
    Smartphone 
} from 'lucide-react';
import { FileViewerModal } from '../FileViewerModal';

export interface ReceiptAttachment {
    id?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    fileData?: string;
    url?: string;
    uploadedAt?: string;
}

interface MobileAttachmentUploaderProps {
    attachments: ReceiptAttachment[];
    onChange: (attachments: ReceiptAttachment[]) => void;
    label?: string;
    helperText?: string;
    maxFileSizeMB?: number;
    compact?: boolean;
    readOnly?: boolean;
}

// Client-side smart image compression for mobile cameras
const compressImageFile = async (file: File, maxDim = 1920, quality = 0.85): Promise<{ dataUrl: string; size: number }> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    // Approximate size from base64
                    const approximateSize = Math.round((compressedDataUrl.length * 3) / 4);
                    resolve({ dataUrl: compressedDataUrl, size: approximateSize });
                } else {
                    resolve({ dataUrl: e.target?.result as string, size: file.size });
                }
            };
            img.onerror = () => {
                resolve({ dataUrl: e.target?.result as string, size: file.size });
            };
            img.src = e.target?.result as string;
        };
        reader.onerror = () => {
            resolve({ dataUrl: '', size: 0 });
        };
        reader.readAsDataURL(file);
    });
};

export const MobileAttachmentUploader: React.FC<MobileAttachmentUploaderProps> = ({
    attachments,
    onChange,
    label = 'پیوست تصویر یا مدارک چک',
    helperText = 'امکان عکاسی مستقیم با دوربین گوشی، بارگذاری تصویر از گالری و فایل PDF',
    maxFileSizeMB = 25,
    compact = false,
    readOnly = false
}) => {
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<ReceiptAttachment | null>(null);

    const processFiles = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        setIsProcessing(true);
        const newItems: ReceiptAttachment[] = [];

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            
            if (file.size > maxFileSizeMB * 1024 * 1024) {
                alert(`حجم فایل ${file.name} بیشتر از ${maxFileSizeMB} مگابایت است.`);
                continue;
            }

            try {
                if (file.type.startsWith('image/')) {
                    // Optimize mobile camera photos
                    const { dataUrl, size } = await compressImageFile(file);
                    newItems.push({
                        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        fileName: file.name || `عکس_چک_${newItems.length + 1}.jpg`,
                        fileType: 'image/jpeg',
                        fileSize: size || file.size,
                        fileData: dataUrl,
                        uploadedAt: new Date().toISOString()
                    });
                } else {
                    // PDF or standard document
                    const dataUrl = await new Promise<string>((res) => {
                        const reader = new FileReader();
                        reader.onload = () => res(reader.result as string);
                        reader.readAsDataURL(file);
                    });
                    newItems.push({
                        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        fileName: file.name,
                        fileType: file.type || 'application/pdf',
                        fileSize: file.size,
                        fileData: dataUrl,
                        uploadedAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.error('Error reading file:', err);
            }
        }

        if (newItems.length > 0) {
            onChange([...attachments, ...newItems]);
        }
        setIsProcessing(false);

        // Reset inputs so same file can be selected again if needed
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
    };

    const handleDelete = (indexToRemove: number) => {
        onChange(attachments.filter((_, idx) => idx !== indexToRemove));
    };

    const formatFileSize = (bytes: number) => {
        if (!bytes || bytes === 0) return '';
        if (bytes < 1024 * 1024) {
            return `${Math.round(bytes / 1024)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-3">
            {/* Header & Helpers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        {label}
                    </label>
                    {helperText && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {helperText}
                        </p>
                    )}
                </div>

                {attachments.length > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 self-start sm:self-auto bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{attachments.length} فایل پیوست شده</span>
                    </span>
                )}
            </div>

            {/* Hidden Input Elements for Mobile Integration */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => processFiles(e.target.files)}
                className="hidden"
            />
            <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                onChange={(e) => processFiles(e.target.files)}
                className="hidden"
            />

            {!readOnly && (
                <div className="space-y-2.5">
                    {/* Mobile Quick Action Buttons (Optimized for Touch) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* 1. Camera Direct Capture Button */}
                        <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            disabled={isProcessing}
                            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-indigo-600/20 active:scale-98 transition-all cursor-pointer"
                        >
                            {isProcessing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Camera className="w-5 h-5 shrink-0" />
                            )}
                            <div className="text-right">
                                <div className="leading-tight">عکاسی با دوربین گوشی</div>
                                <div className="text-[10px] text-purple-200 font-normal">عکس فوری از لاشه یا پشت چک</div>
                            </div>
                        </button>

                        {/* 2. File / Gallery Pick Button */}
                        <button
                            type="button"
                            onClick={() => galleryInputRef.current?.click()}
                            disabled={isProcessing}
                            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 border border-slate-300 dark:border-slate-600 active:scale-98 transition-all cursor-pointer"
                        >
                            <ImageIcon className="w-5 h-5 text-indigo-500 shrink-0" />
                            <div className="text-right">
                                <div className="leading-tight">انتخاب از گالری و اسناد</div>
                                <div className="text-[10px] text-slate-400 font-normal">تصویر یا فایل PDF چک‌ها</div>
                            </div>
                        </button>
                    </div>

                    {/* Desktop Drag & Drop Area (if not compact) */}
                    {!compact && (
                        <div
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                processFiles(e.dataTransfer.files);
                            }}
                            onClick={() => galleryInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
                                isDragging 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' 
                                    : 'border-slate-300/80 dark:border-slate-700/80 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/30'
                            }`}
                        >
                            <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                                <UploadCloud className="w-5 h-5 text-indigo-500" />
                                <span className="text-xs font-medium">یا فایل‌ها را به اینجا بکشید و رها کنید (کامپیوتر/تبلت)</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List of Attached Files (Touch-friendly & Responsive Cards) */}
            {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {attachments.map((att, idx) => {
                        const isImg = att.fileType?.startsWith('image/') || att.fileData?.startsWith('data:image') || att.fileName?.match(/\.(jpg|jpeg|png|webp)$/i);
                        const src = att.fileData || att.url || (att.fileName ? `/uploads/${att.fileName}` : '');

                        return (
                            <div
                                key={att.id || idx}
                                className="group bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-all"
                            >
                                <div 
                                    onClick={() => setPreviewAttachment(att)}
                                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                        {isImg && src ? (
                                            <img
                                                src={src}
                                                alt={att.fileName}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        ) : (
                                            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div 
                                            className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                                            title={att.fileName}
                                        >
                                            {att.fileName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                                            <span>{isImg ? 'تصویر' : 'سند PDF'}</span>
                                            {att.fileSize > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatFileSize(att.fileSize)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(att)}
                                        className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer"
                                        title="مشاهده بزرگنمایی"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>

                                    {src && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = src;
                                                link.download = att.fileName;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                            className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                                            title="دانلود فایل"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    )}

                                    {!readOnly && (
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(idx)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                            title="حذف پیوست"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Standard Image/PDF Modal Viewer */}
            <FileViewerModal
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                fileUrl={previewAttachment?.fileData || previewAttachment?.url || (previewAttachment?.fileName ? `/uploads/${previewAttachment.fileName}` : '')}
                fileName={previewAttachment?.fileName || 'پیش‌نمایش تصویر / سند چک'}
            />
        </div>
    );
};
