-- ==============================================================================
-- گالری طلایی | اسکریپت جامع راه‌اندازی و تثبیت کامل پایگاه داده (Single Source of Truth)
-- این فایل شامل تمام تعاریف و آخرین نسخه‌های ارتقایافته جداول، توابع امنیتی،
-- RLS، باکت ذخیره‌سازی تصاویر و RPCهای پرسنل است و کاملاً Idempotent می‌باشد.
-- ==============================================================================

-- ۰. فعال‌سازی اکستنشن‌های مورد نیاز و صیانت از دسترسی اسکیمای public
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- صیانت از اسکیمای public: سلب دسترسی ایجاد شیء از نقش‌های غیرمجاز جهت ممانعت از حملات سایه‌سازی (Object Shadowing)
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;
grant usage on schema public to authenticated;

-- جدول محافظت‌شده شناسه محیط دیتابیس (فاقد هرگونه رکورد پیش‌فرض جهت ممانعت از انتساب خودکار استیجینگ)
create table if not exists public.db_environment_identity (
  environment text primary key check (environment in ('staging', 'test', 'local')),
  cluster_identity text not null,
  provisioned_by text not null,
  provisioned_at timestamptz not null default now(),
  safety_lock boolean not null default true check (safety_lock = true)
);
alter table public.db_environment_identity enable row level security;
revoke all on public.db_environment_identity from public, anon, authenticated;
grant select on public.db_environment_identity to postgres, service_role;

-- ==============================================================================
-- ۱. جدول پروفایل پرسنل (profiles) و توابع امنیتی وضعیت و نقش کاربر
-- ==============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null check (role in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  )),
  avatar text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create index if not exists idx_profiles_phone on public.profiles(phone);

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

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

revoke execute on function public.is_active_user() from anon, public;
grant execute on function public.is_active_user() to authenticated;
revoke execute on function public.is_qc_manager() from anon, public;
grant execute on function public.is_qc_manager() to authenticated;
revoke execute on function public.is_scheduling_coordinator() from anon, public;
grant execute on function public.is_scheduling_coordinator() to authenticated;
revoke execute on function public.is_coordinator_or_manager() from anon, public;
grant execute on function public.is_coordinator_or_manager() to authenticated;

revoke all on public.profiles from anon;

drop policy if exists "Active users or self read profiles" on public.profiles;
drop policy if exists "QC Managers insert profiles" on public.profiles;
drop policy if exists "QC Managers update profiles" on public.profiles;
drop policy if exists "QC Managers delete profiles" on public.profiles;

create policy "Active users or self read profiles"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_active_user());

create policy "QC Managers insert profiles"
  on public.profiles for insert to authenticated
  with check (public.is_qc_manager());

create policy "QC Managers update profiles"
  on public.profiles for update to authenticated
  using (public.is_qc_manager()) with check (public.is_qc_manager());

create policy "QC Managers delete profiles"
  on public.profiles for delete to authenticated
  using (public.is_qc_manager());

-- ==============================================================================
-- ۱.۱. ساختار سازمانی ۴ اکیپ نصب (installation_teams & team_members)
-- ==============================================================================
create table if not exists public.installation_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  supervisor_id uuid references auth.users(id),
  daily_capacity_hours numeric check (daily_capacity_hours > 0),
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

  insert into public.team_members (team_id, user_id, role_in_team)
  values (p_team_id, p_user_id, p_role_in_team)
  on conflict (user_id) do update set
    team_id = excluded.team_id,
    role_in_team = excluded.role_in_team,
    joined_at = now();

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

-- تابع احراز دسترسی به اطلاعات پروژه و تیکت‌ها
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

-- ==============================================================================
-- ۲. جدول تنظیمات همگام‌سازی (talaie_sync)
-- پاک‌سازی کامل ردیف‌های قدیمی دمو (users, projects, tickets) و محدودسازی به settings
-- ==============================================================================
create table if not exists public.talaie_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.talaie_sync enable row level security;
revoke all on public.talaie_sync from anon;

-- پاک‌سازی ردیف‌های قدیمی و ناامن حاوی رمز عبور یا داده‌های دمو
delete from public.talaie_sync where key in ('users', 'projects', 'tickets');

-- درج ردیف تنظیمات پیش‌فرض در صورت عدم وجود
insert into public.talaie_sync (key, value)
values ('settings', '{"visibilityWindowDays": 4, "companyName": "گالری طلایی", "defaultTools": []}'::jsonb)
on conflict (key) do nothing;

