import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ProjectCard } from '../ProjectCard';
import { Project, User } from '../../../types';

const mockUser: User = {
  id: 'tech-1',
  name: 'علی نصاب',
  phone: '09120000001',
  role: 'TECHNICIAN',
  active: true,
  teamId: 'team-1',
};

const baseProject: Project = {
  id: 'proj-1',
  code: 'P-101',
  title: 'پروژه تست پرده سالن',
  status: 'IN_PROGRESS',
  leadTechnicianId: 'lead-1',
  assignedTechnicianIds: ['tech-1'],
  assignedTeamId: 'team-1',
  customerName: 'کارفرما تست',
  customerPhone: '09121111111',
  address: 'تهران، خیابان ولیعصر',
  scheduledDate: '1405/08/14',
  scheduledTime: '10:00',
  requiredDurationHours: 4,
  shadePanels: 1,
  curtainPanels: 1,
  proposalImages: [],
  isFullTools: true,
  toolsRequired: [],
  completionPhotos: [],
  qcStatus: 'PENDING',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ProjectCard Action Hierarchy (Milestone 1A)', () => {
  it('Scenario 1: Project is IN_PROGRESS and before planned end date (multi-day) -> displays both full completion and shift log actions', () => {
    const multiDayProject: Project = {
      ...baseProject,
      scheduledDate: '1405/08/10',
      endDate: '2099/12/29', // Far future ISO/YMD ensuring isBeforeEndDate === true
    };

    const html = renderToString(
      createElement(ProjectCard, {
        project: multiDayProject,
        currentUser: mockUser,
        onViewProposal: () => {},
        onOpenToolChecklist: () => {},
        onOpenTicketModal: () => {},
        onOpenCompletionModal: () => {},
        onOpenDailyLogModal: () => {},
        onUpdateStatus: () => {},
      })
    );

    // Both actions must be available with shift completion as primary and full completion as accessible secondary
    expect(html).toContain('پایان شیفت امروز (ثبت پیشرفت و ادامه در روز بعد)');
    expect(html).toContain('نصب کل پروژه امروز تمام شد؟ ثبت اتمام کامل و ارسال به QC');
  });

  it('Scenario 2: Project is IN_PROGRESS and on/after planned end date -> displays only the completion action', () => {
    const finalDayProject: Project = {
      ...baseProject,
      scheduledDate: '1403/01/01',
      endDate: '2020/01/01', // Past date ensuring isBeforeEndDate === false
    };

    const html = renderToString(
      createElement(ProjectCard, {
        project: finalDayProject,
        currentUser: mockUser,
        onViewProposal: () => {},
        onOpenToolChecklist: () => {},
        onOpenTicketModal: () => {},
        onOpenCompletionModal: () => {},
        onOpenDailyLogModal: () => {},
        onUpdateStatus: () => {},
      })
    );

    // Full completion must be present
    expect(html).toContain('ثبت اتمام کار و ارسال به QC');
    // Shift log must NOT be present
    expect(html).not.toContain('پایان شیفت امروز');
  });

  it('Scenario 3: Single-visit project (no endDate) -> displays single full completion action', () => {
    const singleVisitProject: Project = {
      ...baseProject,
      endDate: undefined,
    };

    const html = renderToString(
      createElement(ProjectCard, {
        project: singleVisitProject,
        currentUser: mockUser,
        onViewProposal: () => {},
        onOpenToolChecklist: () => {},
        onOpenTicketModal: () => {},
        onOpenCompletionModal: () => {},
        onOpenDailyLogModal: () => {},
        onUpdateStatus: () => {},
      })
    );

    // Full completion must be present
    expect(html).toContain('ثبت اتمام کار و ارسال به QC');
    // Shift log must NOT be present
    expect(html).not.toContain('پایان شیفت امروز');
  });

  it('Scenario 4: Multi-visit project when PAUSED -> displays resumption and transit actions', () => {
    const pausedProject: Project = {
      ...baseProject,
      status: 'PAUSED',
      endDate: '2099/12/29',
    };

    const html = renderToString(
      createElement(ProjectCard, {
        project: pausedProject,
        currentUser: mockUser,
        onViewProposal: () => {},
        onOpenToolChecklist: () => {},
        onOpenTicketModal: () => {},
        onOpenCompletionModal: () => {},
        onOpenDailyLogModal: () => {},
        onUpdateStatus: () => {},
      })
    );

    expect(html).toContain('ادامه کار (اعلام حرکت به محل)');
    expect(html).toContain('در محل پروژه هستم (شروع مستقیم ادامه نصب)');
  });
});
