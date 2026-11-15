import React, { useState, useMemo } from 'react';
import { Project, ProposalImage, User } from '../../types';
import {
  PlusCircle,
  FolderKanban,
  Search,
  Flame,
  Calendar,
  Phone,
  MapPin,
  Camera,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ChevronLeft,
  X,
  Loader2,
  Sparkles,
  Eye,
} from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { getUpcomingDays, toPersianDigits, getTodayPersianString } from '../../utils/jalali';
import { CloudImage } from '../common/CloudImage';

const DEFAULT_SALES_REPS = [
  'خانم عباسی',
  'آقای محمدی',
  'خانم راد',
  'آقای کاظمی',
  'خانم شمس',
  'آقای احمدی',
  'خانم کریمی',
  'آقای نوری',
  'خانم بهرامی',
  'آقای صالحی',
  'خانم جعفری',
  'آقای حسینی',
];

interface Props {
  currentUser: User;
  projects: Project[];
  onSaveNewProject: (projectData: Partial<Project>) => Promise<void>;
  onViewProposal?: (project: Project) => void;
}

export const SalesPortal: React.FC<Props> = ({
  currentUser,
  projects,
  onSaveNewProject,
  onViewProposal,
}) => {
  const [activeTab, setActiveTab] = useState<'NEW_ORDER' | 'TRACKING'>('NEW_ORDER');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // New Order Form States
  const [salesRepName, setSalesRepName] = useState(DEFAULT_SALES_REPS[0]);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [requestedDate, setRequestedDate] = useState(() => getUpcomingDays(7)[1]?.dateKey || '');
  const [shadePanels, setShadePanels] = useState<number>(0);
  const [curtainPanels, setCurtainPanels] = useState<number>(0);
  const [mechanismType, setMechanismType] = useState('موتور برقی سامفی');
  const [specialNotes, setSpecialNotes] = useState('');
  const [isForceMajeure, setIsForceMajeure] = useState(false);
  const [proposalImages, setProposalImages] = useState<ProposalImage[]>([]);
  const [isUploadingProposal, setIsUploadingProposal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const upcomingDays = useMemo(() => getUpcomingDays(30), []);

  const handleProposalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingProposal(true);
    setFormError('');

    try {
      const newImages: ProposalImage[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressedBase64 = await compressImageFile(files[i], {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        });
        newImages.push({
          id: `prop-${Date.now()}-${i}`,
          title: files[i].name || `پروپوزال ${i + 1}`,
          url: compressedBase64,
          uploadedAt: new Date().toISOString(),
        });
      }
      setProposalImages((prev) => [...prev, ...newImages]);
    } catch (err: any) {
      setFormError(err.message || 'خطا در بارگذاری تصاویر پروپوزال.');
    } finally {
      setIsUploadingProposal(false);
      e.target.value = '';
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setLocationUrl('');
    setSpecialNotes('');
    setIsForceMajeure(false);
    setProposalImages([]);
    setShadePanels(0);
    setCurtainPanels(0);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!title.trim() || !customerName.trim() || !address.trim()) {
      setFormError('لطفاً عنوان پروژه، نام کارفرما و نشانی را وارد فرمایید.');
      return;
    }

    if (proposalImages.length === 0) {
      setFormError('بارگذاری حداقل یک تصویر از برگه سفارش یا پروپوزال فروش الزامی است.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCode = `PRJ-${Math.floor(100 + Math.random() * 900)}`;
      await onSaveNewProject({
        code: newCode,
        title: title.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        address: address.trim(),
        locationUrl: locationUrl.trim() || undefined,
        scheduledDate: requestedDate,
        scheduledTime: '10:00',
        shadePanels: Number(shadePanels) || 0,
        curtainPanels: Number(curtainPanels) || 0,
        mechanismType,
        specialNotes: specialNotes.trim() || undefined,
        isForceMajeure,
        salesRepName,
        proposalImages,
        status: 'MEASUREMENT_PENDING',
        qcStatus: 'NOT_STARTED',
        assignedTechnicianIds: [],
        toolsRequired: [],
        isFullTools: false,
        completionPhotos: [],
      });

      setSuccessMessage(`پروژه ${newCode} با موفقیت ثبت شد و در صف اندازه‌گیری دوم و تایید بستر قرار گرفت.`);
      handleResetForm();
      setActiveTab('TRACKING');
    } catch (err: any) {
      setFormError(err.message || 'خطا در ثبت سفارش فروش.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered projects for tracking tab
  const trackedProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedRepFilter !== 'ALL' && p.salesRepName !== selectedRepFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (p.title || '').toLowerCase().includes(q);
        const matchCustomer = (p.customerName || '').toLowerCase().includes(q);
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchAddress = (p.address || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCustomer && !matchCode && !matchAddress) return false;
      }
      return true;
    });
  }, [projects, selectedRepFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#151B23] rounded-2xl p-5 border border-[#212835] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-[#F0F4F8] flex items-center gap-2">
            <span>درگاه واحد فروش و سفارش‌گذاری طلائیه</span>
            <span className="text-xs font-bold bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 px-2.5 py-0.5 rounded-full">
              تیم فروشگاه
            </span>
          </h2>
          <p className="text-xs text-[#9BA7B6] mt-1">
            ثبت آنی سفارش‌های نیازمند نصب و پیگیری زنده وضعیت پیشرفت و رضایت مشتریان
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-[#0D1117] p-1.5 rounded-xl border border-[#212835] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('NEW_ORDER')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'NEW_ORDER'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md shadow-[#C5A059]/20'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>ثبت سفارش جدید</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRACKING')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
              activeTab === 'TRACKING'
                ? 'bg-[#C5A059] text-[#0D1117] shadow-md shadow-[#C5A059]/20'
                : 'text-[#9BA7B6] hover:text-[#F0F4F8]'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>پیگیری و ویترین پروژه‌ها ({toPersianDigits(projects.length)})</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===================== TAB 1: NEW ORDER INTAKE ===================== */}
      {activeTab === 'NEW_ORDER' && (
        <form onSubmit={handleSubmitOrder} className="bg-[#151B23] rounded-2xl p-6 border border-[#212835] space-y-6">
          <div className="flex items-center justify-between border-b border-[#212835] pb-4">
            <h3 className="text-sm sm:text-base font-black text-[#F0F4F8] flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#C5A059]" />
              <span>مشخصات سفارش جدید جهت ارجاع به دپارتمان فنی</span>
            </h3>

            {/* Force Majeure Toggle */}
            <label className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border cursor-pointer transition select-none ${
              isForceMajeure
                ? 'bg-rose-500/15 border-rose-500 text-rose-300 font-black animate-pulse'
                : 'bg-[#111620] border-[#2D3748] text-[#9BA7B6] hover:border-rose-500/40'
            }`}>
              <input
                type="checkbox"
                checked={isForceMajeure}
                onChange={(e) => setIsForceMajeure(e.target.checked)}
                className="hidden"
              />
              <Flame className={`w-4 h-4 ${isForceMajeure ? 'text-rose-400' : 'text-[#637184]'}`} />
              <span className="text-xs">سفارش اضطراری و فورس‌ماژور (🔥)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sales Rep Name */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                نام کارشناس فروش ثبت‌کننده: *
              </label>
              <select
                value={salesRepName}
                onChange={(e) => setSalesRepName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-bold focus:border-[#C5A059] outline-none"
              >
                {DEFAULT_SALES_REPS.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            </div>

            {/* Project Title */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                عنوان پروژه / نام پروژه: *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: آپارتمان الهیه - مهندس رادمنش"
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none"
                required
              />
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                نام کارفرما / خریدار: *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: آقای دکتر رادمنش"
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none"
                required
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                شماره تماس هماهنگی:
              </label>
              <input
                type="tel"
                dir="ltr"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0912..."
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none font-mono"
              />
            </div>

            {/* Requested Install Date */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                تاریخ درخواستی مشتری برای نصب:
              </label>
              <select
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-bold focus:border-[#C5A059] outline-none"
              >
                {upcomingDays.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.persianDayName} {toPersianDigits(d.persianDayNum)} {d.persianMonthName} ({d.dateKey})
                  </option>
                ))}
              </select>
            </div>

            {/* Mechanism Type */}
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                نوع مکانیزم و موتور:
              </label>
              <select
                value={mechanismType}
                onChange={(e) => setMechanismType(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none"
              >
                <option value="موتور برقی سامفی (Somfy)">موتور برقی سامفی (Somfy)</option>
                <option value="موتور برقی تویا هوشمند (Tuya)">موتور برقی تویا هوشمند (Tuya)</option>
                <option value="مکانیزم زنجیری دستی">مکانیزم زنجیری دستی</option>
                <option value="ترکیبی دستی و برقی">ترکیبی دستی و برقی</option>
                <option value="پرده سنتی با ریل گریبر">پرده سنتی با ریل گریبر</option>
              </select>
            </div>
          </div>

          {/* Panels Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#111620] p-4 rounded-xl border border-[#212835]">
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                تعداد لت شید رول:
              </label>
              <input
                type="number"
                min={0}
                value={shadePanels}
                onChange={(e) => setShadePanels(Number(e.target.value))}
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-bold tabular-nums focus:border-[#C5A059] focus-visible:ring-1 focus-visible:ring-[#C5A059] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                تعداد لت پرده پارچه‌ای:
              </label>
              <input
                type="number"
                min={0}
                value={curtainPanels}
                onChange={(e) => setCurtainPanels(Number(e.target.value))}
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-bold tabular-nums focus:border-[#C5A059] focus-visible:ring-1 focus-visible:ring-[#C5A059] outline-none"
              />
            </div>
          </div>

          {/* Address & Location */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                آدرس دقیق محل پروژه: *
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="تهران، خیابان فرشته، خیابان مریم، پلاک..."
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none resize-none leading-relaxed"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
                لینک لوکیشن نشان / بلد / گوگل‌مپ (اختیاری):
              </label>
              <input
                type="url"
                dir="ltr"
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder="https://nshn.ir/... یا https://balad.ir/..."
                className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none font-mono"
              />
            </div>
          </div>

          {/* Proposal Photos Upload (Mandatory) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#F0F4F8] flex items-center justify-between">
              <span>الصاق تصاویر برگه سفارش فروش یا پروپوزال: *</span>
              <span className="text-[11px] text-[#C5A059]">نصاب در سر کارگاه به این برگه‌ها دسترسی خواهد داشت</span>
            </label>

            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#2D3748] hover:border-[#C5A059] rounded-xl p-5 bg-[#0D1117] cursor-pointer transition group">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleProposalUpload}
                disabled={isUploadingProposal}
                className="hidden"
              />
              {isUploadingProposal ? (
                <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#1C232D] text-[#C5A059] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
              )}
              <span className="text-xs font-bold text-[#F0F4F8] group-hover:text-[#C5A059] transition">
                + افزودن عکس‌های برگه سفارش، کروکی یا پروپوزال مشتری
              </span>
            </label>

            {proposalImages.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto py-2">
                {proposalImages.map((img, i) => (
                  <div key={img.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#212835] shrink-0">
                    <img src={img.url} alt="پروپوزال" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProposalImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 left-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-700 shadow cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                      aria-label="حذف این تصویر پروپوزال"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Special Notes */}
          <div>
            <label className="block text-xs font-bold text-[#9BA7B6] mb-1.5">
              یادداشت ویژه برای تیم نصب و انبار (اختیاری):
            </label>
            <textarea
              rows={2}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="نکات خاص پارچه، هماهنگی با لابی ساختمان، زمان حضور کارفرما..."
              className="w-full text-xs p-3 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] focus-visible:ring-1 focus-visible:ring-[#C5A059] outline-none resize-none leading-relaxed"
            />
          </div>

          {formError && (
            <p className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl">
              {formError}
            </p>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#212835]">
            <button
              type="button"
              onClick={handleResetForm}
              className="px-5 py-3 rounded-xl text-xs font-bold bg-[#1C232D] text-[#9BA7B6] hover:text-[#F0F4F8] transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C5A059]"
            >
              پاک کردن فرم
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingProposal}
              className="px-7 py-3 rounded-xl text-xs font-black bg-[#C5A059] hover:bg-[#D4AF37] text-[#0D1117] flex items-center gap-2 shadow-lg shadow-[#C5A059]/20 transition disabled:opacity-50 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ثبت در سیستم...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ثبت قطعی سفارش و ارجاع به فنی</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ===================== TAB 2: SALES TRACKING & SHOWCASE ===================== */}
      {activeTab === 'TRACKING' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#151B23] rounded-2xl p-4 border border-[#212835] flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[#637184] absolute right-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو با نام مشتری، کد رهگیری، نشانی..."
                className="w-full text-xs pr-10 pl-3 py-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] focus:border-[#C5A059] outline-none"
              />
            </div>

            {/* Rep Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-[#9BA7B6] shrink-0">فیلتر کارشناس:</span>
              <select
                value={selectedRepFilter}
                onChange={(e) => setSelectedRepFilter(e.target.value)}
                className="w-full md:w-auto text-xs p-2.5 rounded-xl border border-[#212835] bg-[#0D1117] text-[#F0F4F8] font-bold outline-none"
              >
                <option value="ALL">همه کارشناسان فروش</option>
                {DEFAULT_SALES_REPS.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project List */}
          {trackedProjects.length === 0 ? (
            <div className="bg-[#151B23] rounded-2xl p-12 text-center border border-[#212835] space-y-2">
              <FolderKanban className="w-8 h-8 text-[#637184] mx-auto opacity-50" />
              <h4 className="text-sm font-bold text-[#F0F4F8]">پروژه‌ای با این مشخصات یافت نشد</h4>
              <p className="text-xs text-[#9BA7B6]">از تب «ثبت سفارش جدید» اولین پروژه خود را وارد نمایید.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trackedProjects.map((p) => {
                const isCompleted = p.status === 'COMPLETED' && p.qcStatus === 'APPROVED';
                const isStuck = p.status === 'STUCK';
                const isInProgress = p.status === 'IN_PROGRESS';

                // Stepper calculation
                const step =
                  p.status === 'MEASUREMENT_PENDING' ? 1 :
                  p.status === 'SCHEDULED' ? 2 :
                  p.warehousePrep?.isPackedAndReady ? 3 :
                  p.status === 'EN_ROUTE' || p.status === 'IN_PROGRESS' ? 4 :
                  p.status === 'COMPLETED' ? 5 : 2;

                return (
                  <div
                    key={p.id}
                    className={`bg-[#151B23] rounded-2xl p-5 border transition space-y-4 ${
                      p.isForceMajeure
                        ? 'border-rose-500/50 ring-1 ring-rose-500/20'
                        : isCompleted
                        ? 'border-emerald-500/40'
                        : isStuck
                        ? 'border-rose-500/40'
                        : 'border-[#212835] hover:border-[#2D3748]'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black bg-[#0D1117] text-[#C5A059] border border-[#2D3748] px-2 py-0.5 rounded">
                            {p.code}
                          </span>
                          {p.isForceMajeure && (
                            <span className="flex items-center gap-1 text-[11px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/30">
                              <Flame className="w-3 h-3 text-rose-400" />
                              فورس‌ماژور
                            </span>
                          )}
                          {p.salesRepName && (
                            <span className="text-[11px] text-[#9BA7B6]">
                              ثبت: <strong className="text-[#F0F4F8]">{p.salesRepName}</strong>
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-[#F0F4F8] mt-1">{p.title}</h4>
                      </div>

                      <div className="text-left shrink-0">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                          isCompleted
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isStuck
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isInProgress
                            ? 'bg-[#C5A059]/15 text-[#C5A059] border-[#C5A059]/30'
                            : 'bg-[#1C232D] text-[#9BA7B6] border-[#2D3748]'
                        }`}>
                          {isCompleted ? 'تایید نهایی QC ✅' :
                           isStuck ? 'متوقف در محل ⚠️' :
                           isInProgress ? 'در حال نصب سر کارگاه' :
                           p.status === 'MEASUREMENT_PENDING' ? 'در انتظار اندازه‌گیری دوم' : 'زمان‌بندی‌شده'}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Address */}
                    <div className="text-xs text-[#9BA7B6] space-y-1">
                      <p className="flex items-center gap-1.5">
                        <span className="font-bold text-[#F0F4F8]">{p.customerName}</span>
                        {p.customerPhone && (
                          <a href={`tel:${p.customerPhone}`} className="text-[#C5A059] font-mono hover:underline">
                            ({p.customerPhone})
                          </a>
                        )}
                      </p>
                      <p className="line-clamp-1">{p.address}</p>
                    </div>

                    {/* Stepper Progress Bar */}
                    <div className="bg-[#0D1117] p-2.5 rounded-xl border border-[#212835]">
                      <div className="flex items-center justify-between text-[10px] font-bold text-[#637184] mb-1.5">
                        <span className={step >= 1 ? 'text-[#C5A059]' : ''}>اندازه‌گیری دوم</span>
                        <span className={step >= 2 ? 'text-[#C5A059]' : ''}>دیسپچ مدیر</span>
                        <span className={step >= 3 ? 'text-[#C5A059]' : ''}>بسته‌بندی انبار</span>
                        <span className={step >= 4 ? 'text-[#C5A059]' : ''}>نصب کارگاه</span>
                        <span className={step >= 5 ? 'text-emerald-400' : ''}>تایید QC</span>
                      </div>
                      <div className="w-full bg-[#1C232D] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${isCompleted ? 'bg-emerald-500' : 'bg-[#C5A059]'}`}
                          style={{ width: `${(step / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Stuck reason if any */}
                    {isStuck && p.stuckIncident && (
                      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                        <span className="font-black flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          علت توقف کار:
                        </span>
                        <p className="text-[11px] leading-relaxed text-[#F0F4F8]">{p.stuckIncident.description}</p>
                      </div>
                    )}

                    {/* Photos Showcase (Before / After) */}
                    {(p.beforePhotos?.length || p.afterPhotos?.length || p.proposalImages?.length) && (
                      <div className="pt-2 border-t border-[#212835] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.beforePhotos && p.beforePhotos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(p.beforePhotos![0])}
                              className="text-[11px] font-bold text-[#9BA7B6] hover:text-[#C5A059] flex items-center gap-1 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>عکس قبل نصب ({p.beforePhotos.length})</span>
                            </button>
                          )}
                          {p.afterPhotos && p.afterPhotos.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(p.afterPhotos![0])}
                              className="text-[11px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer mr-2"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>عکس نهایی ({p.afterPhotos.length})</span>
                            </button>
                          )}
                        </div>

                        {onViewProposal && p.proposalImages?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onViewProposal(p)}
                            className="text-[11px] font-bold text-[#C5A059] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهده پروپوزال</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewPhotoUrl && (
        <div
          role="dialog"
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out"
        >
          <div className="relative max-w-2xl max-h-[90vh] rounded-xl overflow-hidden shadow-2xl">
            <CloudImage src={previewPhotoUrl} alt="تصویر پروژه" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 left-3 bg-black/70 text-white rounded-full p-2 hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
