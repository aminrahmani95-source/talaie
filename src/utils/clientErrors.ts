import type { ClientErrorReport } from './supabase';
import { formatJalaliDateTime } from './jalali';
import { getUserRoleLabel } from './roleLabels';

/** نام فارسی بخش‌هایی که خطا در آن‌ها رخ داده */
const CONTEXT_LABELS: Record<string, string> = {
  UPLOAD_PHOTO: 'آپلود عکس',
  UPLOAD_PHOTO_DIRECT: 'آپلود عکس',
  UPLOAD_SIGNATURE_DIRECT: 'آپلود امضای مشتری',
  UPLOAD_PROPOSAL: 'آپلود پروپوزال',
  PHOTO_PREPARE: 'آماده‌سازی عکس در گوشی',
  SYNC_CHECK_PROJECT: 'بررسی پروژه روی سرور',
  SYNC_PATCH_PROJECT: 'ثبت تغییر پروژه',
  SYNC_CREATE_PROJECT: 'ثبت پروژه‌ی جدید',
  SYNC_CREATE_TICKET: 'ثبت تیکت',
  SYNC_PATCH_TICKET: 'ثبت تغییر تیکت',
  SYNC_CREATE_MATERIAL_REQUEST: 'ثبت درخواست متریال',
  SYNC_PATCH_MATERIAL_REQUEST: 'ثبت تغییر درخواست متریال',
  BLOCKED_PATCH_PROJECT: 'تغییر غیرمجاز (در گوشی رد شد)',
  APP_ERROR: 'خطای برنامه',
  APP_UNHANDLED: 'خطای برنامه',
};

export function contextLabel(context: string): string {
  if (CONTEXT_LABELS[context]) return CONTEXT_LABELS[context];
  if (context.startsWith('LOCAL_SAVE')) return 'ذخیره در حافظه‌ی گوشی';
  if (context.startsWith('SYNC_')) return 'ارسال به سرور';
  return context;
}

/** گروه بخش‌ها برای فیلتر: عکس‌ها، ارسال تغییرات، سایر */
export type ErrorGroup = 'PHOTO' | 'SYNC' | 'OTHER';

export function errorGroup(context: string): ErrorGroup {
  if (context.startsWith('UPLOAD') || context === 'PHOTO_PREPARE') return 'PHOTO';
  if (context.startsWith('SYNC') || context.startsWith('LOCAL_SAVE') || context.startsWith('BLOCKED')) return 'SYNC';
  return 'OTHER';
}

/** «اندروید · Chrome» یا «آیفون · Safari» از روی مشخصات مرورگر */
export function deviceSummary(ua?: string | null): string {
  if (!ua) return '—';
  let os = 'نامشخص';
  const android = ua.match(/Android\s([\d.]+)/);
  const ios = ua.match(/(?:iPhone|iPad).*?OS\s([\d_]+)/);
  if (android) os = `اندروید ${android[1].split('.')[0]}`;
  else if (ios) os = `آیفون iOS ${ios[1].split('_')[0]}`;
  else if (/Windows/.test(ua)) os = 'ویندوز';
  else if (/Mac OS X/.test(ua)) os = 'مک';
  let browser = '';
  if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/EdgA?\//.test(ua)) browser = 'Edge';
  else if (/FxiOS|Firefox/.test(ua)) browser = 'Firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return browser ? `${os} · ${browser}` : os;
}

