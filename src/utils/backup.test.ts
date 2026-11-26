import { describe, expect, it } from 'vitest';
import {
  addPhotosToZip,
  backupAgeDays,
  backupIsDue,
  collectPhotoRefs,
  collectServerBackup,
  projectLabelFromRow,
  projectTouchedSince,
  safeName,
  storagePathOf,
  zipPathFor,
  BACKUP_TABLES,
} from './backup';

const projectRow = (id: string, data: Record<string, unknown>, updated_at = '2026-11-26T10:00:00Z') => ({
  id,
  updated_at,
  data: { id, ...data },
});

describe('backup: finding photos', () => {
  it('recognises storage paths and storage URLs, ignores base64, links and other text', () => {
    expect(storagePathOf('projects/p-1/abc.jpg')).toBe('projects/p-1/abc.jpg');
    expect(storagePathOf('projects/p-1/signature-x.png')).toBe('projects/p-1/signature-x.png');
    expect(
      storagePathOf('https://x.supabase.co/storage/v1/object/sign/talaie-photos/bookings/b1/z.jpg?token=abc')
    ).toBe('bookings/b1/z.jpg');
    expect(storagePathOf('data:image/jpeg;base64,AAAA')).toBeNull();
    expect(storagePathOf('https://nshn.ir/abc')).toBeNull();
    expect(storagePathOf('نوریان https://nshn.ir/sbv1vtVxRLDH')).toBeNull();
    expect(storagePathOf('projects/p-1/notes.txt')).toBeNull();
    expect(storagePathOf('just text')).toBeNull();
  });

  it('collects every photo once, with its project and the section it belongs to', () => {
    const refs = collectPhotoRefs({
      projects: [
        projectRow('p-1', {
          code: 'PRJ-1048',
          beforePhotos: ['projects/p-1/a.jpg'],
          afterPhotos: ['projects/p-1/b.jpg', 'projects/p-1/a.jpg'],
          customerSignature: 'projects/p-1/signature-s.png',
          dailyLogs: [{ date: '2026-11-26', photos: ['projects/p-1/d.jpg'] }],
          stuckIncidents: [{ photos: ['projects/p-1/s1.jpg'] }],
          locationUrl: 'https://nshn.ir/x',
        }),
      ],
      sales_bookings: [{ id: 'b1', data: { proposalImages: ['bookings/b1/prop.jpg'] } }],
      tickets: [{ id: 't1', data: { projectId: 'p-1', photos: ['tickets/t1/t.jpg'] } }],
    });
    const byPath = Object.fromEntries(refs.map((r) => [r.path, r]));
    expect(refs).toHaveLength(7);
    expect(byPath['projects/p-1/a.jpg']).toMatchObject({ projectId: 'p-1', field: 'beforePhotos' });
    expect(byPath['projects/p-1/b.jpg'].field).toBe('afterPhotos');
    expect(byPath['projects/p-1/signature-s.png'].field).toBe('customerSignature');
    expect(byPath['projects/p-1/d.jpg'].field).toBe('dailyLogs');
    expect(byPath['projects/p-1/s1.jpg'].field).toBe('stuckIncidents');
    expect(byPath['bookings/b1/prop.jpg']).toMatchObject({ table: 'sales_bookings', projectId: undefined });
    expect(byPath['tickets/t1/t.jpg']).toMatchObject({ table: 'tickets', projectId: 'p-1' });
  });

  it('names files inside the zip by project and section, safe for Windows', () => {
    const label = (id: string) => (id === 'p-1' ? 'PRJ-1048 - خانم میثمی' : null);
    expect(zipPathFor({ path: 'projects/p-1/a.jpg', projectId: 'p-1', field: 'beforePhotos', table: 'projects' }, label)).toBe(
      'عکس‌ها/PRJ-1048 - خانم میثمی/قبل از نصب/a.jpg'
    );
    expect(zipPathFor({ path: 'bookings/b1/x.jpg', field: 'proposalImages', table: 'sales_bookings' }, label)).toBe(
      'عکس‌ها/رزروهای فروش/b1/x.jpg'
    );
    expect(safeName('a/b:c*?"<>|. ')).toBe('a b c');
    expect(projectLabelFromRow(projectRow('p', { code: 'PRJ-1', title: 'ولنجک' }))).toBe('PRJ-1 - ولنجک');
  });
});