drop policy if exists "Active users read sync" on public.talaie_sync;
drop policy if exists "Active users write projects and tickets" on public.talaie_sync;
drop policy if exists "Active users update projects and tickets" on public.talaie_sync;
drop policy if exists "QC Managers insert settings" on public.talaie_sync;
drop policy if exists "QC Managers update settings" on public.talaie_sync;
drop policy if exists "QC Managers delete sync" on public.talaie_sync;

create policy "Active users read sync"
  on public.talaie_sync for select to authenticated
  using (public.is_active_user() and key = 'settings');

create policy "QC Managers insert settings"
  on public.talaie_sync for insert to authenticated
  with check (public.is_qc_manager() and key = 'settings');

create policy "QC Managers update settings"
  on public.talaie_sync for update to authenticated
  using (public.is_qc_manager() and key = 'settings')
  with check (public.is_qc_manager() and key = 'settings');

create policy "QC Managers delete sync"
  on public.talaie_sync for delete to authenticated
  using (public.is_qc_manager());

-- ==============================================================================
-- ۳. جدول‌های مستقل پروژه‌ها و تیکت‌ها (projects & tickets)
-- ==============================================================================
create table if not exists public.projects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.tickets (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_projects_updated_at on public.projects(updated_at);
create index if not exists idx_tickets_updated_at on public.tickets(updated_at);

create or replace function public.set_updated_at_and_user()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.updated_at = now();
  if auth.uid() is not null then
    NEW.updated_by = auth.uid();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated
  before insert or update on public.projects
  for each row execute function public.set_updated_at_and_user();

drop trigger if exists trg_tickets_updated on public.tickets;
create trigger trg_tickets_updated
  before insert or update on public.tickets
  for each row execute function public.set_updated_at_and_user();

create sequence if not exists public.project_code_seq start with 1001;

create or replace function public.next_project_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('public.project_code_seq');
  return 'PRJ-' || seq_val;
end;
$$;

revoke execute on function public.next_project_code() from anon, public;
grant execute on function public.next_project_code() to authenticated;

alter table public.projects enable row level security;
alter table public.tickets enable row level security;
revoke all on public.projects from anon;
revoke all on public.tickets from anon;

-- سیاست‌های پروژه‌ها: تغییر و درج مستقیم فقط برای مدیر QC
drop policy if exists "Active users read projects" on public.projects;
drop policy if exists "Authorized users read projects" on public.projects;
drop policy if exists "Active users insert projects" on public.projects;
drop policy if exists "Active users update projects" on public.projects;
drop policy if exists "QC Managers insert projects" on public.projects;
drop policy if exists "QC Managers update projects" on public.projects;
drop policy if exists "QC Managers delete projects" on public.projects;

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

create policy "QC Managers update projects"
  on public.projects for update to authenticated
  using (public.is_qc_manager())
  with check (public.is_qc_manager());

create policy "QC Managers delete projects"
  on public.projects for delete to authenticated
  using (public.is_qc_manager());

-- سیاست‌های تیکت‌ها: ثبت توسط تکنسین پروژه، حل فقط توسط مدیر QC
drop policy if exists "Active users read tickets" on public.tickets;
drop policy if exists "Authorized users read tickets" on public.tickets;
drop policy if exists "Active users insert tickets" on public.tickets;
drop policy if exists "Active users update tickets" on public.tickets;
drop policy if exists "Authorized users insert tickets" on public.tickets;
drop policy if exists "Authorized users update tickets" on public.tickets;
drop policy if exists "QC Managers delete tickets" on public.tickets;

create policy "Authorized users read tickets"
  on public.tickets for select to authenticated
  using (
    public.is_coordinator_or_manager() or
    public.can_access_project_id(data->>'projectId')
  );

create policy "Authorized users insert tickets"
  on public.tickets for insert to authenticated
  with check (
    public.is_qc_manager() or (
      public.is_active_user() and
      (data->>'status' is distinct from 'RESOLVED') and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  );

create policy "Authorized users update tickets"
  on public.tickets for update to authenticated
  using (
    public.is_qc_manager() or (
      public.is_active_user() and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  )
  with check (
    public.is_qc_manager() or (
      public.is_active_user() and
      (data->>'status' is distinct from 'RESOLVED') and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  );

create policy "QC Managers delete tickets"
  on public.tickets for delete to authenticated
  using (public.is_qc_manager());

-- ==============================================================================
-- ۴. تابع اعتبارسنجی سقف ظرفیت، قفل‌گذاری همزمانی (FOR UPDATE) و توابع عملیاتی پروژه‌ها
-- ==============================================================================
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

create or replace function public.patch_project(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    if not (current_data->'technicalHandover'->>'isHistoricalMigration' = 'true') then
      prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
      wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

      if not (prod_confirmed and wh_confirmed) then
        raise exception 'دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.';
      end if;
    end if;

    -- اعتبارسنجی ظرفیت و تداخلات همزمانی
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
  if not public.is_coordinator_or_manager() then
    if not public.can_access_project(current_data) then
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
        'representativePhone', 'unavailabilityReason', 'unavailabilityPhotos'
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
$$;

revoke execute on function public.patch_project(text, jsonb) from anon, public;
grant execute on function public.patch_project(text, jsonb) to authenticated;

-- تابع کنترل‌شده تایید لاگ روزانه توسط سرپرست اکیپ
create or replace function public.confirm_daily_log(
  p_project_id text,
  p_log_id text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

revoke execute on function public.confirm_daily_log(text, text, text) from anon, public;
grant execute on function public.confirm_daily_log(text, text, text) to authenticated;

-- تریگر محافظت لایه دیتابیس از خط مبنا و اصلاحیه‌ها در برابر هرگونه UPDATE مستقیم جدول
create or replace function public.trg_enforce_project_plan_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_plan jsonb := OLD.data->'originalPlan';
  new_plan jsonb := NEW.data->'originalPlan';
  old_amends jsonb := coalesce(OLD.data->'planAmendments', '[]'::jsonb);
  new_amends jsonb := coalesce(NEW.data->'planAmendments', '[]'::jsonb);
  old_item jsonb;
  matched_new jsonb;
  new_item jsonb;
  j int;
  k int;
  found_match boolean;
begin
  -- الف) ممانعت از بازنویسی یا دستکاری طرح اولیه پس از قفل شدن یا پس از گذر از مرحله پیش‌نویس (MEASUREMENT_PENDING)
  if old_plan is not null and (
       (old_plan ? 'lockedAt' and old_plan->>'lockedAt' is not null) or
       (OLD.data->>'status') != 'MEASUREMENT_PENDING'
     ) then
    if new_plan is distinct from old_plan then
      raise exception 'دسترسی غیرمجاز: طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است. برای هرگونه اصلاح در مقادیر، باید از فرآیند رسمی بازنگری طرح (Plan Amendment) استفاده شود.';
    end if;
  end if;

  -- ب) صیانت از تاریخچه و عدم حذف یا تغییر مقادیر اصلاحیه‌های نهایی‌شده (APPROVED یا REJECTED)
  if jsonb_typeof(old_amends) = 'array' then
    for j in 0 .. (jsonb_array_length(old_amends) - 1) loop
      old_item := old_amends->j;
      if old_item->>'status' in ('APPROVED', 'REJECTED') then
        found_match := false;
        if jsonb_typeof(new_amends) = 'array' then
          for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
            matched_new := new_amends->k;
            if matched_new->>'id' = old_item->>'id' then
              found_match := true;
              if old_item->>'status' = 'APPROVED' then
                if (matched_new->>'status') != 'APPROVED' then
                  raise exception 'دسترسی غیرمجاز: وضعیت اصلاحیه تاییدشده قابل بازگشت نیست.';
                end if;
                if (matched_new->>'activityId') is distinct from (old_item->>'activityId') or
                   ((matched_new->>'previousQuantity')::numeric) is distinct from ((old_item->>'previousQuantity')::numeric) or
                   ((matched_new->>'newQuantity')::numeric) is distinct from ((old_item->>'newQuantity')::numeric) or
                   (matched_new->>'reason') is distinct from (old_item->>'reason') or
                   (matched_new->>'requestedByUserId') is distinct from (old_item->>'requestedByUserId') or
                   (matched_new->>'requestedAt') is distinct from (old_item->>'requestedAt') or
                   (matched_new->>'reviewedByUserId') is distinct from (old_item->>'reviewedByUserId') or
                   (matched_new->>'reviewedAt') is distinct from (old_item->>'reviewedAt') then
                  raise exception 'دسترسی غیرمجاز: اصلاحیه تاییدشده قبلی غیرقابل تغییر است. برای هرگونه تغییر در مقادیر، اصلاحیه جدید ثبت کنید.';
                end if;
              elsif old_item->>'status' = 'REJECTED' then
                if (matched_new->>'status') != 'REJECTED' then
                  raise exception 'دسترسی غیرمجاز: اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست. برای بازنگری باید اصلاحیه جدید ثبت شود.';
                end if;
              end if;
              exit;
            end if;
          end loop;
        end if;

        if not found_match then
          raise exception 'دسترسی غیرمجاز: حذف سوابق اصلاحیه‌های نهایی‌شده طرح (تاییدشده یا ردشده) امکان‌پذیر نیست.';
        end if;
      end if;
    end loop;
  end if;

  -- ج) تایید اصلاحیه جدید منحصراً توسط مدیر QC مجاز است
  if jsonb_typeof(new_amends) = 'array' then
    for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
      new_item := new_amends->k;
      if new_item->>'status' = 'APPROVED' then
        found_match := false;
        if jsonb_typeof(old_amends) = 'array' then
          for j in 0 .. (jsonb_array_length(old_amends) - 1) loop
            old_item := old_amends->j;
            if old_item->>'id' = new_item->>'id' and old_item->>'status' = 'APPROVED' then
              found_match := true;
              exit;
            end if;
          end loop;
        end if;

        if not found_match then
          if not public.is_qc_manager() then
            raise exception 'دسترسی غیرمجاز: تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است.';
          end if;

          -- بررسی عدم همزمانی منقضی (Stale Amendment Check)
          declare
            v_act_id text := new_item->>'activityId';
            v_current_effective numeric := null;
            v_cand_amend jsonb;
            m int;
            v_plan_acts jsonb := OLD.data->'originalPlan'->'activities';
            v_act_item jsonb;
          begin
            for m in 0 .. (jsonb_array_length(old_amends) - 1) loop
              v_cand_amend := old_amends->m;
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
  end if;

  return NEW;
end;
$$;

revoke execute on function public.trg_enforce_project_plan_integrity() from anon, public;
grant execute on function public.trg_enforce_project_plan_integrity() to authenticated, service_role;

drop trigger if exists trg_enforce_plan_integrity on public.projects;
create trigger trg_enforce_plan_integrity
  before update on public.projects
  for each row execute function public.trg_enforce_project_plan_integrity();

-- تابع الحاق ارزیابی پرسنل (منحصراً برای مدیر QC)
create or replace function public.append_project_evaluation(id text, item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_data jsonb;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if not public.is_qc_manager() then
    raise exception 'دسترسی غیرمجاز: تنها مدیر ارشد QC می‌تواند ارزیابی پرسنل را ثبت کند.';
  end if;

  if jsonb_typeof(item) is distinct from 'object' then
    raise exception 'Evaluation item must be a valid JSON object';
  end if;

  if item::text like '%"data:image/%' then
    raise exception 'Evaluation item cannot contain base64 data URLs';
  end if;

  update public.projects
  set data = jsonb_set(
    data,
    '{evaluations}',
    coalesce(data->'evaluations', '[]'::jsonb) || jsonb_build_array(item)
  ),
  updated_at = now(),
  updated_by = auth.uid()
  where public.projects.id = append_project_evaluation.id
  returning data into updated_data;

  if not found then
    raise exception 'Project % not found', append_project_evaluation.id;
  end if;

  return updated_data;
end;
$$;

revoke execute on function public.append_project_evaluation(text, jsonb) from anon, public;
grant execute on function public.append_project_evaluation(text, jsonb) to authenticated;

-- ==============================================================================
-- ۵. باکت ذخیره‌سازی تصاویر (talaie-photos) و سیاست‌های Storage
-- ==============================================================================
insert into storage.buckets (id, name, public)
values ('talaie-photos', 'talaie-photos', false)
on conflict (id) do nothing;

drop policy if exists "Active users upload photos" on storage.objects;
drop policy if exists "Authorized users upload photos" on storage.objects;
drop policy if exists "Active users read photos" on storage.objects;
drop policy if exists "Authorized users read photos" on storage.objects;
drop policy if exists "QC Managers delete photos" on storage.objects;

create policy "Authorized users upload photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'talaie-photos' and (
      public.is_coordinator_or_manager() or
      (name like 'projects/%' and public.can_access_project_id(split_part(name, '/', 2))) or
      (name not like 'projects/%' and public.is_active_user())
    )
  );

create policy "Authorized users read photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'talaie-photos' and (
      public.is_coordinator_or_manager() or
      (name like 'projects/%' and public.can_access_project_id(split_part(name, '/', 2))) or
      (name not like 'projects/%' and public.is_active_user())
    )
  );

