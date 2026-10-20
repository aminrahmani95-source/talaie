import React from 'react';
import { User, SystemSettings } from '../types';
import {
  CalendarDays,
  Layers,
  ShieldCheck,
  Users,
  Eye,
  LogOut,
  Bell,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toPersianDigits } from '../utils/jalali';

interface Props {
  currentUser: User;
  settings: SystemSettings;
  openTicketCount: number;
  pendingQcCount: number;
  onOpenLogin: () => void;
  onOpenQuickSwitch: () => void;
  onResetData: () => void;
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
  onResetData,
  onOpenSettings,
  activeTab,
  setActiveTab,
}) => {
  const isQcManager = currentUser.role === 'QC_MANAGER';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <span className="text-xl">🪟</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                  {settings.companyName || 'مجموعه پرده و شید طلائیه'}
                </h1>
                <span className="hidden sm:inline-block text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                  عملیات و کیوسی نصب
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                سامانه هوشمند زمان‌بندی، دیسپچ تکنسین‌ها و نظارت کیفیت
              </p>
            </div>
          </div>

          {/* Right Tools & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Technician Visibility Window Badge (for QC Manager) */}
            {isQcManager && (
              <div
                onClick={onOpenSettings}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-medium cursor-pointer hover:bg-amber-100/70 transition"
                title="تغییر پنجره دید تکنسین‌ها"
              >
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>دید تکنسین‌ها:</span>
                <span className="font-black text-amber-700 font-mono">
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
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition animate-pulse"
                    title={`${openTicketCount} تیکت باز سر پروژه`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{toPersianDigits(openTicketCount)} تیکت</span>
                  </button>
                )}

                {pendingQcCount > 0 && (
                  <button
                    onClick={() => setActiveTab && setActiveTab('qc')}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold transition"
                    title={`${pendingQcCount} پروژه آماده تایید کیوسی`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>{toPersianDigits(pendingQcCount)} کیوسی</span>
                  </button>
                )}
              </div>
            )}

            {/* User Profile Pill & Switcher */}
            <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-2xl p-1 gap-1.5">
              <button
                onClick={onOpenQuickSwitch}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-white transition text-right"
                title="تعویض نقش / ورود با کاربر دیگر"
              >
                <span className="text-xl">{currentUser.avatar || '👤'}</span>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {currentUser.name.split(' (')[0]}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">
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
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition"
                title="خروج یا ورود به حساب دیگر"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs for QC Manager */}
        {isQcManager && setActiveTab && (
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 no-scrollbar text-xs font-semibold">
            <button
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition shrink-0 ${
                activeTab === 'planner'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>تقویم و برنامه‌ریزی ماهانه</span>
            </button>

            <button
              onClick={() => setActiveTab('qc')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition shrink-0 relative ${
                activeTab === 'qc'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>میز کار کیوسی (تایید کیفیت)</span>
              {pendingQcCount > 0 && (
                <span className="bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(pendingQcCount)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition shrink-0 ${
                activeTab === 'tickets'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>تیکت‌های فوری و کسری</span>
              {openTicketCount > 0 && (
                <span className="bg-white text-rose-600 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {toPersianDigits(openTicketCount)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition shrink-0 ${
                activeTab === 'technicians'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>مدیریت تکنسین‌ها</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>تنظیمات و سینک ابری</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
