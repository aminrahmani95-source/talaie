import { describe, expect, it } from 'vitest';
import {
  getMultiDayProgress,
  getMultiDayTotalDays,
  getProjectScheduleDays,
  hasCustomScheduleDays,
  isContiguousDays,
  isProjectScheduledOnDate,
  nextScheduleDayAfter,
  normalizeScheduleDays,
} from './multiDay';
import { getProjectDailyDurationHours, detectScheduleConflicts } from './capacity';
import { createTeamTransferPayload } from './teamTransfer';
import { formatAuditDiff } from './auditDiff';
import { computeNotificationEvents } from './notificationRules';

// شنبه 1405/09/08 = 2026-11-29 ، چهارشنبه = 2026-12-02
const SAT = '2026-11-29';
const SUN = '2026-11-30';
const TUE = '2026-12-01';
const WED = '2026-12-02';

const p = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    code: 'PRJ-1',
    title: 'ولنجک',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    scheduledDate: SAT,
    endDate: WED,
    scheduledDays: [SAT, WED],
    scheduledTime: '09:00',
    assignedTeamId: 'T1',
    assignedTechnicianIds: ['u1'],
    leadTechnicianId: 'u1',
    requiredDurationHours: 8,
    ...over,
  }) as any;

describe('روزهای انتخابی (شنبه و چهارشنبه)', () => {
  it('appears only on the chosen days, not the days between', () => {
    const proj = p();
    expect(isProjectScheduledOnDate(proj, SAT)).toBe(true);
    expect(isProjectScheduledOnDate(proj, SUN)).toBe(false);
    expect(isProjectScheduledOnDate(proj, TUE)).toBe(false);
    expect(isProjectScheduledOnDate(proj, WED)).toBe(true);
    expect(getProjectScheduleDays(proj)).toEqual([SAT, WED]);
    expect(getMultiDayTotalDays(proj)).toBe(2);
    expect(hasCustomScheduleDays(proj)).toBe(true);
  });

  it('counts the day number by working days only', () => {
    expect(getMultiDayProgress(p(), SAT)?.badgeText).toBe('روز 1 از 2');
    expect(getMultiDayProgress(p(), WED)?.badgeText).toBe('روز 2 از 2');
    expect(nextScheduleDayAfter(p(), SAT)).toBe(WED);
  });

  it('ignores stale chosen days when the start or end date was changed some other way', () => {
    const moved = p({ scheduledDate: SUN, endDate: TUE });
    expect(hasCustomScheduleDays(moved)).toBe(false);
    expect(getProjectScheduleDays(moved)).toEqual([SUN, TUE]);
    expect(isProjectScheduledOnDate(moved, SAT)).toBe(false);
  });

  it('behaves exactly as before for ordinary projects', () => {
    const range = p({ scheduledDays: undefined });
    expect(getProjectScheduleDays(range)).toEqual([SAT, SUN, TUE, WED]);
    expect(isProjectScheduledOnDate(range, SUN)).toBe(true);
    const single = p({ scheduledDays: undefined, endDate: undefined });
    expect(getProjectScheduleDays(single)).toEqual([SAT]);
    expect(getMultiDayProgress(single, SAT)).toBeNull();
  });

  it('cleans up stored day lists', () => {
    expect(normalizeScheduleDays([WED, SAT, 'x', SAT, null])).toEqual([SAT, WED]);
    expect(isContiguousDays([SAT, SUN])).toBe(true);
    expect(isContiguousDays([SAT, WED])).toBe(false);
  });

  it('splits team hours only over the chosen days and sees no load on the days between', () => {
    const proj = p();
    expect(getProjectDailyDurationHours(proj, SUN)).toBe(0);
    expect(getProjectDailyDurationHours(proj, SAT)).toBeGreaterThan(0);
    expect(getProjectDailyDurationHours(proj, WED)).toBeGreaterThan(0);
  });

  it('a team can take another job on the free days between', () => {
    const other = p({ id: 'p2', code: 'PRJ-2', scheduledDate: SUN, endDate: TUE, scheduledDays: undefined });
    const conflicts = detectScheduleConflicts([p(), other], [{ id: 'T1', name: 'اکیپ 1', code: 'T1' } as any]);
    const overlapping = conflicts.filter((c: any) => c.projectId === 'p2' && /هم‌زمان|تداخل/.test(c.message || ''));
    expect(overlapping).toHaveLength(0);
  });

  it('team transfer with new dates keeps only the chosen days that still fit', () => {
    const base = {
      project: p({ status: 'IN_PROGRESS' }),
      targetTeam: { id: 'T2', name: 'اکیپ 2', supervisorId: 'u2' } as any,
      currentUser: { id: 'm', name: 'مدیر', role: 'QC_MANAGER', active: true } as any,
      reason: 'جابجایی',
    };
    // شروع از سه‌شنبه: فقط چهارشنبه می‌ماند، پس روزهای انتخابی دیگر معنا ندارد
    expect(createTeamTransferPayload({ ...base, newScheduledDate: TUE } as any).patch.scheduledDays).toBeNull();
    // بدون تغییر تاریخ: روزها دست نمی‌خورد
    expect('scheduledDays' in createTeamTransferPayload(base as any).patch).toBe(false);
  });

  it('writes the chosen days to the project history and tells the crew when they change', () => {
    const changes = formatAuditDiff(p({ scheduledDays: undefined }), p());
    expect(changes.join(' ')).toMatch(/روزهای اجرا/);

    const lead = { id: 'u1', role: 'LEAD_TECHNICIAN', name: 'سرپرست' } as any;
    const events = computeNotificationEvents(
      { projects: [p({ scheduledDays: [SAT, TUE, WED] })], tickets: [], materialRequests: [], salesBookings: [], scheduleChangeRequests: [] } as any,
      { projects: [p()], tickets: [], materialRequests: [], salesBookings: [], scheduleChangeRequests: [] } as any,
      lead
    );
    expect(events.some((e: any) => e.title === 'تغییر روزهای اجرای مأموریت')).toBe(true);
  });
});