create policy "QC Managers delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'talaie-photos' and public.is_qc_manager());

-- ==============================================================================
-- ۶. توابع RPC مدیریت امن پرسنل (با اصلاح درج id در auth.identities)
-- ==============================================================================

-- ۶.۱. ایجاد کاربر پرسنل جدید
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
  clean_phone text;
  email_addr text;
  user_uid uuid;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به ثبت پرسنل جدید است.';
  end if;

  clean_phone := trim(new_phone);
  if clean_phone = '' then
    raise exception 'شماره تلفن الزامی است.';
  end if;

  if new_role not in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  ) then
    raise exception 'نقش انتخاب‌شده معتبر نیست: %', new_role;
  end if;

  if length(trim(new_password)) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  email_addr := clean_phone || '@talaie.ir';

  if exists (
    select 1 from auth.users where email in (email_addr, clean_phone || '@talaie.local')
  ) or exists (
    select 1 from public.profiles where phone = clean_phone
  ) then
    raise exception 'این شماره قبلاً ثبت شده است.';
  end if;

  user_uid := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    user_uid,
    'authenticated',
    'authenticated',
    email_addr,
    crypt(new_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false,
    now(),
    now()
  );

  delete from auth.identities where user_id = user_uid;
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    user_uid,
    jsonb_build_object('sub', user_uid::text, 'email', email_addr, 'email_verified', true),
    'email',
    user_uid::text,
    now(),
    now(),
    now()
  );

  insert into public.profiles (id, name, phone, role, avatar, active)
  values (
    user_uid,
    new_name,
    clean_phone,
    new_role,
    case
      when new_role = 'QC_MANAGER' then '👔'
      when new_role = 'SCHEDULING_COORDINATOR' then '📋'
      when new_role = 'LEAD_TECHNICIAN' then '🧢'
      else '🔧'
    end,
    true
  );

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object('id', user_uid, 'name', new_name, 'phone', clean_phone, 'role', new_role)
  );
