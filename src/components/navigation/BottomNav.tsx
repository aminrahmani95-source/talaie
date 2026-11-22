import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import {
  getNavSections,
  getBottomBarIds,
  BADGE_TONE_CLASS,
  formatBadge,
  type ManagerTab,
  type NavCounts,
  type NavItem,
} from './navConfig';

export type { ManagerTab } from './navConfig';

interface Props extends NavCounts {
  activeTab: ManagerTab;
  onSelectTab: (tab: ManagerTab) => void;
  userRole?: string;
}

/** نوار پایین موبایل + شیت «بیشتر» — ساخته‌شده از navConfig */
export const BottomNav: React.FC<Props> = ({ activeTab, onSelectTab, userRole, ...counts }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const sections = getNavSections(userRole, counts);
  const allItems = sections.flatMap((s) => s.items);
  const barIds = getBottomBarIds(userRole);
  const barItems = barIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter((i): i is NavItem => Boolean(i));
  const moreSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !barIds.includes(i.id)) }))
    .filter((s) => s.items.length > 0);
  const hasMore = moreSections.length > 0;
  const moreItems = moreSections.flatMap((s) => s.items);
  const isMoreActive = moreItems.some((i) => i.id === activeTab);
  const moreHasAlert = moreItems.some((i) => i.badge && i.badgeTone === 'danger');

  const select = (id: ManagerTab) => {
    onSelectTab(id);
    setIsMoreOpen(false);
  };

  const cols = barItems.length + (hasMore ? 1 : 0);

  return (
    <>
      <nav
        aria-label="ناوبری اصلی"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-canvas/95 backdrop-blur-lg border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid h-16 max-w-lg mx-auto px-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {barItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                aria-current={isSelected ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                  isSelected ? 'text-brand-ink' : 'text-ink-3 hover:text-ink'
                }`}
              >
                <span
                  className={`relative flex items-center justify-center w-12 h-7 rounded-full transition-colors ${
                    isSelected ? 'bg-brand/15' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && item.badgeTone && (
                    <span
                      className={`absolute -top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums ${BADGE_TONE_CLASS[item.badgeTone]}`}
                    >
                      {formatBadge(item.badge)}
                    </span>
                  )}
                </span>
                <span className={`text-[12px] leading-none ${isSelected ? 'font-bold' : 'font-medium'}`}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              aria-haspopup="dialog"
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                isMoreActive ? 'text-brand-ink' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <span
                className={`relative flex items-center justify-center w-12 h-7 rounded-full ${isMoreActive ? 'bg-brand/15' : ''}`}
              >
                <MoreHorizontal className="w-5 h-5" />
                {moreHasAlert && <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-rose-500" />}
              </span>
              <span className={`text-[12px] leading-none ${isMoreActive ? 'font-bold' : 'font-medium'}`}>بیشتر</span>
            </button>
          )}
        </div>
      </nav>

      {hasMore && (
        <Sheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} title="همه بخش‌ها" maxWidth="sm">
          <div className="space-y-4 pt-1">
            {moreSections.map((section) => (
              <div key={section.title}>
                <div className="px-1 pb-1.5 text-[12px] font-bold text-ink-3">{section.title}</div>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => select(item.id)}
                        aria-current={isSelected ? 'page' : undefined}
                        className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border text-right transition-colors cursor-pointer min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          isSelected ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        <span className="flex items-center justify-between w-full">
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-ink' : 'text-ink-2'}`} />
                          {item.badge !== undefined && item.badgeTone && (
                            <span
                              className={`min-w-[20px] h-5 px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center tabular-nums ${BADGE_TONE_CLASS[item.badgeTone]}`}
                            >
                              {formatBadge(item.badge)}
                            </span>
                          )}
                        </span>
                        <span>
                          <span className="block text-[13px] font-bold text-ink">{item.label}</span>
                          <span className="block text-[12px] text-ink-3 mt-0.5 leading-snug">{item.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
};
