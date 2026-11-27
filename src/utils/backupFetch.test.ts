import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseSyncService } from './supabase';

/** جدول ساختگی: talaie_sync ستون id ندارد؛ جدول بی‌وجود خطای 42P01 می‌دهد */
function fakeClient() {
  return {
    from(table: string) {
      let ordered = '';
      const q: any = {
        select: () => q,
        order: (col: string) => {
          ordered = col;
          return q;
        },
        range: async () => {
          if (table === 'nope') return { data: null, error: { code: '42P01', message: 'relation "public.nope" does not exist' } };
          if (table === 'talaie_sync' && ordered === 'id') {
            return { data: null, error: { code: '42703', message: 'column talaie_sync.id does not exist' } };
          }
          return { data: [{ key: 'settings', value: { companyName: 'x' } }], error: null };
        },
      };
      return q;
    },
  };
}

describe('fetchTableForBackup', () => {
  afterEach(() => vi.restoreAllMocks());

  it('backs up a table without an id column instead of calling it missing', async () => {
    vi.spyOn(SupabaseSyncService, 'getClient').mockReturnValue(fakeClient() as any);
    const res = await SupabaseSyncService.fetchTableForBackup('talaie_sync');
    expect(res.status).toBe('ok');
    expect((res as any).rows).toHaveLength(1);
  });

  it('still reports a table that really does not exist as missing', async () => {
    vi.spyOn(SupabaseSyncService, 'getClient').mockReturnValue(fakeClient() as any);
    const res = await SupabaseSyncService.fetchTableForBackup('nope');
    expect(res.status).toBe('missing');
  });
});
