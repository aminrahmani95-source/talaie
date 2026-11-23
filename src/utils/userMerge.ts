import type { User } from '../types';
import { StorageService } from './storage';
import { isTestOrMockUser, TEST_USERS } from './testUsers';

/**
 * ادغام فهرست کاربران با داده‌های سرور ابری:
 * - تمام شناسه‌های تستی/ماک حذف می‌شوند.
 * - در صورت دریافت داده‌های معتبر از سرور (cloudUsers)، لیست سرور منبع اصلی (Source of Truth) است
 *   تا کلیه دیوایس‌ها (گوشی، لپ‌تاپ، تبلت) فهرست کاملاً یکسان و همگام ببینند.
 * - کاربران معتبر که دستی توسط ادمین ثبت شده‌اند حفظ می‌گردند.
 */
export function mergeUsersList(localUsers: User[], cloudUsers: User[]): User[] {
  const deletedIds = StorageService.getDeletedUserIds();
  const map = new Map<string, User>();

  // ۱. اکانت‌های رسمی مدیرعامل و مدیر اپ
  for (const tu of TEST_USERS) {
    if (!deletedIds.has(tu.id)) {
      map.set(tu.id, { ...tu });
    }
  }

  if (cloudUsers && cloudUsers.length > 0) {
    // ۲. سرور آنلاین است: کلیه پروفایل‌های معتبر از Supabase درج می‌شوند
    for (const cu of cloudUsers) {
      if (!cu || !cu.id || deletedIds.has(cu.id)) continue;
      if (isTestOrMockUser(cu.id)) continue;

      const existing = map.get(cu.id);
      map.set(cu.id, {
        ...(existing || {}),
        ...cu,
        active: cu.active !== undefined ? cu.active : true,
      });
    }

    // ۳. حفظ کاربرانی که مدیر دستی ساخته و هنوز در سرور درج نشده است (بدون کاربران ماک/تستی)
    for (const lu of localUsers) {
      if (!lu || !lu.id || deletedIds.has(lu.id)) continue;
      if (isTestOrMockUser(lu.id)) continue;

      const existsById = map.has(lu.id);
      const existsByPhone = Array.from(map.values()).some(
        (u) => u.phone && lu.phone && u.phone.replace(/\D/g, '') === lu.phone.replace(/\D/g, '')
      );

      if (!existsById && !existsByPhone) {
        map.set(lu.id, lu);
      }
    }

    return Array.from(map.values()).filter(
      (u) => !deletedIds.has(u.id) && !isTestOrMockUser(u.id)
    );
  }

  // ۴. حالت کاملاً آفلاین بدون داده سرور: فقط پرسنل معتبر و ثبت‌شده محلی (بدون کاربران ماک و تستی)
  for (const u of localUsers) {
    if (u && u.id && !deletedIds.has(u.id) && !isTestOrMockUser(u.id)) {
      map.set(u.id, { ...u });
    }
  }

  return Array.from(map.values()).filter(
    (u) => !deletedIds.has(u.id) && !isTestOrMockUser(u.id)
  );
}
