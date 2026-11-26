/**
 * پشتیبان کامل از اطلاعات سرور: همه‌ی جدول‌ها در یک فایل JSON، و در صورت انتخاب همه‌ی
 * عکس‌ها و امضاها در یک فایل ZIP با پوشه‌بندی بر اساس پروژه.
 *
 * چرا: پوشه‌ی کد (Desktop\1 و GitHub) فقط «قالب» برنامه است؛ پروژه‌ها، عکس‌ها و گزارش‌هایی
 * که آدم‌ها وارد می‌کنند فقط روی سرور Supabase بودند و هیچ نسخه‌ی دومی نداشتند.
 */

/** جدول‌هایی که در پشتیبان می‌آیند (فقط خواندن) */
export const BACKUP_TABLES: Array<{ table: string; label: string }> = [
  { table: 'projects', label: 'پروژه‌ها' },
  { table: 'tickets', label: 'تیکت‌ها' },
  { table: 'sales_bookings', label: 'رزروهای فروش' },
  { table: 'material_requests', label: 'درخواست‌های متریال' },
  { table: 'profiles', label: 'پرسنل' },
  { table: 'installation_teams', label: 'اکیپ‌ها' },
  { table: 'team_members', label: 'اعضای اکیپ‌ها' },
  { table: 'schedule_change_requests', label: 'درخواست‌های تغییر برنامه' },
  { table: 'talaie_sync', label: 'تنظیمات' },
  { table: 'project_audit', label: 'تاریخچه‌ی تغییرات پروژه‌ها' },
];

export interface BackupTableResult {
  table: string;
  label: string;
  status: 'ok' | 'missing' | 'failed';
  count: number;
  message?: string;
}

export interface BackupFile {
  format: 'talaie-server-backup';
  version: 1;
  exportedAt: string;
  exportedBy: string | null;
  appVersion: string | null;
  tables: Record<string, any[]>;
  summary: BackupTableResult[];
}

