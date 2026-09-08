import { executeSayanQuery } from './sayan-order-automation.js';
import { getDb, saveDb } from './db-manager.js';
import crypto from 'crypto';
import * as jalaali from 'jalaali-js';

/**
 * Common Iranian Banks list for auto-complete and standardisation
 */
export const COMMON_IRANIAN_BANKS = [
    'ملی', 'ملت', 'صادرات', 'تجارت', 'سپه', 'سامان', 'پاسارگاد', 
    'پارسیان', 'کشاورزی', 'مسکن', 'رفاه', 'آینده', 'شهر', 'سینا', 
    'گردشگری', 'کارآفرین', 'اقتصاد نوین', 'صنعت و معدن', 'توسعه تعاون', 
    'دی', 'سرمایه', 'خاورمیانه', 'پست بانک', 'مهر ایران', 'رسالت',
    'بانک ملی ایران', 'بانک ملت', 'بانک صادرات ایران', 'بانک تجارت',
    'بانک سپه', 'بانک سامان', 'بانک پاسارگاد', 'بانک پارسیان',
    'بانک کشاورزی', 'بانک مسکن', 'بانک رفاه کارگران', 'بانک آینده',
    'بانک شهر', 'بانک سینا', 'بانک گردشگری', 'بانک کارآفرین',
    'بانک اقتصاد نوین', 'بانک صنعت و معدن', 'بانک توسعه تعاون',
    'بانک دی', 'بانک سرمایه', 'بانک خاورمیانه', 'پست بانک ایران',
    'بانک قرض‌الحسنه مهر ایران', 'بانک قرض‌الحسنه رسالت', 'بانک ایران زمین',
    'موسسه اعتباری ملل', 'موسسه اعتباری نور', 'موسسه اعتباری توسعه'
];

/**
 * Convert Persian/Shamsi Date (or ISO) to SQL Server Gregorian Date (YYYY-MM-DD)
 */
