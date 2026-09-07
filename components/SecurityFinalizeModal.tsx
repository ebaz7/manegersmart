import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExitPermit } from '../types';
import { X, ShieldCheck, CheckCircle, Smartphone, User, Truck, Paperclip, Trash2, Clock } from 'lucide-react';
import { IranianPlateInput } from './IranianPlate';
import { searchSavedDrivers, saveDriverToMemory, SavedDriver } from '../services/driverMemoryService';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onConfirm: (data: { driverName: string; driverPhone: string; plateNumber: string; exitTime: string; attachments: {fileName: string, data: string}[] }) => void;
}

const SecurityFinalizeModal: React.FC<Props> = ({ permit, onClose, onConfirm }) => {
  const [driverName, setDriverName] = useState(permit.driverName || '');
  const [driverPhone, setDriverPhone] = useState(permit.driverPhone || '');
  const [exitTime, setExitTime] = useState(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
  const [plateNumber, setPlateNumber] = useState(permit.plateNumber || '');
  
  const [driverSuggestions, setDriverSuggestions] = useState<SavedDriver[]>([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = useState(false);

  useEffect(() => {
    if (driverName.trim().length > 0) {
      const results = searchSavedDrivers(driverName);
      setDriverSuggestions(results);
    } else {
      setDriverSuggestions([]);
    }
  }, [driverName]);

  const selectDriver = (d: SavedDriver) => {
    setDriverName(d.driverName);
    if (d.driverPhone) setDriverPhone(d.driverPhone);
    if (d.plateNumber) setPlateNumber(d.plateNumber);
    setShowDriverSuggestions(false);
  };
  
  const [attachments, setAttachments] = useState<{fileName: string, data: string}[]>(permit.attachments || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  const base64 = evt.target.result as string;
                  if (file.type.startsWith('image/')) {
                      const img = new Image();
                      img.src = base64;
                      img.onload = () => {
                          const maxDim = 1200;
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
                              ctx.fillStyle = '#ffffff';
                              ctx.fillRect(0, 0, width, height);
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedData = canvas.toDataURL('image/jpeg', 0.75);
                              const compressedName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                              setAttachments(prev => [...prev, { fileName: compressedName, data: compressedData }]);
                          } else {
                              setAttachments(prev => [...prev, { fileName: file.name, data: base64 }]);
                          }
                      };
                      img.onerror = () => {
                          setAttachments(prev => [...prev, { fileName: file.name, data: base64 }]);
                      };
                  } else {
                      setAttachments(prev => [...prev, { fileName: file.name, data: base64 }]);
                  }
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (driverName.trim() || plateNumber.trim()) {
      saveDriverToMemory({
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        plateNumber: plateNumber.trim()
      });
    }
    onConfirm({
      driverName,
      driverPhone,
      plateNumber,
      exitTime: exitTime || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      attachments
    });
  };

  const modalContent = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-4 bg-black/70 backdrop-blur-md overflow-hidden animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-700 to-indigo-800 text-white shrink-0">
          <div className="flex items-center gap-3">
             <ShieldCheck size={26} className="text-blue-200" />
             <div>
                <h2 className="text-lg md:text-xl font-black">تایید نهایی و ثبت خروج کارخانه</h2>
                <p className="text-[11px] opacity-80 mt-0.5">ثبت مشخصات راننده، شماره پلاک خودرو و مستندات خروج</p>
             </div>
          </div>
          <button onClick={onClose} data-close-modal="true" className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={22} /></button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50 dark:bg-gray-900/50">
          {/* Driver Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2 border-r-4 border-blue-500 pr-2.5">
              <User size={18} className="text-blue-500" /> مشخصات راننده
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block mb-1">نام و نام خانوادگی راننده</label>
                <div className="relative">
                  <input 
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl p-2.5 pr-9 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                    value={driverName} 
                    onChange={e => {
                      setDriverName(e.target.value);
                      setShowDriverSuggestions(true);
                    }} 
                    onFocus={() => setShowDriverSuggestions(true)}
                    placeholder="مثلاً: احمد حسینی" 
                  />
                  <User className="absolute right-2.5 top-3 text-gray-400" size={17} />
                </div>
                {showDriverSuggestions && driverSuggestions.length > 0 && (
                  <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    <div className="p-1.5 text-[10px] text-gray-400 font-bold border-b dark:border-gray-700">رانندگان ذخیره شده در حافظه:</div>
                    {driverSuggestions.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => selectDriver(d)}
                        className="w-full text-right p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex justify-between items-center text-xs border-b last:border-0 dark:border-gray-700 transition-colors"
                      >
                        <span className="font-bold text-gray-800 dark:text-gray-200">{d.driverName}</span>
                        <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                          <span>{d.driverPhone}</span>
                          {d.plateNumber && <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-[10px]">{d.plateNumber}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block mb-1">شماره تماس راننده</label>
                <div className="relative">
                  <input 
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-xl p-2.5 pr-9 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                    dir="ltr" 
                    value={driverPhone} 
                    onChange={e => setDriverPhone(e.target.value)} 
                    placeholder="0912..." 
                  />
                  <Smartphone className="absolute right-2.5 top-3 text-gray-400" size={17} />
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle & Plate Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2 border-r-4 border-orange-500 pr-2.5">
              <Truck size={18} className="text-orange-500" /> مشخصات پلاک خودرو
            </h3>
            <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <IranianPlateInput
                  value={plateNumber}
                  onChange={setPlateNumber}
                />
            </div>
          </div>

          {/* Time Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200/60 dark:border-blue-900/50">
              <Clock size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">ساعت ثبت خروج از کارخانه:</label>
                <input 
                  type="text"
                  className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-lg px-3 py-1.5 text-center text-sm font-bold w-28 dir-ltr outline-none focus:border-blue-500"
                  value={exitTime}
                  onChange={e => setExitTime(e.target.value)}
                  placeholder="00:00"
                />
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-3">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2 border-r-4 border-emerald-500 pr-2.5">
                  <Paperclip size={18} className="text-emerald-500" /> ضمیمه تصاویر و مدارک (اختیاری)
              </h3>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col gap-3">
                      <input 
                          type="file" 
                          multiple 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          ref={fileInputRef} 
                          onChange={handleFileUpload} 
                      />
                      <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()} 
                          className="w-full py-2.5 border-2 border-dashed border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold flex items-center justify-center gap-2 transition-colors text-xs sm:text-sm"
                      >
                          <Paperclip size={16} /> انتخاب فایل یا تصویر (مثلاً عکس بار، باسکول یا حواله)
                      </button>
                      
                      {attachments.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                              {attachments.map((att, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-2 rounded-lg text-xs">
                                      <span className="truncate flex-1 font-mono text-xs" dir="ltr">{att.fileName}</span>
                                      <button type="button" onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 dark:bg-red-900/30 rounded-md shrink-0 ml-2">
                                          <Trash2 size={13} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
        </div>

        {/* Modal Footer - Fixed & Visible */}
        <div className="p-4 border-t glass-panel flex justify-between items-center bg-gray-100/90 dark:bg-gray-800/90 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-xs hover:bg-white dark:hover:bg-gray-700 transition-all">انصراف</button>
          <button onClick={handleSubmit} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 active:scale-95">
            <CheckCircle size={17} /> تایید نهایی و ثبت خروج
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default SecurityFinalizeModal;
