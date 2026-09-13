
import React from 'react';
import { PaymentOrder, OrderStatus } from '../../types';
import { formatCurrency, formatDate, getStatusLabel } from '../../constants';
import { Eye, Trash2, CheckCircle, XCircle, Edit, UploadCloud } from 'lucide-react';

interface Props {
  order: PaymentOrder;
  onView: (order: PaymentOrder) => void;
  onEdit?: (order: PaymentOrder) => void;
  onUpload?: (order: PaymentOrder) => void;
  onDelete?: (id: string) => void;
  onApprove?: (id: string, currentStatus: OrderStatus) => void;
  onReject?: (id: string, currentStatus: OrderStatus) => void;
  canDelete: boolean;
  canApprove: boolean;
  canEdit?: boolean;
  isProcessing?: boolean;
}

const MobileOrderCard: React.FC<Props> = ({ 
  order, 
  onView, 
  onEdit, 
  onUpload, 
  onDelete, 
  onApprove, 
  onReject, 
  canDelete, 
  canApprove, 
  canEdit, 
  isProcessing 
}) => {
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.APPROVED_CEO: return 'bg-green-100 text-green-800 border-green-200';
      case OrderStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
      case OrderStatus.PENDING: return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 mb-4 shadow-sm border border-gray-200/50 dark:border-white/10 relative overflow-hidden active:scale-[0.99] transition-transform">
      {/* Status Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${order.status === OrderStatus.APPROVED_CEO ? 'bg-green-500' : order.status === OrderStatus.REJECTED ? 'bg-red-500' : 'bg-blue-500'}`}></div>
      
      <div className="flex justify-between items-start mb-3 mt-2">
        <div>
          <span className="text-xs text-gray-400 font-mono">#{order.trackingNumber}</span>
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base line-clamp-1">{order.payee}</h3>
        </div>
        <div className="text-right">
          <span className="block font-black text-blue-600 dark:text-blue-400 dir-ltr">{formatCurrency(order.totalAmount)}</span>
          <span className="text-[10px] text-gray-400">{formatDate(order.date)}</span>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 rounded-lg p-2 mb-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
          <span className="font-bold text-gray-800 dark:text-gray-200">بابت: </span>
          {order.description}
        </p>
        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <span className="font-bold">بانک:</span> {order.paymentDetails?.map(d => d.bankName || d.method).join(', ')}
        </div>
        {order.attachments && order.attachments.length > 0 && (
          <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
            <span>📎 {order.attachments.length} ضمیمه پیوست شده</span>
          </div>
        )}
        {order.rejectionReason && (
            <div className={`mt-2 text-[10px] p-1.5 rounded font-bold ${order.status === OrderStatus.REJECTED ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {order.status === OrderStatus.REJECTED ? `❌ دلیل رد: ${order.rejectionReason}` : `⚠️ بازگشت از مرحله قبل: ${order.rejectionReason}`}
            </div>
        )}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {canApprove && onApprove && (
            <button 
              onClick={(e) => { e.stopPropagation(); onApprove(order.id, order.status); }} 
              disabled={isProcessing}
              title="تایید سریع"
              className={`p-2 rounded-xl transition-all ${isProcessing ? 'bg-gray-100 text-gray-400' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'}`}
            >
              <CheckCircle size={18} className={isProcessing ? 'animate-pulse' : ''} />
            </button>
          )}
          {canApprove && onReject && (
            <button 
              onClick={(e) => { e.stopPropagation(); onReject(order.id, order.status); }} 
              disabled={isProcessing}
              title="رد و بازگشت به مرحله قبل"
              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
            >
              <XCircle size={18} />
            </button>
          )}
          {canEdit && onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(order); }} 
              title="ویرایش مستقیم"
              className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all"
            >
              <Edit size={16} />
            </button>
          )}
          {onUpload && (
            <button 
              onClick={(e) => { e.stopPropagation(); onUpload(order); }} 
              title="آپلود مدارک و ضمیمه مستقیم"
              className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
            >
              <UploadCloud size={16} />
            </button>
          )}
          {canDelete && onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(order.id); }} 
              className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"
              title="حذف"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button 
            onClick={() => onView(order)} 
            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 flex items-center gap-1"
          >
            <Eye size={15} />
            مشاهده
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileOrderCard;
