import React, { useState } from 'react';
import { User } from '../types';
import { Moon, Sun, LogOut, X, Cloud, CloudOff, AlertOctagon, Check, Eye } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { IconButton } from './ui/IconButton';
import { getDisplayName } from '../utils/technicianName';
import { LOGO_GOLD } from '../assets/logo';

interface Props {
  currentUser: User;
  isOfflineMode?: boolean;
  pendingQueueCount?: number;
  failedQueueCount?: number;
  onOpenFailedOperations?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout: () => void;
  impersonatorCeo?: User | null;
  onExitImpersonation?: () => void;
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
  impersonatorCeo,
  onExitImpersonation,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const roleTitle =
    currentUser.role === 'CEO'
      ? 'مدیرعامل'
      : currentUser.role === 'QC_MANAGER'
      ? 'مدیر کنترل کیفیت و فنی'
      : currentUser.role === 'MEASUREMENT_LEAD'
      ? 'مسئول متراژ و تایید بستر'
      : currentUser.role === 'WAREHOUSE'
      ? 'مسئول انبار و پیگیری تامین'
      : currentUser.role === 'SCHEDULING_COORDINATOR'
      ? 'مسئول هماهنگی و زمان‌بندی'
      : currentUser.role === 'SALES_REP'
      ? 'کارشناس فروش و رزرو لت'
      : currentUser.role === 'LEAD_TECHNICIAN'
      ? 'سرپرست اکیپ نصب'
      : 'تکنسین نصب';

  return (
    <header className="sticky top-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#0D1117]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#212835] transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Logo & Brand Name on ONE single line */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#F8FAFC] dark:bg-[#151B23] p-1.5 border border-[#C5A059]/40 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={LOGO_GOLD}
                alt="لوگوی گالری طلایی"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-black text-sm sm:text-base text-[#0F172A] dark:text-[#F0F4F8] truncate tracking-tight">
                گالری طلایی
              </span>
              <span className="hidden md:inline-block text-[11px] text-[#C5A059] font-bold">
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
            ) : pendingQueueCount > 0 ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold animate-pulse tabular-nums"
                title={`${pendingQueueCount} تغییر محلی در صف همگام‌سازی`}
              >
                <Cloud className="w-3.5 h-3.5 text-amber-400" />
                <span>{pendingQueueCount} در صف</span>
              </div>
            ) : (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold"
                title="سامانه همگام با سرور ابری است"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>همگام</span>
              </div>
            )}

            {/* Dark Mode Toggle */}
            {onToggleDarkMode && (
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
                onClick={onToggleDarkMode}
                icon={
                  isDarkMode ? (
                    <Sun className="w-4 h-4 text-[#C5A059]" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#9BA7B6]" />
                  )
                }
              />
            )}

            {/* User Avatar Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#1C232D] transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                aria-label={`پروفایل کاربری ${getDisplayName(currentUser.name)}`}
                aria-expanded={isMenuOpen}
              >
                <Avatar
                  name={getDisplayName(currentUser.name)}
                  id={currentUser.id}
                  role={currentUser.role}
                  size="sm"
                />
                <span className="hidden sm:inline-block text-xs font-bold text-[#0F172A] dark:text-[#F0F4F8] max-w-[120px] truncate">
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
                  <div className="absolute left-0 top-11 mt-2 w-64 bg-[#FFFFFF] dark:bg-[#151B23] rounded-xl shadow-2xl border border-[#CBD5E1] dark:border-[#2D3748] p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between pb-3 border-b border-[#E2E8F0] dark:border-[#212835]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          name={getDisplayName(currentUser.name)}
                          id={currentUser.id}
                          role={currentUser.role}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#0F172A] dark:text-[#F0F4F8] truncate">
                            {getDisplayName(currentUser.name)}
                          </div>
                          <div className="text-xs text-[#C5A059] font-bold mt-0.5">
                            {roleTitle}
                          </div>
                          {currentUser.phone && (
                            <div className="text-xs text-[#9BA7B6] font-mono mt-0.5 tabular-nums" dir="ltr">
                              {currentUser.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMenuOpen(false)}
                        className="text-[#637184] hover:text-[#F0F4F8] p-1 rounded-md hover:bg-[#1C232D] transition cursor-pointer"
                        aria-label="بستن منو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {impersonatorCeo && onExitImpersonation && (
                      <div className="pt-3 pb-1 border-b border-[#E2E8F0] dark:border-[#212835]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onExitImpersonation();
                          }}
                          className="w-full min-h-[38px] py-1.5 px-3 rounded-lg text-xs font-bold bg-[#C5A059] text-[#0D1117] hover:bg-[#D4AF37] flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
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
