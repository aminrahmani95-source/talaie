import React from 'react';
import {
  Activity,
  CalendarDays,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Package,
  Users,
  Settings,
  FileCheck2,
  Trophy,
} from 'lucide-react';
import { ManagerTab } from './BottomNav';

interface Props {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
  pendingMaterialCount?: number;
  userRole?: string;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  pendingQcCount = 0,
  openStuckCount = 0,
  openTicketCount = 0,
  pendingMaterialCount = 0,
  userRole,
}) => {
  const isCeo = userRole === 'CEO';
  const isQcManager = userRole === 'QC_MANAGER';
  const totalUrgentCount = openStuckCount + pendingQcCount + openTicketCount;

  const primaryItems = isCeo
    ? [
        {
          id: 'registry' as const,
          label: 'داشبورد مدیر کل (سوابق و شناسنامه)',
          icon: FileCheck2,
          badge: undefined,
        },
        {
          id: 'planner' as const,
          label: 'تقویم و دیدن برنامه اجرایی',
          icon: CalendarDays,
          badge: undefined,
        },
        {
          id: 'sales' as const,
          label: 'میز فروش و رزرو لت',
          icon: Trophy,
          badge: undefined,
        },
      ]
    : isQcManager
    ? [
        {
          id: 'control' as const,
          label: 'پیشخوان مدیر اپ و QC',
          icon: Activity,
          badge: totalUrgentCount > 0 ? totalUrgentCount : undefined,
          badgeColor: 'bg-rose-600 text-white animate-pulse',
        },
        {
          id: 'planner' as const,
          label: 'تقویم اجرایی و برنامه نصب',
          icon: CalendarDays,
          badge: undefined,
        },
        {
          id: 'technicians' as const,
          label: 'پرسنل، اکیپ‌ها و ظرفیت',
          icon: Users,
          badge: undefined,
        },
        {
          id: 'settings' as const,
          label: 'تنظیمات و ابزارهای سیستم',
          icon: Settings,
          badge: undefined,
        },
      ]
    : [
        {
          id: 'registry' as const,
          label: 'داشبورد مدیر کل (سوابق و شناسنامه)',
          icon: FileCheck2,
          badge: undefined,
        },
        {
          id: 'control' as const,
          label: 'میز کار عملیاتی',
          icon: Activity,
          badge: totalUrgentCount > 0 ? totalUrgentCount : undefined,
          badgeColor: 'bg-rose-600 text-white animate-pulse',
        },
        {
          id: 'planner' as const,
          label: 'تقویم اجرایی 4 روزه',
          icon: CalendarDays,
          badge: undefined,
        },
        {
          id: 'sales' as const,
          label: 'میز فروش و رزرو لت',
          icon: Trophy,
          badge: undefined,
        },
      ];

  const secondaryItems = isCeo || isQcManager
    ? []
    : [
        {
          id: 'qc' as const,
          label: 'بررسی کیفی QC',
          icon: ShieldCheck,
          badge: pendingQcCount > 0 ? pendingQcCount : undefined,
          badgeColor: 'bg-[#C5A059] text-[#0D1117]',
        },
        {
          id: 'stuck' as const,
          label: 'پروژه‌های متوقف',
          icon: AlertOctagon,
          badge: openStuckCount > 0 ? openStuckCount : undefined,
          badgeColor: 'bg-rose-600 text-white animate-pulse',
        },
        {
          id: 'tickets' as const,
          label: 'تیکت‌ها و SLA',
          icon: AlertTriangle,
          badge: openTicketCount > 0 ? openTicketCount : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        {
          id: 'materials' as const,
          label: 'متریال و انبار',
          icon: Package,
          badge: pendingMaterialCount > 0 ? pendingMaterialCount : undefined,
          badgeColor: 'bg-purple-600 text-white',
        },
        {
          id: 'technicians' as const,
          label: 'پرسنل و اکیپ‌ها',
          icon: Users,
          badge: undefined,
        },
        {
          id: 'settings' as const,
          label: 'تنظیمات سیستم',
          icon: Settings,
          badge: undefined,
        },
      ];

  return (
    <aside
      aria-label="منوی اصلی مدیریت"
      className="hidden lg:flex flex-col w-60 shrink-0 py-4 pl-4 border-l border-[#212835] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"
    >
      {/* بخش اصلی و روزمره */}
      <div className="space-y-1 mb-6">
        <div className="px-3 pb-1 text-[11px] font-bold text-[#637184] uppercase tracking-wider">
          میز کار روزانه
        </div>
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-bold text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] ${
                isSelected
                  ? 'bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/40 shadow-xs'
                  : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#C5A059]' : 'text-[#637184]'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`min-w-[18px] h-4 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
                    item.badgeColor || 'bg-[#2D3748] text-[#9BA7B6]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* بخش‌های تخصصی و تکمیلی */}
      {secondaryItems.length > 0 && (
        <div className="space-y-1 pt-4 border-t border-[#212835]">
          <div className="px-3 pb-1 text-[11px] font-bold text-[#637184] uppercase tracking-wider">
            بخش‌های تخصصی
          </div>
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isSelected ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] ${
                  isSelected
                    ? 'bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/40 font-bold shadow-xs'
                    : 'text-[#637184] hover:text-[#9BA7B6] hover:bg-[#151B23] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`min-w-[18px] h-4 px-1.5 rounded text-[10px] font-bold flex items-center justify-center tabular-nums ${
                      isSelected
                        ? 'bg-[#C5A059] text-[#0D1117]'
                        : item.badgeColor || 'bg-[#2D3748] text-[#9BA7B6]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
};