export interface PhotoRef {
  /** مسیر فایل در فضای ابری talaie-photos */
  path: string;
  projectId?: string;
  /** فیلدی که عکس در آن آمده (beforePhotos، customerSignature، …) */
  field: string;
  /** جدولی که ارجاع از آن آمده */
  table: string;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const RAW_PATH = /^[a-z][\w-]*\/[^\s?#]+$/i;
const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/talaie-photos\/([^?#\s]+)/i;

/** مسیر فضای ابری از یک مقدار (مسیر خام یا آدرس کامل)؛ در غیر این صورت null */
export function storagePathOf(value: string): string | null {
  if (!value || typeof value !== 'string' || value.length > 600) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return null;
  const url = value.match(STORAGE_URL);
  if (url) {
    try {
      const p = decodeURIComponent(url[1]);
      return IMAGE_EXT.test(p) ? p : null;
    } catch {
      return null;
    }
  }
  if (/^https?:/i.test(value)) return null;
  return RAW_PATH.test(value) && IMAGE_EXT.test(value) ? value : null;
}

/**
 * همه‌ی عکس‌ها و امضاهایی که در اطلاعات به آن‌ها اشاره شده (هر مسیر یک بار).
 * عکس پروژه‌ها اول می‌آید تا اگر کاربر وسط کار لغو کرد، مهم‌ترها گرفته شده باشند.
 */
export function collectPhotoRefs(tables: Record<string, any[]>): PhotoRef[] {
  const seen = new Map<string, PhotoRef>();
  const walk = (value: unknown, ctx: { table: string; projectId?: string; field: string }, depth: number) => {
    if (depth > 12 || value == null) return;
    if (typeof value === 'string') {
      const path = storagePathOf(value);
      if (path && !seen.has(path)) seen.set(path, { path, projectId: ctx.projectId, field: ctx.field, table: ctx.table });
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, ctx, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, { ...ctx, field: depth <= 1 ? k : ctx.field }, depth + 1);
      }
    }
  };
  const order = ['projects', ...Object.keys(tables).filter((t) => t !== 'projects')];
  for (const table of order) {
    for (const row of tables[table] || []) {
      const data = row && typeof row === 'object' && row.data && typeof row.data === 'object' ? row.data : row;
      const projectId =
        table === 'projects'
          ? String(row?.id ?? data?.id ?? '')
          : (data?.projectId as string | undefined) || (row?.project_id as string | undefined) || undefined;
      walk(data, { table, projectId: projectId || undefined, field: table }, 0);
    }
  }
  // عکس‌هایی که مسیرشان پروژه را مشخص می‌کند ولی از جای دیگری پیدا شده‌اند
  for (const ref of seen.values()) {
    if (!ref.projectId) {
      const m = ref.path.match(/^projects\/([^/]+)\//);
      if (m) ref.projectId = m[1];
    }
  }
  return [...seen.values()];
}

const FIELD_FOLDERS: Record<string, string> = {
  beforePhotos: 'قبل از نصب',
  afterPhotos: 'بعد از نصب',
  completionPhotos: 'پایان کار',
  customerSignature: 'امضای مشتری',
  proposalImages: 'پروپوزال',
  dailyLogs: 'گزارش روزانه',
  stuckIncidents: 'توقف',
  unavailabilityPhotos: 'عدم حضور مشتری',
  siteReadiness: 'آمادگی بستر',
  measurement: 'اندازه‌گیری',
  tickets: 'تیکت',
  sales_bookings: 'رزرو فروش',
};

/** نام مجاز برای پوشه/فایل در ویندوز */
export function safeName(text: string, max = 60): string {
  const cleaned = String(text || '')
    // oxlint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return (cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned) || 'بدون نام';
}

/** مسیر هر عکس داخل فایل ZIP: «عکس‌ها/PRJ-1048 - خانم میثمی/قبل از نصب/xxx.jpg» */
export function zipPathFor(ref: PhotoRef, projectLabel: (id: string) => string | null): string {
  const file = safeName(ref.path.split('/').pop() || 'photo.jpg', 120);
  const folder = FIELD_FOLDERS[ref.field] || safeName(ref.field, 40);
  if (ref.projectId) {
    const label = projectLabel(ref.projectId);
    return `عکس‌ها/${safeName(label || ref.projectId, 80)}/${folder}/${file}`;
  }
  if (ref.table === 'sales_bookings') return `عکس‌ها/رزروهای فروش/${safeName(ref.path.split('/')[1] || 'رزرو', 60)}/${file}`;
  return `عکس‌ها/سایر/${ref.path.split('/').slice(0, -1).map((p) => safeName(p, 60)).join('/')}/${file}`;
}

/** برچسب پروژه برای نام پوشه: «PRJ-1048 - خانم میثمی» */
export function projectLabelFromRow(row: any): string | null {
  const d = row?.data && typeof row.data === 'object' ? row.data : row;
  if (!d) return null;
  const code = d.code || d.projectCode || '';
  const title = d.title || d.customerName || '';
  const label = [code, title].filter(Boolean).join(' - ');
  return label || null;
}

/** آیا پروژه در N روز اخیر تغییر کرده یا ساخته شده (برای پشتیبان عکس‌های اخیر) */
export function projectTouchedSince(row: any, sinceIso: string): boolean {
  const d = row?.data && typeof row.data === 'object' ? row.data : row;
  const dates = [row?.updated_at, d?.updatedAt, d?.createdAt, d?.scheduledDate, d?.completedAt].filter(Boolean).map(String);
  return dates.some((x) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? x >= sinceIso.slice(0, 10) : x >= sinceIso));
}

// ---- اجرای پشتیبان (وابستگی‌ها تزریق می‌شوند تا تست‌پذیر باشد) ----

export type FetchTable = (
  table: string
) => Promise<{ status: 'ok'; rows: any[] } | { status: 'missing' } | { status: 'failed'; message: string }>;

/** همه‌ی جدول‌ها را می‌خواند؛ اگر خود جدول پروژه‌ها خوانده نشود، خطا می‌دهد (پشتیبان بی‌ارزش است) */
export async function collectServerBackup(
  fetchTable: FetchTable,
  meta: { exportedBy: string | null; appVersion: string | null; now?: Date },
  onTable?: (label: string, index: number, total: number) => void
): Promise<BackupFile> {
  const tables: Record<string, any[]> = {};
  const summary: BackupTableResult[] = [];
  for (let i = 0; i < BACKUP_TABLES.length; i++) {
    const { table, label } = BACKUP_TABLES[i];
    onTable?.(label, i, BACKUP_TABLES.length);
    const res = await fetchTable(table);
    if (res.status === 'ok') {
      tables[table] = res.rows;
      summary.push({ table, label, status: 'ok', count: res.rows.length });
    } else if (res.status === 'missing') {
      summary.push({ table, label, status: 'missing', count: 0 });
    } else {
      summary.push({ table, label, status: 'failed', count: 0, message: res.message });
      if (table === 'projects') throw new Error(`خواندن پروژه‌ها از سرور ممکن نشد: ${res.message}`);
    }
  }
  return {
    format: 'talaie-server-backup',
    version: 1,
    exportedAt: (meta.now || new Date()).toISOString(),
    exportedBy: meta.exportedBy,
    appVersion: meta.appVersion,
    tables,
    summary,
  };
}

export interface PhotoZipResult {
  ok: number;
  failed: Array<{ path: string; error: string }>;
  bytes: number;
  cancelled: boolean;
  /** متن فهرست عکس‌ها (CSV) */
  listCsv: string;
}

interface ZipLike {
  file(name: string, data: Blob | string, options?: { binary?: boolean; compression?: 'STORE' | 'DEFLATE' }): unknown;
}

/** عکس‌ها را با چند دانلود هم‌زمان می‌گیرد و در ZIP می‌گذارد؛ عکس ناموفق کل کار را متوقف نمی‌کند */
export async function addPhotosToZip(
  zip: ZipLike,
  refs: PhotoRef[],
  download: (path: string) => Promise<Blob>,
  projectLabel: (id: string) => string | null,
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void; shouldStop?: () => boolean } = {}
): Promise<PhotoZipResult> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const failed: Array<{ path: string; error: string }> = [];
  const usedNames = new Set<string>();
  const lines: string[] = [csvLine(['مسیر در سرور', 'مسیر در این فایل', 'پروژه', 'بخش', 'نتیجه'])];
  let ok = 0;
  let bytes = 0;
  let done = 0;
  let next = 0;
  let cancelled = false;

