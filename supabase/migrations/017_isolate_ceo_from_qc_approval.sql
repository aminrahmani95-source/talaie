-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۷: تفکیک قطعی دسترسی‌های مدیرعامل (CEO) از مدیر ارشد QC
-- فایل: supabase/migrations/017_isolate_ceo_from_qc_approval.sql
-- شرح: سلب صلاحیت تأیید نهایی کنترل کیفی (QC) و ارزیابی پرسنل از مدیرعامل و انحصار آن در اختیار QC_MANAGER
-- ==============================================================================

-- ۱. تصحیح تابع is_qc_manager منحصراً برای نقش QC_MANAGER
create or replace function public.is_qc_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'QC_MANAGER' and active = true
  );
$$;

revoke execute on function public.is_qc_manager() from anon, public;
grant execute on function public.is_qc_manager() to authenticated;

-- ۲. تابع is_qc_or_ceo برای مواردی که هر دو مدیر دسترسی مدیریتی مجاز دارند (مانند لاگ‌های ممیزی و داشبورد کل)
create or replace function public.is_qc_or_ceo()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('QC_MANAGER', 'CEO') and active = true
  );
$$;

revoke execute on function public.is_qc_or_ceo() from anon, public;
grant execute on function public.is_qc_or_ceo() to authenticated;

-- ۳. ارزیابی پرسنل فقط توسط مدیر ارشد QC
drop policy if exists "evaluations_insert_policy" on public.personnel_evaluations;
create policy "evaluations_insert_policy" on public.personnel_evaluations
  for insert
  with check (public.is_qc_manager());

drop policy if exists "evaluations_select_policy" on public.personnel_evaluations;
create policy "evaluations_select_policy" on public.personnel_evaluations
  for select
  using (public.is_qc_or_ceo() or evaluator_id = auth.uid() or user_id = auth.uid());
