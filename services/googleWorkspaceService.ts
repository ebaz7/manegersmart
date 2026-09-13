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
  } catch {}
};

export const removeGoogleTokenForUser = (userId?: string) => {
  cachedAccessToken = null;
  try {
    const key = userId ? `${GOOGLE_TOKEN_STORAGE_KEY_PREFIX}${userId}` : 'gw_access_token_global';
    localStorage.removeItem(key);
    localStorage.removeItem('gw_access_token_global');
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

export const getReadableGoogleAuthError = (error: any): string => {
  const code = error?.code || '';
  const message = error?.message || '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code.includes('unauthorized-domain') || message.includes('unauthorized-domain')) {
    return `دامنه فعلی (${currentHost}) در لیست دامنه‌های مجاز Firebase Authentication ثبت نشده است.`;
  }
  if (code.includes('popup-closed-by-user') || message.includes('popup-closed-by-user')) {
    return 'پنجره ورود به حساب گوگل توسط کاربر قبل از تکمیل ورود بسته شد.';
  }
  if (code.includes('popup-blocked') || message.includes('popup-blocked')) {
    return 'مرورگر مانع از باز شدن پنجره پاپ‌آپ گوگل شد. لطفاً اجازه باز شدن Pop-up را در مرورگر بدهید.';
  }
  if (code.includes('cancelled-popup-request') || message.includes('cancelled-popup-request')) {
    return 'درخواست ورود لغو شد.';
  }
  if (code.includes('network-request-failed') || message.includes('network-request-failed')) {
    return 'خطای شبکه در ارتباط با سرورهای گوگل/فایربیس. لطفاً وضعیت اینترنت را بررسی کنید.';
  }
  return message || 'خطا در ارتباط با حساب گوگل';
};

export const signInWithGoogleWorkspace = async (userId?: string): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
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
    throw error;
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
