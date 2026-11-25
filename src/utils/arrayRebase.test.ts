import { describe, expect, it } from 'vitest';
import { captureArrayBaseline, rebasePatchArrays } from './arrayRebase';

describe('array rebase (keeps list items added by other devices)', () => {
  it('puts back a daily log another device added meanwhile', () => {
    const local = { dailyLogs: [{ id: 'a' }] };
    const patch = { dailyLogs: [{ id: 'a' }, { id: 'mine' }] };
    const baseline = captureArrayBaseline(local, patch);
    const server = { dailyLogs: [{ id: 'a' }, { id: 'theirs' }] };
    expect(rebasePatchArrays(patch, baseline, server).dailyLogs.map((x: any) => x.id)).toEqual(['a', 'theirs', 'mine']);
  });

  it('keeps an item this device deleted on purpose deleted', () => {
    const local = { dailyLogs: [{ id: 'a' }, { id: 'b' }] };
    const patch = { dailyLogs: [{ id: 'a' }] }; // manager removed b
    const baseline = captureArrayBaseline(local, patch);
    const server = { dailyLogs: [{ id: 'a' }, { id: 'b' }] };
    expect(rebasePatchArrays(patch, baseline, server).dailyLogs.map((x: any) => x.id)).toEqual(['a']);
  });

  it('uses the patch version of an item both sides have', () => {
    const local = { qcDefects: [{ id: 'd1', status: 'OPEN' }] };
    const patch = { qcDefects: [{ id: 'd1', status: 'RESOLVED' }] };
    const baseline = captureArrayBaseline(local, patch);
    const server = { qcDefects: [{ id: 'd1', status: 'OPEN' }, { id: 'd2', status: 'OPEN' }] };
    expect(rebasePatchArrays(patch, baseline, server).qcDefects).toEqual([
      { id: 'd1', status: 'RESOLVED' },
      { id: 'd2', status: 'OPEN' },
    ]);
  });

  it('identifies work sessions by person and start time', () => {
    const local = { workSessions: [] };
    const patch = { workSessions: [{ byUserId: 'u1', startedAt: 't1' }] };
    const baseline = captureArrayBaseline(local, patch);
    const server = { workSessions: [{ byUserId: 'u2', startedAt: 't0' }] };
    // the server keeps existing sessions in place, so theirs must stay first and ours is appended
    expect(rebasePatchArrays(patch, baseline, server).workSessions).toEqual([
      { byUserId: 'u2', startedAt: 't0' },
      { byUserId: 'u1', startedAt: 't1' },
    ]);
  });

  it('leaves patches without list fields untouched', () => {
    const patch = { status: 'IN_PROGRESS' };
    expect(captureArrayBaseline({ dailyLogs: [] }, patch)).toBeUndefined();
    expect(rebasePatchArrays(patch, undefined, { dailyLogs: [{ id: 'x' }] })).toBe(patch);
  });
});
