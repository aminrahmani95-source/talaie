import React, { useState } from 'react';
import { User, SystemSettings } from '../types';
import {
  CalendarDays,
  Layers,
  ShieldCheck,
  Users,
  Eye,
  LogOut,
  AlertTriangle,
  AlertOctagon,
  Moon,
  Sun,
  UserCheck,
  ChevronDown,
  X,
  Sparkles,
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  currentUser: User;
  users?: User[];
  onSwitchUser?: (user: User) => void;
  settings: SystemSettings;
  openTicketCount: number;
  openStuckCount?: number;
  pendingQcCount: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout: () => void;
  onResetData?: () => void;
  onOpenSettings?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  users = [],
  onSwitchUser,
  settings,
  openTicketCount,
  openStuckCount = 0,
  pendingQcCount,
  isDarkMode = false,
  onToggleDarkMode,
  onLogout,
  onOpenSettings,
  activeTab,
  setActiveTab,
}) => {
  const isQcManager = currentUser.role === 'QC_MANAGER';
  const isDev = Boolean(import.meta.env.DEV);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-md border-b border-[#E8E4DC] dark:border-[#262626] shadow-xs transition-colors duration-200">
      {/* Top Gold Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-[#1E1E1E] via-[#C1A056] to-[#D5733A]" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Official Logo */}
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="/" className="flex items-center gap-2.5 py-1 group">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#181818] dark:bg-[#1E1E1E] flex items-center justify-center p-1.5 shadow-sm group-hover:border-[#C1A056] border border-[#181818] dark:border-[#C1A056]/30 transition duration-200">
                <img
                  src="./talaei-lion-gold.png"
                  alt="نشان گالری طلایی"
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-200"
                />
              </div>
            </a>

            <div className="border-r border-[#E8E4DC] dark:border-[#262626] pr-3 sm:pr-4">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-[#1E1E1E] dark:text-[#F5EFEB] tracking-tight">
                  {settings.companyName || 'گالری طلایی'}
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-[#FAF7F2] dark:bg-[#1E1E1E] text-[#C1A056] px-2.5 py-0.5 rounded-full font-bold border border-[#C1A056]/30">
                  عملیات و QC نصب
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
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E8E4DC] dark:border-[#2E2E2E] text-[#1E1E1E] dark:text-[#C1A056] hover:bg-[#F2ECE1] dark:hover:bg-[#282828] active:scale-95 transition-all shadow-2xs cursor-pointer"
                title={isDarkMode ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تاریک)'}
                aria-label={isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-[#C1A056] animate-in spin-in-180 duration-300" aria-hidden="true" />
                ) : (
                  <Moon className="w-4 h-4 text-[#1E1E1E] animate-in spin-in-180 duration-300" aria-hidden="true" />
                )}
              </button>
            )}

            {/* Technician Visibility Window Badge (for QC Manager) */}
            {isQcManager && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#C1A056]/40 text-[#1E1E1E] dark:text-[#F5EFEB] text-xs font-semibold hover:bg-[#F2ECE1] dark:hover:bg-[#282828] active:scale-95 transition cursor-pointer"
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
                {openStuckCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab && setActiveTab('stuck')}
                    className="flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] bg-rose-500/10 dark:bg-rose-950/60 hover:bg-rose-500/20 border border-rose-500/40 text-rose-600 dark:text-rose-300 rounded-2xl text-xs font-bold active:scale-95 transition animate-pulse cursor-pointer"
                    title={`${openStuckCount} پروژه در وضعیت استاک زیر 72 ساعت`}
                  >
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                    <span>{toPersianDigits(openStuckCount)} استاک</span>
                  </button>
                )}

                {openTicketCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab && setActiveTab('tickets')}
                    className="flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] bg-amber-500/10 dark:bg-amber-950/40 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-200 rounded-2xl text-xs font-bold active:scale-95 transition cursor-pointer"
                    title={`${openTicketCount} تیکت باز سر پروژه`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span>{toPersianDigits(openTicketCount)} تیکت</span>
                  </button>
                )}

                {pendingQcCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab && setActiveTab('qc')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] bg-[#C1A056]/15 hover:bg-[#C1A056]/25 border border-[#C1A056] text-[#A88738] dark:text-[#C1A056] rounded-2xl text-xs font-bold active:scale-95 transition cursor-pointer"
                    title={`${pendingQcCount} پروژه آماده تایید QC`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C1A056]" aria-hidden="true" />
                    <span className="font-black">{toPersianDigits(pendingQcCount)}</span>
                    <span>QC</span>
                  </button>
                )}
              </div>
            )}

            {/* User Profile Pill & Quick Switcher Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSwitcherOpen((prev) => !prev)}
                className="flex items-center bg-[#FAF7F2] dark:bg-[#1E1E1E] border border-[#E8E4DC] dark:border-[#2E2E2E] hover:border-[#C1A056]/50 rounded-2xl p-1 gap-2 shadow-2xs transition active:scale-95 cursor-pointer"
                title="تغییر سریع کاربر / خروج"
                aria-label={`کاربر جاری: ${currentUser.name}`}
              >
                <div className="w-8 h-8 rounded-xl bg-[#1E1E1E] dark:bg-[#121212] border border-[#C1A056]/50 flex items-center justify-center text-xs font-bold text-[#C1A056]">
                  {currentUser.role === 'QC_MANAGER' ? 'QC' : currentUser.name.slice(0, 2)}
                </div>
                <div className="hidden sm:block text-right pr-1">
                  <div className="text-xs font-bold text-[#1E1E1E] dark:text-[#F5EFEB] leading-tight">
                    {currentUser.name.split(' (')[0]}
                  </div>
                  <div className="text-[10px] text-[#C1A056] font-bold">
                    {currentUser.role === 'QC_MANAGER'
                      ? 'مدیر QC'
                      : currentUser.role === 'LEAD_TECHNICIAN'
                      ? 'سرپرست نصب'
                      : 'تکنسین'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pl-1" />
              </button>

              {/* Profile & Session Dropdown Menu */}
              {isSwitcherOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsSwitcherOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute left-0 top-12 mt-2 w-72 bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-2xl border border-[#E8E4DC] dark:border-[#2E2E2E] p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E8E4DC] dark:border-[#2A2A2A] text-xs font-bold text-[#1E1E1E] dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{currentUser.avatar || '👤'}</span>
                        <div className="text-right">
                          <div className="font-bold text-sm text-[#212121] dark:text-white leading-tight">
                            {currentUser.name}
                          </div>
                          <div className="text-[11px] text-[#C1A056] font-semibold mt-0.5">
                            {currentUser.role === 'QC_MANAGER'
                              ? 'مسئول فنی و کنترل کیفیت (QC)'
                              : currentUser.role === 'LEAD_TECHNICIAN'
                              ? 'سرپرست اکیپ نصب'
                              : 'تکنسین اجرایی نصب'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">
                            {currentUser.phone}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSwitcherOpen(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                        aria-label="بستن منو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Persona Switcher: DEV ONLY */}
                    {isDev && onSwitchUser && (
                      <div className="py-2 space-y-1 max-h-52 overflow-y-auto border-b border-[#E8E4DC] dark:border-[#2A2A2A] my-2">
                        <div className="text-[10px] text-zinc-400 px-2 pb-1 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#C1A056]" />
                          <span>تغییر سریع نقش (محیط تست Dev)</span>
                        </div>
                        {users.map((u) => {
                          const isCurrent = u.id === currentUser.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                onSwitchUser(u);
                                setIsSwitcherOpen(false);
                              }}
                              className={`w-full p-2 rounded-xl text-right flex items-center justify-between text-xs transition cursor-pointer ${
                                isCurrent
                                  ? 'bg-[#C1A056]/15 text-[#C1A056] font-black'
                                  : 'text-slate-700 dark:text-zinc-300 hover:bg-[#FAF7F2] dark:hover:bg-[#252525]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{u.avatar || '👤'}</span>
                                <div>
                                  <div className="font-bold leading-tight">{u.name.split(' (')[0]}</div>
                                  <div className="text-[10px] text-zinc-400">
                                    {u.role === 'QC_MANAGER' ? 'مدیر QC' : u.role === 'LEAD_TECHNICIAN' ? 'سرپرست اکیپ' : 'تکنسین نصب'}
                                  </div>
                                </div>
                              </div>
                              {isCurrent && <span className="text-[10px] font-bold text-[#C1A056]">فعال</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSwitcherOpen(false);
                          onLogout();
                        }}
                        className="w-full py-2.5 px-3 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-2 transition cursor-pointer border border-rose-200 dark:border-rose-900/40"
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

        {/* Navigation Segmented Capsule Bar for QC Manager */}
        {isQcManager && setActiveTab && (
          <div className="pb-3 pt-1">
            <nav
              role="tablist"
              aria-label="بخش‌های پنل مدیریت"
              className="bg-[#F2ECE1] dark:bg-[#181818] p-1.5 rounded-2xl border border-[#E0D9CB] dark:border-[#282828] flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-semibold"
            >
              <button
                role="tab"
                aria-selected={activeTab === 'planner'}
                onClick={() => setActiveTab('planner')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'planner'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
                <span>تقویم و برنامه‌ریزی ماهانه</span>
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'qc'}
                onClick={() => setActiveTab('qc')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'qc'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>میز کار QC (تایید کیفیت)</span>
                {pendingQcCount > 0 && (
                  <span className="bg-[#C1A056] text-white dark:bg-[#121212] dark:text-[#C1A056] text-[10px] px-1.5 py-0.2 rounded-full font-black">
                    {toPersianDigits(pendingQcCount)}
                  </span>
                )}
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'stuck'}
                onClick={() => setActiveTab('stuck')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'stuck'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <AlertOctagon className="w-4 h-4 text-rose-500" aria-hidden="true" />
                <span>کارتابل رفع استاک (&lt;72h)</span>
                {openStuckCount > 0 && (
                  <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                    {toPersianDigits(openStuckCount)}
                  </span>
                )}
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'tickets'}
                onClick={() => setActiveTab('tickets')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'tickets'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
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
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'technicians'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <Users className="w-4 h-4" aria-hidden="true" />
                <span>مدیریت تکنسین‌ها</span>
              </button>

              <button
                role="tab"
                aria-selected={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition shrink-0 active:scale-95 ${
                  activeTab === 'settings'
                    ? 'bg-[#1E1E1E] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#121212] shadow-sm font-black'
                    : 'text-[#444] dark:text-[#A1A1AA] hover:text-[#1E1E1E] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <Layers className="w-4 h-4" aria-hidden="true" />
                <span>تنظیمات و همگام‌سازی</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
