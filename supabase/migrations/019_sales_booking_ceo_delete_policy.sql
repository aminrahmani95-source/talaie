-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۹: سیاست امنیتی حذف رزروهای فروش منحصراً برای مدیرعامل
-- ۱. سیاست RLS حذف رکورد در جدول sales_bookings صرفاً با نقش 'CEO'
-- ۲. اعطای مجوز DELETE به نقش احرازهویت‌شده (مشروط به RLS مدیرعامل)
-- ==============================================================================

-- تعریف یا به‌روزرسانی سیاست حذف برای جدول sales_bookings
drop policy if exists "sales_bookings_delete_policy" on public.sales_bookings;
create policy "sales_bookings_delete_policy"
  on public.sales_bookings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'CEO'
        and active = true
    )
  );

-- اعطای مجوزهای کامل شامل حذف
grant delete on public.sales_bookings to authenticated;
