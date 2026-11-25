-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۵: هم‌تراز کردن سرور با برنامه
--
-- چرا: بررسی مستقیم سرور واقعی (۴ آذر ۱۴۰۵) نشان داد مایگریشن‌های ۰۰۹ تا ۰۱۷ و ۰۲۱
-- هیچ‌وقت روی سرور اجرا نشده‌اند. نتیجه:
--   • جدول درخواست متریال وجود نداشت: درخواست تکنسین هرگز به انبار نمی‌رسید و
--     هر دستگاه فهرست خودش را داشت.
--   • جدول درخواست تغییر برنامه وجود نداشت (هماهنگ‌کننده ← مدیر QC).
--   • تابع ذخیره‌ی پروژه نسخه‌ی خیلی قدیمی (۰۰۸) بود: «رسیدم + عکس»، اتمام کار با
--     امضای کارفرما، کارهای انبار، هماهنگ‌کننده و اندازه‌گیری را رد می‌کرد و اعضای
--     اکیپ را مجاز نمی‌دانست.
-- این فایل نسخه‌ی نهایی و تست‌شده‌ی همین بخش‌ها را می‌سازد. چندبار اجرا شدنش بی‌ضرر است.
-- پیش‌نیاز: ۰۲۴ (اجرا شده). در Supabase → SQL Editor کل فایل را یک‌جا اجرا کنید.
-- ==============================================================================

-- ۰. تبدیل امن متن به uuid (شناسه‌ی اکیپ قدیمی مثل TEAM_1 دیگر خطا نمی‌دهد)
create or replace function public.talaie_try_uuid(v text)
returns uuid language plpgsql immutable as $$
begin
  if v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v::uuid;
end;
$$;

CREATE OR REPLACE FUNCTION public.is_scheduling_coordinator()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SCHEDULING_COORDINATOR' and active = true
  );
$function$;

-- ۱. درخواست‌های تغییر برنامه (هماهنگ‌کننده ← مدیر QC) -----------------------------
create table if not exists public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete set null,
  project_code text not null,
  project_title text not null,
  customer_name text,
  duration_hours numeric,
  previous_scheduled_date text not null,
  proposed_scheduled_date text not null,
  previous_end_date text,
  proposed_end_date text,
  previous_team_id uuid references public.installation_teams(id) on delete set null,
  proposed_team_id uuid references public.installation_teams(id) on delete set null,
  previous_team_name text,
  proposed_team_name text,
  reason text not null,
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by_user_name text not null,
  requested_at timestamptz not null default now(),
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING',
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_user_name text,
  reviewed_at timestamptz,
  review_notes text
);
alter table public.schedule_change_requests add column if not exists customer_name text;
alter table public.schedule_change_requests add column if not exists duration_hours numeric;

create index if not exists idx_schedule_change_project on public.schedule_change_requests(project_id);
create index if not exists idx_schedule_change_status on public.schedule_change_requests(status);

alter table public.schedule_change_requests enable row level security;
revoke all on public.schedule_change_requests from anon;

-- سیاست‌های RLS: خواندن برای پرسنل فعال، ثبت برای هماهنگ‌کننده و مدیر، بررسی منحصراً مدیر QC
drop policy if exists "Active users read schedule changes" on public.schedule_change_requests;
create policy "Active users read schedule changes"
  on public.schedule_change_requests for select to authenticated
  using (public.is_active_user());

drop policy if exists "Managers and Coordinators insert schedule changes" on public.schedule_change_requests;
create policy "Managers and Coordinators insert schedule changes"
  on public.schedule_change_requests for insert to authenticated
  with check (public.is_coordinator_or_manager());

drop policy if exists "QC Managers update schedule changes" on public.schedule_change_requests;
create policy "QC Managers update schedule changes"
  on public.schedule_change_requests for update to authenticated
  using (public.is_qc_manager()) with check (public.is_qc_manager());

drop policy if exists "QC Managers delete schedule changes" on public.schedule_change_requests;
create policy "QC Managers delete schedule changes"
  on public.schedule_change_requests for delete to authenticated
  using (public.is_qc_manager());

grant select, insert, update, delete on public.schedule_change_requests to authenticated;

