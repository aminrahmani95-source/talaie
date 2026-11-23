-- ==============================================================================
-- گالری طلایی | سامانه عملیات و کنترل کیفیت نصب (Talaei Gallery)
-- Migration 024: همگام‌سازی ساختار اکیپ‌ها، اعضا و پرسنل رسمی در سرور Supabase
-- ==============================================================================

-- ۱. ساخت جدول اکیپ‌های نصب در صورت عدم وجود
create table if not exists public.installation_teams (
  id text primary key,
  name text not null,
  code text not null unique,
  supervisor_id text,
  supervisor_name text,
  daily_capacity_hours numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ۲. ساخت جدول اعضای اکیپ‌ها در صورت عدم وجود
create table if not exists public.team_members (
  id text primary key,
  team_id text not null,
  user_id text not null,
  user_name text,
  role_in_team text not null check (role_in_team in ('LEAD', 'TECHNICIAN')),
  joined_at timestamptz default now()
);

-- ۳. ایندکس‌های کارایی
create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);

-- ۴. تنظیم دسترسی‌های امنیتی (Row Level Security)
alter table public.installation_teams enable row level security;
alter table public.team_members enable row level security;

-- حذف سیاست‌های تکراری پیشین
drop policy if exists "Anyone authenticated read teams" on public.installation_teams;
drop policy if exists "Managers modify teams" on public.installation_teams;
drop policy if exists "Anyone authenticated read members" on public.team_members;
drop policy if exists "Managers modify members" on public.team_members;

-- خواندن برای تمام کاربران معتبر آزاد است
create policy "Anyone authenticated read teams"
  on public.installation_teams for select to authenticated
  using (true);

create policy "Managers modify teams"
  on public.installation_teams for all to authenticated
  using (true) with check (true);

create policy "Anyone authenticated read members"
  on public.team_members for select to authenticated
  using (true);

create policy "Managers modify members"
  on public.team_members for all to authenticated
  using (true) with check (true);

-- ۵. ثبت اکیپ‌های رسمی ۱ و ۲
insert into public.installation_teams (id, name, code, supervisor_id, supervisor_name)
values 
  ('TEAM_1', 'اکیپ نصب ۱', 'TEAM_1', 'usr-lead-a', 'رضا کریمی'),
  ('TEAM_2', 'اکیپ نصب ۲', 'TEAM_2', 'usr-lead-b', 'حسین مرادی')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  supervisor_id = coalesce(public.installation_teams.supervisor_id, excluded.supervisor_id),
  supervisor_name = coalesce(public.installation_teams.supervisor_name, excluded.supervisor_name);

-- ۶. ثبت اعضای پیش‌فرض اکیپ‌ها
insert into public.team_members (id, team_id, user_id, user_name, role_in_team)
values
  ('tm-1', 'TEAM_1', 'usr-lead-a', 'رضا کریمی', 'LEAD'),
  ('tm-2', 'TEAM_1', 'usr-tech-a', 'مهدی نوری', 'TECHNICIAN'),
  ('tm-3', 'TEAM_2', 'usr-lead-b', 'حسین مرادی', 'LEAD'),
  ('tm-4', 'TEAM_2', 'usr-tech-b', 'علی صادقی', 'TECHNICIAN')
on conflict (id) do update set
  team_id = excluded.team_id,
  user_id = excluded.user_id,
  user_name = excluded.user_name,
  role_in_team = excluded.role_in_team;

-- ۷. به‌روزرسانی یا درج پروفایل‌های پرسنل رسمی در جدول profiles
insert into public.profiles (id, name, phone, role, active)
values
  ('u-ceo', 'امید طلایی (مدیرعامل)', '09121111110', 'CEO', true),
  ('u-qc-manager', 'مهندس رحمانی (مدیر اپ و QC)', '09124339038', 'QC_MANAGER', true),
  ('usr-lead-a', 'رضا کریمی', '09120000001', 'LEAD_TECHNICIAN', true),
  ('usr-tech-a', 'مهدی نوری', '09120000002', 'TECHNICIAN', true),
  ('usr-lead-b', 'حسین مرادی', '09120000003', 'LEAD_TECHNICIAN', true),
  ('usr-tech-b', 'علی صادقی', '09120000004', 'TECHNICIAN', true),
  ('usr-wh', 'سعید احمدی', '09120000005', 'WAREHOUSE', true),
  ('usr-sales', 'نگار رستمی', '09120000006', 'SALES_REP', true)
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  role = excluded.role,
  active = excluded.active;

-- ۸. فعال‌سازی انتشار بلادرنگ Realtime برای اکیپ‌ها و اعضا
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'installation_teams') then
    alter publication supabase_realtime add table public.installation_teams;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members') then
    alter publication supabase_realtime add table public.team_members;
  end if;
end $$;