end;
$$;

-- ۶.۲. ویرایش اطلاعات پرسنل
create or replace function public.admin_update_personnel(
  target_id uuid,
  new_name text default null,
  new_phone text default null,
  new_role text default null,
  new_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  clean_phone text := null;
  email_addr text := null;
  current_role text;
  current_active boolean;
  active_qc_count int;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به ویرایش مشخصات پرسنل است.';
  end if;

  select role, active into current_role, current_active
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  if target_id = auth.uid() then
    if new_role is not null and new_role not in ('QC_MANAGER', 'CEO') then
      raise exception 'امکان تغییر نقش حساب کاربری خودتان به غیرمدیریتی وجود ندارد.';
    end if;
    if new_active is not null and new_active = false then
      raise exception 'امکان غیرفعال کردن حساب کاربری خودتان وجود ندارد.';
    end if;
  end if;

  if current_role in ('QC_MANAGER', 'CEO') and current_active = true then
    if (new_active is not null and new_active = false) or (new_role is not null and new_role not in ('QC_MANAGER', 'CEO')) then
      select count(*) into active_qc_count
      from public.profiles
      where role in ('QC_MANAGER', 'CEO') and active = true and id != target_id;

      if active_qc_count < 1 then
        raise exception 'حداقل یک مدیر ارشد فعال باید در سیستم باقی بماند.';
      end if;
    end if;
  end if;

  if new_role is not null and new_role not in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  ) then
    raise exception 'نقش انتخاب‌شده معتبر نیست: %', new_role;
  end if;

  if new_phone is not null then
    clean_phone := trim(new_phone);
    if clean_phone = '' then
      raise exception 'شماره تلفن نمی‌تواند خالی باشد.';
    end if;
    email_addr := clean_phone || '@talaie.ir';

    if exists (
      select 1 from auth.users
      where id != target_id and email in (email_addr, clean_phone || '@talaie.local')
    ) or exists (
      select 1 from public.profiles
      where id != target_id and phone = clean_phone
    ) then
      raise exception 'این شماره قبلاً ثبت شده است.';
    end if;
  end if;

  update public.profiles
  set
    name = coalesce(new_name, name),
    phone = coalesce(clean_phone, phone),
    role = coalesce(new_role, role),
    active = coalesce(new_active, active),
    avatar = case
      when new_role = 'QC_MANAGER' then '👔'
      when new_role = 'SCHEDULING_COORDINATOR' then '📋'
      when new_role = 'LEAD_TECHNICIAN' then '🧢'
      when new_role = 'TECHNICIAN' then '🔧'
      else avatar
    end,
    updated_at = now()
  where id = target_id;

  if email_addr is not null then
    update auth.users
    set
      email = email_addr,
      updated_at = now()
    where id = target_id;

    update auth.identities
    set
      identity_data = jsonb_set(identity_data, '{email}', to_jsonb(email_addr)),
      updated_at = now()
    where user_id = target_id and provider = 'email';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- ۶.۳. بازنشانی رمز عبور پرسنل
