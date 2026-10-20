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
  Shield,
  HelpCircle,
} from 'lucide-react';
import { StorageService } from '../../utils/storage';
import { toPersianDigits } from '../../utils/jalali';

interface Props {
  settings: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<Props> = ({
  settings,
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
    a.download = `talaie-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-black">تنظیمات، پنجره دید تکنسین‌ها و بکاپ</h2>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            شخصی‌سازی بانک ابزارها، کنترل تعداد روزهای مجاز برای نمایش به نصاب‌ها و پشتیبان‌گیری از اطلاعات
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveGeneral} className="space-y-6">
        {/* Section 1: General & Visibility */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-600" />
            پنجره دید تکنسین‌ها و نام مجموعه
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                نام مجموعه / عنوان سامانه:
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>پنجره دید تکنسین‌ها:</span>
                <span className="font-bold text-amber-600 font-mono">
                  {toPersianDigits(visibilityDays)} روز آینده
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="14"
                value={visibilityDays}
                onChange={(e) => setVisibilityDays(Number(e.target.value))}
                className="w-full accent-amber-500 h-2 bg-slate-100 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                تکنسین‌ها با ورود به اپ، فقط برنامه‌های {toPersianDigits(visibilityDays)} روز آینده را مشاهده خواهند کرد و برنامه‌های بعدی تا زمان رسیدن موعد برایشان مخفی خواهد ماند.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Master Tools Bank */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              بانک پیش‌فرض ابزارها (تجهیزات دکمه «فول ابزار»)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {toPersianDigits(tools.length)} قلم ابزار
            </span>
          </div>

          <p className="text-xs text-slate-500">
            ابزارهای این لیست، تجهیزاتی هستند که با کلیک روی دکمه **«فول ابزار»** به صورت خودکار برای مأموریت انتخاب می‌شوند.
          </p>

          {/* Add new tool input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="نام ابزار جدید (مثلاً: دریل مگنتی، ریل‌بر برقی)..."
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddTool}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              افزودن به بانک
            </button>
          </div>

          {/* Tools List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
            {tools.map((t) => (
              <div
                key={t}
                className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800"
              >
                <span className="truncate">{t}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTool(t)}
                  className="p-1 text-slate-400 hover:text-red-600 transition"
                  title="حذف از بانک"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Supabase Cloud Sync (Zero-Cost Serverless) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-800">
              اتصال ابری همگام‌سازی لحظه‌ای (Supabase Free Sync)
            </h3>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 leading-relaxed">
            <p className="font-bold mb-1">💡 راهنمای اتصال ۱۰۰٪ رایگان بدون سرور:</p>
            سایت شما روی GitHub Pages به صورت رایگان بالا می‌آید. برای اینکه وقتی شما برنامه‌ای را ثبت می‌کنید در همان لحظه در گوشی تکنسین‌ها آپدیت شود، می‌توانید یک حساب رایگان در Supabase بسازید و آدرس URL و کلید Anon را در زیر وارد کنید.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase Project URL:
              </label>
              <input
                type="text"
                placeholder="https://xyz.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase Anon Public Key:
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 text-sm"
        >
          <CheckCircle2 className="w-5 h-5" />
          ذخیره تمام تنظیمات
        </button>
      </form>

      {/* Section 4: Backup & Restore */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-600" />
          پشتیبان‌گیری (Backup) و بازیابی اطلاعات
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed">
          می‌توانید تمام پروژه‌های یک‌ماهه، لیست تکنسین‌ها، تیکت‌ها و ارزیابی‌های کیوسی را به عنوان فایل پشتیبان JSON دانلود کنید تا هیچ‌وقت اطلاعات شما از بین نرود.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            دانلود فایل پشتیبان کامل (JSON Backup)
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
            <Upload className="w-4 h-4 text-slate-500" />
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
            className="flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition mr-auto"
          >
            <RotateCcw className="w-4 h-4" />
            بازنشانی به داده‌های تستی اولیه
          </button>
        </div>
      </div>
    </div>
  );
};
