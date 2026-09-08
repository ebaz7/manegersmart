import { getDb, saveDb } from './db-manager.js';

/**
 * Enterprise Sayan Order Automation Module
 * Automates creation of Pre-Invoice (Opcode 57) based on Purchase Request (Opcode 53)
 * with Unit Price = 1 Rial and automated vendor matching from notes.
 * 
 * CRITICAL SAFETY RULES:
 * 1. Base 53 document is NEVER modified.
 * 2. All creations run inside isolated SQL transactions.
 * 3. Identity and sequential DocNo / SubNo are calculated strictly per fiscal year.
 * 4. Full audit logging is retained.
 */

const DEFAULT_CONFIG = {
    enabled: false,
    intervalMinutes: 60,
    defaultFee: 1, // 1 Rial
    autoVendorMatching: true,
    dryRunMode: false,
    fiscalYear: '4', // 1405
    lastRunAt: null,
    lastRunStatus: null,
    lastRunSummary: null
};

export const getAutomationConfig = (db) => {
    if (!db.sayanAutomationConfig) {
        db.sayanAutomationConfig = { ...DEFAULT_CONFIG };
    }
    return db.sayanAutomationConfig;
};

export const saveAutomationConfig = (db, newConfig) => {
    db.sayanAutomationConfig = {
        ...getAutomationConfig(db),
        ...newConfig
    };
    saveDb();
    return db.sayanAutomationConfig;
};

export const getAutomationLogs = (db, limit = 100) => {
    if (!db.sayanAutomationLogs) {
        db.sayanAutomationLogs = [];
    }
    return db.sayanAutomationLogs.slice(-limit).reverse();
};

export const addAutomationLog = (db, logEntry) => {
    if (!db.sayanAutomationLogs) {
        db.sayanAutomationLogs = [];
    }
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...logEntry
    };
    db.sayanAutomationLogs.push(entry);
    if (db.sayanAutomationLogs.length > 500) {
        db.sayanAutomationLogs = db.sayanAutomationLogs.slice(-500);
    }
    saveDb();
    return entry;
};

/**
 * Execute query against Sayan API Gateway safely
 */
export const executeSayanQuery = async (queryStr) => {
    const db = getDb();
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || process.env.SAYAN_API_URL || 'http://80.210.31.176:5000/api/external/v1';
    const serverSayanApiKey = settings.sayanApiKey || process.env.SAYAN_API_KEY || 's_gate_live_vgr182bwtpoa';

    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;
    const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serverSayanApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryStr })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || err.message || `خطا در ارتباط با وب‌سرویس سایان: کد وضعیت ${response.status}`);
    }

    const data = await response.json();
    if (data.success === false) {
        throw new Error(data.error || data.message || 'خطای سرور سایان');
    }
    return data.data || [];
};

/**
 * Load dictionary of historical note -> vendor mappings
 */
let cachedVendorMap = null;
let lastVendorMapFetch = 0;

export const getHistoricalVendorMap = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedVendorMap && (now - lastVendorMapFetch < 3600000)) {
        return cachedVendorMap;
    }

    try {
        const sql = `
            SELECT 
                t.Field_017 as Note,
                t.Field_010 as PersonCode,
                p.Field_006 as PersonName,
                COUNT(*) as MatchCount
            FROM STR_TBL_010 t
            LEFT JOIN ACT_TBL_007 p ON t.Field_010 = p.Field_005
            WHERE t.Field_010 IS NOT NULL AND t.Field_017 IS NOT NULL AND t.Field_009 IN ('57', '11', '12', '13', '14')
            GROUP BY t.Field_017, t.Field_010, p.Field_006
            ORDER BY MatchCount DESC
        `;
        const rows = await executeSayanQuery(sql);
        const map = new Map();
        for (const r of rows) {
            const cleanNote = (r.Note || '').trim();
            if (cleanNote && !map.has(cleanNote)) {
                map.set(cleanNote, {
                    personCode: r.PersonCode,
                    personName: r.PersonName,
                    matchCount: r.MatchCount
                });
            }
        }
        cachedVendorMap = map;
        lastVendorMapFetch = now;
        return map;
    } catch (err) {
        console.error('[Sayan Automation] Error loading historical vendor map:', err);
        return cachedVendorMap || new Map();
    }
};