CREATE OR REPLACE FUNCTION public.propose_schedule_change(p_project_id text, p_proposed_date text, p_proposed_end_date text, p_proposed_team_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  proj_rec record;
  requester_name text;
  req_id uuid;
  prev_team_name text;
  prop_team_name text;
  v_duration numeric;
  v_team_to_check uuid;
begin
  if not public.is_coordinator_or_manager() then
    raise exception 'فقط مسئول هماهنگی یا مدیر QC مجاز به ثبت درخواست تغییر زمان‌بندی است.';
  end if;

  if trim(p_reason) is null or length(trim(p_reason)) < 5 then
    raise exception 'ثبت علت تغییر برنامه زمان‌بندی (حداقل ۵ کاراکتر) الزامی است.';
  end if;

  select id, data into proj_rec
  from public.projects
  where id = p_project_id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', p_project_id;
  end if;

  v_duration := coalesce((proj_rec.data->>'requiredDurationHours')::numeric, 0);
  v_team_to_check := coalesce(p_proposed_team_id, public.talaie_try_uuid(proj_rec.data->>'assignedTeamId'));

  -- اعتبارسنجی ظرفیت و عدم تداخل پیش از ایجاد درخواست
  if v_team_to_check is not null then
    perform public.validate_schedule_capacity(
      p_project_id,
      v_team_to_check,
      p_proposed_date,
      p_proposed_end_date,
      proj_rec.data->>'scheduledTime',
      v_duration
    );
  end if;

  select name into requester_name
  from public.profiles
  where id = auth.uid();

  if proj_rec.data->>'assignedTeamId' is not null then
    select name into prev_team_name
    from public.installation_teams
    where id = public.talaie_try_uuid(proj_rec.data->>'assignedTeamId');
  end if;

  if p_proposed_team_id is not null then
    select name into prop_team_name
    from public.installation_teams
    where id = p_proposed_team_id;
  end if;

  req_id := gen_random_uuid();

  insert into public.schedule_change_requests (
    id,
    project_id,
    project_code,
    project_title,
    customer_name,
    duration_hours,
    previous_scheduled_date,
    proposed_scheduled_date,
    previous_end_date,
    proposed_end_date,
    previous_team_id,
    proposed_team_id,
    previous_team_name,
    proposed_team_name,
    reason,
    requested_by_user_id,
    requested_by_user_name,
    requested_at,
    status
  ) values (
    req_id,
    p_project_id,
    coalesce(proj_rec.data->>'code', ''),
    coalesce(proj_rec.data->>'title', ''),
    coalesce(proj_rec.data->>'customerName', ''),
    v_duration,
    coalesce(proj_rec.data->>'scheduledDate', ''),
    p_proposed_date,
    proj_rec.data->>'endDate',
    p_proposed_end_date,
    public.talaie_try_uuid(proj_rec.data->>'assignedTeamId'),
    p_proposed_team_id,
    prev_team_name,
    prop_team_name,
    trim(p_reason),
    auth.uid(),
    coalesce(requester_name, 'کاربر'),
    now(),
    'PENDING'
  );

  return jsonb_build_object('success', true, 'requestId', req_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_schedule_change(p_request_id uuid, p_decision text, p_review_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  req_rec record;
  reviewer_name text;
  patch_payload jsonb;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به تایید یا رد درخواست‌های تغییر برنامه است.';
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'تصمیم نامعتبر است: %', p_decision;
  end if;

  select * into req_rec
  from public.schedule_change_requests
  where id = p_request_id;

  if not found then
    raise exception 'درخواست مورد نظر یافت نشد.';
  end if;

  if req_rec.status != 'PENDING' then
    raise exception 'این درخواست قبلاً تعیین تکلیف شده است (وضعیت: %)', req_rec.status;
  end if;

  select name into reviewer_name
  from public.profiles
  where id = auth.uid();

  update public.schedule_change_requests
  set
    status = p_decision,
    reviewed_by_user_id = auth.uid(),
    reviewed_by_user_name = coalesce(reviewer_name, 'مدیر QC'),
    reviewed_at = now(),
    review_notes = trim(p_review_notes)
  where id = p_request_id;

  -- در صورت تایید، اعمال مستقیم تغییرات در پروژه مربوطه
  if p_decision = 'APPROVED' then
    patch_payload := jsonb_build_object(
      'scheduledDate', req_rec.proposed_scheduled_date,
      '_auditReason', 'تایید رسمی تغییر برنامه: ' || req_rec.reason
    );

    if req_rec.proposed_end_date is not null then
      patch_payload := patch_payload || jsonb_build_object('endDate', req_rec.proposed_end_date);
    end if;

    if req_rec.proposed_team_id is not null then
      patch_payload := patch_payload || jsonb_build_object(
        'assignedTeamId', req_rec.proposed_team_id::text,
        'assignedTeamName', req_rec.proposed_team_name
      );
    end if;

    perform public.patch_project(req_rec.project_id, patch_payload);
  end if;

  return jsonb_build_object('success', true, 'decision', p_decision);
end;
$function$;

revoke execute on function public.propose_schedule_change(text, text, text, uuid, text) from anon, public;
grant execute on function public.propose_schedule_change(text, text, text, uuid, text) to authenticated;
revoke execute on function public.review_schedule_change(uuid, text, text) from anon, public;
grant execute on function public.review_schedule_change(uuid, text, text) to authenticated;

-- ۲. درخواست‌های متریال (تکنسین ← انبار) --------------------------------------------
-- ۱. ایجاد جدول درخواست‌های متریال
create table if not exists public.material_requests (
  id text primary key,
  project_id text not null,
  data jsonb not null,
  status text not null default 'SUBMITTED',
  urgency text not null default 'NORMAL',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_requests enable row level security;

-- ایندکس‌ها جهت تسریع جستجو و مانیتورینگ
create index if not exists idx_material_requests_project_id on public.material_requests(project_id);
create index if not exists idx_material_requests_status on public.material_requests(status);
create index if not exists idx_material_requests_created_by on public.material_requests(created_by);
create index if not exists idx_material_requests_updated_at on public.material_requests(updated_at desc);

-- ۲. سیاست‌های RLS
revoke all on public.material_requests from anon;

drop policy if exists "Authenticated active users can read material requests" on public.material_requests;
create policy "Authenticated active users can read material requests"
  on public.material_requests for select to authenticated
  using (public.is_active_user());

drop policy if exists "Authenticated users can insert material requests" on public.material_requests;
create policy "Authenticated users can insert material requests"
  on public.material_requests for insert to authenticated
  with check (
    public.is_active_user() and (
      public.is_coordinator_or_manager() or
      created_by = auth.uid()
    )
  );

drop policy if exists "QC Managers can delete material requests" on public.material_requests;
create policy "QC Managers can delete material requests"
  on public.material_requests for delete to authenticated
  using (public.is_qc_manager());

grant select, insert, update, delete on public.material_requests to authenticated;

CREATE OR REPLACE FUNCTION public.create_material_request(id text, request_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_existing record;
  v_project jsonb;
  v_req_project_id text := request_data->>'projectId';
begin
  -- الف) احراز هویت و فعال بودن کاربر
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(request_data) is distinct from 'object' then
    raise exception 'Request data must be a valid JSON object';
  end if;

  if v_req_project_id is null or trim(v_req_project_id) = '' then
    raise exception 'شناسه پروژه در درخواست متریال الزامی است.';
  end if;

  -- ب) دریافت پروژه و بررسی دسترسی کاربر
  select data into v_project
  from public.projects
  where public.projects.id = v_req_project_id;

  if v_project is null then
    raise exception 'پروژه مرتبط با این درخواست یافت نشد: %', v_req_project_id;
  end if;

  if not public.is_coordinator_or_manager() then
    if not public.talaie_is_assigned(v_project) then
      raise exception 'دسترسی غیرمجاز: شما به این پروژه دسترسی ندارید.';
    end if;

    if coalesce(request_data->>'status', 'SUBMITTED') != 'SUBMITTED' then
      raise exception 'دسترسی غیرمجاز: درخواست جدید توسط تکنسین فقط با وضعیت SUBMITTED قابل ثبت است.';
    end if;

    if request_data ? 'dispatches' and jsonb_array_length(request_data->'dispatches') > 0 then
      raise exception 'دسترسی غیرمجاز: ثبت مشخصات ارسال در زمان ایجاد درخواست در صلاحیت تکنسین نیست.';
    end if;

    if (request_data->>'requestedByUserId') is distinct from auth.uid()::text then
      raise exception 'دسترسی غیرمجاز: ثبت درخواست متریال فقط با هویت خودتان مجاز است.';
    end if;
  end if;

  -- ج) درج اتمیک در جدول؛ در صورت تکرار یا همزمانی شناسه، خطای 23505 با رفتار ایدمپوتنت مدیریت می‌شود
  begin
    insert into public.material_requests (
      id,
      project_id,
      data,
      status,
      urgency,
      created_by,
      created_at,
      updated_at
    ) values (
      create_material_request.id,
      v_req_project_id,
      request_data,
      coalesce(request_data->>'status', 'SUBMITTED'),
      coalesce(request_data->>'urgency', 'NORMAL'),
      auth.uid(),
      coalesce((request_data->>'requestedAt')::timestamptz, now()),
      now()
    );

    return request_data;
  exception
    when unique_violation then
      -- در صورت برخورد همزمانی یا تکرار مجاز شناسه در صف آفلاین
      select * into v_existing
      from public.material_requests
      where public.material_requests.id = create_material_request.id;

      if not found then
        raise exception 'خطای غیرمنتظره در ثبت همزمان درخواست متریال.';
      end if;

      -- ممانعت از افشا یا استفاده از شناسه پروژه/کاربر دیگر (Conflicting ID Reuse Prevention)
      if v_existing.project_id is distinct from v_req_project_id then
        raise exception 'تعارض شناسه: این شناسه درخواست قبلاً برای پروژه دیگری ثبت گردیده است.';
      end if;

      if not public.is_coordinator_or_manager() and v_existing.created_by is distinct from auth.uid() then
        raise exception 'تعارض شناسه: این شناسه متعلق به درخواست کاربر دیگری است.';
      end if;

      return v_existing.data;
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.patch_material_request(id text, patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_current record;
  v_updated_data jsonb;
  v_new_status text;
  v_project jsonb;
  patch_key text;
  v_old_dispatches jsonb;
  v_new_dispatches jsonb;
  v_old_d jsonb;
  v_new_d jsonb;
  i int;
  j int;
  d_found boolean;
  v_all_dispatches_confirmed boolean := true;
  v_history jsonb;
  v_receipt_event jsonb;
  v_user_name text;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  select * into v_current
  from public.material_requests
  where public.material_requests.id = patch_material_request.id
  for update;

  if not found then
    raise exception 'درخواست متریال مورد نظر یافت نشد: %', patch_material_request.id;
  end if;

  -- دریافت پروژه مرتبط جهت کنترل دسترسی تکنسین
  select data into v_project
  from public.projects
  where public.projects.id = v_current.project_id;

  -- اعتبارسنجی سطح دسترسی و لیست سفید تکنسین
  if not public.is_coordinator_or_manager() and coalesce(public.talaie_my_role(), '') not in ('WAREHOUSE', 'CEO') then
    if v_project is null or not public.talaie_is_assigned(v_project) then
      raise exception 'دسترسی غیرمجاز: شما به این پروژه دسترسی ندارید.';
    end if;

    -- الف) لیست سفید سخت‌گیرانه فیلدهای مجاز تکنسین (Strict Key Whitelist)
    -- تکنسین به هیچ وجه اجازه تغییر اقلام درخواستی (items)، پروژه، متادیتا، تاریخچه (history) یا فوریت را ندارد
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in ('status', 'dispatches', 'updatedAt') then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه ویرایش فیلد «%» را در درخواست متریال ندارد.', patch_key;
      end if;
    end loop;

    -- ب) حفاظت از سوابق ارسال (dispatches): تکنسین فقط می‌تواند فیلد تایید دریافت کارگاه را علامت بزند
    if patch ? 'dispatches' then
      if jsonb_typeof(patch->'dispatches') is distinct from 'array' then
        raise exception 'دسترسی غیرمجاز: مشخصات ارسال باید آرایه معتبر باشد.';
      end if;

      v_old_dispatches := coalesce(v_current.data->'dispatches', '[]'::jsonb);
      v_new_dispatches := patch->'dispatches';

      -- تعداد محموله‌های ارسالی نباید توسط تکنسین کم یا زیاد شود
      if jsonb_array_length(v_new_dispatches) != jsonb_array_length(v_old_dispatches) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه افزودن یا حذف محموله‌های ارسالی را ندارد.';
      end if;

      -- بررسی تک‌تک محموله‌ها
      for i in 0 .. (jsonb_array_length(v_old_dispatches) - 1) loop
        v_old_d := v_old_dispatches->i;
        d_found := false;

        for j in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
          v_new_d := v_new_dispatches->j;
          if v_new_d->>'id' = v_old_d->>'id' then
            d_found := true;

            -- مشخصات بارنامه، پیک، اقلام ارسالی و فرستنده نباید تغییر کند
            if (v_new_d->>'courierInfo') is distinct from (v_old_d->>'courierInfo') or
               (v_new_d->>'trackingCode') is distinct from (v_old_d->>'trackingCode') or
               (v_new_d->>'dispatchedByUserId') is distinct from (v_old_d->>'dispatchedByUserId') or
               (v_new_d->>'dispatchedAt') is distinct from (v_old_d->>'dispatchedAt') or
               (v_new_d->'items') is distinct from (v_old_d->'items') then
              raise exception 'دسترسی غیرمجاز: مشخصات محموله ارسالی توسط تکنسین قابل تغییر نیست.';
            end if;

            -- تکنسین اجازه ثبت manager override در محموله را ندارد
            if (v_new_d->>'isManagementOverride')::boolean = true then
              raise exception 'دسترسی غیرمجاز: ثبت مجوز مدیریتی منحصراً در صلاحیت مدیر ارشد است.';
            end if;

            -- اگر محموله قبلاً تایید شده، نباید تغییر وضعیت دهد
            if (v_old_d->>'receivedAtSiteConfirmed')::boolean = true and
               (v_new_d->>'receivedAtSiteConfirmed')::boolean != true then
              raise exception 'دسترسی غیرمجاز: وضعیت تحویل تاییدشده قبلی قابل بازگشت نیست.';
            end if;

            -- اگر تایید تحویل در این پچ اضافه شده است، هویت ثبت‌کننده باید مطابق با خود تکنسین باشد
            if (v_new_d->>'receivedAtSiteConfirmed')::boolean = true and
               coalesce((v_old_d->>'receivedAtSiteConfirmed')::boolean, false) = false then
              if (v_new_d->>'receivedAtSiteConfirmedByUserId') is distinct from auth.uid()::text then
                raise exception 'دسترسی غیرمجاز: تایید تحویل فقط با هویت خودتان مجاز است.';
              end if;
            end if;

            exit;
          end if;
        end loop;

        if not d_found then
          raise exception 'دسترسی غیرمجاز: دستکاری یا جایگزینی شناسه‌های محموله مجاز نیست.';
        end if;
      end loop;
    end if;

    -- ج) اعتبارسنجی تغییر وضعیت (status): تکنسین فقط مجاز به تایید تحویل کامل است
    if patch ? 'status' then
      if patch->>'status' in ('DISPATCHED', 'PARTIALLY_DISPATCHED', 'IN_PROCUREMENT', 'REJECTED', 'CANCELLED', 'SUBMITTED') then
        raise exception 'دسترسی غیرمجاز: تکنسین امکان تغییر وضعیت به «%» را ندارد.', patch->>'status';
      end if;

      if patch->>'status' = 'DELIVERED_CONFIRMED' then
        if v_current.status not in ('DISPATCHED', 'PARTIALLY_DISPATCHED') then
          raise exception 'دسترسی غیرمجاز: تایید تحویل فقط برای درخواست‌هایی که حداقل بخشی از اقلام آن‌ها ارسال شده است مجاز می‌باشد.';
        end if;

        -- بررسی اینکه آیا تمام محموله‌ها تایید دریافت شده‌اند یا خیر
        v_new_dispatches := coalesce(patch->'dispatches', v_current.data->'dispatches', '[]'::jsonb);
        if jsonb_array_length(v_new_dispatches) = 0 then
          raise exception 'دسترسی غیرمجاز: این درخواست فاقد محموله ارسالی است.';
        end if;

        for i in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
          if coalesce((v_new_dispatches->i->>'receivedAtSiteConfirmed')::boolean, false) != true then
            v_all_dispatches_confirmed := false;
            exit;
          end if;
        end loop;

        if not v_all_dispatches_confirmed then
          raise exception 'امکان ثبت تحویل قطعی وجود ندارد: هنوز برخی محموله‌های ارسالی سر کارگاه تایید دریافت نشده‌اند.';
        end if;
      else
        raise exception 'دسترسی غیرمجاز: تغییر وضعیت درخواستی برای تکنسین مجاز نیست.';
      end if;
    end if;
  end if;

  -- اعمال ادغام داده‌ها
  v_updated_data := v_current.data || patch;
  v_new_status := coalesce(v_updated_data->>'status', v_current.status);

  -- د) ثبت ماندگار رویداد تایید تحویل در تاریخچه توسط سرور (Durable Server-Side Receipt History)
  -- تکنسین اجازه ارسال یا بازنویسی history را ندارد؛ سرور رویداد را بر اساس هویت احرازشده تولید و ضمیمه می‌کند
  if patch ? 'dispatches' then
    v_old_dispatches := coalesce(v_current.data->'dispatches', '[]'::jsonb);
    v_new_dispatches := patch->'dispatches';
    v_history := coalesce(v_updated_data->'history', '[]'::jsonb);

    if jsonb_typeof(v_new_dispatches) = 'array' then
      for j in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
        v_new_d := v_new_dispatches->j;
        v_old_d := null;

        for i in 0 .. (jsonb_array_length(v_old_dispatches) - 1) loop
          if v_old_dispatches->i->>'id' = v_new_d->>'id' then
            v_old_d := v_old_dispatches->i;
            exit;
          end if;
        end loop;

        -- اگر وضعیت این محموله در پچ جاری به «تایید شده» تغییر یافته است
        if (v_new_d->>'receivedAtSiteConfirmed')::boolean = true and
           coalesce((v_old_d->>'receivedAtSiteConfirmed')::boolean, false) = false then

          -- دریافت نام کاربر احرازشده از جدول profiles (بدون اتکا به فیلدهای کلاینت)
          select full_name into v_user_name
          from public.profiles
          where public.profiles.id = auth.uid();

          v_receipt_event := jsonb_build_object(
            'id', 'mat-act-' || (v_new_d->>'id') || '-recv',
            'timestamp', coalesce(v_new_d->>'receivedAtSiteConfirmedAt', now()::text),
            'serverRecordedAt', now()::text,
            'action', 'CONFIRMED_RECEIPT',
            'byUserId', auth.uid()::text,
            'byUserName', coalesce(nullif(trim(v_user_name), ''), 'کاربر احرازشده'),
            'note', 'تایید دریافت محموله پیک «' || coalesce(v_new_d->>'courierInfo', v_old_d->>'courierInfo', '') || '» سر کارگاه توسط ' || coalesce(nullif(trim(v_user_name), ''), 'کاربر احرازشده')
          );

          -- اطمینان از ایدمپوتنت بودن و عدم ایجاد لاگ تکراری در صورت Replay یا Retry صف آفلاین
          if not exists (
            select 1
            from jsonb_array_elements(v_history) elem
            where elem->>'id' = ('mat-act-' || (v_new_d->>'id') || '-recv')
          ) then
            v_history := v_history || jsonb_build_array(v_receipt_event);
          end if;
        end if;
      end loop;

      v_updated_data := jsonb_set(v_updated_data, '{history}', v_history);
    end if;
  end if;

  update public.material_requests
  set
    data = v_updated_data,
    status = v_new_status,
    urgency = coalesce(v_updated_data->>'urgency', v_current.urgency),
    updated_at = now()
  where public.material_requests.id = patch_material_request.id;

  return v_updated_data;
