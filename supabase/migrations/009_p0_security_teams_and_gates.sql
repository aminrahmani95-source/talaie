-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۰۹: امنیت دسترسی، نقش هماهنگ‌کننده، ۴ اکیپ نصب و گیت تحویل انبار
-- ۱. اصلاح محدودیت نقش‌ها و افزودن SCHEDULING_COORDINATOR
-- ۲. جدول‌های ساختار ۴ اکیپ نصب (installation_teams و team_members) با سقف و قید یکتایی
-- ۳. سیاست‌های امنیتی دسترسی به داده‌های مشتریان (RLS پروژه‌ها، تیکت‌ها و باکت تصاویر)
-- ۴. اعتبارسنجی گیت ورود به واحد فنی (اتمام تولید + تحویل انبار) پیش از زمان‌بندی در patch_project
-- ۵. حفظ سوابق پروژه‌های تاریخی موجود و جلوگیری از شکست داده‌ها
-- ==============================================================================

-- ۱. اصلاح چک رول جدول profiles و توابع امنیتی نقش
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('QC_MANAGER', 'SCHEDULING_COORDINATOR', 'LEAD_TECHNICIAN', 'TECHNICIAN'));

create or replace function public.is_scheduling_coordinator()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SCHEDULING_COORDINATOR' and active = true
  );
$$;

create or replace function public.is_coordinator_or_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('QC_MANAGER', 'SCHEDULING_COORDINATOR') and active = true
  );
$$;

revoke execute on function public.is_scheduling_coordinator() from anon, public;
grant execute on function public.is_scheduling_coordinator() to authenticated;
revoke execute on function public.is_coordinator_or_manager() from anon, public;
grant execute on function public.is_coordinator_or_manager() to authenticated;

-- ۲. ساختار سازمانی ۴ اکیپ نصب
create table if not exists public.installation_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  supervisor_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.installation_teams(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role_in_team text not null check (role_in_team in ('LEAD', 'TECHNICIAN')),
  joined_at timestamptz not null default now()
);

create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);

alter table public.installation_teams enable row level security;
alter table public.team_members enable row level security;

revoke all on public.installation_teams from anon;
revoke all on public.team_members from anon;

-- سیاست‌های دسترسی اکیپ‌ها: خواندن برای تمام کاربران فعال، ویرایش منحصراً مدیر QC
drop policy if exists "Active users read teams" on public.installation_teams;
create policy "Active users read teams"
  on public.installation_teams for select to authenticated
  using (public.is_active_user());

drop policy if exists "QC Managers insert teams" on public.installation_teams;
create policy "QC Managers insert teams"
  on public.installation_teams for insert to authenticated
  with check (public.is_qc_manager());

drop policy if exists "QC Managers update teams" on public.installation_teams;
create policy "QC Managers update teams"
  on public.installation_teams for update to authenticated
  using (public.is_qc_manager()) with check (public.is_qc_manager());

drop policy if exists "QC Managers delete teams" on public.installation_teams;
create policy "QC Managers delete teams"
  on public.installation_teams for delete to authenticated
  using (public.is_qc_manager());

drop policy if exists "Active users read team members" on public.team_members;
create policy "Active users read team members"
  on public.team_members for select to authenticated
  using (public.is_active_user());

drop policy if exists "QC Managers insert team members" on public.team_members;
create policy "QC Managers insert team members"
  on public.team_members for insert to authenticated
  with check (public.is_qc_manager());

drop policy if exists "QC Managers update team members" on public.team_members;
create policy "QC Managers update team members"
  on public.team_members for update to authenticated
  using (public.is_qc_manager()) with check (public.is_qc_manager());

drop policy if exists "QC Managers delete team members" on public.team_members;
create policy "QC Managers delete team members"
  on public.team_members for delete to authenticated
  using (public.is_qc_manager());

-- درج اولیه ۴ اکیپ رسمی نصب شرکت
insert into public.installation_teams (name, code)
values 
  ('اکیپ نصب ۱', 'TEAM_1'),
  ('اکیپ نصب ۲', 'TEAM_2'),
  ('اکیپ نصب ۳', 'TEAM_3'),
  ('اکیپ نصب ۴', 'TEAM_4')
on conflict (code) do nothing;

