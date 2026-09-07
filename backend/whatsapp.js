
import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import QRCodeLib from 'qrcode';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { ProxyAgent } from 'undici';
import { parseMessage } from './whatsapp/parser.js';
import * as Actions from './whatsapp/actions.js';
import * as dbManager from './db-manager.js';

const { Client, LocalAuth, MessageMedia } = wwebjs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let isReady = false;
let qrCode = null;
let qrDataUrl = null;
let clientInfo = null;
let isInitializing = false;
let lastError = null;
let connectedAt = null;
let disconnectedAt = null;
let currentAuthDir = null;
let activeProxyConfig = null;
let lastChromePath = null;

// Ring buffer of diagnostic logs (max 200 entries)
const MAX_LOGS = 200;
const diagnosticLogs = [];

export function addDiagnosticLog(level, source, message, details = null) {
    const now = new Date();
    const entry = {
        id: Math.random().toString(36).substring(2, 10),
        timestamp: now.toISOString(),
        timeStr: now.toLocaleTimeString('fa-IR', { hour12: false }) + ' - ' + now.toLocaleDateString('fa-IR'),
        level, // 'info' | 'warn' | 'error' | 'success'
        source, // 'INIT' | 'AUTH' | 'NETWORK' | 'MESSAGE' | 'PUPPETEER' | 'DIAGNOSTIC' | 'CLIENT'
        message: typeof message === 'string' ? message : JSON.stringify(message),
        details: details ? (typeof details === 'string' ? details : (details.stack || JSON.stringify(details, null, 2))) : null
    };
    diagnosticLogs.unshift(entry);
    if (diagnosticLogs.length > MAX_LOGS) {
        diagnosticLogs.pop();
    }
    if (level === 'error') {
        lastError = entry.message;
    }
    const prefix = `[WhatsApp-${source}]`;
    if (level === 'error') console.error(prefix, entry.message, details || '');
    else if (level === 'warn') console.warn(prefix, entry.message);
    else console.log(prefix, entry.message);
}

const getDb = dbManager.getDb;

function findChromeExecutable() {
    // 1. Explicit env var
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    // 2. Try Puppeteer default executable
    try {
        const pPath = puppeteer.executablePath();
        if (pPath && fs.existsSync(pPath)) {
            return pPath;
        }
    } catch (e) {}

    // 3. Platform-specific standard paths
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    if (isWin) {
        const winPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : null,
            process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe') : null,
            'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
        ].filter(Boolean);

        for (const p of winPaths) {
            if (fs.existsSync(p)) return p;
        }
    } else if (isMac) {
        const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ];
        for (const p of macPaths) {
            if (fs.existsSync(p)) return p;
        }
    } else {
        // Linux / Docker
        const linuxPaths = [
            '/root/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/usr/bin/brave-browser'
        ];
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }
    }

    return null;
}

/**
 * Remove stale Chrome locks and kill orphaned Chrome browser processes
 */
