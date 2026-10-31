import React from 'react';
import { Project, User } from '../types';
import {
  Printer,
  X,
  ShieldCheck,
  Star,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { toPersianDigits, formatDuration, formatTimeOnly } from '../utils/jalali';
import { CloudImage } from './common/CloudImage';

interface Props {
  project: Project;
  users: User[];
  onClose: () => void;
}

export const HandoverCertificateModal: React.FC<Props> = ({ project, users, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const leadTech = users.find((u) => u.id === project.leadTechnicianId)?.name || 'تکنسین گالری طلایی';
  const beforePhoto = project.beforePhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));
  const afterPhoto =
    project.afterPhotos?.find((ph) => Boolean(ph && ph.trim() !== '')) ||
    project.completionPhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));
  const checklist = project.handoverChecklist;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl my-6 border border-[#E8E4DC] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Action Bar (Screen Only - Hidden in Print) */}
        <div className="no-print bg-[#212121] px-6 py-4 text-white flex items-center justify-between border-b-2 border-[#C1A056]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-[#C1A056] border border-[#C1A056]/30 flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h3 id="cert-title" className="font-black text-base sm:text-lg text-white">
                شناسنامه رسمی تحویل و تاییدیه کیفی
              </h3>
              <p className="text-xs text-[#C1A056]">{project.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C1A056] hover:bg-[#a88738] text-[#212121] rounded-xl text-xs font-black transition shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Certificate Body */}
        <div className="printable-certificate p-6 sm:p-10 space-y-6 text-[#212121] bg-[#FCFAF7]">
          {/* Certificate Header with Talaei Logo */}
          <div className="flex items-center justify-between border-b-2 border-[#C1A056] pb-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#212121] border-2 border-[#C1A056] flex items-center justify-center p-2 shadow-sm">
                <img
                  src="./talaei-lion-gold.png"
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
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                  مرکز تخصصی طراحی، دوخت و تجهیز پرده‌های لوکس و سیستم‌های موتوری هوشمند (talaei.ir)
                </p>
              </div>
            </div>

            <div className="text-left font-mono space-y-1">
              <div className="text-xs font-bold text-slate-500">شماره سفارش:</div>
              <div className="text-sm font-black text-[#212121] bg-white border border-[#E8E4DC] px-2.5 py-1 rounded-lg">
                {project.code}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                تاریخ: {toPersianDigits(project.scheduledDate)}
              </div>
            </div>
          </div>

          {/* Project & Client Information Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-[#E8E4DC] text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">کارفرما / سفارش‌دهنده:</span>
              <span className="font-bold text-[#212121] mt-0.5 block">{project.customerName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">شماره تماس:</span>
              <span className="font-mono font-bold text-slate-700 mt-0.5 block" dir="ltr">
                {toPersianDigits(project.customerPhone)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">سرپرست اکیپ نصب:</span>
              <span className="font-bold text-[#212121] mt-0.5 block">{leadTech}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">وضعیت کنترل کیفی:</span>
              <span className="font-black text-emerald-700 mt-0.5 block">
                {project.qcStatus === 'APPROVED' ? '✓ تایید نهایی QC' : 'در انتظار تایید نهایی'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-100 flex items-start gap-1.5 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-[#C1A056] shrink-0 mt-0.5" />
              <span className="text-[11px] leading-relaxed">نشانی محل نصب: {project.address}</span>
            </div>
          </div>

          {/* Technical Specifications Table */}
          <div className="overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white">
            <div className="bg-[#212121] px-4 py-2.5 text-white flex items-center justify-between text-xs font-bold">
              <span>مشخصات فنی و مقادیر تحویل‌شده پروژه:</span>
              <span className="text-[#C1A056] font-mono">{project.title}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 text-center text-xs p-2">
              <div className="p-2.5">
                <span className="text-slate-400 block text-[10px]">شیدهای هوشمند:</span>
                <span className="font-black text-base text-[#212121] font-mono mt-1 block">
                  {toPersianDigits(project.shadePanels)} لت
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-slate-400 block text-[10px]">پرده و حریر دکوراتیو:</span>
                <span className="font-black text-base text-[#C1A056] font-mono mt-1 block">
                  {toPersianDigits(project.curtainPanels)} لت
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-slate-400 block text-[10px]">متراژ تقریبی:</span>
                <span className="font-black text-sm text-slate-700 font-mono mt-1 block">
                  {toPersianDigits(project.approximateArea || '—')} مترمربع
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-slate-400 block text-[10px]">مکانیزم / سیستم حرکتی:</span>
                <span className="font-bold text-xs text-slate-800 mt-1 block truncate">
                  {project.mechanismType || 'استاندارد گالری طلایی'}
                </span>
              </div>
            </div>
          </div>

          {/* Before & After Visual Proof */}
          {(beforePhoto || afterPhoto) && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C1A056]" />
                <span>مستندات تصویری مقایسه‌ای اجرای کار (Before & After):</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[#E8E4DC] rounded-xl overflow-hidden bg-white">
                  <div className="bg-amber-600 text-white text-[10px] font-bold py-1 px-3 text-center">
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
                  <div className="bg-emerald-700 text-white text-[10px] font-bold py-1 px-3 text-center">
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
              <div className="font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-[#C1A056]" />
                <span>بررسی استانداردهای تحویل لوکس طلایی:</span>
              </div>
              <div className="space-y-1.5 text-[11px]">
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
                <div className="font-bold text-slate-800 text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-[#C1A056]" />
                  <span>زمان و راندمان اجرای کار در محل:</span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-700">
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
                    <span>{formatDuration(project.reworkStartedAt || project.startedAt, project.completedAt) || '—'}</span>
                  </div>
                </div>
              </div>

              {project.completionNotes && (
                <div className="text-[10px] text-slate-500 italic bg-[#FAF7F2] p-2 rounded-lg mt-2">
                  «{project.completionNotes}»
                </div>
              )}
            </div>
          </div>

          {/* Official Signatures & Approval Stamps */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-[#E8E4DC]">
            {/* Customer Digital Signature Box */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-4 text-center space-y-2">
              <div className="text-xs font-bold text-slate-700">تایید و امضای دیجیتال کارفرما / تحویل‌گیرنده:</div>
              <p className="text-[9px] text-slate-400">
                اینجانب سلامت کامل اقلام و عملکرد بی‌نقص سیستم‌های نصب‌شده را تایید می‌نمایم.
              </p>
              <div className="h-20 bg-[#FCFAF7] rounded-xl border border-dashed border-[#C1A056]/40 flex items-center justify-center p-1">
                {project.customerSignature ? (
                  <CloudImage src={project.customerSignature} alt="امضای کارفرما" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[11px] text-slate-400 italic">امضای فیزیکی در محل</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= (project.customerSatisfaction || 5)
                        ? 'text-[#C1A056] fill-[#C1A056]'
                        : 'text-slate-200'
                    }`}
                  />
                ))}
                <span className="text-[10px] font-bold text-slate-600 mr-1">
                  رضایت: {toPersianDigits(project.customerSatisfaction || 5)} از 5
                </span>
              </div>
            </div>

            {/* Official QC Seal Box */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-4 text-center space-y-2 relative overflow-hidden">
              <div className="text-xs font-bold text-[#212121]">مهر و تاییدیه رسمی واحد کنترل کیفیت (QC):</div>
              <p className="text-[9px] text-slate-400">
                مطابق استانداردهای فنی و ایمنی گالری طلایی تایید گردید.
              </p>

              <div className="h-20 flex items-center justify-center">
                <div className="border-2 border-[#194840] rounded-xl px-4 py-2 bg-[#194840]/5 rotate-[-2deg]">
                  <div className="text-xs font-black text-[#194840] tracking-wider">TALAEI QC APPROVED</div>
                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                    امتیاز کیفی: {toPersianDigits(project.qcScore || 5)} از 5 ستاره
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                مسئول کنترل کیفیت: {project.qcReviewedBy || 'مسئول QC'} ({toPersianDigits(project.qcReviewedAt || project.scheduledDate)})
              </div>
            </div>
          </div>

          {/* Footer watermark & contact */}
          <div className="text-center text-[10px] text-slate-400 pt-3 border-t border-slate-100">
            گالری طلایی | نشانی وب‌سایت: talaei.ir | پشتیبانی فنی و خدمات پس از فروش: 021-88888888
          </div>
        </div>
      </div>
    </div>
  );
};