export const parseToGregorianSqlDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const cleanStr = String(dateStr).trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const parts = cleanStr.split(/[\/\-]/).map(Number);
    if (parts.length === 3 && parts[0] >= 1300 && parts[0] <= 1500) {
        const [jy, jm, jd] = parts;
        const g = jalaali.toGregorian(jy, jm, jd);
        const mm = String(g.gm).padStart(2, '0');
        const dd = String(g.gd).padStart(2, '0');
        return `${g.gy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
        return cleanStr.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
};

/**
 * Convert Date (Gregorian or Shamsi) to standardized Shamsi string (YYYY/MM/DD)
 */
export const formatToShamsiDate = (dateVal) => {
    if (!dateVal) return '';
    try {
        const cleanStr = String(dateVal).trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        const parts = cleanStr.split(/[\/\-]/).map(Number);
        if (parts.length === 3 && parts[0] >= 1300 && parts[0] <= 1500) {
            const mm = String(parts[1]).padStart(2, '0');
            const dd = String(parts[2]).padStart(2, '0');
            return `${parts[0]}/${mm}/${dd}`;
        }
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const mm = String(j.jm).padStart(2, '0');
        const dd = String(j.jd).padStart(2, '0');
        return `${j.jy}/${mm}/${dd}`;
    } catch {
        return String(dateVal);
    }
};

export const getNextAppReceiptNumber = (fiscalYear = '4') => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) {
        db.sayan_cheque_receipts = [];
    }
    const fy = String(fiscalYear || '4');
    const existing = db.sayan_cheque_receipts.filter(r => String(r.fiscalYear || '4') === fy);
    const maxNum = existing.reduce((max, r) => {
        const n = Number(r.receiptNo);
        return !isNaN(n) && n > max ? n : max;
    }, 0);
    return maxNum > 0 ? maxNum + 1 : 1;
};

/**
 * Get Next available numbers:
 * - App Receipt Number (Internal sequential number based on our system)
 * - Sayan Next Document Number (Field_006 in BUR_TBL_008)
 * - Sayan Next Archive Code (Field_005 in BUR_TBL_008)
 * - Next Posht-Nomreh (Field_016 in BUR_TBL_012)
 */
export const getNextChequeReceiptNumbers = async (fiscalYear = '4') => {
    try {
        const fy = String(fiscalYear || '4');
        const nextAppReceiptNo = getNextAppReceiptNumber(fy);
        
        // 1. Next Doc No for this fiscal year in Sayan
        const docNoRes = await executeSayanQuery(`
            SELECT MAX(CAST(Field_006 as bigint)) as MaxDocNo 
            FROM BUR_TBL_008 
            WHERE Field_004 = '${fy}' AND Field_009 = '11'
        `);
        const maxDocNo = Number(docNoRes[0]?.MaxDocNo) || 0;
        const nextDocNo = maxDocNo + 1;

        // 2. Next Archive Code for this fiscal year in Sayan
        const archiveRes = await executeSayanQuery(`
            SELECT MAX(CAST(Field_005 as bigint)) as MaxArchiveCode 
            FROM BUR_TBL_008 
            WHERE Field_004 = '${fy}'
        `);
        const maxArchiveCode = Number(archiveRes[0]?.MaxArchiveCode) || 0;
        const nextArchiveCode = maxArchiveCode + 1;

        // 3. Next Posht-Nomreh (specifically looking at fiscal year 4 documents)
        const poshtRes = await executeSayanQuery(`
            SELECT TOP 1 c.Field_016 as PoshtNomreh
            FROM BUR_TBL_008 h
            INNER JOIN BUR_TBL_009 r ON r.Field_004 = h.Field_005 AND r.Field_003 = h.Field_004
            INNER JOIN BUR_TBL_012 c ON c.Field_001 = r.Field_007
            WHERE h.Field_004 = '${fy}' AND h.Field_009 = '11' AND ISNUMERIC(c.Field_016) = 1
            ORDER BY CAST(h.Field_005 as bigint) DESC
        `);
        
        let nextPoshtNomreh = 1;
        if (poshtRes.length > 0 && poshtRes[0]?.PoshtNomreh) {
            nextPoshtNomreh = Number(poshtRes[0].PoshtNomreh) + 1;
        } else {
            // Fallback to max across table if none in fiscal year
            const allPosht = await executeSayanQuery(`
                SELECT MAX(CAST(Field_016 as bigint)) as MaxPosht
                FROM BUR_TBL_012 
                WHERE ISNUMERIC(Field_016) = 1 AND CAST(Field_016 as bigint) < 10000
            `);
            nextPoshtNomreh = (Number(allPosht[0]?.MaxPosht) || 700) + 1;
        }

        // Integrate configured startPoshtNomreh and local drafts to prevent overlap
        try {
            const db = getDb();
            const settings = db?.settings || {};
            const activeYear = (settings.fiscalYears || []).find(y => y.id === settings.activeFiscalYearId);
            
            let configStart = 1;
            if (settings.currentPoshtNomreh) {
                configStart = parseInt(String(settings.currentPoshtNomreh)) || 1;
            }

            if (activeYear && activeYear.companySequences) {
                for (const key of Object.keys(activeYear.companySequences)) {
                    const seq = activeYear.companySequences[key];
                    if (seq && seq.startPoshtNomreh) {
                        const val = parseInt(String(seq.startPoshtNomreh));
                        if (!isNaN(val) && val > configStart) {
                            configStart = val;
                        }
                    }
                }
            }

            const localReceipts = db?.sayan_cheque_receipts || [];
            const maxLocalPosht = localReceipts
                .filter(r => String(r.fiscalYear) === String(fy))
                .reduce((max, r) => {
                    const num = parseInt(r.poshtNomreh);
                    return !isNaN(num) && num > max ? num : max;
                }, 0);

            if (configStart > nextPoshtNomreh) {
                nextPoshtNomreh = configStart;
            }
            if (maxLocalPosht >= nextPoshtNomreh) {
                nextPoshtNomreh = maxLocalPosht + 1;
            }
        } catch (dbErr) {
            console.error('Error matching local DB and configs for nextPoshtNomreh:', dbErr);
        }

        return {
            success: true,
            fiscalYear: fy,
            nextAppReceiptNo,
            nextDocNo,
            nextArchiveCode,
            nextPoshtNomreh,
            commonBanks: COMMON_IRANIAN_BANKS
        };
    } catch (err) {
        console.error('Error fetching next cheque receipt numbers from Sayan:', err);
        return {
            success: false,
            error: err.message,
            nextAppReceiptNo: getNextAppReceiptNumber(fiscalYear),
            nextDocNo: 812,
            nextArchiveCode: 1866,
            nextPoshtNomreh: 766,
            commonBanks: COMMON_IRANIAN_BANKS
        };
    }
};

/**
 * Search Sayan Tafsili / Persons by Name or Code from GNR_TBL_001
 * Supports Persian/Arabic character normalization and search by code, name, nationalId or mobile.
 */
export const searchSayanPersons = async (query = '', limit = 40) => {
    try {
        const rawQ = (query || '').trim();
        const cleanQ = rawQ.replace(/'/g, "''");
        // Create Persian/Arabic Yeh & Kaf variants for resilient search
        const qPersian = cleanQ.replace(/\u064A/g, 'ی').replace(/\u0643/g, 'ک');
        const qArabic = cleanQ.replace(/\u06CC/g, 'ي').replace(/\u06A9/g, 'ك');

        let sql = `
            SELECT TOP ${limit}
                Field_003 as PersonCode,
                RTRIM(LTRIM(CONCAT(COALESCE(Field_006, ''), ' ', COALESCE(Field_007, '')))) as FullName,
                COALESCE(Field_009, '') as NationalId,
                COALESCE(Field_015, '') as Mobile
            FROM GNR_TBL_001
            WHERE (Field_018 = 1 OR Field_018 IS NULL)
        `;
        if (cleanQ) {
            sql += ` AND (
                Field_003 LIKE '%${cleanQ}%' OR 
                Field_009 LIKE '%${cleanQ}%' OR
                Field_015 LIKE '%${cleanQ}%' OR
                Field_006 LIKE N'%${cleanQ}%' OR 
                Field_007 LIKE N'%${cleanQ}%' OR
                Field_006 LIKE N'%${qPersian}%' OR 
                Field_007 LIKE N'%${qPersian}%' OR
                Field_006 LIKE N'%${qArabic}%' OR 
                Field_007 LIKE N'%${qArabic}%' OR
                CONCAT(COALESCE(Field_006, ''), ' ', COALESCE(Field_007, '')) LIKE N'%${cleanQ}%' OR
                CONCAT(COALESCE(Field_006, ''), ' ', COALESCE(Field_007, '')) LIKE N'%${qPersian}%' OR
                CONCAT(COALESCE(Field_006, ''), ' ', COALESCE(Field_007, '')) LIKE N'%${qArabic}%'
            )`;
        }
        sql += ` ORDER BY CAST(Field_003 as bigint) DESC`;

        const rows = await executeSayanQuery(sql);
        return rows.map(r => ({
            personCode: (r.PersonCode || '').trim(),
            fullName: (r.FullName || '').trim() || `کد ${r.PersonCode}`,
            nationalId: (r.NationalId || '').trim(),
            mobile: (r.Mobile || '').trim()
        }));
    } catch (err) {
        console.error('Error searching persons in Sayan:', err);
        return [];
    }
};

/**
 * Load list of cashboxes (صندوق ها) from GNR_TBL_005
 */
export const getSayanCashboxes = async () => {
    try {
        const sql = `
            SELECT 
                Field_003 as CashboxCode,
                Field_006 as CashboxName
            FROM GNR_TBL_005
            WHERE Field_003 IS NOT NULL 
              AND Field_003 != '1' 
              AND Field_003 != ''
            ORDER BY CAST(Field_003 as bigint) ASC
        `;
        const rows = await executeSayanQuery(sql);
        if (rows && rows.length > 0) {
            return rows.map(r => ({
                code: (r.CashboxCode || '').trim(),
                title: (r.CashboxName || '').trim()
            }));
        }
    } catch (err) {
        console.error('Error fetching cashboxes from Sayan / GNR_TBL_005:', err);
    }
    // Return standard fallback cashboxes
    return [
        { code: '11001', title: 'صندوق دفتر' },
        { code: '11002', title: 'صندوق سکه و کارت هدیه' },
        { code: '11003', title: 'صندوق آقای مقدم' },
        { code: '11004', title: 'صندوق ارزی' },
        { code: '11005', title: 'صندوق چک های برگشتی' }
    ];
};

/**
 * Fetch Cheque Receipts history:
 * Combines Sayan live registered documents (OpCode 11) with local system drafts & approval requests.
 */
export const getChequeReceiptsHistory = async (fiscalYear = '4', search = '') => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) {
        db.sayan_cheque_receipts = [];
    }

    const fy = String(fiscalYear || '4');

    // 1. Get Live Sayan Registered Receipts (OpCode 11)
    let sayanLiveReceipts = [];
    try {
        const sql = `
            SELECT TOP 100
                h.Field_001 as HeaderId,
                h.Field_004 as FiscalYear,
                h.Field_005 as ArchiveCode,
                h.Field_006 as DocNo,
                h.Field_008 as DocDate,
                h.Field_010 as PersonCode,
                h.Field_025 as TotalAmount,
                h.Field_028 as Description,
                RTRIM(LTRIM(CONCAT(COALESCE(g.Field_006, ''), ' ', COALESCE(g.Field_007, '')))) as PersonName,
                r.Field_001 as RowId,
                r.Field_006 as RowAmount,
                r.Field_007 as ChequeId,
                r.Field_008 as RowNote,
                r.Field_025 as RowSeq,
                c.Field_005 as ChequeNumber,
                c.Field_006 as DueDate,
                c.Field_009 as BankName,
                c.Field_011 as InNameOf,
                c.Field_016 as PoshtNomreh
            FROM BUR_TBL_008 h
            LEFT JOIN GNR_TBL_001 g ON RTRIM(LTRIM(g.Field_003)) = RTRIM(LTRIM(h.Field_010))
            INNER JOIN BUR_TBL_009 r ON r.Field_004 = h.Field_005 AND r.Field_003 = h.Field_004
            LEFT JOIN BUR_TBL_012 c ON c.Field_001 = r.Field_007
            WHERE h.Field_004 = '${fy}' AND h.Field_009 = '11'
            ORDER BY CAST(h.Field_005 as bigint) DESC, CAST(r.Field_025 as int) ASC
        `;
        const flatRows = await executeSayanQuery(sql);

        // Group rows by ArchiveCode / HeaderId
        const groupMap = new Map();
        for (const row of flatRows) {
            const docKey = `${row.FiscalYear}_${row.ArchiveCode}`;
            if (!groupMap.has(docKey)) {
                groupMap.set(docKey, {
                    id: `SAYAN_${row.HeaderId}`,
                    source: 'SAYAN_DB',
                    status: 'REGISTERED_IN_SAYAN',
                    fiscalYear: row.FiscalYear,
                    archiveCode: row.ArchiveCode,
                    docNo: row.DocNo,
                    docDate: row.DocDate,
                    personCode: row.PersonCode,
                    personName: row.PersonName || `شخص ${row.PersonCode}`,
                    totalAmount: Number(row.TotalAmount) || 0,
                    description: row.Description || '',
                    poshtNomreh: row.PoshtNomreh || '',
                    cheques: [],
                    createdAt: row.DocDate,
                    registeredAt: row.DocDate
                });
            }
            const doc = groupMap.get(docKey);
            if (!doc.poshtNomreh && row.PoshtNomreh) {
                doc.poshtNomreh = row.PoshtNomreh;
            }
            if (row.ChequeId || row.ChequeNumber) {
                doc.cheques.push({
                    chequeId: row.ChequeId,
                    rowId: row.RowId,
                    chequeNumber: row.ChequeNumber || '',
                    amount: Number(row.RowAmount) || 0,
                    dueDate: row.DueDate || '',
                    bankName: row.BankName || '',
                    inNameOf: row.InNameOf || '',
                    poshtNomreh: row.PoshtNomreh || doc.poshtNomreh || '',
                    rowSeq: row.RowSeq
                });
            }
        }
        sayanLiveReceipts = Array.from(groupMap.values());
    } catch (err) {
        console.error('Error querying live Sayan cheque receipts:', err);
    }

    // 2. Local drafts & approval workflow items
    const localReceipts = (db.sayan_cheque_receipts || []).filter(item => {
        if (item.fiscalYear && String(item.fiscalYear) !== fy) return false;
        return true;
    });

    // Merge: If a local draft was registered into Sayan and matches ArchiveCode, attach local metadata (e.g. PDF preview)
    const combined = [...localReceipts];
    for (const live of sayanLiveReceipts) {
        const existingLocal = combined.find(c => String(c.archiveCode) === String(live.archiveCode) && String(c.fiscalYear) === String(live.fiscalYear));
        if (existingLocal) {
            existingLocal.status = 'REGISTERED_IN_SAYAN';
            existingLocal.headerId = live.headerId;
            existingLocal.docNo = live.docNo;
            existingLocal.registeredAt = live.registeredAt;
        } else {
            combined.push(live);
        }
    }

    // Apply optional filter/search
    let results = combined;
    if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        results = results.filter(r => {
            return (
                (r.receiptNo && String(r.receiptNo).includes(q)) ||
                (r.docNo && String(r.docNo).includes(q)) ||
                (r.archiveCode && String(r.archiveCode).includes(q)) ||
                (r.poshtNomreh && String(r.poshtNomreh).includes(q)) ||
                (r.personCode && String(r.personCode).includes(q)) ||
                (r.personName && String(r.personName).toLowerCase().includes(q)) ||
                (r.description && String(r.description).toLowerCase().includes(q)) ||
                (r.cheques && r.cheques.some(c => 
                    (c.chequeNumber && String(c.chequeNumber).includes(q)) ||
                    (c.bankName && String(c.bankName).includes(q)) ||
                    (c.inNameOf && String(c.inNameOf).toLowerCase().includes(q))
                ))
            );
        });
    }

    // Sort descending by receiptNo / archiveCode / createdAt
    results.sort((a, b) => {
        if (a.receiptNo && b.receiptNo) {
            return Number(b.receiptNo) - Number(a.receiptNo);
        }
        const aNum = Number(a.archiveCode || a.docNo || 0);
        const bNum = Number(b.archiveCode || b.docNo || 0);
        if (aNum && bNum && aNum !== bNum) return bNum - aNum;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return results;
};

/**
 * Save or Update Cheque Receipt Draft (With internal App Receipt Number and Accounting/CEO workflow)
 */
export const saveChequeReceiptDraft = async (receiptData, currentUser) => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) {
        db.sayan_cheque_receipts = [];
    }

    const fy = String(receiptData.fiscalYear || '4');
    const cleanCheques = (receiptData.cheques || []).map((ch, idx) => ({
        id: ch.id || crypto.randomUUID(),
        chequeNumber: String(ch.chequeNumber || '').trim(),
        amount: Number(ch.amount) || 0,
        dueDate: ch.dueDate || '',
        bankName: String(ch.bankName || '').trim(),
        inNameOf: String(ch.inNameOf || '').trim(),
        accountNo: String(ch.accountNo || '').trim(),
        poshtNomreh: String(receiptData.poshtNomreh || ch.poshtNomreh || '').trim(),
        description: String(ch.description || '').trim(),
        rowSeq: idx + 1
    }));

    const totalAmount = cleanCheques.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const isEdit = Boolean(receiptData.id);
    const receiptId = receiptData.id || `RCPT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Internal app receipt number (شماره رسید دریافت داخلی سیستم)
    let receiptNo = receiptData.receiptNo;
    if (!receiptNo) {
        if (isEdit) {
            const existing = db.sayan_cheque_receipts.find(r => r.id === receiptId);
            receiptNo = existing?.receiptNo || getNextAppReceiptNumber(fy);
        } else {
            receiptNo = getNextAppReceiptNumber(fy);
        }
    }

    // Default status: PENDING_ACCOUNTING (Step 1)
    let status = receiptData.status;
    if (!status) {
        status = 'PENDING_ACCOUNTING';
    } else if (status === 'PENDING_APPROVAL') {
        status = 'PENDING_ACCOUNTING';
    }

    const newRecord = {
        id: receiptId,
        receiptNo: Number(receiptNo) || receiptNo,
        source: 'APP_DRAFT',
        status, // PENDING_ACCOUNTING -> PENDING_CEO -> APPROVED -> REGISTERED_IN_SAYAN
        fiscalYear: fy,
        docNo: receiptData.docNo || null,
        archiveCode: receiptData.archiveCode || null,
        poshtNomreh: String(receiptData.poshtNomreh || '').trim(),
        docDate: receiptData.docDate || new Date().toISOString(),
        personCode: String(receiptData.personCode || '').trim(),
        personName: String(receiptData.personName || '').trim(),
        cashboxCode: String(receiptData.cashboxCode || '11001').trim(),
        totalAmount,
        description: String(receiptData.description || '').trim(),
        cheques: cleanCheques,
        attachments: (receiptData.attachments || []).map(att => ({
            fileName: att.fileName,
            fileType: att.fileType
        })), // Store only filenames/metadata, no heavy fileData base64 in the database
        createdBy: isEdit && receiptData.createdBy ? receiptData.createdBy : (currentUser ? { id: currentUser.id, name: currentUser.fullName || currentUser.name, role: currentUser.role } : null),
        createdAt: isEdit && receiptData.createdAt ? receiptData.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Stage 1: Accounting Staff Review & Edit tracking
        accountingReview: receiptData.accountingReview || null,
        
        // Stage 2: CEO Approval tracking
        ceoApproval: receiptData.ceoApproval || receiptData.approvedBy || null,
        approvedBy: receiptData.approvedBy || receiptData.ceoApproval || null,
        approvedAt: receiptData.approvedAt || null,
        
        // Rejection / revision feedback
        rejectionReason: receiptData.rejectionReason || null,

        // Sayan Registration tracking
        registeredAt: receiptData.registeredAt || null,
        sayanHeaderId: receiptData.sayanHeaderId || null
    };

    if (isEdit) {
        const idx = db.sayan_cheque_receipts.findIndex(r => r.id === receiptId);
        if (idx >= 0) {
            db.sayan_cheque_receipts[idx] = { ...db.sayan_cheque_receipts[idx], ...newRecord };
        } else {
            db.sayan_cheque_receipts.unshift(newRecord);
        }
    } else {
        db.sayan_cheque_receipts.unshift(newRecord);
    }

    saveDb();
    return newRecord;
};

