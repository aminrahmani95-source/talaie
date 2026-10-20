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
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  openTicketCount: number;
  pendingQcCount: number;
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
  onOpenLogin,
  onOpenQuickSwitch,
  onOpenSettings,
  activeTab,
  setActiveTab,
}) => {
  const isQcManager = currentUser.role === 'QC_MANAGER';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8E4DC] shadow-xs">
      {/* Top Gold Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-[#212121] via-[#C1A056] to-[#D5733A]" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Official Logo from talaei.ir */}
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="/" className="block py-1">
              <img
                src="./logo.webp"
                alt="گالری طلایی"
                className="h-10 sm:h-12 w-auto object-contain transition-transform hover:scale-105 duration-200"
                onError={(e) => {
                  // Fallback if image fails
                  const target = e.currentTarget;
                  target.style.display = 'none';
                }}
              />
            </a>

            <div className="border-r border-[#E8E4DC] pr-3 sm:pr-4">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-[#212121] tracking-tight">
                  {settings.companyName || 'گالری طلایی'}
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-[#FAF7F2] text-[#C1A056] px-2.5 py-0.5 rounded-full font-bold border border-[#C1A056]/30">
                  عملیات و کیوسی نصب
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] hidden sm:block">
                سامانه هوشمند زمان‌بندی، دیسپچ تکنسین‌ها و کنترل کیفیت
              </p>
            </div>
          </div>

          {/* Right Tools & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Technician Visibility Window Badge (for QC Manager) */}
            {isQcManager && (
              <div
                onClick={onOpenSettings}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F2] border border-[#C1A056]/40 text-[#212121] text-xs font-medium cursor-pointer hover:bg-[#F5EFEB] transition"
                title="تغییر پنجره دید تکنسین‌ها"
              >
                <Eye className="w-3.5 h-3.5 text-[#C1A056]" />
                <span>دید تکنسین‌ها:</span>
                <span className="font-black text-[#C1A056] font-mono">
                  {toPersianDigits(settings.visibilityWindowDays)} روز
                </span>
              </div>
            )}

            {/* Quick Ticket & QC Alerts */}
            {isQcManager && (
              <div className="flex items-center gap-1.5">
                {openTicketCount > 0 && (
                  <button
                    onClick={() => setActiveTab && setActiveTab('tickets')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-full text-xs font-bold transition animate-pulse"
                    title={`${openTicketCount} تیکت باز سر پروژه`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{toPersianDigits(openTicketCount)} تیکت</span>
                  </button>
                )}

                {pendingQcCount > 0 && (
                  <button
                    onClick={() => setActiveTab && setActiveTab('qc')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F5EFEB] border border-[#C1A056] text-[#212121] rounded-full text-xs font-bold transition"
                    title={`${pendingQcCount} پروژه آماده تایید کیوسی`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C1A056]" />
                    <span>{toPersianDigits(pendingQcCount)} کیوسی</span>
                  </button>
                )}
              </div>
            )}

            {/* User Profile Pill & Switcher */}
            <div className="flex items-center bg-[#FAF7F2] border border-[#E8E4DC] rounded-full p-1 gap-1.5 shadow-2xs">
              <button
                onClick={onOpenQuickSwitch}
                className="flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white transition text-right"
                title="تعویض نقش / ورود با کاربر دیگر"
              >
                <span className="text-xl">{currentUser.avatar || '👤'}</span>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-[#212121] leading-tight">
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
                onClick={onOpenLogin}
                className="p-1.5 text-slate-400 hover:text-[#212121] hover:bg-white rounded-full transition"
                title="خروج یا ورود به حساب دیگر"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs for QC Manager - Styled like talaei.ir desktop menu */}
        {isQcManager && setActiveTab && (
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-[#E8E4DC] no-scrollbar text-xs font-semibold">
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition shrink-0 relative ${
                activeTab === 'planner'
                  ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                  : 'text-[#212121] hover:text-[#C1A056] hover:bg-[#FAF7F2]'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>تقویم و برنامه‌ریزی ماهانه</span>
            </button>

            <button
              onClick={() => setActiveTab('qc')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition shrink-0 relative ${
                activeTab === 'qc'
                  ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                  : 'text-[#212121] hover:text-[#C1A056] hover:bg-[#FAF7F2]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>میز کار کیوسی (تایید کیفیت)</span>
              {pendingQcCount > 0 && (
                <span className="bg-[#C1A056] text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(pendingQcCount)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition shrink-0 relative ${
                activeTab === 'tickets'
                  ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                  : 'text-[#212121] hover:text-[#C1A056] hover:bg-[#FAF7F2]'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>تیکت‌های فوری و کسری</span>
              {openTicketCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(openTicketCount)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition shrink-0 relative ${
                activeTab === 'technicians'
                  ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                  : 'text-[#212121] hover:text-[#C1A056] hover:bg-[#FAF7F2]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>مدیریت تکنسین‌ها</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition shrink-0 relative ${
                activeTab === 'settings'
                  ? 'bg-[#212121] text-[#C1A056] shadow-sm'
                  : 'text-[#212121] hover:text-[#C1A056] hover:bg-[#FAF7F2]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>تنظیمات و همگام‌سازی</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
