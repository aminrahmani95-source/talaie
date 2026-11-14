-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۰: مرکز کنترل عملیات، ظرفیت ۴ اکیپ و مدیریت SLA هفتاد و دو ساعته
-- ۱. جدول درخواست‌های تغییر زمان‌بندی (schedule_change_requests) و فرآیند تایید دو مرحله‌ای
-- ۲. توابع RPC ثبت پیشنهاد تغییر زمان‌بندی توسط هماهنگ‌کننده و تایید/رد توسط مدیر QC
-- ۳. نمایه‌ها و سیاست‌های RLS برای تیکت‌های ۸ گانه و SLA
-- ۴. افزودن جدول به انتشار بیدرنگ (Realtime)
-- ==============================================================================

-- ۱. جدول درخواست‌های تغییر زمان‌بندی
create table if not exists public.schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  project_code text not null,
  project_title text not null,
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

-- ۲. تابع ثبت درخواست تغییر زمان‌بندی توسط هماهنگ‌کننده
create or replace function public.propose_schedule_change(
  p_project_id text,
  p_proposed_date text,
  p_proposed_end_date text,
  p_proposed_team_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proj_rec record;
  requester_name text;
  req_id uuid;
  prev_team_name text;
  prop_team_name text;
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

  select name into requester_name
  from public.profiles
  where id = auth.uid();

  -- دریافت نام تیم‌های قبلی و پیشنهادی
  if proj_rec.data->>'assignedTeamId' is not null then
    select name into prev_team_name
    from public.installation_teams
    where id = (proj_rec.data->>'assignedTeamId')::uuid;
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
    coalesce(proj_rec.data->>'scheduledDate', ''),
    p_proposed_date,
    proj_rec.data->>'endDate',
    p_proposed_end_date,
    case when proj_rec.data->>'assignedTeamId' is not null then (proj_rec.data->>'assignedTeamId')::uuid else null end,
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
$$;

-- ۳. تابع بررسی و تایید/رد درخواست تغییر زمان‌بندی توسط مدیر QC
create or replace function public.review_schedule_change(
  p_request_id uuid,
  p_decision text,
  p_review_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke execute on function public.propose_schedule_change(text, text, text, uuid, text) from anon, public;
grant execute on function public.propose_schedule_change(text, text, text, uuid, text) to authenticated;

revoke execute on function public.review_schedule_change(uuid, text, text) from anon, public;
grant execute on function public.review_schedule_change(uuid, text, text) to authenticated;

-- ۴. افزودن جدول به اشتراک بیدرنگ (Realtime)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_change_requests') then
    alter publication supabase_realtime add table public.schedule_change_requests;
  end if;
end $$;
