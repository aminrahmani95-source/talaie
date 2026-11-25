import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, User } from '../types';
import {
  Printer,
  X,
  ShieldCheck,
  Star,
  Clock,
  MapPin,
  FileCheck2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toPersianDigits, formatDuration, formatTimeOnly, formatJalali } from '../utils/jalali';
import { CloudImage } from './common/CloudImage';
import { getDisplayName } from '../utils/technicianName';
import { calculateWorkSessionsSummary } from '../utils/multiDay';
import { LOGO_GOLD } from '../assets/logo';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Props {
  project: Project;
  users: User[];
  onClose: () => void;
}

export const HandoverCertificateModal: React.FC<Props> = ({ project, users, onClose }) => {
  useEscapeKey(onClose);
  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    document.body.classList.add('printing-certificate-open');
    return () => {
      document.body.classList.remove('printing-certificate-open');
    };
  }, []);

  const rawLead = users.find((u) => u.id === project.leadTechnicianId)?.name;
  const leadTech = rawLead ? getDisplayName(rawLead) : 'تکنسین گالری طلایی';
  const beforePhoto = project.beforePhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));
  const afterPhoto =
    project.afterPhotos?.find((ph) => Boolean(ph && ph.trim() !== '')) ||
    project.completionPhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));
  const checklist = project.handoverChecklist;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-title"
      className="certificate-modal-overlay fixed inset-0 z-50 flex justify-center items-start bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="certificate-modal-container bg-[#151B23] rounded-lg max-w-3xl w-full shadow-2xl my-auto border border-[#212835] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Action Bar (Screen Only - Hidden in Print) */}
        <div className="no-print bg-[#0D1117] px-6 py-4 text-[#F0F4F8] flex items-center justify-between border-b border-[#212835]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1C232D] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id="cert-title" className="font-bold text-base sm:text-lg text-[#F0F4F8]">
                شناسنامه رسمی تحویل و تاییدیه کیفی
              </h3>
              <p className="text-xs text-[#C5A059]">{project.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] rounded-md text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition cursor-pointer"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Official Certificate Body */}
        <div className="printable-certificate p-6 sm:p-10 space-y-6 text-[#212121] bg-[#FCFAF7]">
          {/* Certificate Header with Talaei Logo */}
          <div className="flex items-center justify-between border-b-2 border-[#C5A059] pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#212121] border-2 border-[#C5A059] flex items-center justify-center p-2 shadow-sm">
                <img
                  src={LOGO_GOLD}
                  alt="نشان گالری طلایی"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[#212121] tracking-tight">
                  گالری طلایی | TALAEI GALLERY
                </h1>
                <p className="text-xs sm:text-sm text-[#A88738] font-bold mt-0.5">
                  شناسنامه رسمی تحویل، گواهی اصالت و تاییدیه کنترل کیفیت (QC)
                </p>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  مرکز تخصصی طراحی، دوخت و تجهیز پرده‌های لوکس و سیستم‌های موتوری هوشمند (talaei.ir)
                </p>
              </div>
            </div>

            <div className="text-left space-y-1">
              <div className="text-xs font-bold text-slate-500">شماره سفارش:</div>
              <div className="text-sm font-black text-[#212121] bg-white border border-[#E8E4DC] px-2.5 py-1 rounded-lg font-mono">
                {project.code || '—'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                تاریخ: {formatJalali(project.completedAt || project.scheduledDate)}
              </div>
            </div>
          </div>

          {/* Draft warning watermark banner for unapproved exceptional completions */}
          {project.isExceptionalCompletion && project.qcStatus !== 'APPROVED' && (
            <div className="bg-amber-50 border-2 border-dashed border-amber-400 rounded-xl p-3 text-center text-xs text-amber-900 font-bold space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>پیش‌نویس موقت تحویل ناقص — فاقد اعتبار تحویل قطعی یا تسویه‌حساب نهایی</span>
              </div>
              <p className="text-[11px] font-normal text-amber-700">
                این پروژه با اعلام اتمام استثنایی و کسری اقلام ثبت شده است و تا پیش از تأیید رسمی مدیر کنترل کیفی (QC_MANAGER)، سند نهایی محسوب نمی‌شود.
              </p>
            </div>
          )}

          {/* Project & Client Information Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-[#E8E4DC] text-xs">
            <div>
              <span className="text-slate-400 block text-xs">کارفرما / سفارش‌دهنده:</span>
              <span className="font-bold text-[#212121] mt-0.5 block">{project.customerName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">شماره تماس:</span>
              <span className="font-mono font-bold text-slate-700 mt-0.5 block" dir="ltr">
                {project.customerPhone ? toPersianDigits(project.customerPhone) : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">سرپرست اکیپ نصب:</span>
              <span className="font-bold text-[#212121] mt-0.5 block">{leadTech || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs">وضعیت کنترل کیفی:</span>
              <span className={`font-black mt-0.5 block ${project.qcStatus === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {project.qcStatus === 'APPROVED'
                  ? project.isExceptionalCompletion
                    ? '✓ تایید نهایی QC با کسری اقلام'
                    : '✓ تایید نهایی QC'
                  : project.isExceptionalCompletion
                  ? 'در انتظار تصمیم QC (تحویل ناقص)'
                  : 'در انتظار بررسی QC'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">نشانی محل نصب: {project.address || '—'}</span>
            </div>
          </div>

          {/* Technical Specifications Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white">
            <div className="bg-[#212121] px-4 py-2.5 text-white flex items-center justify-between text-xs font-bold">
              <span>مشخصات فنی و مقادیر تحویل‌شده پروژه:</span>
              <span className="text-[#C5A059] font-bold">{project.title}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-x-reverse divide-y divide-slate-100 text-center text-xs p-2">
              <div className="p-2.5">
                <span className="text-slate-400 block text-xs">شیدهای هوشمند:</span>
                <span className="font-black text-base text-[#212121] mt-1 block">
                  {toPersianDigits(project.shadePanels)} لت
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-slate-400 block text-xs">پرده و حریر دکوراتیو:</span>
                <span className="font-black text-base text-[#C5A059] mt-1 block">
                  {toPersianDigits(project.curtainPanels)} لت
                </span>
              </div>
              {(project.railCount || 0) > 0 && (
                <div className="p-2.5">
                  <span className="text-slate-400 block text-xs">ریل:</span>
                  <span className="font-black text-base text-[#212121] mt-1 block">
                    {toPersianDigits(project.railCount || 0)} عدد
                  </span>
                </div>
              )}
              <div className="p-2.5">
                <span className="text-slate-400 block text-xs">متراژ تقریبی:</span>
                <span className="font-black text-sm text-slate-700 mt-1 block">
                  {toPersianDigits(project.approximateArea || '—')} مترمربع
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-slate-400 block text-xs">مکانیزم / سیستم حرکتی:</span>
                <span className="font-bold text-xs text-slate-800 mt-1 block truncate">
                  {project.mechanismType || 'استاندارد گالری طلایی'}
                </span>
              </div>
            </div>
          </div>

          {/* Exceptional Completion / Incomplete Delivery Banner */}
          {project.isExceptionalCompletion && project.exceptionalCompletionDetails && (
            <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {project.qcStatus === 'APPROVED'
                    ? 'گواهی رسمی تحویل با کسری اقلام (اتمام استثنایی با تایید رسمی واحد کنترل کیفی)'
                    : 'پیش‌نویس تحویل با کسری اقلام — در انتظار تصمیم‌گیری مدیر ارشد QC (فاقد اعتبار تحویل نهایی)'}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                <span className="font-bold text-rose-700">دلیل مستند عدم اتمام کلیه اقلام طرح:</span>{' '}
                «{project.exceptionalCompletionDetails.documentedReason}»
              </p>
              <div className="pt-2 border-t border-rose-200 text-slate-700">
                <span className="font-bold block mb-1 text-rose-900">اقلام کسرشده / تحویل‌نشده نسبت به طرح مصوب:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                  {project.exceptionalCompletionDetails.remainingActivities.map((act) => (
                    <div
                      key={act.activityId}
                      className="bg-white/90 px-3 py-1.5 rounded-lg border border-rose-200 flex items-center justify-between shadow-2xs"
                    >
                      <span className="font-medium text-[#212121]">{act.title}:</span>
                      <span className="font-bold text-rose-700">
                        کسر {toPersianDigits(act.remainingQuantity)} {act.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Before & After Visual Proof */}
          {(beforePhoto || afterPhoto) && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>مستندات تصویری مقایسه‌ای اجرای کار (Before & After):</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[#E8E4DC] rounded-xl overflow-hidden bg-white">
                  <div className="bg-amber-600 text-white text-xs font-bold py-1 px-3 text-center">
                    تصویر وضعیت پنجره و کناف قبل از نصب (Before)
                  </div>
                  <div className="h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {beforePhoto ? (
                      <CloudImage src={beforePhoto} alt="قبل از نصب" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">عکس قبل ضمیمه نشده است</span>
                    )}
                  </div>
                </div>

                <div className="border border-[#E8E4DC] rounded-xl overflow-hidden bg-white">
                  <div className="bg-emerald-700 text-white text-xs font-bold py-1 px-3 text-center">
                    تصویر پرده و شید تکمیل‌شده نهایی (After)
                  </div>
                  <div className="h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
                    {afterPhoto ? (
                      <CloudImage src={afterPhoto} alt="بعد از نصب" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">عکس بعد ضمیمه نشده است</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* White-Glove 4 Standards & Time Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Checklist */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E8E4DC] space-y-2 text-xs">
              <div className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-100 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                <span>بررسی استانداردهای تحویل لوکس طلایی:</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span>• استفاده از پارچه و کاور محافظ کف:</span>
                  <span className="font-bold text-emerald-600">{checklist?.floorProtectiveClothUsed !== false ? '✓ تایید' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>• جمع‌آوری و تحویل پایه‌های کریدل شید:</span>
                  <span className="font-bold text-emerald-600">{checklist?.cradleBracketsSecured !== false ? '✓ تایید' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>• تست حرکت روان موتور، ریل و ریموت کنترل:</span>
                  <span className="font-bold text-emerald-600">{checklist?.remoteTested !== false ? '✓ تایید' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>• تراز و شاقول بودن قاب و پایه‌ها:</span>
                  <span className="font-bold text-emerald-600">{checklist?.leveled !== false ? '✓ تایید' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>• اتوکشی، رفع چروک و فرم‌دهی پلیسه‌ها:</span>
                  <span className="font-bold text-emerald-600">{checklist?.ironedPleated !== false ? '✓ تایید' : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span>• نظافت کامل محیط و جمع‌آوری ضایعات:</span>
                  <span className="font-bold text-emerald-600">{checklist?.cleaned !== false ? '✓ تایید' : '—'}</span>
                </div>
              </div>
            </div>

            {/* Time on site & Statement */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E8E4DC] space-y-2 text-xs flex flex-col justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs pb-1 border-b border-slate-100 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-[#C5A059]" />
                  <span>زمان و راندمان اجرای کار در محل:</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>{project.reworkStartedAt ? 'زمان شروع بازکاری:' : 'زمان شروع نصب:'}</span>
                    <span className="font-mono font-bold">{formatTimeOnly(project.reworkStartedAt || project.startedAt) || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>زمان اتمام و تحویل:</span>
                    <span className="font-mono font-bold">{formatTimeOnly(project.completedAt) || '—'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-[#A88738]">
                    <span>مدت زمان صرف‌شده:</span>
                    <span>
                      {project.workSessions && project.workSessions.length > 0
                        ? calculateWorkSessionsSummary(project.workSessions, project.reworkStartedAt || project.startedAt, project.completedAt)?.formattedText || '—'
                        : (formatDuration(project.reworkStartedAt || project.startedAt, project.completedAt) || '—')}
                    </span>
                  </div>
                </div>
              </div>

              {project.completionNotes && (
                <div className="text-xs text-slate-500 italic bg-[#FAF7F2] p-2 rounded-lg mt-2">
                  «{project.completionNotes}»
                </div>
              )}
            </div>
          </div>

          {/* Official Signatures & Approval Stamps */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-[#E8E4DC]">
            {/* Customer Digital Signature Box */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-4 text-center space-y-2">
              <div className="text-xs font-bold text-slate-700">
                {project.representativeRole || project.representativeName
                  ? `تایید و امضای نماینده کارفرما (${project.representativeRole || 'نماینده'} - ${project.representativeName || ''}):`
                  : 'تایید و امضای دیجیتال کارفرما / تحویل‌گیرنده:'}
              </div>
              <p className="text-xs text-slate-400">
                {project.customerAcceptance?.status === 'UNAVAILABLE' || project.handoverSigneeType === 'UNAVAILABLE_EXEMPT'
                  ? 'عدم حضور کارفرما سر کارگاه با ذکر مستندات ثبت گردیده است.'
                  : 'اینجانب سلامت کامل اقلام و عملکرد بی‌نقص سیستم‌های نصب‌شده را تایید می‌نمایم.'}
              </p>
              <div className="h-20 bg-[#FCFAF7] rounded-xl border border-dashed border-[#C5A059]/40 flex items-center justify-center p-1">
                {project.customerSignature ? (
                  <CloudImage src={project.customerSignature} alt="امضای کارفرما" className="max-h-full max-w-full object-contain" />
                ) : project.customerAcceptance?.status === 'UNAVAILABLE' || project.handoverSigneeType === 'UNAVAILABLE_EXEMPT' ? (
                  <div className="text-xs text-amber-700 font-bold p-1">
                    عدم حضور کارفرما / تحویل‌گیرنده
                    {project.unavailabilityReason && (
                      <span className="block text-[11px] font-normal text-slate-500 mt-0.5 truncate max-w-xs">
                        علت: {project.unavailabilityReason}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">امضای فیزیکی در محل</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      project.customerSatisfaction && s <= project.customerSatisfaction
                        ? 'text-[#C5A059] fill-[#C5A059]'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
                <span className="text-xs font-bold text-slate-600 mr-1">
                  رضایت:{' '}
                  {project.customerSatisfaction
                    ? `${toPersianDigits(project.customerSatisfaction)} از 5`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Official QC Seal Box */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-4 text-center space-y-2 relative overflow-hidden">
              <div className="text-xs font-bold text-[#212121]">مهر و تاییدیه رسمی واحد کنترل کیفیت (QC):</div>
              <p className="text-xs text-slate-400">
                مطابق استانداردهای فنی و ایمنی گالری طلایی تایید گردید.
              </p>

              <div className="h-20 flex items-center justify-center">
                {project.qcStatus === 'APPROVED' ? (
                  <div className="border-2 border-[#194840] rounded-xl px-4 py-2 bg-[#194840]/5 rotate-[-2deg]">
                    <div className="text-xs font-black text-[#194840] tracking-wider">TALAEI QC APPROVED</div>
                    <div className="text-xs text-emerald-700 font-bold mt-0.5">
                      امتیاز کیفی: {project.qcScore ? `${toPersianDigits(project.qcScore)} از 5 ستاره` : '—'}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-slate-300 rounded-xl px-4 py-2 bg-slate-100 rotate-[-2deg]">
                    <div className="text-xs font-black text-slate-500 tracking-wider">در انتظار بررسی QC</div>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500">
                {project.qcStatus === 'APPROVED' ? (
                  <>مسئول کنترل کیفیت: {project.qcReviewedBy ? getDisplayName(project.qcReviewedBy) : '—'} ({formatJalali(project.qcReviewedAt)})</>
                ) : (
                  <>مسئول کنترل کیفیت: —</>
                )}
              </div>
            </div>
          </div>

          {/* Footer watermark & contact */}
          <div className="text-center text-xs text-slate-400 pt-3 border-t border-slate-100">
            گالری طلایی | نشانی وب‌سایت: talaei.ir | پشتیبانی فنی و خدمات پس از فروش: 021-88888888
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