end;
$function$;

revoke execute on function public.create_material_request(text, jsonb) from anon, public;
grant execute on function public.create_material_request(text, jsonb) to authenticated;
revoke execute on function public.patch_material_request(text, jsonb) from anon, public;
grant execute on function public.patch_material_request(text, jsonb) to authenticated;

-- ۳. تایید گزارش روزانه توسط سرپرست ------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_daily_log(p_project_id text, p_log_id text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_project jsonb;
  v_logs jsonb;
  v_updated_logs jsonb := '[]'::jsonb;
  v_log jsonb;
  v_found boolean := false;
  v_user_name text;
  v_is_lead boolean := false;
  i int;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  select data into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد.';
  end if;

  -- بررسی صلاحیت کاربر: فقط مدیر QC، سرپرست پروژه، یا سرپرست اکیپ منتسب
  if public.is_qc_manager() then
    v_is_lead := true;
  elsif v_project->>'leadTechnicianId' = auth.uid()::text then
    v_is_lead := true;
  elsif v_project->>'assignedTeamId' is not null and exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.team_id::text = v_project->>'assignedTeamId'
      and tm.role_in_team = 'LEAD'
  ) then
    v_is_lead := true;
  end if;

  if not v_is_lead then
    raise exception 'دسترسی غیرمجاز: تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.';
  end if;

  select name into v_user_name
  from public.profiles
  where id = auth.uid();

  v_logs := coalesce(v_project->'dailyLogs', '[]'::jsonb);

  for i in 0 .. (jsonb_array_length(v_logs) - 1) loop
    v_log := v_logs->i;
    if v_log->>'id' = p_log_id then
      v_found := true;
      if (v_log->>'supervisorConfirmed')::boolean = true then
        raise exception 'این گزارش روزانه قبلاً توسط سرپرست تایید شده است.';
      end if;
      v_log := v_log || jsonb_build_object(
        'supervisorConfirmed', true,
        'supervisorConfirmedBy', coalesce(v_user_name, 'سرپرست اکیپ'),
        'supervisorConfirmedAt', now()::text,
        'supervisorNotes', p_notes
      );
    end if;
    v_updated_logs := v_updated_logs || jsonb_build_array(v_log);
  end loop;

  if not v_found then
    raise exception 'گزارش روزانه مورد نظر یافت نشد.';
  end if;

  update public.projects
  set data = jsonb_set(data, '{dailyLogs}', v_updated_logs),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_project_id
  returning data into v_project;

  return v_project;
