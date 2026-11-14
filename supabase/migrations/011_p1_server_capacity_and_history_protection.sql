-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۱: صیانت از سوابق جابجایی برنامه، ظرفیت منعطف و اعتبارسنجی سمت سرور
-- ۱. حذف وابستگی آبشاری (Cascade Delete) در جدول درخواست‌های تغییر زمان‌بندی
-- ۲. نگهداری اسنپ‌شات مشخصات پروژه (کد، عنوان، نام کارفرما، ساعت کارکرد) در جدول درخواست‌ها
-- ۳. افزودن ستون ظرفیت روزانه کاری اختصاصی به جدول اکیپ‌ها (installation_teams)
-- ۴. تابع اعتبارسنجی سرور سقف ظرفیت، قفل‌گذاری همزمانی (FOR UPDATE) و ممانعت از تداخل ساعتی
-- ۵. اعمال اعتبارسنجی در patch_project، propose_schedule_change و review_schedule_change
-- ۶. حفاظت از تاریخچه جابجایی برنامه‌ها در حذف کامل پروژه (admin_delete_project)
-- ==============================================================================

-- ۱. ستون ظرفیت روزانه اختصاصی اکیپ‌ها
alter table public.installation_teams 
  add column if not exists daily_capacity_hours numeric check (daily_capacity_hours > 0);

-- ۲. صیانت از سوابق جابجایی برنامه در جدول schedule_change_requests
-- الف) حذف قید CASCADE و جایگزینی با SET NULL تا حذف پروژه تاریخچه تصمیمات مدیریتی را پاک نکند
do $$
declare
  constraint_rec record;
begin
  for constraint_rec in (
    select tc.constraint_name 
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu 
      on tc.constraint_name = kcu.constraint_name
    where tc.table_name = 'schedule_change_requests' 
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'project_id'
  ) loop
    execute 'alter table public.schedule_change_requests drop constraint ' || quote_ident(constraint_rec.constraint_name);
  end loop;
end $$;

-- ب) افزودن قید جدید با ON DELETE SET NULL و مجاز کردن مقدار NULL برای project_id پس از حذف
alter table public.schedule_change_requests alter column project_id drop not null;
alter table public.schedule_change_requests 
  add constraint fk_schedule_change_project 
  foreign key (project_id) references public.projects(id) on delete set null;

-- ج) ستون‌های اسنپ‌شات پروژه جهت حفظ ماندگار اطلاعات حتی پس از آرشیو یا حذف فیزیکی
alter table public.schedule_change_requests
  add column if not exists customer_name text,
  add column if not exists duration_hours numeric;

-- بروزرسانی اسنپ‌شات برای رکوردهای موجود از روی projects
update public.schedule_change_requests scr
set 
  customer_name = coalesce(p.data->>'customerName', ''),
  duration_hours = coalesce((p.data->>'requiredDurationHours')::numeric, 0)
from public.projects p
where scr.project_id = p.id
  and (scr.customer_name is null or scr.customer_name = '');

