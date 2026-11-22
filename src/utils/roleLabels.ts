/** عنوان فارسی نقش کاربر (منبع واحد برای هدر، منوها و گزارش‌ها) */
export function getUserRoleLabel(role?: string): string {
  switch (role) {
    case 'CEO':
      return 'مدیرعامل';
    case 'QC_MANAGER':
      return 'مدیر اپ و QC';
    case 'MEASUREMENT_LEAD':
      return 'مسئول متراژ و تایید بستر';
    case 'WAREHOUSE':
      return 'مسئول انبار و تدارکات';
    case 'SCHEDULING_COORDINATOR':
      return 'مسئول هماهنگی و زمان‌بندی';
    case 'SALES_REP':
      return 'کارشناس فروش و رزرو لت';
    case 'LEAD_TECHNICIAN':
      return 'سرپرست اکیپ نصب';
    case 'TECHNICIAN':
      return 'تکنسین نصب';
    default:
      return role || 'کاربر';
  }
}
