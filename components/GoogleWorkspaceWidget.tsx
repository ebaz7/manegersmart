import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, CheckSquare, RefreshCw, LogIn, LogOut, 
  ExternalLink, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Link2
} from 'lucide-react';
import { 
  signInWithGoogleWorkspace, logoutGoogleWorkspace, getGoogleAccessToken,
  fetchGoogleCalendarEvents, fetchGoogleTasks, GoogleCalendarEvent, GoogleTaskItem,
  getReadableGoogleAuthError 
} from '../services/googleWorkspaceService';
import { updateUser } from '../services/authService';
import { User } from '../types';

interface GoogleWorkspaceWidgetProps {
  currentUser?: User;
  onEventCountChange?: (count: number) => void;
  onOpenProfile?: () => void;
}

export const GoogleWorkspaceWidget: React.FC<GoogleWorkspaceWidgetProps> = ({ currentUser, onEventCountChange, onOpenProfile }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks'>('calendar');
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<GoogleTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gw_widget_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Check if token exists for current user
  useEffect(() => {
    getGoogleAccessToken(currentUser?.id).then(cached => {
      if (cached) {
        setToken(cached);
        loadData(cached);
      } else {
        setToken(null);
        setEvents([]);
        setTasks([]);
      }
    });
  }, [currentUser?.id, currentUser?.googleLinkedEmail]);

  const loadData = async (tok: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [calEvents, taskItems] = await Promise.allSettled([
        fetchGoogleCalendarEvents(tok),
        fetchGoogleTasks(tok)
      ]);

      if (calEvents.status === 'fulfilled') {
        setEvents(calEvents.value);
        if (onEventCountChange) onEventCountChange(calEvents.value.length);
      } else {
        console.warn('Calendar fetch error:', calEvents.reason);
      }

      if (taskItems.status === 'fulfilled') {
        setTasks(taskItems.value);
      } else {
        console.warn('Tasks fetch error:', taskItems.reason);
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
            await updateUser({
              ...currentUser,
              googleLinkedEmail: result.user.email,
              googleLinkedAt: Date.now()
            });
          } catch (e) {
            console.debug('Failed to update user profile with google info', e);
          }
        }
      }
    } catch (err: any) {
      setError(getReadableGoogleAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDisconnect = async () => {
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

  return (
    <div className="glass-panel rounded-2xl border border-indigo-100/80 dark:border-indigo-900/40 p-4 shadow-sm relative overflow-hidden transition-all bg-gradient-to-br from-white via-indigo-50/15 to-blue-50/20 dark:from-zinc-900 dark:to-zinc-950">
      {/* Top Banner & Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                همگام‌سازی گوگل (تقویم و تسک‌ها)
              </h3>
              {token && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  متصل {currentUser?.googleLinkedEmail ? `(${currentUser.googleLinkedEmail})` : ''}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
              نمایش رویدادهای Google Calendar و چک‌لیست Google Tasks شما
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {token && (
            <>
              <button
                onClick={() => loadData(token)}
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

      {/* Main Content Body */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
          {!token ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white/70 dark:bg-zinc-900/70 rounded-xl border border-indigo-100/60 dark:border-zinc-800">
              <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                <CalendarIcon size={16} className="text-indigo-500 shrink-0" />
                <span>برای مشاهده رویدادهای تقویم شخصی و تسک‌های حساب گوگل خود وارد شوید:</span>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isSigningIn}
                className="gsi-material-button inline-flex items-center gap-2 bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-all active:scale-95 shrink-0"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                <span>{isSigningIn ? 'در حال ارتباط...' : 'اتصال با Google'}</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Tabs: Calendar / Tasks */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'calendar'
                        ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <CalendarIcon size={13} />
                    <span>تقویم گوگل</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-600 px-1.5 rounded-full font-mono">
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

                <a
                  href={activeTab === 'calendar' ? 'https://calendar.google.com' : 'https://tasks.google.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>باز کردن در گوگل</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {/* Tab 1: Calendar events */}
              {activeTab === 'calendar' && (
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {events.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
                      رویدادی برای بازه پیش رو در تقویم شما یافت نشد.
                    </div>
                  ) : (
                    events.map((ev) => {
                      const startDate = ev.start.dateTime ? new Date(ev.start.dateTime) : ev.start.date ? new Date(ev.start.date) : null;
                      const timeStr = startDate ? startDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '';
                      const dateStr = startDate ? startDate.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric', weekday: 'short' }) : '';

                      return (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-indigo-50 dark:border-zinc-800/80 hover:border-indigo-200 dark:hover:border-zinc-700 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <Clock size={15} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                {ev.summary || 'رویداد بدون عنوان'}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                <span>{dateStr}</span>
                                {timeStr && <span>• ساعت {timeStr}</span>}
                                {ev.location && <span className="truncate max-w-[120px]">• {ev.location}</span>}
                              </div>
                            </div>
                          </div>
                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-blue-600 rounded-md transition-colors"
                              title="مشاهده رویداد در تقویم"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Google Tasks */}
              {activeTab === 'tasks' && (
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {tasks.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 border border-dashed rounded-xl border-gray-200 dark:border-zinc-800">
                      هیچ تسکی در Google Tasks شما ثبت نشده است.
                    </div>
                  ) : (
                    tasks.map((task) => {
                      const isDone = task.status === 'completed';
                      return (
                        <div
                          key={task.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors shadow-2xs ${
                            isDone 
                              ? 'bg-gray-50/50 dark:bg-zinc-900/40 border-gray-200/50 dark:border-zinc-800/40 opacity-60' 
                              : 'bg-white/80 dark:bg-zinc-900/80 border-emerald-50 dark:border-zinc-800/80 hover:border-emerald-200'
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
                            <h4 className={`text-xs font-bold text-gray-800 dark:text-gray-200 ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                              {task.title || 'تسک بدون عنوان'}
                            </h4>
                            {task.notes && (
                              <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{task.notes}</p>
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
            <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 flex items-center gap-1.5">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
