import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, CheckSquare, RefreshCw, LogIn, LogOut, 
  ExternalLink, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Link2,
  Settings, Eye, EyeOff, LayoutGrid, ListFilter, Globe, CalendarDays, Maximize2
} from 'lucide-react';
import { 
  signInWithGoogleWorkspace, logoutGoogleWorkspace, getGoogleAccessToken,
  fetchGoogleCalendarEvents, fetchGoogleTasks, GoogleCalendarEvent, GoogleTaskItem,
  isRunningInIframe, openInStandaloneTab, removeGoogleTokenForUser 
} from '../services/googleWorkspaceService';
import { updateUser } from '../services/authService';
import { User } from '../types';

interface GoogleWorkspaceWidgetProps {
  currentUser?: User;
  onEventCountChange?: (count: number) => void;
  onOpenProfile?: () => void;
  onToggleDateCard?: () => void;
  isDateCardVisible?: boolean;
}

export interface GoogleCalendarSettings {
  defaultMode: 'MONTH' | 'WEEK' | 'AGENDA';
  calendarId: string;
  timeZone: string;
  showNav: boolean;
  showDate: boolean;
  showPrint: boolean;
  showTabs: boolean;
  showCalendars: boolean;
  showTz: boolean;
  hideTopDateCard: boolean;
  calendarHeight?: number;
}

