import type { Project, Ticket, User } from '../types';
import { getDisplayName } from './technicianName';

export interface WarehouseReferralInput {
  /** شناسه پروژه (برای مواردی که فقط شناسه در دسترس است) */
  projectId: string;
  project?: Pick<Project, 'code' | 'title'> | null;
  description: string;
  blockingReason: string;
  referralNote: string;
  historyNote: string;
  reporter: Pick<User, 'id' | 'name'>;
  warehouseAssignee?: Pick<User, 'id' | 'name'> | null;
  idPrefix?: string;
  now?: Date;
}

/**
 * ساخت تیکت فوری ارجاع به انبار (کسری قطعه/یراق).
 * قبلاً دو نسخه تقریباً تکراری از این آبجکت در App.tsx وجود داشت و هر دو فیلدهای اجباری
 * تیکت (type, photos, authorId) را نداشتند.
 */
export function buildWarehouseReferralTicket(input: WarehouseReferralInput): Ticket {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const stamp = now.getTime();
  const reporterName = getDisplayName(input.reporter.name);
  return {
    id: `${input.idPrefix ?? 'ticket-referral'}-${stamp}`,
    projectId: input.projectId,
    projectCode: input.project?.code || 'بدون کد',
    projectTitle: input.project?.title || 'پروژه متوقف',
    authorId: input.reporter.id,
    authorName: reporterName,
    type: 'DAMAGED_HARDWARE',
    category: 'EQUIPMENT_DEFECT',
    description: input.description,
    photos: [],
    status: 'OPEN',
    assignedRole: 'WAREHOUSE',
    assignedDepartment: 'انبار و تدارکات',
    assignedTeamName: 'انبار مرکزی و لجستیک',
    assignedUserId: input.warehouseAssignee?.id,
    assignedUserName: input.warehouseAssignee ? getDisplayName(input.warehouseAssignee.name) : 'مسئول انبار',
    isBlocking: true,
    blockingReason: input.blockingReason,
    referralNote: input.referralNote,
    referredAt: nowIso,
    referredByUserName: reporterName,
    createdAt: nowIso,
    actionHistory: [
      {
        id: `act-${stamp}`,
        timestamp: nowIso,
        action: 'REFERRED_TO_WAREHOUSE',
        byUserId: input.reporter.id,
        byUserName: reporterName,
        note: input.historyNote,
      },
    ],
  };
}