export const cleanSessionLocks = (authDir = currentAuthDir, sessionName = 'session-main_session') => {
    try {
        if (!authDir) return;
        const targetDir = path.resolve(authDir);
        
        // 1. Terminate orphaned Chrome processes holding this session
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /IM chrome.exe /FI "COMMANDLINE eq *${sessionName}*" >nul 2>&1 || exit 0`, { stdio: 'ignore', shell: true });
            } else {
                execSync(`pkill -9 -f "${sessionName}" 2>/dev/null || true`, { stdio: 'ignore' });
            }
        } catch (e) {}

        // 2. Remove Chrome Singleton lock symlinks and stale files
        const sessionDir = path.join(targetDir, sessionName);
        if (fs.existsSync(sessionDir)) {
            const lockNames = [
                'SingletonLock',
                'SingletonCookie',
                'SingletonSocket',
                'DevToolsActivePort'
            ];
            for (const item of lockNames) {
                const target = path.join(sessionDir, item);
                try {
                    const stat = fs.lstatSync(target);
                    if (stat) {
                        fs.unlinkSync(target);
                        console.log(`>>> WhatsApp: Cleaned stale browser lock: ${item}`);
                        addDiagnosticLog('info', 'INIT', `قفل قدیمی مرورگر با موفقیت پاکسازی شد: ${item}`);
                    }
                } catch (e) {}
            }
        }
    } catch (err) {
        console.warn(">>> WhatsApp cleanSessionLocks error:", err.message);
    }
};

export const initWhatsApp = (authDir) => {
    try {
        currentAuthDir = path.resolve(authDir);
        if (client && (isReady || isInitializing)) {
            console.log(">>> WhatsApp is already initialized or initializing.");
            addDiagnosticLog('info', 'INIT', 'ماژول واتساپ قبلاً راه‌اندازی شده یا در حال حاضر در حال بارگذاری است.');
            return;
        }

        console.log(">>> Initializing WhatsApp Module...");
        addDiagnosticLog('info', 'INIT', 'آغاز راه‌اندازی ماژول واتساپ (Puppeteer & LocalAuth)');
        isInitializing = true;
        lastError = null;
        const absoluteAuthDir = currentAuthDir;

        if (!fs.existsSync(absoluteAuthDir)) {
            fs.mkdirSync(absoluteAuthDir, { recursive: true });
            addDiagnosticLog('info', 'INIT', `پوشه نشست ایجاد شد: ${absoluteAuthDir}`);
        }

        // Clean any stale locks before starting puppeteer
        cleanSessionLocks(absoluteAuthDir, 'session-main_session');

        // --- PROXY CONFIG ---
        const puppeteerArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions'
        ];

        let db = null;
        try { db = getDb ? getDb() : null; } catch(e) {}
        const proxy = 
            (db && db.settings && (db.settings.whatsappProxy || db.settings.proxyUrl)) ||
            process.env.WHATSAPP_PROXY ||
            process.env.PROXY_URL ||
            process.env.HTTPS_PROXY ||
            process.env.HTTP_PROXY ||
            process.env.ALL_PROXY;

        if (proxy && typeof proxy === 'string' && proxy.trim()) {
            let cleanProxy = proxy.trim();
            if (!cleanProxy.startsWith('http://') && !cleanProxy.startsWith('https://') && !cleanProxy.startsWith('socks5://') && !cleanProxy.startsWith('socks5h://')) {
                cleanProxy = `http://${cleanProxy}`;
            }
            activeProxyConfig = cleanProxy;
            console.log(`>>> WhatsApp using Proxy: ${cleanProxy}`);
            addDiagnosticLog('info', 'NETWORK', `استفاده از پروکسی برای اتصال: ${cleanProxy}`);
            puppeteerArgs.push(`--proxy-server=${cleanProxy}`);
        } else {
            activeProxyConfig = null;
            addDiagnosticLog('info', 'NETWORK', 'پروکسی اختصاصی تنظیم نشده است (اتصال مستقیم)');
        }

        const executablePath = findChromeExecutable();
        lastChromePath = executablePath;
        if (executablePath) {
            console.log(`>>> WhatsApp using Chrome at: ${executablePath}`);
            addDiagnosticLog('info', 'PUPPETEER', `مرورگر در مسیر شناسایی شد: ${executablePath}`);
        } else {
            console.warn(`>>> Warning: Chrome executable not explicitly found, letting Puppeteer try default.`);
            addDiagnosticLog('warn', 'PUPPETEER', 'مسیر صریح کروم یافت نشد، پپتیر از مرورگر پیش‌فرض استفاده خواهد کرد.');
        }

        const puppeteerConfig = {
            headless: true,
            args: puppeteerArgs,
            authTimeoutMs: 60000,
        };
        if (executablePath) {
            puppeteerConfig.executablePath = executablePath;
        }

        client = new Client({ 
            authStrategy: new LocalAuth({ clientId: 'main_session', dataPath: absoluteAuthDir }), 
            puppeteer: puppeteerConfig,
            webVersionCache: { type: 'none' }
        });

        client.on('qr', async (qr) => { 
            qrCode = qr; 
            isReady = false; 
            clientInfo = null;
            isInitializing = false;
            lastError = null;
            addDiagnosticLog('info', 'AUTH', 'کد QR تولید شد و در انتظار اسکن توسط واتساپ گوشی است.');
            try {
                qrDataUrl = await QRCodeLib.toDataURL(qr, { width: 260, margin: 1 });
            } catch (err) {
                qrDataUrl = null;
            }
            console.log("\n>>> WHATSAPP QR CODE RECEIVED (Scan below):");
            qrcode.generate(qr, { small: true }); 
        });
        
        client.on('authenticated', () => { 
            console.log(">>> WhatsApp Authenticated ✅"); 
            addDiagnosticLog('success', 'AUTH', 'نشست واتساپ با موفقیت احراز هویت شد (Authenticated) ✅');
            qrCode = null; 
            qrDataUrl = null;
            isInitializing = false;
            lastError = null;
        });

        client.on('ready', () => { 
            isReady = true; 
            qrCode = null; 
            qrDataUrl = null;
            isInitializing = false;
            lastError = null;
            connectedAt = new Date().toISOString();
            clientInfo = client.info && client.info.wid ? client.info.wid.user : 'Connected'; 
            console.log(`>>> WhatsApp Ready! User: ${clientInfo} ✅`); 
            addDiagnosticLog('success', 'CLIENT', `واتساپ به طور کامل متصل و آنلاین شد (کاربر: ${clientInfo}) ✅`);
        });

        client.on('auth_failure', (msg) => {
            console.error(">>> WhatsApp Auth Failure:", msg);
            lastError = "خطای احراز هویت: " + msg;
            isReady = false;
            isInitializing = false;
            addDiagnosticLog('error', 'AUTH', `خطای احراز هویت واتساپ: ${msg}`, 'نشست منقضی شده یا از روی تلفن خارج شده است.');
        });

        client.on('disconnected', (reason) => {
            console.warn(">>> WhatsApp Disconnected:", reason);
            disconnectedAt = new Date().toISOString();
            isReady = false;
            qrCode = null;
            qrDataUrl = null;
            clientInfo = null;
            isInitializing = false;
            addDiagnosticLog('warn', 'CLIENT', `ارتباط واتساپ قطع شد. دلیل: ${reason}`);
        });

        client.on('change_state', (state) => {
            addDiagnosticLog('info', 'CLIENT', `وضعیت کلاینت واتساپ به ${state} تغییر یافت.`);
        });

        client.on('loading_screen', (percent, message) => {
            addDiagnosticLog('info', 'CLIENT', `بارگذاری صفحه وب واتساپ: ${percent}% ${message || ''}`);
        });

        // Helper to normalize phone numbers (convert 989..., +989..., 09... to standard 09...)
        const normalizePhoneNumber = (phone) => {
            if (!phone) return '';
            let digits = String(phone).replace(/\D/g, '');
            if (digits.startsWith('989') && digits.length === 12) {
                digits = '0' + digits.substring(2);
            } else if (digits.startsWith('9') && digits.length === 10) {
                digits = '0' + digits;
            }
            return digits;
        };

        // Check if a sender is authorized to receive reports or execute commands
        const getAuthorizedUser = (db, msg) => {
            if (!db || !msg) return null;
            if (msg.fromMe) return null;

            const isGroup = msg.from && msg.from.includes('@g.us');
            const settings = db.settings || {};

            // 1. Group Whitelist Check
            if (isGroup) {
                const allowedGroupIds = [
                    settings.botAccountingGroupIdWhatsApp,
                    settings.whatsappReportsGroupId,
                    settings.botBijakGroupIdWhatsApp,
                    settings.exitPermitNotificationGroup,
                    settings.dailySalesWhatsappGroupId,
                    settings.chequeVaultWhatsappGroupId,
                    settings.dailyExitReportDedicatedWhatsAppId,
                    settings.whatsappGroupId
                ].filter(Boolean).map(id => String(id).trim().toLowerCase());

                const currentGroupId = String(msg.from).trim().toLowerCase();
                const isAllowedGroup = allowedGroupIds.some(id => 
                    currentGroupId === id || currentGroupId.includes(id) || id.includes(currentGroupId.replace('@g.us', ''))
                );

                if (!isAllowedGroup) {
                    // Group is not configured in system settings -> ignore completely!
                    return null;
                }

                // In authorized groups, commands MUST start with '!' or '/'
                const body = (msg.body || '').trim();
                if (!body.startsWith('!') && !body.startsWith('/')) {
                    return null;
                }
            }

            // 2. Identify sender phone number
            const senderJid = isGroup ? (msg.author || msg.from) : msg.from;
            if (!senderJid) return null;
            const senderRawNumber = senderJid.replace(/@.*/, '');
            const senderNormalizedPhone = normalizePhoneNumber(senderRawNumber);

            if (!senderNormalizedPhone) return null;

            // 3. Match against db.users
            const users = Array.isArray(db.users) ? db.users : [];
            const matchedUser = users.find(u => {
                if (!u) return false;
                const uPhone = normalizePhoneNumber(u.phoneNumber || u.mobile || u.phone || u.whatsappPhone);
                return uPhone && uPhone === senderNormalizedPhone;
            });

            if (matchedUser) {
                return matchedUser;
            }

            // 4. Match against admin phones configured in settings
            const adminPhones = [
                ...(Array.isArray(settings.whatsappAdminPhones) ? settings.whatsappAdminPhones : [settings.whatsappAdminPhones]),
                ...(Array.isArray(settings.botAdminPhones) ? settings.botAdminPhones : [settings.botAdminPhones]),
                settings.adminPhone
            ].filter(Boolean).map(normalizePhoneNumber);

            if (adminPhones.includes(senderNormalizedPhone)) {
                return {
                    id: 'admin_phone_' + senderNormalizedPhone,
                    username: 'admin',
                    fullName: 'مدیر سیستم (واتساپ)',
                    role: 'admin',
                    roles: ['admin']
                };
            }

            return null;
        };
        
        client.on('message', async msg => {
            try {
                if (!msg || msg.fromMe) return;
                const body = (msg.body || '').trim();
                if (!body) return;

                const currentDb = getDb();
                if (!currentDb) return;

                // STRICT AUTHENTICATION: Only registered and permitted users can trigger bot actions!
                const authorizedUser = getAuthorizedUser(currentDb, msg);
                if (!authorizedUser) {
                    // Unauthorized sender (stranger, customer, personal chat, unconfigured group)
                    // DO NOT leak any information or reply!
                    return;
                }

                const result = await parseMessage(body, currentDb, authorizedUser);
                if (!result) return;

                const { intent, args } = result;
                let replyText = '';

                switch (intent) {
                    case 'AMBIGUOUS': replyText = `⚠️ شماره ${args.number} تکراری است.`; break;
                    case 'NOT_FOUND': replyText = `❌ سندی با شماره ${args.number} یافت نشد.`; break;
                    case 'APPROVE_PAYMENT': replyText = Actions.handleApprovePayment(currentDb, args.number, authorizedUser); break;
                    case 'REJECT_PAYMENT': replyText = Actions.handleRejectPayment(currentDb, args.number, authorizedUser); break;
                    case 'APPROVE_EXIT': replyText = Actions.handleApproveExit(currentDb, args.number, authorizedUser); break;
                    case 'REJECT_EXIT': replyText = Actions.handleRejectExit(currentDb, args.number, authorizedUser); break;
                    case 'CREATE_PAYMENT': replyText = Actions.handleCreatePayment(currentDb, args, authorizedUser); break;
                    case 'CREATE_BIJAK': replyText = Actions.handleCreateBijak(currentDb, args, authorizedUser); break;
                    case 'REPORT': replyText = Actions.handleReport(currentDb, authorizedUser); break;
                    case 'HELP': replyText = `دستورات مجاز برای کاربر ${authorizedUser.fullName || authorizedUser.username}:\n!تایید [شماره]\n!رد [شماره]\n!گزارش`; break;
                }

                if (replyText) {
                    await msg.reply(replyText);
                    addDiagnosticLog('info', 'MESSAGE', `پاسخ دستور ${intent} به کاربر مجاز (${authorizedUser.username}) در ${msg.from} ارسال شد.`);
                }

            } catch (error) { 
                console.error("Message Error:", error);
                addDiagnosticLog('error', 'MESSAGE', `خطا در پردازش پیام دریافتی: ${error.message}`, error.stack);
            }
        });

        client.initialize().catch(e => {
            console.error("WA Init Fail:", e.message);
            isInitializing = false;
            lastError = e.message;
            addDiagnosticLog('error', 'INIT', `خطا در اجرای پپتیر واتساپ: ${e.message}`, e.stack);
        });
    } catch (e) { 
        console.error("WA Module Error:", e.message);
        isInitializing = false;
        lastError = e.message;
        addDiagnosticLog('error', 'INIT', `خطا در ماژول واتساپ: ${e.message}`, e.stack);
    }
};

