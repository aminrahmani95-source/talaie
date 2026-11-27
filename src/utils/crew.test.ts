import { describe, expect, it } from 'vitest';
import { getProjectCrew, isProjectSupervisor } from './crew';

const users = [
  { id: 'L', name: 'رضا کریمی', phone: '09120000001', role: 'LEAD_TECHNICIAN', teamId: 'T1' },
  { id: 'A', name: 'مهدی نوری', phone: '09120000002', role: 'TECHNICIAN', teamId: 'T1' },
  { id: 'B', name: 'علی صادقی', phone: '09120000004', role: 'TECHNICIAN', teamId: 'T2' },
  { id: 'L2', name: 'حسین مرادی', phone: '09120000003', role: 'LEAD_TECHNICIAN', teamId: 'T2' },
] as any[];

describe('اکیپ هر پروژه و سرپرست آن', () => {
  const project = { leadTechnicianId: 'L', assignedTechnicianIds: ['L', 'A', 'B'], assignedTeamId: 'T1' };

  it('only the lead of this project runs the work steps', () => {
    expect(isProjectSupervisor(users[0], project)).toBe(true);
    expect(isProjectSupervisor(users[1], project)).toBe(false);
    // سرپرست اکیپ دیگر که در این پروژه فقط عضو است
    expect(isProjectSupervisor(users[3], { ...project, assignedTechnicianIds: ['L', 'L2'] })).toBe(false);
  });

  it('a project without a named lead is run by a lead-role member of it', () => {
    const noLead = { assignedTechnicianIds: ['L2', 'B'], assignedTeamId: 'T2' };
    expect(isProjectSupervisor(users[3], noLead)).toBe(true);
    expect(isProjectSupervisor(users[2], noLead)).toBe(false);
  });

  it('lists the lead and the crew of this very project (crews change per project)', () => {
    const crew = getProjectCrew(project, users, 'A');
    expect(crew.lead).toMatchObject({ name: 'رضا کریمی', phone: '09120000001', isLead: true, isMe: false });
    expect(crew.members.map((m) => m.name)).toEqual(['مهدی نوری', 'علی صادقی']);
    expect(crew.members[0].isMe).toBe(true);
    expect(getProjectCrew({ leadTechnicianId: 'X', assignedTechnicianIds: ['X'] }, users).lead?.name).toBe('نامشخص');
  });
});
