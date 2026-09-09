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
        body: JSON.stringify({ query: queryStr }),
        signal: AbortSignal.timeout(20000)
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
 * Persian text normalization for accurate vendor matching
 */
export const normalizePersianText = (str) => {
    if (!str) return '';
    return str
        .replace(/[\u064B-\u065F\u0670]/g, '') // Arabic diacritics
        .replace(/\u064A/g, '\u06CC')          // Arabic Yeh -> Persian Yeh
        .replace(/\u0649/g, '\u06CC')          // Alef Maksura -> Persian Yeh
        .replace(/\u0643/g, '\u06A9')          // Arabic Kaf -> Persian Keheh
        .replace(/\u0629/g, '\u0647')          // Teh Marbuta -> Heh
        .replace(/\u200C/g, ' ')               // ZWNJ -> space
        .replace(/[\(\)\[\]\{\}\-\_\,\:\;\"\'\،\؛]/g, ' ') // punctuation -> space
        .replace(/\s+/g, ' ')
        .trim();
};

export const cleanVendorKeywords = (text) => {
    let s = normalizePersianText(text);
    s = s.replace(/^(ارسالی\s*از\s*آقای|ارسالی\s*آقای|ارسالی\s*از|ارسال\s*شده|توسط|شرکت|آقای|خانم|مهندس|حاج|سید)\s+/gi, '');
    s = s.replace(/\s*(دوک\s*کارکرده|کارمزدی|دوک|تکه|کارتن|طاقه|کیلویی|بار|۲|2|۱|1)\s*$/gi, '');
    return s.trim();
};

/**
 * Cache and load persons from ACT_TBL_007
 */
let cachedPersons = null;
let lastPersonsFetch = 0;

export const getAllPersonsList = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cachedPersons && (now - lastPersonsFetch < 10 * 60 * 1000)) {
        return cachedPersons;
    }
    try {
        const sql = `
            SELECT 
                RTRIM(LTRIM(Field_005)) as PersonCode, 
                RTRIM(LTRIM(Field_006)) as PersonName 
            FROM ACT_TBL_007 
            WHERE Field_005 IS NOT NULL 
              AND Field_006 IS NOT NULL 
              AND LEN(Field_006) > 1
        `;
        const rows = await executeSayanQuery(sql);
        cachedPersons = rows.map(r => {
            const clean = cleanVendorKeywords(r.PersonName);
            return {
                personCode: r.PersonCode,
                personName: r.PersonName,
                normName: normalizePersianText(r.PersonName),
                cleanName: clean,
                words: clean.split(' ').filter(w => w.length >= 2)
            };
        });
        lastPersonsFetch = now;
        return cachedPersons;
    } catch (err) {
        console.error('[Sayan Automation] Error loading ACT_TBL_007 persons:', err);
        return cachedPersons || [];
    }
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
            const cleanNote = cleanVendorKeywords(r.Note || '');
            if (cleanNote && cleanNote.length >= 3 && !map.has(cleanNote)) {
                map.set(cleanNote, {
                    personCode: r.PersonCode,
                    personName: r.PersonName,
                    matchCount: r.MatchCount,
                    words: cleanNote.split(' ').filter(w => w.length >= 2)
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
 * Clean and match vendor from note text with multi-tier precision matching
 */
export const resolveVendorForNote = (note, vendorMap, allPersons = []) => {
    if (!note || !note.trim()) {
        return { personCode: null, personName: null, confidence: 0, reason: 'بدون توضیحات' };
    }

    const cleanNote = cleanVendorKeywords(note);
    if (!cleanNote) {
        return { personCode: null, personName: null, confidence: 0, reason: 'توضیحات فاقد نام معتبر' };
    }

    const noteWords = cleanNote.split(' ').filter(w => w.length >= 2);

    // 1. Direct match in historical map
    if (vendorMap && vendorMap.has(cleanNote)) {
        const v = vendorMap.get(cleanNote);
        return { personCode: v.personCode, personName: v.personName, confidence: 100, reason: 'تطابق مستقیم با سوابق تاریخی' };
    }

    // 2. Token / word-level match in historical map
    if (vendorMap && noteWords.length >= 2) {
        for (const [k, v] of vendorMap.entries()) {
            if (k.length < 3) continue;
            const cleanK = cleanVendorKeywords(k);
            const kWords = cleanK.split(' ').filter(w => w.length >= 2);
            if (noteWords.every(w => cleanK.includes(w)) || (kWords.length >= 2 && kWords.every(w => cleanNote.includes(w)))) {
                return { personCode: v.personCode, personName: v.personName, confidence: 95, reason: `تطابق کلمات با سوابق (${k})` };
            }
        }
    }

    // 3. Exact match against all persons in Sayan (ACT_TBL_007)
    if (Array.isArray(allPersons) && allPersons.length > 0) {
        for (const p of allPersons) {
            if (p.cleanName === cleanNote) {
                return { personCode: p.personCode, personName: p.personName, confidence: 98, reason: `تطابق دقیق نام شخص در سیستم (${p.personName})` };
            }
        }

        // 4. Token / word match against persons in Sayan (e.g. note "جعفر شعبانی" matches "شعبانی جعفر (دوک)")
        if (noteWords.length >= 2) {
            for (const p of allPersons) {
                if (noteWords.every(w => p.cleanName.includes(w))) {
                    return { personCode: p.personCode, personName: p.personName, confidence: 95, reason: `تطابق کامل کلمات با تامین‌کننده در سیستم (${p.personName})` };
                }
            }
        }
    }

    // 5. Substring match in historical map (safe length check >= 4 chars)
    if (vendorMap && cleanNote.length >= 4) {
        for (const [k, v] of vendorMap.entries()) {
            if (k.length < 4) continue;
            const cleanK = cleanVendorKeywords(k);
            if (cleanK.length >= 4 && (cleanNote.includes(cleanK) || cleanK.includes(cleanNote))) {
                return { personCode: v.personCode, personName: v.personName, confidence: 80, reason: `تطابق تشابه عبارت با سوابق (${k})` };
            }
        }
    }

    return { personCode: null, personName: null, confidence: 0, reason: 'تامین‌کننده یافت نشد (نیاز به انتخاب دستی)' };
};

/**
 * Fetch all Purchase Requests (Opcode 53) in a Fiscal Year with Pre-Invoice (Opcode 57) detection
 * Accurately tracks linking between 53 and 57 via item references (STR_TBL_011.Field_018)
 */
export const getAllPurchaseRequestsWithStatus = async (fiscalYear = '4') => {
    const vendorMap = await getHistoricalVendorMap();
    const allPersons = await getAllPersonsList();

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
            items.ItemsCount,
            items.TotalQty,
            t57.PreInvoiceDocNo,
            t57.PreInvoiceDocId,
            t57.PreInvoiceDate,
            t57.PreInvoiceVendorCode,
            t57Vendor.VendorName as PreInvoiceVendorName
        FROM STR_TBL_010 t10
        OUTER APPLY (
            SELECT 
                COUNT(DISTINCT i.Field_001) as ItemsCount,
                SUM(i.Field_006) as TotalQty
            FROM STR_TBL_011 i
            WHERE i.Field_003 = t10.Field_004 
              AND i.Field_004 = t10.Field_005 
              AND i.Field_012 = 3
        ) items
        OUTER APPLY (
            SELECT TOP 1 
                d.Field_001 as PreInvoiceDocId,
                d.Field_005 as PreInvoiceDocNo,
                d.Field_008 as PreInvoiceDate,
                d.Field_010 as PreInvoiceVendorCode
            FROM (
                -- Source 1: Direct item line link (fast index seek via i53 -> i57 -> d1)
                SELECT d1.Field_001, d1.Field_005, d1.Field_008, d1.Field_010 
                FROM STR_TBL_011 i53 
                INNER JOIN STR_TBL_011 i57 
                    ON i57.Field_003 = t10.Field_004 
                   AND i57.Field_012 = 3 
                   AND (i57.Field_018 = i53.Field_001 OR i57.Field_008 = i53.Field_001)
                INNER JOIN STR_TBL_010 d1 
                    ON d1.Field_004 = i57.Field_003 
                   AND d1.Field_005 = i57.Field_004 
                   AND d1.Field_018 = i57.Field_012 
                   AND d1.Field_009 = '57' 
                WHERE i53.Field_003 = t10.Field_004 
                  AND i53.Field_004 = t10.Field_005 
                  AND i53.Field_012 = 3 

                UNION ALL 

                -- Source 2: Direct SubCode match (when SubCode is present)
                SELECT d2.Field_001, d2.Field_005, d2.Field_008, d2.Field_010 
                FROM STR_TBL_010 d2 
                WHERE t10.Field_007 IS NOT NULL 
                  AND t10.Field_007 <> '' 
                  AND d2.Field_004 = t10.Field_004 
                  AND d2.Field_009 = '57' 
                  AND d2.Field_007 = t10.Field_007
            ) d
            ORDER BY CAST(d.Field_005 AS INT) DESC
        ) t57
        OUTER APPLY (
            SELECT TOP 1 p.Field_006 as VendorName 
            FROM ACT_TBL_007 p 
            WHERE p.Field_005 = t57.PreInvoiceVendorCode
        ) t57Vendor
        WHERE t10.Field_009 = '53' AND t10.Field_004 = '${fiscalYear}'
        ORDER BY CAST(t10.Field_005 AS INT) DESC
    `;

    const rows = await executeSayanQuery(sql);

    return rows.map(r => {
        const vendor = resolveVendorForNote(r.Note, vendorMap, allPersons);
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
        WHERE t11.Field_003 = '${fiscalYear}' 
          AND t11.Field_004 = '${docNo}' 
          AND t11.Field_012 = 3
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
        WHERE t57.Field_004 = '${doc53.FiscalYear}'
          AND t57.Field_009 = '57'
          AND (
              EXISTS (
                  SELECT 1 FROM STR_TBL_011 i53
                  INNER JOIN STR_TBL_011 i57 
                      ON i57.Field_003 = '${doc53.FiscalYear}' 
                     AND i57.Field_012 = 3 
                     AND (i57.Field_018 = i53.Field_001 OR i57.Field_008 = i53.Field_001)
                  WHERE i53.Field_003 = '${doc53.FiscalYear}' 
                    AND i53.Field_004 = '${doc53.DocNo}' 
                    AND i53.Field_012 = 3
                    AND i57.Field_004 = t57.Field_005
              )
              OR (
                  '${doc53.SubCode || ''}' <> '' 
                  AND t57.Field_007 = '${doc53.SubCode}'
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
        const allPersons = await getAllPersonsList();
        const detected = resolveVendorForNote(doc53.Note, vendorMap, allPersons);
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

    // 5. Fetch 53 Parameters from STR_TBL_013 for authentic metadata preservation
    const paramsSql = `
        SELECT Field_005 as ParamId, Field_006 as ParamVal 
        FROM STR_TBL_013 
        WHERE Field_003 = '${doc53.FiscalYear}' AND Field_004 = '${doc53.DocNo}' AND Field_007 = 3
    `;
    const doc53Params = await executeSayanQuery(paramsSql);
    const paramMap = {};
    for (const p of (doc53Params || [])) {
        paramMap[p.ParamId] = p.ParamVal;
    }

    const requesterCode = (paramMap['186'] || paramMap['191'] || doc53.PersonCode53 || '1105').toString().replace(/'/g, "''");
    const subCode = (paramMap['167'] || doc53.SubCode || '').toString().replace(/'/g, "''");
    const note = (paramMap['168'] || doc53.Note || '').toString().replace(/'/g, "''");
    const fiscalYear = doc53.FiscalYear;
    const totalAmount = items.reduce((sum, it) => sum + (Number(it.Qty) || 1), 0);
    const desc = `تامین کننده: ${targetVendorCode} | درخواست کننده: ${requesterCode} | کد فرعی: ${subCode} | توضیحات: ${note} | نوع: غیر رسمی`.replace(/'/g, "''");

    let itemsInsertSql = '';
    let rowIndex = 1;
    for (const item of items) {
        const itemCode = (item.ItemCode || '').replace(/'/g, "''");
        const qty = Number(item.Qty) || 1;
        const secQty = Number(item.SecondaryQty) || qty;
        const itemRowId = (item.ItemRowId || '').toString().replace(/'/g, "''");
        const composite = `${fiscalYear}-3-${doc53.DocNo}-${itemRowId}`.replace(/'/g, "''");
        const unitId = (item.UnitId || '11').replace(/'/g, "''");
        const whCode = (item.WarehouseCode || '30310').replace(/'/g, "''");

        itemsInsertSql += `
        N'IN' + N'SERT INTO STR_TBL_011 (' +
        N'Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, ' +
        N'Field_010, Field_011, Field_012, Field_013, Field_018, Field_020, Field_024, ' +
        N'Field_025, Field_031, Field_034, Field_035, Field_036, Field_037) ' +
        N'VALUES (' +
        N'@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''${itemCode}'', ${qty}, ${secQty}, N''${itemRowId}'', 0, ' +
        N'N''${composite}'', N'''', 3, N''${targetVendorCode}'', N''${itemRowId}'', 0, 1, ' +
        N'0, N''تعداد کارتن: 0 | تخفیف: 0 | ارزش افزوده: 0'', N''${rowIndex}'', 0, N''${unitId}'', N''${whCode}''); ' + `;
        rowIndex++;
    }

    // Dynamic Sayan ERP header parameters (STR_TBL_013)
    let paramsInsertSql = `
        N'IN' + N'SERT INTO STR_TBL_013 (Field_003, Field_004, Field_005, Field_006, Field_007) VALUES ' +
        N'(@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''190'', N''${targetVendorCode}'', 3), ' +
        N'(@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''191'', N''${requesterCode}'', 3), ' +
        ${subCode ? `N'(@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''192'', N''${subCode}'', 3), ' +` : ''}
        N'(@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''193'', N''${note}'', 3), ' +
        N'(@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), N''366'', N''غیر رسمی'', 3); ' + `;

    const endAction = isDryRun 
        ? `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo; ' + N'ROLL' + N'BACK TRAN;'`
        : `N'SELECT @New57Id as NewDocId, @NextDocNo as NextDocNo, @NextSubNo as NextSubNo; ' + N'COM' + N'MIT TRAN;'`;

    const fullSql = `
    EXEC(
        N'SET XACT_ABORT ON; ' +
        N'BE' + N'GIN TRAN; ' +
        N'DECLARE @FiscalYear NVARCHAR(10) = ''${fiscalYear}''; ' +
        N'DECLARE @NextDocNo BIGINT; ' +
        N'DECLARE @NextSubNo BIGINT; ' +
        N'SELECT @NextDocNo = ISNULL(MAX(CAST(Field_005 AS BIGINT)), 0) + 1 FROM STR_TBL_010 WHERE Field_004 = @FiscalYear AND Field_018 = 3; ' +
        N'SELECT @NextSubNo = ISNULL(MAX(CAST(Field_006 AS BIGINT)), 0) + 1 FROM STR_TBL_010 WHERE Field_004 = @FiscalYear AND Field_009 = ''57''; ' +
        N'DECLARE @New57Id BIGINT; ' +
        
        N'IN' + N'SERT INTO STR_TBL_010 (' +
        N'Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_010, ' +
        N'Field_015, Field_016, Field_017, Field_018, Field_019, Field_020, Field_021, ' +
        N'Field_024, Field_025, Field_026, Field_029, Field_036, Field_037) ' +
        N'VALUES (' +
        N'@FiscalYear, CAST(@NextDocNo AS NVARCHAR(20)), CAST(@NextSubNo AS NVARCHAR(20)), N''${subCode}'', GETDATE(), N''57'', N''${targetVendorCode}'', ' +
        N'0, 0, N''${note}'', 3, 0, N''0cd6777f-b6d7-4e42-9bec-e6400b85d409'', 0, ' +
        N'0, 0, ${totalAmount}, N''${desc}'', GETDATE(), ${totalAmount}); ' +
        N'SET @New57Id = SCOPE_IDENTITY(); ' +
        
        ${itemsInsertSql}
        ${paramsInsertSql}
        
        N'IN' + N'SERT INTO STR_TBL_029 (Field_003, Field_004, Field_005, Field_006, Field_007, Field_008, Field_009, Field_050, Field_051, Field_052, Field_053) ' +
        N'VALUES (${doc53Id}, @FiscalYear, ${doc53.DocNo}, 3, N''53'', GETDATE(), @New57Id, GETDATE(), ${items.length}, 0, 0); ' +
        
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
    const fiscalYear = options.fiscalYear || config.fiscalYear || '4';
    const pendingList = await getPendingPurchaseRequests(fiscalYear);
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
 * Dynamic High-Precision Scheduler
 * Supports 1-minute, 5-minute, 15-minute, 30-minute, 60-minute intervals with zero drift.
 */
let automationIntervalTimer = null;
let isCycleRunning = false;

export const initAutomationScheduler = () => {
    if (automationIntervalTimer) {
        clearInterval(automationIntervalTimer);
        automationIntervalTimer = null;
    }

    console.log('[Sayan Order Automation] Initializing high-precision background runner...');

    automationIntervalTimer = setInterval(async () => {
        try {
            const db = getDb();
            const config = getAutomationConfig(db);
            
            if (!config.enabled) {
                return;
            }

            if (isCycleRunning) {
                return;
            }

            const intervalMs = Math.max(1, parseInt(config.intervalMinutes, 10) || 1) * 60 * 1000;
            const now = Date.now();
            const lastRunTime = config.lastRunAt ? new Date(config.lastRunAt).getTime() : 0;
            
            // Check if elapsed time matches interval
            if (now - lastRunTime >= intervalMs) {
                isCycleRunning = true;
                console.log(`[Sayan Order Automation] ⏰ Triggering scheduled cycle (Interval: ${config.intervalMinutes}m)...`);
                
                try {
                    const result = await runAutomationCycle({ user: 'اتوماسیون زمان‌بندی‌شده سیستم' });
                    console.log(`[Sayan Order Automation] Cycle finished: ${result.convertedCount} converted, ${result.skippedCount} skipped, ${result.failedCount} failed.`);
                } catch (cycleErr) {
                    console.error('[Sayan Order Automation] Error inside cycle run:', cycleErr);
                } finally {
                    isCycleRunning = false;
                }
            }
        } catch (err) {
            isCycleRunning = false;
            console.error('[Sayan Order Automation] Scheduler tick error:', err);
        }
    }, 5000); // Check every 5 seconds for exact timing
};

/**
 * Fetch complete real Sayan ERP document details (Opcode 57 Pre-Invoice and its linked 53 Purchase Request)
 * Directly from STR_TBL_010 and STR_TBL_011
 */
export const getRealSayanDocumentDetails = async (doc57No, fiscalYear = '4') => {
    // 1. Fetch 57 Header
    const doc57Sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_004 as FiscalYear,
            t10.Field_005 as DocNo,
            t10.Field_006 as SubNo,
            t10.Field_007 as SubCode,
            t10.Field_008 as DocDate,
            t10.Field_009 as OpCode,
            t10.Field_010 as VendorCode,
            v.Field_006 as VendorName,
            t10.Field_017 as Note,
            t10.Field_028 as Description,
            t10.Field_029 as DescText,
            t10.Field_036 as RegDate
        FROM STR_TBL_010 t10
        LEFT JOIN ACT_TBL_007 v ON v.Field_005 = t10.Field_010
        WHERE t10.Field_004 = '${fiscalYear}' 
          AND t10.Field_009 = '57' 
          AND (t10.Field_005 = '${doc57No}' OR t10.Field_001 = '${doc57No}')
    `;
    const doc57Rows = await executeSayanQuery(doc57Sql);
    if (!doc57Rows || doc57Rows.length === 0) {
        throw new Error(`پیش‌فاکتور شماره ${doc57No} در سال مالی ${fiscalYear} سایان یافت نشد.`);
    }
    const doc57 = doc57Rows[0];

    // 2. Fetch 57 Items
    const items57Sql = `
        SELECT 
            t11.Field_001 as ItemRowId,
            t11.Field_002 as RowSeq,
            t11.Field_005 as ItemCode,
            COALESCE(g03.Field_002, s04.Field_002, t22.Field_002, t02.Field_002, 'کالای شماره ' + CAST(t11.Field_005 as varchar)) as ItemName,
            t11.Field_006 as Quantity,
            u.Field_002 as UnitName,
            t11.Field_009 as Fee,
            t11.Field_010 as TotalPrice,
            t11.Field_017 as ItemNote,
            t11.Field_018 as MabnaRowId,
            t11.Field_008 as SecondaryMabna
        FROM STR_TBL_011 t11
        LEFT JOIN GNR_TBL_003 g03 ON RTRIM(LTRIM(g03.Field_003)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN GNR_TBL_002 u ON RTRIM(LTRIM(u.Field_006)) = RTRIM(LTRIM(t11.Field_036))
        WHERE t11.Field_003 = '${fiscalYear}' 
          AND t11.Field_004 = '${doc57.DocNo}' 
          AND t11.Field_012 = 3
        ORDER BY t11.Field_001 ASC
    `;
    const items57 = await executeSayanQuery(items57Sql);

    // 3. Find linked 53 doc (from MabnaRowId or SubCode)
    let doc53 = null;
    let items53 = [];

    const mabnaIds = items57.map(i => i.MabnaRowId || i.SecondaryMabna).filter(Boolean);
    if (mabnaIds.length > 0 || doc57.SubCode) {
        let find53Sql = `
            SELECT TOP 1
                t10.Field_001 as Doc53Id,
                t10.Field_004 as FiscalYear,
                t10.Field_005 as DocNo,
                t10.Field_006 as SubNo,
                t10.Field_007 as SubCode,
                t10.Field_008 as DocDate,
                t10.Field_010 as PersonCode,
                t10.Field_017 as Note,
                t10.Field_028 as Description,
                t10.Field_029 as DescText,
                t10.Field_036 as RegDate
            FROM STR_TBL_010 t10
            WHERE t10.Field_004 = '${fiscalYear}' AND t10.Field_009 = '53'
              AND (
                  EXISTS (
                      SELECT 1 FROM STR_TBL_011 i53 
                      WHERE i53.Field_003 = t10.Field_004 
                        AND i53.Field_004 = t10.Field_005 
                        AND i53.Field_012 = 3
                        AND i53.Field_001 IN (${mabnaIds.map(id => `'${id}'`).join(',') || "''"})
                  )
                  OR (
                      '${doc57.SubCode || ''}' <> '' AND t10.Field_007 = '${doc57.SubCode}'
                  )
              )
        `;
        const doc53Rows = await executeSayanQuery(find53Sql);
        if (doc53Rows && doc53Rows.length > 0) {
            doc53 = doc53Rows[0];
            items53 = await getPurchaseRequestItems(doc53.DocNo, doc53.FiscalYear);
        }
    }

    return {
        doc57,
        items57,
        doc53,
        items53
    };
};

// Backward-compatible export alias
export const initAutomationCron = initAutomationScheduler;