-- تابع استخراج تیم کاربر
create or replace function public.user_team_id(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.team_members where user_id = uid limit 1;
$$;

revoke execute on function public.user_team_id(uuid) from anon, public;
grant execute on function public.user_team_id(uuid) to authenticated;

-- تابع مدیریت انتساب اعضای اکیپ توسط مدیر QC (با کنترل سقف ظرفیت ۳ نفر: ۱ سرپرست + ۲ تکنسین)
create or replace function public.admin_assign_team_member(
  p_team_id uuid,
  p_user_id uuid,
  p_role_in_team text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_count int;
  tech_count int;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به مدیریت ترکیب اکیپ‌های نصب است.';
  end if;

  if p_role_in_team not in ('LEAD', 'TECHNICIAN') then
    raise exception 'نقش انتخابی در اکیپ نامعتبر است.';
  end if;

  if not exists (select 1 from public.installation_teams where id = p_team_id) then
    raise exception 'اکیپ مورد نظر یافت نشد.';
  end if;

  -- بررسی ظرفیت اکیپ
  select 
    count(*) filter (where role_in_team = 'LEAD' and user_id != p_user_id),
    count(*) filter (where role_in_team = 'TECHNICIAN' and user_id != p_user_id)
  into lead_count, tech_count
  from public.team_members
  where team_id = p_team_id;

  if p_role_in_team = 'LEAD' and lead_count >= 1 then
    raise exception 'هر اکیپ حداکثر می‌تواند ۱ سرپرست داشته باشد.';
  end if;

  if p_role_in_team = 'TECHNICIAN' and tech_count >= 2 then
    raise exception 'هر اکیپ حداکثر می‌تواند ۲ تکنسین داشته باشد (سقف ظرفیت تیم ۳ نفر است).';
  end if;

  -- درج یا به‌روزرسانی (یک کاربر در هر زمان فقط عضو ۱ تیم می‌تواند باشد)
  insert into public.team_members (team_id, user_id, role_in_team)
  values (p_team_id, p_user_id, p_role_in_team)
  on conflict (user_id) do update set
    team_id = excluded.team_id,
    role_in_team = excluded.role_in_team,
    joined_at = now();

  -- اگر نقش سرپرست است، در جدول installation_teams نیز ست شود
  if p_role_in_team = 'LEAD' then
    update public.installation_teams
    set supervisor_id = p_user_id, updated_at = now()
    where id = p_team_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.admin_remove_team_member(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به حذف اعضا از اکیپ است.';
  end if;

  update public.installation_teams
  set supervisor_id = null, updated_at = now()
  where supervisor_id = p_user_id;

  delete from public.team_members where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_assign_team_member(uuid, uuid, text) from anon, public;
grant execute on function public.admin_assign_team_member(uuid, uuid, text) to authenticated;
revoke execute on function public.admin_remove_team_member(uuid) from anon, public;
grant execute on function public.admin_remove_team_member(uuid) to authenticated;

-- تریگر پایگاه داده جهت تضمین سقف ظرفیت اکیپ‌ها در هر نوع عملیات درج یا ویرایش مستقیم
create or replace function public.check_team_capacity_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_count int;
  tech_count int;
begin
  select 
    count(*) filter (where role_in_team = 'LEAD' and user_id != new.user_id),
    count(*) filter (where role_in_team = 'TECHNICIAN' and user_id != new.user_id)
  into lead_count, tech_count
  from public.team_members
  where team_id = new.team_id;

  if new.role_in_team = 'LEAD' and lead_count >= 1 then
    raise exception 'ظرفیت سرپرست این اکیپ تکمیل است (حداکثر ۱ سرپرست).';
  end if;

  if new.role_in_team = 'TECHNICIAN' and tech_count >= 2 then
    raise exception 'ظرفیت تکنسین‌های این اکیپ تکمیل است (حداکثر ۲ تکنسین).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_team_capacity on public.team_members;
create trigger trg_check_team_capacity
  before insert or update on public.team_members
  for each row execute function public.check_team_capacity_trigger();

-- ۳. امنیت دسترسی به داده‌های پروژه‌ها و تیکت‌ها (محدودسازی دسترسی تکنسین‌ها)
create or replace function public.can_access_project(project_data jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  my_team_id uuid;
begin
  if not public.is_active_user() then
    return false;
  end if;

  -- مدیر کنترل کیفیت و مسئول زمان‌بندی به تمامی پروژه‌های فنی دسترسی دارند
  if public.is_coordinator_or_manager() then
    return true;
  end if;

  -- انتساب مستقیم به تکنسین یا سرپرست
  if (project_data->>'leadTechnicianId' = auth.uid()::text) or
     (project_data->'assignedTechnicianIds' ? auth.uid()::text) then
    return true;
  end if;

  -- انتساب به اکیپ کاربری
  if project_data->>'assignedTeamId' is not null then
    select team_id into my_team_id from public.team_members where user_id = auth.uid() limit 1;
    if my_team_id is not null and (project_data->>'assignedTeamId')::text = my_team_id::text then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.can_access_project_id(pid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and public.can_access_project(p.data)
  );
$$;

revoke execute on function public.can_access_project(jsonb) from anon, public;
grant execute on function public.can_access_project(jsonb) to authenticated;
revoke execute on function public.can_access_project_id(text) from anon, public;
grant execute on function public.can_access_project_id(text) to authenticated;

-- جایگزینی سیاست‌های RLS خواندن جدول پروژه‌ها و تیکت‌ها
drop policy if exists "Active users read projects" on public.projects;
drop policy if exists "Authorized users read projects" on public.projects;
create policy "Authorized users read projects"
  on public.projects for select to authenticated
  using (public.can_access_project(data));

drop policy if exists "QC Managers insert projects" on public.projects;
drop policy if exists "Managers and Coordinators insert projects" on public.projects;
create policy "Managers and Coordinators insert projects"
  on public.projects for insert to authenticated
  with check (
    public.is_coordinator_or_manager() and
    -- پرچم مهاجرت تاریخی به هیچ عنوان در پروژه‌های جدید قابل درج نیست
    ((data->'technicalHandover'->>'isHistoricalMigration') is distinct from 'true') and
    -- اگر پروژه در وضعیت زمان‌بندی یا دارای تاریخ/تیم است، باید هر دو پیش‌نیاز تایید شده باشد
    case when (data->>'status') in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED') or
              (data->>'scheduledDate' is not null and data->>'scheduledDate' != '') or
              (data->>'assignedTeamId' is not null and data->>'assignedTeamId' != '')
         then (
           coalesce((data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false) and
           coalesce((data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false)
         )
         else true
    end
  );

drop policy if exists "Active users read tickets" on public.tickets;
drop policy if exists "Authorized users read tickets" on public.tickets;
create policy "Authorized users read tickets"
  on public.tickets for select to authenticated
  using (
    public.is_coordinator_or_manager() or
    public.can_access_project_id(data->>'projectId')
  );

-- امنیت باکت تصاویر talaie-photos
drop policy if exists "Active users read photos" on storage.objects;
drop policy if exists "Authorized users read photos" on storage.objects;
create policy "Authorized users read photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'talaie-photos' and (
      public.is_coordinator_or_manager() or
      (name like 'projects/%' and public.can_access_project_id(split_part(name, '/', 2))) or
      (name not like 'projects/%' and public.is_active_user())
    )
  );

drop policy if exists "Active users upload photos" on storage.objects;
drop policy if exists "Authorized users upload photos" on storage.objects;
create policy "Authorized users upload photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'talaie-photos' and (
      public.is_coordinator_or_manager() or
      (name like 'projects/%' and public.can_access_project_id(split_part(name, '/', 2))) or
      (name not like 'projects/%' and public.is_active_user())
    )
  );

-- ۴. به‌روزرسانی تابع patch_project با گیت تحویل رسمی انبار و پشتیبانی نقش هماهنگ‌کننده
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
  merged_data jsonb;
  prod_confirmed boolean;
  wh_confirmed boolean;
  is_scheduling boolean := false;
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

  -- ذخیره دلیل ممیزی در تنظیمات محلی تراکنش
  if patch ? '_auditReason' then
    perform set_config('talaie.audit_reason', patch->>'_auditReason', true);
    patch := patch - '_auditReason';
  end if;

  select data into current_data
  from public.projects
  where public.projects.id = patch_project.id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- ممانعت از جعل یا دستکاری دستی پرچم سوابق تاریخی
  if patch ? 'technicalHandover' and (patch->'technicalHandover' ? 'isHistoricalMigration') then
    raise exception 'دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.';
  end if;

  merged_data := current_data || patch;

  -- گیت تحویل رسمی واحد فنی (مرحله ۱):
  -- تا زمانی که اتمام تولید و ورود کالا به انبار تایید نشده باشد، پروژه نمی‌تواند در وضعیت برنامه‌ریزی‌شده یا در حال نصب قرار گیرد و اکیپ یا تاریخ زمان‌بندی به آن اختصاص یابد.
  if patch ? 'status' and (patch->>'status') in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED') then
    is_scheduling := true;
  end if;
  if patch ? 'scheduledDate' and patch->>'scheduledDate' is not null and patch->>'scheduledDate' != '' then
    is_scheduling := true;
  end if;
  if patch ? 'assignedTeamId' and patch->>'assignedTeamId' is not null and patch->>'assignedTeamId' != '' then
    is_scheduling := true;
  end if;

  if is_scheduling then
    -- استثنا برای پروژه‌های تاریخی که قبل از اعمال گیت در جریان بوده‌اند
    if not (current_data->'technicalHandover'->>'isHistoricalMigration' = 'true') then
      prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
      wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

      if not (prod_confirmed and wh_confirmed) then
        raise exception 'دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.';
      end if;
    end if;
  end if;

  -- محدودیت‌های نقش هماهنگ‌کننده زمان‌بندی (SCHEDULING_COORDINATOR)
  if public.is_scheduling_coordinator() then
    -- مسئول زمان‌بندی حق تایید نهایی QC را ندارد
    if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
      raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
    end if;
    if patch ? 'qcScore' and patch->>'qcScore' is not null then
      raise exception 'دسترسی غیرمجاز: ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است.';
    end if;
  end if;

  -- اگر کاربر مدیر QC یا هماهنگ‌کننده زمان‌بندی نباشد، محدودیت‌های تکنسین اعمال می‌شود
  if not public.is_coordinator_or_manager() then

    -- الف) بررسی تخصیص پروژه به کاربر یا اکیپ او
    if not public.can_access_project(current_data) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- ب) بررسی کلیدهای مجاز برای تکنسین
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in (
        'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
        'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
        'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
        'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
        'workSessions', 'dailyLogs', 'siteReadiness'
      ) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
      end if;
    end loop;

    -- ج) بررسی وضعیت QC
    if patch ? 'qcStatus' then
      if patch->>'qcStatus' != 'PENDING' then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
      end if;
      if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
        raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
      end if;
    end if;

    -- د) بررسی ماشین وضعیت مجاز
    if patch ? 'status' and patch->>'status' is distinct from current_data->>'status' then
      declare
        curr_st text := current_data->>'status';
        new_st text := patch->>'status';
      begin
        if not (
          (curr_st = 'SCHEDULED' and new_st = 'EN_ROUTE') or
          (curr_st = 'EN_ROUTE' and new_st = 'IN_PROGRESS') or
          (curr_st = 'IN_PROGRESS' and new_st = 'COMPLETED') or
          (curr_st in ('EN_ROUTE', 'IN_PROGRESS', 'PAUSED') and new_st = 'STUCK') or
          (curr_st = 'IN_PROGRESS' and new_st = 'PAUSED') or
          (curr_st = 'PAUSED' and new_st in ('EN_ROUTE', 'IN_PROGRESS'))
        ) then
          raise exception 'انتقال وضعیت از «%» به «%» برای تکنسین مجاز نیست.', curr_st, new_st;
        end if;
      end;
    end if;

    -- ه) بررسی stuckIncidents (فقط الحاق رویداد جدید با وضعیت OPEN مجاز است)
    if patch ? 'stuckIncidents' then
      declare
        curr_incidents jsonb := coalesce(
          current_data->'stuckIncidents',
          case when current_data ? 'stuckIncident' then jsonb_build_array(current_data->'stuckIncident') else '[]'::jsonb end
        );
        new_incidents jsonb := patch->'stuckIncidents';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_incidents) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: گزارش استاک باید آرایه باشد.';
        end if;
        curr_len := jsonb_array_length(curr_incidents);
        new_len := jsonb_array_length(new_incidents);
        if new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند گزارش استاک جدید ثبت کند.';
        end if;
        for i in 0 .. (curr_len - 1) loop
          if (curr_incidents->i) is distinct from (new_incidents->i) then
            raise exception 'دسترسی غیرمجاز: ویرایش سوابق استاک قبلی مجاز نیست.';
          end if;
        end loop;
        if (new_incidents->(new_len - 1)->>'resolutionStatus') is distinct from 'OPEN' then
          raise exception 'دسترسی غیرمجاز: وضعیت گزارش استاک جدید باید OPEN باشد.';
        end if;
      end;
    end if;

    -- و) بررسی dailyLogs (فقط الحاق مجاز است)
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
        if new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند لاگ روزانه جدید الصاق کند.';
        end if;
        for i in 0 .. (curr_len - 1) loop
          if (curr_logs->i) is distinct from (new_logs->i) then
            raise exception 'دسترسی غیرمجاز: ویرایش لاگ‌های روزانه قبلی مجاز نیست.';
          end if;
        end loop;
        if (new_logs->(new_len - 1)->>'byUserId') is distinct from auth.uid()::text then
          raise exception 'دسترسی غیرمجاز: ثبت لاگ روزانه فقط با هویت خودتان مجاز است.';
        end if;
      end;
    end if;

    -- ز) بررسی workSessions
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

        if new_len = curr_len and curr_len > 0 then
          for i in 0 .. (curr_len - 2) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
          if (curr_sess->(curr_len - 1)->>'byUserId') is distinct from auth.uid()::text then
            raise exception 'دسترسی غیرمجاز: شما فقط مجاز به بستن جلسه کاری خودتان هستید.';
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

  end if;

  update public.projects
  set data = data || patch,
      updated_at = now(),
      updated_by = auth.uid()
  where public.projects.id = patch_project.id
  returning data into updated_data;

  return updated_data;
