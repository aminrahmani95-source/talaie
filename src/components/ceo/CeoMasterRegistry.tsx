import React, { useState, useMemo } from 'react';
import { Project, User, ProjectAuditRecord } from '../../types';
import {
  FileCheck2,
  Search,
  Printer,
  ShieldCheck,
  Flame,
  Star,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Phone,
  MapPin,
  Camera,
  Layers,
  ChevronDown,
  Filter,
  X,
  Check,
  FileText,
  Lock,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString, formatJalali } from '../../utils/jalali';
import { ProjectPassportPrint } from '../common/ProjectPassportPrint';
import { ProjectDossierModal } from './ProjectDossierModal';
import { triggerToast } from '../Toast';

interface Props {
  currentUser: User;
  projects: Project[];
  users?: User[];
  fetchAudit?: (projectId: string) => Promise<ProjectAuditRecord[]>;
}

export const CeoMasterRegistry: React.FC<Props> = ({ currentUser, projects, users = [], fetchAudit }) => {
  if (currentUser.role !== 'CEO') {
    return (
      <div className="bg-[#151B23] border border-rose-500/30 rounded-2xl p-8 text-center text-rose-400 space-y-3 my-6 max-w-2xl mx-auto">
        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto opacity-70" />
        <h2 className="text-lg font-bold">دسترسی غیرمجاز: شناسنامه رسمی پروژه‌ها</h2>
        <p className="text-xs text-[#9BA7B6] leading-relaxed">
          مشاهده شناسنامه رسمی و احراز هویت کیفی پروژه‌ها منحصراً در حیطه وظایف و اختیارات مدیریت عامل (CEO) می‌باشد.
        </p>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'IN_PROGRESS' | 'SCHEDULED' | 'STUCK'>('ALL');
  const [printingProject, setPrintingProject] = useState<Project | null>(null);
  const [dossierProject, setDossierProject] = useState<Project | null>(null);

  const handlePrintCertificate = (project: Project) => {
    const isQcApproved = project.status === 'COMPLETED' && project.qcStatus === 'APPROVED';
    if (!isQcApproved) {
      triggerToast(
        'warning',
        'چاپ شناسنامه رسمی منحصراً پس از اتمام کامل پروژه و صدور تأییدیه نهایی کنترل کیفی (QC) مجاز می‌باشد.'
      );
      return;
    }
    setPrintingProject(project);
  };

  // High-level Executive Metrics
  const metrics = useMemo(() => {
    let approved = 0;
    let inProgress = 0;
    let scheduled = 0;
    let stuck = 0;

    for (const p of projects) {
      if (p.status === 'COMPLETED' && p.qcStatus === 'APPROVED') {
        approved++;
      } else if (p.status === 'IN_PROGRESS' || p.status === 'EN_ROUTE') {
        inProgress++;
      } else if (p.status === 'SCHEDULED' || p.status === 'MEASUREMENT_PENDING') {
        scheduled++;
      } else if (p.status === 'STUCK') {
        stuck++;
      }
    }

    return {
      total: projects.length,
      approved,
      inProgress,
      scheduled,
      stuck,
    };
  }, [projects]);

  // Filtered List
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter === 'APPROVED' && !(p.status === 'COMPLETED' && p.qcStatus === 'APPROVED')) {
        return false;
      }
      if (statusFilter === 'IN_PROGRESS' && p.status !== 'IN_PROGRESS' && p.status !== 'EN_ROUTE') {
        return false;
      }
      if (statusFilter === 'SCHEDULED' && p.status !== 'SCHEDULED' && p.status !== 'MEASUREMENT_PENDING') {
        return false;
      }
      if (statusFilter === 'STUCK' && p.status !== 'STUCK') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchCustomer = (p.customerName || '').toLowerCase().includes(q);
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchAddress = (p.address || '').toLowerCase().includes(q);
        const matchTeam = (p.assignedTeamName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCustomer && !matchCode && !matchAddress && !matchTeam) {
          return false;
        }
      }

      return true;
    });
  }, [projects, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <div className="bg-[#151B23] rounded-2xl p-6 border border-[#212835] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-[#F0F4F8]">
              داشبورد اختصاصی مدیر کل (CEO Master Registry)
            </h2>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 px-3 py-1 rounded-full">
              مدیریت عامل
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#9BA7B6] mt-1.5 leading-relaxed">
            کارتابل اشراف 360 درجه، آمار کلان اجرایی و صدور شناسنامه رسمی پروژه‌های گالری طلایی
          </p>
        </div>

        <div className="text-left font-mono text-xs text-[#C5A059] font-bold shrink-0">
          تاریخ امروز: {toPersianDigits(getTodayPersianString())}
        </div>
      </div>

      {/* Interactive KPI Filter Cards (Acts as Primary Status Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="tablist" aria-label="فیلتر وضعیت پروژه‌ها">
        {[
          {
            id: 'ALL' as const,
            label: 'همه مأموریت‌ها',
            count: metrics.total,
            icon: Layers,
            desc: 'تمام پرونده‌های فعال',
            badgeClass: 'bg-[#C5A059] text-[#0D1117]',
            activeClass: 'border-[#C5A059] ring-2 ring-[#C5A059]/50 bg-[#C5A059]/10 shadow-lg shadow-[#C5A059]/10 scale-[1.02]',
            activeTextClass: 'text-[#C5A059]',
          },
          {
            id: 'APPROVED' as const,
            label: 'تایید QC شده ✅',
            count: metrics.approved,
            icon: CheckCircle2,
            desc: 'تکمیل و شناسنامه‌دار',
            badgeClass: 'bg-emerald-500 text-[#0D1117]',
            activeClass: 'border-emerald-500 ring-2 ring-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 scale-[1.02]',
            activeTextClass: 'text-emerald-400',
          },
          {
            id: 'IN_PROGRESS' as const,
            label: 'در حال نصب',
            count: metrics.inProgress,
            icon: Flame,
            desc: 'اکیپ فعال سر کارگاه',
            badgeClass: 'bg-amber-400 text-[#0D1117]',
            activeClass: 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-400/10 shadow-lg shadow-amber-400/10 scale-[1.02]',
            activeTextClass: 'text-amber-400',
          },
          {
            id: 'SCHEDULED' as const,
            label: 'در صف اجرا و متراژ',
            count: metrics.scheduled,
            icon: Clock,
            desc: 'زمان‌بندی و اعزام',
            badgeClass: 'bg-sky-400 text-[#0D1117]',
            activeClass: 'border-sky-400 ring-2 ring-sky-400/50 bg-sky-400/10 shadow-lg shadow-sky-400/10 scale-[1.02]',
            activeTextClass: 'text-sky-400',
          },
          {
            id: 'STUCK' as const,
            label: 'متوقف یا نیاز به اقدام ⚠️',
            count: metrics.stuck,
            icon: AlertTriangle,
            desc: 'پیگیری فوری مدیریتی',
            badgeClass: 'bg-rose-500 text-white',
            activeClass: 'border-rose-500 ring-2 ring-rose-500/50 bg-rose-500/10 shadow-lg shadow-rose-500/10 scale-[1.02]',
            activeTextClass: 'text-rose-400',
          },
        ].map((card) => {
          const isSelected = statusFilter === card.id;
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setStatusFilter(card.id)}
              className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                isSelected
                  ? card.activeClass
                  : 'bg-[#151B23] border-[#212835] hover:border-[#384457] hover:bg-[#1A222D] hover:-translate-y-0.5'
              }`}
            >
              {/* Card Top: Icon + Selection Badge */}
              <div className="flex items-center justify-between w-full">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected
                      ? `${card.badgeClass} shadow-sm`
                      : 'bg-[#0D1117] text-[#9BA7B6] group-hover:text-white group-hover:bg-[#212835]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {isSelected ? (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs ${card.badgeClass}`}>
                    <Check className="w-3 h-3 stroke-[3]" />
                    فیلتر فعال
                  </span>
                ) : (
                  <span className="text-[10px] text-[#637184] group-hover:text-[#9BA7B6] font-medium transition-colors">
                    کلیک برای فیلتر
                  </span>
                )}
              </div>

              {/* Card Bottom: Number + Label + Desc */}
              <div>
                <p
                  className={`text-2xl sm:text-3xl font-black tabular-nums transition-colors ${
                    isSelected ? card.activeTextClass : 'text-[#F0F4F8]'
                  }`}
                >
                  {toPersianDigits(card.count)}
                </p>
                <div className="mt-1">
                  <span
                    className={`text-xs font-bold transition-colors ${
                      isSelected ? card.activeTextClass : 'text-[#9BA7B6] group-hover:text-[#F0F4F8]'
                    }`}
                  >
                    {card.label}
                  </span>
                </div>
                <p className="text-[10px] text-[#637184] mt-0.5 truncate">{card.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Results Summary Bar (Filter Chips completely removed) */}
      <div className="bg-[#151B23] rounded-2xl p-3 sm:p-4 border border-[#212835] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-[#637184] absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو با نام پروژه، کارفرما، کد سفارش، نشانی، اکیپ..."
            className="w-full text-xs pr-10 pl-9 py-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] placeholder-[#637184] focus:border-[#C5A059] focus-visible:ring-1 focus-visible:ring-[#C5A059] outline-none transition"
            aria-label="جستجوی پروژه‌ها"
          />
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-2.5 text-[#637184] hover:text-[#F0F4F8] p-0.5 rounded-md transition cursor-pointer"
              aria-label="پاک کردن متن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Filter Indicator & Reset */}
        <div className="flex items-center justify-between md:justify-end gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-[#0D1117] border border-[#212835] text-[#9BA7B6] flex items-center gap-1.5">
            <span className="text-[#637184]">نمایش پرونده‌ها:</span>
            <strong className="text-[#F0F4F8] font-bold">
              {toPersianDigits(filteredProjects.length)}
            </strong>
            <span className="text-[#637184]">از</span>
            <span className="text-[#9BA7B6] font-mono">{toPersianDigits(projects.length)}</span>
          </div>

          {(statusFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#C5A059] hover:bg-[#C5A059]/10 border border-[#C5A059]/30 transition cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>پاک‌کردن فیلترها</span>
            </button>
          )}
        </div>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-[#151B23] rounded-2xl p-12 text-center border border-[#212835] text-xs text-[#9BA7B6] space-y-2">
          <FileCheck2 className="w-8 h-8 text-[#637184] mx-auto opacity-50" />
          <h4 className="font-bold text-[#F0F4F8]">موردی برای نمایش یافت نشد</h4>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((p) => {
            const isApproved = p.status === 'COMPLETED' && p.qcStatus === 'APPROVED';
            const isStuck = p.status === 'STUCK';
            const isInProgress = p.status === 'IN_PROGRESS';
            const stuckIncident = p.stuckIncident || (p.stuckIncidents && p.stuckIncidents[p.stuckIncidents.length - 1]);

            return (
              <div
                key={p.id}
                className={`bg-[#151B23] rounded-2xl p-5 border transition space-y-4 ${
                  isApproved
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : isStuck
                    ? 'border-rose-500/50'
                    : isInProgress
                    ? 'border-[#C5A059]/50'
                    : 'border-[#212835]'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#212835] pb-3.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2.5 py-0.5 rounded">
                        {p.code}
                      </span>
                      {p.isForceMajeure && (
                        <span className="flex items-center gap-1 text-[11px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/30">
                          <Flame className="w-3 h-3 text-rose-400" />
                          فورس‌ماژور
                        </span>
                      )}
                      <span className="text-xs text-[#9BA7B6] font-bold">
                        تاریخ: {formatJalali(p.scheduledDate)}
                      </span>
                      {p.assignedTeamName && (
                        <span className="text-xs text-[#C5A059] font-bold">
                          • {p.assignedTeamName}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-[#F0F4F8] mt-1">{p.title}</h3>
                  </div>

                  {/* Actions & QC Badge */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      isApproved
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : isStuck
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : isInProgress
                        ? 'bg-[#C5A059]/15 text-[#C5A059] border-[#C5A059]/30'
                        : 'bg-[#1C232D] text-[#9BA7B6] border-[#2D3748]'
                    }`}>
                      {isApproved ? 'تایید نهایی QC ✅' :
                       isStuck ? 'متوقف در کارگاه ⚠️' :
                       isInProgress ? 'در حال نصب' : 'زمان‌بندی‌شده'}
                    </span>

                    {/* Dossier & Documents Button */}
                    <button
                      type="button"
                      onClick={() => setDossierProject(p)}
                      aria-label={`مشاهده مدارک، گزارش‌ها و تاریخچه پروژه ${p.title}`}
                      className="px-3.5 py-1.5 bg-[#1C232D] hover:bg-[#252F3D] text-[#F0F4F8] hover:text-[#C5A059] border border-[#2D3748] hover:border-[#C5A059]/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>مدارک و پرونده ۳۶۰°</span>
                    </button>

                    {/* Print Button (Gated strictly to QC approved + completed projects) */}
                    <button
                      type="button"
                      onClick={() => handlePrintCertificate(p)}
                      aria-label={`چاپ شناسنامه رسمی پروژه ${p.title}`}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] ${
                        isApproved
                          ? 'bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117]'
                          : 'bg-[#1C232D] hover:bg-[#252F3D] text-[#9BA7B6] hover:text-[#F0F4F8] border border-[#2D3748]'
                      }`}
                    >
                      {isApproved ? (
                        <Printer className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>چاپ شناسنامه A4</span>
                      {!isApproved && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1 py-0.5 rounded">
                          نیازمند تایید QC
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Customer info */}
                  <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] space-y-1">
                    <span className="text-[#637184] font-bold block">کارفرما و نشانی:</span>
                    <p className="font-bold text-[#F0F4F8]">{p.customerName}</p>
                    <p className="text-[#9BA7B6] font-mono">{p.customerPhone || 'بدون شماره'}</p>
                    <p className="text-[#9BA7B6] line-clamp-1">{p.address}</p>
                  </div>

                  {/* Technical info */}
                  <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] space-y-1">
                    <span className="text-[#637184] font-bold block">مشخصات فنی و مقادیر:</span>
                    <p className="font-bold text-[#C5A059]">
                      {p.shadePanels > 0 && `${toPersianDigits(p.shadePanels)} لت شید`}
                      {p.shadePanels > 0 && p.curtainPanels > 0 && ' • '}
                      {p.curtainPanels > 0 && `${toPersianDigits(p.curtainPanels)} لت پرده`}
                    </p>
                    <p className="text-[#9BA7B6]">{p.mechanismType || 'مکانیزم استاندارد'}</p>
                    {p.specialTools && p.specialTools.length > 0 && (
                      <p className="text-amber-300 font-bold">ابزار خاص: {p.specialTools.join('، ')}</p>
                    )}
                  </div>

                  {/* Quality & Sign-off info */}
                  <div className="bg-[#0D1117] p-3 rounded-xl border border-[#212835] space-y-1">
                    <span className="text-[#637184] font-bold block">کیفیت و امضای مشتری:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            (p.qcScore || 5) >= s ? 'text-[#C5A059] fill-[#C5A059]' : 'text-[#2D3748]'
                          }`}
                        />
                      ))}
                      <span className="font-bold text-[#F0F4F8] mr-1">
                        {toPersianDigits(p.qcScore || 5)} از 5
                      </span>
                    </div>
                    <p className="text-[#9BA7B6]">
                      امضای کارفرما: <strong className={p.customerSignature ? 'text-emerald-400' : 'text-[#637184]'}>
                        {p.customerSignature ? 'ثبت و تایید شده ✅' : 'در انتظار ثبت'}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Stuck incident banner if any */}
                {isStuck && stuckIncident && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                    <span className="font-black flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      علت توقف مأموریت:
                    </span>
                    <p className="text-[11px] text-[#F0F4F8] leading-relaxed">{stuckIncident.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Project Dossier Modal (Reports, Documents, History) */}
      {dossierProject && (
        <ProjectDossierModal
          project={dossierProject}
          users={users}
          onClose={() => setDossierProject(null)}
          fetchAudit={fetchAudit}
          onPrintCertificate={() => {
            const targetProj = dossierProject;
            setDossierProject(null);
            handlePrintCertificate(targetProj);
          }}
        />
      )}

      {/* Printable Modal Lightbox */}
      {printingProject && (
        <ProjectPassportPrint
          project={printingProject}
          users={users}
          onClose={() => setPrintingProject(null)}
        />
      )}
    </div>
  );
};