/** توضیح ساده‌ی علت احتمالی خطا برای مدیر (نه برنامه‌نویس) */
export function explainError(r: Pick<ClientErrorReport, 'context' | 'message' | 'details'>): string {
  const m = `${r.message} ${JSON.stringify(r.details || {})}`.toLowerCase();
  // فقط خود متن خطا؛ در جزئیات نام فیلدهایی مثل workSessions هست که با «session» اشتباه گرفته می‌شد
  const msg = String(r.message || '').toLowerCase();
  if (/پروژه مورد نظر یافت نشد|project not found|تغییر کرده یا حذف شده/.test(msg)) {
    return 'این پروژه دیگر روی سرور نیست (حذف شده است)، ولی گوشی هنوز فهرست قدیمی را نشان می‌داد. این کار ثبت نشد و برنامه بلافاصله فهرست را از سرور تازه کرد؛ کار دیگری لازم نیست.';
  }
  if (/فقط سرپرست این پروژه/.test(m)) {
    return 'این کار را فقط سرپرست همان پروژه می‌تواند انجام دهد؛ تکنسین‌ها فقط ثبت ایراد و درخواست متریال دارند (احتمالاً نسخه‌ی قدیمی برنامه روی گوشی است).';
  }
  if (/row-level security|violates row|42501|permission denied|unauthorized|غیرمجاز|دسترسی/.test(m)) {
    return 'سرور اجازه نداد. معمولاً یعنی این کاربر دیگر به این پروژه دسترسی ندارد (مثلاً پروژه به اکیپ دیگری منتقل شده) یا نقشش اجازه‌ی این کار را ندارد.';
  }
  if (/jwt|token|session|refresh/.test(msg)) return 'نشست کاربر منقضی شده بود. یک بار خروج و ورود دوباره معمولاً درستش می‌کند.';
  if (/quota|quotaexceeded|storage is full|حافظه/.test(m)) return 'حافظه‌ی مرورگر گوشی پر است. باید فضای گوشی یا داده‌های مرورگر خالی شود.';
  if (/payload too large|413|entity too large|maximum allowed size|exceeded the maximum/.test(m)) return 'حجم عکس بیش از حد مجاز سرور بود.';
  if (/مهلت زمانی|timeout|timed out|aborterror/.test(m)) return 'آپلود در زمان مجاز تمام نشد؛ اینترنت گوشی کند بوده است.';
  if (/failed to fetch|networkerror|network request failed|load failed|err_|internet|شبکه/.test(m)) {
    return 'اتصال گوشی به سرور قطع شد (اینترنت ضعیف، قطعی یا فیلترشکن). برنامه خودش دوباره تلاش می‌کند.';
  }
  if (/فرمت|decode|heic|read failed|قابل خواندن/.test(m)) return 'عکس با فرمتی بود که گوشی نتوانست بخواند؛ عکس‌گرفتن با دکمه‌ی «دوربین» معمولاً درستش می‌کند.';
  if (/base64|رشته خالی/.test(m)) return 'عکسی در صف بود که هنوز آپلود نشده بود؛ برنامه آن را نفرستاد تا خراب ثبت نشود.';
  if (/duplicate|already exists/.test(m)) return 'این عکس قبلاً آپلود شده بود (بی‌خطر).';
  return '';
}

export interface ErrorUserSummary {
  key: string;
  name: string;
  role: string;
  count: number;
  photoCount: number;
  lastAt: string;
}

export function summarizeByUser(rows: ClientErrorReport[]): ErrorUserSummary[] {
  const map = new Map<string, ErrorUserSummary>();
  for (const r of rows) {
    const key = r.user_id || r.user_name || '?';
    const cur = map.get(key) || {
      key,
      name: r.user_name || 'نامشخص',
      role: getUserRoleLabel(r.user_role || undefined),
      count: 0,
      photoCount: 0,
      lastAt: r.created_at,
    };
    cur.count += 1;
    if (errorGroup(r.context) === 'PHOTO') cur.photoCount += 1;
    if (r.created_at > cur.lastAt) cur.lastAt = r.created_at;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

/** جزئیات مهم به شکل یک خط کوتاه */
export function detailsLine(details: Record<string, any> | null | undefined): string {
  if (!details) return '';
  const parts: string[] = [];
  if (details.kb != null) parts.push(`${details.kb}KB`);
  if (details.type) parts.push(String(details.type));
  if (details.status) parts.push(`HTTP ${details.status}`);
  if (details.code) parts.push(`code ${details.code}`);
  const dev = details.device || {};
  if (dev.online === false) parts.push('آفلاین');
  if (dev.net) parts.push(`شبکه ${dev.net}`);
  if (typeof dev.downlinkMbps === 'number') parts.push(`${dev.downlinkMbps}Mbps`);
  if (details.retry) parts.push(`تلاش ${details.retry}`);
  return parts.join(' · ');
}

/** متن کامل برای کپی و فرستادن به پشتیبانی */
export function reportsToText(
  rows: ClientErrorReport[],
  projectLabel: (id: string, details?: Record<string, any> | null) => string
): string {
  return rows
    .map((r) => {
      const lines = [
        `${formatJalaliDateTime(r.occurred_at || r.created_at)} | ${r.user_name || '?'} (${getUserRoleLabel(r.user_role || undefined)})`,
        `بخش: ${contextLabel(r.context)} [${r.context}]${r.project_id ? ` | پروژه: ${projectLabel(r.project_id, r.details)}` : ''}`,
        `خطا: ${r.message}`,
        `گوشی: ${deviceSummary(r.user_agent)} | نسخه: ${r.app_version || '?'}`,
        `جزئیات: ${JSON.stringify(r.details || {})}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}
