import React, { useMemo, useRef, useState } from 'react';
import { Archive, CheckCircle2, Database, Images, Loader2, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { SupabaseSyncService } from '../../utils/supabase';
import {
  addPhotosToZip,
  backupAgeDays,
  collectPhotoRefs,
  collectServerBackup,
  getLastBackup,
  projectLabelFromRow,
  projectTouchedSince,
  setLastBackup,
  type BackupFile,
  type LastBackupInfo,
} from '../../utils/backup';
import { formatJalaliDateTime, formatToPersianDateString, toPersianDigits } from '../../utils/jalali';
import { SegmentedControl, triggerToast } from '../ui';

type PhotoRange = 'ALL' | '30D';

type Phase =
  | { kind: 'idle' }
  | { kind: 'tables'; label: string; index: number; total: number }
  | { kind: 'photos'; done: number; total: number }
  | { kind: 'zipping'; percent: number };

interface ResultInfo {
  withPhotos: boolean;
  fileName: string;
  tables: BackupFile['summary'];
  photos?: { ok: number; failed: number; mb: number; cancelled: boolean };
}

function appVersion(): string | null {
  try {
    const el = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null;
    return el?.src.match(/index-[\w-]+/)?.[0] || null;
  } catch {
    return null;
  }
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function cachedUserName(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem('talaie_cached_profile') || 'null');
    return p?.name || null;
  } catch {
    return null;
  }
}

/**
 * «پشتیبان کامل از سرور»: همه‌ی اطلاعات (پروژه‌ها، رزروها، پرسنل، اکیپ‌ها، تیکت‌ها، متریال،
 * تاریخچه) را مستقیم از سرور می‌خواند، نه از حافظه‌ی همین دستگاه. با انتخاب «همراه عکس‌ها»
 * همه‌ی عکس‌ها و امضاها هم در یک فایل ZIP با پوشه‌ی جدا برای هر پروژه ذخیره می‌شود.
 */
