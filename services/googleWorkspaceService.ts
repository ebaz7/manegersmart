import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Reuse existing app if already initialized
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/tasks.readonly',
];

const provider = new GoogleAuthProvider();
GOOGLE_WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

export const isRunningInIframe = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
};

export const openInStandaloneTab = () => {
  if (typeof window !== 'undefined') {
    window.open(window.location.href, '_blank');
  }
};

export const translateGoogleAuthError = (error: any): string => {
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === 'auth/popup-blocked') {
    return 'پنجره پاپ‌آپ ورود گوگل توسط مرورگر مسدود شده است. لطفاً مسدودکننده پاپ‌آپ (Pop-up Blocker) را غیرفعال کنید یا برنامه را در یک تب مستقل باز فرمایید.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'دامنه پیش‌نمایش در لیست دامنه‌های مجاز فایربیس ثبت نشده است. لطفاً برنامه را در تب مستقل باز کنید یا دامنه پروژه فایربیس را بررسی فرمایید.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'یک درخواست ورود دیگر در حال پردازش بود. لطفاً یک بار دیگر دکمه اتصال را لمس کنید.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'پنجره ورود به حساب گوگل قبل از اتمام توسط شما بسته شد. برای اتصال لطفا دوباره تلاش کنید.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'ورود با گوگل در تنظیمات پروژه فایربیس فعال نشده است.';
  }
  if (code === 'auth/network-request-failed') {
    return 'خطای شبکه در ارتباط با سرورهای گوگل. لطفاً اتصال اینترنت خود را بررسی نمایید.';
  }
  if (code === 'auth/internal-error') {
    return 'خطای محیط پیش‌نمایش در ایجاد ارتباط با پاپ‌آپ. برای رفع، لطفاً برنامه را در یک تب جدید باز کنید.';
  }

  if (message.includes('accessToken')) {
    return 'احراز هویت انجام شد اما توکن دسترسی به تقویم و تسک‌ها دریافت نگردید. لطفاً تیک‌های دسترسی تقویم و وظایف را در صفحه ورود گوگل علامت بزنید.';
  }

  return message || 'خطای ناشناخته در اتصال به حساب گوگل';
};

// Google Identity Services (GSI) loader for reliable client-side OAuth without iframe domain restrictions
const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'));
    if ((window as any).google?.accounts?.oauth2) return resolve();

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

export const signInWithGsi = async (clientId: string): Promise<{ email: string; name: string; accessToken: string }> => {
  await loadGsiScript();
  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not loaded');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_WORKSPACE_SCOPES.join(' ') + ' https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(`خطای گوگل: ${tokenResponse.error_description || tokenResponse.error}`));
          }
          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            return reject(new Error('توکن دسترسی از گوگل دریافت نشد'));
          }

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const userInfo = await userInfoRes.json();
            resolve({
              email: userInfo.email || 'Google User',
              name: userInfo.name || '',
              accessToken
            });
          } catch {
            resolve({
              email: 'Google User',
              name: '',
              accessToken
            });
          }
        },
        error_callback: (err: any) => {
          reject(err);
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      reject(e);
    }
  });
};

const GOOGLE_TOKEN_STORAGE_KEY_PREFIX = 'gw_access_token_';

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const getStoredGoogleTokenForUser = (userId?: string): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const key = userId ? `${GOOGLE_TOKEN_STORAGE_KEY_PREFIX}${userId}` : 'gw_access_token_global';
    const stored = localStorage.getItem(key);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

export const storeGoogleTokenForUser = (token: string, userId?: string) => {
  cachedAccessToken = token;
  try {
    const key = userId ? `${GOOGLE_TOKEN_STORAGE_KEY_PREFIX}${userId}` : 'gw_access_token_global';
    localStorage.setItem(key, token);
    localStorage.setItem('gw_access_token_global', token);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('google-auth-sync', { detail: { token, userId, action: 'login' } }));
    }
  } catch {}
};

export const removeGoogleTokenForUser = (userId?: string) => {
  cachedAccessToken = null;
  try {
    const key = userId ? `${GOOGLE_TOKEN_STORAGE_KEY_PREFIX}${userId}` : 'gw_access_token_global';
    localStorage.removeItem(key);
    localStorage.removeItem('gw_access_token_global');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('google-auth-sync', { detail: { token: null, userId, action: 'logout' } }));
    }
  } catch {}
};

// Initialize Google OAuth state listener
export const initGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (userId?: string): Promise<{ user: { email?: string | null; displayName?: string | null; uid?: string }; accessToken: string } | null> => {
  isSigningIn = true;
  const clientId = (firebaseConfig as any)?.oAuthClientId;

  // 1. Try Google Identity Services (GIS) first for iframe-safe OAuth
  if (clientId) {
    try {
      const gsiRes = await signInWithGsi(clientId);
      cachedAccessToken = gsiRes.accessToken;
      storeGoogleTokenForUser(cachedAccessToken, userId);
      return {
        user: {
          email: gsiRes.email,
          displayName: gsiRes.name,
          uid: gsiRes.email,
        },
        accessToken: gsiRes.accessToken
      };
    } catch (gsiErr: any) {
      console.warn('GIS sign in attempted, falling back to Firebase Auth:', gsiErr);
    }
  }

  // 2. Fallback to Firebase signInWithPopup
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google');
    }

    cachedAccessToken = credential.accessToken;
    storeGoogleTokenForUser(cachedAccessToken, userId);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    const friendlyMsg = translateGoogleAuthError(error);
    const enrichedError = new Error(friendlyMsg);
    (enrichedError as any).originalError = error;
    (enrichedError as any).code = error?.code;
    throw enrichedError;
  } finally {
    isSigningIn = false;
  }
};

export const getGoogleAccessToken = async (userId?: string): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  return getStoredGoogleTokenForUser(userId);
};

export const logoutGoogleWorkspace = async (userId?: string) => {
  await auth.signOut();
  removeGoogleTokenForUser(userId);
};

// Types for Google Calendar & Tasks
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated?: string;
  completed?: string;
  webViewLink?: string;
}

// Fetch user's Google Calendar events (primary calendar)
export const fetchGoogleCalendarEvents = async (
  token: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> => {
  const min = timeMin || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const max = timeMax || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString();
  
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.append('timeMin', min);
  url.searchParams.append('timeMax', max);
  url.searchParams.append('singleEvents', 'true');
  url.searchParams.append('orderBy', 'startTime');
  url.searchParams.append('maxResults', '50');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.items || [];
};

// Fetch user's Google Tasks
export const fetchGoogleTasks = async (token: string): Promise<GoogleTaskItem[]> => {
  // First fetch task lists
  const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listsRes.ok) {
    const errorText = await listsRes.text();
    throw new Error(`Google Tasks API error (${listsRes.status}): ${errorText}`);
  }

  const listsData = await listsRes.json();
  const lists = listsData.items || [];
  if (lists.length === 0) return [];

  // Fetch tasks from the first list (default list) or all lists
  const allTasks: GoogleTaskItem[] = [];
  for (const list of lists.slice(0, 3)) {
    try {
      const taskRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks?showCompleted=true&maxResults=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        if (taskData.items) {
          allTasks.push(...taskData.items);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch tasks for list', list.id, e);
    }
  }

  return allTasks;
};
