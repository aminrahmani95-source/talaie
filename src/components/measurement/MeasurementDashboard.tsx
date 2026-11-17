import React, { useState } from 'react';
import { Project, User } from '../../types';
import {
  Ruler,
  CheckCircle2,
  Phone,
  Navigation,
  FileText,
  Camera,
  Upload,
  AlertTriangle,
  Loader2,
  Clock,
  Sparkles,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { toPersianDigits, getTodayPersianString } from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';

interface Props {
  currentUser: User;
  projects: Project[];
  onSaveMeasurement: (
    projectId: string,
    details: {
      verifiedDimensions: string;
      siteReadinessNotes?: string;
      photos?: string[];
      isReadinessApproved: boolean;
    }
  ) => Promise<void>;
  onViewProposal?: (project: Project) => void;
}

export const MeasurementDashboard: React.FC<Props> = ({
  currentUser,
  projects,
  onSaveMeasurement,
  onViewProposal,
}) => {
  const [viewTab, setViewTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [verifiedDimensions, setVerifiedDimensions] = useState('');
  const [siteReadinessNotes, setSiteReadinessNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isDrywallOk, setIsDrywallOk] = useState(true);
  const [isElectricalOk, setIsElectricalOk] = useState(true);
  const [isAccessOk, setIsAccessOk] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pending visits: either MEASUREMENT_PENDING or not yet verified (strictly active, excluding completed/cancelled)
  const pendingVisits = projects.filter(
    (p) =>
      p.status !== 'COMPLETED' &&
      p.status !== 'CANCELLED' &&
      (p.status === 'MEASUREMENT_PENDING' ||
        (p.status === 'DRAFT' && !p.secondMeasurementDetails?.isReadinessApproved))
  );

  const completedVisits = projects.filter(
    (p) => Boolean(p.secondMeasurementDetails?.isReadinessApproved)
  );

  const handleOpenForm = (proj: Project) => {
    setSelectedProjectId(proj.id);
    setVerifiedDimensions(proj.secondMeasurementDetails?.verifiedDimensions || '');
    setSiteReadinessNotes(proj.secondMeasurementDetails?.siteReadinessNotes || '');
    setPhotos(proj.secondMeasurementDetails?.photos || []);
    setError('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError('');

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFile(files[i], {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        });
        newUrls.push(compressed);
      }
      setPhotos((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری عکس‌ها.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (projectId: string) => {
    if (!verifiedDimensions.trim()) {
      setError('ثبت ابعاد قطعی اندازه‌گیری دوم الزامی است.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const isApproved = isDrywallOk && isElectricalOk && isAccessOk;
      await onSaveMeasurement(projectId, {
        verifiedDimensions: verifiedDimensions.trim(),
        siteReadinessNotes: `${siteReadinessNotes.trim()}\n[سقف و کناف: ${isDrywallOk ? 'تایید' : 'دارای نقص'} | برق 220 ولت: ${isElectricalOk ? 'تایید' : 'دارای نقص'} | دسترسی فضا: ${isAccessOk ? 'تایید' : 'دارای نقص'}]`,
        photos,
        isReadinessApproved: isApproved,
      });

      setSelectedProjectId(null);
    } catch (err: any) {
      setError(err.message || 'خطا در ثبت اندازه‌گیری.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#151B23] rounded-2xl p-5 border border-[#212835] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#F0F4F8] flex items-center gap-2">
            <span>میز کار اندازه‌گیری دوم و تایید بستر فضا</span>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 px-2.5 py-0.5 rounded-full">
              مسئول فنی متراژ
            </span>
          </h2>
          <p className="text-xs text-[#9BA7B6] mt-1">
            برنامه روزانه بازدید درگاه‌ها، تطبیق دقیق ابعاد با برگه سفارش و تایید کناف و سیم‌کشی برق
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0D1117] p-1.5 rounded-xl border border-[#212835] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewTab('PENDING')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              viewTab === 'PENDING'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md shadow-[#C5A059]/20'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>در انتظار متراژ ({toPersianDigits(pendingVisits.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('COMPLETED')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              viewTab === 'COMPLETED'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md shadow-[#C5A059]/20'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>سوابق و تاییدشده ({toPersianDigits(completedVisits.length)})</span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-[#F0F4F8] flex items-center gap-2 px-1">
          {viewTab === 'PENDING' ? (
            <>
              <Clock className="w-4 h-4 text-[#C5A059]" />
              <span>پروژه‌های نیازمند اندازه‌گیری و تایید بستر ({toPersianDigits(pendingVisits.length)})</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>پروژه‌های اندازه‌گیری‌شده و دارای تاییدیه بستر ({toPersianDigits(completedVisits.length)})</span>
            </>
          )}
        </h3>

        {(viewTab === 'PENDING' ? pendingVisits : completedVisits).length === 0 ? (
          <div className="bg-[#151B23] rounded-2xl p-8 text-center border border-[#212835] text-xs text-[#9BA7B6]">
            {viewTab === 'PENDING'
              ? 'تمامی پروژه‌ها اندازه‌گیری و تایید شده‌اند. موردی در صف انتظار نیست.'
              : 'هنوز سابقه‌ای از متراژهای تاییدشده ثبت نشده است.'}
          </div>
        ) : (
          <div className="space-y-3">
            {(viewTab === 'PENDING' ? pendingVisits : completedVisits).map((proj) => {
              const isSelected = selectedProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  className={`bg-[#151B23] rounded-2xl p-5 border transition space-y-4 ${
                    isSelected ? 'border-[#C5A059] ring-1 ring-[#C5A059]/30' : 'border-[#212835]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2 py-0.5 rounded">
                          {proj.code}
                        </span>
                        {proj.isForceMajeure && (
                          <span className="text-[11px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/30">
                            فورس‌ماژور 🔥
                          </span>
                        )}
                        <h4 className="text-sm font-black text-[#F0F4F8]">{proj.title}</h4>
                      </div>
                      <p className="text-xs text-[#9BA7B6] mt-1 flex items-center gap-1.5">
                        <span className="font-bold text-[#F0F4F8]">{proj.customerName}</span>
                        <span>•</span>
                        <MapPin className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>{proj.address}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {proj.customerPhone && (
                        <a
                          href={`tel:${proj.customerPhone}`}
                          className="p-2 rounded-xl bg-[#1C232D] text-[#C5A059] hover:bg-[#252F3D] border border-[#212835]"
                          title="تماس"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      <a
                        href={proj.locationUrl || `https://nshn.ir/search/${encodeURIComponent(proj.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-[#1C232D] text-[#C5A059] hover:bg-[#252F3D] border border-[#212835]"
                        title="مسیریابی"
                      >
                        <Navigation className="w-4 h-4" />
                      </a>
                      {onViewProposal && proj.proposalImages?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onViewProposal(proj)}
                          className="px-3 py-1.5 rounded-xl bg-[#1C232D] text-xs font-bold text-[#C5A059] hover:bg-[#252F3D] border border-[#212835] flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>پروپوزال فروش</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Verified Details preview if already completed */}
                  {!isSelected && proj.secondMeasurementDetails?.isReadinessApproved && (
                    <div className="bg-[#0D1117] p-3 rounded-xl border border-emerald-500/30 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ابعاد و بستر کارگاه تایید شده است</span>
                        </span>
                      </div>
                      <p className="text-[#F0F4F8] font-mono text-[11px] whitespace-pre-line leading-relaxed">
                        {proj.secondMeasurementDetails.verifiedDimensions}
                      </p>
                      {proj.secondMeasurementDetails.siteReadinessNotes && (
                        <p className="text-[#9BA7B6] text-[11px]">
                          {proj.secondMeasurementDetails.siteReadinessNotes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Toggle Form Button */}
                  {!isSelected ? (
                    <button
                      type="button"
                      onClick={() => handleOpenForm(proj)}
                      className="w-full py-2.5 px-4 bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Ruler className="w-4 h-4" />
                      <span>
                        {proj.secondMeasurementDetails?.isReadinessApproved
                          ? 'ویرایش یا بازنگری متراژ و تایید بستر'
                          : 'ثبت متراژ نهایی و تایید بستر فضا'}
                      </span>
                    </button>
                  ) : (
                    /* Active Inspection Form */
                    <div className="p-4 bg-[#0D1117] rounded-xl border border-[#212835] space-y-4 animate-in fade-in">
                      {/* Dimensions Input */}
                      <div>
                        <label className="block text-xs font-bold text-[#F0F4F8] mb-1.5">
                          ابعاد دقیق و قطعی اندازه‌گیری دوم (عرض × ارتفاع به تفکیک پنجره‌ها): *
                        </label>
                        <textarea
                          rows={3}
                          value={verifiedDimensions}
                          onChange={(e) => setVerifiedDimensions(e.target.value)}
                          placeholder="مثال:&#10;پنجره سالن 1: عرض 2.45 متر در ارتفاع 2.80 متر (شید برقی)&#10;پنجره خواب مستر: عرض 1.80 متر در ارتفاع 2.60 متر"
                          className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#111620] text-[#F0F4F8] focus:border-[#C5A059] outline-none leading-relaxed"
                          required
                        />
                      </div>

                      {/* Site Readiness Checks */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-[#9BA7B6]">
                          بررسی چک‌لیست بستر کارگاه:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                            isDrywallOk ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-[#151B23] border-[#212835] text-[#9BA7B6]'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isDrywallOk}
                              onChange={(e) => setIsDrywallOk(e.target.checked)}
                              className="hidden"
                            />
                            <span>{isDrywallOk ? '✓' : '✗'} استحکام کناف / سقف</span>
                          </label>

                          <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                            isElectricalOk ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-[#151B23] border-[#212835] text-[#9BA7B6]'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isElectricalOk}
                              onChange={(e) => setIsElectricalOk(e.target.checked)}
                              className="hidden"
                            />
                            <span>{isElectricalOk ? '✓' : '✗'} سیم‌کشی برق 220 ولت</span>
                          </label>

                          <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                            isAccessOk ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-[#151B23] border-[#212835] text-[#9BA7B6]'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isAccessOk}
                              onChange={(e) => setIsAccessOk(e.target.checked)}
                              className="hidden"
                            />
                            <span>{isAccessOk ? '✓' : '✗'} تخلیه و دسترسی فضا</span>
                          </label>
                        </div>
                      </div>

                      {/* Photos */}
                      <div>
                        <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                          عکس‌های اندازه‌گیری پنجره‌ها و کناف:
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="px-3 py-2 bg-[#1C232D] hover:bg-[#252F3D] text-[#C5A059] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-[#C5A059]/30">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              capture="environment"
                              onChange={handlePhotoUpload}
                              disabled={isUploading}
                              className="hidden"
                            />
                            <Camera className="w-4 h-4" />
                            <span>{isUploading ? 'در حال بهینه‌سازی...' : '+ افزودن عکس کارگاه'}</span>
                          </label>
                          <span className="text-[11px] text-[#637184]">
                            {photos.length > 0 ? `${toPersianDigits(photos.length)} عکس پیوست شد` : 'اختیاری اما مستند'}
                          </span>
                        </div>

                        {photos.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
                            {photos.map((p, i) => (
                              <div key={i} className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#212835]">
                                <CloudImage
                                  src={p}
                                  alt="عکس کارگاه"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                          یادداشت فنی کارگاه (اختیاری):
                        </label>
                        <input
                          type="text"
                          value={siteReadinessNotes}
                          onChange={(e) => setSiteReadinessNotes(e.target.value)}
                          placeholder="نکات خاص بستر، نیاز به پایه دوبل، فاصله قرنیز..."
                          className="w-full text-xs p-2.5 rounded-xl border border-[#212835] bg-[#111620] text-[#F0F4F8] outline-none"
                        />
                      </div>

                      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}

                      {/* Form Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#212835]">
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(null)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6] hover:bg-[#252F3D] cursor-pointer transition"
                        >
                          انصراف
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting || isUploading}
                          onClick={() => handleSubmit(proj.id)}
                          className="px-5 py-2 rounded-xl text-xs font-black bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>تایید نهایی متراژ و ارجاع به تقویم نصب ✅</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