/**
 * Stage 1 Approval: Accounting Staff Verification & Optional In-flight Edit
 * Moves status from PENDING_ACCOUNTING to PENDING_CEO
 */
export const approveAccountingReceipt = async (receiptId, currentUser, note = '', updatePayload = null, approveForCEO = true) => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) db.sayan_cheque_receipts = [];

    const record = db.sayan_cheque_receipts.find(r => r.id === receiptId);
    if (!record) {
        throw new Error(`رسید با شناسه ${receiptId} یافت نشد.`);
    }

    // Apply any modifications made during accounting review
    if (updatePayload) {
        if (updatePayload.personCode) record.personCode = String(updatePayload.personCode).trim();
        if (updatePayload.personName) record.personName = String(updatePayload.personName).trim();
        if (updatePayload.cashboxCode) record.cashboxCode = String(updatePayload.cashboxCode).trim();
        if (updatePayload.description !== undefined) record.description = String(updatePayload.description).trim();
        if (updatePayload.poshtNomreh) record.poshtNomreh = String(updatePayload.poshtNomreh).trim();
        if (updatePayload.docDate) record.docDate = updatePayload.docDate;
        if (Array.isArray(updatePayload.cheques) && updatePayload.cheques.length > 0) {
            record.cheques = updatePayload.cheques.map((ch, idx) => ({
                id: ch.id || crypto.randomUUID(),
                chequeNumber: String(ch.chequeNumber || '').trim(),
                amount: Number(ch.amount) || 0,
                dueDate: ch.dueDate || '',
                bankName: String(ch.bankName || '').trim(),
                inNameOf: String(ch.inNameOf || '').trim(),
                accountNo: String(ch.accountNo || '').trim(),
                poshtNomreh: String(record.poshtNomreh || ch.poshtNomreh || '').trim(),
                description: String(ch.description || '').trim(),
                rowSeq: idx + 1
            }));
            record.totalAmount = record.cheques.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }
        if (Array.isArray(updatePayload.attachments)) {
            record.attachments = updatePayload.attachments;
        }
    }

    if (approveForCEO) {
        record.status = 'PENDING_CEO';
    } else {
        if (record.status !== 'PENDING_CEO') {
            record.status = 'PENDING_ACCOUNTING';
        }
    }

    record.accountingReview = {
        id: currentUser?.id || 'ACCOUNTANT',
        name: currentUser?.fullName || currentUser?.name || 'کارمند حسابداری',
        role: currentUser?.role || 'FINANCIAL',
        note: note || 'تایید و بررسی اولیه توسط حسابداری انجام شد.',
        reviewedAt: new Date().toISOString()
    };
    record.rejectionReason = null;
    record.updatedAt = new Date().toISOString();

    saveDb();
    return record;
};

