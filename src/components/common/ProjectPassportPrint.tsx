import React from 'react';
import { Project, User } from '../../types';
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
  Flame,
  Wrench,
  Camera,
  Layers,
} from 'lucide-react';
import { toPersianDigits, getTodayPersianString } from '../../utils/jalali';
import { getDisplayName } from '../../utils/technicianName';

interface Props {
  project: Project;
  users?: User[];
  onClose: () => void;
}

export const ProjectPassportPrint: React.FC<Props> = ({ project, users = [], onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const leadName = users.find((u) => u.id === project.leadTechnicianId)?.name;
  const leadTech = leadName ? getDisplayName(leadName) : project.assignedTeamName || 'اکیپ رسمی طلائیه';

  const beforePhoto = project.beforePhotos?.[0];
  const afterPhoto = project.afterPhotos?.[0] || project.completionPhotos?.[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="passport-print-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="passport-print-container bg-[#151B23] rounded-2xl max-w-4xl w-full shadow-2xl border border-[#212835] overflow-hidden my-6">
        {/* On-Screen Action Bar (Hidden in Print) */}
        <div className="no-print bg-[#0D1117] px-6 py-4 border-b border-[#212835] flex items-center justify-between text-[#F0F4F8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-[#F0F4F8]">
                شناسنامه رسمی و پرونده ۳۶۰ درجه پروژه
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
              <span>چاپ استاندارد A4 / خروجی PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#9BA7B6] hover:text-white hover:bg-[#1C232D] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= Printable Document (A4 Styled) ================= */}
        <div className="passport-a4-sheet p-8 bg-white text-black font-sans space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-stone-800 pb-4">
            <div className="flex items-center gap-3">
              <img
                src="./talaei-lion-gold.png"
                alt="گالری طلایی"
                className="w-14 h-14 object-contain"
              />
              <div>
                <h1 className="text-xl font-black text-stone-900 tracking-tight">
                  گالری پرده و شید طلائیه
                </h1>
                <p className="text-xs font-bold text-stone-600 mt-0.5">
                  شناسنامه رسمی عملیات، تحویل کارفرما و تاییدیه کنترل کیفیت (QC)
                </p>
              </div>
            </div>

            <div className="text-left font-mono text-xs space-y-1">
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
          <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-lg border border-stone-200 text-xs leading-relaxed">
            <div>
              <span className="font-bold text-stone-500 block mb-1">مشخصات کارفرما و پروژه:</span>
              <p className="text-sm font-black text-stone-900">{project.customerName}</p>
              <p className="text-stone-700 font-mono mt-0.5">تلفن: {project.customerPhone || 'ثبت‌نشده'}</p>
              <p className="text-stone-700 mt-0.5">پروژه: {project.title}</p>
            </div>
            <div>
              <span className="font-bold text-stone-500 block mb-1">نشانی محل پروژه:</span>
              <p className="text-stone-800 font-medium">{project.address}</p>
              {project.salesRepName && (
                <p className="text-stone-600 mt-1">کارشناس ثبت فروش: <strong>{project.salesRepName}</strong></p>
              )}
            </div>
          </div>

          {/* Section 2: Technical Specifications */}
          <div className="border border-stone-300 rounded-lg overflow-hidden text-xs">
            <div className="bg-stone-100 p-2.5 font-black text-stone-800 border-b border-stone-300">
              مشخصات فنی و مقادیر سفارش
            </div>
            <div className="grid grid-cols-4 p-3 gap-3 text-center divide-x divide-x-reverse divide-stone-200">
              <div>
                <span className="text-stone-500 block text-[11px]">تعداد لت شید</span>
                <span className="font-black text-sm text-stone-900">{toPersianDigits(project.shadePanels || 0)} لت</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">تعداد لت پرده</span>
                <span className="font-black text-sm text-stone-900">{toPersianDigits(project.curtainPanels || 0)} لت</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">مکانیزم و نوع موتور</span>
                <span className="font-bold text-stone-900 text-xs">{project.mechanismType || 'استاندارد'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">اکیپ مجری نصب</span>
                <span className="font-bold text-stone-900 text-xs">{leadTech}</span>
              </div>
            </div>
            {project.specialTools && project.specialTools.length > 0 && (
              <div className="bg-stone-50 p-2 border-t border-stone-200 text-[11px] text-stone-700">
                <strong>تجهیزات و ابزار ویژه تحویلی: </strong>
                {project.specialTools.join('، ')}
              </div>
            )}
          </div>

          {/* Section 3: Before & After Photos */}
          <div>
            <div className="font-black text-xs text-stone-800 mb-2">مستندات تصویری کارگاه (قبل و بعد از نصب):</div>
            <div className="grid grid-cols-2 gap-4">
              {/* Before Photo */}
              <div className="border border-stone-300 rounded-lg p-2 bg-stone-50 text-center space-y-1">
                <span className="text-[11px] font-bold text-stone-600 block">تصویر وضعیت فضا پیش از نصب</span>
                <div className="aspect-video w-full rounded overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
                  {beforePhoto ? (
                    <img src={beforePhoto} alt="قبل نصب" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] text-stone-500">تصویر ثبت نشده</span>
                  )}
                </div>
              </div>

              {/* After Photo */}
              <div className="border border-stone-300 rounded-lg p-2 bg-stone-50 text-center space-y-1">
                <span className="text-[11px] font-bold text-stone-600 block">تصویر کار تکمیل‌شده نهایی</span>
                <div className="aspect-video w-full rounded overflow-hidden bg-stone-200 border border-stone-300 flex items-center justify-center">
                  {afterPhoto ? (
                    <img src={afterPhoto} alt="بعد نصب" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] text-stone-500">تصویر ثبت نشده</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Customer Signature & Disclaimer */}
          <div className="border border-stone-300 rounded-lg p-4 bg-stone-50 space-y-2">
            <span className="text-xs font-black text-stone-800 block">تاییدیه رسمی و امضای تحویل کارفرما:</span>
            <p className="text-[11px] text-stone-700 leading-relaxed bg-white p-2.5 rounded border border-stone-200 italic">
              «اینجانب کارفرما، صحت عملکرد و سلامت کامل پرده‌ها و شیدها، کالیبراسیون مکانیزم‌ها، و همچنین نظافت و عدم وجود هرگونه خسارت به محیط کارگاه/ساختمان را تحویل گرفته و تایید می‌نمایم.»
            </p>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs space-y-0.5">
                <p>تحویل‌گیرنده: <strong>{project.representativeName || project.customerName}</strong></p>
                {project.representativeRole && <p className="text-stone-600">سمت: {project.representativeRole}</p>}
                <p className="text-stone-500 text-[10px]">تاریخ امضا: {toPersianDigits(project.completedAt?.slice(0, 10) || project.scheduledDate)}</p>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-stone-500 block mb-1">امضای دیجیتال کارفرما:</span>
                {project.customerSignature ? (
                  <img
                    src={project.customerSignature}
                    alt="امضای کارفرما"
                    className="h-16 w-32 object-contain border border-stone-300 rounded bg-white"
                  />
                ) : (
                  <div className="h-14 w-28 border border-dashed border-stone-400 rounded flex items-center justify-center text-[10px] text-stone-400">
                    امضا در سیستم موجود نیست
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: QC Audit & Stamp */}
          <div className="flex items-center justify-between border-t-2 border-stone-800 pt-4 text-xs">
            <div>
              <span className="font-bold text-stone-600 block">ارزیابی کنترل کیفیت (QC):</span>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      (project.qcScore || 5) >= s
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-stone-300'
                    }`}
                  />
                ))}
                <span className="font-black text-stone-900 mr-2">
                  {toPersianDigits(project.qcScore || 5)} از ۵ ستاره
                </span>
              </div>
              {project.qcNotes && (
                <p className="text-[11px] text-stone-700 mt-1">نظر کارشناسی QC: {project.qcNotes}</p>
              )}
            </div>

            <div className="text-center border-2 border-emerald-700 rounded-lg p-2.5 bg-emerald-50 text-emerald-900">
              <span className="text-[10px] font-bold block">مهر تاییدیه رسمی</span>
              <span className="text-sm font-black">QC APPROVED ✅</span>
              <span className="text-[9px] block text-stone-600 font-mono mt-0.5">TALAEI QUALITY CERTIFIED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
