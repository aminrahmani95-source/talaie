import React, { useState, useMemo } from 'react';
import { Project, User } from '../../types';
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
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString } from '../../utils/jalali';
import { ProjectPassportPrint } from '../common/ProjectPassportPrint';

interface Props {
  currentUser: User;
  projects: Project[];
  users?: User[];
}

export const CeoMasterRegistry: React.FC<Props> = ({ currentUser, projects, users = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'IN_PROGRESS' | 'SCHEDULED' | 'STUCK'>('ALL');
  const [printingProject, setPrintingProject] = useState<Project | null>(null);

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
              کارتابل جامع شناسنامه پروژه‌ها
            </h2>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 px-3 py-1 rounded-full">
              مدیریت عامل
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#9BA7B6] mt-1.5 leading-relaxed">
            اشراف ۳۶۰ درجه بر کلیه مأموریت‌های گذشته، جاری و آتی گالری طلائیه به همراه شناسنامه رسمی چاپی
          </p>
        </div>

        <div className="text-left font-mono text-xs text-[#C5A059] font-bold shrink-0">
          تاریخ امروز: {toPersianDigits(getTodayPersianString())}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#151B23] rounded-2xl p-4 border border-[#212835] space-y-1">
          <span className="text-xs text-[#9BA7B6] font-bold">کل مأموریت‌ها</span>
          <p className="text-2xl font-black text-[#F0F4F8] tabular-nums">
            {toPersianDigits(metrics.total)}
          </p>
        </div>

        <div className="bg-[#151B23] rounded-2xl p-4 border border-emerald-500/30 space-y-1">
          <span className="text-xs text-emerald-400 font-bold">تکمیل و تایید QC ✅</span>
          <p className="text-2xl font-black text-emerald-400 tabular-nums">
            {toPersianDigits(metrics.approved)}
          </p>
        </div>

        <div className="bg-[#151B23] rounded-2xl p-4 border border-[#C5A059]/30 space-y-1">
          <span className="text-xs text-[#C5A059] font-bold">در حال اجرا سر کارگاه</span>
          <p className="text-2xl font-black text-[#C5A059] tabular-nums">
            {toPersianDigits(metrics.inProgress)}
          </p>
        </div>

        <div className="bg-[#151B23] rounded-2xl p-4 border border-rose-500/30 space-y-1">
          <span className="text-xs text-rose-400 font-bold">متوقف یا نیازمند توجه ⚠️</span>
          <p className="text-2xl font-black text-rose-400 tabular-nums">
            {toPersianDigits(metrics.stuck)}
          </p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-[#151B23] rounded-2xl p-4 border border-[#212835] flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#637184] absolute right-3.5 top-3 pointer-events-none" />
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

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0" role="tablist">
          {[
            { id: 'ALL', label: 'همه مأموریت‌ها' },
            { id: 'APPROVED', label: 'تایید QC شده ✅' },
            { id: 'IN_PROGRESS', label: 'در حال نصب' },
            { id: 'SCHEDULED', label: 'زمان‌بندی‌شده' },
            { id: 'STUCK', label: 'متوقف ⚠️' },
          ].map((item) => {
            const isSelected = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setStatusFilter(item.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059] ${
                  isSelected
                    ? 'bg-[#C5A059] text-[#0D1117] shadow-xs'
                    : 'bg-[#111620] text-[#9BA7B6] hover:text-white border border-[#212835]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
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
                        تاریخ: {toPersianDigits(p.scheduledDate)}
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
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
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

                    {/* Print Button */}
                    <button
                      type="button"
                      onClick={() => setPrintingProject(p)}
                      aria-label={`چاپ شناسنامه رسمی پروژه ${p.title}`}
                      className="px-3.5 py-1.5 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>چاپ شناسنامه A4</span>
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
                        {toPersianDigits(p.qcScore || 5)} از ۵
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
                {isStuck && p.stuckIncident && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                    <span className="font-black flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      علت توقف مأموریت:
                    </span>
                    <p className="text-[11px] text-[#F0F4F8] leading-relaxed">{p.stuckIncident.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