create or replace function public.admin_reset_personnel_password(
  target_id uuid,
  new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به تغییر رمز عبور پرسنل است.';
  end if;

  if length(trim(new_password)) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  where id = target_id;

  delete from auth.sessions where user_id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۶.۴. حذف کاربر پرسنل
create or replace function public.admin_delete_personnel(
  target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_role text;
  target_active boolean;
  active_qc_count int;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به حذف پرسنل است.';
  end if;

  if target_id = auth.uid() then
    raise exception 'امکان حذف حساب کاربری خودتان وجود ندارد.';
  end if;

  select role, active into target_role, target_active
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  if target_role = 'QC_MANAGER' and target_active = true then
    select count(*) into active_qc_count
    from public.profiles
    where role = 'QC_MANAGER' and active = true;

    if active_qc_count <= 1 then
      raise exception 'حداقل یک مدیر ارشد QC فعال باید در سیستم باقی بماند.';
    end if;
  end if;

  delete from auth.users where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_create_personnel(text, text, text, text) from anon, public;
revoke execute on function public.admin_update_personnel(uuid, text, text, text, boolean) from anon, public;
revoke execute on function public.admin_reset_personnel_password(uuid, text) from anon, public;
revoke execute on function public.admin_delete_personnel(uuid) from anon, public;

grant execute on function public.admin_create_personnel(text, text, text, text) to authenticated;
grant execute on function public.admin_update_personnel(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_personnel_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_personnel(uuid) to authenticated;

-- ==============================================================================
-- ۷. فعال‌سازی بلادرنگ (Realtime Publications)
-- ==============================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects') then
    alter publication supabase_realtime add table public.projects;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets') then
    alter publication supabase_realtime add table public.tickets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talaie_sync') then
    alter publication supabase_realtime add table public.talaie_sync;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'installation_teams') then
    alter publication supabase_realtime add table public.installation_teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members') then
    alter publication supabase_realtime add table public.team_members;
  end if;
end $$;

-- ==============================================================================
-- ۸. پاک‌سازی پسوندهای نقش از نام کاربران قدیمی
-- ==============================================================================
update public.profiles
set name = trim(
  regexp_replace(
    name,
    '\s*\((سرپرست اکیپ|تکنسین نصب|مسئول QC|مسئول فنی و QC)\)\s*$',
    '',
    'g'
  )
)
where name ~ '\((سرپرست اکیپ|تکنسین نصب|مسئول QC|مسئول فنی و QC)\)\s*$';

-- ==============================================================================
-- ۹. تاریخچه‌ی تغییرات پروژه‌ها و حذف کامل توسط مدیر (مایگریشن ۰۰۸)
-- ==============================================================================
-- ۱. جدول تاریخچه‌ی تغییرات
create table if not exists public.project_audit (
  id bigserial primary key,
  project_id text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  reason text
);

-- اگر جدول قبلاً با کلید خارجی بدون on delete set null ساخته شده، اصلاحش کن (تا حذف پرسنل خطا ندهد)
do $$
declare fk record;
begin
  for fk in
    select conname from pg_constraint
    where conrelid = 'public.project_audit'::regclass and contype = 'f' and confdeltype <> 'n'
  loop
    execute format('alter table public.project_audit drop constraint %I', fk.conname);
  end loop;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_audit'::regclass and contype = 'f'
  ) then
    alter table public.project_audit
      add constraint project_audit_changed_by_fkey
      foreign key (changed_by) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists idx_project_audit_project_id on public.project_audit(project_id);
create index if not exists idx_project_audit_changed_at on public.project_audit(changed_at desc);

alter table public.project_audit enable row level security;
revoke all on public.project_audit from anon;
revoke insert, update, delete on public.project_audit from authenticated;
grant select on public.project_audit to authenticated;

drop policy if exists "QC Managers read audit" on public.project_audit;
create policy "QC Managers read audit"
  on public.project_audit for select to authenticated
  using (public.is_qc_manager());

-- تریگر BEFORE: کلید موقت _auditReason را از داده جدا می‌کند و تغییر را ثبت می‌کند
-- (نام با zz شروع می‌شود تا بعد از تریگر updated_at اجرا شود)
create or replace function public.projects_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_user_id uuid := auth.uid();
  audit_user_name text := null;
  audit_reason text := nullif(current_setting('talaie.audit_reason', true), '');
begin
  if audit_user_id is not null then
    select name into audit_user_name from public.profiles where id = audit_user_id;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (OLD.id, 'DELETE', audit_user_id, audit_user_name, OLD.data, null, audit_reason);
    return OLD;
  end if;

  if NEW.data ? '_auditReason' then
    audit_reason := coalesce(audit_reason, nullif(NEW.data->>'_auditReason', ''));
    NEW.data := NEW.data - '_auditReason';
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.data is not distinct from NEW.data then
      return NEW; -- تغییری در داده نیست؛ ثبت نکن
    end if;
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (NEW.id, 'UPDATE', audit_user_id, audit_user_name, OLD.data, NEW.data, audit_reason);
  else
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (NEW.id, 'INSERT', audit_user_id, audit_user_name, null, NEW.data, audit_reason);
  end if;
  return NEW;
end;
$$;

revoke execute on function public.projects_audit_trigger() from anon, public;

drop trigger if exists trg_projects_audit on public.projects;
drop trigger if exists zz_projects_audit_write on public.projects;
drop trigger if exists zz_projects_audit_delete on public.projects;
create trigger zz_projects_audit_write
  before insert or update on public.projects
  for each row execute function public.projects_audit_trigger();
create trigger zz_projects_audit_delete
  after delete on public.projects
  for each row execute function public.projects_audit_trigger();

-- ۳. حذف کامل پروژه توسط مدیر QC (با دلیل و حذف اختیاری تیکت‌ها)
create or replace function public.admin_delete_project(p_id text, p_reason text default null, p_delete_tickets boolean default false)
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

revoke execute on function public.admin_delete_project(text, text, boolean) from anon, public;
grant execute on function public.admin_delete_project(text, text, boolean) to authenticated;

-- ==============================================================================
-- ۱۰. پیش‌نیاز تحویل فنی تاریخی برای پروژه‌های موجود (مایگریشن ۰۰۹)
-- ==============================================================================
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

-- ==============================================================================
-- ۱۱. مدیریت تغییرات زمان‌بندی دو مرحله‌ای (مایگریشن ۰۱۰ - فاز P1)
-- ==============================================================================
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

create index if not exists idx_schedule_change_project on public.schedule_change_requests(project_id);
create index if not exists idx_schedule_change_status on public.schedule_change_requests(status);

alter table public.schedule_change_requests enable row level security;
revoke all on public.schedule_change_requests from anon;

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

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_change_requests') then
    alter publication supabase_realtime add table public.schedule_change_requests;
  end if;
end $$;

-- ==============================================================================
-- بخش ۹: جدول و توابع امنیتی درخواست متریال و لجستیک (P2.3)
-- ==============================================================================

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

create index if not exists idx_material_requests_project_id on public.material_requests(project_id);
create index if not exists idx_material_requests_status on public.material_requests(status);
create index if not exists idx_material_requests_created_by on public.material_requests(created_by);
create index if not exists idx_material_requests_updated_at on public.material_requests(updated_at desc);

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

-- ۳. تابع کنترل‌شده ایجاد درخواست متریال (create_material_request) - اتمیک، ایمن در برابر همزمانی و تعارض شناسه
create or replace function public.create_material_request(id text, request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    if not public.can_access_project(v_project) then
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
$$;

revoke execute on function public.create_material_request(text, jsonb) from anon, public;
grant execute on function public.create_material_request(text, jsonb) to authenticated;

-- ۴. تابع کنترل‌شده پچ درخواست متریال (patch_material_request) - لیست سفید سخت‌گیرانه برای تکنسین
create or replace function public.patch_material_request(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
  if not public.is_coordinator_or_manager() then
    if v_project is null or not public.can_access_project(v_project) then
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
$$;

revoke execute on function public.patch_material_request(text, jsonb) from anon, public;
grant execute on function public.patch_material_request(text, jsonb) to authenticated;





do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'material_requests') then
    alter publication supabase_realtime add table public.material_requests;
  end if;
end $$;


-- ==============================================================================
-- ع¯ط§ظ„ط±غŒ ط·ظ„ط§غŒغŒ | ظ…ط§غŒع¯ط±غŒط´ظ† غ°غ±غ¸: ظ¾ط´طھغŒط¨ط§ظ†غŒ ط§ط² ظ†ظ‚ط´ ع©ط§ط±ط´ظ†ط§ط³ ظپط±ظˆط´ (SALES_REP) ظˆ ط¬ط¯ظˆظ„ ط±ط²ط±ظˆ ط¸ط±ظپغŒطھ ظ„طھâ€Œظ‡ط§
-- غ±. ط§طµظ„ط§ط­ ظ…ط­ط¯ظˆط¯غŒطھ ظ†ظ‚ط´â€Œظ‡ط§غŒ profiles ط¨ط±ط§غŒ ظ¾ط°غŒط±ط´ 'SALES_REP' ظˆ 'SALES'
-- غ². ط§غŒط¬ط§ط¯ ط¬ط¯ظˆظ„ sales_bookings ط¨ط±ط§غŒ ط«ط¨طھ ظ¾ط±ظˆعکظ‡â€Œظ‡ط§غŒ ظپط±ظˆط´ ظˆ طھط®طµغŒطµ ط´ظ†ط§ظˆط± ظ„طھâ€Œظ‡ط§
-- غ³. ط§ط¹ظ…ط§ظ„ ط³غŒط§ط³طھâ€Œظ‡ط§غŒ ط§ظ…ظ†غŒطھغŒ RLS (ط³ط·ط­ ط±ط¯غŒظپ)
-- ==============================================================================

-- غ±. ط§طµظ„ط§ط­ ع†ع© ط±ظˆظ„ ط¬ط¯ظˆظ„ profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'SALES_REP',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  ));

