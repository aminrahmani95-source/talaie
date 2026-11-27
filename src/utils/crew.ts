import type { Project, User } from '../types';

/**
 * اکیپ هر پروژه و اینکه چه کسی «سرپرست همین پروژه» است.
 *
 * قاعده‌ی کار میدانی (درخواست مدیر QC):
 * - فقط سرپرست همان پروژه دکمه‌های مراحل کار را دارد: حرکت به محل، رسیدم سر کارگاه (عکس قبل)،
 *   ادامه‌ی کار، پایان شیفت، اعلام توقف، اتمام و ارسال به QC، تأیید تحویل بار و محموله.
 * - تکنسین‌ها فقط «ثبت ایراد» (تیکت) و «درخواست متریال / کسری» دارند.
 * - اکیپ‌ها ثابت نیستند و ممکن است برای هر پروژه نفرات فرق کند؛ پس اعضا از خود پروژه
 *   (leadTechnicianId و assignedTechnicianIds) خوانده می‌شوند، نه از اکیپ ثابت.
 *
 * سرور هم همین قاعده را اجرا می‌کند (مایگریشن ۰۲۷).
 */

export const CREW_LEAD_ONLY_MESSAGE =
  'فقط سرپرست این پروژه می‌تواند مراحل کار (حرکت، شروع، پایان و اتمام) را ثبت کند. تکنسین‌ها ثبت ایراد و درخواست متریال دارند.';

/** آیا این کاربر سرپرست همین پروژه است و مراحل کار با اوست */
export function isProjectSupervisor(
  user: Pick<User, 'id' | 'role' | 'teamId'> | null | undefined,
  project: Pick<Project, 'leadTechnicianId' | 'assignedTechnicianIds' | 'assignedTeamId'> | null | undefined
): boolean {
  if (!user || !project) return false;
  if (project.leadTechnicianId) return project.leadTechnicianId === user.id;
  // پروژه‌ی بدون سرپرست مشخص: سرپرستی که در همین پروژه یا اکیپ آن است
  if (user.role !== 'LEAD_TECHNICIAN') return false;
  return (
    (project.assignedTechnicianIds || []).includes(user.id) ||
    Boolean(user.teamId && project.assignedTeamId && user.teamId === project.assignedTeamId)
  );
}

export interface CrewPerson {
  id: string;
  name: string;
  phone?: string;
  isLead: boolean;
  /** خود کاربر فعلی */
  isMe: boolean;
}

export interface ProjectCrew {
  lead: CrewPerson | null;
  /** بقیه‌ی نفرات این پروژه (بدون سرپرست) */
  members: CrewPerson[];
}

/** سرپرست و نفرات همین پروژه با نام و شماره */
export function getProjectCrew(
  project: Pick<Project, 'leadTechnicianId' | 'assignedTechnicianIds'>,
  users: Array<Pick<User, 'id' | 'name' | 'phone'>> | undefined,
  currentUserId?: string
): ProjectCrew {
  const byId = new Map((users || []).map((u) => [u.id, u]));
  const person = (id: string, isLead: boolean): CrewPerson => {
    const u = byId.get(id);
    return {
      id,
      name: u?.name?.trim() || 'نامشخص',
      phone: u?.phone || undefined,
      isLead,
      isMe: id === currentUserId,
    };
  };
  const leadId = project.leadTechnicianId || '';
  const seen = new Set<string>(leadId ? [leadId] : []);
  const members: CrewPerson[] = [];
  for (const id of project.assignedTechnicianIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    members.push(person(id, false));
  }
  return { lead: leadId ? person(leadId, true) : null, members };
}