export const ServerBackupCard: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [photoRange, setPhotoRange] = useState<PhotoRange>('ALL');
  const [last, setLast] = useState<LastBackupInfo | null>(() => getLastBackup());
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const busy = phase.kind !== 'idle';
  const age = useMemo(() => backupAgeDays(last), [last]);

  const run = async (withPhotos: boolean) => {
    if (busy) return;
    stopRef.current = false;
    setError('');
    setResult(null);
    const datePart = formatToPersianDateString(new Date()).replace(/\//g, '-');
    try {
      const backup = await collectServerBackup(
        (t) => SupabaseSyncService.fetchTableForBackup(t),
        { exportedBy: cachedUserName(), appVersion: appVersion() },
        (label, index, total) => setPhase({ kind: 'tables', label, index, total })
      );
      const projectsCount = backup.tables.projects?.length || 0;
      const json = JSON.stringify(backup, null, 1);

      if (!withPhotos) {
        const fileName = `talaie-backup-${datePart}.json`;
        saveBlob(new Blob([json], { type: 'application/json' }), fileName);
        const info: LastBackupInfo = { at: new Date().toISOString(), withPhotos: false, projects: projectsCount };
        setLastBackup(info);
        setLast(info);
        setResult({ withPhotos: false, fileName, tables: backup.summary });
        triggerToast('success', 'فایل پشتیبان اطلاعات دانلود شد.');
        return;
      }

      // عکس‌ها
      const labelById = new Map<string, string | null>();
      for (const row of backup.tables.projects || []) labelById.set(String(row.id), projectLabelFromRow(row));
      let refs = collectPhotoRefs(backup.tables);
      if (photoRange === '30D') {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const recentProjects = new Set(
          (backup.tables.projects || []).filter((r) => projectTouchedSince(r, since)).map((r) => String(r.id))
        );
        const recentBookingPaths = new Set(
          collectPhotoRefs({ sales_bookings: (backup.tables.sales_bookings || []).filter((r) => projectTouchedSince(r, since)) }).map(
            (r) => r.path
          )
        );
        refs = refs.filter((r) => (r.projectId ? recentProjects.has(r.projectId) : recentBookingPaths.has(r.path)));
      }
      setPhase({ kind: 'photos', done: 0, total: refs.length });

      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      zip.file('اطلاعات/talaie-backup.json', json, { compression: 'DEFLATE' });
      const photoRes = await addPhotosToZip(
        zip,
        refs,
        (path) => SupabaseSyncService.downloadStorageFile(path),
        (id) => labelById.get(id) || null,
        {
          concurrency: 4,
          onProgress: (done, total) => setPhase({ kind: 'photos', done, total }),
          shouldStop: () => stopRef.current,
        }
      );
      zip.file('فهرست-عکس‌ها.csv', photoRes.listCsv, { compression: 'DEFLATE' });
      zip.file(
        'راهنما.txt',
        [
          'پشتیبان کامل سامانه‌ی گالری طلایی',
          `تاریخ: ${formatJalaliDateTime(new Date())}`,
          `پروژه‌ها: ${projectsCount}`,
          `عکس‌های دریافت‌شده: ${photoRes.ok} از ${refs.length}`,
          photoRes.cancelled ? 'این پشتیبان وسط کار متوقف شد و همه‌ی عکس‌ها را ندارد.' : '',
          '',
          'پوشه‌ی «اطلاعات»: همه‌ی اطلاعات برنامه (برای بازگردانی لازم است؛ تغییرش ندهید).',
          'پوشه‌ی «عکس‌ها»: برای هر پروژه یک پوشه، داخلش عکس‌های قبل از نصب، بعد از نصب، پایان کار و امضا.',
          'فایل «فهرست-عکس‌ها»: هر عکس از کجای سرور آمده و آیا دریافت شده است.',
        ].join('\r\n'),
        { compression: 'DEFLATE' }
      );

      setPhase({ kind: 'zipping', percent: 0 });
      const blob = await zip.generateAsync({ type: 'blob', streamFiles: true }, (meta) =>
        setPhase({ kind: 'zipping', percent: Math.round(meta.percent) })
      );
      const fileName = `talaie-backup-${datePart}-${photoRange === 'ALL' ? 'full' : '30days'}.zip`;
      saveBlob(blob, fileName);

      if (!photoRes.cancelled) {
        const info: LastBackupInfo = {
          at: new Date().toISOString(),
          withPhotos: true,
          projects: projectsCount,
          photos: photoRes.ok,
        };
        setLastBackup(info);
        setLast(info);
      }
      setResult({
        withPhotos: true,
        fileName,
        tables: backup.summary,
        photos: {
          ok: photoRes.ok,
          failed: photoRes.failed.length,
          mb: Math.round((photoRes.bytes / (1024 * 1024)) * 10) / 10,
          cancelled: photoRes.cancelled,
        },
      });
      triggerToast(photoRes.cancelled ? 'warning' : 'success', photoRes.cancelled ? 'پشتیبان ناقص (متوقف‌شده) دانلود شد.' : 'فایل پشتیبان کامل دانلود شد.');
    } catch (err: any) {
      setError(err?.message || 'پشتیبان‌گیری انجام نشد.');
    } finally {
      setPhase({ kind: 'idle' });
    }
  };

  const progressText =
    phase.kind === 'tables'
      ? `در حال خواندن ${phase.label} (${toPersianDigits(phase.index + 1)} از ${toPersianDigits(phase.total)})…`
      : phase.kind === 'photos'
      ? `در حال دریافت عکس‌ها: ${toPersianDigits(phase.done)} از ${toPersianDigits(phase.total)}`
      : phase.kind === 'zipping'
      ? `در حال ساخت فایل: ${toPersianDigits(phase.percent)}٪`
      : '';
  const progressPct =
    phase.kind === 'tables'
      ? Math.round(((phase.index + 1) / phase.total) * 100)
      : phase.kind === 'photos'
      ? phase.total
        ? Math.round((phase.done / phase.total) * 100)
        : 100
      : phase.kind === 'zipping'
      ? phase.percent
      : 0;

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-xl bg-brand/15 text-brand-ink flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <h4 className="font-extrabold text-sm text-ink">پشتیبان کامل از سرور</h4>
          <p className="text-xs text-ink-2 leading-6">
            همه‌ی پروژه‌ها، رزروهای فروش، پرسنل، اکیپ‌ها، تیکت‌ها، درخواست‌های متریال و تاریخچه‌ی تغییرات مستقیم از سرور
            خوانده و روی همین کامپیوتر ذخیره می‌شود. اگر روزی سرور در دسترس نباشد یا اطلاعاتی پاک شود، این فایل همه‌چیز را
            نگه داشته است.
          </p>
          <p className={`text-xs font-bold ${age === null || age >= 7 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {last
              ? `آخرین پشتیبان روی این دستگاه: ${formatJalaliDateTime(last.at)}${age !== null && age > 0 ? ` (${toPersianDigits(age)} روز پیش)` : ' (امروز)'}${last.withPhotos ? ' · همراه عکس‌ها' : ' · بدون عکس'}`
              : 'هنوز از این دستگاه پشتیبان گرفته نشده است.'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Database className="w-4 h-4 text-brand-ink" aria-hidden="true" />
            فقط اطلاعات
          </div>
          <p className="text-[11px] text-ink-3 leading-5">چند ثانیه طول می‌کشد و فایلش کوچک است. پیشنهاد: هر روز یا هر چند روز یک بار.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(false)}
            className="w-full min-h-[44px] rounded-full bg-brand text-on-brand text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            <Archive className="w-4 h-4" aria-hidden="true" />
            دانلود پشتیبان اطلاعات
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Images className="w-4 h-4 text-brand-ink" aria-hidden="true" />
            اطلاعات + همه‌ی عکس‌ها و امضاها
          </div>
          <p className="text-[11px] text-ink-3 leading-5">
            یک فایل ZIP با پوشه‌ی جدا برای هر پروژه. بسته به تعداد عکس چند دقیقه طول می‌کشد؛ پیشنهاد: هفته‌ای یک بار با اینترنت خوب.
          </p>
          <SegmentedControl<PhotoRange>
            size="sm"
            ariaLabel="کدام عکس‌ها"
            value={photoRange}
            onChange={setPhotoRange}
            options={[
              { value: 'ALL', label: 'همه‌ی عکس‌ها' },
              { value: '30D', label: 'پروژه‌های 30 روز اخیر' },
            ]}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(true)}
            className="w-full min-h-[44px] rounded-full border border-brand text-brand-ink text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-brand/10 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            <Images className="w-4 h-4" aria-hidden="true" />
            دانلود پشتیبان همراه عکس‌ها
          </button>
        </div>
      </div>

      {busy && (
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-xs text-ink">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-ink" aria-hidden="true" />
              {progressText}
            </span>
            {phase.kind === 'photos' && (
              <button
                type="button"
                onClick={() => (stopRef.current = true)}
                className="min-h-[36px] px-3 rounded-full border border-line text-ink-2 hover:text-ink flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                توقف
              </button>
            )}
          </div>
          <div className="h-2 rounded-full bg-sunken overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[11px] text-ink-3">تا تمام شدن، این صفحه را نبندید.</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2 text-xs text-ink">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            ذخیره شد: <span dir="ltr">{result.fileName}</span>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-ink-2">
            {result.tables.map((t) => (
              <li key={t.table}>
                {t.label}:{' '}
                {t.status === 'ok' ? (
                  <span className="font-bold text-ink tabular-nums">{toPersianDigits(t.count)}</span>
                ) : t.status === 'missing' ? (
                  <span className="text-ink-3">روی سرور نیست</span>
                ) : (
                  <span className="text-rose-600">خوانده نشد</span>
                )}
              </li>
            ))}
          </ul>
          {result.photos && (
            <p className={result.photos.failed || result.photos.cancelled ? 'text-amber-700 dark:text-amber-400' : 'text-ink-2'}>
              عکس‌ها: {toPersianDigits(result.photos.ok)} عکس ({toPersianDigits(result.photos.mb)} مگابایت)
              {result.photos.failed > 0 && ` · ${toPersianDigits(result.photos.failed)} عکس دریافت نشد (در فایل «فهرست-عکس‌ها» آمده)`}
              {result.photos.cancelled && ' · وسط کار متوقف شد'}
            </p>
          )}
          <p className="text-ink-3 leading-5">
            فایل در پوشه‌ی Downloads کامپیوتر است. بهتر است یک نسخه هم روی فلش، هارد جدا یا Google Drive نگه دارید.
          </p>
        </div>
      )}
    </div>
  );
};