end;
$$;

-- ۵. به‌روزرسانی توابع مدیریت پرسنل توسط مدیر برای پشتیبانی از نقش هماهنگ‌کننده
create or replace function public.admin_create_personnel(
  new_name text,
  new_phone text,
  new_password text,
  new_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  user_uid uuid;
  email_addr text;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به تعریف پرسنل است.';
  end if;

  if new_role not in ('QC_MANAGER', 'SCHEDULING_COORDINATOR', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش نامعتبر است: %', new_role;
  end if;

  if length(trim(new_name)) < 2 then
    raise exception 'نام پرسنل معتبر نیست.';
  end if;

  if length(trim(new_password)) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  email_addr := trim(new_phone) || '@talaie.app';

  if exists (select 1 from public.profiles where phone = trim(new_phone)) then
    raise exception 'این شماره موبایل قبلاً در سیستم ثبت شده است.';
  end if;

  user_uid := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', user_uid, 'authenticated', 'authenticated',
    email_addr, crypt(new_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', trim(new_name), 'phone', trim(new_phone), 'role', new_role),
    false, now(), now()
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    user_uid, user_uid,
    jsonb_build_object('sub', user_uid, 'email', email_addr),
    'email', user_uid, now(), now(), now()
  );

  insert into public.profiles (id, name, phone, role, active)
  values (user_uid, trim(new_name), trim(new_phone), new_role, true);

  return jsonb_build_object('success', true, 'id', user_uid);
end;
$$;

create or replace function public.admin_update_personnel(
  target_id uuid,
  new_name text,
  new_phone text,
  new_role text,
  new_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  email_addr text;
  current_role text;
  current_active boolean;
  active_qc_count int;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به ویرایش مشخصات پرسنل است.';
  end if;

  if new_role not in ('QC_MANAGER', 'SCHEDULING_COORDINATOR', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش نامعتبر است: %', new_role;
  end if;

  select role, active into current_role, current_active
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  if current_role = 'QC_MANAGER' and (new_role != 'QC_MANAGER' or new_active = false) then
    select count(*) into active_qc_count
    from public.profiles
    where role = 'QC_MANAGER' and active = true;

    if active_qc_count <= 1 then
      raise exception 'حداقل یک مدیر ارشد QC فعال باید در سیستم باقی بماند.';
    end if;
  end if;

  email_addr := trim(new_phone) || '@talaie.app';

  update public.profiles
  set
    name = trim(new_name),
    phone = trim(new_phone),
    role = new_role,
    active = new_active,
    updated_at = now()
  where id = target_id;

  update auth.users
  set
    raw_user_meta_data = jsonb_build_object('name', trim(new_name), 'phone', trim(new_phone), 'role', new_role),
    email = email_addr,
    updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۶. ثبت امن پیش‌نیاز تحویل تاریخی برای پروژه‌های موجود بدون ایجاد اختلال
update public.projects
set data = jsonb_set(
  data,
  '{technicalHandover}',
  jsonb_build_object(
    'isHandoverComplete', true,
    'isHistoricalMigration', true,
    'productionConfirmation', jsonb_build_object('confirmed', true, 'confirmedBy', 'سیستم (مایگریشن تاریخی)', 'confirmedAt', now(), 'notes', 'پروژه جاری قبل از اعمال گیت تحویل'),
    'warehouseConfirmation', jsonb_build_object('confirmed', true, 'confirmedBy', 'سیستم (مایگریشن تاریخی)', 'confirmedAt', now(), 'notes', 'پروژه جاری قبل از اعمال گیت تحویل')
  )
)
where (data->>'status') in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED', 'STUCK', 'COMPLETED')
  and not (data ? 'technicalHandover');

-- ۷. افزودن جداول اکیپ‌ها به اشتراک بیدرنگ (Realtime)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'installation_teams') then
    alter publication supabase_realtime add table public.installation_teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members') then
    alter publication supabase_realtime add table public.team_members;
  end if;
end $$;
