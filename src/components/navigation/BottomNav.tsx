import React, { useState } from 'react';
import {
  CalendarDays,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  MoreHorizontal,
  Users,
  Settings,
} from 'lucide-react';
import { Sheet } from '../ui/Sheet';

export type ManagerTab = 'planner' | 'qc' | 'stuck' | 'tickets' | 'technicians' | 'settings';

interface Props {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
}

export const BottomNav: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  pendingQcCount = 0,
  openStuckCount = 0,
  openTicketCount = 0,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isMoreActive = activeTab === 'technicians' || activeTab === 'settings';

  const navItems = [
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
      id: 'stuck' as const,
      label: 'متوقف‌ها',
      icon: AlertOctagon,
      badge: openStuckCount > 0 ? openStuckCount : undefined,
      badgeColor: 'bg-rose-600 text-white animate-pulse',
    },
    {
      id: 'tickets' as const,
      label: 'تیکت‌ها',
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#141414]/95 backdrop-blur-lg border-t border-[#E2DDD4] dark:border-[#262626] pb-[env(safe-area-inset-bottom)] shadow-lg transition-colors"
      >
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
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
                    ? 'text-[#8E6F27] dark:text-[#E5CA8F] font-bold'
                    : 'text-[#69655F] dark:text-[#9E988D] hover:text-[#181818] dark:hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isSelected ? 'scale-110' : ''
                    }`}
                  />
                  {item.badge !== undefined && (
                    <span
                      className={`absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                        item.badgeColor || 'bg-[#C1A056] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-none">{item.label}</span>
                {isSelected && (
                  <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#C1A056]" />
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
                ? 'text-[#8E6F27] dark:text-[#E5CA8F] font-bold'
                : 'text-[#69655F] dark:text-[#9E988D] hover:text-[#181818] dark:hover:text-white'
            }`}
          >
            <MoreHorizontal
              className={`w-5 h-5 transition-transform ${
                isMoreActive ? 'scale-110' : ''
              }`}
            />
            <span className="text-[11px] leading-none">بیشتر</span>
            {isMoreActive && (
              <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#C1A056]" />
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
        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onSelectTab('technicians');
              setIsMoreOpen(false);
            }}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition text-right cursor-pointer min-h-[56px] ${
              activeTab === 'technicians'
                ? 'border-[#C1A056] bg-[#C1A056]/10 text-[#8E6F27] dark:text-[#E5CA8F] font-bold'
                : 'border-[#E2DDD4] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#1F1F1F] text-[#181818] dark:text-[#F5F3EF] hover:border-[#C1A056]/60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#282828] border border-[#E2DDD4] dark:border-[#383838] flex items-center justify-center text-[#8E6F27] dark:text-[#C1A056]">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">پرسنل</div>
              <div className="text-xs text-[#69655F] dark:text-[#9E988D] mt-0.5">
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
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition text-right cursor-pointer min-h-[56px] ${
              activeTab === 'settings'
                ? 'border-[#C1A056] bg-[#C1A056]/10 text-[#8E6F27] dark:text-[#E5CA8F] font-bold'
                : 'border-[#E2DDD4] dark:border-[#2D2D2D] bg-[#FAF7F2] dark:bg-[#1F1F1F] text-[#181818] dark:text-[#F5F3EF] hover:border-[#C1A056]/60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#282828] border border-[#E2DDD4] dark:border-[#383838] flex items-center justify-center text-[#8E6F27] dark:text-[#C1A056]">
              <Settings className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">تنظیمات</div>
              <div className="text-xs text-[#69655F] dark:text-[#9E988D] mt-0.5">
                پنجره دید تکنسین‌ها، چک‌لیست پیش‌فرض و همگام‌سازی
              </div>
            </div>
          </button>
        </div>
      </Sheet>
    </>
  );
};
