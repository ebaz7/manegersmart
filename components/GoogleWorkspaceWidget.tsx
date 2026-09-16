import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, CheckSquare, RefreshCw, LogIn, LogOut, 
  ExternalLink, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Link2,
  Settings, Eye, EyeOff, LayoutGrid, ListFilter, Globe, CalendarDays, Maximize2,
  ChevronRight, ChevronLeft, MapPin, Plus, Check, CalendarCheck
} from 'lucide-react';
import * as jalaali from 'jalaali-js';
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

const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const WEEK_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const FULL_WEEK_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

export const GoogleWorkspaceWidget: React.FC<GoogleWorkspaceWidgetProps> = ({ 
  currentUser, 
  onEventCountChange, 
  onOpenProfile,
  onToggleDateCard,
  isDateCardVisible = true
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'persian_calendar' | 'embed_calendar' | 'agenda_events' | 'tasks'>('persian_calendar');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Persian Calendar State
  const today = useMemo(() => new Date(), []);
  const todayJalaali = useMemo(() => {
    return jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }, [today]);

  const [currentJYear, setCurrentJYear] = useState(todayJalaali.jy);
  const [currentJMonth, setCurrentJMonth] = useState(todayJalaali.jm);
  const [selectedDay, setSelectedDay] = useState<number>(todayJalaali.jd);

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
        setError('نشست حساب گوگل منقضی شده است. جهت مشاهده رویدادها، دکمه اتصال مجدد را لمس فرمایید.');
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
        if (currentUser && result.user?.email) {
          try {
            const updated = {
              ...currentUser,
              googleLinkedEmail: result.user.email,
              googleLinkedAt: Date.now()
            };
            await updateUser(updated);
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

  // Today's Date Strings
  const persianDateFull = useMemo(() => {
    try {
      const formatter = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return formatter.format(today);
    } catch {
      return `${todayJalaali.jy}/${todayJalaali.jm}/${todayJalaali.jd}`;
    }
  }, [today, todayJalaali]);

  const gregorianDateFull = useMemo(() => {
    try {
      return today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }, [today]);

  const weekdayName = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(today);
    } catch {
      return 'امروز';
    }
  }, [today]);

  // Filter Today's Events
  const todayEvents = useMemo(() => {
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    return events.filter(ev => {
      const evDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
      if (!evDate) return false;
      return evDate >= startOfToday && evDate <= endOfToday;
    });
  }, [events, today]);

  // Upcoming Next Event
  const nextEvent = useMemo(() => {
    if (todayEvents.length > 0) return todayEvents[0];
    const now = new Date();
    return events.find(ev => {
      const evDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
      return evDate && evDate >= now;
    }) || events[0] || null;
  }, [todayEvents, events]);

  // Persian Calendar Grid Days Calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = jalaali.jalaaliMonthLength(currentJYear, currentJMonth);
    // Find the starting weekday of the 1st of current Jalaali month
    const gStart = jalaali.toGregorian(currentJYear, currentJMonth, 1);
    const firstDayDate = new Date(gStart.gy, gStart.gm - 1, gStart.gd);
    // JS getDay(): 0 is Sunday, 1 is Monday... 6 is Saturday
    // In Persian week: Saturday is index 0, Sunday is 1, ..., Friday is 6
    const jsDay = firstDayDate.getDay();
    const startOffset = (jsDay + 1) % 7; // Saturday(6) -> 0, Sunday(0) -> 1, ..., Friday(5) -> 6

    const days: {
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      hasEvents: boolean;
      eventsCount: number;
      gDate: Date;
    }[] = [];

    // Empty slots before month starts
    for (let i = 0; i < startOffset; i++) {
      days.push({
        day: 0,
        isCurrentMonth: false,
        isToday: false,
        hasEvents: false,
        eventsCount: 0,
        gDate: new Date()
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const g = jalaali.toGregorian(currentJYear, currentJMonth, d);
      const gDate = new Date(g.gy, g.gm - 1, g.gd);
      const isToday = currentJYear === todayJalaali.jy && currentJMonth === todayJalaali.jm && d === todayJalaali.jd;

      // Count events matching this day
      const dayStart = new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0);
      const dayEnd = new Date(g.gy, g.gm - 1, g.gd, 23, 59, 59);

      const matchedEvents = events.filter(ev => {
        const evDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
        return evDate && evDate >= dayStart && evDate <= dayEnd;
      });

      days.push({
        day: d,
        isCurrentMonth: true,
        isToday,
        hasEvents: matchedEvents.length > 0,
        eventsCount: matchedEvents.length,
        gDate
      });
    }

    return days;
  }, [currentJYear, currentJMonth, todayJalaali, events]);

  // Selected Day Events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    const g = jalaali.toGregorian(currentJYear, currentJMonth, selectedDay);
    const dayStart = new Date(g.gy, g.gm - 1, g.gd, 0, 0, 0);
    const dayEnd = new Date(g.gy, g.gm - 1, g.gd, 23, 59, 59);

    return events.filter(ev => {
      const evDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
      return evDate && evDate >= dayStart && evDate <= dayEnd;
    });
  }, [currentJYear, currentJMonth, selectedDay, events]);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentJMonth === 1) {
      setCurrentJYear(y => y - 1);
      setCurrentJMonth(12);
    } else {
      setCurrentJMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentJMonth === 12) {
      setCurrentJYear(y => y + 1);
      setCurrentJMonth(1);
    } else {
      setCurrentJMonth(m => m + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentJYear(todayJalaali.jy);
    setCurrentJMonth(todayJalaali.jm);
    setSelectedDay(todayJalaali.jd);
  };

  // Build clean Google Calendar Embed URL based on user settings
  const embedUrl = useMemo(() => {
    const calId = calSettings.calendarId || currentUser?.googleLinkedEmail || '';
    const mode = calSettings.defaultMode || 'MONTH';
    const ctz = calSettings.timeZone || 'Asia/Tehran';
    
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
    params.append('wkst', '7');

    return `https://calendar.google.com/calendar/embed?${params.toString()}`;
  }, [calSettings, currentUser?.googleLinkedEmail]);

  return (
    <div className="glass-panel rounded-2xl border border-indigo-100/90 dark:border-indigo-900/40 p-3.5 sm:p-4 shadow-sm relative overflow-hidden transition-all bg-gradient-to-br from-white via-indigo-50/20 to-blue-50/25 dark:from-zinc-900 dark:to-zinc-950">
      
      {/* 1. Header Bar: Full Responsive Design with Integrated Live Date & Event Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <CalendarIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                تقویم، رویدادها و وظایف (Workspace)
              </h3>
              {(token || currentUser?.googleLinkedEmail) ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  همگام با {currentUser?.googleLinkedEmail || 'حساب گوگل'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/50">
                  تقویم محلی شمسی
                </span>
              )}
            </div>

            {/* In Collapsed State: Display Rich Persian Date & Today's Events */}
            {isCollapsed ? (
              <div className="flex items-center gap-2.5 text-[11px] text-gray-700 dark:text-gray-200 mt-1 font-medium flex-wrap">
                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-lg border border-indigo-200/60 flex items-center gap-1 shadow-2xs">
                  <span>📅</span>
                  <span>{persianDateFull}</span>
                  <span className="text-[9px] text-indigo-400 font-mono hidden md:inline">({gregorianDateFull})</span>
                </span>

                {todayEvents.length > 0 ? (
                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-lg border border-emerald-200/60 flex items-center gap-1 truncate max-w-[280px] sm:max-w-md">
                    <span>🔔</span>
                    <span>رویداد امروز: {todayEvents[0].summary || 'جلسه/رویداد'}</span>
                    {todayEvents[0].start?.dateTime && (
                      <span className="text-[10px] font-mono text-emerald-600">
                        (ساعت {new Date(todayEvents[0].start.dateTime).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    )}
                  </span>
                ) : nextEvent ? (
                  <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium px-2 py-0.5 rounded-lg border border-blue-200/60 flex items-center gap-1 truncate max-w-[260px]">
                    <span>⏳</span>
                    <span>رویداد بعدی: {nextEvent.summary || 'بدون عنوان'}</span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 text-[10px]">
                    امروز رویداد ثبت‌شده‌ای ندارید
                  </span>
                )}

                {tasks.filter(t => t.status !== 'completed').length > 0 && (
                  <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-amber-200/60">
                    ✓ {tasks.filter(t => t.status !== 'completed').length} تسک
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{persianDateFull}</span>
                <span>•</span>
                <span>{gregorianDateFull}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
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
              <span className="hidden xl:inline text-[10px]">
                {isDateCardVisible ? 'حذف تقویم بالا' : 'نمایش تقویم بالا'}
              </span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(prev => !prev)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showSettings 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' 
                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500'
            }`}
            title="تنظیمات نمای تقویم"
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
                title="همگام‌سازی و بروزرسانی رویدادها"
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
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold text-xs"
            title={isCollapsed ? 'باز کردن و مشاهده تقویم' : 'بستن / کوچک کردن'}
          >
            {isCollapsed ? (
              <>
                <span className="text-[10px] hidden sm:inline">باز کردن</span>
                <ChevronDown size={16} />
              </>
            ) : (
              <>
                <span className="text-[10px] hidden sm:inline">کوچک کردن</span>
                <ChevronUp size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {!isCollapsed && showSettings && (
        <div className="mt-3 p-3.5 bg-blue-50/50 dark:bg-zinc-900/90 rounded-xl border border-blue-100 dark:border-zinc-800 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-blue-100/80 dark:border-zinc-800 pb-2">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <Settings size={14} className="text-blue-600" />
              تنظیمات نمایش تقویم گوگل و رویدادها
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
        </div>
      )}

      {/* 2. Main Expanded Content */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800/80 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('persian_calendar')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'persian_calendar'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <CalendarDays size={13} />
                <span>تقویم هوشمند شمسی</span>
              </button>

              <button
                onClick={() => setActiveTab('embed_calendar')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'embed_calendar'
                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <Globe size={13} />
                <span>تقویم وب گوگل</span>
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
                <span>رویدادها</span>
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
                <span>تسک‌ها</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 px-1.5 rounded-full font-mono">
                  {tasks.filter(t => t.status !== 'completed').length}
                </span>
              </button>
            </div>

            {/* Quick Actions / Google Connect Status */}
            <div className="flex items-center gap-2">
              {!token ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold px-2.5 py-1 rounded-lg text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw size={11} className={isSigningIn ? 'animate-spin' : ''} />
                  <span>{isSigningIn ? 'ارتباط...' : 'اتصال به گوگل جهت دریافت رویدادها'}</span>
                </button>
              ) : (
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>تقویم در گوگل</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>

          {/* TAB 1: SMART PERSIAN CALENDAR (تقویم تعاملی کامل شمسی با روزها و رویدادها) */}
          {activeTab === 'persian_calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Calendar Grid & Month Picker */}
              <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-gray-200 dark:border-zinc-800 shadow-2xs">
                
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                      title="ماه قبل"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <span className="text-sm font-black text-gray-800 dark:text-gray-100 min-w-[120px] text-center">
                      {PERSIAN_MONTH_NAMES[currentJMonth - 1]} {currentJYear}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                      title="ماه بعد"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleGoToToday}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-colors border border-indigo-200/50"
                    >
                      امروز ({todayJalaali.jd} {PERSIAN_MONTH_NAMES[todayJalaali.jm - 1]})
                    </button>
                  </div>
                </div>

                {/* Weekday Names */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                  {WEEK_DAYS.map((w, idx) => (
                    <div key={idx} className={`py-1 ${idx === 6 ? 'text-rose-500 font-black' : ''}`}>
                      {w}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((item, idx) => {
                    if (!item.isCurrentMonth) {
                      return <div key={`empty-${idx}`} className="h-10 sm:h-12 rounded-lg bg-gray-50/40 dark:bg-zinc-900/30" />;
                    }

                    const isSelected = selectedDay === item.day;
                    const isFriday = idx % 7 === 6;

                    return (
                      <button
                        key={`day-${item.day}`}
                        onClick={() => setSelectedDay(item.day)}
                        className={`h-10 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02] z-10'
                            : item.isToday
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-black'
                            : isFriday
                            ? 'bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-950/40 hover:bg-rose-100/50'
                            : 'bg-white dark:bg-zinc-800/80 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-zinc-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-white' : ''}`}>
                          {item.day}
                        </span>

                        {/* Event Dot Indicator */}
                        {item.hasEvents && (
                          <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                            isSelected ? 'bg-amber-300' : 'bg-indigo-600 dark:bg-indigo-400 animate-pulse'
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Details & Agenda for Selected Day */}
              <div className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-gray-200 dark:border-zinc-800 flex flex-col shadow-2xs">
                <div className="pb-2 border-b border-gray-100 dark:border-zinc-800 mb-2">
                  <span className="text-[10px] font-bold text-gray-400">مشخصات و رویدادهای روز:</span>
                  <h4 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 mt-0.5">
                    {selectedDay} {PERSIAN_MONTH_NAMES[currentJMonth - 1]} {currentJYear}
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 max-h-60 custom-scrollbar pr-1">
                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-1.5">
                      <CalendarCheck size={20} className="text-gray-300 dark:text-gray-600" />
                      <span>برای این روز رویدادی ثبت نشده است.</span>
                    </div>
                  ) : (
                    selectedDayEvents.map(ev => {
                      const startDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
                      const timeStr = startDate ? startDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '';
                      return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-xs"
                        >
                          <div className="font-bold text-gray-800 dark:text-gray-100 flex items-center justify-between gap-1">
                            <span className="truncate">{ev.summary || 'بدون عنوان'}</span>
                            {timeStr && <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">{timeStr}</span>}
                          </div>
                          {ev.location && (
                            <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-1 truncate">
                              <MapPin size={11} className="text-gray-400" />
                              <span>{ev.location}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Direct Google Calendar Link */}
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>ثبت رویداد جدید در تقویم گوگل</span>
                  </a>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: LIVE GOOGLE CALENDAR EMBED */}
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
              >
                <div className="w-12 h-1 rounded-full bg-gray-400 dark:bg-gray-500" />
              </div>
            </div>
          )}

          {/* TAB 3: UPCOMING AGENDA EVENTS */}
          {activeTab === 'agenda_events' && (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {events.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
                  رویدادی برای بازه پیش رو در تقویم شما ثبت نشده است. برای همگام‌سازی، مطمئن شوید به حساب گوگل متصل هستید.
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

          {/* TAB 4: GOOGLE TASKS */}
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

          {error && (
            <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer self-end sm:self-auto shrink-0"
              >
                <RefreshCw size={11} />
                <span>تلاش مجدد</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleWorkspaceWidget;