export const getStatus = () => {
    let uptimeSeconds = 0;
    if (isReady && connectedAt) {
        uptimeSeconds = Math.floor((Date.now() - new Date(connectedAt).getTime()) / 1000);
    }

    let browserRunning = false;
    let browserPid = null;
    try {
        if (client && client.pupBrowser) {
            browserRunning = client.pupBrowser.isConnected ? client.pupBrowser.isConnected() : true;
            const proc = client.pupBrowser.process ? client.pupBrowser.process() : null;
            if (proc && proc.pid) browserPid = proc.pid;
        }
    } catch (e) {}

    return { 
        ready: isReady, 
        qr: qrCode, 
        qrDataUrl: qrDataUrl, 
        user: clientInfo,
        initializing: isInitializing,
        error: lastError,
        state: isReady ? 'CONNECTED' : (isInitializing ? 'INITIALIZING' : (qrCode ? 'QR_READY' : (lastError ? 'ERROR' : 'DISCONNECTED'))),
        connectedAt,
        disconnectedAt,
        uptimeSeconds,
        browserStatus: {
            running: browserRunning,
            pid: browserPid
        },
        activeProxy: activeProxyConfig,
        chromePath: lastChromePath,
        authDir: currentAuthDir
    };
};

export const logout = async () => { 
    if (client) { 
        try {
            await client.logout(); 
            addDiagnosticLog('info', 'AUTH', 'خروج از حساب کاربری واتساپ با موفقیت انجام شد.');
        } catch(e) {
            console.warn("Logout warning:", e.message);
            addDiagnosticLog('warn', 'AUTH', `هشدار در خروج از حساب: ${e.message}`);
        }
        isReady = false; 
        qrCode = null; 
        qrDataUrl = null;
        clientInfo = null;
    } 
};

