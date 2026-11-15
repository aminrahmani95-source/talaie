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
} from 'lucide-react';
import { ManagerTab } from './BottomNav';

interface Props {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  pendingQcCount?: number;
  openStuckCount?: number;
  openTicketCount?: number;
  pendingMaterialCount?: number;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  pendingQcCount = 0,
  openStuckCount = 0,
  openTicketCount = 0,
  pendingMaterialCount = 0,
}) => {
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
      id: 'registry' as const,
      label: 'شناسنامه پروژه‌ها',
      icon: FileCheck2,
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
      id: 'materials' as const,
      label: 'متریال و لجستیک',
      icon: Package,
      badge: pendingMaterialCount > 0 ? pendingMaterialCount : undefined,
      badgeColor: 'bg-purple-600 text-white',
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
      className="hidden lg:flex flex-col w-56 shrink-0 py-4 pl-4 border-l border-[#212835] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-bold text-xs transition-all duration-150 cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/40 shadow-xs'
                  : 'text-[#9BA7B6] hover:text-[#F0F4F8] hover:bg-[#151B23] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`min-w-[18px] h-4 px-1.5 rounded text-[11px] font-bold flex items-center justify-center ${
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
    </aside>
  );
};