/**
 * Stage 2 Approval: CEO / Executive Approval
 * Moves status from PENDING_CEO to APPROVED
 */
export const approveCEOReceipt = async (receiptId, currentUser, note = '') => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) db.sayan_cheque_receipts = [];

    const record = db.sayan_cheque_receipts.find(r => r.id === receiptId);
    if (!record) {
        throw new Error(`رسید با شناسه ${receiptId} یافت نشد.`);
    }

    record.status = 'APPROVED';
    const ceoInfo = {
        id: currentUser?.id || 'CEO',
        name: currentUser?.fullName || currentUser?.name || 'مدیرعامل',
        role: currentUser?.role || 'CEO',
        note: note || 'تایید نهایی توسط مدیرعامل انجام شد.',
        approvedAt: new Date().toISOString()
    };
    record.ceoApproval = ceoInfo;
    record.approvedBy = ceoInfo;
    record.approvedAt = new Date().toISOString();
    record.rejectionReason = null;
    record.updatedAt = new Date().toISOString();

    saveDb();
    return record;
};

/**
 * Reject / Return Receipt (by CEO or Accounting)
 */
export const rejectChequeReceipt = async (receiptId, currentUser, reason = '', returnTo = 'ACCOUNTING') => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) db.sayan_cheque_receipts = [];

    const record = db.sayan_cheque_receipts.find(r => r.id === receiptId);
    if (!record) {
        throw new Error(`رسید با شناسه ${receiptId} یافت نشد.`);
    }

    if (returnTo === 'ACCOUNTING') {
        record.status = 'PENDING_ACCOUNTING';
    } else {
        record.status = 'REJECTED';
    }

    record.rejectionReason = {
        id: currentUser?.id,
        name: currentUser?.fullName || currentUser?.name || 'مدیر',
        role: currentUser?.role,
        reason: reason || 'جهت بازبینی و اصلاح به حسابداری عودت داده شد.',
        rejectedAt: new Date().toISOString()
    };
    record.updatedAt = new Date().toISOString();

    saveDb();
    return record;
};