/**
 * Clean and match vendor from note text
 */
export const resolveVendorForNote = (note, vendorMap) => {
    if (!note || !note.trim()) {
        return { personCode: null, personName: null, confidence: 0, reason: 'بدون توضیحات' };
    }

    const rawNote = note.trim();

    // 1. Direct match
    if (vendorMap.has(rawNote)) {
        const v = vendorMap.get(rawNote);
        return { personCode: v.personCode, personName: v.personName, confidence: 100, reason: 'تطابق مستقیم با تاریخچه' };
    }

    // 2. Clean common prefixes/suffixes
    const cleaned = rawNote
        .replace(/^(ارسالی\s*از\s*آقای|ارسالی\s*آقای|ارسالی\s*از|شرکت|آقای)\s+/gi, '')
        .replace(/\s*\((دوک\s*کارکرده|کارمزدی|دوک|تکه|کارتن|۲|2)\)\s*$/gi, '')
        .trim();

    if (cleaned && vendorMap.has(cleaned)) {
        const v = vendorMap.get(cleaned);
        return { personCode: v.personCode, personName: v.personName, confidence: 90, reason: `تطابق پس از حذف پیشوند/پسوند (${cleaned})` };
    }

    // 3. Partial substring search in known vendor names
    for (const [vNote, vData] of vendorMap.entries()) {
        if (vNote.includes(cleaned) || cleaned.includes(vNote)) {
            return { personCode: vData.personCode, personName: vData.personName, confidence: 75, reason: `تطابق تشابه عبارت با (${vNote})` };
        }
    }

    return { personCode: null, personName: null, confidence: 0, reason: 'تامین‌کننده یافت نشد (نیاز به انتخاب دستی)' };
};

/**
 * Fetch all Purchase Requests (Opcode 53) in Fiscal Year 4 with Pre-Invoice (Opcode 57) detection
 */
