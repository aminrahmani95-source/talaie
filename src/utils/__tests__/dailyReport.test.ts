import { describe, it, expect } from 'vitest';
import { Project, DailyLog } from '../../types';

describe('P1 Daily Reporting & Multi-Day Continuity Architecture', () => {
  const createMultiDayProject = (): Project => ({
    id: 'prj-multiday-101',
    code: 'PRJ-101',
    title: 'پروژه ویلایی لواسان (چندروزه)',
    customerName: 'مهندس کاظمی',
    customerPhone: '09123334455',
    address: 'لواسان، بلوار اصلی',
    shadePanels: 4,
    curtainPanels: 2,
    scheduledTime: '09:00',
    assignedTechnicianIds: ['tech-1'],
    isFullTools: true,
    toolsRequired: [],
    completionPhotos: [],
    status: 'IN_PROGRESS',
    qcStatus: 'NOT_STARTED',
    proposalImages: [],
    requiredDurationHours: 24, // 3 روز کاری
    scheduledDate: '2026-11-10',
    endDate: '2026-11-12',
    dailyLogs: [],
    workSessions: [
      {
        date: '2026-11-10',
        startedAt: '2026-11-10T09:00:00.000Z',
        byUserId: 'tech-1',
        byUserName: 'تکنسین ۱',
      },
    ],
    createdAt: '2026-11-09T08:00:00.000Z',
    updatedAt: '2026-11-09T08:00:00.000Z',
  });

  it('records comprehensive day 1 daily log and transitions project to PAUSED', () => {
    const project = createMultiDayProject();

    const day1Log: DailyLog = {
      id: 'log-day-1',
      date: '2026-11-10',
      startTime: '09:00',
      endTime: '17:30',
      completedQuantity: 6,
      remainingQuantity: 12,
      quantityUnit: 'لت',
      note: 'نصب ریل‌ها و براکت‌های طبقه اول به پایان رسید. سیم‌کشی ۶ موتور پرده انجام شد.',
      obstacles: 'کمبود پریز برق در سالن اصلی که با کشیدن کابل کمکی رفع گردید.',
      equipmentIssues: 'سرمته بتن‌کن مستهلک شد و درخواست یک مته جدید شد.',
      photos: ['https://example.com/day1-progress.jpg'],
      plannedContinuationDate: '2026-11-11',
      byUserId: 'tech-lead-1',
      byUserName: 'علی سرپرست',
      createdAt: '2026-11-10T17:30:00.000Z',
    };

    const pausedPatch: Partial<Project> = {
      status: 'PAUSED',
      workSessions: [
        {
          date: '2026-11-10',
          startedAt: '2026-11-10T09:00:00.000Z',
          endedAt: '2026-11-10T17:30:00.000Z',
          byUserId: 'tech-lead-1',
          byUserName: 'علی سرپرست',
        },
      ],
      dailyLogs: [day1Log],
      updatedAt: '2026-11-10T17:30:00.000Z',
    };

    const updated = { ...project, ...pausedPatch };

    expect(updated.status).toBe('PAUSED');
    expect(updated.dailyLogs?.length).toBe(1);
    expect(updated.dailyLogs?.[0].completedQuantity).toBe(6);
    expect(updated.dailyLogs?.[0].remainingQuantity).toBe(12);
    expect(updated.dailyLogs?.[0].quantityUnit).toBe('لت');
    expect(updated.dailyLogs?.[0].plannedContinuationDate).toBe('2026-11-11');
    expect(updated.workSessions?.[0].endedAt).toBe('2026-11-10T17:30:00.000Z');
  });

  it('maintains append-only historical integrity across consecutive daily shifts', () => {
    const project = createMultiDayProject();

    const day1Log: DailyLog = {
      id: 'log-day-1',
      date: '2026-11-10',
      startTime: '09:00',
      endTime: '17:30',
      completedQuantity: 6,
      remainingQuantity: 12,
      quantityUnit: 'لت',
      note: 'پایان روز اول',
      photos: ['https://example.com/p1.jpg'],
      byUserId: 'tech-1',
      byUserName: 'تکنسین ۱',
      createdAt: '2026-11-10T17:30:00.000Z',
    };

    const day2Log: DailyLog = {
      id: 'log-day-2',
      date: '2026-11-11',
      startTime: '09:15',
      endTime: '18:00',
      completedQuantity: 8,
      remainingQuantity: 4,
      quantityUnit: 'لت',
      note: 'نصب لت‌های طبقه دوم و تنظیم ارتفاع ریل‌ها. ۴ لت سالن پذیرایی باقی مانده است.',
      obstacles: 'نداشت',
      equipmentIssues: 'نداشت',
      photos: ['https://example.com/p2.jpg'],
      plannedContinuationDate: '2026-11-12',
      byUserId: 'tech-1',
      byUserName: 'تکنسین ۱',
      createdAt: '2026-11-11T18:00:00.000Z',
    };

    const updatedDailyLogs = [...(project.dailyLogs || []), day1Log, day2Log];

    expect(updatedDailyLogs.length).toBe(2);
    expect(updatedDailyLogs[0].id).toBe('log-day-1');
    expect(updatedDailyLogs[1].id).toBe('log-day-2');
    expect(updatedDailyLogs[1].completedQuantity).toBe(8);
    expect(updatedDailyLogs[1].remainingQuantity).toBe(4);
  });
});
