import { describe, it, expect } from 'vitest';
import {
  isProjectMultiDay,
  getCalendarDayDiff,
  getMultiDayTotalDays,
  isProjectScheduledOnDate,
  getMultiDayProgress,
  calculateWorkSessionsSummary,
} from '../multiDay';
import { Project, WorkSession } from '../../types';

describe('multiDay utility functions', () => {
  const baseProject: Project = {
    id: 'prj-1',
    code: 'PRJ-101',
    title: 'نصب پرده ویلا',
    customerName: 'آقای رضایی',
    customerPhone: '09121111111',
    address: 'تهران، لواسان',
    shadePanels: 4,
    curtainPanels: 2,
    scheduledDate: '2026-11-01',
    scheduledTime: '10:00',
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    leadTechnicianId: 'tech-1',
    assignedTechnicianIds: ['tech-1', 'tech-2'],
    isFullTools: true,
    toolsRequired: [],
    proposalImages: [],
    completionPhotos: [],
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  describe('isProjectMultiDay', () => {
    it('returns false for projects without endDate', () => {
      expect(isProjectMultiDay(baseProject)).toBe(false);
    });

    it('returns false when endDate is same as scheduledDate', () => {
      expect(isProjectMultiDay({ ...baseProject, endDate: '2026-11-01' })).toBe(false);
    });

    it('returns false when endDate is before scheduledDate', () => {
      expect(isProjectMultiDay({ ...baseProject, endDate: '2026-10-31' })).toBe(false);
    });

    it('returns true when endDate is strictly after scheduledDate', () => {
      expect(isProjectMultiDay({ ...baseProject, endDate: '2026-11-03' })).toBe(true);
    });
  });

  describe('getCalendarDayDiff and getMultiDayTotalDays', () => {
    it('calculates calendar difference accurately across month boundaries', () => {
      expect(getCalendarDayDiff('2026-11-01', '2026-11-03')).toBe(2);
      expect(getCalendarDayDiff('2026-10-30', '2026-11-02')).toBe(3);
    });

    it('calculates total calendar days inclusive', () => {
      expect(getMultiDayTotalDays(baseProject)).toBe(1);
      expect(getMultiDayTotalDays({ ...baseProject, endDate: '2026-11-03' })).toBe(3);
      expect(getMultiDayTotalDays({ ...baseProject, endDate: '2026-11-05' })).toBe(5);
    });
  });

  describe('isProjectScheduledOnDate', () => {
    const multiProject = { ...baseProject, scheduledDate: '2026-11-01', endDate: '2026-11-03' };

    it('matches single-day project only on its scheduledDate', () => {
      expect(isProjectScheduledOnDate(baseProject, '2026-11-01')).toBe(true);
      expect(isProjectScheduledOnDate(baseProject, '2026-11-02')).toBe(false);
    });

    it('matches multi-day project on all inclusive dates in span', () => {
      expect(isProjectScheduledOnDate(multiProject, '2026-10-31')).toBe(false);
      expect(isProjectScheduledOnDate(multiProject, '2026-11-01')).toBe(true);
      expect(isProjectScheduledOnDate(multiProject, '2026-11-02')).toBe(true);
      expect(isProjectScheduledOnDate(multiProject, '2026-11-03')).toBe(true);
      expect(isProjectScheduledOnDate(multiProject, '2026-11-04')).toBe(false);
    });
  });

  describe('getMultiDayProgress', () => {
    it('returns null for single-day projects', () => {
      expect(getMultiDayProgress(baseProject)).toBeNull();
    });

    it('calculates progress badge accurately for multi-day projects', () => {
      const multiProject = { ...baseProject, scheduledDate: '2026-11-01', endDate: '2026-11-03' };

      // On day 1
      const progress1 = getMultiDayProgress(multiProject, '2026-11-01');
      expect(progress1).toEqual({
        currentDay: 1,
        totalDays: 3,
        badgeText: 'روز 1 از 3',
      });

      // On day 2
      const progress2 = getMultiDayProgress(multiProject, '2026-11-02');
      expect(progress2?.badgeText).toBe('روز 2 از 3');

      // On day 3
      const progress3 = getMultiDayProgress(multiProject, '2026-11-03');
      expect(progress3?.badgeText).toBe('روز 3 از 3');

      // Past endDate
      const progressPast = getMultiDayProgress(multiProject, '2026-11-04');
      expect(progressPast?.badgeText).toBe('پروژه پایان‌یافته');
    });
  });

  describe('calculateWorkSessionsSummary', () => {
    it('returns null when sessions are empty or undefined', () => {
      expect(calculateWorkSessionsSummary(undefined)).toBeNull();
      expect(calculateWorkSessionsSummary([])).toBeNull();
    });

    it('calculates total hours and distinct days correctly', () => {
      const sessions: WorkSession[] = [
        {
          date: '2026-11-01',
          startedAt: '2026-11-01T08:00:00Z',
          endedAt: '2026-11-01T12:30:00Z', // 4.5 hours
          byUserId: 'u1',
          byUserName: 'علی',
        },
        {
          date: '2026-11-02',
          startedAt: '2026-11-02T09:00:00Z',
          endedAt: '2026-11-02T12:00:00Z', // 3.0 hours
          byUserId: 'u1',
          byUserName: 'علی',
        },
      ];

      const summary = calculateWorkSessionsSummary(sessions);
      expect(summary).not.toBeNull();
      expect(summary?.totalMinutes).toBe(450); // 7.5 hours
      expect(summary?.totalDays).toBe(2);
      expect(summary?.formattedHours).toBe('7.5');
      expect(summary?.text).toBe('مجموع: 7.5 ساعت در 2 روز');
    });
  });
});