export const GoogleWorkspaceWidget: React.FC<GoogleWorkspaceWidgetProps> = ({ 
  currentUser, 
  onEventCountChange, 
  onOpenProfile,
  onToggleDateCard,
  isDateCardVisible = true
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'embed_calendar' | 'agenda_events' | 'tasks'>('embed_calendar');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // User storage key for settings
  const userStorageKey = currentUser?.id ? String(currentUser.id) : (currentUser?.username || 'default');

  // Widget settings
  const [calSettings, setCalSettings] = useState<GoogleCalendarSettings>(() => {
    try {
      const saved = localStorage.getItem(`gw_cal_settings_${userStorageKey}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      defaultMode: 'MONTH',
      calendarId: currentUser?.googleLinkedEmail || '',
      timeZone: 'Asia/Tehran',
      showNav: true,
      showDate: true,
      showPrint: false,
      showTabs: true,
      showCalendars: false,
      showTz: false,
      hideTopDateCard: false,
      calendarHeight: 460
    };
  });

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gw_widget_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Save settings helper
  const handleUpdateSettings = (newSettings: Partial<GoogleCalendarSettings>) => {
    setCalSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(`gw_cal_settings_${userStorageKey}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setIframeKey(prev => prev + 1);
  };

  // Sync token state on mount, user change, or external events
  const checkTokenAndLoad = async () => {
    const cached = await getGoogleAccessToken(currentUser?.id);
    if (cached) {
      setToken(cached);
      loadData(cached);
    } else {
      setToken(null);
      setEvents([]);
      setTasks([]);
    }
  };

  useEffect(() => {
    checkTokenAndLoad();

    // Listen to global sync events from profile modal or other components
    const handleAuthSync = (e: any) => {
      if (e?.detail?.token) {
        setToken(e.detail.token);
        loadData(e.detail.token);
      } else if (e?.detail?.action === 'logout') {
        setToken(null);
        setEvents([]);
        setTasks([]);
      } else {
        checkTokenAndLoad();
      }
    };

    const handleUserUpdate = () => {
      checkTokenAndLoad();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('gw_access_token') || e.key === 'app_current_user') {
        checkTokenAndLoad();
      }
    };

    window.addEventListener('google-auth-sync', handleAuthSync);
    window.addEventListener('current-user-updated', handleUserUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('google-auth-sync', handleAuthSync);
      window.removeEventListener('current-user-updated', handleUserUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser?.id, currentUser?.googleLinkedEmail]);

  const loadData = async (tok: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [calEvents, taskItems] = await Promise.allSettled([
        fetchGoogleCalendarEvents(tok),
        fetchGoogleTasks(tok)
      ]);

      let isExpired = false;
      let hasError = false;

      if (calEvents.status === 'fulfilled') {
        setEvents(calEvents.value);
        if (onEventCountChange) onEventCountChange(calEvents.value.length);
      } else {
        const reason = calEvents.reason?.message || String(calEvents.reason);
        console.warn('Calendar fetch error:', reason);
        if (reason.includes('401') || reason.includes('403') || reason.includes('Unauthorized') || reason.includes('invalid_grant')) {
          isExpired = true;
        } else {
          hasError = true;
        }
      }

      if (taskItems.status === 'fulfilled') {
        setTasks(taskItems.value);
      } else {
        const reason = taskItems.reason?.message || String(taskItems.reason);
        console.warn('Tasks fetch error:', reason);
        if (reason.includes('401') || reason.includes('403') || reason.includes('Unauthorized') || reason.includes('invalid_grant')) {
          isExpired = true;
        } else {
          hasError = true;
        }
      }

      if (isExpired) {
        setToken(null);
        removeGoogleTokenForUser(currentUser?.id);
        setEvents([]);
        setTasks([]);
        setError('نشست حساب گوگل شما منقضی شده است. لطفا جهت تمدید مجدداً متصل شوید.');
      } else if (hasError) {
        setError('خطا در همگام‌سازی بخشی از داده‌های گوگل. لطفاً اتصال را مجدداً بررسی فرمایید.');
      }
    } catch (err: any) {
      setError(err?.message || 'خطا در ارتباط با سرویس گوگل');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const result = await signInWithGoogleWorkspace(currentUser?.id);
      if (result?.accessToken) {
        setToken(result.accessToken);
        await loadData(result.accessToken);
        // Persist link on user if available
        if (currentUser && result.user?.email) {
          try {
            const updated = {
              ...currentUser,
              googleLinkedEmail: result.user.email,
              googleLinkedAt: Date.now()
            };
            await updateUser(updated);
            // Update calendar ID if not set
            if (!calSettings.calendarId) {
              handleUpdateSettings({ calendarId: result.user.email });
            }
          } catch (e) {
            console.debug('Failed to update user profile with google info', e);
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'اتصال به حساب گوگل برقرار نشد');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('آیا از قطع اتصال حساب گوگل اطمینان دارید؟')) return;
    await logoutGoogleWorkspace(currentUser?.id);
    setToken(null);
    setEvents([]);
    setTasks([]);
    if (currentUser?.googleLinkedEmail) {
      try {
        await updateUser({
          ...currentUser,
          googleLinkedEmail: '',
          googleLinkedAt: undefined
        });
      } catch (e) {
        console.debug('Failed to clear google info on user profile', e);
      }
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('gw_widget_collapsed', String(next)); } catch {}
      return next;
    });
  };

  // Build clean Google Calendar Embed URL based on user settings
  const embedUrl = useMemo(() => {
    const calId = calSettings.calendarId || currentUser?.googleLinkedEmail || '';
    const mode = calSettings.defaultMode || 'MONTH';
    const ctz = calSettings.timeZone || 'Asia/Tehran';
    
    // Google Calendar Embed Parameters
    const params = new URLSearchParams();
    if (calId) {
      params.append('src', calId);
    }
    params.append('ctz', ctz);
    params.append('hl', 'fa');
    params.append('mode', mode);
    params.append('showTitle', '0');
    params.append('showNav', calSettings.showNav ? '1' : '0');
    params.append('showDate', calSettings.showDate ? '1' : '0');
    params.append('showPrint', calSettings.showPrint ? '1' : '0');
    params.append('showTabs', calSettings.showTabs ? '1' : '0');
    params.append('showCalendars', calSettings.showCalendars ? '1' : '0');
    params.append('showTz', calSettings.showTz ? '1' : '0');
    params.append('wkst', '7'); // Week starts on Saturday for Persian calendar

    return `https://calendar.google.com/calendar/embed?${params.toString()}`;
  }, [calSettings, currentUser?.googleLinkedEmail]);

  return (
    <div className="glass-panel rounded-2xl border border-indigo-100/90 dark:border-indigo-900/40 p-4 shadow-sm relative overflow-hidden transition-all bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/25 dark:from-zinc-900 dark:to-zinc-950">
      {/* Top Banner & Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <CalendarIcon size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                تقویم و رویدادهای گوگل (Google Workspace)
              </h3>
              {(token || currentUser?.googleLinkedEmail) && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  متصل {currentUser?.googleLinkedEmail ? `(${currentUser.googleLinkedEmail})` : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
              نمایش زنده تقویم گوگل، رویدادها، و وظایف همگام‌شده با حساب شما
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick toggle top date card if prop available */}
          {onToggleDateCard && (
            <button
              onClick={onToggleDateCard}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                isDateCardVisible 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' 
                  : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400 border-gray-200 dark:border-zinc-700'
              }`}
              title={isDateCardVisible ? 'مخفی‌سازی کارت تاریخ ساده بالای صفحه' : 'نمایش مجدد کارت تاریخ ساده بالای صفحه'}
            >
              {isDateCardVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              <span className="hidden lg:inline text-[10px]">
                {isDateCardVisible ? 'حذف تقویم ساده بالا' : 'نمایش تقویم بالا'}
              </span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showSettings 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500'
            }`}
            title="تنظیمات نمای تقویم گوگل"
          >
            <Settings size={15} />
          </button>

          {token && (
            <>
              <button
                onClick={() => {
                  loadData(token);
                  setIframeKey(prev => prev + 1);
                }}
                disabled={isLoading}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                title="بروزرسانی داده‌ها"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
              </button>
              <button
                onClick={handleDisconnect}
                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded-lg transition-colors cursor-pointer"
                title="قطع اتصال حساب گوگل"
              >
                <LogOut size={14} />
              </button>
            </>
          )}

          <button
            onClick={toggleCollapse}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 rounded-lg transition-colors cursor-pointer"
            title={isCollapsed ? 'باز کردن' : 'بستن'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {!isCollapsed && showSettings && (
        <div className="mt-3 p-3.5 bg-blue-50/50 dark:bg-zinc-900/90 rounded-xl border border-blue-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between border-b border-blue-100/80 dark:border-zinc-800 pb-2">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <Settings size={14} className="text-blue-600" />
              تنظیمات نمایش تقویم گوگل
            </span>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              بستن
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                حالت پیش‌فرض نمایش تقویم
              </label>
              <select
                value={calSettings.defaultMode}
                onChange={e => handleUpdateSettings({ defaultMode: e.target.value as any })}
                className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium"
              >
                <option value="MONTH">ماهانه (Month View)</option>
                <option value="WEEK">هفتگی (Week View)</option>
                <option value="AGENDA">برنامه زمانی روزها (Agenda)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                شناسه تقویم / ایمیل گوگل
              </label>
              <input
                type="text"
                placeholder="مثال: example@gmail.com"
                value={calSettings.calendarId}
                onChange={e => handleUpdateSettings({ calendarId: e.target.value })}
                className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono dir-ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                منطقه زمانی (Timezone)
              </label>
              <select
                value={calSettings.timeZone}
                onChange={e => handleUpdateSettings({ timeZone: e.target.value })}
                className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium"
              >
                <option value="Asia/Tehran">تهران (Asia/Tehran - IRST/IRDT)</option>
                <option value="UTC">جهانی (UTC)</option>
                <option value="Asia/Dubai">دبی (Asia/Dubai)</option>
                <option value="Europe/London">لندن (Europe/London)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={calSettings.showNav}
                onChange={e => handleUpdateSettings({ showNav: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">دکمه‌های قبلی/بعدی تقویم</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={calSettings.showTabs}
                onChange={e => handleUpdateSettings({ showTabs: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-300">تب‌های ماه/هفته در هدر تقویم</span>
            </label>

            {onToggleDateCard && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-indigo-600 dark:text-indigo-400 font-bold">
                <input
                  type="checkbox"
                  checked={!isDateCardVisible}
                  onChange={onToggleDateCard}
                  className="rounded text-indigo-600"
                />
                <span className="text-[11px]">مخفی‌سازی کارت تاریخ ساده بالای داشبورد</span>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Main Content Body */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          {!token && !currentUser?.googleLinkedEmail ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-indigo-100/70 dark:border-zinc-800 shadow-2xs">
              <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2.5">
                <CalendarIcon size={18} className="text-indigo-500 shrink-0" />
                <span>برای همگام‌سازی کامل تقویم، مشاهده تنظیمات رویدادها و وظایف با حساب گوگل خود وارد شوید:</span>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isSigningIn}
                className="gsi-material-button inline-flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-60"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>{isSigningIn ? 'در حال ارتباط...' : 'اتصال به حساب گوگل (Workspace)'}</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Tabs: Embed Calendar / Agenda Events / Tasks */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('embed_calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'embed_calendar'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <CalendarDays size={13} />
                    <span>تقویم کامل گوگل</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('agenda_events')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'agenda_events'
                        ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Clock size={13} />
                    <span>رویدادهای پیش رو</span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 px-1.5 rounded-full font-mono">
                      {events.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'tasks'
                        ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <CheckSquare size={13} />
                    <span>تسک‌های گوگل</span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 px-1.5 rounded-full font-mono">
                      {tasks.filter(t => t.status !== 'completed').length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>باز کردن در گوگل</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Tab 1: Live Interactive Google Calendar Embed */}
              {activeTab === 'embed_calendar' && (
                <div 
                  className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-inner group"
                  style={{ height: `${calSettings.calendarHeight || 460}px` }}
                >
                  <iframe
                    key={iframeKey}
                    src={embedUrl}
                    title="Google Calendar"
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                  {/* Resize Handle */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 h-4 bg-gray-100/80 dark:bg-zinc-800/80 hover:bg-gray-200 dark:hover:bg-zinc-700 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center backdrop-blur-sm z-10"
                    title="کشیدن برای تغییر ارتفاع تقویم"
                    onMouseDown={(e) => {
                      const startY = e.clientY;
                      const startHeight = calSettings.calendarHeight || 460;
                      
                      const onMouseMove = (moveEvent: MouseEvent) => {
                        let newHeight = startHeight + (moveEvent.clientY - startY);
                        if (newHeight < 250) newHeight = 250;
                        if (newHeight > 1200) newHeight = 1200;
                        setCalSettings(prev => ({ ...prev, calendarHeight: newHeight }));
                      };
                      
                      const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                        // Persist manually to avoid triggering iframe reload via handleUpdateSettings
                        setCalSettings(prev => {
                          try {
                            localStorage.setItem(`gw_cal_settings_${userStorageKey}`, JSON.stringify(prev));
                          } catch {}
                          return prev;
                        });
                      };
                      
                      window.addEventListener('mousemove', onMouseMove);
                      window.addEventListener('mouseup', onMouseUp);
                    }}
                    onTouchStart={(e) => {
                      const startY = e.touches[0].clientY;
                      const startHeight = calSettings.calendarHeight || 460;
                      
                      const onTouchMove = (moveEvent: TouchEvent) => {
                        let newHeight = startHeight + (moveEvent.touches[0].clientY - startY);
                        if (newHeight < 250) newHeight = 250;
                        if (newHeight > 1200) newHeight = 1200;
                        setCalSettings(prev => ({ ...prev, calendarHeight: newHeight }));
                      };
                      
                      const onTouchEnd = () => {
                        window.removeEventListener('touchmove', onTouchMove);
                        window.removeEventListener('touchend', onTouchEnd);
                        setCalSettings(prev => {
                          try {
                            localStorage.setItem(`gw_cal_settings_${userStorageKey}`, JSON.stringify(prev));
                          } catch {}
                          return prev;
                        });
                      };
                      
                      window.addEventListener('touchmove', onTouchMove);
                      window.addEventListener('touchend', onTouchEnd);
                    }}
                  >
                    <div className="w-12 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                  </div>
                </div>
              )}

              {/* Tab 2: Calendar events Agenda List */}
              {activeTab === 'agenda_events' && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                  {events.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
                      رویدادی برای بازه پیش رو در تقویم شما ثبت نشده است.
                    </div>
                  ) : (
                    events.map((ev) => {
                      const startDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
                      const timeStr = startDate ? startDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '';
                      const dateStr = startDate ? startDate.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', weekday: 'short' }) : '';

                      return (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-indigo-50 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-zinc-700 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
                              <Clock size={16} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">
                                {ev.summary || 'رویداد بدون عنوان'}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                                <span>{dateStr}</span>
                                {timeStr && <span>• ساعت {timeStr}</span>}
                                {ev.location && <span className="truncate max-w-[150px]">• {ev.location}</span>}
                              </div>
                            </div>
                          </div>
                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                              title="مشاهده رویداد در تقویم گوگل"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 3: Google Tasks */}
              {activeTab === 'tasks' && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
                      هیچ وظیفه‌ای در Google Tasks شما ثبت نشده است.
                    </div>
                  ) : (
                    tasks.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors shadow-2xs ${
                            isDone 
                              ? 'bg-gray-50/50 dark:bg-zinc-900/40 border-gray-200/50 dark:border-zinc-800/40 opacity-60' 
                              : 'bg-white/90 dark:bg-zinc-900/90 border-emerald-50 dark:border-zinc-800/80 hover:border-emerald-200'
                          }`}
                        >
                          <div className="mt-0.5">
                            {isDone ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-md border-2 border-gray-300 dark:border-zinc-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-bold text-gray-800 dark:text-gray-100 ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                              {task.title || 'وظیفه بدون عنوان'}
                            </h4>
                            {task.notes && (
                              <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{task.notes}</p>
                            )}
                            {task.due && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium mt-1 inline-block">
                                موعد: {new Date(task.due).toLocaleDateString('fa-IR')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                {isRunningInIframe() && (
                  <button
                    type="button"
                    onClick={openInStandaloneTab}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="باز کردن در پنجره مستقل مرورگر"
                  >
                    <ExternalLink size={12} />
                    <span>باز کردن در تب مستقل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConnect}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>تلاش مجدد</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleWorkspaceWidget;
