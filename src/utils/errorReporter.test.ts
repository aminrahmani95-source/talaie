import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetErrorReporterForTests,
  configureErrorReporter,
  describeError,
  flushErrorReports,
  reportClientError,
  sanitizeDetails,
  type ClientErrorRow,
} from './errorReporter';
import { contextLabel, detailsLine, deviceSummary, errorGroup, explainError, summarizeByUser } from './clientErrors';
import type { ClientErrorReport } from './supabase';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

const PENDING = 'talaie_error_reports_pending_v1';

describe('errorReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('localStorage', memoryStorage());
    __resetErrorReporterForTests();
  });
  afterEach(() => {
    __resetErrorReporterForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = (result: 'ok' | 'unavailable' | 'failed' = 'ok') => {
    const sent: ClientErrorRow[][] = [];
    configureErrorReporter({
      getUser: () => ({ name: 'فرخ نقدعلیان', role: 'TECHNICIAN' }),
      send: async (rows) => {
        sent.push(rows);
        return result;
      },
    });
    return sent;
  };

  it('sends a report with user, project and details, then clears the queue', async () => {
    const sent = setup();
    reportClientError({ context: 'UPLOAD_PHOTO', projectId: 'p-1', message: 'Failed to fetch', details: { kb: 180 } });
    await flushErrorReports();
    expect(sent).toHaveLength(1);
    const row = sent[0][0];
    expect(row.user_name).toBe('فرخ نقدعلیان');
    expect(row.user_role).toBe('TECHNICIAN');
    expect(row.project_id).toBe('p-1');
    expect(row.context).toBe('UPLOAD_PHOTO');
    expect(row.details.kb).toBe(180);
    expect(JSON.parse(localStorage.getItem(PENDING) || '[]')).toHaveLength(0);
  });

  it('sends the same error only once per 30 minutes (retry loops do not flood the table)', async () => {
    const sent = setup();
    for (let i = 0; i < 10; i++) {
      reportClientError({ context: 'UPLOAD_PHOTO', projectId: 'p-1', message: 'Failed to fetch' });
    }
    reportClientError({ context: 'UPLOAD_PHOTO', projectId: 'p-2', message: 'Failed to fetch' });
    await flushErrorReports();
    expect(sent.flat()).toHaveLength(2);
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    reportClientError({ context: 'UPLOAD_PHOTO', projectId: 'p-1', message: 'Failed to fetch' });
    await flushErrorReports();
    expect(sent.flat()).toHaveLength(3);
  });

  it('keeps reports on the phone while the server cannot be reached', async () => {
    const sent = setup('failed');
    reportClientError({ context: 'SYNC_PATCH_PROJECT', message: 'timeout' });
    await flushErrorReports();
    expect(sent).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING) || '[]')).toHaveLength(1);
  });

  it('stops trying for the session when the table is missing, but keeps the reports', async () => {
    const sent = setup('unavailable');
    reportClientError({ context: 'UPLOAD_PHOTO', message: 'a' });
    await flushErrorReports();
    await flushErrorReports();
    expect(sent).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(PENDING) || '[]')).toHaveLength(1);
  });

  it('never throws, even with broken input or storage', () => {
    setup();
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => reportClientError({ context: 'X', message: 'y' })).not.toThrow();
    expect(() => reportClientError(undefined as any)).not.toThrow();
  });

  it('removes photos and signatures from details and shortens long text', () => {
    const out = sanitizeDetails({
      photo: 'data:image/jpeg;base64,' + 'A'.repeat(5000),
      list: ['data:image/png;base64,xyz', 'ok'],
      long: 'x'.repeat(1000),
      nested: { sig: 'data:image/png;base64,abc' },
      fn: () => 1,
    });
    expect(out.photo).toMatch(/^\[image \d+ chars\]$/);
    expect((out.list as string[])[0]).toMatch(/^\[image/);
    expect((out.long as string).length).toBeLessThan(400);
    expect((out.nested as any).sig).toMatch(/^\[image/);
    expect('fn' in out).toBe(false);
  });

  it('describes Supabase storage and Postgres errors', () => {
    expect(describeError({ message: 'new row violates row-level security policy', statusCode: '403', error: 'Unauthorized' })).toEqual({
      message: 'new row violates row-level security policy',
      code: 'Unauthorized',
      status: 403,
    });
    expect(describeError('plain').message).toBe('plain');
    expect(describeError(null).message).toBeTruthy();
  });

  it('keeps the project name in the report so it stays readable after the project is deleted', async () => {
    const sent: ClientErrorRow[][] = [];
    configureErrorReporter({
      getUser: () => ({ name: 'فرهاد', role: 'LEAD_TECHNICIAN' }),
      getProjectLabel: (id) => (id === 'p-9' ? 'PRJ-1044 · خانم احمدی' : null),
      send: async (rows) => {
        sent.push(rows);
        return 'ok';
      },
    });
    reportClientError({ context: 'SYNC_PATCH_PROJECT', projectId: 'p-9', message: 'x' });
    reportClientError({ context: 'SYNC_PATCH_PROJECT', projectId: 'p-0', message: 'x' });
    await flushErrorReports();
    const rows = sent.flat();
    expect(rows.find((r) => r.project_id === 'p-9')?.details.projectLabel).toBe('PRJ-1044 · خانم احمدی');
    expect(rows.find((r) => r.project_id === 'p-0')?.details.projectLabel).toBeUndefined();
  });
});

