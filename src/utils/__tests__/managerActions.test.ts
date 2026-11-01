import { describe, it, expect } from 'vitest';
import {
  getRevertOneStep,
  getFullResetPatch,
  isDeleteCodeConfirmed,
} from '../managerActions';
import { formatAuditDiff } from '../auditDiff';
import { Project } from '../../types';

describe('Manager Actions & Audit Diff', () => {
  const baseProject: Project = {
    id: 'prj-101',
    code: 'PRJ-101',
    title: 'نصب پرده ولنجک',
    customerName: 'خانم احمدی',
    customerPhone: '09123456789',
    address: 'ولنجک، خیابان یازدهم',
    shadePanels: 4,
    curtainPanels: 2,
    scheduledDate: '2026-11-01',
    scheduledTime: '10:00',
    status: 'COMPLETED',
    qcStatus: 'APPROVED',
    leadTechnicianId: 'lead-1',
    assignedTechnicianIds: ['lead-1', 'tech-1'],
    isFullTools: true,
    toolsRequired: [],
    proposalImages: [],
    beforePhotos: ['photo-1.jpg'],
    afterPhotos: ['photo-2.jpg'],
    completionPhotos: ['photo-3.jpg'],
    customerSignature: 'sig.png',
    customerSatisfaction: 5,
    startedAt: '2026-11-01T09:00:00Z',
    completedAt: '2026-11-01T14:00:00Z',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T14:00:00Z',
  };

  describe('revert-one-step mapping for every status', () => {
    it('reverts COMPLETED to IN_PROGRESS', () => {
      const res = getRevertOneStep({ ...baseProject, status: 'COMPLETED', qcStatus: 'PENDING' });
      expect(res.nextStatus).toBe('IN_PROGRESS');
      // must leave the QC queue, otherwise an IN_PROGRESS job would show as «در انتظار QC»
      expect(res.extraPatch.qcStatus).toBe('NOT_STARTED');
      expect(res.extraPatch.completedAt).toBeNull();
    });

    it('reverts STUCK using the latest incident in stuckIncidents[] with a Persian label', () => {
      const res = getRevertOneStep({
        ...baseProject,
        status: 'STUCK',
        stuckIncidents: [
          { previousStatus: 'EN_ROUTE' } as any,
          { previousStatus: 'PAUSED' } as any,
        ],
      });
      expect(res.nextStatus).toBe('PAUSED');
      expect(res.description).not.toMatch(/PAUSED/);
    });

    it('reverts PAUSED to IN_PROGRESS', () => {
      const res = getRevertOneStep({ ...baseProject, status: 'PAUSED' });
      expect(res.nextStatus).toBe('IN_PROGRESS');
    });

    it('reverts IN_PROGRESS to EN_ROUTE', () => {
      const res = getRevertOneStep({ ...baseProject, status: 'IN_PROGRESS' });
      expect(res.nextStatus).toBe('EN_ROUTE');
    });

    it('reverts EN_ROUTE to SCHEDULED', () => {
      const res = getRevertOneStep({ ...baseProject, status: 'EN_ROUTE' });
      expect(res.nextStatus).toBe('SCHEDULED');
    });

    it('reverts STUCK to incident previousStatus or IN_PROGRESS', () => {
      const stuckWithPrev = {
        ...baseProject,
        status: 'STUCK' as const,
        stuckIncident: {
          id: 'inc-1',
          stuckAt: '2026-11-01T10:00:00Z',
          reportedAt: '2026-11-01T10:00:00Z',
          reportedBy: 'علی',
          category: 'OTHER' as const,
          description: 'دیوار بتنی',
          photos: [],
          targetMaxHours: 72,
          previousStatus: 'EN_ROUTE' as const,
          resolutionStatus: 'OPEN' as const,
        },
      };
      const res1 = getRevertOneStep(stuckWithPrev);
      expect(res1.nextStatus).toBe('EN_ROUTE');

      const stuckWithoutPrev = { ...baseProject, status: 'STUCK' as const };
      const res2 = getRevertOneStep(stuckWithoutPrev);
      expect(res2.nextStatus).toBe('IN_PROGRESS');
    });

    it('reverts SCHEDULED to MEASUREMENT_PENDING', () => {
      const res = getRevertOneStep({ ...baseProject, status: 'SCHEDULED' });
      expect(res.nextStatus).toBe('MEASUREMENT_PENDING');
    });
  });

  describe('full reset with both options', () => {
    it('generates KEEP_DOCS reset patch without clearing documents', () => {
      const patch = getFullResetPatch(baseProject, 'KEEP_DOCS', 'خطای زمان‌بندی');
      expect(patch.status).toBe('SCHEDULED');
      expect(patch.qcStatus).toBe('NOT_STARTED');
      expect(patch._auditReason).toBe('خطای زمان‌بندی');
      expect(patch.beforePhotos).toBeUndefined(); // kept as-is on project
      expect(patch.customerSignature).toBeUndefined(); // kept
    });

    it('generates CLEAR_ALL reset patch wiping photos, signature, and times', () => {
      const patch = getFullResetPatch(baseProject, 'CLEAR_ALL', 'لغو و پاک‌سازی');
      expect(patch.status).toBe('SCHEDULED');
      expect(patch.qcStatus).toBe('NOT_STARTED');
      expect(patch._auditReason).toBe('لغو و پاک‌سازی');
      expect(patch.beforePhotos).toEqual([]);
      expect(patch.afterPhotos).toEqual([]);
      // null (not undefined) so the keys survive JSON and actually clear on the server
      expect(patch.customerSignature).toBeNull();
      expect(patch.customerSatisfaction).toBeNull();
      expect(patch.startedAt).toBeNull();
      expect(patch.completedAt).toBeNull();
      const wire = JSON.parse(JSON.stringify(patch));
      expect('startedAt' in wire).toBe(true);
      expect('customerSignature' in wire).toBe(true);
      expect(wire.workSessions).toEqual([]);
      expect(wire.dailyLogs).toEqual([]);
    });
  });

  describe('delete confirm gating', () => {
    it('requires exact project code to confirm deletion', () => {
      expect(isDeleteCodeConfirmed('PRJ-101', 'PRJ-101')).toBe(true);
      expect(isDeleteCodeConfirmed('prj-101', 'PRJ-101')).toBe(true);
      expect(isDeleteCodeConfirmed('  PRJ-101  ', 'PRJ-101')).toBe(true);
      expect(isDeleteCodeConfirmed('PRJ-102', 'PRJ-101')).toBe(false);
      expect(isDeleteCodeConfirmed('', 'PRJ-101')).toBe(false);
    });
  });

  describe('audit diff summarizer', () => {
    it('summarizes status changes in Persian', () => {
      const oldP = { ...baseProject, status: 'IN_PROGRESS' as const };
      const newP = { ...baseProject, status: 'COMPLETED' as const };
      const diff = formatAuditDiff(oldP, newP);
      expect(diff).toContain('تغییر وضعیت از «در حال نصب» به «اتمام نصب»');
    });

    it('summarizes photo additions with counts', () => {
      const oldP = { ...baseProject, beforePhotos: ['a.jpg'] };
      const newP = { ...baseProject, beforePhotos: ['a.jpg', 'b.jpg', 'c.jpg'] };
      const diff = formatAuditDiff(oldP, newP);
      expect(diff).toContain('2 عکس قبل اضافه شد');
    });

    it('summarizes delete actions', () => {
      const diff = formatAuditDiff(baseProject, null, 'DELETE');
      expect(diff).toContain('حذف کامل پروژه از سیستم');
    });
  });
});
