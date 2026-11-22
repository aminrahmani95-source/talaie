import type { User } from '../types';
import { StorageService } from './storage';

/**
 * ادغام فهرست کاربران محلی با سرور.
 * - کاربرانی که محلی حذف شده‌اند (tombstone) هرگز از سرور برنمی‌گردند.
 * - تطبیق با شناسه یا شماره موبایل؛ ویرایش محلی جدیدتر اولویت دارد.
 */
export function mergeUsersList(localUsers: User[], cloudUsers: User[]): User[] {
  const deletedIds = StorageService.getDeletedUserIds();
  const map = new Map<string, User>();
  for (const u of localUsers) {
    if (u && u.id && !deletedIds.has(u.id)) {
      map.set(u.id, { ...u });
    }
  }

  for (const cu of cloudUsers) {
    if (!cu || !cu.id) continue;
    // CRITICAL: Do NOT resurrect users from cloud if they were deleted locally
    if (deletedIds.has(cu.id)) continue;

    const existingById = map.get(cu.id);
    const existingByPhone = Array.from(map.values()).find(
      (u) =>
        u.phone &&
        cu.phone &&
        u.phone.replace(/\D/g, '') === cu.phone.replace(/\D/g, '')
    );
    const target = existingById || existingByPhone;

    if (target) {
      // Local edits are authoritative unless cloud record has a strictly newer updatedAt
      const targetHasNewerEdit = target.updatedAt && (!cu.updatedAt || target.updatedAt >= cu.updatedAt);

      if (targetHasNewerEdit) {
        map.set(target.id, {
          ...cu,
          ...target,
        });
      } else {
        map.set(target.id, {
          ...cu,
          ...target,
          name: target.name || cu.name,
          phone: target.phone || cu.phone,
          role: target.role || cu.role,
          avatar: target.avatar || cu.avatar,
          active: target.active !== undefined ? target.active : (cu.active !== undefined ? cu.active : true),
        });
      }
    } else {
      map.set(cu.id, { ...cu });
    }
  }

  return Array.from(map.values()).filter((u) => !deletedIds.has(u.id));
}