export const getGroups = async () => { 
    if (!client || !isReady) return []; 
    try {
        const chats = await client.getChats(); 
        const groups = chats.filter(c => c.isGroup).map(c => ({ id: c.id._serialized, name: c.name }));
        addDiagnosticLog('info', 'CLIENT', `تعداد ${groups.length} گروه واتساپ دریافت شد.`);
        return groups;
    } catch (e) {
        console.error("Failed to get WhatsApp groups:", e.message);
        addDiagnosticLog('error', 'CLIENT', `خطا در دریافت لیست گروه‌ها: ${e.message}`, e.stack);
        return [];
    }
};

export const sendMessage = async (number, text, mediaData) => {
    if (!client || !isReady) {
        const err = new Error("WhatsApp not ready (سرویس واتساپ متصل نیست)");
        addDiagnosticLog('error', 'MESSAGE', `تلاش ناموفق برای ارسال پیام به ${number} (عدم اتصال)`, err.message);
        throw err;
    }
    if (!number || typeof number !== 'string' || !number.trim() || number === 'undefined' || number === 'null') {
        const msg = `[WhatsApp Security] Refused to send message to invalid target: "${number}"`;
        console.warn(msg);
        addDiagnosticLog('warn', 'MESSAGE', msg);
        return;
    }
    let chatId = number.trim();
    if (!chatId.includes('@')) {
        const digits = chatId.replace(/\D/g, '');
        if (digits.length < 10) {
            const msg = `[WhatsApp Security] Target number is too short or invalid: "${chatId}"`;
            console.warn(msg);
            addDiagnosticLog('warn', 'MESSAGE', msg);
            return;
        }
        if (digits.length > 15) {
             chatId = `${digits}@g.us`;
        } else {
             chatId = `${digits.replace(/^0/, '98')}@c.us`;
        }
    }
    try {
        if (mediaData && mediaData.data) {
            const media = new MessageMedia(mediaData.mimeType, mediaData.data, mediaData.filename);
            await client.sendMessage(chatId, media, { caption: text || '' });
        } else if (text) {
            await client.sendMessage(chatId, text);
        }
        addDiagnosticLog('success', 'MESSAGE', `پیام با موفقیت به ${chatId} ارسال شد.`);
    } catch (err) {
        addDiagnosticLog('error', 'MESSAGE', `خطا در ارسال پیام به ${chatId}: ${err.message}`, err.stack);
        throw err;
    }
};

