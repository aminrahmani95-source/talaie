import React, { useState } from 'react';
import { User } from '../types';
import { Moon, Sun, LogOut, X, Cloud, CloudOff, AlertOctagon, Check } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { IconButton } from './ui/IconButton';
import { getDisplayName } from './admin/TechniciansManager';

interface Props {
  currentUser: User;
  isOfflineMode?: boolean;
  pendingQueueCount?: number;
  failedQueueCount?: number;
  onOpenFailedOperations?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  isOfflineMode = false,
  pendingQueueCount = 0,
  failedQueueCount = 0,
  onOpenFailedOperations,
  isDarkMode = false,
  onToggleDarkMode,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const roleTitle =
    currentUser.role === 'QC_MANAGER'
      ? 'مدیر کنترل کیفیت'
      : currentUser.role === 'LEAD_TECHNICIAN'
      ? 'سرپرست اکیپ نصب'
      : 'تکنسین نصب';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-b border-[#E2DDD4] dark:border-[#262626] transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          {/* Logo & Brand Name on ONE single line */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#212121] dark:bg-[#1A1A1A] p-1.5 border border-[#C1A056]/40 flex items-center justify-center shrink-0 shadow-2xs">
              <img
                src="./talaei-lion-gold.png"
                alt="لوگوی گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-black text-base sm:text-lg text-[#181818] dark:text-[#F5F3EF] truncate tracking-tight">
                گالری طلایی
              </span>
              <span className="hidden md:inline-block text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-bold">
                سامانه عملیات و QC
              </span>
            </div>
          </div>

          {/* Right Controls: Sync Pill + Theme Toggle + User Avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sync Status Indicator Pill */}
            {failedQueueCount > 0 ? (
              <button
                type="button"
                onClick={onOpenFailedOperations}
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[36px] bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 rounded-xl text-xs font-bold transition hover:bg-rose-100 cursor-pointer animate-pulse"
                title={`${failedQueueCount} عملیات ناموفق — کلیک جهت بررسی`}
              >
                <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{failedQueueCount} ناموفق</span>
              </button>
            ) : isOfflineMode ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[36px] bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs font-bold"
                title="سامانه در حالت آفلاین کار می‌کند"
              >
                <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden xs:inline">آفلاین</span>
              </div>
            ) : pendingQueueCount > 0 ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[36px] bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 rounded-xl text-xs font-bold animate-pulse"
                title={`${pendingQueueCount} تغییر محلی در صف همگام‌سازی`}
              >
                <Cloud className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{pendingQueueCount} در صف</span>
              </div>
            ) : (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 min-h-[36px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-bold"
                title="سامانه همگام با سرور ابری است"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>همگام</span>
              </div>
            )}

            {/* Dark Mode Toggle */}
            {onToggleDarkMode && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={isDarkMode ? 'حالت روز' : 'حالت شب'}
                onClick={onToggleDarkMode}
                icon={
                  isDarkMode ? (
                    <Sun className="w-4 h-4 text-[#C1A056]" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#4A4742]" />
                  )
                }
              />
            )}

            {/* User Avatar Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-[#EFEBE4]/50 dark:hover:bg-[#252525] transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1A056]"
                aria-label={`پروفایل ${currentUser.name}`}
                aria-expanded={isMenuOpen}
              >
                <Avatar
                  name={currentUser.name}
                  id={currentUser.id}
                  role={currentUser.role}
                  size="sm"
                />
                <span className="hidden sm:inline-block text-xs font-bold text-[#181818] dark:text-[#F5F3EF] max-w-[120px] truncate">
                  {getDisplayName(currentUser.name)}
                </span>
              </button>

              {/* Profile Popover / Dropdown */}
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute left-0 top-12 mt-2 w-64 bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-xl border border-[#E2DDD4] dark:border-[#2E2E2E] p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between pb-3 border-b border-[#E2DDD4] dark:border-[#2D2D2D]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={currentUser.name}
                          id={currentUser.id}
                          role={currentUser.role}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#181818] dark:text-[#F5F3EF] truncate">
                            {getDisplayName(currentUser.name)}
                          </div>
                          <div className="text-xs text-[#8E6F27] dark:text-[#E5CA8F] font-semibold mt-0.5">
                            {roleTitle}
                          </div>
                          {currentUser.phone && (
                            <div className="text-[11px] text-[#69655F] dark:text-[#9E988D] font-mono mt-0.5" dir="ltr">
                              {currentUser.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                        aria-label="بستن منو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-2 transition cursor-pointer border border-rose-200 dark:border-rose-900/40"
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
