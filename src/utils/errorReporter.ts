/**
 * گزارش خودکار خطاهای گوشی‌ها به سرور (جدول client_error_reports، مایگریشن ۰۲۶).
 *
 * چرا: خطای آپلود عکس فقط روی گوشی سرپرست دیده می‌شد. حالا هر خطای آپلود، ارسال تغییرات،
 * آماده‌سازی عکس یا ذخیره‌ی محلی با متن خطا، پروژه و مشخصات گوشی ثبت می‌شود و مدیر QC
 * آن را در «موانع ← خطاهای برنامه» می‌بیند.
 *
 * قواعد:
 * - هیچ‌وقت خطا پرتاب نمی‌کند و کار اصلی را کند نمی‌کند.
 * - خطای تکراری (همان بخش + پروژه + متن) هر ۳۰ دقیقه فقط یک بار فرستاده می‌شود؛ صف ارسال
 *   دوباره‌ی آفلاین هر چند ثانیه همان خطا را تکرار می‌کند.
 * - اگر اینترنت نباشد، گزارش در گوشی می‌ماند و بعداً فرستاده می‌شود (خطا معمولاً همان وقتی
 *   رخ می‌دهد که اینترنت ضعیف است).
 * - عکس و امضا (data:) هرگز در گزارش نمی‌رود.
 */

export interface ClientErrorInput {
  /** بخش برنامه، مثل UPLOAD_PHOTO یا SYNC_PATCH_PROJECT */
  context: string;
  message: string;
  projectId?: string | null;
  details?: Record<string, unknown>;
}

export interface ClientErrorRow {
  occurred_at: string;
  user_name: string | null;
  user_role: string | null;
  project_id: string | null;
  context: string;
  message: string;
  details: Record<string, unknown>;
  app_version: string | null;
  user_agent: string | null;
}

/** نتیجه‌ی ارسال: unavailable یعنی جدول روی سرور هنوز ساخته نشده (مایگریشن ۰۲۶ اجرا نشده) */
export type ErrorSendResult = 'ok' | 'unavailable' | 'failed';

interface ReporterConfig {
  send: (rows: ClientErrorRow[]) => Promise<ErrorSendResult>;
  getUser: () => { name?: string | null; role?: string | null } | null;
  /** کد و عنوان پروژه از نسخه‌ی روی همین گوشی (اگر بعداً حذف شود، گزارش هنوز خوانا بماند) */
  getProjectLabel?: (projectId: string) => string | null;
}

const PENDING_KEY = 'talaie_error_reports_pending_v1';
const SENT_KEY = 'talaie_error_reports_sent_v1';
const DEDUPE_MS = 30 * 60 * 1000;
const MAX_PER_DAY = 40;
const MAX_PENDING = 25;
const MAX_MESSAGE = 1000;
const MAX_STRING = 300;

let config: ReporterConfig | null = null;
let disabledForSession = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let listenersInstalled = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* حافظه پر است؛ گزارش از دست می‌رود ولی برنامه کار می‌کند */
  }
}

/** متن، کد و وضعیت هر نوع خطایی (Error، خطای Supabase، رشته) */
export function describeError(err: unknown): { message: string; code?: string; status?: number; name?: string } {
  if (err == null) return { message: 'خطای نامشخص' };
  if (typeof err === 'string') return { message: err };
  const e = err as any;
  const message = String(e.message || e.error_description || e.error || e.msg || e.toString?.() || 'خطای نامشخص');
  const out: { message: string; code?: string; status?: number; name?: string } = { message };
  const code = e.code ?? e.error;
  if (code != null && String(code) !== message) out.code = String(code);
  const status = Number(e.statusCode ?? e.status);
  if (Number.isFinite(status) && status > 0) out.status = status;
  if (e.name && e.name !== 'Error') out.name = String(e.name);
  return out;
}

/** عکس، امضا و متن‌های خیلی بلند از جزئیات حذف یا کوتاه می‌شوند */
export function sanitizeDetails(details: Record<string, unknown> | undefined, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!details || typeof details !== 'object') return out;
  let n = 0;
  for (const [key, value] of Object.entries(details)) {
    if (n++ >= 30) break;
    if (value === undefined || typeof value === 'function') continue;
    if (typeof value === 'string') {
      if (value.startsWith('data:')) {
        out[key] = `[image ${value.length} chars]`;
      } else {
        out[key] = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
      }
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 20).map((v) =>
        typeof v === 'string'
          ? v.startsWith('data:')
            ? `[image ${v.length} chars]`
            : v.slice(0, MAX_STRING)
          : v && typeof v === 'object' && depth < 2
          ? sanitizeDetails(v as Record<string, unknown>, depth + 1)
          : v
      );
    } else if (value && typeof value === 'object') {
      out[key] = depth < 2 ? sanitizeDetails(value as Record<string, unknown>, depth + 1) : '[object]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

function deviceInfo(): Record<string, unknown> {
  if (typeof navigator === 'undefined') return {};
  const conn = (navigator as any).connection;
  const info: Record<string, unknown> = { online: navigator.onLine };
  if (conn) {
    if (conn.effectiveType) info.net = conn.effectiveType;
    if (typeof conn.downlink === 'number') info.downlinkMbps = conn.downlink;
    if (typeof conn.rtt === 'number') info.rttMs = conn.rtt;
    if (conn.saveData) info.saveData = true;
  }
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) info.installedApp = true;
  } catch {
    /* ignore */
  }
  return info;
}

