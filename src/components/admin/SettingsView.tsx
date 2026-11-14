import React, { useState, useEffect } from 'react';
import { Project, SystemSettings } from '../../types';
import {
  Layers,
  Eye,
  Wrench,
  Download,
  Upload,
  Cloud,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Sun,
  Moon,
  Sparkles,
  Copy,
  Check,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { StorageService } from '../../utils/storage';
import { SupabaseSyncService, RealtimeConnectionStatus } from '../../utils/supabase';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  settings: SystemSettings;
  projects?: Project[];
  onUpdateProjects?: (projects: Project[]) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<Props> = ({
  settings,
  projects = [],
  onUpdateProjects,
  isDarkMode = false,
  onToggleDarkMode,
  onUpdateSettings,
  onResetData,
}) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [visibilityDays, setVisibilityDays] = useState(settings.visibilityWindowDays);
  const [defaultCapacityHours, setDefaultCapacityHours] = useState<string>(
    settings.defaultTeamDailyCapacityHours !== undefined && settings.defaultTeamDailyCapacityHours !== null
      ? String(settings.defaultTeamDailyCapacityHours)
      : ''
  );
  const [tools, setTools] = useState<string[]>([...settings.defaultTools]);
  const [newTool, setNewTool] = useState('');

  // Realtime connection status
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>(
    SupabaseSyncService.getRealtimeStatus()
  );
  const [copiedSql, setCopiedSql] = useState(false);

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{ current: number; total: number } | null>(null);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  useEffect(() => {
    const unsub = SupabaseSyncService.onRealtimeStatusChange((status) => {
      setRealtimeStatus(status);
    });
    return () => unsub();
  }, []);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SupabaseSyncService.getSetupSqlScript());
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleAddTool = () => {
    if (!newTool.trim()) return;
    if (tools.includes(newTool.trim())) {
      alert('این ابزار در حال حاضر در لیست وجود دارد.');
      return;
    }
    const updated = [...tools, newTool.trim()];
    setTools(updated);
    setNewTool('');
    onUpdateSettings({ ...settings, defaultTools: updated });
  };

  const handleRemoveTool = (toolToRemove: string) => {
    const updated = tools.filter((t) => t !== toolToRemove);
    setTools(updated);
    onUpdateSettings({ ...settings, defaultTools: updated });
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    const capNum = defaultCapacityHours.trim() ? parseFloat(defaultCapacityHours) : null;
    onUpdateSettings({
      ...settings,
      companyName: companyName.trim(),
      visibilityWindowDays: visibilityDays,
      defaultTools: tools,
      defaultTeamDailyCapacityHours: capNum && !isNaN(capNum) && capNum > 0 ? capNum : null,
    });
    alert('تنظیمات سامانه با موفقیت ذخیره شد.');
  };

  // Export JSON file
  const handleExportBackup = () => {
    const jsonStr = StorageService.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talaei-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = StorageService.importBackup(content);
        if (success) {
          alert('اطلاعات با موفقیت بازیابی شد. صفحه برای اعمال تغییرات مجدد بارگذاری می‌شود.');
          window.location.reload();
        } else {
          alert('فرمت فایل پشتیبان نامعتبر است.');
        }
      }
    };
    reader.readAsText(file);
  };

  // Migrate legacy base64 photos to Supabase Storage
  const handleMigratePhotos = async () => {
    if (projects.length === 0) {
      alert('هیچ پروژه‌ای برای بررسی وجود ندارد.');
      return;
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const res = await SupabaseSyncService.migrateLegacyPhotos(
        projects,
        (current, total) => {
          setMigrationProgress({ current, total });
        }
      );

      if (res.migratedCount > 0) {
        if (onUpdateProjects) {
          onUpdateProjects(res.updatedProjects);
        }
        setMigrationResult(`تعداد ${toPersianDigits(res.migratedCount)} تصویر با موفقیت به باکت ابری منتقل و ذخیره شدند.`);
      } else {
        setMigrationResult('تمام تصاویر از قبل در فضای ابری ثبت شده‌اند و هیچ عکس قدیمی‌ای یافت نشد.');
      }
    } catch (err: any) {
      setMigrationResult(`خطا در انتقال تصاویر: ${err.message || err}`);
    } finally {
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Banner */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl flex items-center justify-between border border-[#C5A059]/30">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#C5A059]" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">تنظیمات و همگام‌سازی گالری طلایی</h2>
          </div>
          <p className="text-xs text-[#E8E4DC] mt-1">
            شخصی‌سازی ظاهر (تم تیره/روشن)، بانک ابزارها، پنجره دید تکنسین‌ها و پشتیبان‌گیری
          </p>
        </div>
      </div>

      {/* Theme Switcher Card */}
      <div className="bg-[#151B23] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D]  space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            حالت نمایشی سامانه (Theme Mode)
          </h3>
          <span className="text-xs text-[#C5A059] font-bold">
            {isDarkMode ? 'حالت شب فعال است' : 'حالت روز فعال است'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border transition min-h-[52px] active:scale-95 cursor-pointer ${
              !isDarkMode
                ? 'border-[#C5A059] bg-[#FAF7F2] text-[#212121] ring-2 ring-[#C1A056]/30 font-bold '
                : 'border-[#E8E4DC] dark:border-[#333333] text-slate-500 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#222222]'
            }`}
          >
            <Sun className="w-5 h-5 text-[#C5A059]" aria-hidden="true" />
            <span>حالت روز (روشن)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex items-center justify-center gap-2 p-4 rounded-lg border transition min-h-[52px] active:scale-95 cursor-pointer ${
              isDarkMode
                ? 'border-[#C5A059] bg-[#222222] text-[#C5A059] ring-2 ring-[#C1A056]/30 font-bold '
                : 'border-[#E8E4DC] text-slate-500 hover:bg-[#FAF7F2]'
            }`}
          >
            <Moon className="w-5 h-5 text-[#C5A059]" aria-hidden="true" />
            <span>حالت شب (دارک لوکس)</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveGeneral} className="space-y-6">
        {/* Section 1: General & Visibility */}
        <div className="bg-[#151B23] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D]  space-y-4">
          <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            پنجره دید تکنسین‌ها و نام مجموعه
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-company-name" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                نام مجموعه / عنوان سامانه:
              </label>
              <input
                id="settings-company-name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-sm p-2.5 rounded-md border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#111620] dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                <label htmlFor="settings-visibility-slider">پنجره دید تکنسین‌ها:</label>
                <span className="font-bold text-[#A88738] dark:text-[#C5A059]">
                  {toPersianDigits(visibilityDays)} روز آینده
                </span>
              </div>
              <input
                id="settings-visibility-slider"
                type="range"
                min="1"
                max="14"
                value={visibilityDays}
                onChange={(e) => setVisibilityDays(Number(e.target.value))}
                className="w-full accent-[#C1A056] h-2 bg-slate-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
              />
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                تکنسین‌ها با ورود به اپ، فقط مأموریت‌های {toPersianDigits(visibilityDays)} روز آینده را مشاهده خواهند کرد و برنامه‌های بعدی تا زمان باز شدن موعد برایشان مخفی خواهد ماند.
              </p>
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-[#E8E4DC] dark:border-[#2D2D2D]">
              <label htmlFor="settings-capacity" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                سقف ظرفیت کاری استاندارد روزانه اکیپ‌ها (ساعت در روز):
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="settings-capacity"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  placeholder="مثلاً ۸ (یا خالی برای حالت نامشخص)"
                  value={defaultCapacityHours}
                  onChange={(e) => setDefaultCapacityHours(e.target.value)}
                  className="w-48 text-sm p-2.5 rounded-md border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#111620] dark:text-white"
                />
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {defaultCapacityHours ? `${toPersianDigits(defaultCapacityHours)} ساعت در روز` : 'تعیین‌نشده (هشدار عدم تنظیم ظرفیت)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                این مقدار سقف پیش‌فرض کل سامانه است. اگر اکیپی سقف اختصاصی نداشته باشد، از این مقدار استفاده خواهد شد.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Master Tools Bank */}
        <div className="bg-[#151B23] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D]  space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
              بانک پیش‌فرض ابزارها (تجهیزات دکمه «فول ابزار»)
            </h3>
            <span className="text-xs text-[#A88738] dark:text-[#C5A059] font-bold">
              {toPersianDigits(tools.length)} قلم ابزار
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-zinc-400">
            ابزارهای این لیست، تجهیزاتی هستند که با کلیک روی دکمه «فول ابزار» به صورت خودکار برای مأموریت انتخاب می‌شوند.
          </p>

          {/* Add new tool input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="نام ابزار جدید (مثلاً: دریل مگنتی، ریل‌بر برقی)..."
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-md border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#111620] dark:text-white dark:placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleAddTool}
              className="px-5 py-2.5 bg-[#212121] dark:bg-[#C1A056] text-[#C5A059] dark:text-[#121212] rounded-md text-xs font-bold hover:bg-[#333333] transition flex items-center gap-1 border border-[#C5A059]/30 active:scale-95 min-h-[44px] cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              افزودن به بانک
            </button>
          </div>

          {/* Tools List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
            {tools.map((t) => (
              <div
                key={t}
                className="flex items-center justify-between p-2.5 rounded-md border border-[#E8E4DC] dark:border-[#333333] bg-[#1C232D] text-xs text-[#212121] dark:text-zinc-200"
              >
                <span className="truncate">{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTool(t)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                  title="حذف از بانک"
                  aria-label={`حذف ${t} از بانک ابزار`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Supabase Cloud Realtime Status & Photo Migration */}
        <div className="bg-[#151B23] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D]  space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#C5A059]" aria-hidden="true" />
              <h3 className="font-bold text-sm text-[#212121] dark:text-white">
                وضعیت شبکه ابری و همگام‌سازی زنده (Supabase Realtime)
              </h3>
            </div>

            {realtimeStatus === 'CONNECTED' ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>متصل به شبکه ابری لحظه‌ای (آنلاین)</span>
              </span>
            ) : realtimeStatus === 'CONNECTING' ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                <span>در حال برقراری ارتباط...</span>
              </span>
            ) : (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                حالت محلی / در انتظار اتصال
              </span>
            )}
          </div>

          <div className="bg-[#1C232D] border border-[#C5A059]/30 rounded-lg p-4 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed space-y-2">
            <p className="font-bold text-[#212121] dark:text-[#C5A059]">
              ارتباط سطر‌به‌سطر امن و بدون تداخل (Row-by-Row Synchronization):
            </p>
            <p>
              تنظیمات اتصال مستقیماً از فایل امن کانفیگ پروژه خوانده می‌شود. تغییر وضعیت هر پروژه، آپلود عکس، گزارش اتمام یا تیکت بلافاصله و فقط برای همان ردیف در دیتابیس ثبت شده و دیگر هیچ تداخلی بین تغییرات هم‌زمان پرسنل پیش نخواهد آمد.
            </p>
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3.5 py-2 min-h-[44px] bg-[#212121] hover:bg-[#333333] dark:bg-[#C1A056] dark:hover:bg-[#a88738] text-[#C5A059] dark:text-[#212121] rounded-md text-xs font-bold transition flex items-center gap-1.5 active:scale-95  cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'دستورات SQL کپی شد!' : 'کپی دستورات SQL ساخت جدول‌ها'}</span>
              </button>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#A88738] dark:text-[#C5A059] font-bold underline hover:opacity-80 min-h-[44px] flex items-center"
              >
                ورود به پنل Supabase ↗
              </a>
            </div>
          </div>

          {/* Photo Cloud Migration Tool for QC Manager */}
          <div className="p-4 rounded-lg border border-[#E8E4DC] dark:border-[#333333] bg-white dark:bg-[#181818] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#C5A059]" />
                <span className="text-xs font-bold text-[#212121] dark:text-white">
                  انتقال عکس‌های قدیمی به فضای باکت ابری (talaie-photos)
                </span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              اگر عکس‌هایی از قبل به‌صورت فشرده در مرورگر ذخیره شده باشند، با زدن این دکمه همه‌ی آن‌ها به باکت اختصاصی ابری Supabase Storage منتقل شده و حافظه گوشی پرسنل آزاد می‌شود.
            </p>

            {migrationProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#C5A059]">
                  <span>در حال انتقال تصویر {toPersianDigits(migrationProgress.current)} از {toPersianDigits(migrationProgress.total)}...</span>
                  <span>{Math.round((migrationProgress.current / migrationProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#C1A056] h-full transition-all duration-200"
                    style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {migrationResult && (
              <div className="p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                {migrationResult}
              </div>
            )}

            <button
              type="button"
              disabled={isMigrating}
              onClick={handleMigratePhotos}
              className="px-4 py-2 bg-[#212121] dark:bg-[#C1A056] text-[#C5A059] dark:text-[#121212] rounded-md text-xs font-bold hover:bg-[#333333] transition flex items-center gap-2 border border-[#C5A059]/30 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال انتقال تصاویر...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>انتقال عکس‌های قدیمی به فضای ابری</span>
                </>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-[#212121] hover:bg-[#333333] text-[#C5A059] font-bold rounded-lg shadow-lg transition flex items-center justify-center gap-2 text-sm border border-[#C5A059]/30 active:scale-[0.99] min-h-[48px] cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5 text-[#C5A059]" aria-hidden="true" />
          ذخیره تمام تنظیمات
        </button>
      </form>

      {/* Section 4: Backup & Restore */}
      <div className="bg-[#151B23] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D]  space-y-4">
        <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
          پشتیبان‌گیری (Backup) و بازیابی اطلاعات
        </h3>

        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          می‌توانید تمام پروژه‌ها، لیست تکنسین‌ها، تیکت‌ها و ارزیابی‌های QC را به عنوان فایل پشتیبان JSON دانلود کنید تا هیچ‌وقت اطلاعات شما از بین نرود.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C5A059] rounded-full text-xs font-bold transition  border border-[#C5A059]/30 active:scale-95 min-h-[44px] cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            دانلود فایل پشتیبان کامل (JSON Backup)
          </button>

          <label className="flex items-center gap-2 px-5 py-2.5 border border-[#E8E4DC] dark:border-[#333333] hover:bg-[#FAF7F2] dark:hover:bg-[#242424] text-slate-700 dark:text-zinc-300 rounded-full text-xs font-bold transition cursor-pointer active:scale-95 min-h-[44px]">
            <Upload className="w-4 h-4 text-[#C5A059]" aria-hidden="true" />
            <span>بازیابی از فایل پشتیبان</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onResetData}
            className="flex items-center gap-2 px-4 py-2.5 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-full text-xs font-bold transition mr-auto active:scale-95 min-h-[44px] cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            پاک‌سازی کش محلی و بارگذاری مجدد
          </button>
        </div>
      </div>
    </div>
  );
};
