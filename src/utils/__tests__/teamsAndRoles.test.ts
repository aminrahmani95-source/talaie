import { describe, it, expect } from 'vitest';
import { validateTicketRoleGuards } from '../roleGuards';
import { InstallationTeam, Ticket, User, Project } from '../../types';
import { PermanentError } from '../offlineQueue';

describe('4-Team Operational Structure & Roles', () => {
  const coordinator: User = {
    id: 'u-coordinator',
    name: 'مسئول هماهنگی',
    phone: '09120000001',
    role: 'SCHEDULING_COORDINATOR',
    active: true,
  };

  const qcManager: User = {
    id: 'u-qc-mgr',
    name: 'مدیر کیفی',
    phone: '09120000002',
    role: 'QC_MANAGER',
    active: true,
  };

  const lead1: User = {
    id: 'u-lead-1',
    name: 'سرپرست تیم ۱',
    phone: '09120000003',
    role: 'LEAD_TECHNICIAN',
    active: true,
  };

  const tech1A: User = {
    id: 'u-tech-1a',
    name: 'تکنسین الف تیم ۱',
    phone: '09120000004',
    role: 'TECHNICIAN',
    active: true,
  };

  const tech1B: User = {
    id: 'u-tech-1b',
    name: 'تکنسین ب تیم ۱',
    phone: '09120000005',
    role: 'TECHNICIAN',
    active: true,
  };

  const tech1C_overflow: User = {
    id: 'u-tech-1c',
    name: 'تکنسین اضافی تیم ۱',
    phone: '09120000006',
    role: 'TECHNICIAN',
    active: true,
  };

  const baseProject: Project = {
    id: 'p-201',
    code: 'T-201',
    title: 'پروژه نیاوران',
    customerName: 'خانم افشار',
    customerPhone: '09128888888',
    address: 'نیاوران، مژده',
    shadePanels: 4,
    curtainPanels: 2,
    leadTechnicianId: lead1.id,
    assignedTechnicianIds: [lead1.id, tech1A.id],
    assignedTeamId: 'team-1',
    assignedTeamName: 'اکیپ نصب ۱',
    scheduledDate: '2026-11-15',
    scheduledTime: '09:00',
    proposalImages: [],
    completionPhotos: [],
    status: 'SCHEDULED',
    qcStatus: 'NOT_STARTED',
    technicalHandover: {
      isHandoverComplete: true,
      productionConfirmation: { confirmed: true, confirmedAt: '2026-11-14T09:00:00Z', confirmedBy: 'مسئول' },
      warehouseConfirmation: { confirmed: true, confirmedAt: '2026-11-14T10:00:00Z', confirmedBy: 'مسئول' },
    },
    toolsRequired: [],
    isFullTools: true,
    createdAt: '2026-11-14T08:00:00Z',
    updatedAt: '2026-11-14T08:00:00Z',
  };

  describe('Team Capacity & Structure Rules (1 Supervisor + 2 Technicians = 3 members per team, 4 teams = 12 total)', () => {
    // Helper function that mirrors client & DB validation for team assignment
    function validateTeamAssignment(
      teamId: string,
      userRole: 'LEAD_TECHNICIAN' | 'TECHNICIAN',
      existingMembers: { teamId: string; userId: string; roleInTeam: string }[],
      userIdToAssign: string
    ): { valid: boolean; error?: string } {
      // Rule 1: A user cannot belong to multiple teams simultaneously
      const alreadyInTeam = existingMembers.find((m) => m.userId === userIdToAssign);
      if (alreadyInTeam) {
        return { valid: false, error: 'کاربر در حال حاضر در یک اکیپ دیگر عضو است.' };
      }

      const teamMembers = existingMembers.filter((m) => m.teamId === teamId);

      // Rule 2: Max 1 supervisor per team
      if (userRole === 'LEAD_TECHNICIAN') {
        const hasSupervisor = teamMembers.some((m) => m.roleInTeam === 'SUPERVISOR');
        if (hasSupervisor) {
          return { valid: false, error: 'ظرفیت سرپرست این اکیپ تکمیل است (حداکثر ۱ سرپرست).' };
        }
      }

      // Rule 3: Max 2 technicians per team
      if (userRole === 'TECHNICIAN') {
        const techCount = teamMembers.filter((m) => m.roleInTeam === 'TECHNICIAN').length;
        if (techCount >= 2) {
          return { valid: false, error: 'ظرفیت تکنسین‌های این اکیپ تکمیل است (حداکثر ۲ تکنسین).' };
        }
      }

      // Rule 4: Total capacity max 3
      if (teamMembers.length >= 3) {
        return { valid: false, error: 'ظرفیت کل اکیپ تکمیل است (حداکثر ۳ نفر).' };
      }

      return { valid: true };
    }

    it('allows assigning 1 supervisor and 2 technicians to a team', () => {
      const members: { teamId: string; userId: string; roleInTeam: string }[] = [];

      const r1 = validateTeamAssignment('team-1', 'LEAD_TECHNICIAN', members, lead1.id);
      expect(r1.valid).toBe(true);
      members.push({ teamId: 'team-1', userId: lead1.id, roleInTeam: 'SUPERVISOR' });

      const r2 = validateTeamAssignment('team-1', 'TECHNICIAN', members, tech1A.id);
      expect(r2.valid).toBe(true);
      members.push({ teamId: 'team-1', userId: tech1A.id, roleInTeam: 'TECHNICIAN' });

      const r3 = validateTeamAssignment('team-1', 'TECHNICIAN', members, tech1B.id);
      expect(r3.valid).toBe(true);
      members.push({ teamId: 'team-1', userId: tech1B.id, roleInTeam: 'TECHNICIAN' });

      expect(members.length).toBe(3);
    });

    it('rejects adding a 2nd supervisor to the same team', () => {
      const members = [
        { teamId: 'team-1', userId: lead1.id, roleInTeam: 'SUPERVISOR' },
      ];
      const r = validateTeamAssignment('team-1', 'LEAD_TECHNICIAN', members, 'u-lead-2');
      expect(r.valid).toBe(false);
      expect(r.error).toContain('ظرفیت سرپرست');
    });

    it('rejects adding a 3rd technician to the same team (over 2 technicians limit)', () => {
      const members = [
        { teamId: 'team-1', userId: lead1.id, roleInTeam: 'SUPERVISOR' },
        { teamId: 'team-1', userId: tech1A.id, roleInTeam: 'TECHNICIAN' },
        { teamId: 'team-1', userId: tech1B.id, roleInTeam: 'TECHNICIAN' },
      ];
      const r = validateTeamAssignment('team-1', 'TECHNICIAN', members, tech1C_overflow.id);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('حداکثر ۲ تکنسین');
    });

    it('rejects assigning a technician to a second team while already assigned to team-1', () => {
      const members = [
        { teamId: 'team-1', userId: tech1A.id, roleInTeam: 'TECHNICIAN' },
      ];
      const r = validateTeamAssignment('team-2', 'TECHNICIAN', members, tech1A.id);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('در حال حاضر در یک اکیپ دیگر عضو است');
    });

    it('verifies 4 standard teams with 3 members each models exactly 12 workforce members', () => {
      const teams: InstallationTeam[] = [
        { id: 'team-1', code: 'TEAM_1', name: 'اکیپ نصب ۱', createdAt: '2026-11-08', updatedAt: '2026-11-08' },
        { id: 'team-2', code: 'TEAM_2', name: 'اکیپ نصب ۲', createdAt: '2026-11-08', updatedAt: '2026-11-08' },
        { id: 'team-3', code: 'TEAM_3', name: 'اکیپ نصب ۳', createdAt: '2026-11-08', updatedAt: '2026-11-08' },
        { id: 'team-4', code: 'TEAM_4', name: 'اکیپ نصب ۴', createdAt: '2026-11-08', updatedAt: '2026-11-08' },
      ];

      expect(teams.length).toBe(4);
      const maxWorkforce = teams.length * 3; // 4 teams * (1 supervisor + 2 techs)
      expect(maxWorkforce).toBe(12);
    });
  });

  describe('SCHEDULING_COORDINATOR Permissions & Ticket Role Guards', () => {
    it('allows SCHEDULING_COORDINATOR to open tickets for any project', () => {
      const ticket: Partial<Ticket> = {
        id: 't-1',
        projectId: baseProject.id,
        type: 'WALL_ISSUE',
        description: 'نیاز به داربست',
        status: 'OPEN',
      };
      expect(() => validateTicketRoleGuards(coordinator, baseProject, ticket)).not.toThrow();
    });

    it('SCHEDULING_COORDINATOR resolves tickets only for projects of their own teams', () => {
      const ticket: Partial<Ticket> = {
        id: 't-1',
        projectId: baseProject.id,
        status: 'RESOLVED',
      };
      const ownTeam = baseProject.assignedTeamId || 'team-x';
      const project = { ...baseProject, assignedTeamId: ownTeam };
      expect(() =>
        validateTicketRoleGuards(coordinator, project, ticket, undefined, { coordinatorTeamIds: new Set([ownTeam]) })
      ).not.toThrow();
      expect(() =>
        validateTicketRoleGuards(coordinator, project, ticket, undefined, { coordinatorTeamIds: new Set(['other']) })
      ).toThrow(PermanentError);
    });

    it('allows QC_MANAGER to resolve tickets', () => {
      const ticket: Partial<Ticket> = {
        id: 't-1',
        projectId: baseProject.id,
        status: 'RESOLVED',
      };
      expect(() => validateTicketRoleGuards(qcManager, baseProject, ticket)).not.toThrow();
    });

    it('blocks technician from resolving tickets', () => {
      const ticket: Partial<Ticket> = {
        id: 't-1',
        projectId: baseProject.id,
        status: 'RESOLVED',
      };
      expect(() => validateTicketRoleGuards(tech1A, baseProject, ticket, 'team-1')).toThrow(PermanentError);
    });

    it('blocks technician from creating ticket on a project not assigned to their team', () => {
      const ticket: Partial<Ticket> = {
        id: 't-2',
        projectId: baseProject.id,
        status: 'OPEN',
      };
      const unrelatedTech: User = {
        id: 'u-other-tech',
        name: 'تکنسین بیرونی',
        phone: '09129990000',
        role: 'TECHNICIAN',
        active: true,
      };
      expect(() => validateTicketRoleGuards(unrelatedTech, baseProject, ticket, 'team-2')).toThrow(
        'شما تنها مجاز به ثبت تیکت روی پروژه‌های تخصیص‌یافته به خودتان هستید'
      );
    });
  });
});