/** نسخه‌ی برنامه = نام فایل اصلی ساخته‌شده (مثل index-DUsmQKMD)؛ هر انتشار نام تازه دارد */
function appVersion(): string | null {
  try {
    const el = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null;
    const m = el?.src.match(/index-[\w-]+/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

function fingerprint(input: ClientErrorInput): string {
  return `${input.context}|${input.projectId || ''}|${input.message.slice(0, 200)}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * یک خطا را ثبت می‌کند. همیشه فوراً برمی‌گردد و هیچ‌وقت خطا نمی‌دهد.
 */
export function reportClientError(input: ClientErrorInput): void {
  try {
    if (!input || !input.context || !input.message) return;
    if (disabledForSession) return;
    const now = Date.now();

    const sent = readJson<{ day: string; count: number; recent: Record<string, number> }>(SENT_KEY, {
      day: todayKey(),
      count: 0,
      recent: {},
    });
    if (sent.day !== todayKey()) {
      sent.day = todayKey();
      sent.count = 0;
    }
    for (const [k, t] of Object.entries(sent.recent)) {
      if (now - t > DEDUPE_MS) delete sent.recent[k];
    }
    const fp = fingerprint(input);
    if (sent.recent[fp]) return;
    if (sent.count >= MAX_PER_DAY) return;
    sent.recent[fp] = now;
    sent.count += 1;
    writeJson(SENT_KEY, sent);

    const user = config?.getUser() || null;
    let projectLabel: string | null = null;
    if (input.projectId && config?.getProjectLabel) {
      try {
        projectLabel = config.getProjectLabel(input.projectId);
      } catch {
        projectLabel = null;
      }
    }
    const message = input.message.length > MAX_MESSAGE ? `${input.message.slice(0, MAX_MESSAGE)}…` : input.message;
    const row: ClientErrorRow = {
      occurred_at: new Date(now).toISOString(),
      user_name: user?.name || null,
      user_role: user?.role || null,
      project_id: input.projectId || null,
      context: input.context.slice(0, 80),
      message,
      details: {
        ...sanitizeDetails(input.details),
        ...(projectLabel ? { projectLabel: projectLabel.slice(0, 120) } : {}),
        device: deviceInfo(),
      },
      app_version: appVersion(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
    };

    const pending = readJson<ClientErrorRow[]>(PENDING_KEY, []);
    pending.push(row);
    writeJson(PENDING_KEY, pending.slice(-MAX_PENDING));
    scheduleFlush(1500);
  } catch {
    /* گزارش خطا هرگز نباید خودش برنامه را خراب کند */
  }
}

function scheduleFlush(delay: number) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushErrorReports();
  }, delay);
}

/** گزارش‌های مانده در گوشی را به سرور می‌فرستد */
export async function flushErrorReports(): Promise<void> {
  if (!config || flushing || disabledForSession) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const pending = readJson<ClientErrorRow[]>(PENDING_KEY, []);
  if (pending.length === 0) return;
  flushing = true;
  try {
    const batch = pending.slice(0, 10);
    const result = await config.send(batch);
    if (result === 'ok') {
      const rest = readJson<ClientErrorRow[]>(PENDING_KEY, []).slice(batch.length);
      writeJson(PENDING_KEY, rest);
      if (rest.length > 0) scheduleFlush(2000);
    } else if (result === 'unavailable') {
      // جدول هنوز روی سرور نیست: گزارش‌ها در گوشی می‌مانند تا بعد از اجرای مایگریشن فرستاده شوند
      disabledForSession = true;
    }
  } catch {
    /* دفعه‌ی بعد */
  } finally {
    flushing = false;
  }
}

export function configureErrorReporter(next: ReporterConfig): void {
  config = next;
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;
  try {
    window.addEventListener('online', () => scheduleFlush(3000));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleFlush(3000);
    });
    window.addEventListener('error', (ev) => {
      const msg = ev?.message || '';
      if (!msg || /ResizeObserver loop|Script error\.?$/i.test(msg)) return;
      reportClientError({
        context: 'APP_ERROR',
        message: msg,
        details: { source: (ev.filename || '').split('/').pop(), line: ev.lineno, col: ev.colno },
      });
    });
    window.addEventListener('unhandledrejection', (ev) => {
      const d = describeError(ev?.reason);
      if (d.name === 'AbortError') return;
      reportClientError({ context: 'APP_UNHANDLED', message: d.message, details: { code: d.code, status: d.status, name: d.name } });
    });
  } catch {
    /* ignore */
  }
  scheduleFlush(5000);
}

/** فقط برای تست */
export function __resetErrorReporterForTests() {
  config = null;
  disabledForSession = false;
  flushing = false;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}
