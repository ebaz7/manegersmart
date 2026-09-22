
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

/**
 * Saves a base64 string directly to the uploads directory as a physical file,
 * returning the web URL path (e.g. /uploads/1741950000_file.png).
 */
export const saveBase64ToFile = (base64String, preferredName = 'file') => {
    if (!base64String || typeof base64String !== 'string') return base64String;
    const isDataUrl = base64String.startsWith('data:');
    const isRawBase64 = !isDataUrl && base64String.length > 500 && !base64String.startsWith('http') && !base64String.startsWith('/uploads/') && /^[A-Za-z0-9+/=\s]+$/.test(base64String.substring(0, 100));
    
    if (!isDataUrl && !isRawBase64) return base64String;

    try {
        let mimeType = 'image/png';
        let ext = '.png';
        let base64Data = base64String;

        if (isDataUrl) {
            const matches = base64String.match(/^data:([a-zA-Z0-9\/\-+.]+);base64,(.*)$/s);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            } else {
                base64Data = base64String.replace(/^data:.*?;base64,/, '');
            }
        }

        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
        else if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('pdf')) ext = '.pdf';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (preferredName && path.extname(preferredName)) {
            ext = path.extname(preferredName);
        }

        const cleanName = (preferredName || 'file')
            .replace(/[\/\\]/g, '')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')
            .substring(0, 50);

        const uniqueFileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${cleanName}${ext}`;
        const targetPath = path.join(UPLOADS_DIR, uniqueFileName);

        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetPath, buffer);
        console.log(`[DB Optimizer] Extracted base64 (${(buffer.length / 1024).toFixed(1)} KB) -> /uploads/${uniqueFileName}`);

        return `/uploads/${uniqueFileName}`;
    } catch (err) {
        console.error('[DB Optimizer] Failed to offload base64 to file:', err);
        return base64String;
    }
};

/**
 * Scans DB collections for base64 strings, offloads them to physical files in uploads/,
 * and replaces them with light /uploads/... URLs.
 */
export const sanitizeAndOffloadDb = (db) => {
    if (!db || typeof db !== 'object') return false;
    let modified = false;

    // 1. Exit Permits
    if (Array.isArray(db.exitPermits)) {
        db.exitPermits.forEach(permit => {
            if (Array.isArray(permit.attachments)) {
                permit.attachments.forEach(att => {
                    if (att && typeof att.data === 'string' && (att.data.startsWith('data:') || (att.data.length > 500 && !att.data.startsWith('http') && !att.data.startsWith('/uploads/')))) {
                        const newUrl = saveBase64ToFile(att.data, att.fileName || 'exit_permit_attachment');
                        if (newUrl !== att.data) {
                            att.data = newUrl;
                            att.url = newUrl;
                            modified = true;
                        }
                    }
                    if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                        const newUrl = saveBase64ToFile(att.url, att.fileName || 'exit_permit_attachment');
                        if (newUrl !== att.url) {
                            att.url = newUrl;
                            if (att.data && att.data.startsWith('data:')) att.data = newUrl;
                            modified = true;
                        }
                    }
                });
            }
            if (permit.sayanRemittanceDocImage && typeof permit.sayanRemittanceDocImage === 'string' && permit.sayanRemittanceDocImage.startsWith('data:')) {
                const newUrl = saveBase64ToFile(permit.sayanRemittanceDocImage, `sayan_remittance_${permit.permitNumber || 'doc'}`);
                permit.sayanRemittanceDocImage = newUrl;
                modified = true;
            }
        });
    }

    // 2. Orders
    if (Array.isArray(db.orders)) {
        db.orders.forEach(order => {
            if (Array.isArray(order.attachments)) {
                order.attachments.forEach(att => {
                    if (att && typeof att.data === 'string' && (att.data.startsWith('data:') || (att.data.length > 500 && !att.data.startsWith('http') && !att.data.startsWith('/uploads/')))) {
                        const newUrl = saveBase64ToFile(att.data, att.fileName || 'order_attachment');
                        if (newUrl !== att.data) {
                            att.data = newUrl;
                            att.url = newUrl;
                            modified = true;
                        }
                    }
                    if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                        const newUrl = saveBase64ToFile(att.url, att.fileName || 'order_attachment');
                        att.url = newUrl;
                        if (att.data && att.data.startsWith('data:')) att.data = newUrl;
                        modified = true;
                    }
                });
            }
        });
    }

    // 3. Trade Records
    if (Array.isArray(db.tradeRecords)) {
        db.tradeRecords.forEach(trade => {
            if (Array.isArray(trade.attachments)) {
                trade.attachments.forEach(att => {
                    if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                        att.url = saveBase64ToFile(att.url, att.fileName || 'trade_attachment');
                        modified = true;
                    }
                    if (att && typeof att.data === 'string' && att.data.startsWith('data:')) {
                        att.data = saveBase64ToFile(att.data, att.fileName || 'trade_attachment');
                        modified = true;
                    }
                });
            }
            if (trade.stages && typeof trade.stages === 'object') {
                Object.values(trade.stages).forEach(stage => {
                    if (stage && Array.isArray(stage.attachments)) {
                        stage.attachments.forEach(att => {
                            if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                                att.url = saveBase64ToFile(att.url, att.fileName || 'stage_attachment');
                                modified = true;
                            }
                        });
                    }
                });
            }
            if (Array.isArray(trade.shippingDocs)) {
                trade.shippingDocs.forEach(doc => {
                    if (doc && Array.isArray(doc.attachments)) {
                        doc.attachments.forEach(att => {
                            if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                                att.url = saveBase64ToFile(att.url, att.fileName || 'shipping_doc');
                                modified = true;
                            }
                        });
                    }
                });
            }
        });
    }

    // 4. Cheque Receipts & Sayan Cheque Receipts
    if (Array.isArray(db.chequeReceipts)) {
        db.chequeReceipts.forEach(rcpt => {
            if (rcpt.image && typeof rcpt.image === 'string' && rcpt.image.startsWith('data:')) {
                rcpt.image = saveBase64ToFile(rcpt.image, `cheque_${rcpt.chequeNumber || 'receipt'}`);
                modified = true;
            }
            if (Array.isArray(rcpt.attachments)) {
                rcpt.attachments.forEach(att => {
                    if (att && typeof att.url === 'string' && att.url.startsWith('data:')) {
                        att.url = saveBase64ToFile(att.url, att.fileName || 'cheque_attachment');
                        modified = true;
                    }
                    if (att && typeof att.data === 'string' && att.data.startsWith('data:')) {
                        att.data = saveBase64ToFile(att.data, att.fileName || 'cheque_attachment');
                        modified = true;
                    }
                });
            }
        });
    }

    // 4b. Sayan Cheque Receipts (System bursary op 11 receipts)
    if (Array.isArray(db.sayan_cheque_receipts)) {
        db.sayan_cheque_receipts.forEach(rcpt => {
            if (Array.isArray(rcpt.attachments)) {
                rcpt.attachments.forEach(att => {
                    if (!att) return;
                    if (att.fileData && typeof att.fileData === 'string' && (att.fileData.startsWith('data:') || att.fileData.length > 500)) {
                        const newUrl = saveBase64ToFile(att.fileData, att.fileName || 'cheque_attachment');
                        att.url = newUrl;
                        delete att.fileData;
                        modified = true;
                    }
                    if (att.data && typeof att.data === 'string' && (att.data.startsWith('data:') || att.data.length > 500)) {
                        const newUrl = saveBase64ToFile(att.data, att.fileName || 'cheque_attachment');
                        att.url = newUrl;
                        delete att.data;
                        modified = true;
                    }
                    if (att.url && typeof att.url === 'string' && att.url.startsWith('data:')) {
                        att.url = saveBase64ToFile(att.url, att.fileName || 'cheque_attachment');
                        modified = true;
                    }
                    if (att.fileData) {
                        delete att.fileData;
                        modified = true;
                    }
                });
            }
            if (Array.isArray(rcpt.cheques)) {
                rcpt.cheques.forEach(chq => {
                    if (chq.image && typeof chq.image === 'string' && chq.image.startsWith('data:')) {
                        chq.image = saveBase64ToFile(chq.image, `cheque_${chq.chequeNumber || 'item'}`);
                        modified = true;
                    }
                    if (chq.fileData && typeof chq.fileData === 'string' && chq.fileData.startsWith('data:')) {
                        chq.url = saveBase64ToFile(chq.fileData, `cheque_${chq.chequeNumber || 'item'}`);
                        delete chq.fileData;
                        modified = true;
                    }
                });
            }
            if (rcpt.accountingReview && Array.isArray(rcpt.accountingReview.attachments)) {
                rcpt.accountingReview.attachments.forEach(att => {
                    if (att && att.fileData) {
                        att.url = saveBase64ToFile(att.fileData, att.fileName || 'review_att');
                        delete att.fileData;
                        modified = true;
                    }
                });
            }
        });
    }

    // 5. Messages (Chat)
    if (Array.isArray(db.messages)) {
        db.messages.forEach(msg => {
            if (msg.fileUrl && typeof msg.fileUrl === 'string' && msg.fileUrl.startsWith('data:')) {
                msg.fileUrl = saveBase64ToFile(msg.fileUrl, msg.fileName || 'chat_file');
                modified = true;
            }
        });
    }

    // 6. Deep recursive safety scan across entire DB to catch ANY remaining base64 payload
    const deepClean = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string' && (val.startsWith('data:image/') || val.startsWith('data:application/pdf') || (val.length > 2000 && !val.startsWith('http') && !val.startsWith('/uploads/') && /^[A-Za-z0-9+/=\s]+$/.test(val.substring(0, 100))))) {
                const savedUrl = saveBase64ToFile(val, key);
                obj[key] = savedUrl;
                modified = true;
            } else if (val && typeof val === 'object') {
                deepClean(val);
            }
        }
    };
    try {
        deepClean(db);
    } catch (e) {}

    return modified;
};

let MEMORY_DB_CACHE = null;
let saveTimeout = null;
let isSaving = false;

export const getDb = () => {
    if (MEMORY_DB_CACHE) return MEMORY_DB_CACHE;
    try {
        const defaultDb = { 
            settings: {
                sayanApiUrl: process.env.SAYAN_API_URL || "http://80.210.31.176:5000/api/external/v1",
                sayanApiKey: process.env.SAYAN_API_KEY || "s_gate_live_vzje5nkn7q4u"
            }, 
            users: [
                { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true }
            ],
            orders: [], 
            exitPermits: [], 
            warehouseItems: [], 
            warehouseTransactions: [], 
            tradeRecords: [], 
            chequeReceipts: [],
            securityLogs: [], 
            personnelDelays: [], 
            securityIncidents: [],
            messages: [], 
            groups: [], 
            tasks: [],
            subscriptions: [],
            botSubscribers: [],
            customerBalances: [],
            customerChatCodes: [],
            fiscalYears: {},
            sequences: {},
            notes: [],
            customCalendarEvents: []
        };

        if (fs.existsSync(DB_FILE)) {
            const fileContent = fs.readFileSync(DB_FILE, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                MEMORY_DB_CACHE = { ...defaultDb, ...data };
                
                // Populate default Sayan credentials if missing
                if (!MEMORY_DB_CACHE.settings) MEMORY_DB_CACHE.settings = {};
                if (!MEMORY_DB_CACHE.settings.sayanApiUrl) {
                    MEMORY_DB_CACHE.settings.sayanApiUrl = process.env.SAYAN_API_URL || "http://80.210.31.176:5000/api/external/v1";
                }
                if (!MEMORY_DB_CACHE.settings.sayanApiKey) {
                    MEMORY_DB_CACHE.settings.sayanApiKey = process.env.SAYAN_API_KEY || "s_gate_live_vzje5nkn7q4u";
                }

                // Ensure companies and fiscalYears exist in settings
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companies)) {
                    MEMORY_DB_CACHE.settings.companies = [];
                }
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companyNames)) {
                    MEMORY_DB_CACHE.settings.companyNames = [];
                }

                // Populate companyMap from settings.companies, settings.companyNames, and fiscalYears
                const companyMap = new Map();

                // 1. From settings.companies
                (MEMORY_DB_CACHE.settings.companies || []).forEach((c, idx) => {
                    const cName = typeof c === 'string' ? c.trim() : (c && c.name ? c.name.trim() : '');
                    if (cName) {
                        companyMap.set(cName, {
                            id: (typeof c === 'object' && c.id) ? c.id : ('comp_' + idx + '_' + Date.now()),
                            name: cName,
                            showInWarehouse: (typeof c === 'object' && c.showInWarehouse !== undefined) ? c.showInWarehouse : true,
                            banks: (typeof c === 'object' && Array.isArray(c.banks)) ? c.banks : [],
                            logo: (typeof c === 'object' && c.logo) || "",
                            registrationNumber: (typeof c === 'object' && c.registrationNumber) || "",
                            nationalId: (typeof c === 'object' && c.nationalId) || "",
                            address: (typeof c === 'object' && c.address) || "",
                            phone: (typeof c === 'object' && c.phone) || "",
                            fax: (typeof c === 'object' && c.fax) || "",
                            postalCode: (typeof c === 'object' && c.postalCode) || "",
                            economicCode: (typeof c === 'object' && c.economicCode) || "",
                            letterhead: (typeof c === 'object' && c.letterhead) || ""
                        });
                    }
                });

                // 2. From settings.companyNames if companyMap doesn't have it
                (MEMORY_DB_CACHE.settings.companyNames || []).forEach((n, idx) => {
                    const name = typeof n === 'string' ? n.trim() : '';
                    if (name && !companyMap.has(name)) {
                        companyMap.set(name, {
                            id: 'comp_name_' + idx + '_' + Date.now(),
                            name,
                            showInWarehouse: true,
                            banks: []
                        });
                    }
                });

                // 3. From fiscalYears sequences if any
                if (Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears)) {
                    MEMORY_DB_CACHE.settings.fiscalYears.forEach(fy => {
                        if (fy && fy.companySequences) {
                            Object.keys(fy.companySequences).forEach((k, idx) => {
                                const name = k ? k.trim() : '';
                                if (name && !companyMap.has(name)) {
                                    companyMap.set(name, {
                                        id: 'comp_fy_' + idx + '_' + Date.now(),
                                        name,
                                        showInWarehouse: true,
                                        banks: []
                                    });
                                }
                            });
                        }
                    });
                }

                let allCompanies = Array.from(companyMap.values());
                allCompanies = allCompanies.filter(c => 
                    c.name !== 'شرکت اصلی' || 
                    c.logo || 
                    c.registrationNumber || 
                    c.nationalId || 
                    c.address || 
                    c.economicCode || 
                    (c.banks && c.banks.length > 0)
                );

                MEMORY_DB_CACHE.settings.companies = allCompanies;
                MEMORY_DB_CACHE.settings.companyNames = allCompanies.map(c => c.name);

                // Scan and extract all bank names & bank account details across database collections
                if (!Array.isArray(MEMORY_DB_CACHE.settings.operatingBankNames)) {
                    MEMORY_DB_CACHE.settings.operatingBankNames = [];
                }
                if (!Array.isArray(MEMORY_DB_CACHE.settings.bankNames)) {
                    MEMORY_DB_CACHE.settings.bankNames = [];
                }

                const extractedBanks = new Set();
                (MEMORY_DB_CACHE.settings.operatingBankNames || []).forEach(b => { if (b && typeof b === 'string' && b.trim()) extractedBanks.add(b.trim()); });
                (MEMORY_DB_CACHE.settings.bankNames || []).forEach(b => { if (b && typeof b === 'string' && b.trim()) extractedBanks.add(b.trim()); });
                if (MEMORY_DB_CACHE.settings.companyBank && typeof MEMORY_DB_CACHE.settings.companyBank === 'string' && MEMORY_DB_CACHE.settings.companyBank.trim()) {
                    extractedBanks.add(MEMORY_DB_CACHE.settings.companyBank.trim());
                }

                (MEMORY_DB_CACHE.settings.companies || []).forEach(c => {
                    if (c && Array.isArray(c.banks)) {
                        c.banks.forEach(b => {
                            if (b) {
                                const bName = typeof b === 'string' ? b : (b.bankName || '');
                                if (bName && bName.trim()) extractedBanks.add(bName.trim());
                            }
                        });
                    }
                });

                (MEMORY_DB_CACHE.orders || []).forEach(o => {
                    if (Array.isArray(o.paymentDetails)) {
                        o.paymentDetails.forEach(p => {
                            if (p && p.bankName && p.bankName.trim()) extractedBanks.add(p.bankName.trim());
                            if (p && p.recipientBank && p.recipientBank.trim()) extractedBanks.add(p.recipientBank.trim());
                        });
                    }
                });

                (MEMORY_DB_CACHE.chequeReceipts || []).forEach(c => {
                    if (c && c.bankName && c.bankName.trim()) extractedBanks.add(c.bankName.trim());
                });

                (MEMORY_DB_CACHE.tradeRecords || []).forEach(t => {
                    ['inspectionPayments', 'clearancePayments', 'shippingPayments', 'agentPayments', 'guarantees'].forEach(key => {
                        if (Array.isArray(t[key])) {
                            t[key].forEach(p => {
                                if (p && p.bank && p.bank.trim()) extractedBanks.add(p.bank.trim());
                            });
                        }
                    });
                });

                const allExtractedBankList = Array.from(extractedBanks);
                if (allExtractedBankList.length > 0) {
                    MEMORY_DB_CACHE.settings.operatingBankNames = Array.from(new Set([
                        ...MEMORY_DB_CACHE.settings.operatingBankNames,
                        ...allExtractedBankList
                    ]));
                    MEMORY_DB_CACHE.settings.bankNames = Array.from(new Set([
                        ...MEMORY_DB_CACHE.settings.bankNames,
                        ...allExtractedBankList
                    ]));
                }

                // Migrate fiscal years if they are stored at the root or as an object
                if (MEMORY_DB_CACHE.fiscalYears && Array.isArray(MEMORY_DB_CACHE.fiscalYears) && MEMORY_DB_CACHE.fiscalYears.length > 0) {
                    if (!MEMORY_DB_CACHE.settings.fiscalYears || (Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) && MEMORY_DB_CACHE.settings.fiscalYears.length === 0)) {
                        MEMORY_DB_CACHE.settings.fiscalYears = MEMORY_DB_CACHE.fiscalYears;
                    }
                } else if (MEMORY_DB_CACHE.settings.fiscalYears && !Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) && typeof MEMORY_DB_CACHE.settings.fiscalYears === 'object') {
                    // Convert object to array
                    MEMORY_DB_CACHE.settings.fiscalYears = Object.values(MEMORY_DB_CACHE.settings.fiscalYears);
                }

                if (!Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) || MEMORY_DB_CACHE.settings.fiscalYears.length === 0) {
                    MEMORY_DB_CACHE.settings.fiscalYears = [
                        { id: 'fy_1402', label: '1402', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1403', label: '1403', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1404', label: '1404', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1405', label: '1405', isClosed: false, companySequences: {}, createdAt: Date.now() }
                    ];
                }
                let activeFound = MEMORY_DB_CACHE.settings.activeFiscalYearId && MEMORY_DB_CACHE.settings.fiscalYears.some(fy => fy.id === MEMORY_DB_CACHE.settings.activeFiscalYearId);
                if (!activeFound && MEMORY_DB_CACHE.settings.fiscalYears.length > 0) {
                    MEMORY_DB_CACHE.settings.activeFiscalYearId = MEMORY_DB_CACHE.settings.fiscalYears[0].id;
                } else if (!MEMORY_DB_CACHE.settings.activeFiscalYearId) {
                    MEMORY_DB_CACHE.settings.activeFiscalYearId = 'fy_1404';
                }

                // Ensure arrays exist
                const arrays = ['users', 'botSubscribers', 'orders', 'exitPermits', 'warehouseTransactions', 'subscriptions', 'messages', 'groups', 'tasks', 'tradeRecords', 'notes', 'customerBalances', 'customerChatCodes', 'chequeReceipts', 'customCalendarEvents'];
                arrays.forEach(arr => {
                    if (!Array.isArray(MEMORY_DB_CACHE[arr])) MEMORY_DB_CACHE[arr] = [];
                });
                
                // Ensure at least one admin user exists to prevent lockout
                if (MEMORY_DB_CACHE.users.length === 0) {
                    MEMORY_DB_CACHE.users.push({ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true });
                }

                // Automatic initial migration & DB shrinkage: offload any existing base64 to /uploads/
                try {
                    const wasShrunk = sanitizeAndOffloadDb(MEMORY_DB_CACHE);
                    if (wasShrunk) {
                        console.log('[DB Optimizer] Successfully extracted base64 attachments into /uploads/. Saving lightened database.json...');
                        fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
                    }
                } catch (shrinkErr) {
                    console.error('[DB Optimizer] Initial migration error:', shrinkErr);
                }
                
                return MEMORY_DB_CACHE;
            }
        }
        MEMORY_DB_CACHE = defaultDb;
        return defaultDb;
    } catch (e) {
        console.error("DB Read Error:", e);
        return {};
    }
};

export const saveDb = (data) => {
    if (data) {
        MEMORY_DB_CACHE = data;
    }
    if (!MEMORY_DB_CACHE) return true;
    
    // Throttle disk writes to every 3 seconds to avoid event loop blockage
    if (saveTimeout) return true;
    
    saveTimeout = setTimeout(() => {
        try {
            if (isSaving) return;
            isSaving = true;
            if (MEMORY_DB_CACHE) {
                // Keep database.json completely lightweight by offloading base64 to /uploads
                try {
                    sanitizeAndOffloadDb(MEMORY_DB_CACHE);
                } catch (optErr) {
                    console.error('[DB Optimizer] Optimization on save error:', optErr);
                }
                fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
            }
            saveTimeout = null;
            isSaving = false;
        } catch (e) {
            console.error("DB Save Error:", e);
            saveTimeout = null;
            isSaving = false;
        }
    }, 3000);
    
    return true;
};

// Immediate save for critical operations (e.g. backup, restore)
export const saveDbImmediate = (data) => {
    try {
        if (data) {
            MEMORY_DB_CACHE = data;
        }
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
        if (MEMORY_DB_CACHE) {
            try {
                sanitizeAndOffloadDb(MEMORY_DB_CACHE);
            } catch (optErr) {
                console.error('[DB Optimizer] Optimization on saveImmediate error:', optErr);
            }
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
        }
        return true;
    } catch (e) {
        console.error("Immediate DB Save Error:", e);
        return false;
    }
};

export const refreshCache = () => {
    MEMORY_DB_CACHE = null;
    return getDb();
};