-- غ². ط³ط§ط®طھ ط¬ط¯ظˆظ„ ط±ط²ط±ظˆظ‡ط§غŒ ظپط±ظˆط´ ظˆ طھط®طµغŒطµ ظ„طھ
create table if not exists public.sales_bookings (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  laths_count integer not null check (laths_count > 0 and laths_count <= 60),
  is_smart boolean not null default true,
  notes text default '',
  requested_date text not null, -- YYYY-MM-DD
  jalali_date text not null,
  allocation_mode text not null check (allocation_mode in ('SPREAD_DAILY', 'CONSECUTIVE_DAYS')),
  allocated_teams jsonb not null default '[]'::jsonb,
  allocated_days_count integer not null default 1,
  sales_rep_id text not null,
  sales_rep_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ط§غŒظ†ط¯ع©ط³â€Œع¯ط°ط§ط±غŒ ط¨ط±ط§غŒ ط¬ط³طھط¬ظˆغŒ ط³ط±غŒط¹ ط±ظˆط²ط§ظ†ظ‡ ظˆ ط¨ط± ط§ط³ط§ط³ ع©ط§ط±ط´ظ†ط§ط³
create index if not exists idx_sales_bookings_date on public.sales_bookings (requested_date);
create index if not exists idx_sales_bookings_rep on public.sales_bookings (sales_rep_id);

-- غ³. ظپط¹ط§ظ„â€Œط³ط§ط²غŒ ط§ظ…ظ†غŒطھ ط³ط·ط­ ط±ط¯غŒظپ (RLS)
alter table public.sales_bookings enable row level security;

-- ط³غŒط§ط³طھ ظ…ط´ط§ظ‡ط¯ظ‡: ظ‡ظ…ظ‡ ع©ط§ط±ط¨ط±ط§ظ† ط§ط­ط±ط§ط²ظ‡ظˆغŒطھâ€Œط´ط¯ظ‡ ظ…غŒâ€Œطھظˆط§ظ†ظ†ط¯ ط±ط²ط±ظˆظ‡ط§ ط±ط§ ط¨ط¨غŒظ†ظ†ط¯
drop policy if exists "sales_bookings_select_policy" on public.sales_bookings;
create policy "sales_bookings_select_policy"
  on public.sales_bookings
  for select
  to authenticated
  using (true);

-- ط³غŒط§ط³طھ ط«ط¨طھ ظˆ ط§غŒط¬ط§ط¯: ع©ط§ط±ط´ظ†ط§ط³ط§ظ† ظپط±ظˆط´طŒ ظ…ط¯غŒط±ط§ظ† ظˆ ظ‡ظ…ط§ظ‡ظ†ع¯â€Œع©ظ†ظ†ط¯ظ‡ ظ…ط¬ط§ط² ط¨ظ‡ ط«ط¨طھ ظ‡ط³طھظ†ط¯
drop policy if exists "sales_bookings_insert_policy" on public.sales_bookings;
create policy "sales_bookings_insert_policy"
  on public.sales_bookings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('SALES_REP', 'SALES', 'QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
        and active = true
    )
  );

-- ط³غŒط§ط³طھ ط¨ظ‡â€Œط±ظˆط²ط±ط³ط§ظ†غŒ: ظ…ط¯غŒط±ط§ظ† ط§ط±ط´ط¯ ظˆ ط«ط¨طھâ€Œع©ظ†ظ†ط¯ظ‡
drop policy if exists "sales_bookings_update_policy" on public.sales_bookings;
create policy "sales_bookings_update_policy"
  on public.sales_bookings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (
          role in ('QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
          or (role in ('SALES_REP', 'SALES') and id = sales_bookings.sales_rep_id)
        )
        and active = true
    )
  );

-- ط§ط¹ط·ط§غŒ ط¯ط³طھط±ط³غŒ ط¨ظ‡ ظ†ظ‚ط´ authenticated
grant select, insert, update on public.sales_bookings to authenticated;
