import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../types';
import { Moon, Sun, LogOut, X, Cloud, CloudOff, AlertOctagon, Check, Eye } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { IconButton } from './ui/IconButton';
import { getDisplayName } from '../utils/technicianName';
import { LOGO_GOLD } from '../assets/logo';
import { getUserRoleLabel } from '../utils/roleLabels';
import { NotificationBell } from './layout/NotificationBell';

interface Props {
  currentUser: User;
  isOfflineMode?: boolean;
  isSyncing?: boolean;
  pendingQueueCount?: number;
  failedQueueCount?: number;
  onOpenFailedOperations?: () => void;
  onOpenPendingOperations?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout: () => void;
  impersonatorCeo?: User | null;
  onExitImpersonation?: () => void;
  /** کلیک روی لوگو: برگشت به صفحه‌ی اصلی همان نقش */
  onGoHome?: () => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  isOfflineMode = false,
  isSyncing = false,
  pendingQueueCount = 0,
  failedQueueCount = 0,
  onOpenFailedOperations,
  onOpenPendingOperations,
  isDarkMode = false,
  onToggleDarkMode,
  onLogout,
  onGoHome,
  impersonatorCeo,
  onExitImpersonation,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const roleTitle = getUserRoleLabel(currentUser.role);

  return (
    <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur-md border-b border-line transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Logo & Brand Name on ONE single line */}
          <button
            type="button"
            onClick={onGoHome}
            aria-label="برگشت به صفحه‌ی اصلی"
            title="صفحه‌ی اصلی"
            className="flex items-center gap-2.5 min-w-0 rounded-lg cursor-pointer text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-[0.98] transition"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface p-1.5 border border-brand/40 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={LOGO_GOLD}
                alt="لوگوی گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-black text-sm sm:text-base text-ink truncate tracking-tight">
                گالری طلایی
              </span>
              <span className="hidden md:inline-block text-[12px] text-brand-ink font-bold">
                سامانه عملیات و QC
              </span>
            </div>
          </button>

          {/* Right Controls: Sync Pill + Theme Toggle + User Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sync Status Indicator Pill */}
            {failedQueueCount > 0 ? (
              <button
                type="button"
                onClick={onOpenFailedOperations}
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-rose-500/15 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition hover:bg-rose-500/25 cursor-pointer animate-pulse tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                title={`${failedQueueCount} عملیات ناموفق — کلیک جهت بررسی`}
                aria-label={`${failedQueueCount} عملیات همگام‌سازی ناموفق`}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>{failedQueueCount} ناموفق</span>
              </button>
            ) : isOfflineMode ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold"
                title="سامانه در حالت آفلاین کار می‌کند"
              >
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">آفلاین</span>
              </div>
            ) : isSyncing ? (
              <div
                role="status"
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-raised text-ink-2 border border-line rounded-lg text-xs font-bold"
                title="در حال دریافت اطلاعات از سرور"
              >
                <Cloud className="w-3.5 h-3.5 text-brand-ink animate-pulse" />
                <span className="hidden sm:inline">همگام‌سازی…</span>
              </div>
            ) : pendingQueueCount > 0 ? (
              <button
                type="button"
                onClick={onOpenPendingOperations}
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold animate-pulse tabular-nums cursor-pointer hover:bg-amber-500/20 transition active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                title={`${pendingQueueCount} تغییر محلی در صف همگام‌سازی — کلیک جهت بررسی و ارسال`}
                aria-label={`${pendingQueueCount} تغییر محلی در صف همگام‌سازی`}
              >
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
                <span>{pendingQueueCount} در صف</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPendingOperations}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
                title="سامانه همگام با سرور ابری است — کلیک جهت بررسی وضعیت همگام‌سازی و لاگ‌های صف"
                aria-label="سامانه همگام با سرور ابری است"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>همگام</span>
              </button>
            )}

            {/* Notifications (not while a CEO is inspecting someone else's panel) */}
            {!impersonatorCeo && <NotificationBell userId={currentUser.id} />}

            {/* Dark Mode Toggle */}
            {onToggleDarkMode && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
                onClick={onToggleDarkMode}
                icon={
                  isDarkMode ? (
                    <Sun className="w-4 h-4 text-brand-ink" />
                  ) : (
                    <Moon className="w-4 h-4 text-ink-2" />
                  )
                }
              />
            )}

            {/* User Avatar Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-raised transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={`پروفایل کاربری ${getDisplayName(currentUser.name)}`}
                aria-expanded={isMenuOpen}
              >
                <Avatar
                  name={getDisplayName(currentUser.name)}
                  id={currentUser.id}
                  role={currentUser.role}
                  size="sm"
                />
                <span className="hidden sm:inline-block text-xs font-bold text-ink max-w-[120px] truncate">
                  {getDisplayName(currentUser.name)}
                </span>
              </button>

              {/* Profile Popover / Dropdown */}
              {isMenuOpen && (
                <>
                  {/* outside the header: its blur would otherwise shrink this to the header's size */}
                  {createPortal(
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsMenuOpen(false)}
                      aria-hidden="true"
                    />,
                    document.body
                  )}
                  <div className="absolute left-0 top-11 mt-2 w-64 bg-surface rounded-xl shadow-2xl border border-line-strong p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between pb-3 border-b border-line">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={getDisplayName(currentUser.name)}
                          id={currentUser.id}
                          role={currentUser.role}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-ink truncate">
                            {getDisplayName(currentUser.name)}
                          </div>
                          <div className="text-xs text-brand-ink font-bold mt-0.5">
                            {roleTitle}
                          </div>
                          {currentUser.phone && (
                            <div className="text-xs text-ink-2 font-mono mt-0.5 tabular-nums" dir="ltr">
                              {currentUser.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-ink-3 hover:text-ink p-1 rounded-md hover:bg-raised transition cursor-pointer"
                        aria-label="بستن منو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {impersonatorCeo && onExitImpersonation && (
                      <div className="pt-3 pb-1 border-b border-line">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExitImpersonation();
                          }}
                          className="w-full min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold bg-brand text-on-brand hover:bg-brand-hover flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
                        >
                          <Eye className="w-4 h-4" />
                          <span>بازگشت به حساب مدیرعامل</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold text-rose-400 hover:bg-rose-500/15 flex items-center justify-center gap-2 transition cursor-pointer border border-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>خروج از حساب کاربری</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
