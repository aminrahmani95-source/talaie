-- ==============================================================================
-- گالری طلایی | سامانه عملیات و کنترل کیفیت نصب (Talaei Gallery)
-- Migration 024: همگام‌سازی ساختار اکیپ‌ها و پاکسازی کامل کاربران تستی در Supabase
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

-- خواندن برای تمام کاربران احرازشده آزاد است
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

-- ۵. ثبت اکیپ‌های رسمی ۱ و ۲ (بدون سرپرست ساختگی/تستی)
insert into public.installation_teams (id, name, code)
values 
  ('TEAM_1', 'اکیپ نصب ۱', 'TEAM_1'),
  ('TEAM_2', 'اکیپ نصب ۲', 'TEAM_2')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code;

-- ۶. حذف هرگونه کاربر تستی یا ماک از جدول profiles و team_members
delete from public.team_members
where user_id in ('usr-lead-a', 'usr-tech-a', 'usr-lead-b', 'usr-tech-b', 'usr-wh', 'usr-sales')
   or user_id like 'usr-%'
   or user_id like 'u-test-%'
   or user_id like 'u-demo-%';

delete from public.profiles
where id in ('usr-lead-a', 'usr-tech-a', 'usr-lead-b', 'usr-tech-b', 'usr-wh', 'usr-sales')
   or id like 'usr-%'
   or id like 'u-test-%'
   or id like 'u-demo-%';

-- ۷. اطمینان از وجود حساب‌های رسمی ریشه (مدیرعامل و مدیر اپ)
insert into public.profiles (id, name, phone, role, active)
values
  ('u-ceo', 'امید طلایی (مدیرعامل)', '09121111110', 'CEO', true),
  ('u-qc-manager', 'مهندس رحمانی (مدیر اپ و QC)', '09124339038', 'QC_MANAGER', true)
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
