import React, { useState } from 'react';
import {
  Activity,
  CalendarDays,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  MoreHorizontal,
  Users,
  Settings,
  Package,
} from 'lucide-react';
import { Sheet } from '../ui/Sheet';

export type ManagerTab = 'control' | 'planner' | 'qc' | 'stuck' | 'tickets' | 'materials' | 'technicians' | 'settings' | 'registry';

interface Props {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
  pendingMaterialCount?: number;
}

export const BottomNav: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  pendingQcCount = 0,
  openStuckCount = 0,
  openTicketCount = 0,
  pendingMaterialCount = 0,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isMoreActive =
    activeTab === 'stuck' ||
    activeTab === 'materials' ||
    activeTab === 'technicians' ||
    activeTab === 'settings';

  const navItems = [
    {
      id: 'control' as const,
      label: 'مرکز کنترل',
      icon: Activity,
      badge: undefined,
    },
    {
      id: 'planner' as const,
      label: 'برنامه',
      icon: CalendarDays,
      badge: undefined,
    },
    {
      id: 'qc' as const,
      label: 'بررسی QC',
      icon: ShieldCheck,
      badge: pendingQcCount > 0 ? pendingQcCount : undefined,
      badgeColor: 'bg-[#C1A056] text-[#212121]',
    },
    {
      id: 'tickets' as const,
      label: 'تیکت و SLA',
      icon: AlertTriangle,
      badge: openTicketCount > 0 ? openTicketCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
  ];

  return (
    <>
      <nav
        role="navigation"
        aria-label="ناوبری اصلی"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0D1117]/95 backdrop-blur-lg border-t border-[#212835] pb-[env(safe-area-inset-bottom)] shadow-lg transition-colors"
      >
        <div className="grid grid-cols-5 h-14 max-w-lg mx-auto px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-all select-none cursor-pointer ${
                  isSelected
                    ? 'text-[#C5A059] font-bold'
                    : 'text-[#637184] hover:text-[#F0F4F8]'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 transition-transform ${
                      isSelected ? 'scale-110' : ''
                    }`}
                  />
                  {item.badge !== undefined && (
                    <span
                      className={`absolute -top-1 -right-2 min-w-[15px] h-3.5 px-1 rounded text-[10px] font-bold flex items-center justify-center ${
                        item.badgeColor || 'bg-[#C5A059] text-[#0D1117]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-none">{item.label}</span>
                {isSelected && (
                  <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#C5A059]" />
                )}
              </button>
            );
          })}

          {/* More Menu Item */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-all select-none cursor-pointer ${
              isMoreActive
                ? 'text-[#C5A059] font-bold'
                : 'text-[#637184] hover:text-[#F0F4F8]'
            }`}
          >
            <MoreHorizontal
              className={`w-4 h-4 transition-transform ${
                isMoreActive ? 'scale-110' : ''
              }`}
            />
            <span className="text-[11px] leading-none">بیشتر</span>
            {isMoreActive && (
              <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#C5A059]" />
            )}
          </button>
        </div>
      </nav>

      {/* More Sheet for Personnel & Settings */}
      <Sheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title="بخش‌های تکمیلی مدیریت"
        maxWidth="sm"
      >
        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onSelectTab('stuck');
              setIsMoreOpen(false);
            }}
            className={`flex items-center gap-3 p-3 rounded-md border transition text-right cursor-pointer min-h-[52px] ${
              activeTab === 'stuck'
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-300 font-bold'
                : 'border-[#212835] bg-[#151B23] text-[#F0F4F8] hover:border-rose-500/40'
            }`}
          >
            <div className="w-8 h-8 rounded-md bg-[#1C232D] border border-[#2D3748] flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold flex items-center justify-between">
                <span>پروژه‌های متوقف (استاک)</span>
                {openStuckCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                    {openStuckCount}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#9BA7B6] mt-0.5">
                رسیدگی فوری به پروژه‌های نیازمند مداخله زیر ۷۲ ساعت
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('materials');
              setIsMoreOpen(false);
            }}
            className={`flex items-center gap-3 p-3 rounded-md border transition text-right cursor-pointer min-h-[52px] ${
              activeTab === 'materials'
                ? 'border-purple-500/60 bg-purple-500/10 text-purple-300 font-bold'
                : 'border-[#212835] bg-[#151B23] text-[#F0F4F8] hover:border-purple-500/40'
            }`}
          >
            <div className="w-8 h-8 rounded-md bg-[#1C232D] border border-[#2D3748] flex items-center justify-center text-purple-400">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold flex items-center justify-between">
                <span>مرکز متریال و پیگیری کسری</span>
                {pendingMaterialCount > 0 && (
                  <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                    {pendingMaterialCount}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#9BA7B6] mt-0.5">
                تامین، ارسال مرحله‌ای با پیک و رهگیری تحویل سر کارگاه
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('technicians');
              setIsMoreOpen(false);
            }}
            className={`flex items-center gap-3 p-3 rounded-md border transition text-right cursor-pointer min-h-[52px] ${
              activeTab === 'technicians'
                ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#C5A059] font-bold'
                : 'border-[#212835] bg-[#151B23] text-[#F0F4F8] hover:border-[#C5A059]/40'
            }`}
          >
            <div className="w-8 h-8 rounded-md bg-[#1C232D] border border-[#2D3748] flex items-center justify-center text-[#C5A059]">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold">پرسنل</div>
              <div className="text-[11px] text-[#9BA7B6] mt-0.5">
                مدیریت نصابان، سرپرستان و ثبت اطلاعات اعضا
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('settings');
              setIsMoreOpen(false);
            }}
            className={`flex items-center gap-3 p-3 rounded-md border transition text-right cursor-pointer min-h-[52px] ${
              activeTab === 'settings'
                ? 'border-[#C5A059]/60 bg-[#C5A059]/10 text-[#C5A059] font-bold'
                : 'border-[#212835] bg-[#151B23] text-[#F0F4F8] hover:border-[#C5A059]/40'
            }`}
          >
            <div className="w-8 h-8 rounded-md bg-[#1C232D] border border-[#2D3748] flex items-center justify-center text-[#C5A059]">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold">تنظیمات</div>
              <div className="text-[11px] text-[#9BA7B6] mt-0.5">
                پنجره دید تکنسین‌ها، چک‌لیست پیش‌فرض و همگام‌سازی
              </div>
            </div>
          </button>
        </div>
      </Sheet>
    </>
  );
};
