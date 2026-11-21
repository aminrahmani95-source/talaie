-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۱: انحصار تام حذف پروژه و رزروهای فروش در اختیار مدیرعامل (CEO)
-- ۱. تعریف تابع احراز هویت اختصاصی مدیرعامل (is_ceo)
-- ۲. بازنویسی تابع امنیتی admin_delete_project جهت انحصار حذف در اختیار CEO
-- ۳. بازنویسی سیاست حذف جدول projects منحصراً برای نقش CEO
-- ۴. اطمینان از اعمال سیاست RLS برای sales_bookings
-- ==============================================================================

-- ۱. تابع احراز هویت اختصاصی مدیرعامل
create or replace function public.is_ceo()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'CEO' and active = true
  );
$$;

revoke execute on function public.is_ceo() from anon, public;
grant execute on function public.is_ceo() to authenticated;

-- ۲. به‌روزرسانی تابع admin_delete_project: منحصراً مدیرعامل مجاز به حذف پروژه است
create or replace function public.admin_delete_project(
  p_id text,
  p_reason text default null,
  p_delete_tickets boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_rec record;
begin
  if not public.is_ceo() then
    raise exception 'دسترسی غیرمجاز: منحصراً مدیرعامل (CEO) مجاز به حذف کامل پروژه است.';
  end if;

  select id, data into proj_rec
  from public.projects
  where id = p_id;

  if not found then
    raise exception 'پروژه مورد نظر جهت حذف یافت نشد: %', p_id;
  end if;

  perform set_config('talaie.audit_reason', coalesce(p_reason, ''), true);

  -- اسنپ‌شات کردن کامل مشخصات در schedule_change_requests قبل از قطع ارتباط خارجی
  update public.schedule_change_requests
  set
    project_code = coalesce(project_code, proj_rec.data->>'code', ''),
    project_title = coalesce(project_title, proj_rec.data->>'title', ''),
    customer_name = coalesce(customer_name, proj_rec.data->>'customerName', ''),
    duration_hours = coalesce(duration_hours, (proj_rec.data->>'requiredDurationHours')::numeric, 0),
    project_id = null
  where project_id = p_id;

  if p_delete_tickets then
    delete from public.tickets where data->>'projectId' = p_id;
  end if;

  delete from public.projects where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_project(text, text, boolean) from anon, public;
grant execute on function public.admin_delete_project(text, text, boolean) to authenticated;

-- ۳. اصلاح سیاست DELETE در جدول projects به نفع CEO
drop policy if exists "QC Managers delete projects" on public.projects;
drop policy if exists "CEO delete projects" on public.projects;

create policy "CEO delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_ceo());
