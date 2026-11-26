import React, { useState, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import { Project, User, ProjectAuditRecord } from '../../types';
import {
  X,
  FileText,
  Camera,
  History,
  Clock,
  Star,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Printer,
  Calendar,
  Layers,
  Check,
  Building2,
  Phone,
  MapPin,
  Lock,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import {
  toPersianDigits,
  formatJalali,
  formatJalaliDateTime,
  formatDuration,
  formatTimeOnly,
} from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';
import { getDisplayName } from '../../utils/technicianName';
import { triggerToast } from '../Toast';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  users?: User[];
  onClose: () => void;
  fetchAudit?: (projectId: string) => Promise<ProjectAuditRecord[]>;
  onPrintCertificate?: () => void;
}

type DossierTab = 'reports' | 'documents' | 'history';

export const ProjectDossierModal: React.FC<Props> = ({
  project,
  users = [],
  onClose,
  fetchAudit,
  onPrintCertificate,
}) => {
  useEscapeKey(onClose);
  const [activeTab, setActiveTab] = useState<DossierTab>('reports');
  const [auditRecords, setAuditRecords] = useState<ProjectAuditRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isQcApprovedAndCompleted = project.status === 'COMPLETED' && project.qcStatus === 'APPROVED';

  // Load audit records if on history tab and fetchAudit is provided
  useEffect(() => {
    if (activeTab === 'history' && fetchAudit && auditRecords.length === 0) {
      setLoadingAudit(true);
      fetchAudit(project.id)
        .then((records) => setAuditRecords(records || []))
        .catch(() => setAuditRecords([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab, fetchAudit, project.id, auditRecords.length]);

  // Lead technician name
  const leadName = users.find((u) => u.id === project.leadTechnicianId)?.name;
  const leadTech = leadName ? getDisplayName(leadName) : project.assignedTeamName || 'تعیین نشده';

  // All stuck incidents
  const allStuck = project.stuckIncidents || (project.stuckIncident ? [project.stuckIncident] : []);

  // Photos
  const beforePhotos = (project.beforePhotos || []).filter((p) => Boolean(p && p.trim() !== ''));
  const afterPhotos = [
    ...(project.afterPhotos || []),
    ...(project.completionPhotos || []),
  ].filter((p) => Boolean(p && p.trim() !== ''));

  const handlePrintClick = () => {
    if (!isQcApprovedAndCompleted) {
      triggerToast(
        'warning',
        'چاپ شناسنامه رسمی منحصراً پس از اتمام کامل پروژه و صدور تأییدیه نهایی کنترل کیفی (QC) مجاز می‌باشد.'
      );
      return;
    }
    if (onPrintCertificate) {
      onPrintCertificate();
    }
  };

  return (
    <Portal><div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
      className="fixed inset-0 z-50 flex justify-center items-start bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-surface border border-line rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* ================= Header ================= */}
        <div className="bg-canvas p-4 sm:p-5 border-b border-line flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black bg-surface text-brand-ink border border-brand/30 px-2.5 py-0.5 rounded-md">
                {project.code}
              </span>
              <span
                className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isQcApprovedAndCompleted
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : project.status === 'STUCK'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : project.status === 'IN_PROGRESS'
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                    : 'bg-raised text-ink-2 border-line-strong'
                }`}
              >
                {isQcApprovedAndCompleted
                  ? 'تایید نهایی QC ✅'
                  : project.status === 'STUCK'
                  ? 'متوقف در کارگاه ⚠️'
                  : project.status === 'IN_PROGRESS'
                  ? 'در حال نصب'
                  : project.status === 'COMPLETED'
                  ? 'اتمام نصب • در انتظار QC'
                  : 'در جریان اجرا'}
              </span>
              {project.assignedTeamName && (
                <span className="text-xs text-ink-2 font-medium">
                  اکیپ: <strong className="text-ink">{project.assignedTeamName}</strong>
                </span>
              )}
            </div>
            <h2 id="dossier-title" className="text-base sm:text-lg font-black text-ink truncate">
              {project.title}
            </h2>
            <div className="flex items-center gap-4 text-xs text-ink-2 flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-ink-3" />
                {project.customerName}
              </span>
              {project.customerPhone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-ink-3" />
                  {project.customerPhone}
                </span>
              )}
              <span className="flex items-center gap-1 truncate max-w-xs">
                <MapPin className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                {project.address}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پرونده پروژه"
            className="p-2 rounded-xl text-ink-2 hover:text-ink hover:bg-raised transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 3 Distinct Tabs Navigation ================= */}
        <div className="bg-sunken px-4 sm:px-6 border-b border-line flex items-center gap-2 overflow-x-auto">
          {[
            {
              id: 'reports' as const,
              label: 'گزارش‌ها و توقفات کارگاه',
              icon: FileText,
              badge: (project.dailyLogs?.length || 0) + allStuck.length,
            },
            {
              id: 'documents' as const,
              label: 'مدارک و عکس‌های نصب',
              icon: Camera,
              badge: beforePhotos.length + afterPhotos.length,
            },
            {
              id: 'history' as const,
              label: 'تاریخچه و سوابق تغییرات',
              icon: History,
              badge: (project.teamTransfers?.length || 0) + (project.workSessions?.length || 0),
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3.5 font-bold text-xs flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 focus-visible:outline-none ${
                  isSelected
                    ? 'border-brand text-brand-ink'
                    : 'border-transparent text-ink-2 hover:text-ink hover:border-line-strong'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono tabular-nums ${
                      isSelected
                        ? 'bg-brand text-on-brand font-black'
                        : 'bg-line text-ink-2'
                    }`}
                  >
                    {toPersianDigits(tab.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ================= Tab Content Body ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-ink-2">
          {/* TAB 1: REPORTS & STUCK INCIDENTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* 1. Daily Reports */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-ink" />
                    گزارش‌های روزانه ثبت‌شده توسط نصابان
                  </h3>
                  <span className="text-[12px] font-bold text-ink-3">
                    {toPersianDigits(project.dailyLogs?.length || 0)} گزارش ثبت‌شده
                  </span>
                </div>

                {!project.dailyLogs || project.dailyLogs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-canvas border border-line text-center space-y-1">
                    <Clock className="w-6 h-6 text-ink-3 mx-auto opacity-60" />
                    <p className="font-bold text-ink-2">هنوز گزارش روزانه‌ای برای این پروژه ثبت نشده است.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {project.dailyLogs.map((log, idx) => (
                      <div
                        key={log.id || idx}
                        className="p-4 rounded-xl bg-canvas border border-line space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-line pb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">{log.byUserName ? getDisplayName(log.byUserName) : leadTech}</span>
                            <span className="text-ink-3">•</span>
                            <span className="font-mono text-brand-ink">{formatJalali(log.date)}</span>
                          </div>
                          {typeof log.completedQuantity === 'number' && (
                            <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[12px]">
                              اجرا شده: {toPersianDigits(log.completedQuantity)} {log.quantityUnit || 'لت'}
                              {typeof log.remainingQuantity === 'number' &&
                                ` • باقی‌مانده: ${toPersianDigits(log.remainingQuantity)}`}
                            </span>
                          )}
                        </div>

                        {log.note && (
                          <div>
                            <span className="font-bold text-ink-3 block mb-0.5">خلاصه کار:</span>
                            <p className="text-ink font-medium leading-relaxed">{log.note}</p>
                          </div>
                        )}

                        {log.activityProgress && log.activityProgress.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {log.activityProgress.map((a) => (
                              <span
                                key={a.activityId}
                                className="text-[12px] bg-surface border border-line text-ink-2 px-2 py-0.5 rounded"
                              >
                                {a.activityTitle || a.activityId}: {toPersianDigits(a.completedQuantity)} {a.unit || ''}
                              </span>
                            ))}
                          </div>
                        )}

                        {(log.obstacles || log.equipmentIssues) && (
                          <div className="bg-surface p-2.5 rounded-lg border border-line/60 space-y-1">
                            <span className="font-bold text-ink-3 block mb-0.5">موانع و نکات تکمیلی:</span>
                            {log.obstacles && <p className="text-ink-2 leading-relaxed">موانع: {log.obstacles}</p>}
                            {log.equipmentIssues && (
                              <p className="text-ink-2 leading-relaxed">ابزار و متریال: {log.equipmentIssues}</p>
                            )}
                          </div>
                        )}

                        {/* Log Photos */}
                        {log.photos && log.photos.length > 0 && (
                          <div className="pt-2">
                            <span className="font-bold text-ink-3 block mb-1.5">تصاویر گزارش:</span>
                            <div className="flex gap-2 flex-wrap">
                              {log.photos.map((ph, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setSelectedImage(ph)}
                                  className="w-16 h-16 rounded-lg overflow-hidden border border-line-strong hover:border-brand transition cursor-pointer relative group"
                                >
                                  <CloudImage src={ph} alt={`عکس گزارش ${pIdx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Stuck Incidents */}
              <div className="space-y-3 pt-4 border-t border-line">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    سوابق توقفات و رویدادهای اضطراری کارگاه
                  </h3>
                  <span className="text-[12px] font-bold text-ink-3">
                    {toPersianDigits(allStuck.length)} مورد
                  </span>
                </div>

                {allStuck.length === 0 ? (
                  <div className="p-4 rounded-xl bg-canvas border border-line text-center text-ink-3">
                    هیچ رویداد توقفی برای این کارگاه ثبت نشده است (روال کار عادی).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allStuck.map((stuck, sIdx) => {
                      const isResolved = stuck.resolutionStatus === 'RESOLVED';
                      return (
                        <div
                          key={stuck.id || sIdx}
                          className={`p-4 rounded-xl border space-y-2 ${
                            isResolved
                              ? 'bg-canvas border-emerald-500/30'
                              : 'bg-rose-950/20 border-rose-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-line pb-2">
                            <span
                              className={`font-bold px-2.5 py-0.5 rounded text-[11px] ${
                                isResolved
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
                              {isResolved ? 'رفع توقف شده ✅' : 'متوقف فعال ⚠️'}
                            </span>
                            <span className="font-mono text-ink-3">
                              {formatJalaliDateTime(stuck.stuckAt)}
                            </span>
                          </div>

                          <div>
                            <span className="font-bold text-ink-3 block mb-0.5">علت توقف کار:</span>
                            <p className="text-ink font-bold leading-relaxed">
                              {stuck.description}
                            </p>
                          </div>

                          {stuck.resolutionNote && (
                            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-200">
                              <span className="font-bold text-emerald-300 block mb-0.5">اقدام انجام‌شده و حل مشکل:</span>
                              <p className="leading-relaxed">{stuck.resolutionNote}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Work Sessions */}
              {project.workSessions && project.workSessions.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-line">
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    جلسات و ساعات کاری ثبت‌شده در کارگاه
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {project.workSessions.map((ws, wsIdx) => (
                      <div
                        key={`${ws.startedAt}-${wsIdx}`}
                        className="p-3 rounded-xl bg-canvas border border-line space-y-1"
                      >
                        <div className="flex items-center justify-between text-ink font-bold">
                          <span>{formatJalali(ws.date)}</span>
                          <span className="text-sky-400 font-mono">
                            {ws.endedAt ? formatDuration(ws.startedAt, ws.endedAt) : 'در حال انجام'}
                          </span>
                        </div>
                        <div className="text-[12px] text-ink-3">
                          ساعت ورود: <span className="text-ink-2 font-mono">{formatTimeOnly(ws.startedAt)}</span> •
                          خروج: <span className="text-ink-2 font-mono">{ws.endedAt ? formatTimeOnly(ws.endedAt) : '—'}</span>
                        </div>
                        {ws.byUserName && (
                          <div className="text-[12px] text-ink-2 truncate">
                            ثبت توسط: {getDisplayName(ws.byUserName)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOCUMENTS & PHOTOS */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Before Photos */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <Camera className="w-4 h-4 text-brand-ink" />
                  تصاویر وضعیت محل پیش از آغاز نصب
                </h3>
                {beforePhotos.length === 0 ? (
                  <div className="p-5 rounded-xl bg-canvas border border-line text-center text-ink-3">
                    تصویری برای پیش از نصب ثبت نشده است.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {beforePhotos.map((ph, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImage(ph)}
                        className="h-32 rounded-xl overflow-hidden border border-line hover:border-brand transition cursor-pointer relative group bg-canvas"
                      >
                        <CloudImage src={ph} alt={`قبل نصب ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[11px] text-white px-1.5 py-0.5 rounded">
                          قبل نصب
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* After Photos */}
              <div className="space-y-3 pt-4 border-t border-line">
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  تصاویر اتمام کار و اجرای نهایی
                </h3>
                {afterPhotos.length === 0 ? (
                  <div className="p-5 rounded-xl bg-canvas border border-line text-center text-ink-3">
                    تصویر اتمام کار هنوز ثبت نشده است.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {afterPhotos.map((ph, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImage(ph)}
                        className="h-32 rounded-xl overflow-hidden border border-line hover:border-emerald-500 transition cursor-pointer relative group bg-canvas"
                      >
                        <CloudImage src={ph} alt={`بعد نصب ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[11px] text-emerald-300 px-1.5 py-0.5 rounded">
                          کیفیت نهایی
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Handover & Customer Acceptance */}
              <div className="space-y-3 pt-4 border-t border-line">
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-ink" />
                  صورتجلسه تحویل، رضایت‌سنجی و امضای کارفرما
                </h3>
                <div className="p-4 rounded-xl bg-canvas border border-line space-y-4">
                  {/* Rating + Signature status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                    <div className="space-y-1">
                      <span className="text-ink-3 font-bold block">امتیاز کیفیت کارفرما:</span>
                      <div className="flex items-center gap-1.5">
                        {project.qcScore ? (
                          <>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-4 h-4 ${s <= project.qcScore! ? 'text-brand-ink fill-brand' : 'text-ink-3'}`}
                                />
                              ))}
                            </div>
                            <span className="font-bold text-ink font-mono">{toPersianDigits(project.qcScore)} از 5</span>
                          </>
                        ) : (
                          <span className="text-ink-3">هنوز ارزیابی نشده</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-ink-3 font-bold block mb-1">وضعیت امضای کارفرما:</span>
                      {project.customerSignature ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          امضا ثبت و تایید شده ✅
                        </span>
                      ) : project.unavailabilityReason ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          عدم حضور کارفرما: {project.unavailabilityReason}
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-raised text-ink-2 border border-line-strong">
                          در انتظار ثبت امضا
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 5-item Checklist */}
                  <div>
                    <span className="font-bold text-ink-3 block mb-2">چک‌لیست استانداردهای تحویل:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { label: 'عملکرد صحیح موتور، ریموت و سیم‌کشی استاندارد', key: 'mechanismsChecked' },
                        { label: 'تراز بودن دقیق، عدم سایش و دوخت سالم پرده/شید', key: 'fabricsInspected' },
                        { label: 'مهاربندی محکم کرپی‌ها و پایه‌های سقف/دیوار', key: 'cleanWorkspace' },
                        { label: 'نظافت کامل محیط کار و جمع‌آوری براده‌ها', key: 'remoteHandover' },
                        { label: 'ارائه بروشور نگهداری و آموزش کاربری به مشتری', key: 'customerInstruction' },
                      ].map((item, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-line"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-[12px] text-ink">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="space-y-3 pt-4 border-t border-line">
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-ink" />
                  مشخصات فنی و مقادیر متراژ سفارش
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-canvas p-3 rounded-xl border border-line text-center">
                    <span className="text-ink-3 block text-[11px]">تعداد شید</span>
                    <span className="font-black text-sm text-ink font-mono">
                      {toPersianDigits(project.shadePanels || 0)} لت
                    </span>
                  </div>
                  <div className="bg-canvas p-3 rounded-xl border border-line text-center">
                    <span className="text-ink-3 block text-[11px]">تعداد پرده</span>
                    <span className="font-black text-sm text-ink font-mono">
                      {toPersianDigits(project.curtainPanels || 0)} لت
                    </span>
                  </div>
                  {(project.railCount || 0) > 0 && (
                    <div className="bg-canvas p-3 rounded-xl border border-line text-center">
                      <span className="text-ink-3 block text-[11px]">تعداد ریل</span>
                      <span className="font-black text-sm text-ink font-mono">
                        {toPersianDigits(project.railCount || 0)} عدد
                      </span>
                    </div>
                  )}
                  <div className="bg-canvas p-3 rounded-xl border border-line text-center">
                    <span className="text-ink-3 block text-[11px]">مکانیزم و تیپ</span>
                    <span className="font-bold text-xs text-brand-ink truncate block">
                      {project.mechanismType || 'استاندارد'}
                    </span>
                  </div>
                  <div className="bg-canvas p-3 rounded-xl border border-line text-center">
                    <span className="text-ink-3 block text-[11px]">اکیپ مجری</span>
                    <span className="font-bold text-xs text-ink truncate block">
                      {leadTech}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIMELINE & AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Milestone Timeline */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-ink" />
                  گاه‌شمار پیشرفت مراحل مأموریت
                </h3>
                <div className="p-4 rounded-xl bg-canvas border border-line space-y-4">
                  {[
                    {
                      title: 'ثبت پرونده و اندازه‌گیری اولیه',
                      date: project.createdAt,
                      done: true,
                      desc: `ثبت سفارش اولیه: ${[project.shadePanels ? `${toPersianDigits(project.shadePanels)} لت شید` : '', project.railCount ? `${toPersianDigits(project.railCount)} ریل` : '', project.curtainPanels ? `${toPersianDigits(project.curtainPanels)} لت پرده` : ''].filter(Boolean).join('، ') || '—'}`,
                    },
                    {
                      title: 'تخصیص اکیپ و زمان‌بندی تقویم',
                      date: project.scheduledDate,
                      done: Boolean(project.scheduledDate && project.assignedTeamId),
                      desc: project.assignedTeamName ? `اکیپ مجری: ${project.assignedTeamName}` : 'در انتظار تخصیص اکیپ',
                    },
                    {
                      title: 'اعزام و آغاز نصب در کارگاه',
                      done: ['IN_PROGRESS', 'PAUSED', 'STUCK', 'COMPLETED'].includes(project.status),
                      desc: project.status === 'IN_PROGRESS' ? 'اکیپ هم‌اکنون در محل کارگاه حضور دارد' : 'عملیات اجرایی آغاز گردیده است',
                    },
                    {
                      title: 'اتمام عملیات نصب و تحویل‌گیری',
                      done: project.status === 'COMPLETED',
                      desc: project.status === 'COMPLETED' ? 'گزارش اتمام کار و فرم صورتجلسه ثبت شده است' : 'در انتظار پایان نصب کلیه اقلام',
                    },
                    {
                      title: 'تأییدیه کنترل کیفی (QC) و صدور شناسنامه',
                      date: project.qcReviewedAt,
                      done: isQcApprovedAndCompleted,
                      desc: isQcApprovedAndCompleted
                        ? `تایید رسمی کنترل کیفی${project.qcScore ? ` با امتیاز ${toPersianDigits(project.qcScore)} از 5` : ''}`
                        : 'در صف بررسی و تایید کیفی مدیر QC',
                    },
                  ].map((step, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-3 relative">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                          step.done
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-raised text-ink-3 border border-line-strong'
                        }`}
                      >
                        {step.done ? <Check className="w-3.5 h-3.5" /> : toPersianDigits(sIdx + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${step.done ? 'text-ink' : 'text-ink-3'}`}>
                            {step.title}
                          </span>
                          {step.date && (
                            <span className="font-mono text-[12px] text-brand-ink">
                              {formatJalali(step.date)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-3 mt-0.5">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Transfer History */}
              {project.teamTransfers && project.teamTransfers.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-line">
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                    سوابق جابه‌جایی یا ارجاع اکیپ
                  </h3>
                  <div className="space-y-2">
                    {project.teamTransfers.map((tr, trIdx) => (
                      <div
                        key={tr.id || trIdx}
                        className="p-3 rounded-xl bg-canvas border border-line space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink">
                            انتقال از {tr.fromTeamName || 'اکیپ قبلی'} به {tr.toTeamName || 'اکیپ جدید'}
                          </span>
                          <span className="font-mono text-[11px] text-brand-ink">
                            {formatJalaliDateTime(tr.transferredAt)}
                          </span>
                        </div>
                        {tr.reason && <p className="text-[12px] text-ink-2">دلیل: {tr.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Audit Log */}
              {fetchAudit && (
                <div className="space-y-3 pt-4 border-t border-line">
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <History className="w-4 h-4 text-ink-2" />
                    سوابق لاگ تغییرات سیستمی (Audit Records)
                  </h3>
                  {loadingAudit ? (
                    <div className="p-4 text-center text-ink-3">در حال دریافت سوابق از سرور...</div>
                  ) : auditRecords.length === 0 ? (
                    <div className="p-4 rounded-xl bg-canvas border border-line text-center text-ink-3">
                      سابقه لاگ تغییراتی برای این پروژه ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {auditRecords.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-2.5 rounded-lg bg-canvas border border-line flex items-center justify-between text-[12px]"
                        >
                          <div>
                            <span className="font-bold text-ink">{rec.changed_by_name ? getDisplayName(rec.changed_by_name) : 'کاربر سیستم'}</span>
                            <span className="text-ink-3 mr-2">
                              عملیات:{' '}
                              {rec.action === 'INSERT' ? 'ایجاد' : rec.action === 'UPDATE' ? 'ویرایش' : rec.action === 'DELETE' ? 'حذف' : rec.action}
                            </span>
                          </div>
                          <span className="font-mono text-ink-3">
                            {formatJalaliDateTime(rec.changed_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= Footer Action Bar ================= */}
        <div className="bg-canvas p-4 sm:p-5 border-t border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Print Official Certificate button with Gating check */}
            <button
              type="button"
              onClick={handlePrintClick}
              aria-label={`چاپ شناسنامه رسمی پروژه ${project.title}`}
              className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-sm ${
                isQcApprovedAndCompleted
                  ? 'bg-brand hover:bg-brand-hover text-on-brand'
                  : 'bg-raised hover:bg-hover text-ink-2 hover:text-ink border border-line-strong'
              }`}
            >
              {isQcApprovedAndCompleted ? (
                <Printer className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4 text-amber-400" />
              )}
              <span>چاپ شناسنامه رسمی A4</span>
              {!isQcApprovedAndCompleted && (
                <span className="text-[11px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded mr-1">
                  نیازمند تایید QC
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-ink-2 hover:text-ink hover:bg-raised transition cursor-pointer"
          >
            بستن پرونده
          </button>
        </div>
      </div>

      {/* Lightbox Modal for Photo inspection */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <CloudImage
              src={selectedImage}
              alt="بزرگنمایی تصویر"
              className="max-w-full max-h-[85vh] object-contain rounded-xl border border-line"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/70 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div></Portal>
  );
};
