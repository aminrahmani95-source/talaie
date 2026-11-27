-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۷: مراحل کار فقط با سرپرست همان پروژه
--
-- قاعده (درخواست مدیر QC):
--   فقط سرپرست هر پروژه (leadTechnicianId همان پروژه) دکمه‌های مراحل کار را دارد:
--   حرکت به محل، شروع کار و عکس قبل از نصب، پایان شیفت و گزارش روزانه، اعلام توقف،
--   اتمام و ارسال به QC. تکنسین‌ها فقط تیکت (ثبت ایراد) و درخواست متریال/کسری دارند که
--   در جدول‌های جدا ثبت می‌شوند و پروژه را تغییر نمی‌دهند.
--
-- این‌جا همان قاعده روی خود سرور هم اجرا می‌شود تا با نسخه‌ی قدیمی برنامه یا هر راه دیگری
-- دور زده نشود. سرپرستی که در پروژه‌ی سرپرست دیگری فقط عضو است هم مثل تکنسین حساب می‌شود.
-- پروژه‌ای که سرپرست مشخص ندارد: فقط کاربر با نقش سرپرست (LEAD_TECHNICIAN) از همان پروژه.
--
-- مدیر QC، هماهنگ‌کننده، انبار، اندازه‌گیری و فروش تغییری نمی‌کنند.
-- چیزی از داده‌ها تغییر نمی‌کند و چندبار اجرا شدنش بی‌ضرر است.
-- در Supabase → SQL Editor کل فایل را یک‌جا اجرا کنید.
-- ==============================================================================

create or replace function public.talaie_enforce_crew_lead_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_lead text;
begin
  -- کارهای داخلی سرور / SQL Editor (بدون کاربر واردشده)
  if v_uid is null then
    return new;
  end if;

  if new.data is not distinct from old.data then
    return new;
  end if;

  if public.is_coordinator_or_manager() then
    return new;
  end if;

  v_role := public.talaie_my_role();
  if v_role is null or v_role not in ('TECHNICIAN', 'LEAD_TECHNICIAN') then
    return new;
  end if;

  v_lead := nullif(trim(coalesce(old.data->>'leadTechnicianId', '')), '');

  if v_lead is not null and v_lead = v_uid::text then
    return new;
  end if;

  if v_lead is null and v_role = 'LEAD_TECHNICIAN' then
    return new;
  end if;

  raise exception 'فقط سرپرست این پروژه می‌تواند مراحل کار (حرکت، شروع، پایان و اتمام) را ثبت کند. تکنسین‌ها ثبت ایراد و درخواست متریال دارند.'
    using errcode = '42501';
end;
$$;

revoke execute on function public.talaie_enforce_crew_lead_only() from public, anon;

drop trigger if exists trg_talaie_crew_lead_only on public.projects;
create trigger trg_talaie_crew_lead_only
  before update on public.projects
  for each row
  execute function public.talaie_enforce_crew_lead_only();