-- ۳. تابع سرور اعتبارسنجی سقف ظرفیت و ممانعت از تداخل‌های همزمانی
create or replace function public.validate_schedule_capacity(
  p_project_id text,
  p_team_id uuid,
  p_scheduled_date text,
  p_end_date text,
  p_scheduled_time text,
  p_duration_hours numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  team_rec record;
  settings_rec record;
  effective_capacity numeric;
  curr_date text;
  date_list text[];
  total_day_workload numeric;
  other_proj record;
  p_start_min integer;
  p_end_min integer;
  o_start_min integer;
  o_end_min integer;
begin
  if p_team_id is null or p_scheduled_date is null or trim(p_scheduled_date) = '' then
    return; -- اگر هنوز تاریخ یا اکیپ تعیین نشده، اعتبارسنجی ظرفیت روزانه اعمال نمی‌شود
  end if;

  -- قفل ردیف اکیپ نصب جهت ممانعت قطعی از تداخل درخواست‌های همزمان (Transaction Locking)
  select * into team_rec
  from public.installation_teams
  where id = p_team_id
  for update;

  if not found then
    raise exception 'اکیپ نصب مورد نظر با شناسه % یافت نشد.', p_team_id;
  end if;

  -- تعیین سقف ظرفیت کاری مجاز:
  -- ۱. اولویت اول: ظرفیت اختصاصی اکیپ (team.daily_capacity_hours)
  -- ۲. اولویت دوم: ظرفیت پیش‌فرض کل سیستم در جدول settings (talaie_sync)
  effective_capacity := team_rec.daily_capacity_hours;

  if effective_capacity is null or effective_capacity <= 0 then
    select (data->>'defaultTeamDailyCapacityHours')::numeric into effective_capacity
    from public.talaie_sync
    where key = 'settings';
  end if;

  if effective_capacity is null or effective_capacity <= 0 then
    raise exception 'خطای ظرفیت نامشخص: سقف ظرفیت کاری مجاز برای اکیپ «%» یا تنظیمات پیش‌فرض سیستم توسط مدیر QC تعیین نشده است.', team_rec.name;
  end if;

  -- بررسی سازگاری تاریخ‌های پروژه چندروزه
  if p_end_date is not null and p_end_date <> '' and p_end_date < p_scheduled_date then
    raise exception 'خطای زمان‌بندی: تاریخ پایان پروژه (%) نمی‌تواند قبل از تاریخ شروع (%) باشد.', p_end_date, p_scheduled_date;
  end if;

  -- ساخت لیست روزهای بازه پروژه
  if p_end_date is not null and p_end_date <> '' and p_end_date > p_scheduled_date then
    select array_agg(to_char(d, 'YYYY-MM-DD')) into date_list
    from generate_series(
      p_scheduled_date::date,
      p_end_date::date,
      '1 day'::interval
    ) d;
  else
    date_list := array[p_scheduled_date];
  end if;

  -- بررسی ظرفیت و تداخل‌های ساعتی برای تک‌تک روزهای بازه
  foreach curr_date in array date_list loop
    -- محاسبه مجموع ساعات پروژه‌های فعال منتسب به این اکیپ در این روز (به جز همین پروژه)
    select coalesce(sum(
      case 
        when p.data->>'endDate' is not null and p.data->>'endDate' > p.data->>'scheduledDate' then
          round(coalesce((p.data->>'requiredDurationHours')::numeric, 0) / greatest(1, (p.data->>'endDate')::date - (p.data->>'scheduledDate')::date + 1), 1)
        else
          coalesce((p.data->>'requiredDurationHours')::numeric, 0)
      end
    ), 0) into total_day_workload
    from public.projects p
    where p.id <> coalesce(p_project_id, '')
      and (p.data->>'assignedTeamId')::text = p_team_id::text
      and p.data->>'status' in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED')
      and (
        (p.data->>'endDate' is not null and curr_date >= p.data->>'scheduledDate' and curr_date <= p.data->>'endDate')
        or (curr_date = p.data->>'scheduledDate')
      );

    -- افزودن بار کاری روزانه پروژه جاری
    total_day_workload := total_day_workload + round(coalesce(p_duration_hours, 0) / greatest(1, array_length(date_list, 1)), 1);

    -- اعتبارسنجی ۱: آیا بار کاری از سقف مجاز روزانه فراتر رفته است؟
    if total_day_workload > effective_capacity then
      raise exception 'خطای سقف ظرفیت: مجموع بار کاری اکیپ «%» در تاریخ % برابر % ساعت می‌شود که از سقف مجاز روزانه (% ساعت) بیشتر است.',
        team_rec.name, curr_date, total_day_workload, effective_capacity;
    end if;

    -- اعتبارسنجی ۲: بررسی تداخل مستقیم بازه‌های ساعتی (در صورتی که هر دو پروژه ساعت شروع دقیق دارند)
    if p_scheduled_time is not null and p_scheduled_time like '%:%' then
      p_start_min := (split_part(p_scheduled_time, ':', 1)::integer * 60) + split_part(p_scheduled_time, ':', 2)::integer;
      p_end_min := p_start_min + greatest(30, round(coalesce(p_duration_hours, 2) * 60)::integer);

      for other_proj in (
        select p.id, p.data
        from public.projects p
        where p.id <> coalesce(p_project_id, '')
          and (p.data->>'assignedTeamId')::text = p_team_id::text
          and p.data->>'status' in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED')
          and (
            (p.data->>'endDate' is not null and curr_date >= p.data->>'scheduledDate' and curr_date <= p.data->>'endDate')
            or (curr_date = p.data->>'scheduledDate')
          )
          and p.data->>'scheduledTime' is not null
          and p.data->>'scheduledTime' like '%:%'
      ) loop
        o_start_min := (split_part(other_proj.data->>'scheduledTime', ':', 1)::integer * 60) + split_part(other_proj.data->>'scheduledTime', ':', 2)::integer;
        o_end_min := o_start_min + greatest(30, round(coalesce((other_proj.data->>'requiredDurationHours')::numeric, 2) * 60)::integer);

        if greatest(p_start_min, o_start_min) < least(p_end_min, o_end_min) then
          raise exception 'تداخل زمانی ساعتی: اکیپ «%» در تاریخ % برای ساعت % در پروژه «% (%))» مشغول است و امکان شروع پروژه در ساعت % وجود ندارد.',
            team_rec.name, curr_date, other_proj.data->>'scheduledTime', other_proj.data->>'title', other_proj.data->>'code', p_scheduled_time;
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

revoke execute on function public.validate_schedule_capacity(text, uuid, text, text, text, numeric) from anon, public;
grant execute on function public.validate_schedule_capacity(text, uuid, text, text, text, numeric) to authenticated;

-- ۴. اتصال اعتبارسنجی ظرفیت به تابع patch_project
create or replace function public.patch_project(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_data jsonb;
  current_data jsonb;
  patch_key text;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  -- ثبت دلیل ممیزی در صورت وجود
  if patch ? '_auditReason' then
    perform set_config('talaie.audit_reason', patch->>'_auditReason', true);
  end if;

  select public.projects.data into current_data
  from public.projects
  where public.projects.id = patch_project.id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- ممانعت از جعل یا دستکاری دستی پرچم سوابق تاریخی
  if patch ? 'technicalHandover' and (patch->'technicalHandover' ? 'isHistoricalMigration') then
    raise exception 'دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.';
  end if;

  declare
    merged_data jsonb := current_data || patch;
    prod_confirmed boolean;
    wh_confirmed boolean;
    is_scheduling boolean := false;
    v_team_id uuid;
    v_sched_date text;
    v_end_date text;
    v_sched_time text;
    v_duration numeric;
  begin
    -- تشخیص تغییرات مربوط به زمان‌بندی و انتساب اکیپ
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
      -- الف) بررسی گیت تحویل رسمی واحد فنی
      if not (current_data->'technicalHandover'->>'isHistoricalMigration' = 'true') then
        prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
        wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

        if not (prod_confirmed and wh_confirmed) then
          raise exception 'دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.';
        end if;
      end if;

      -- ب) اعتبارسنجی سرور سقف ظرفیت، تداخلات همزمانی و قفل ترنزکشن اکیپ
      if merged_data->>'assignedTeamId' is not null and merged_data->>'assignedTeamId' <> '' then
        v_team_id := (merged_data->>'assignedTeamId')::uuid;
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

    -- محدودیت‌های هماهنگ‌کننده زمان‌بندی
    if public.is_scheduling_coordinator() then
      if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
        raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
      end if;
      if patch ? 'qcScore' and patch->>'qcScore' is not null then
        raise exception 'دسترسی غیرمجاز: ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است.';
      end if;
    end if;

    -- اگر کاربر مدیر QC یا هماهنگ‌کننده زمان‌بندی نباشد، محدودیت‌های تکنسین اعمال می‌شود
    if not public.is_coordinator_or_manager() then
      if not public.can_access_project(current_data) then
        raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
      end if;

      for patch_key in select jsonb_object_keys(patch) loop
        if patch_key not in (
          'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
          'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
          'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
          'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
          'workSessions', 'dailyLogs', 'siteReadiness', 'handoverSigneeType',
          'representativeName', 'representativeRole', 'representativePhone',
          'unavailabilityReason', 'unavailabilityPhotos'
        ) then
          raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
        end if;
      end loop;

      if patch ? 'qcStatus' then
        if patch->>'qcStatus' != 'PENDING' then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
        end if;
        if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
          raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
        end if;
      end if;

      if patch ? 'status' then
        if not public.is_valid_status_transition(current_data->>'status', patch->>'status') then
          raise exception 'انتقال وضعیت نامعتبر است: از «%» به «%» مجاز نیست.', current_data->>'status', patch->>'status';
        end if;
      end if;
    end if;

    -- اعمال پچ
    update public.projects
    set data = current_data || patch
    where public.projects.id = patch_project.id
    returning data into updated_data;

    return updated_data;
  end;
end;
$$;

-- ۵. تابع ثبت پیشنهاد تغییر زمان‌بندی توسط هماهنگ‌کننده همراه با اعتبارسنجی اولیه ظرفیت
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
  v_team_to_check := coalesce(p_proposed_team_id, (proj_rec.data->>'assignedTeamId')::uuid);

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

-- ۶. حفاظت از تاریخچه جابجایی برنامه‌ها به هنگام حذف پروژه
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
  if not public.is_qc_manager() then
    raise exception 'دسترسی غیرمجاز: فقط مدیر QC می‌تواند پروژه را حذف کند.';
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
