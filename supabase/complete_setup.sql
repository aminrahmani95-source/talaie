-- ==============================================================================
-- گالری طلایی | اسکریپت جامع راه‌اندازی دیتابیس و فعال‌سازی مدیر ارشد QC
-- این اسکریپت تمام جداول (پروفایل‌ها، پروژه‌ها، تیکت‌ها)، امنیت RLS و باکت عکس‌ها را ساخته
-- و حساب کاربر 09124339038 با رمز 91243390380 را در یک مرحله فعال می‌کند.
-- ==============================================================================

-- ۱. ساخت جدول پروفایل پرسنل (profiles)
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

-- ۲. ساخت جدول همگام‌سازی تنظیمات (talaie_sync)
create table if not exists public.talaie_sync (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.talaie_sync enable row level security;
revoke all on public.talaie_sync from anon;
revoke all on public.profiles from anon;

drop policy if exists "Active users read sync" on public.talaie_sync;
drop policy if exists "Active users write projects and tickets" on public.talaie_sync;
drop policy if exists "Active users update projects and tickets" on public.talaie_sync;
drop policy if exists "QC Managers insert settings" on public.talaie_sync;
drop policy if exists "QC Managers update settings" on public.talaie_sync;
drop policy if exists "QC Managers delete sync" on public.talaie_sync;

create policy "Active users read sync"
  on public.talaie_sync for select to authenticated
  using (public.is_active_user());

create policy "Active users write projects and tickets"
  on public.talaie_sync for insert to authenticated
  with check (public.is_active_user() and key in ('projects', 'tickets'));

create policy "Active users update projects and tickets"
  on public.talaie_sync for update to authenticated
  using (public.is_active_user() and key in ('projects', 'tickets'))
  with check (public.is_active_user() and key in ('projects', 'tickets'));

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

-- ۳. ساخت جدول‌های اختصاصی پروژه‌ها و تیکت‌ها (projects & tickets)
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

drop policy if exists "Active users read projects" on public.projects;
drop policy if exists "Active users insert projects" on public.projects;
drop policy if exists "Active users update projects" on public.projects;
drop policy if exists "QC Managers delete projects" on public.projects;

create policy "Active users read projects"
  on public.projects for select to authenticated
  using (public.is_active_user());

create policy "Active users insert projects"
  on public.projects for insert to authenticated
  with check (public.is_active_user());

create policy "Active users update projects"
  on public.projects for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create policy "QC Managers delete projects"
  on public.projects for delete to authenticated
  using (public.is_qc_manager());

drop policy if exists "Active users read tickets" on public.tickets;
drop policy if exists "Active users insert tickets" on public.tickets;
drop policy if exists "Active users update tickets" on public.tickets;
drop policy if exists "QC Managers delete tickets" on public.tickets;

create policy "Active users read tickets"
  on public.tickets for select to authenticated
  using (public.is_active_user());

create policy "Active users insert tickets"
  on public.tickets for insert to authenticated
  with check (public.is_active_user());

create policy "Active users update tickets"
  on public.tickets for update to authenticated
  using (public.is_active_user()) with check (public.is_active_user());

create policy "QC Managers delete tickets"
  on public.tickets for delete to authenticated
  using (public.is_qc_manager());

-- ۴. ساخت باکت اختصاصی ذخیره‌سازی عکس‌ها و تابع به‌روزرسانی اتمیک
insert into storage.buckets (id, name, public)
values ('talaie-photos', 'talaie-photos', false)
on conflict (id) do nothing;

drop policy if exists "Active users upload photos" on storage.objects;
drop policy if exists "Active users read photos" on storage.objects;
drop policy if exists "QC Managers delete photos" on storage.objects;

create policy "Active users upload photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'talaie-photos' and public.is_active_user());

create policy "Active users read photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'talaie-photos' and public.is_active_user());

create policy "QC Managers delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'talaie-photos' and public.is_qc_manager());

create or replace function public.patch_project(id text, patch jsonb)
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

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  update public.projects
  set data = data || patch,
      updated_at = now(),
      updated_by = auth.uid()
  where public.projects.id = patch_project.id
  returning data into updated_data;

  if not found then
    raise exception 'Project % not found', patch_project.id;
  end if;

  return updated_data;
end;
$$;

-- ۵. فعال‌سازی Realtime
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
end $$;

-- ۶. ایجاد و فعال‌سازی کاربر مدیر ارشد QC (09124339038 با رمز 91243390380)
do $$
declare
  target_uid uuid;
begin
  select id into target_uid
  from auth.users
  where email in ('09124339038@talaie.ir', '09124339038@talaie.local')
  limit 1;

  if target_uid is not null then
    update auth.users
    set encrypted_password = crypt('91243390380', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at = now()
    where id = target_uid;
  else
    target_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      target_uid, 'authenticated', 'authenticated', '09124339038@talaie.ir',
      crypt('91243390380', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, now(), now()
    );
  end if;

  insert into public.profiles (id, name, phone, role, avatar, active)
  values (
    target_uid,
    'امین رحمانی (مسئول QC)',
    '09124339038',
    'QC_MANAGER',
    '👔',
    true
  )
  on conflict (id) do update set
    name = 'امین رحمانی (مسئول QC)',
    phone = '09124339038',
    role = 'QC_MANAGER',
    active = true;

  update public.profiles
  set role = 'QC_MANAGER', active = true
  where phone = '09124339038';
end $$;