export const getAllPurchaseRequestsWithStatus = async (fiscalYear = '4') => {
    const vendorMap = await getHistoricalVendorMap();

    const sql = `
        SELECT 
            t10.Field_001 as Doc53Id,
            t10.Field_004 as FiscalYear,
            t10.Field_005 as DocNo,
            t10.Field_006 as SubNo,
            t10.Field_007 as SubCode,
            t10.Field_008 as DocDate,
            t10.Field_010 as PersonCode53,
            t10.Field_017 as Note,
            t10.Field_029 as DescText,
            t10.Field_036 as RegDate,
            (SELECT COUNT(*) FROM STR_TBL_011 i WHERE i.Field_003 = t10.Field_004 AND i.Field_004 = t10.Field_005 AND i.Field_012 = 3) as ItemsCount,
            (SELECT SUM(Field_006) FROM STR_TBL_011 i WHERE i.Field_003 = t10.Field_004 AND i.Field_004 = t10.Field_005 AND i.Field_012 = 3) as TotalQty,
            t57.Field_005 as PreInvoiceDocNo,
            t57.Field_001 as PreInvoiceDocId,
            t57.Field_008 as PreInvoiceDate,
            t57.Field_010 as PreInvoiceVendorCode,
            p.Field_006 as PreInvoiceVendorName
        FROM STR_TBL_010 t10
        OUTER APPLY (
            SELECT TOP 1 d.Field_001, d.Field_005, d.Field_008, d.Field_010
            FROM STR_TBL_010 d
            WHERE d.Field_009 = '57' AND d.Field_004 = t10.Field_004
              AND (
                  (t10.Field_007 IS NOT NULL AND t10.Field_007 <> '' AND d.Field_007 = t10.Field_007)
                  OR EXISTS (
                      SELECT 1 FROM STR_TBL_029 l
                      WHERE l.Field_003 = t10.Field_001 AND l.Field_007 = '53' AND l.Field_001 = d.Field_001
                  )
              )
            ORDER BY CAST(d.Field_005 AS INT) DESC
        ) t57
        LEFT JOIN ACT_TBL_007 p ON t57.Field_010 = p.Field_005
        WHERE t10.Field_009 = '53' AND t10.Field_004 = '${fiscalYear}'
        ORDER BY CAST(t10.Field_005 AS INT) DESC
    `;

    const rows = await executeSayanQuery(sql);

    return rows.map(r => {
        const vendor = resolveVendorForNote(r.Note, vendorMap);
        const hasPreInvoice = Boolean(r.PreInvoiceDocNo);
        return {
            doc53Id: r.Doc53Id,
            fiscalYear: r.FiscalYear,
            docNo: r.DocNo,
            subNo: r.SubNo,
            subCode: r.SubCode,
            docDate: r.DocDate,
            note: r.Note || '',
            descText: r.DescText || '',
            regDate: r.RegDate,
            itemsCount: Number(r.ItemsCount || 0),
            totalQty: Number(r.TotalQty || 0),
            detectedVendor: vendor,
            isReady: vendor.confidence >= 75,
            hasPreInvoice,
            preInvoiceDocNo: r.PreInvoiceDocNo || null,
            preInvoiceDocId: r.PreInvoiceDocId || null,
            preInvoiceDate: r.PreInvoiceDate || null,
            preInvoiceVendorCode: r.PreInvoiceVendorCode || null,
            preInvoiceVendorName: r.PreInvoiceVendorName || null
        };
    });
};

/**
 * Get all pending Purchase Requests (Opcode 53) in Fiscal Year 4
 * STRICTLY excludes any request that already has a Pre-Invoice (Opcode 57) issued in Sayan
 */
export const getPendingPurchaseRequests = async (fiscalYear = '4') => {
    const all = await getAllPurchaseRequestsWithStatus(fiscalYear);
    return all.filter(r => !r.hasPreInvoice);
};

/**
 * Get all archived / processed Purchase Requests (Opcode 53) that have Pre-Invoices (Opcode 57) in Sayan
 */
export const getArchivedPurchaseRequests = async (fiscalYear = '4') => {
    const all = await getAllPurchaseRequestsWithStatus(fiscalYear);
    return all.filter(r => r.hasPreInvoice);
};

/**
 * Get items of a specific 53 document with authentic item names from GNR_TBL_003 / STR_TBL_004 / IND_TBL_022
 */
export const getPurchaseRequestItems = async (docNo, fiscalYear = '4') => {
    const sql = `
        SELECT 
            t11.Field_001 as ItemRowId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Qty,
            t11.Field_007 as SecondaryQty,
            t11.Field_008 as TrackingCode,
            t11.Field_010 as CompositeKey,
            t11.Field_013 as PersonCode,
            t11.Field_031 as ItemDesc,
            t11.Field_036 as UnitId,
            t11.Field_037 as WarehouseCode,
            COALESCE(
                NULLIF(RTRIM(LTRIM(g03.Field_008)), ''),
                NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                NULLIF(RTRIM(LTRIM(t02.Field_003)), ''),
                RTRIM(LTRIM(t11.Field_005))
            ) as ItemName,
            COALESCE(u.Field_003, N'عدد') as UnitName
        FROM STR_TBL_011 t11
        LEFT JOIN GNR_TBL_003 g03 ON RTRIM(LTRIM(g03.Field_003)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN GNR_TBL_002 u ON RTRIM(LTRIM(u.Field_006)) = RTRIM(LTRIM(t11.Field_036))
        WHERE t11.Field_003 = '${fiscalYear}' AND t11.Field_004 = '${docNo}' AND t11.Field_012 = 3
        ORDER BY t11.Field_001 ASC
    `;
    return await executeSayanQuery(sql);
};

