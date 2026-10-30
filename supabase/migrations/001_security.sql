-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 001: Security, Profiles, and Row Level Security (RLS)
-- ==============================================================================

-- ۱. ساخت جدول پروفایل پرسنل (profiles)
-- این جدول به auth.users متصل است و اطلاعات هویتی و نقشی پرسنل را نگهداری می‌کند.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('QC_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN')),
  avatar text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- فعال‌سازی RLS روی جدول profiles
alter table public.profiles enable row level security;

-- ایجاد ایندکس روی شماره موبایل برای جستجوی سریع
create index if not exists idx_profiles_phone on public.profiles(phone);

-- ۲. توابع کمکی امنیتی با امنیت سطح تعریف‌کننده (Security Definer) و search_path ثابت
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

-- ۳. سیاست‌های امنیتی (RLS Policies) برای جدول profiles
drop policy if exists "Active users or self read profiles" on public.profiles;
drop policy if exists "QC Managers insert profiles" on public.profiles;
drop policy if exists "QC Managers update profiles" on public.profiles;
drop policy if exists "QC Managers delete profiles" on public.profiles;

-- خواندن: کاربر وارد شده بتواند پروفایل خود را بخواند (بدون ایجاد چرخه ارجاعی)، 
-- و کاربر فعال بتواند تمام پروفایل‌ها را برای نمایش نام اکیپ و سرپرستان بخواند.
create policy "Active users or self read profiles"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_active_user());

-- ثبت کاربر: فقط مدیر QC
create policy "QC Managers insert profiles"
  on public.profiles
  for insert
  to authenticated
  with check (public.is_qc_manager());

-- ویرایش: فقط مدیر QC
create policy "QC Managers update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.is_qc_manager())
  with check (public.is_qc_manager());

-- حذف: فقط مدیر QC
create policy "QC Managers delete profiles"
  on public.profiles
  for delete
  to authenticated
  using (public.is_qc_manager());


-- ۴. ایمن‌سازی جدول همگام‌سازی ابری (talaie_sync)
create table if not exists public.talaie_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.talaie_sync enable row level security;

-- حذف سیاست‌های قدیمی و ناامن قبلی
drop policy if exists "Allow public access to talaie_sync" on public.talaie_sync;
drop policy if exists "Active users read sync" on public.talaie_sync;
drop policy if exists "Active users write projects and tickets" on public.talaie_sync;
drop policy if exists "Active users update projects and tickets" on public.talaie_sync;
drop policy if exists "QC Managers insert settings" on public.talaie_sync;
drop policy if exists "QC Managers update settings" on public.talaie_sync;
drop policy if exists "QC Managers delete sync" on public.talaie_sync;

-- لغو کامل تمام دسترسی‌های ناشناس (anon) به جدول‌های سیستم
revoke all on public.talaie_sync from anon;
revoke all on public.profiles from anon;

-- سیاست‌های جدید talaie_sync
-- خواندن داده‌ها: فقط کاربران احراز هویت شده و فعال (کلید users_backup فقط برای مدیر QC قابل خواندن است)
create policy "Active users read sync"
  on public.talaie_sync
  for select
  to authenticated
  using (
    public.is_active_user() and (
      key != 'users_backup' or public.is_qc_manager()
    )
  );

-- ثبت پروژه‌ها و تیکت‌ها: تمام کاربران فعال
create policy "Active users write projects and tickets"
  on public.talaie_sync
  for insert
  to authenticated
  with check (public.is_active_user() and key in ('projects', 'tickets'));

-- به‌روزرسانی پروژه‌ها و تیکت‌ها: تمام کاربران فعال
create policy "Active users update projects and tickets"
  on public.talaie_sync
  for update
  to authenticated
  using (public.is_active_user() and key in ('projects', 'tickets'))
  with check (public.is_active_user() and key in ('projects', 'tickets'));

-- تغییر تنظیمات سیستم: فقط مدیر QC
create policy "QC Managers insert settings"
  on public.talaie_sync
  for insert
  to authenticated
  with check (public.is_qc_manager() and key = 'settings');

create policy "QC Managers update settings"
  on public.talaie_sync
  for update
  to authenticated
  using (public.is_qc_manager() and key = 'settings')
  with check (public.is_qc_manager() and key = 'settings');

-- حذف سطر از talaie_sync: فقط مدیر QC
create policy "QC Managers delete sync"
  on public.talaie_sync
  for delete
  to authenticated
  using (public.is_qc_manager());

-- ۵. تغییر کلید داده‌های کاربران قدیمی به users_backup با حذف رمزعبور جهت استفاده در مهاجرت شناسه‌ها
update public.talaie_sync
set key = 'users_backup',
    value = (select jsonb_agg(e - 'password') from jsonb_array_elements(value) e)
where key = 'users';

-- ۶. فعال‌سازی همگام‌سازی زنده (Supabase Realtime) برای جداول
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'talaie_sync'
  ) then
    alter publication supabase_realtime add table public.talaie_sync;
  end if;
end $$;
