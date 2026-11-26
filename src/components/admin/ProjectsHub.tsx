import React, { useMemo, useState } from 'react';
import { BarChart3, FileCheck2 } from 'lucide-react';
import type { MaterialRequest, Project, ProjectAuditRecord, Ticket, User } from '../../types';
import { ProjectsReport } from './ProjectsReport';
import { CeoMasterRegistry } from '../ceo/CeoMasterRegistry';
import { computeSlaMetrics } from '../../utils/sla';
import { toPersianDigits } from '../../utils/jalali';

type HubTab = 'report' | 'registry';

/**
 * «پروژه‌ها و گزارش»: گزارش دوره‌ای (برنامه‌ریزی‌شده، تمام‌شده، متوقف) و فهرست کامل پروژه‌ها با شناسنامه.
 * قبلاً گزارش زیر پیشخوان پنهان بود و شناسنامه یک منوی جدا.
 */
export const ProjectsHub: React.FC<{
  currentUser: User;
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  materialRequests: MaterialRequest[];
  /** فقط مدیر QC و مدیرعامل شناسنامه‌ی رسمی را می‌بینند */
  canSeeRegistry: boolean;
  fetchAudit: (projectId: string) => Promise<ProjectAuditRecord[]>;
  onOpenProject: (project: Project) => void;
}> = ({ currentUser, projects, users, tickets, materialRequests, canSeeRegistry, fetchAudit, onOpenProject }) => {
  const [tab, setTab] = useState<HubTab>('report');

  const kpis = useMemo(() => {
    const sla = computeSlaMetrics(tickets);
    const rated = projects.filter((p) => p.customerSatisfaction && p.customerSatisfaction > 0);
    const avg = rated.length ? Number((rated.reduce((s, p) => s + (p.customerSatisfaction || 0), 0) / rated.length).toFixed(1)) : 0;
    return [
      { label: 'کل پروژه‌های ثبت‌شده', value: toPersianDigits(projects.length) },
      { label: 'تأیید نهایی QC', value: toPersianDigits(projects.filter((p) => p.qcStatus === 'APPROVED').length), tone: 'text-emerald-600 dark:text-emerald-300' },
      { label: 'رضایت مشتری', value: avg > 0 ? `${toPersianDigits(avg)} از ۵` : '—' },
      { label: 'تیکت‌های حل‌شده در مهلت', value: `${toPersianDigits(sla.onTimeRate)}٪`, tone: 'text-emerald-600 dark:text-emerald-300' },
      { label: 'تیکت‌های عقب‌افتاده', value: toPersianDigits(sla.openOverdue), tone: sla.openOverdue ? 'text-rose-600 dark:text-rose-300' : undefined },
      {
        label: 'متریال تحویل‌شده به کارگاه',
        value: toPersianDigits(materialRequests.filter((r) => r.status === 'DELIVERED_CONFIRMED').length),
      },
    ];
  }, [projects, tickets, materialRequests]);

  const tabs: Array<{ id: HubTab; label: string; icon: React.ReactNode }> = [
    { id: 'report', label: 'گزارش کلی', icon: <BarChart3 className="w-4 h-4" /> },
    ...(canSeeRegistry ? [{ id: 'registry' as const, label: 'همه‌ی پروژه‌ها و شناسنامه', icon: <FileCheck2 className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg sm:text-xl font-black text-ink">پروژه‌ها و گزارش</h1>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="پروژه‌ها و گزارش" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sunken border border-line">
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
              </button>
            );
          })}
        </div>
      )}

      {tab === 'report' || !canSeeRegistry ? (
        <>
          <ProjectsReport projects={projects} onOpenProject={onOpenProject} />
          <section className="bg-surface rounded-xl border border-line p-3 sm:p-4">
            <h3 className="text-sm font-black text-ink mb-3">شاخص‌های کلی (همه‌ی زمان‌ها)</h3>
            <div className="grid grid-cols-2 @min-[700px]:grid-cols-3 gap-2">
              {kpis.map((k) => (
                <div key={k.label} className="p-3 rounded-lg bg-sunken border border-line">
                  <div className={`text-xl font-black tabular-nums ${k.tone || 'text-ink'}`}>{k.value}</div>
                  <div className="text-[12px] text-ink-2 mt-1">{k.label}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <CeoMasterRegistry currentUser={currentUser} projects={projects} users={users} fetchAudit={fetchAudit} />
      )}
    </div>
  );
};
