import { apiCall } from './apiService';

export interface SupplierResult {
    name: string;
    title?: string;
    website?: string;
    phone?: string;
    city?: string;
    estimatedPrice?: string;
    stockStatus?: string;
    brand?: string;
    description?: string;
    pros?: string;
}

export interface AiPurchaseSearchResult {
    success: boolean;
    item?: {
        itemName: string;
        specifications?: string;
        itemCode?: string;
        quantity: number;
        unit: string;
        category?: string;
    };
    additionalNotes?: string;
    summary: string;
    searchKeywords: string[];
    technicalTips: string[];
    suppliers: SupplierResult[];
    rfqTemplate: string;
    generatedAt: string;
    warning?: string | null;
    error?: string;
}

export interface SendRfqParams {
    platform: 'whatsapp' | 'bale' | 'telegram';
    target: string;
    message: string;
    supplierName?: string;
    requestNumber?: string;
}

export interface SendRfqResponse {
    success: boolean;
    sent: boolean;
    directUrl?: string;
    errorMsg?: string | null;
    platform: string;
    target: string;
}

/**
 * Search suppliers and internet portals with Gemini AI Search Grounding
 */
export const searchSuppliersWithAi = async (params: {
    item: {
        itemName: string;
        specifications?: string;
        itemCode?: string;
        quantity?: number;
        unit?: string;
        category?: string;
    };
    items?: any[];
    additionalNotes?: string;
    customKey?: string;
}): Promise<AiPurchaseSearchResult> => {
    return await apiCall<AiPurchaseSearchResult>('/purchase/ai-search-suppliers', 'POST', params);
};

/**
 * Send RFQ / Proforma inquiry to supplier via WhatsApp, Bale or Telegram
 */
export const sendRfqMessage = async (params: SendRfqParams): Promise<SendRfqResponse> => {
    return await apiCall<SendRfqResponse>('/purchase/send-rfq-message', 'POST', params);
};