  const worker = async () => {
    while (next < refs.length) {
      if (opts.shouldStop?.()) {
        cancelled = true;
        return;
      }
      const ref = refs[next++];
      let name = zipPathFor(ref, projectLabel);
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf('.');
        let n = 2;
        while (usedNames.has(`${name.slice(0, dot)}-${n}${name.slice(dot)}`)) n++;
        name = `${name.slice(0, dot)}-${n}${name.slice(dot)}`;
      }
      usedNames.add(name);
      const label = ref.projectId ? projectLabel(ref.projectId) || ref.projectId : '';
      try {
        let blob: Blob | null = null;
        let lastErr: unknown = null;
        for (let attempt = 0; attempt < 2 && !blob; attempt++) {
          try {
            blob = await download(ref.path);
          } catch (e) {
            lastErr = e;
          }
        }
        if (!blob) throw lastErr || new Error('دریافت نشد');
        zip.file(name, blob, { binary: true, compression: 'STORE' });
        ok++;
        bytes += blob.size || 0;
        lines.push(csvLine([ref.path, name, label, ref.field, 'دریافت شد']));
      } catch (e: any) {
        const error = String(e?.message || e || 'خطا');
        failed.push({ path: ref.path, error });
        lines.push(csvLine([ref.path, '', label, ref.field, `دریافت نشد: ${error}`]));
      }
      done++;
      opts.onProgress?.(done, refs.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, refs.length || 1) }, worker));
  return { ok, failed, bytes, cancelled, listCsv: '\uFEFF' + lines.join('\r\n') };
}

export function csvLine(cells: Array<string | number | null | undefined>): string {
  return cells
    .map((c) => {
      const v = c == null ? '' : String(c);
      return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    })
    .join(',');
}

// ---- آخرین پشتیبان (روی همین دستگاه) ----

const LAST_BACKUP_KEY = 'talaie_last_server_backup_v1';

export interface LastBackupInfo {
  at: string;
  withPhotos: boolean;
  projects: number;
  photos?: number;
}

export function getLastBackup(): LastBackupInfo | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as LastBackupInfo) : null;
  } catch {
    return null;
  }
}

export function setLastBackup(info: LastBackupInfo): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify(info));
  } catch {
    /* ignore */
  }
}

/** چند روز از آخرین پشتیبان گذشته؛ null یعنی هیچ‌وقت */
export function backupAgeDays(info: LastBackupInfo | null, now = Date.now()): number | null {
  if (!info?.at) return null;
  const t = Date.parse(info.at);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / (24 * 3600 * 1000)));
}

/** یادآوری لازم است: هیچ‌وقت پشتیبان نگرفته یا بیش از 7 روز گذشته */
export function backupIsDue(info: LastBackupInfo | null, now = Date.now(), maxDays = 7): boolean {
  const age = backupAgeDays(info, now);
  return age === null || age >= maxDays;
}
