import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project, User } from '../../types';
import {
  Printer,
  X,
  Star,
  FileCheck2,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString, formatJalali } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';
import { CloudImage } from './CloudImage';
import { LOGO_GOLD } from '../../assets/logo';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface Props {
  project: Project;
  users?: User[];
  onClose: () => void;
}

export const ProjectPassportPrint: React.FC<Props> = ({ project, users = [], onClose }) => {
  useEscapeKey(onClose);
  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    document.body.classList.add('printing-passport-open');
    return () => {
      document.body.classList.remove('printing-passport-open');
    };
  }, []);

  const leadName = users.find((u) => u.id === project.leadTechnicianId)?.name;
  const leadTech = leadName ? getDisplayName(leadName) : project.assignedTeamName || 'اکیپ رسمی گالری طلایی';

  const beforePhoto = project.beforePhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));
  const afterPhoto =
    project.afterPhotos?.find((ph) => Boolean(ph && ph.trim() !== '')) ||
    project.completionPhotos?.find((ph) => Boolean(ph && ph.trim() !== ''));

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      className="passport-print-overlay fixed inset-0 z-50 flex justify-center items-start bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="passport-print-container bg-[#151B23] rounded-2xl max-w-4xl w-full shadow-2xl border border-[#212835] overflow-hidden my-auto">
        {/* On-Screen Action Bar (Hidden in Print) */}
        <div className="no-print bg-[#0D1117] px-6 py-4 border-b border-[#212835] flex items-center justify-between text-[#F0F4F8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#F0F4F8]">
                شناسنامه رسمی و پرونده 360 درجه پروژه
              </h3>
              <p className="text-xs text-[#9BA7B6]">
                <span className="font-mono text-[#C5A059] font-bold">{project.code}</span> • {project.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] rounded-xl text-xs font-black flex items-center gap-2 transition shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ تک‌صفحه‌ای A4 / ذخیره PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#9BA7B6] hover:text-white hover:bg-[#1C232D] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= Printable Document (A4 Single-Page Styled) ================= */}
        <div className="passport-a4-sheet p-6 sm:p-7 bg-white text-black font-sans space-y-3.5 max-h-[82vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_GOLD}
                alt="گالری طلایی"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                  گالری طلایی
                </h1>
                <p className="text-[11px] font-bold text-stone-600 mt-0.5">
                  شناسنامه رسمی عملیات، تحویل کارفرما و تاییدیه کنترل کیفیت (QC)
                </p>
              </div>
            </div>

            <div className="text-left font-mono text-[11px] space-y-0.5">
              <div>
                <span className="text-stone-500 font-sans">شماره پرونده: </span>
                <span className="font-black text-stone-900">{project.code}</span>
              </div>
              <div>
                <span className="text-stone-500 font-sans">تاریخ صدور: </span>
                <span className="font-bold text-stone-900">{toPersianDigits(getTodayPersianString())}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Customer & Site Info */}
          <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs leading-relaxed">
            <div>
              <span className="font-bold text-stone-500 block mb-0.5 text-[10px]">مشخصات کارفرما و پروژه:</span>
              <p className="text-xs sm:text-sm font-black text-stone-900">{project.customerName}</p>
              <p className="text-stone-700 font-mono text-[11px] mt-0.5">تلفن: {project.customerPhone || 'ثبت‌نشده'}</p>
              <p className="text-stone-700 text-[11px] mt-0.5">پروژه: {project.title}</p>
            </div>
            <div>
              <span className="font-bold text-stone-500 block mb-0.5 text-[10px]">نشانی محل پروژه:</span>
              <p className="text-stone-800 font-medium text-xs leading-snug">{project.address}</p>
              {project.salesRepName && (
                <p className="text-stone-600 text-[11px] mt-1">کارشناس ثبت فروش: <strong>{project.salesRepName}</strong></p>
              )}
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="border border-stone-300 rounded-lg overflow-hidden text-xs">
            <div className="bg-stone-100 px-3 py-1.5 font-black text-stone-800 border-b border-stone-300 text-[11px]">
              مشخصات فنی و مقادیر سفارش
            </div>
            <div className={`grid ${(project.railCount || 0) > 0 ? 'grid-cols-5' : 'grid-cols-4'} p-2.5 gap-2 text-center divide-x divide-x-reverse divide-stone-200`}>
              <div>
                <span className="text-stone-500 block text-[10px]">تعداد لت شید</span>
                <span className="font-black text-xs sm:text-sm text-stone-900">{toPersianDigits(project.shadePanels || 0)} لت</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">تعداد لت پرده</span>
                <span className="font-black text-xs sm:text-sm text-stone-900">{toPersianDigits(project.curtainPanels || 0)} لت</span>
              </div>
              {(project.railCount || 0) > 0 && (
                <div>
                  <span className="text-stone-500 block text-[10px]">تعداد ریل</span>
                  <span className="font-black text-xs sm:text-sm text-stone-900">{toPersianDigits(project.railCount || 0)} عدد</span>
                </div>
              )}
              <div>
                <span className="text-stone-500 block text-[10px]">مکانیزم و نوع موتور</span>
                <span className="font-bold text-stone-900 text-[11px]">{project.mechanismType || 'استاندارد'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[10px]">اکیپ مجری نصب</span>
                <span className="font-bold text-stone-900 text-[11px]">{leadTech}</span>
              </div>
            </div>
            {project.specialTools && project.specialTools.length > 0 && (
              <div className="bg-stone-50 px-3 py-1 border-t border-stone-200 text-[10px] text-stone-700">
                <strong>تجهیزات و ابزار ویژه تحویلی: </strong>
                {project.specialTools.join('، ')}
              </div>
            )}
          </div>

          {/* Section 3: Before & After Photos */}
          <div>
            <div className="font-black text-[11px] text-stone-800 mb-1.5">مستندات تصویری کارگاه (قبل و بعد از نصب):</div>
            <div className="grid grid-cols-2 gap-3">
              {/* Before Photo */}
              <div className="border border-stone-300 rounded-lg p-2 bg-stone-50 text-center space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block">تصویر وضعیت فضا پیش از نصب</span>
                <div className="h-28 sm:h-32 w-full rounded overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
                  {beforePhoto ? (
                    <CloudImage src={beforePhoto} alt="قبل نصب" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-stone-500">تصویر ثبت نشده</span>
                  )}
                </div>
              </div>

              {/* After Photo */}
              <div className="border border-stone-300 rounded-lg p-2 bg-stone-50 text-center space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block">تصویر کار تکمیل‌شده نهایی</span>
                <div className="h-28 sm:h-32 w-full rounded overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
                  {afterPhoto ? (
                    <CloudImage src={afterPhoto} alt="بعد نصب" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-stone-500">تصویر ثبت نشده</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Customer Signature & Disclaimer */}
          <div className="border border-stone-300 rounded-lg p-3 bg-stone-50 space-y-1.5">
            <span className="text-[11px] font-black text-stone-800 block">تاییدیه رسمی و امضای تحویل کارفرما:</span>
            <p className="text-[10px] text-stone-700 leading-relaxed bg-white p-2 rounded border border-stone-200 italic">
              «اینجانب کارفرما، صحت عملکرد و سلامت کامل پرده‌ها و شیدها، کالیبراسیون مکانیزم‌ها، و همچنین نظافت و عدم وجود هرگونه خسارت به محیط کارگاه/ساختمان را تحویل گرفته و تایید می‌نمایم.»
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs space-y-0.5">
                <p className="text-xs">تحویل‌گیرنده: <strong>{project.representativeName || project.customerName}</strong></p>
                {project.representativeRole && <p className="text-stone-600 text-[10px]">سمت: {project.representativeRole}</p>}
                <p className="text-stone-500 text-[9px]">تاریخ امضا: {formatJalali(project.completedAt || project.scheduledDate)}</p>
              </div>

              <div className="text-center">
                <span className="text-[9px] text-stone-500 block mb-0.5">امضای دیجیتال کارفرما:</span>
                {project.customerSignature ? (
                  <div className="h-10 sm:h-12 w-28 border border-stone-300 rounded bg-white overflow-hidden p-0.5 flex items-center justify-center">
                    <CloudImage
                      src={project.customerSignature}
                      alt="امضای کارفرما"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-24 border border-dashed border-stone-400 rounded flex items-center justify-center text-[9px] text-stone-400">
                    امضا در سیستم موجود نیست
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: QC Audit & Stamp */}
          <div className="flex items-center justify-between border-t-2 border-stone-800 pt-3 text-xs">
            <div>
              <span className="font-bold text-stone-600 block text-[11px]">ارزیابی کنترل کیفیت (QC):</span>
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      (project.qcScore || 5) >= s
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-stone-300'
                    }`}
                  />
                ))}
                <span className="font-black text-stone-900 mr-1.5 text-xs">
                  {toPersianDigits(project.qcScore || 5)} از 5 ستاره
                </span>
              </div>
              {project.qcNotes && (
                <p className="text-[10px] text-stone-700 mt-0.5">نظر کارشناسی QC: {project.qcNotes}</p>
              )}
            </div>

            <div className="text-center border-2 border-emerald-700 rounded-lg py-1 px-3 bg-emerald-50 text-emerald-900">
              <span className="text-[9px] font-bold block">مهر تاییدیه رسمی</span>
              <span className="text-xs font-black">QC APPROVED ✅</span>
              <span className="text-[8px] block text-stone-600 font-mono">TALAEI QUALITY CERTIFIED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
