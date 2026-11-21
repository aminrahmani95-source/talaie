-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۰: حذف سقف ۶۰ لت برای پروژه‌ها
-- ۱. امکان ثبت پروژه‌های بزرگ با تعداد لت‌های بالای ۶۰ (مانند ۱۱۵ لت)
-- ۲. سقف روزانه نصب همچنان روی ۶۰ لت (۴ اکیپ × ۱۵ لت) باقی می‌ماند.
-- ==============================================================================

alter table public.sales_bookings drop constraint if exists sales_bookings_laths_count_check;
alter table public.sales_bookings add constraint sales_bookings_laths_count_check
  check (laths_count > 0);
