import React from 'react';
import { getNavSections, BADGE_TONE_CLASS, formatBadge, type ManagerTab, type NavCounts } from './navConfig';

interface Props extends NavCounts {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  userRole?: string;
}

/** سایدبار دسکتاپ (lg به بالا) — ساخته‌شده از navConfig */
export const Sidebar: React.FC<Props> = ({ activeTab, onSelectTab, userRole, ...counts }) => {
  const sections = getNavSections(userRole, counts);

  return (
    <aside
      aria-label="منوی اصلی مدیریت"
      className="hidden lg:flex flex-col w-56 shrink-0 py-4 pl-4 border-l border-line sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto"
    >
      <nav className="space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <div className="px-3 pb-1 text-[12px] font-bold text-ink-3">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    isSelected
                      ? 'bg-raised text-ink font-bold'
                      : 'text-ink-2 font-medium hover:text-ink hover:bg-surface'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-ink' : 'text-ink-3'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badgeTone && (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums ${BADGE_TONE_CLASS[item.badgeTone]}`}
                    >
                      {formatBadge(item.badge)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
