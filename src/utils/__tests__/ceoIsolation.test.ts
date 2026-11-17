import { describe, it, expect } from 'vitest';
import { canApproveFinalQC } from '../qcWorkflow';
import {
  validateProjectPatchRoleGuards,
  validateEvaluationRoleGuards,
} from '../roleGuards';
import { Project, User, PersonnelEvaluation } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('CEO Role Isolation & Permission Boundaries', () => {
  const ceoUser: User = {
    id: 'usr-ceo-1',
    name: 'امید طلایی (مدیرعامل)',
    phone: '09121111110',
    role: 'CEO',
    active: true,
  };

  const qcManagerUser: User = {
    id: 'usr-qc-1',
    name: 'امین رحمانی (مدیر ارشد QC)',
    phone: '09124339038',
    role: 'QC_MANAGER',
    active: true,
  };

  const sampleProject: Project = {
    id: 'prj-test-ceo',
    code: 'PRJ-1026',
    title: 'پروژه برج سپید',
    customerName: 'مهندس رضایی',
    customerPhone: '09123456789',
    address: 'زعفرانیه',
    status: 'IN_PROGRESS',
    qcStatus: 'PENDING',
    date: '1403/08/25',
    daysCount: 1,
    teamId: 'team-1',
    assignedTeamName: 'اکیپ ۱',
    leadTechnicianId: 'tech-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('1. QC Approval Boundaries (Strict QC Manager Exclusivity)', () => {
    it('denies CEO from approving final QC', () => {
      const result = canApproveFinalQC(ceoUser, sampleProject);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('مدیر ارشد QC');
    });

    it('authorizes QC Manager to approve final QC on valid projects', () => {
      const validProject: Project = {
        ...sampleProject,
        completionReportedAt: new Date().toISOString(),
        customerHandover: {
          satisfactionScore: 5,
          customerSignature: 'data:image/png;base64,mock',
          checklist: {
            dimensionsMatch: true,
            accessoriesInstalled: true,
            cleaningDone: true,
            safetyTested: true,
            clientTrained: true,
          },
        },
      };
      const result = canApproveFinalQC(qcManagerUser, validProject);
      expect(result.allowed).toBe(true);
    });

    it('rejects CEO attempting to patch qcStatus directly', () => {
      expect(() => {
        validateProjectPatchRoleGuards(ceoUser, sampleProject, {
          qcStatus: 'APPROVED',
          qcApprovedBy: ceoUser.id,
        });
      }).toThrow(PermanentError);
    });

    it('rejects CEO attempting to append qcInspections', () => {
      expect(() => {
        validateProjectPatchRoleGuards(ceoUser, sampleProject, {
          qcInspections: [
            {
              id: 'insp-1',
              passed: true,
              inspectorId: ceoUser.id,
              date: new Date().toISOString(),
              score: 100,
            },
          ],
        });
      }).toThrow(PermanentError);
    });

    it('rejects CEO attempting to modify or resolve qcDefects', () => {
      const projectWithDefects: Project = {
        ...sampleProject,
        qcDefects: [
          {
            id: 'defect-1',
            description: 'نقص فنی در دستگیره',
            severity: 'CRITICAL',
            reportedAt: new Date().toISOString(),
          },
        ],
      };

      expect(() => {
        validateProjectPatchRoleGuards(ceoUser, projectWithDefects, {
          qcDefects: [],
        });
      }).toThrow(PermanentError);
    });
  });

  describe('2. Personnel Evaluation Boundaries', () => {
    it('denies CEO from submitting personnel performance evaluations', () => {
      const evaluation: PersonnelEvaluation = {
        id: 'eval-1',
        projectId: sampleProject.id,
        evaluatorId: ceoUser.id,
        evaluatorName: ceoUser.name,
        evaluatorRole: 'CEO',
        userId: 'tech-1',
        userName: 'علی رضایی',
        userRole: 'LEAD_TECHNICIAN',
        rating: 5,
        criteria: { speed: 5, quality: 5, behavior: 5, cleanliness: 5, toolCare: 5 },
        submittedAt: new Date().toISOString(),
      };

      expect(() => {
        validateEvaluationRoleGuards(ceoUser, evaluation);
      }).toThrow(PermanentError);
    });

    it('authorizes QC Manager to submit personnel performance evaluations', () => {
      const evaluation: PersonnelEvaluation = {
        id: 'eval-2',
        projectId: sampleProject.id,
        evaluatorId: qcManagerUser.id,
        evaluatorName: qcManagerUser.name,
        evaluatorRole: 'QC_MANAGER',
        userId: 'tech-1',
        userName: 'علی رضایی',
        userRole: 'LEAD_TECHNICIAN',
        rating: 5,
        criteria: { speed: 5, quality: 5, behavior: 5, cleanliness: 5, toolCare: 5 },
        submittedAt: new Date().toISOString(),
      };

      expect(() => {
        validateEvaluationRoleGuards(qcManagerUser, evaluation);
      }).not.toThrow();
    });
  });

  describe('3. Certificate Printing Eligibility Gating', () => {
    const isEligibleForCertificatePrint = (project: Project): boolean => {
      return project.status === 'COMPLETED' && project.qcStatus === 'APPROVED';
    };

    it('permits printing for projects that are COMPLETED and QC APPROVED', () => {
      const completedApproved: Project = {
        ...sampleProject,
        status: 'COMPLETED',
        qcStatus: 'APPROVED',
      };
      expect(isEligibleForCertificatePrint(completedApproved)).toBe(true);
    });

    it('denies printing for projects that are COMPLETED but QC PENDING', () => {
      const completedPending: Project = {
        ...sampleProject,
        status: 'COMPLETED',
        qcStatus: 'PENDING',
      };
      expect(isEligibleForCertificatePrint(completedPending)).toBe(false);
    });

    it('denies printing for projects that are COMPLETED but QC REJECTED', () => {
      const completedRejected: Project = {
        ...sampleProject,
        status: 'COMPLETED',
        qcStatus: 'REJECTED',
      };
      expect(isEligibleForCertificatePrint(completedRejected)).toBe(false);
    });

    it('denies printing for projects that are IN_PROGRESS even if qcStatus was mistakenly approved', () => {
      const inProgress: Project = {
        ...sampleProject,
        status: 'IN_PROGRESS',
        qcStatus: 'APPROVED',
      };
      expect(isEligibleForCertificatePrint(inProgress)).toBe(false);
    });

    it('denies printing for projects that are STUCK', () => {
      const stuckProj: Project = {
        ...sampleProject,
        status: 'STUCK',
        qcStatus: 'PENDING',
      };
      expect(isEligibleForCertificatePrint(stuckProj)).toBe(false);
    });
  });
});