export const restartSession = async (authDir, clean = false) => {
    console.log(`>>> FORCE RESTARTING WHATSAPP SESSION (clean: ${clean})...`);
    addDiagnosticLog('warn', 'INIT', `درخواست راه‌اندازی مجدد نشست واتساپ (پاکسازی کامل: ${clean ? 'بله' : 'خیر'})`);
    isReady = false; 
    qrCode = null; 
    qrDataUrl = null;
    clientInfo = null;
    isInitializing = true;
    lastError = null;
    if (client) { 
        try { 
            await client.destroy(); 
            addDiagnosticLog('info', 'INIT', 'کلاینت قبلی پپتیر با موفقیت نابود (destroy) شد.');
        } catch (e) {
            console.error("Destroy error:", e.message);
            addDiagnosticLog('warn', 'INIT', `هشدار در بستن کلاینت قبلی: ${e.message}`);
        } 
        client = null; 
    }
    cleanSessionLocks(authDir, 'session-main_session');
    if (clean) {
        try {
            const absoluteAuthDir = path.resolve(authDir);
            if (fs.existsSync(absoluteAuthDir)) {
                fs.rmSync(absoluteAuthDir, { recursive: true, force: true });
                console.log(">>> Cleared WhatsApp session files:", absoluteAuthDir);
                addDiagnosticLog('info', 'INIT', `پوشه ذخیره‌سازی نشست قبلی پاکسازی شد: ${absoluteAuthDir}`);
            }
        } catch (err) {
            console.error(">>> Error clearing auth directory:", err.message);
            addDiagnosticLog('error', 'INIT', `خطا در پاکسازی پوشه نشست: ${err.message}`);
        }
    }
    setTimeout(() => { initWhatsApp(authDir); }, 2000);
};