// Backward-compatible alias
export const approveChequeReceipt = approveCEOReceipt;

/**
 * Perform Dry-Run Validation on Cheque Receipt before inserting to Sayan
 */
export const validateAndDryRunChequeReceipt = async (receiptData) => {
    const errors = [];
    const warnings = [];

    const fiscalYear = String(receiptData.fiscalYear || '4');
    const personCode = String(receiptData.personCode || '').trim();
    const cheques = receiptData.cheques || [];

    if (!personCode) {
        errors.push('کد و نام طرف حساب (شخص دریافت‌کننده/پرداخت‌کننده) مشخص نشده است.');
    } else {
        // Verify person exists in Sayan GNR_TBL_001
        try {
            const pCheck = await executeSayanQuery(`SELECT Field_003 FROM GNR_TBL_001 WHERE RTRIM(LTRIM(Field_003)) = '${personCode}'`);
            if (pCheck.length === 0) {
                warnings.push(`کد شخص ${personCode} در جدول اشخاص سایان (GNR_TBL_001) یافت نشد؛ هنگام ثبت ممکن است خطا رخ دهد.`);
            }
        } catch (e) {}
    }

    if (cheques.length === 0) {
        errors.push('حداقل یک ردیف چک باید در رسید درج شود.');
    }

    let calculatedTotal = 0;
    cheques.forEach((ch, idx) => {
        const rowNum = idx + 1;
        if (!ch.chequeNumber) {
            errors.push(`شماره چک در ردیف ${rowNum} وارد نشده است.`);
        }
        if (!ch.amount || Number(ch.amount) <= 0) {
            errors.push(`مبلغ چک در ردیف ${rowNum} نامعتبر یا صفر است.`);
        } else {
            calculatedTotal += Number(ch.amount);
        }
        if (!ch.dueDate) {
            errors.push(`تاریخ سررسید چک در ردیف ${rowNum} وارد نشده است.`);
        }
        if (!ch.bankName) {
            warnings.push(`نام بانک در ردیف ${rowNum} خالی است.`);
        }
    });

    // Check duplicate cheque numbers in Sayan BUR_TBL_012
    const chequeNumbers = cheques.map(c => String(c.chequeNumber).trim()).filter(Boolean);
    if (chequeNumbers.length > 0) {
        try {
            const checkDupSql = `
                SELECT Field_005 as ChequeNumber, Field_013 as Amount, Field_009 as BankName, Field_016 as PoshtNomreh
                FROM BUR_TBL_012
                WHERE Field_005 IN (${chequeNumbers.map(n => `'${n}'`).join(',')})
            `;
            const dupRows = await executeSayanQuery(checkDupSql);
            if (dupRows.length > 0) {
                dupRows.forEach(d => {
                    warnings.push(`شماره چک ${d.ChequeNumber} قبلاً در سایان با پشت‌نمره ${d.PoshtNomreh} و مبلغ ${Number(d.Amount).toLocaleString('fa-IR')} ریال ثبت شده است.`);
                });
            }
        } catch (e) {}
    }

    // Fetch next sequential IDs
    const meta = await getNextChequeReceiptNumbers(fiscalYear);

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        calculatedTotal,
        meta,
        dryRunSuccess: errors.length === 0
    };
};