describe('clientErrors (manager view)', () => {
  const row = (over: Partial<ClientErrorReport>): ClientErrorReport => ({
    id: Math.random().toString(36).slice(2),
    created_at: '2026-11-26T10:00:00Z',
    occurred_at: null,
    user_id: 'u1',
    user_name: 'سجاد',
    user_role: 'TECHNICIAN',
    project_id: null,
    context: 'UPLOAD_PHOTO',
    message: 'x',
    details: {},
    app_version: null,
    user_agent: null,
    ...over,
  });

  it('explains common causes in plain Persian', () => {
    expect(explainError(row({ message: 'new row violates row-level security policy' }))).toMatch(/اجازه نداد/);
    expect(explainError(row({ message: 'TypeError: Failed to fetch' }))).toMatch(/اینترنت/);
    expect(explainError(row({ message: 'درخواست به دلیل پایان مهلت زمانی (90 ثانیه) لغو شد.' }))).toMatch(/کند/);
    expect(explainError(row({ message: 'The object exceeded the maximum allowed size' }))).toMatch(/حجم/);
    expect(explainError(row({ message: 'QuotaExceededError' }))).toMatch(/حافظه/);
    expect(explainError(row({ message: 'something new' }))).toBe('');
  });

  it('explains a deleted project and does not mistake the workSessions field for an expired session', () => {
    const r = row({
      message: 'پروژه مورد نظر یافت نشد: p-1795586073085',
      details: { code: 'P0001', status: 400, fields: ['status', 'beforePhotos', 'workSessions'] },
    });
    expect(explainError(r)).toMatch(/دیگر روی سرور نیست/);
    expect(explainError(r)).not.toMatch(/نشست/);
    expect(explainError(row({ message: 'check failed', details: { fields: ['workSessions'] } }))).toBe('');
    expect(explainError(row({ message: 'JWT expired' }))).toMatch(/نشست/);
  });

  it('shows how long a change waited on the phone before it was sent', () => {
    expect(detailsLine({ waitedMin: 5 })).toBe('');
    expect(detailsLine({ waitedMin: 45 })).toBe('45 دقیقه در صف گوشی مانده بود');
    expect(detailsLine({ waitedMin: 180 })).toBe('3 ساعت در صف گوشی مانده بود');
    expect(detailsLine({ waitedMin: 2 * 1440 + 100 })).toBe('2 روز در صف گوشی مانده بود');
  });

  it('labels sections and groups them', () => {
    expect(contextLabel('UPLOAD_PHOTO')).toBe('آپلود عکس');
    expect(contextLabel('LOCAL_SAVE_PATCH_PROJECT')).toBe('ذخیره در حافظه‌ی گوشی');
    expect(contextLabel('SYNC_SOMETHING_NEW')).toBe('ارسال به سرور');
    expect(errorGroup('PHOTO_PREPARE')).toBe('PHOTO');
    expect(errorGroup('SYNC_PATCH_PROJECT')).toBe('SYNC');
    expect(errorGroup('APP_ERROR')).toBe('OTHER');
  });

  it('recognises phones from the browser string', () => {
    expect(
      deviceSummary('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36')
    ).toBe('اندروید 14 · Chrome');
    expect(
      deviceSummary('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')
    ).toBe('آیفون iOS 17 · Safari');
    expect(deviceSummary(null)).toBe('—');
  });

  it('counts errors per person, photo errors separately', () => {
    const s = summarizeByUser([
      row({ user_id: 'a', user_name: 'الف' }),
      row({ user_id: 'a', user_name: 'الف', context: 'SYNC_PATCH_PROJECT', created_at: '2026-11-26T12:00:00Z' }),
      row({ user_id: 'b', user_name: 'ب' }),
    ]);
    expect(s[0]).toMatchObject({ name: 'الف', count: 2, photoCount: 1, lastAt: '2026-11-26T12:00:00Z' });
    expect(s[1]).toMatchObject({ name: 'ب', count: 1 });
  });
});