end;
$function$;

revoke execute on function public.confirm_daily_log(text, text, text) from anon, public;
grant execute on function public.confirm_daily_log(text, text, text) to authenticated;

-- ۴. تابع ذخیره‌ی پروژه: نسخه‌ی نهایی (قوانین نقش‌ها، اکیپ، عکس قبل از نصب، اتمام کار،
--    انتقال اکیپ، نقص‌های QC، گیت انبار) -----------------------------------------------
CREATE OR REPLACE FUNCTION public.patch_project(id text, patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  updated_data jsonb;
  current_data jsonb;
  merged_data jsonb;
  patch_key text;
  v_user_role text;
  v_user_team_id text;
  v_current_status text;
  v_new_status text;
  v_latest_transfer jsonb;
  v_transfers_count int;
  v_curr_transfers_count int;
  v_defect jsonb;
  v_defects jsonb;
  v_curr_defects jsonb;
  v_has_critical_defect boolean := false;
  v_inspections_count int;
  v_curr_inspections_count int;
  prod_confirmed boolean;
  wh_confirmed boolean;
  is_scheduling boolean := false;
  v_team_id uuid;
  v_sched_date text;
  v_end_date text;
  v_sched_time text;
  v_duration numeric;
begin
  -- ۱. بررسی فعال بودن کاربر
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  -- ممانعت از ارسال تصاویر خام base64 در پچ
  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  -- ذخیره دلیل ممیزی در تنظیمات محلی تراکنش
  if patch ? '_auditReason' then
    perform set_config('talaie.audit_reason', patch->>'_auditReason', true);
    patch := patch - '_auditReason';
  end if;

  -- قفل ردیف با FOR UPDATE
  select data into current_data
  from public.projects
  where public.projects.id = patch_project.id
  for update;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- ممانعت از جعل یا دستکاری دستی پرچم سوابق تاریخی
  if patch ? 'technicalHandover' and (patch->'technicalHandover' ? 'isHistoricalMigration') then
    raise exception 'دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.';
  end if;

  -- دریافت مشخصات کاربر جاری
  select role, team_id into v_user_role, v_user_team_id
  from public.profiles
  where public.profiles.id = auth.uid();

  v_current_status := current_data->>'status';
  v_new_status := coalesce(patch->>'status', v_current_status);
  merged_data := current_data || patch;

  -- ============================================================================
  -- ۲. محافظت از طرح اولیه نصب (P2.1 Original Plan Immutability Guard)
  -- ============================================================================
  if patch ? 'originalPlan' then
    if (current_data ? 'originalPlan' and (
         (current_data->'originalPlan' ? 'lockedAt' and current_data->'originalPlan'->>'lockedAt' is not null) or
         (current_data->>'status') != 'MEASUREMENT_PENDING'
       )) then
      raise exception 'دسترسی غیرمجاز: طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است. برای هرگونه اصلاح در مقادیر، باید از فرآیند رسمی بازنگری طرح (Plan Amendment) استفاده شود.';
    end if;
    if not public.is_qc_manager() then
      raise exception 'دسترسی غیرمجاز: تعریف طرح اولیه فقط در صلاحیت مدیر QC است.';
    end if;
  end if;

  -- ============================================================================
  -- ۳. محافظت از بازنگری‌های طرح (P2.1 Plan Amendments Lifecycle & Stale Concurrency)
  -- ============================================================================
  if patch ? 'planAmendments' then
    if jsonb_typeof(patch->'planAmendments') is distinct from 'array' then
      raise exception 'دسترسی غیرمجاز: لیست بازنگری‌های طرح باید آرایه معتبر باشد.';
    end if;

    declare
      existing_amends jsonb := coalesce(current_data->'planAmendments', '[]'::jsonb);
      new_amends jsonb := patch->'planAmendments';
      old_item jsonb;
      matched_new_item jsonb;
      new_item jsonb;
      j int;
      k int;
      found_in_new boolean;
      found_in_old boolean;
      old_status text;
      new_status text;
    begin
      -- الف) صیانت از تاریخچه: هیچ اصلاحیه نهایی‌شده‌ای قابل حذف نیست
      for j in 0 .. (jsonb_array_length(existing_amends) - 1) loop
        old_item := existing_amends->j;
        old_status := old_item->>'status';

        found_in_new := false;
        for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
          matched_new_item := new_amends->k;
          if matched_new_item->>'id' = old_item->>'id' then
            found_in_new := true;
            exit;
          end if;
        end loop;

        if not found_in_new and old_status in ('APPROVED', 'REJECTED') then
          raise exception 'دسترسی غیرمجاز: حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست.';
        end if;

        -- ب) صیانت از تغییرناپذیری مقادیر اصلاحیه‌های تاییدشده قبلی
        if found_in_new and old_status = 'APPROVED' then
          if (matched_new_item->>'status') != 'APPROVED' then
            raise exception 'دسترسی غیرمجاز: وضعیت اصلاحیه تاییدشده قابل بازگشت نیست.';
          end if;
          if (matched_new_item->>'activityId') is distinct from (old_item->>'activityId') or
             ((matched_new_item->>'previousQuantity')::numeric) is distinct from ((old_item->>'previousQuantity')::numeric) or
             ((matched_new_item->>'newQuantity')::numeric) is distinct from ((old_item->>'newQuantity')::numeric) or
             (matched_new_item->>'reason') is distinct from (old_item->>'reason') or
             (matched_new_item->>'requestedByUserId') is distinct from (old_item->>'requestedByUserId') or
             (matched_new_item->>'requestedAt') is distinct from (old_item->>'requestedAt') or
             (matched_new_item->>'reviewedByUserId') is distinct from (old_item->>'reviewedByUserId') or
             (matched_new_item->>'reviewedAt') is distinct from (old_item->>'reviewedAt') then
            raise exception 'دسترسی غیرمجاز: اصلاحیه تاییدشده قبلی غیرقابل تغییر است. برای هرگونه تغییر در مقادیر، اصلاحیه جدید ثبت کنید.';
          end if;
        end if;

        -- ج) اصلاحیه ردشده نیز نمی‌تواند دستخوش تغییر یا بازگشت وضعیت شود
        if found_in_new and old_status = 'REJECTED' then
          if (matched_new_item->>'status') != 'REJECTED' then
            raise exception 'دسترسی غیرمجاز: اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست. برای بازنگری باید اصلاحیه جدید ثبت شود.';
          end if;
        end if;
      end loop;

      -- د) فقط مدیر QC مجاز به تایید بازنگری است (تغییر وضعیت به APPROVED)
      for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
        new_item := new_amends->k;
        new_status := new_item->>'status';

        if new_status = 'APPROVED' then
          found_in_old := false;
          for j in 0 .. (jsonb_array_length(existing_amends) - 1) loop
            old_item := existing_amends->j;
            if old_item->>'id' = new_item->>'id' and old_item->>'status' = 'APPROVED' then
              found_in_old := true;
              exit;
            end if;
          end loop;

          if not found_in_old then
            if not public.is_qc_manager() then
              raise exception 'دسترسی غیرمجاز: تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است.';
            end if;

            -- اعتبارسنجی همزمانی و عدم تایید اصلاحیه منقضی‌شده (Stale Concurrency Check)
            declare
              v_act_id text := new_item->>'activityId';
              v_current_effective numeric := null;
              v_cand_amend jsonb;
              m int;
              v_plan_acts jsonb := current_data->'originalPlan'->'activities';
              v_act_item jsonb;
            begin
              for m in 0 .. (jsonb_array_length(existing_amends) - 1) loop
                v_cand_amend := existing_amends->m;
                if v_cand_amend->>'activityId' = v_act_id and v_cand_amend->>'status' = 'APPROVED' then
                  v_current_effective := (v_cand_amend->>'newQuantity')::numeric;
                end if;
              end loop;

              if v_current_effective is null and v_plan_acts is not null and jsonb_typeof(v_plan_acts) = 'array' then
                for m in 0 .. (jsonb_array_length(v_plan_acts) - 1) loop
                  v_act_item := v_plan_acts->m;
                  if v_act_item->>'id' = v_act_id then
                    v_current_effective := (v_act_item->>'plannedQuantity')::numeric;
                    exit;
                  end if;
                end loop;
              end if;

              if v_current_effective is not null and ((new_item->>'previousQuantity')::numeric) is distinct from v_current_effective then
                raise exception 'خطای همزمانی اصلاحیه: مقدار قبلی (% لت) با آخرین سقف مصوب جاری (% لت) مطابقت ندارد. این درخواست بر مبنای مقادیر منقضی‌شده ثبت گردیده است.',
                  new_item->>'previousQuantity', v_current_effective;
              end if;
            end;
          end if;
        end if;
      end loop;
    end;
  end if;

  -- ============================================================================
  -- ۴. اعتبارسنجی زمان‌بندی و ظرفیت اکیپ (P1 Capacity & Pre-requisite Validation)
  -- ============================================================================
  if patch ? 'status' and (patch->>'status') in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED') then
    is_scheduling := true;
  end if;
  if patch ? 'scheduledDate' and patch->>'scheduledDate' is not null and patch->>'scheduledDate' != '' then
    is_scheduling := true;
  end if;
  if patch ? 'assignedTeamId' and patch->>'assignedTeamId' is not null and patch->>'assignedTeamId' != '' then
    is_scheduling := true;
  end if;
  if patch ? 'requiredDurationHours' then
    is_scheduling := true;
  end if;

  if is_scheduling then
    -- پیش‌نیاز اتمام تولید و تحویل به انبار
    if coalesce(current_data->'technicalHandover'->>'isHistoricalMigration', 'false') <> 'true' then
      prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
      wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

      if not coalesce(wh_confirmed, false) and coalesce(patch->>'status', '') in ('EN_ROUTE', 'IN_PROGRESS') and (current_data ? 'technicalHandover' or patch ? 'technicalHandover' or coalesce(current_data->>'status', '') = 'MEASUREMENT_PENDING') then
        raise exception 'دسترسی غیرمجاز: پروژه تا زمان تأیید ورود کالا به انبار، قابل اعزام اکیپ و شروع کار نیست.';
      end if;
    end if;

    -- اعتبارسنجی ظرفیت و تداخلات همزمانی
    if merged_data->>'assignedTeamId' is not null and merged_data->>'assignedTeamId' <> '' then
      v_team_id := public.talaie_try_uuid(merged_data->>'assignedTeamId');
      v_sched_date := merged_data->>'scheduledDate';
      v_end_date := merged_data->>'endDate';
      v_sched_time := merged_data->>'scheduledTime';
      v_duration := coalesce((merged_data->>'requiredDurationHours')::numeric, 0);

      perform public.validate_schedule_capacity(
        patch_project.id,
        v_team_id,
        v_sched_date,
        v_end_date,
        v_sched_time,
        v_duration
      );
    end if;
  end if;

  -- ============================================================================
  -- ۵. گیت مسدودسازی انتقال اکیپ (P2.2 Team Transfer Execution Gate)
  -- ============================================================================
  if current_data ? 'teamTransfers' and jsonb_array_length(current_data->'teamTransfers') > 0 then
    v_transfers_count := jsonb_array_length(current_data->'teamTransfers');
    v_latest_transfer := current_data->'teamTransfers'->(v_transfers_count - 1);

    if not (
      coalesce((v_latest_transfer->>'receivingLeadConfirmed')::boolean, false) = true or
      (
        coalesce((v_latest_transfer->>'isManagerOverride')::boolean, false) = true and
        coalesce(v_latest_transfer->>'managerOverrideRole', '') = 'QC_MANAGER' and
        coalesce(v_latest_transfer->>'managerOverrideByUserId', '') != '' and
        coalesce(trim(v_latest_transfer->>'managerOverrideReason'), '') != '' and
        coalesce((v_latest_transfer->>'receivingLeadConfirmed')::boolean, false) = false
      )
    ) then
      if v_new_status in ('EN_ROUTE', 'IN_PROGRESS') and v_new_status is distinct from v_current_status then
        raise exception 'شروع یا ادامه کار مسدود است: پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ جدید یا رفع انسداد توسط مدیر QC است.';
      end if;
    end if;
  end if;

  -- اعتبارسنجی تغییرات در آرایه teamTransfers
  if patch ? 'teamTransfers' then
    v_curr_transfers_count := coalesce(jsonb_array_length(current_data->'teamTransfers'), 0);
    v_transfers_count := jsonb_array_length(patch->'teamTransfers');

    if v_transfers_count < v_curr_transfers_count then
      raise exception 'دسترسی غیرمجاز: حذف سوابق انتقال اکیپ مجاز نیست.';
    end if;

    if not public.is_qc_manager() then
      if v_transfers_count > v_curr_transfers_count then
        raise exception 'دسترسی غیرمجاز: ثبت انتقال جدید فقط در صلاحیت مدیر QC است.';
      end if;

      v_latest_transfer := patch->'teamTransfers'->(v_transfers_count - 1);

      if (v_latest_transfer->>'receivingLeadConfirmed')::boolean = true and
         coalesce((current_data->'teamTransfers'->(v_curr_transfers_count - 1)->>'receivingLeadConfirmed')::boolean, false) = false then
        
        if auth.uid()::text != current_data->>'leadTechnicianId' or
           v_user_role != 'LEAD_TECHNICIAN' or
           v_user_team_id is distinct from (v_latest_transfer->>'toTeamId') then
          raise exception 'دسترسی غیرمجاز: تایید صورت‌جلسه تحویل کار منحصراً در صلاحیت سرپرست رسمی اکیپ مقصد است.';
        end if;
      end if;

      if (v_latest_transfer->>'isManagerOverride')::boolean = true then
        raise exception 'دسترسی غیرمجاز: ثبت رفع انسداد مدیریتی منحصراً در صلاحیت مدیر QC است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ۶. گیت تایید نهایی QC و عیوب بحرانی (P3 Final QC Approval & Critical Defects)
  -- ============================================================================
  if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
    if not public.is_qc_manager() then
      if v_user_role in ('TECHNICIAN', 'LEAD_TECHNICIAN') then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.';
      else
        raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
      end if;
    end if;

    v_defects := coalesce(patch->'qcDefects', current_data->'qcDefects', '[]'::jsonb);
    for v_defect in select * from jsonb_array_elements(v_defects) loop
      if v_defect->>'severity' = 'CRITICAL' and v_defect->>'status' not in ('RESOLVED', 'VERIFIED') then
        v_has_critical_defect := true;
        exit;
      end if;
    end loop;

    if v_has_critical_defect then
      raise exception 'امکان صدور تأیید نهایی QC وجود ندارد: پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است.';
    end if;
  end if;

  -- صیانت از تغییرناپذیری تاریخچه بازرسی‌های کیفی
  if patch ? 'qcInspections' then
    if not public.is_qc_manager() then
      raise exception 'دسترسی غیرمجاز: ثبت رسمی برگه بازرسی کنترل کیفی منحصراً در صلاحیت مدیر ارشد QC است.';
    end if;
    v_curr_inspections_count := coalesce(jsonb_array_length(current_data->'qcInspections'), 0);
    v_inspections_count := jsonb_array_length(patch->'qcInspections');
    if v_inspections_count < v_curr_inspections_count then
      raise exception 'دسترسی غیرمجاز: حذف یا کاهش سوابق بازرسی‌های کیفی مجاز نیست.';
    end if;
  end if;

  -- ============================================================================
  -- ۷. محدودیت‌های نقش هماهنگ‌کننده زمان‌بندی (SCHEDULING_COORDINATOR)
  -- ============================================================================
  if public.is_scheduling_coordinator() then
    if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
      raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
    end if;
    if patch ? 'qcScore' and patch->>'qcScore' is not null then
      raise exception 'دسترسی غیرمجاز: ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است.';
    end if;
  end if;

  -- ============================================================================
  -- ۸. محدودیت‌های تکنسین‌ها و سرپرستان اکیپ (TECHNICIAN / LEAD_TECHNICIAN)
  -- ============================================================================
  if not public.is_coordinator_or_manager() and not public.talaie_role_patch_ok(patch) then
    if not public.talaie_is_assigned(current_data) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- الف) کلیدهای مجاز پچ برای تکنسین
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in (
        'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
        'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
        'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
        'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
        'workSessions', 'dailyLogs', 'siteReadiness', 'planAmendments',
        'isExceptionalCompletion', 'exceptionalCompletionDetails',
        'teamTransfers', 'qcDefects', 'customerAcceptance',
        'handoverSigneeType', 'representativeName', 'representativeRole',
        'representativePhone', 'unavailabilityReason', 'unavailabilityPhotos', 'interTeamHandover', 'customerDisclaimerAgreed', 'preInstallPhotosConfirmed', 'secondMeasurementDetails', 'warehousePrep'
      ) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
      end if;
    end loop;

    -- ب) وضعیت QC برای تکنسین
    if patch ? 'qcStatus' then
      if patch->>'qcStatus' != 'PENDING' then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
      end if;
      if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
        raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
      end if;
    end if;

    -- ج) ماشین وضعیت مجاز برای تکنسین (شامل PAUSED)
    if patch ? 'status' and patch->>'status' is distinct from current_data->>'status' then
      declare
        curr_st text := current_data->>'status';
        new_st text := patch->>'status';
      begin
        if not (
          (curr_st = 'SCHEDULED' and new_st = 'EN_ROUTE') or
          (curr_st = 'EN_ROUTE' and new_st = 'IN_PROGRESS') or
          (curr_st = 'IN_PROGRESS' and new_st = 'COMPLETED') or
          (curr_st in ('EN_ROUTE', 'IN_PROGRESS') and new_st = 'STUCK') or
          (curr_st = 'IN_PROGRESS' and new_st = 'PAUSED') or
          (curr_st = 'PAUSED' and new_st = 'EN_ROUTE') or
          (curr_st = 'PAUSED' and new_st = 'IN_PROGRESS') or
          (curr_st = 'PAUSED' and new_st = 'STUCK')
        ) then
          raise exception 'انتقال وضعیت از «%» به «%» برای تکنسین مجاز نیست.', coalesce(curr_st, 'نامشخص'), new_st;
        end if;
      end;
    end if;

    -- د) بررسی گزارش توقف (stuckIncidents - فقط الحاق حادثه باز جدید)
    if patch ? 'stuckIncidents' then
      declare
        curr_incidents jsonb := coalesce(
          case
            when current_data ? 'stuckIncidents' and jsonb_typeof(current_data->'stuckIncidents') = 'array'
              then current_data->'stuckIncidents'
            when current_data ? 'stuckIncident' and current_data->'stuckIncident' is not null and jsonb_typeof(current_data->'stuckIncident') = 'object'
              then jsonb_build_array(current_data->'stuckIncident')
            else '[]'::jsonb
          end,
          '[]'::jsonb
        );
        new_incidents jsonb := patch->'stuckIncidents';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_incidents) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;
        curr_len := jsonb_array_length(curr_incidents);
        new_len := jsonb_array_length(new_incidents);
        if new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;
        for i in 0 .. (curr_len - 1) loop
          if (curr_incidents->i) is distinct from (new_incidents->i) then
            raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
          end if;
        end loop;
        if (new_incidents->(new_len - 1)->>'resolutionStatus') is distinct from 'OPEN' then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;
      end;
    end if;

    -- هـ) بررسی dailyLogs (فقط الحاق مجاز است، تاییدیه فقط توسط سرپرست)
    if patch ? 'dailyLogs' then
      declare
        curr_logs jsonb := coalesce(current_data->'dailyLogs', '[]'::jsonb);
        new_logs jsonb := patch->'dailyLogs';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_logs) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: لاگ روزانه باید آرایه باشد.';
        end if;
        curr_len := jsonb_array_length(curr_logs);
        new_len := jsonb_array_length(new_logs);
        if new_logs = curr_logs then
          null;
        elsif new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند لاگ روزانه جدید الصاق کند.';
        else
          for i in 0 .. (curr_len - 1) loop
            if (curr_logs->i) is distinct from (new_logs->i) then
              raise exception 'دسترسی غیرمجاز: ویرایش لاگ‌های روزانه قبلی مجاز نیست.';
            end if;
          end loop;
          if (new_logs->(new_len - 1)->>'byUserId') is distinct from auth.uid()::text then
            raise exception 'دسترسی غیرمجاز: ثبت لاگ روزانه فقط با هویت خودتان مجاز است.';
          end if;

          if (new_logs->(new_len - 1)->>'supervisorConfirmed')::boolean = true then
            declare
              v_caller_is_lead boolean := false;
            begin
              if public.is_qc_manager() then
                v_caller_is_lead := true;
              elsif current_data->>'leadTechnicianId' = auth.uid()::text then
                v_caller_is_lead := true;
              elsif current_data->>'assignedTeamId' is not null and exists (
                select 1 from public.team_members tm
                where tm.user_id = auth.uid()
                  and tm.team_id::text = current_data->>'assignedTeamId'
                  and tm.role_in_team = 'LEAD'
              ) then
                v_caller_is_lead := true;
              end if;

              if not v_caller_is_lead then
                raise exception 'دسترسی غیرمجاز: تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.';
              end if;
            end;
          end if;
        end if;
      end;
    end if;

    -- و) بررسی workSessions (الحاق یا بستن جلسه جاری خود تکنسین)
    if patch ? 'workSessions' then
      declare
        curr_sess jsonb := coalesce(current_data->'workSessions', '[]'::jsonb);
        new_sess jsonb := patch->'workSessions';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_sess) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: جلسات کاری باید آرایه باشد.';
        end if;
        curr_len := jsonb_array_length(curr_sess);
        new_len := jsonb_array_length(new_sess);

        if new_sess = curr_sess then
          null;
        elsif new_len = curr_len and curr_len > 0 then
          for i in 0 .. (curr_len - 2) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
          if (curr_sess->(curr_len - 1)) - 'endedAt' is distinct from (new_sess->(new_len - 1)) - 'endedAt' then
            raise exception 'دسترسی غیرمجاز: فقط زمان پایان جلسه‌ی کاری باز قابل ثبت است.';
          end if;
          if curr_sess->(curr_len - 1)->>'endedAt' is not null then
            raise exception 'دسترسی غیرمجاز: این جلسه کاری قبلاً بسته شده است.';
          end if;
          if new_sess->(new_len - 1)->>'endedAt' is null then
            raise exception 'دسترسی غیرمجاز: زمان پایان کار جلسه مشخص نشده است.';
          end if;
        elsif new_len = curr_len + 1 then
          for i in 0 .. (curr_len - 1) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
          if (new_sess->(new_len - 1)->>'byUserId') is distinct from auth.uid()::text then
            raise exception 'دسترسی غیرمجاز: ثبت جلسه کاری جدید فقط با هویت خودتان مجاز است.';
          end if;
        else
          raise exception 'دسترسی غیرمجاز: تعداد یا ترتیب جلسات کاری نامعتبر است.';
        end if;
      end;
    end if;

    -- ز) حفاظت سخت‌گیرانه از عیوب کیفی (qcDefects) بر مبنای شناسه‌های یکتا
    if patch ? 'qcDefects' then
      declare
        v_old_defects jsonb := coalesce(current_data->'qcDefects', '[]'::jsonb);
        v_new_defects jsonb := patch->'qcDefects';
        v_old_d jsonb;
        v_matched_d jsonb;
        p int;
        q int;
        v_defect_found boolean;
      begin
        if jsonb_typeof(v_new_defects) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: لیست عیوب کیفی باید آرایه معتبر باشد.';
        end if;

        -- تکنسین اجازه ثبت عیب جدید ندارد (عیب‌گذاری رسمی منحصراً وظیفه مدیر QC حین بازرسی است)
        if jsonb_array_length(v_new_defects) > jsonb_array_length(v_old_defects) then
          raise exception 'دسترسی غیرمجاز: ثبت رسمی نقص کیفی منحصراً در صلاحیت مدیر ارشد QC است.';
        end if;

        -- بررسی تک‌تک عیوب ثبت‌شده قبلی با شناسه یکتا (ممانعت از حذف، تعویض یا تغییر مشخصات پایه)
        for p in 0 .. (jsonb_array_length(v_old_defects) - 1) loop
          v_old_d := v_old_defects->p;
          v_defect_found := false;

          for q in 0 .. (jsonb_array_length(v_new_defects) - 1) loop
            v_matched_d := v_new_defects->q;
            if v_matched_d->>'id' = v_old_d->>'id' then
              v_defect_found := true;

              -- مشخصات پایه عیب به هیچ وجه نباید تغییر کند
              if (v_matched_d->>'severity') is distinct from (v_old_d->>'severity') or
                 (v_matched_d->>'category') is distinct from (v_old_d->>'category') or
                 (v_matched_d->>'description') is distinct from (v_old_d->>'description') or
                 (v_matched_d->>'createdByUserId') is distinct from (v_old_d->>'createdByUserId') or
                 (v_matched_d->>'createdAt') is distinct from (v_old_d->>'createdAt') then
                raise exception 'دسترسی غیرمجاز: مشخصات و شدت نقص کیفی ثبت‌شده توسط تکنسین قابل تغییر نیست.';
              end if;

              -- اگر نقص قبلاً تایید نهایی شده، کل شیء عیب کاملاً فریز و غیرقابل تغییر است (Freeze Every Field)
              if (v_old_d->>'status') = 'VERIFIED' then
                if v_matched_d is distinct from v_old_d then
                  raise exception 'دسترسی غیرمجاز: سوابق نقص راستی‌آزمایی‌شده قبلی کاملاً قفل بوده و هرگونه ویرایش آن ممنوع است.';
                end if;
              else
                -- اگر نقص هنوز VERIFIED نشده: تکنسین هرگز حق ارتقای آن به VERIFIED را ندارد
                if (v_matched_d->>'status') = 'VERIFIED' then
                  raise exception 'دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.';
                end if;

                -- اگر تکنسین وضعیت را به RESOLVED تغییر می‌دهد، ثبت توضیحات الزامی است
                if (v_matched_d->>'status') = 'RESOLVED' and
                   coalesce(trim(v_matched_d->>'resolutionNotes'), '') = '' then
                  raise exception 'در صورت رفع نقص، ثبت مستند اقدام انجام‌شده الزامی است.';
                end if;
              end if;

              exit;
            end if;
          end loop;

          if not v_defect_found then
            raise exception 'دسترسی غیرمجاز: حذف یا تعویض عیوب کیفی ثبت‌شده مجاز نیست.';
          end if;
        end loop;
      end;
    end if;

    -- ح) پذیرش کارفرما (customerAcceptance)
    if patch ? 'customerAcceptance' then
      if patch->'customerAcceptance'->>'status' = 'UNAVAILABLE' and
         coalesce(trim(patch->'customerAcceptance'->>'unavailabilityReason'), '') = '' then
        raise exception 'در صورت عدم حضور کارفرما، ثبت دلیل مستند عدم امکان اخذ امضا الزامی است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ۹. اعمال نهایی به‌روزرسانی پروژه
  -- ============================================================================
  update public.projects
  set data = current_data || patch,
      updated_at = now(),
      updated_by = auth.uid()
  where public.projects.id = patch_project.id
  returning data into updated_data;

  return updated_data;
end;
$function$;

revoke execute on function public.patch_project(text, jsonb) from anon, public;
grant execute on function public.patch_project(text, jsonb) to authenticated;

-- ۵. همگام‌سازی زنده برای دو جدول جدید
do $$
declare t text;
begin
  foreach t in array array['schedule_change_requests', 'material_requests'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ۶. نسخه‌ی سرور (برنامه اگر کمتر از ۲۶ ببیند هشدار «سرور به‌روز نیست» می‌دهد)
create or replace function public.talaie_schema_version()
returns int language sql stable as $$ select 26 $$;
grant execute on function public.talaie_schema_version() to authenticated;
