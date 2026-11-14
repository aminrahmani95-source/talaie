/**
 * منطق طبقه‌بندی وضعیت مهاجرت و سازگاری ساختاری پایگاه داده
 * مطابق الزامات صریح فاز P2.1 گالری طلایی
 */

export type MigrationStateClassification =
  | 'EMPTY_DATABASE'
  | 'MIGRATION_HISTORY_VERIFIED_011'
  | 'STRUCTURALLY_COMPATIBLE_WITH_011'
  | 'MIGRATION_HISTORY_VERIFIED_P2_1'
  | 'STRUCTURALLY_COMPATIBLE_WITH_P2_1'
  | 'UNKNOWN_OR_INCONSISTENT_STATE';

export type DataPostconditionResult = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface MigrationInspectionInput {
  /** آیا پایگاه داده خام است و هیچ جدولی از گالری طلایی در آن وجود ندارد؟ */
  isEmptyDatabase: boolean;
  /** آیا دفترکل معتبر مهاجرت ثبت مهاجرت‌های ۰۰۱ تا ۰۱۱ را گزارش می‌کند؟ */
  ledgerHas011: boolean;
  /** آیا دفترکل معتبر مهاجرت ثبت مهاجرت ۰۱۲ (فاز P2.1) را گزارش می‌کند؟ */
  ledgerHasP21: boolean;
  /**
   * آیا دسترسی نوشتن نقش‌های غیرمجاز کلاینت (anon/authenticated) روی جدول تاریخچه سلب شده است؟
   * نکته مهم: این بررسی صرفاً حفاظت در برابر کلاینت را اثبات می‌کند، نه مصونیت در برابر مالک یا مدیر ارشد DBA.
   */
  ledgerClientWriteProtected?: boolean;
  /** آیا تمامی بررسی‌های ساختاری، RLS، سیاست‌ها، تریگرها، توابع و قیدهای خط مبنای ۰۱۱ پاس شده‌اند؟ */
  structural011Passed: boolean;
  /** آیا تمامی بررسی‌های ساختاری، سیاست‌ها، تریگر خط مبنا، تابع confirm_daily_log و دسترسی‌های P2.1 پاس شده‌اند؟ */
  structuralP21Passed: boolean;
  /** تعداد بررسی‌هایی که وضعیت نامشخص (UNKNOWN) گزارش کرده‌اند */
  unknownChecksCount: number;
  /** تعداد بررسی‌هایی که با شکست قطعی (FAIL) مواجه شده‌اند */
  failedChecksCount: number;
  /** وضعیت پس‌شرط پاک‌سازی داده‌ای مایگریشن ۰۰۷ (کاملاً مستقل از سازگاری ساختاری) */
  dataPostcondition007?: DataPostconditionResult;
}

export function classifyMigrationState(input: MigrationInspectionInput): MigrationStateClassification {
  // ۱. پایگاه داده کاملاً خالی
  if (input.isEmptyDatabase) {
    return 'EMPTY_DATABASE';
  }

  // ۲. هرگونه خطای ساختاری یا وجود بررسی‌های نامشخص، وضعیت را به حالت ناسازگار یا نامشخص می‌برد
  if (input.failedChecksCount > 0 || input.unknownChecksCount > 0) {
    return 'UNKNOWN_OR_INCONSISTENT_STATE';
  }

  // ارزیابی حفاظت دسترسی کلاینت به دفترکل (پیش‌فرض: در صورت عدم ذکر، فرض بر رعایت حفاظت است)
  const isClientWriteProtected = input.ledgerClientWriteProtected ?? true;

  // ۳. ارزیابی فاز P2.1
  if (input.structuralP21Passed) {
    if (input.ledgerHasP21 && isClientWriteProtected) {
      return 'MIGRATION_HISTORY_VERIFIED_P2_1';
    }
    // بازرسی صرفاً ساختاری یا دفترکل فاقد حفاظت کلاینت هرگز نباید وضعیت MIGRATION_HISTORY_VERIFIED تولید کند
    return 'STRUCTURALLY_COMPATIBLE_WITH_P2_1';
  }

  // ۴. ارزیابی خط مبنای ۰۱۱ (پیش از P2.1)
  if (input.structural011Passed) {
    if (input.ledgerHas011 && isClientWriteProtected) {
      return 'MIGRATION_HISTORY_VERIFIED_011';
    }
    // بازرسی صرفاً ساختاری یا دفترکل فاقد حفاظت کلاینت هرگز نباید وضعیت MIGRATION_HISTORY_VERIFIED تولید کند
    return 'STRUCTURALLY_COMPATIBLE_WITH_011';
  }

  // ۵. در غیر این صورت، دیتابیس در وضعیت ناشناخته یا ناقص قرار دارد
  return 'UNKNOWN_OR_INCONSISTENT_STATE';
}