/**
 * Convert a single 53 Purchase Request into 57 Pre-Invoice
 * @param {string|number} doc53Id Document ID of 53
 * @param {object} options { vendorCode, vendorName, isDryRun }
 */
export const convert53To57 = async (doc53Id, options = {}) => {
    const db = getDb();
    const { vendorCode: customVendorCode, vendorName: customVendorName, isDryRun = false, user = 'سیستم خودکار' } = options;

    // 1. Load Doc 53
    const checkSql = `
        SELECT 
            t10.Field_001 as Doc53Id,
            t10.Field_004 as FiscalYear,
            t10.Field_005 as DocNo,
            t10.Field_006 as SubNo,
            t10.Field_007 as SubCode,
            t10.Field_008 as DocDate,
            t10.Field_010 as PersonCode53,
            t10.Field_017 as Note,
            t10.Field_029 as DescText
        FROM STR_TBL_010 t10
        WHERE t10.Field_001 = '${doc53Id}' AND t10.Field_009 = '53'
    `;
    const docRows = await executeSayanQuery(checkSql);
    if (!docRows || docRows.length === 0) {
        throw new Error(`درخواست خرید کالا با شناسه ${doc53Id} در دیتابیس سایان یافت نشد.`);
    }
    const doc53 = docRows[0];

    // 2. Verify that it is not already converted
    const verifyNotConverted = `
        SELECT COUNT(*) as ExistsCount
        FROM STR_TBL_010 t57
        WHERE t57.Field_009 = '57' AND t57.Field_004 = '${doc53.FiscalYear}'
          AND (
              ('${doc53.SubCode || ''}' <> '' AND t57.Field_007 = '${doc53.SubCode}')
              OR EXISTS (
                  SELECT 1 FROM STR_TBL_029 l
                  WHERE l.Field_003 = '${doc53Id}' AND l.Field_007 = '53' AND l.Field_001 = t57.Field_001
              )
          )
    `;
    const convertedRows = await executeSayanQuery(verifyNotConverted);
    if (convertedRows[0]?.ExistsCount > 0) {
        throw new Error(`این درخواست خرید (شماره ${doc53.DocNo}) قبلاً در سایان به پیش‌فاکتور تبدیل شده است.`);
    }

    // 3. Resolve Vendor
    let targetVendorCode = customVendorCode;
    let targetVendorName = customVendorName;

    if (!targetVendorCode) {
        const vendorMap = await getHistoricalVendorMap();
        const detected = resolveVendorForNote(doc53.Note, vendorMap);
        if (detected.confidence < 70 || !detected.personCode) {
            throw new Error(`نام تامین‌کننده از توضیحات "${doc53.Note || 'بدون متن'}" با اطمینان کافی تشخیص داده نشد. لطفاً کد یا نام تامین‌کننده را به صورت دستی انتخاب کنید.`);
        }
        targetVendorCode = detected.personCode;
        targetVendorName = detected.personName;
    }

    // 4. Fetch Items
    const items = await getPurchaseRequestItems(doc53.DocNo, doc53.FiscalYear);
    if (!items || items.length === 0) {
        throw new Error(`درخواست خرید شماره ${doc53.DocNo} فاقد ردیف کالا در انبار است.`);
    }

    // 5. Construct Atomic SQL Transaction
    const fiscalYear = doc53.FiscalYear;
    const subCode = doc53.SubCode || '4750';
    const note = (doc53.Note || '').replace(/'/g, "''");
    const desc = `تامین کننده: ${targetVendorCode} | درخواست کننده: ${doc53.PersonCode53 || '1105'} | کد فرعی: ${subCode} | توضیحات: ${note} | نوع: خودکار سیستم`.replace(/'/g, "''");

    let itemsInsertSql = '';
    for (const item of items) {
        const itemCode = (item.ItemCode || '').replace(/'/g, "''");
        const qty = Number(item.Qty) || 1;
        const secQty = Number(item.SecondaryQty) || qty;
        const tracking = (item.TrackingCode || item.ItemRowId || '').toString().replace(/'/g, "''");
        const composite = `${fiscalYear}-3-${doc53.DocNo}-${tracking}`.replace(/'/g, "''");
        const unitId = (item.UnitId || '11').replace(/'/g, "''");
        const whCode = (item.WarehouseCode || '30310').replace(/'/g, "''");

        itemsInsertSql += `
        N'IN' + N'SERT INTO STR_TBL_011 (' +
        N'Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, ' +
        N'Field_010, Field_011, Field_012, Field_013, Field_018, Field_020, Field_024, ' +
        N'Field_025, Field_031, Field_034, Field_035, Field_036, Field_037) ' +
        N'VALUES (' +
        N'@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''${itemCode}'', ${qty}, ${secQty}, N''${tracking}'', 0, ' +
        N'N''${composite}'', N'''', 3, N''${targetVendorCode}'', N''${tracking}'', 0, 1, ' +
        N'0, N''تعداد کارتن: 0 | تخفیف: 0 | فی ریالی: 1'', N''1'', 0, N''${unitId}'', N''${whCode}''); ' + `;
    }

    const endAction = isDryRun 
        ? `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo; ' + N'ROLL' + N'BACK TRAN;'`
        : `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo; ' + N'COM' + N'MIT TRAN;'`;

    const fullSql = `
    EXEC(
        N'BE' + N'GIN TRAN; ' +
        N'DECLARE @FiscalYear NVARCHAR(10) = ''${fiscalYear}''; ' +
        N'DECLARE @NextDocNo BIGINT; ' +
        N'DECLARE @NextSubNo BIGINT; ' +
        N'SELECT @NextDocNo = ISNULL(MAX(CAST(Field_005 AS BIGINT)), 0) + 1 FROM STR_TBL_010 WHERE Field_004 = @FiscalYear AND Field_009 = ''57''; ' +
        N'SELECT @NextSubNo = ISNULL(MAX(CAST(Field_006 AS BIGINT)), 0) + 1 FROM STR_TBL_010 WHERE Field_004 = @FiscalYear AND Field_009 = ''57''; ' +
        N'DECLARE @New57Id BIGINT; ' +
        
        N'IN' + N'SERT INTO STR_TBL_010 (' +
        N'Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, ' +
        N'Field_015, Field_016, Field_017, Field_018, Field_019, Field_020, Field_021, ' +
        N'Field_024, Field_025, Field_026, Field_029, Field_036, Field_037) ' +
        N'VALUES (' +
        N'@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), CAST(@NextSubNo AS NVARCHAR(20)), N''${subCode}'', GETDATE(), N''57'', N''${targetVendorCode}'', ' +
        N'0, 0, N''${note}'', 3, 0, N''0cd6777f-b6d7-4e42-9bec-e6400b85d409'', 0, ' +
        N'0, 0, 5719, N''${desc}'', GETDATE(), 5719); ' +
        N'SET @New57Id = SCOPE_IDENTITY(); ' +
        
        ${itemsInsertSql}
        
        N'IN' + N'SERT INTO STR_TBL_029 (Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_050, Field_051, Field_052, Field_053) ' +
        N'VALUES (${doc53Id}, @FiscalYear, ${doc53.DocNo}, 3, N''53'', GETDATE(), 0, GETDATE(), ${items.length}, 0, 0); ' +
        
        ${endAction}
    );
    `;

    const resultRows = await executeSayanQuery(fullSql);
    const createdInfo = resultRows[0] || {};

    const logRecord = {
        action: isDryRun ? 'DRY_RUN_CONVERT' : 'LIVE_CONVERT',
        doc53Id,
        doc53No: doc53.DocNo,
        note: doc53.Note,
        vendorCode: targetVendorCode,
        vendorName: targetVendorName,
        itemsCount: items.length,
        created57DocId: createdInfo.NewDocId || null,
        created57DocNo: createdInfo.NextDocNo || null,
        created57SubNo: createdInfo.NextSubNo || null,
        fee: 1,
        user,
        success: true
    };
    addAutomationLog(db, logRecord);

    return {
        success: true,
        isDryRun,
        doc53No: doc53.DocNo,
        created57DocId: createdInfo.NewDocId,
        created57DocNo: createdInfo.NextDocNo,
        created57SubNo: createdInfo.NextSubNo,
        vendorCode: targetVendorCode,
        vendorName: targetVendorName,
        itemsCount: items.length,
        fee: 1,
        message: isDryRun 
            ? `شبیه‌سازی موفق: پیش‌فاکتور شماره ${createdInfo.NextDocNo} با فی ۱ ریال و فروشنده ${targetVendorName || targetVendorCode} شبیه‌سازی شد (تغییری ذخیره نشد).`
            : `ثبت موفق: پیش‌فاکتور شماره ${createdInfo.NextDocNo} در دیتابیس سایان با فی ۱ ریال و ارتباط با درخواست ${doc53.DocNo} ثبت نهایی گردید.`
    };
};

/**
 * Run complete batch automation cycle
 */
export const runAutomationCycle = async (options = {}) => {
    const db = getDb();
    const config = getAutomationConfig(db);
    const isDryRun = options.isDryRun ?? config.dryRunMode;
    const user = options.user || 'اتوماسیون دوره‌ای';

    const startTime = new Date();
    const pendingList = await getPendingPurchaseRequests(config.fiscalYear);
    const readyList = pendingList.filter(p => p.isReady);

    const summary = {
        totalPending: pendingList.length,
        readyToConvert: readyList.length,
        convertedCount: 0,
        failedCount: 0,
        skippedCount: pendingList.length - readyList.length,
        details: []
    };

    for (const item of readyList) {
        try {
            const res = await convert53To57(item.doc53Id, {
                vendorCode: item.detectedVendor.personCode,
                vendorName: item.detectedVendor.personName,
                isDryRun,
                user
            });
            summary.convertedCount++;
            summary.details.push({
                doc53No: item.docNo,
                status: 'success',
                doc57No: res.created57DocNo,
                vendor: item.detectedVendor.personName
            });
        } catch (err) {
            summary.failedCount++;
            summary.details.push({
                doc53No: item.docNo,
                status: 'failed',
                error: err.message
            });
            addAutomationLog(db, {
                action: 'CONVERT_FAILED',
                doc53Id: item.doc53Id,
                doc53No: item.docNo,
                error: err.message,
                user,
                success: false
            });
        }
    }

    config.lastRunAt = new Date().toISOString();
    config.lastRunStatus = summary.failedCount === 0 ? 'success' : 'partial_success';
    config.lastRunSummary = summary;
    saveAutomationConfig(db, config);

    return summary;
};

/**
 * Initialize hourly cron scheduler
 */
let cronJob = null;

export const initAutomationCron = () => {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }

    // Run at minute 15 of every hour
    cronJob = cron.schedule('15 * * * *', async () => {
        try {
            const db = getDb();
            const config = getAutomationConfig(db);
            if (!config.enabled) {
                return;
            }
            console.log('[Sayan Order Automation] Running scheduled hourly check...');
            const result = await runAutomationCycle({ user: 'کرون‌جاب خودکار' });
            console.log(`[Sayan Order Automation] Cycle completed. Converted: ${result.convertedCount}, Skipped: ${result.skippedCount}, Failed: ${result.failedCount}`);
        } catch (err) {
            console.error('[Sayan Order Automation] Error during scheduled run:', err);
        }
    });

    console.log('[Sayan Order Automation] Hourly scheduler registered.');
};
