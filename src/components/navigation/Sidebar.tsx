import React from 'react';
import {
  CalendarDays,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Users,
  Settings,
} from 'lucide-react';
import { ManagerTab } from './BottomNav';

interface Props {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  pendingQcCount = 0,
  openStuckCount = 0,
  openTicketCount = 0,
}) => {
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
    {
      id: 'technicians' as const,
      label: 'پرسنل',
      icon: Users,
      badge: undefined,
    },
    {
      id: 'settings' as const,
      label: 'تنظیمات',
      icon: Settings,
      badge: undefined,
    },
  ];

  return (
    <aside
      aria-label="منوی اصلی مدیریت"
      className="hidden lg:flex flex-col w-56 shrink-0 py-4 pl-4 border-l border-[#E2DDD4] dark:border-[#262626] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto"
    >
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isSelected ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#212121] text-[#C1A056] dark:bg-[#C1A056] dark:text-[#181818] shadow-xs'
                  : 'text-[#4A4742] dark:text-[#BDB8AF] hover:text-[#181818] dark:hover:text-[#F5F3EF] hover:bg-[#EFEBE4]/60 dark:hover:bg-[#252525]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`min-w-[18px] h-4.5 px-1.5 rounded-full text-[11px] font-mono font-bold flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#C1A056] text-[#212121] dark:bg-[#181818] dark:text-[#C1A056]'
                      : item.badgeColor || 'bg-[#E2DDD4] text-[#4A4742]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};
