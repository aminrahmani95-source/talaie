import React, { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, Smartphone } from 'lucide-react';
import type { Project, Ticket, User } from '../../types';
import { StuckProjectsDesk } from './StuckProjectsDesk';
import { TicketCenter } from './TicketCenter';
import { ClientErrorsPanel } from './ClientErrorsPanel';
import { SupabaseSyncService } from '../../utils/supabase';
import { isStuckOpen } from '../../utils/navCounts';
import { toPersianDigits } from '../../utils/jalali';

export type IssuesTab = 'stuck' | 'tickets' | 'errors';

/**
 * «توقف و تیکت»: یک صفحه برای همه‌ی موانع کار. توقف‌ها (مهلت 72 ساعت) و تیکت‌ها قبلاً
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

  // تعداد خطاهای گوشی‌ها در 24 ساعت گذشته (برای عدد روی زبانه)
  const [errorCount, setErrorCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    SupabaseSyncService.listClientErrorReports(since).then((res) => {
      if (alive && res.status === 'ok') setErrorCount(res.rows.length);
    });
    return () => {
      alive = false;
    };
  }, []);

  const tabs: Array<{ id: IssuesTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'stuck', label: 'توقف‌ها', count: stuckCount, icon: <AlertOctagon className="w-4 h-4" /> },
    { id: 'tickets', label: 'تیکت‌ها', count: ticketCount, icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'errors', label: 'خطای گوشی‌ها', count: errorCount, icon: <Smartphone className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="موانع، تیکت‌ها و خطای گوشی‌ها" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-sunken border border-line">
        {tabs.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] px-1 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
              }`}
            >
              <span className="hidden sm:inline-flex">{t.icon}</span>
              <span className="truncate">{t.label}</span>
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
      ) : tab === 'errors' ? (
        <ClientErrorsPanel projects={projects} onManageProject={onManageProject} />
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
