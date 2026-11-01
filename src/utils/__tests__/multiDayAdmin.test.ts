import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { extractUploadsAndDeduplicate, Outbox, OutboxOperation, setNestedValue } from '../offlineQueue';
import { localDateKey } from '../jalali';
import { formatAuditDiff } from '../auditDiff';
import { Project } from '../../types';

const PNG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('multi-day + manager control helpers', () => {
  it('localDateKey uses the device calendar day, not UTC', () => {
    // 00:30 local time on 2 Nov — in Tehran (UTC+3:30) toISOString() would still say 1 Nov
    const d = new Date(2026, 10, 2, 0, 30, 0);
    expect(localDateKey(d)).toBe('2026-11-02');
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('extracts base64 photos nested inside dailyLogs[] and points targets back to them', () => {
    const patch = {
      status: 'PAUSED',
      dailyLogs: [
        { id: 'old', photos: ['projects/p1/already.jpg'] },
        { id: 'new', photos: [PNG, PNG] },
      ],
    };
    const { cleanPayload, uploads } = extractUploadsAndDeduplicate({ id: 'p1', patch }, 'op1', 'project:p1');
    expect(uploads).toHaveLength(1); // same image deduplicated
    expect(uploads[0].targets.map((t) => t.path.join('.'))).toEqual([
      'patch.dailyLogs.1.photos.0',
      'patch.dailyLogs.1.photos.1',
    ]);
    expect(JSON.stringify(cleanPayload)).not.toContain('data:image/');
    expect(cleanPayload.patch.dailyLogs[0].photos[0]).toBe('projects/p1/already.jpg');

    for (const t of uploads[0].targets) setNestedValue(cleanPayload, t.path, 'projects/p1/x.jpg');
    expect(cleanPayload.patch.dailyLogs[1].photos).toEqual(['projects/p1/x.jpg', 'projects/p1/x.jpg']);
  });

  it('pending manager patches never leak _auditReason onto the local project', async () => {
    const server = [{ id: 'p1', status: 'COMPLETED', qcStatus: 'PENDING' } as unknown as Project];
    const ops = [
      {
        id: 'o1',
        type: 'PATCH_PROJECT',
        orderingKey: 'project:p1',
        createdAt: 1,
        payload: { id: 'p1', patch: { status: 'IN_PROGRESS', qcStatus: 'NOT_STARTED', _auditReason: 'اشتباه' } },
      },
    ] as unknown as OutboxOperation[];
    const result = await Outbox.applyPendingToProjects(server, ops);
    expect(result[0].status).toBe('IN_PROGRESS');
    expect('_auditReason' in result[0]).toBe(false);
  });

  it('audit diff describes work sessions and ignores null-vs-undefined noise', () => {
    const base = { status: 'IN_PROGRESS', qcStatus: 'NOT_STARTED' } as Partial<Project>;
    const started = formatAuditDiff(
      { ...base, workSessions: [] },
      { ...base, workSessions: [{ date: '2026-11-02', startedAt: 'a', byUserId: 'u', byUserName: 'علی' }] },
      'UPDATE'
    );
    expect(started).toContain('شروع روز کاری توسط علی');

    const ended = formatAuditDiff(
      { ...base, workSessions: [{ date: '2026-11-02', startedAt: 'a', byUserId: 'u', byUserName: 'علی' }] },
      {
        ...base,
        status: 'PAUSED',
        workSessions: [{ date: '2026-11-02', startedAt: 'a', endedAt: 'b', byUserId: 'u', byUserName: 'علی' }],
      },
      'UPDATE'
    );
    expect(ended).toContain('پایان روز کاری');
    expect(ended.join(' ')).toContain('نیمه‌کاره');

    const noise = formatAuditDiff(
      { ...base, customerSignature: undefined },
      { ...base, customerSignature: null as unknown as string },
      'UPDATE'
    );
    expect(noise.join(' ')).not.toContain('امضا');
  });
});