export const getDiagnostics = async () => {
    const status = getStatus();
    
    // Check session directory stats
    let sessionStats = { exists: false, fileCount: 0, totalSizeBytes: 0 };
    if (currentAuthDir && fs.existsSync(currentAuthDir)) {
        sessionStats.exists = true;
        try {
            const getDirStats = (dirPath) => {
                let size = 0;
                let count = 0;
                const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const full = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        const sub = getDirStats(full);
                        size += sub.size;
                        count += sub.count;
                    } else {
                        try {
                            const stat = fs.statSync(full);
                            size += stat.size;
                            count++;
                        } catch (e) {}
                    }
                }
                return { size, count };
            };
            const s = getDirStats(currentAuthDir);
            sessionStats.totalSizeBytes = s.size;
            sessionStats.fileCount = s.count;
        } catch (e) {
            sessionStats.error = e.message;
        }
    }

    return {
        success: true,
        status,
        system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            uptimeSeconds: Math.floor(process.uptime()),
            chromePath: lastChromePath,
            activeProxy: activeProxyConfig,
            authDir: currentAuthDir,
            sessionStats
        },
        logs: diagnosticLogs,
        timestamp: new Date().toISOString()
    };
};

export const runDiagnosticTest = async (customProxy = null) => {
    addDiagnosticLog('info', 'DIAGNOSTIC', 'اجرای تست جامع عیب‌یابی ارتباط واتساپ...');
    const results = {
        timestamp: new Date().toISOString(),
        overallHealthy: true,
        summary: '',
        steps: []
    };

    // Step 1: Chrome / Chromium Executable
    const chrome = findChromeExecutable();
    lastChromePath = chrome;
    if (chrome && fs.existsSync(chrome)) {
        results.steps.push({
            name: 'مرورگر وب پپتیر (Chrome / Chromium)',
            key: 'chrome',
            passed: true,
            status: 'ok',
            message: `فایل اجرایی مرورگر شناسایی شد (${path.basename(chrome)})`,
            detail: chrome
        });
    } else {
        results.overallHealthy = false;
        results.steps.push({
            name: 'مرورگر وب پپتیر (Chrome / Chromium)',
            key: 'chrome',
            passed: false,
            status: 'warning',
            message: 'مسیر صریح مرورگر کروم شناسایی نشد.',
            detail: 'پپتیر ممکن است از نسخه داخلی استفاده کند یا در صورت اجرا روی سرور لینوکس نیاز به نصب chromium داشته باشد.'
        });
    }

    // Step 2: Session Storage & Write Permissions
    const authDir = currentAuthDir || path.resolve('wauth');
    try {
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }
        const testFile = path.join(authDir, `_test_write_${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'ok', 'utf8');
        fs.unlinkSync(testFile);
        results.steps.push({
            name: 'پوشه نشست و مجوزهای دیسک (Session Storage)',
            key: 'storage',
            passed: true,
            status: 'ok',
            message: 'دسترسی خواندن و نوشتن در پوشه نشست wauth معتبر است.',
            detail: authDir
        });
    } catch (err) {
        results.overallHealthy = false;
        results.steps.push({
            name: 'پوشه نشست و مجوزهای دیسک (Session Storage)',
            key: 'storage',
            passed: false,
            status: 'error',
            message: `عدم امکان نوشتن در پوشه نشست: ${err.message}`,
            detail: err.message
        });
    }

    // Step 3: Network & Proxy Reachability to WhatsApp Web
    let db = null;
    try { db = getDb ? getDb() : null; } catch(e) {}
    const proxy = customProxy ||
        (db && db.settings && (db.settings.whatsappProxy || db.settings.proxyUrl)) ||
        process.env.WHATSAPP_PROXY ||
        process.env.PROXY_URL ||
        process.env.HTTPS_PROXY ||
        process.env.HTTP_PROXY;

    const pingStart = Date.now();
    let latencyMs = 0;

    try {
        let cleanProxy = null;
        let fetchOptions = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(8000)
        };

        if (proxy && typeof proxy === 'string' && proxy.trim()) {
            cleanProxy = proxy.trim();
            if (!cleanProxy.startsWith('http://') && !cleanProxy.startsWith('https://') && !cleanProxy.startsWith('socks5://') && !cleanProxy.startsWith('socks5h://')) {
                cleanProxy = `http://${cleanProxy}`;
            }
            try {
                fetchOptions.dispatcher = new ProxyAgent(cleanProxy);
            } catch (err) {
                console.warn("ProxyAgent setup warning:", err.message);
            }
        }

        const res = await fetch('https://web.whatsapp.com', fetchOptions);
        latencyMs = Date.now() - pingStart;
        const httpStatus = res.status;
        const networkReachable = res.status >= 200 && res.status < 400;

        if (networkReachable) {
            results.steps.push({
                name: 'دسترسی شبکه به سرورهای واتساپ (web.whatsapp.com)',
                key: 'network',
                passed: true,
                status: 'ok',
                message: `ارتباط برقرار شد (پاسخ HTTP ${httpStatus} - تاخیر: ${latencyMs}ms)`,
                latencyMs,
                detail: cleanProxy ? `مسیردهی از پروکسی: ${cleanProxy}` : 'اتصال مستقیم شبکه'
            });
            addDiagnosticLog('success', 'DIAGNOSTIC', `پینگ سرور واتساپ موفق بود: ${latencyMs}ms (HTTP ${httpStatus})`);
        } else {
            results.overallHealthy = false;
            results.steps.push({
                name: 'دسترسی شبکه به سرورهای واتساپ (web.whatsapp.com)',
                key: 'network',
                passed: false,
                status: 'warning',
                message: `پاسخ غیرمنتظره از web.whatsapp.com (کد: ${httpStatus})`,
                latencyMs,
                detail: 'ممکن است فایروال یا کلودفلر درخواست را محدود کرده باشد.'
            });
            addDiagnosticLog('warn', 'DIAGNOSTIC', `پاسخ غیرمنتظره از web.whatsapp.com: HTTP ${httpStatus}`);
        }
    } catch (err) {
        latencyMs = Date.now() - pingStart;
        results.overallHealthy = false;
        let solutionTip = 'اتصال اینترنت، فیلترشکن یا پروکسی را بررسی کنید.';
        if (err.message.includes('ECONNREFUSED')) {
            solutionTip = 'پورت پروکسی باز نیست! اگر از v2rayN یا فیلترشکن استفاده می‌کنید، از روشن بودن نرم‌افزار و پورت آن مطمئن شوید.';
        } else if (err.message.includes('ETIMEDOUT') || err.message.includes('timeout') || err.name === 'TimeoutError') {
            solutionTip = 'مهلت اتصال پایان یافت (Timeout). ممکن است فیلترشکن قطع باشد یا آی‌پی مسدود باشد.';
        } else if (err.message.includes('ENOTFOUND')) {
            solutionTip = 'خطای عدم یافتن آدرس دامنه (DNS). ارتباط شبکه برقرار نیست.';
        }

        results.steps.push({
            name: 'دسترسی شبکه به سرورهای واتساپ (web.whatsapp.com)',
            key: 'network',
            passed: false,
            status: 'error',
            message: `خطای ارتباط با سرورهای واتساپ: ${err.message}`,
            latencyMs,
            detail: solutionTip
        });
        addDiagnosticLog('error', 'DIAGNOSTIC', `خطا در ارتباط با web.whatsapp.com: ${err.message}`, solutionTip);
    }

    // Step 4: WhatsApp Puppeteer Client State
    let clientStatus = 'ok';
    let clientMsg = 'کلاینت واتساپ متصل و فعال است.';
    let clientDetail = `شناسه کاربر: ${clientInfo || 'نامشخص'}`;

    if (isReady) {
        clientStatus = 'ok';
        clientMsg = `کلاینت واتساپ به طور کامل متصل و آنلاین است (کاربر: ${clientInfo})`;
    } else if (isInitializing) {
        clientStatus = 'warning';
        clientMsg = 'کلاینت واتساپ در حال راه‌اندازی مرورگر و بارگذاری صفحه وب است...';
        clientDetail = 'لطفاً چند لحظه صبر کنید تا صفحه وب بارگذاری شود.';
    } else if (qrCode) {
        clientStatus = 'warning';
        clientMsg = 'کد QR آماده است و منتظر اسکن توسط دوربین تلفن همراه است.';
        clientDetail = 'در واتساپ گوشی به بخش Linked Devices رفته و اسکن نمایید.';
    } else if (lastError) {
        clientStatus = 'error';
        clientMsg = `خطا در آخرین اتصال: ${lastError}`;
        clientDetail = 'می‌توانید دکمه «تولید مجدد QR کد» یا «پاکسازی نشست» را بزنید.';
    } else {
        clientStatus = 'warning';
        clientMsg = 'کلاینت واتساپ هنوز راه‌اندازی نشده یا نشست قطع است.';
        clientDetail = 'جهت شروع روی دکمه «تولید مجدد QR کد» کلیک کنید.';
    }

    results.steps.push({
        name: 'وضعیت اجرای ماژول واتساپ (WhatsApp Client State)',
        key: 'client',
        passed: isReady,
        status: clientStatus,
        message: clientMsg,
        detail: clientDetail
    });

    if (isReady && results.overallHealthy) {
        results.summary = 'تمامی مؤلفه‌ها فعال بوده و ارتباط با سرورهای واتساپ کاملاً پایدار است.';
    } else if (qrCode) {
        results.summary = 'ماژول با موفقیت اجرا شد و منتظر اسکن کد QR توسط اپلیکیشن واتساپ گوشی است.';
    } else if (!results.overallHealthy) {
        results.summary = 'اشکال در ارتباط شبکه یا پروکسی شناسایی شد. لطفاً وضعیت VPN یا پروکسی تنظیمی را بررسی کنید.';
    } else {
        results.summary = 'سرویس واتساپ در حال راه‌اندازی یا منتظر اتصال است.';
    }

    return results;
};

export const clearDiagnosticLogs = () => {
    diagnosticLogs.length = 0;
    addDiagnosticLog('info', 'DIAGNOSTIC', 'تاریخچه لاگ‌های عیب‌یابی توسط کاربر پاکسازی شد.');
    return true;
};
