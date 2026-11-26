import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import type { Project, Ticket, User } from '../../types';
import { StuckProjectsDesk } from './StuckProjectsDesk';
import { TicketCenter } from './TicketCenter';
import { isStuckOpen } from '../../utils/navCounts';
import { toPersianDigits } from '../../utils/jalali';

export type IssuesTab = 'stuck' | 'tickets';

/**
 * «توقف و تیکت»: یک صفحه برای همه‌ی موانع کار. توقف‌ها (مهلت ۷۲ ساعت) و تیکت‌ها قبلاً
 * دو منوی جدا بودند و یک مشکل در چند جا با چند عدد دیده می‌شد.
 */
export const IssuesDesk: React.FC<{
  projects: Project[];
  tickets: Ticket[];
  users: User[];
  currentUser: User;
  initialTab?: IssuesTab;
  focusProjectId?: string | null;
  onPatchProject: (id: string, patch: Partial<Project>) => void;
  onManageProject: (project: Project) => void;
  onReferToWarehouse: (project: Project, note: string) => Promise<void> | void;
  onUpdateTicket: (ticket: Ticket) => void;
  onNavigateTab: (tab: any) => void;
}> = ({
  projects,
  tickets,
  users,
  currentUser,
  initialTab,
  focusProjectId,
  onPatchProject,
  onManageProject,
  onReferToWarehouse,
  onUpdateTicket,
  onNavigateTab,
}) => {
  const stuckCount = projects.filter(isStuckOpen).length;
  const ticketCount = tickets.filter((t) => t.status === 'OPEN').length;
  const [tab, setTab] = useState<IssuesTab>(initialTab || (stuckCount > 0 || ticketCount === 0 ? 'stuck' : 'tickets'));

  const tabs: Array<{ id: IssuesTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'stuck', label: 'توقف‌ها', count: stuckCount, icon: <AlertOctagon className="w-4 h-4" /> },
    { id: 'tickets', label: 'تیکت‌ها', count: ticketCount, icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="توقف و تیکت" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sunken border border-line">
        {tabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-lg text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count > 0 && (
                <span className="text-[11px] min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white flex items-center justify-center tabular-nums">
                  {toPersianDigits(t.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'stuck' ? (
        <StuckProjectsDesk
          embedded
          projects={projects}
          currentUser={currentUser}
          focusProjectId={focusProjectId}
          onPatchProject={onPatchProject}
          onManageProject={onManageProject}
          onReferToWarehouse={onReferToWarehouse}
        />
      ) : (
        <TicketCenter
          tickets={tickets}
          currentUser={currentUser}
          users={users}
          focusProjectId={focusProjectId}
          onUpdateTicket={onUpdateTicket}
          onNavigateTab={onNavigateTab}
        />
      )}
    </div>
  );
};