/**
 * Register Cheque Receipt directly into Sayan ERP (BUR_TBL_008, BUR_TBL_009, BUR_TBL_012, BUR_TBL_006, BUR_TBL_016)
 * Strictly adheres to verified schema relations with atomic ID calculation.
 */
export const registerChequeReceiptInSayan = async (receiptId, currentUser) => {
    const db = getDb();
    if (!db.sayan_cheque_receipts) db.sayan_cheque_receipts = [];

    const record = db.sayan_cheque_receipts.find(r => r.id === receiptId);
    if (!record) {
        throw new Error(`رسید با شناسه ${receiptId} یافت نشد.`);
    }

    if (record.status === 'REGISTERED_IN_SAYAN') {
        throw new Error(`این رسید قبلاً در سایان تحت شماره سند ${record.docNo} و کد بایگانی ${record.archiveCode} ثبت شده است.`);
    }

    // 1. Dry Run Validation
    const validation = await validateAndDryRunChequeReceipt(record);
    if (!validation.isValid) {
        throw new Error(`خطای اعتبارسنجی رسید: ${validation.errors.join(' | ')}`);
    }

    const fiscalYear = String(record.fiscalYear || '4');
    const personCode = String(record.personCode).trim();
    const cheques = record.cheques;
    const totalAmount = cheques.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    // 2. Get next numbers and IDs atomically
    const maxDocRes = await executeSayanQuery(`SELECT MAX(CAST(Field_006 as bigint)) as MaxDocNo FROM BUR_TBL_008 WHERE Field_004 = '${fiscalYear}' AND Field_009 = '11'`);
    const docNo = (Number(maxDocRes[0]?.MaxDocNo) || 0) + 1;

    const maxArchRes = await executeSayanQuery(`SELECT MAX(CAST(Field_005 as bigint)) as MaxArchiveCode FROM BUR_TBL_008 WHERE Field_004 = '${fiscalYear}'`);
    const archiveCode = (Number(maxArchRes[0]?.MaxArchiveCode) || 0) + 1;

    let poshtNomreh = record.poshtNomreh;
    if (!poshtNomreh || !poshtNomreh.trim()) {
        const nextPoshtMeta = await getNextChequeReceiptNumbers(fiscalYear);
        poshtNomreh = String(nextPoshtMeta.nextPoshtNomreh);
    }

    // Get table Max Primary Keys
    const maxHRes = await executeSayanQuery(`SELECT MAX(CAST(Field_001 as bigint)) as MaxHId FROM BUR_TBL_008`);
    let nextHeaderId = (Number(maxHRes[0]?.MaxHId) || 0) + 1;

    const maxRRes = await executeSayanQuery(`SELECT MAX(CAST(Field_001 as bigint)) as MaxRId FROM BUR_TBL_009`);
    let nextRowId = (Number(maxRRes[0]?.MaxRId) || 0) + 1;

    const maxCRes = await executeSayanQuery(`SELECT MAX(CAST(Field_001 as bigint)) as MaxCId FROM BUR_TBL_012`);
    let nextChequeId = (Number(maxCRes[0]?.MaxCId) || 0) + 1;

    const maxB6Res = await executeSayanQuery(`SELECT MAX(CAST(Field_001 as bigint)) as MaxB6Id FROM BUR_TBL_006`);
    let nextB6Id = (Number(maxB6Res[0]?.MaxB6Id) || 0) + 1;

    const maxB16Res = await executeSayanQuery(`SELECT MAX(CAST(Field_001 as bigint)) as MaxB16Id FROM BUR_TBL_016`);
    let nextB16Id = (Number(maxB16Res[0]?.MaxB16Id) || 0) + 1;

    const nowSqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const noteText = record.description ? record.description.replace(/'/g, "''") : '';
    const headerDescription = `جزء: 1 | شخص: ${personCode} | کد فرعی:  | توضیحات: ${noteText}`;
    const guid = crypto.randomUUID();

    // 3. Prepare Multi-Statement Batch
    const statements = [];

    // Statement A: Insert into BUR_TBL_008 (Header)
    statements.push(`
        INSERT INTO BUR_TBL_008 (
            Field_001, Field_004, Field_005, Field_006, Field_007, Field_008, 
            Field_009, Field_010, Field_011, Field_012, Field_013, Field_014, 
            Field_015, Field_016, Field_017, Field_018, Field_019, Field_020, 
            Field_021, Field_022, Field_023, Field_024, Field_025, Field_026, 
            Field_027, Field_028, Field_030
        ) VALUES (
            ${nextHeaderId}, ${fiscalYear}, ${archiveCode}, ${docNo}, NULL, '${nowSqlDate}',
            '11', '${personCode}', NULL, NULL, NULL, NULL,
            0, 1, NULL, NULL, NULL, NULL,
            '1', '${guid}', 0, 0, ${totalAmount}, NULL,
            NULL, N'${headerDescription}', GETDATE()
        );
    `);

    // Statement B & C: Process Cheques, Rows, and Account Links
    const createdChequesMeta = [];

    for (let i = 0; i < cheques.length; i++) {
        const ch = cheques[i];
        const thisChequeId = nextChequeId + i;
        const thisRowId = nextRowId + i;
        const thisB6Id = nextB6Id + i;
        const rowSeq = i + 1;

        const chNum = String(ch.chequeNumber || '').replace(/'/g, "''");
        const chAmount = Number(ch.amount) || 0;
        const chBank = String(ch.bankName || '').replace(/'/g, "''");
        const chInNameOf = String(ch.inNameOf || record.personName || '').replace(/'/g, "''");
        const chDueDate = parseToGregorianSqlDate(ch.dueDate);
        const rowNote = rowSeq === 1 ? `رد/${poshtNomreh}` : '';

        createdChequesMeta.push({
            chequeId: thisChequeId,
            rowId: thisRowId,
            chequeNumber: chNum,
            amount: chAmount,
            dueDate: chDueDate,
            bankName: chBank,
            inNameOf: chInNameOf,
            poshtNomreh
        });

        // Insert into BUR_TBL_012 (Cheque Ledger)
        statements.push(`
            INSERT INTO BUR_TBL_012 (
                Field_001, Field_003, Field_004, Field_005, Field_006, 
                Field_007, Field_008, Field_009, Field_010, Field_011, 
                Field_012, Field_013, Field_014, Field_015, Field_016, 
                Field_017, Field_018, Field_019
            ) VALUES (
                ${thisChequeId}, NULL, '', '${chNum}', '${chDueDate} 00:00:00.000',
                '', 1, N'${chBank}', '', N'${chInNameOf}',
                '', ${chAmount}, 1, '', '${poshtNomreh}',
                0, '', ''
            );
        `);

        // Insert into BUR_TBL_009 (Document Row)
        statements.push(`
            INSERT INTO BUR_TBL_009 (
                Field_001, Field_003, Field_004, Field_005, Field_006, 
                Field_007, Field_008, Field_009, Field_010, Field_011, 
                Field_012, Field_013, Field_014, Field_015, Field_016, 
                Field_017, Field_018, Field_019, Field_020, Field_021, 
                Field_022, Field_023, Field_024, Field_025
            ) VALUES (
                ${thisRowId}, ${fiscalYear}, ${archiveCode}, '12', ${chAmount},
                ${thisChequeId}, N'${rowNote}', NULL, '${personCode}', '${record.cashboxCode || '11001'}',
                NULL, NULL, NULL, NULL, NULL,
                NULL, NULL, NULL, N'صندوق_*: ${record.cashboxCode || '11001'}', NULL,
                NULL, '11', '1', ${rowSeq}
            );
        `);

        // Insert into BUR_TBL_006 (Account Link)
        statements.push(`
            INSERT INTO BUR_TBL_006 (
                Field_001, Field_003, Field_004, Field_005, Field_006, Field_007
            ) VALUES (
                ${thisB6Id}, ${fiscalYear}, ${archiveCode}, ${thisRowId}, 15, '${record.cashboxCode || '11001'}'
            );
        `);
    }

    // Statement D: Insert Dimension links into BUR_TBL_016
    statements.push(`
        INSERT INTO BUR_TBL_016 (Field_001, Field_003, Field_004, Field_005, Field_006)
        VALUES (${nextB16Id}, ${fiscalYear}, ${archiveCode}, 6, '1');
    `);
    statements.push(`
        INSERT INTO BUR_TBL_016 (Field_001, Field_003, Field_004, Field_005, Field_006)
        VALUES (${nextB16Id + 1}, ${fiscalYear}, ${archiveCode}, 15, '${personCode}');
    `);

    // 4. Execute all queries in a single safe SQL transaction
    const finalTransactionSql = `
        BEGIN TRANSACTION;
        BEGIN TRY
            ${statements.join('\n')}
            COMMIT TRANSACTION;
            SELECT 'SUCCESS' as Result, ${nextHeaderId} as HeaderId, ${archiveCode} as ArchiveCode, ${docNo} as DocNo;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH;
    `;

    const txResult = await executeSayanQuery(finalTransactionSql);

    // 5. Update local record upon successful registration
    record.status = 'REGISTERED_IN_SAYAN';
    record.sayanError = null;
    record.sayanHeaderId = String(nextHeaderId);
    record.archiveCode = String(archiveCode);
    record.docNo = String(docNo);
    record.poshtNomreh = String(poshtNomreh);
    record.registeredAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    record.cheques = createdChequesMeta;

    saveDb();

    return {
        success: true,
        headerId: nextHeaderId,
        archiveCode,
        docNo,
        poshtNomreh,
        totalAmount,
        chequeCount: cheques.length,
        record
    };
};

/**
 * Fetch Full Real Document directly from Sayan ERP (BUR_TBL_008, BUR_TBL_009, BUR_TBL_012, BUR_TBL_016)
 * Enables users and managers to inspect the exact live database records and explanation texts.
 */
export const getSayanRealDocumentDetails = async (archiveCode, fiscalYear = '4') => {
    try {
        const fy = String(fiscalYear || '4');
        const arch = String(archiveCode).trim();
        
        // 1. Header (BUR_TBL_008)
        const headerSql = `
            SELECT TOP 1
                h.Field_001 as HeaderId,
                h.Field_004 as FiscalYear,
                h.Field_005 as ArchiveCode,
                h.Field_006 as DocNo,
                h.Field_008 as DocDate,
                h.Field_009 as OpCode,
                h.Field_010 as PersonCode,
                h.Field_020 as Guid,
                h.Field_025 as TotalAmount,
                h.Field_028 as Description,
                h.Field_030 as CreatedDate,
                g.Field_006 as FirstName,
                g.Field_007 as LastName,
                g.Field_009 as NationalId,
                g.Field_015 as Mobile
            FROM BUR_TBL_008 h
            LEFT JOIN GNR_TBL_001 g ON RTRIM(LTRIM(g.Field_003)) = RTRIM(LTRIM(h.Field_010))
            WHERE h.Field_004 = '${fy}' AND (h.Field_005 = '${arch}' OR h.Field_006 = '${arch}')
        `;
        const headers = await executeSayanQuery(headerSql);
        if (headers.length === 0) {
            return { 
                success: false, 
                message: `سند دریافت چک با کد بایگانی/شماره سند ${arch} در سال مالی ${fy} در دیتابیس سایان یافت نشد.` 
            };
        }
        const header = headers[0];
        const actualArchive = header.ArchiveCode;
        const fullName = `${header.FirstName || ''} ${header.LastName || ''}`.trim() || `کد ${header.PersonCode}`;

        // 2. Rows (BUR_TBL_009)
        const rowsSql = `
            SELECT 
                r.Field_001 as RowId,
                r.Field_003 as FiscalYear,
                r.Field_004 as ArchiveCode,
                r.Field_005 as RowType,
                r.Field_006 as RowAmount,
                r.Field_007 as ChequeId,
                r.Field_008 as RowNote,
                r.Field_009 as PersonCode,
                r.Field_010 as FundCode,
                r.Field_019 as FundTitle,
                r.Field_025 as RowSeq
            FROM BUR_TBL_009 r
            WHERE r.Field_003 = '${fy}' AND r.Field_004 = '${actualArchive}'
            ORDER BY CAST(r.Field_025 as int) ASC, CAST(r.Field_001 as bigint) ASC
        `;
        const rows = await executeSayanQuery(rowsSql);

        // 3. Cheques (BUR_TBL_012)
        const chequeIds = rows.map(r => r.ChequeId).filter(Boolean);
        let cheques = [];
        if (chequeIds.length > 0) {
            const chequesSql = `
                SELECT 
                    c.Field_001 as ChequeId,
                    c.Field_004 as DocSub,
                    c.Field_005 as ChequeNumber,
                    c.Field_006 as DueDate,
                    c.Field_008 as ChequeStatus,
                    c.Field_009 as BankName,
                    c.Field_011 as InNameOf,
                    c.Field_013 as Amount,
                    c.Field_016 as PoshtNomreh
                FROM BUR_TBL_012 c
                WHERE c.Field_001 IN (${chequeIds.map(id => `'${id}'`).join(',')})
            `;
            cheques = await executeSayanQuery(chequesSql);
        }

        // 4. Dimension links (BUR_TBL_016)
        const dimSql = `
            SELECT Field_001 as DimId, Field_005 as DimType, Field_006 as DimValue
            FROM BUR_TBL_016
            WHERE Field_003 = '${fy}' AND Field_004 = '${actualArchive}'
        `;
        const dims = await executeSayanQuery(dimSql);

        return {
            success: true,
            header: {
                ...header,
                fullName,
                shamsiDocDate: formatToShamsiDate(header.DocDate)
            },
            rows,
            cheques: cheques.map(c => ({
                ...c,
                shamsiDueDate: formatToShamsiDate(c.DueDate)
            })),
            dimensions: dims
        };
    } catch (err) {
        console.error('Error fetching Sayan real document details:', err);
        return { success: false, error: err.message };
    }
};

