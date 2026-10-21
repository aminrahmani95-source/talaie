import React, { useState } from 'react';
import { SystemSettings } from '../../types';
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
} from 'lucide-react';
import { StorageService } from '../../utils/storage';
import { SupabaseSyncService } from '../../utils/supabase';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  settings: SystemSettings;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<Props> = ({
  settings,
  isDarkMode = false,
  onToggleDarkMode,
  onUpdateSettings,
  onResetData,
}) => {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [visibilityDays, setVisibilityDays] = useState(settings.visibilityWindowDays);
  const [tools, setTools] = useState<string[]>([...settings.defaultTools]);
  const [newTool, setNewTool] = useState('');

  // Supabase states
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseAnonKey || '');
  const [copiedSql, setCopiedSql] = useState(false);

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
    onUpdateSettings({
      ...settings,
      companyName: companyName.trim(),
      visibilityWindowDays: visibilityDays,
      defaultTools: tools,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseKey.trim(),
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Banner */}
      <div className="bg-[#212121] rounded-3xl p-6 text-white shadow-xl flex items-center justify-between border border-[#C1A056]/30">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#C1A056]" aria-hidden="true" />
            <h2 className="text-xl font-black text-white">تنظیمات و همگام‌سازی گالری طلایی</h2>
          </div>
          <p className="text-xs text-[#E8E4DC] mt-1">
            شخصی‌سازی ظاهر (تم تیره/روشن)، بانک ابزارها، پنجره دید تکنسین‌ها و پشتیبان‌گیری
          </p>
        </div>
      </div>

      {/* Theme Switcher Card (UI/UX Pro Max) */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
            حالت نمایشی سامانه (Theme Mode)
          </h3>
          <span className="text-xs font-mono text-[#C1A056] font-bold">
            {isDarkMode ? 'حالت شب فعال است' : 'حالت روز فعال است'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              if (isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition min-h-[52px] active:scale-95 ${
              !isDarkMode
                ? 'border-[#C1A056] bg-[#FAF7F2] text-[#212121] ring-2 ring-[#C1A056]/30 font-bold shadow-xs'
                : 'border-[#E8E4DC] dark:border-[#333333] text-slate-500 dark:text-zinc-400 hover:bg-[#FAF7F2] dark:hover:bg-[#222222]'
            }`}
          >
            <Sun className="w-5 h-5 text-[#C1A056]" aria-hidden="true" />
            <span>حالت روز (روشن)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isDarkMode && onToggleDarkMode) onToggleDarkMode();
            }}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition min-h-[52px] active:scale-95 ${
              isDarkMode
                ? 'border-[#C1A056] bg-[#222222] text-[#C1A056] ring-2 ring-[#C1A056]/30 font-bold shadow-xs'
                : 'border-[#E8E4DC] text-slate-500 hover:bg-[#FAF7F2]'
            }`}
          >
            <Moon className="w-5 h-5 text-[#C1A056]" aria-hidden="true" />
            <span>حالت شب (دارک لوکس)</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveGeneral} className="space-y-6">
        {/* Section 1: General & Visibility */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
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
                className="w-full text-sm p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                <label htmlFor="settings-visibility-slider">پنجره دید تکنسین‌ها:</label>
                <span className="font-bold text-[#A88738] dark:text-[#C1A056] font-mono">
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
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                تکنسین‌ها با ورود به اپ، فقط مأموریت‌های {toPersianDigits(visibilityDays)} روز آینده را مشاهده خواهند کرد و برنامه‌های بعدی تا زمان باز شدن موعد برایشان مخفی خواهد ماند.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Master Tools Bank */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
              بانک پیش‌فرض ابزارها (تجهیزات دکمه «فول ابزار»)
            </h3>
            <span className="text-xs text-[#A88738] dark:text-[#C1A056] font-mono font-bold">
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
              className="flex-1 text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] focus:ring-2 focus:ring-[#C1A056] bg-[#FAF7F2] dark:bg-[#141414] dark:text-white dark:placeholder-zinc-500"
            />
            <button
              type="button"
              onClick={handleAddTool}
              className="px-5 py-2.5 bg-[#212121] dark:bg-[#C1A056] text-[#C1A056] dark:text-[#121212] rounded-xl text-xs font-bold hover:bg-[#333333] transition flex items-center gap-1 border border-[#C1A056]/30 active:scale-95 min-h-[44px]"
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
                className="flex items-center justify-between p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] bg-[#FAF7F2] dark:bg-[#202020] text-xs text-[#212121] dark:text-zinc-200"
              >
                <span className="truncate">{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTool(t)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                  title="حذف از بانک"
                  aria-label={`حذف ${t} از بانک ابزار`}
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Supabase Cloud Sync */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#C1A056]" aria-hidden="true" />
              <h3 className="font-bold text-sm text-[#212121] dark:text-white">
                اتصال ابری همگام‌سازی لحظه‌ای بین چند دستگاه (Supabase Free Sync)
              </h3>
            </div>
            {supabaseUrl && supabaseKey ? (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>دیتابیس ابری متصل است</span>
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                حالت ذخیره‌سازی محلی (آفلاین)
              </span>
            )}
          </div>

          <div className="bg-[#FAF7F2] dark:bg-[#202020] border border-[#C1A056]/30 rounded-2xl p-4 text-xs text-slate-800 dark:text-zinc-200 leading-relaxed space-y-2">
            <p className="font-bold text-[#212121] dark:text-[#C1A056]">همگام‌سازی رایگان و ۱۰۰٪ آنلاین بین تمام گوشی‌ها:</p>
            <p>
              سایت شما با گیت‌هاب پیجز رایگان اجرا می‌شود. با اتصال به سرویس ابری رایگان Supabase، هر اطلاعاتی که هر کاربری وارد کند (پروژه، عکس، امضا یا تیکت) در کسری از ثانیه روی تمام گوشی‌های سرپرستان و مدیران آپدیت می‌شود.
            </p>
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 bg-[#212121] hover:bg-[#333333] dark:bg-[#C1A056] dark:hover:bg-[#a88738] text-[#C1A056] dark:text-[#212121] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 active:scale-95 shadow-xs"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'دستورات SQL کپی شد!' : 'کپی دستورات SQL ساخت جدول در سوپابیس'}</span>
              </button>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#A88738] dark:text-[#C1A056] font-bold underline hover:opacity-80"
              >
                ورود به پنل رایگان Supabase ↗
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="supabase-url" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Supabase Project URL:
              </label>
              <input
                id="supabase-url"
                type="text"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="supabase-key" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Supabase Anon Public Key:
              </label>
              <input
                id="supabase-key"
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-[#E8E4DC] dark:border-[#333333] font-mono text-left bg-[#FAF7F2] dark:bg-[#141414] dark:text-white"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] font-bold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm border border-[#C1A056]/30 active:scale-[0.99] min-h-[48px]"
        >
          <CheckCircle2 className="w-5 h-5 text-[#C1A056]" aria-hidden="true" />
          ذخیره تمام تنظیمات
        </button>
      </form>

      {/* Section 4: Backup & Restore */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 border border-[#E8E4DC] dark:border-[#2D2D2D] shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-[#212121] dark:text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
          پشتیبان‌گیری (Backup) و بازیابی اطلاعات
        </h3>

        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          می‌توانید تمام پروژه‌های یک‌ماهه، لیست تکنسین‌ها، تیکت‌ها و ارزیابی‌های کیوسی را به عنوان فایل پشتیبان JSON دانلود کنید تا هیچ‌وقت اطلاعات شما از بین نرود.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#212121] hover:bg-[#333333] text-[#C1A056] rounded-full text-xs font-bold transition shadow-xs border border-[#C1A056]/30 active:scale-95 min-h-[44px]"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            دانلود فایل پشتیبان کامل (JSON Backup)
          </button>

          <label className="flex items-center gap-2 px-5 py-2.5 border border-[#E8E4DC] dark:border-[#333333] hover:bg-[#FAF7F2] dark:hover:bg-[#242424] text-slate-700 dark:text-zinc-300 rounded-full text-xs font-bold transition cursor-pointer active:scale-95 min-h-[44px]">
            <Upload className="w-4 h-4 text-[#C1A056]" aria-hidden="true" />
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
            className="flex items-center gap-2 px-4 py-2.5 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-full text-xs font-bold transition mr-auto active:scale-95 min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            بازنشانی به داده‌های تستی اولیه
          </button>
        </div>
      </div>
    </div>
  );
};
