import React from 'react';
import { User, SystemSettings } from '../types';
import {
  CalendarDays,
  Layers,
  ShieldCheck,
  Users,
  Eye,
  LogOut,
  AlertTriangle,
  Moon,
  Sun,
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  openTicketCount: number;
  pendingQcCount: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onOpenLogin: () => void;
  onOpenQuickSwitch: () => void;
  onResetData?: () => void;
  onOpenSettings?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  settings,
  openTicketCount,
  pendingQcCount,
  isDarkMode = false,
  onToggleDarkMode,
  onOpenLogin,
  onOpenQuickSwitch,
  onOpenSettings,
  activeTab,
  setActiveTab,
}) => {
  const isQcManager = currentUser.role === 'QC_MANAGER';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#181818]/95 backdrop-blur-md border-b border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs transition-colors duration-200">
      {/* Top Gold Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-[#212121] via-[#C1A056] to-[#D5733A]" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Official Logo from user */}
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="/" className="flex items-center gap-2.5 py-1 group">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#212121] dark:bg-[#222222] flex items-center justify-center p-1.5 shadow-sm group-hover:border-[#C1A056] border border-[#212121] dark:border-[#C1A056]/30 transition duration-200">
                <img
                  src="./talaei-lion-gold.png"
                  alt="نشان گالری طلایی"
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-200"
                />
              </div>
            </a>

            <div className="border-r border-[#E8E4DC] dark:border-[#2D2D2D] pr-3 sm:pr-4">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-[#212121] dark:text-[#F5EFEB] tracking-tight">
                  {settings.companyName || 'گالری طلایی'}
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-[#FAF7F2] dark:bg-[#242424] text-[#C1A056] px-2.5 py-0.5 rounded-full font-bold border border-[#C1A056]/30">
                  عملیات و کیوسی نصب
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] dark:text-[#A1A1AA] hidden sm:block">
                سامانه هوشمند زمان‌بندی، دیسپچ تکنسین‌ها و کنترل کیفیت
              </p>
            </div>
          </div>

          {/* Right Tools & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dark Mode Toggle Button */}
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#FAF7F2] dark:bg-[#242424] border border-[#E8E4DC] dark:border-[#333333] text-[#212121] dark:text-[#C1A056] hover:bg-[#F5EFEB] dark:hover:bg-[#2C2C2C] active:scale-95 transition-all shadow-2xs"
                title={isDarkMode ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                aria-label={isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-[#C1A056] animate-in spin-in-180 duration-300" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4 text-[#212121] animate-in spin-in-180 duration-300" aria-hidden="true" />
                )}
              </button>
            )}

            {/* Technician Visibility Window Badge (for QC Manager) */}
            {isQcManager && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F2] dark:bg-[#242424] border border-[#C1A056]/40 text-[#212121] dark:text-[#F5EFEB] text-xs font-medium hover:bg-[#F5EFEB] dark:hover:bg-[#2C2C2C] active:scale-95 transition cursor-pointer"
                title="تغییر پنجره دید تکنسین‌ها"
                aria-label={`پنجره دید تکنسین‌ها: ${settings.visibilityWindowDays} روز آینده`}
              >
                <Eye className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                <span>دید تکنسین‌ها:</span>
                <span className="font-black text-[#C1A056] font-mono">
                  {toPersianDigits(settings.visibilityWindowDays)} روز
                </span>
              </button>
            )}

            {/* Quick Ticket & QC Alerts */}
            {isQcManager && (
              <div className="flex items-center gap-1.5">
                {openTicketCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab && setActiveTab('tickets')}
                    className="flex items-center gap-1 px-3 py-1.5 min-h-[38px] bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-full text-xs font-bold active:scale-95 transition animate-pulse"
                    title={`${openTicketCount} تیکت باز سر پروژه`}
                    aria-label={`${openTicketCount} تیکت باز سر پروژه`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                    <span>{toPersianDigits(openTicketCount)} تیکت</span>
                  </button>
                )}

                {pendingQcCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab && setActiveTab('qc')}
                    className="flex items-center gap-1 px-3 py-1.5 min-h-[38px] bg-[#FAF7F2] dark:bg-[#242424] hover:bg-[#F5EFEB] dark:hover:bg-[#2C2C2C] border border-[#C1A056] text-[#212121] dark:text-[#F5EFEB] rounded-full text-xs font-bold active:scale-95 transition"
                    title={`${pendingQcCount} پروژه آماده تایید کیوسی`}
                    aria-label={`${pendingQcCount} پروژه آماده بررسی کیوسی`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    <span className="text-[#C1A056] font-black">{toPersianDigits(pendingQcCount)}</span>
                    <span>کیوسی</span>
                  </button>
                )}
              </div>
            )}

            {/* User Profile Pill & Switcher */}
            <div className="flex items-center bg-[#FAF7F2] dark:bg-[#242424] border border-[#E8E4DC] dark:border-[#333333] rounded-full p-1 gap-1.5 shadow-2xs">
              <button
                type="button"
                onClick={onOpenQuickSwitch}
                className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white dark:hover:bg-[#1E1E1E] active:scale-95 transition text-right"
                title="تعویض نقش / ورود با کاربر دیگر"
                aria-label={`کاربر جاری: ${currentUser.name}. کلیک برای تعویض نقش`}
              >
                <div className="w-8 h-8 rounded-full bg-[#212121] dark:bg-[#1A1A1A] border border-[#C1A056]/50 flex items-center justify-center text-xs font-bold text-[#C1A056]">
                  {currentUser.role === 'QC_MANAGER' ? 'QC' : currentUser.name.slice(0, 2)}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-[#212121] dark:text-[#F5EFEB] leading-tight">
                    {currentUser.name.split(' (')[0]}
                  </div>
                  <div className="text-[10px] text-[#C1A056] font-bold">
                    {currentUser.role === 'QC_MANAGER'
                      ? 'مدیر کیوسی'
                      : currentUser.role === 'LEAD_TECHNICIAN'
                      ? 'سرپرست نصب'
                      : 'تکنسین'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={onOpenLogin}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#212121] dark:hover:text-[#F5EFEB] hover:bg-white dark:hover:bg-[#1E1E1E] rounded-full active:scale-95 transition"
                title="خروج یا ورود به حساب دیگر"
                aria-label="خروج یا ورود با حساب کاربری دیگر"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs for QC Manager - Styled like talaei.ir desktop menu */}
        {isQcManager && setActiveTab && (
          <nav
            role="tablist"
            aria-label="بخش‌های پنل مدیریت"
            className="flex items-center gap-1 overflow-x-auto py-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D] no-scrollbar text-xs font-semibold"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'planner'}
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition shrink-0 relative active:scale-95 ${
                activeTab === 'planner'
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-bold'
                  : 'text-[#212121] dark:text-[#E8E4DC] hover:text-[#C1A056] dark:hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#242424]'
              }`}
            >
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
              <span>تقویم و برنامه‌ریزی ماهانه</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'qc'}
              onClick={() => setActiveTab('qc')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition shrink-0 relative active:scale-95 ${
                activeTab === 'qc'
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-bold'
                  : 'text-[#212121] dark:text-[#E8E4DC] hover:text-[#C1A056] dark:hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#242424]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>میز کار کیوسی (تایید کیفیت)</span>
              {pendingQcCount > 0 && (
                <span className="bg-[#C1A056] text-white dark:bg-[#212121] dark:text-[#C1A056] text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(pendingQcCount)}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'tickets'}
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition shrink-0 relative active:scale-95 ${
                activeTab === 'tickets'
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-bold'
                  : 'text-[#212121] dark:text-[#E8E4DC] hover:text-[#C1A056] dark:hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#242424]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>تیکت‌های فوری و کسری</span>
              {openTicketCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(openTicketCount)}
                </span>
              )}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'technicians'}
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition shrink-0 relative active:scale-95 ${
                activeTab === 'technicians'
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-bold'
                  : 'text-[#212121] dark:text-[#E8E4DC] hover:text-[#C1A056] dark:hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#242424]'
              }`}
            >
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>مدیریت تکنسین‌ها</span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition shrink-0 relative active:scale-95 ${
                activeTab === 'settings'
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-bold'
                  : 'text-[#212121] dark:text-[#E8E4DC] hover:text-[#C1A056] dark:hover:text-[#C1A056] hover:bg-[#FAF7F2] dark:hover:bg-[#242424]'
              }`}
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>تنظیمات و همگام‌سازی</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