describe('backup: reading the server', () => {
  it('reads every table, notes missing ones and keeps going', async () => {
    const seen: string[] = [];
    const backup = await collectServerBackup(
      async (t) => {
        seen.push(t);
        if (t === 'schedule_change_requests') return { status: 'missing' };
        if (t === 'project_audit') return { status: 'failed', message: 'timeout' };
        return { status: 'ok', rows: t === 'projects' ? [projectRow('p-1', {})] : [] };
      },
      { exportedBy: 'امین', appVersion: 'index-X' }
    );
    expect(seen).toEqual(BACKUP_TABLES.map((t) => t.table));
    expect(backup.tables.projects).toHaveLength(1);
    expect(backup.summary.find((s) => s.table === 'schedule_change_requests')?.status).toBe('missing');
    expect(backup.summary.find((s) => s.table === 'project_audit')).toMatchObject({ status: 'failed', message: 'timeout' });
    expect(backup.format).toBe('talaie-server-backup');
  });

  it('fails loudly when the projects themselves cannot be read', async () => {
    await expect(
      collectServerBackup(async () => ({ status: 'failed', message: 'network' }), { exportedBy: null, appVersion: null })
    ).rejects.toThrow(/پروژه/);
  });
});

describe('backup: photos into the zip', () => {
  const refs = [
    { path: 'projects/p-1/a.jpg', projectId: 'p-1', field: 'beforePhotos', table: 'projects' },
    { path: 'projects/p-1/b.jpg', projectId: 'p-1', field: 'beforePhotos', table: 'projects' },
    { path: 'projects/p-1/bad.jpg', projectId: 'p-1', field: 'afterPhotos', table: 'projects' },
  ];

  it('keeps going when one photo fails, retries once, and lists everything', async () => {
    const files: Record<string, unknown> = {};
    const attempts: Record<string, number> = {};
    const res = await addPhotosToZip(
      { file: (name, data) => (files[name] = data) },
      refs,
      async (path) => {
        attempts[path] = (attempts[path] || 0) + 1;
        if (path.includes('bad')) throw new Error('404');
        return new Blob(['x'.repeat(10)]);
      },
      () => 'PRJ-1',
      { concurrency: 2 }
    );
    expect(res.ok).toBe(2);
    expect(res.failed).toEqual([{ path: 'projects/p-1/bad.jpg', error: '404' }]);
    expect(attempts['projects/p-1/bad.jpg']).toBe(2);
    expect(Object.keys(files).sort()).toEqual(['عکس‌ها/PRJ-1/قبل از نصب/a.jpg', 'عکس‌ها/PRJ-1/قبل از نصب/b.jpg']);
    expect(res.bytes).toBe(20);
    expect(res.listCsv.split('\r\n')).toHaveLength(4);
    expect(res.listCsv).toContain('دریافت نشد: 404');
  });

  it('stops when asked', async () => {
    let n = 0;
    const res = await addPhotosToZip({ file: () => undefined }, refs, async () => new Blob(['x']), () => null, {
      concurrency: 1,
      shouldStop: () => n++ >= 1,
    });
    expect(res.cancelled).toBe(true);
    expect(res.ok).toBe(1);
  });

  it('does not overwrite two different photos with the same file name', async () => {
    const files: string[] = [];
    await addPhotosToZip(
      { file: (name) => void files.push(name) },
      [
        { path: 'projects/p-1/x.jpg', projectId: 'p-1', field: 'beforePhotos', table: 'projects' },
        { path: 'tickets/p-1/x.jpg', projectId: 'p-1', field: 'beforePhotos', table: 'tickets' },
      ],
      async () => new Blob(['x']),
      () => 'PRJ'
    );
    expect(new Set(files).size).toBe(2);
  });
});

describe('backup: reminder', () => {
  const now = Date.parse('2026-11-27T10:00:00Z');
  it('is due when never taken or older than 7 days', () => {
    expect(backupIsDue(null, now)).toBe(true);
    expect(backupAgeDays({ at: '2026-11-25T10:00:00Z', withPhotos: false, projects: 1 }, now)).toBe(2);
    expect(backupIsDue({ at: '2026-11-25T10:00:00Z', withPhotos: false, projects: 1 }, now)).toBe(false);
    expect(backupIsDue({ at: '2026-11-19T10:00:00Z', withPhotos: false, projects: 1 }, now)).toBe(true);
  });

  it('picks recently touched projects for the 30-day photo backup', () => {
    const since = '2026-10-28T10:00:00Z';
    expect(projectTouchedSince(projectRow('a', {}, '2026-11-26T10:00:00Z'), since)).toBe(true);
    expect(projectTouchedSince(projectRow('b', { scheduledDate: '2026-12-01' }, '2026-01-01T00:00:00Z'), since)).toBe(true);
    expect(projectTouchedSince(projectRow('c', { createdAt: '2026-01-01T00:00:00Z' }, '2026-01-02T00:00:00Z'), since)).toBe(false);
  });
});
