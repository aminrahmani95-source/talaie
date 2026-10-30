-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 002: Dedicated tables for Projects & Tickets, Row-by-Row sync,
-- Storage Bucket for Photos, and Sequential Project Codes
-- ==============================================================================

-- ۱. ساخت جدول اختصاصی پروژه‌ها (projects)
create table if not exists public.projects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- ۲. ساخت جدول اختصاصی تیکت‌ها (tickets)
create table if not exists public.tickets (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

-- ۳. ایجاد ایندکس روی فیلدهای پرکاربرد
create index if not exists idx_projects_updated_at on public.projects(updated_at);
create index if not exists idx_tickets_updated_at on public.tickets(updated_at);

-- ۴. تریگر برای پر کردن خودکار updated_at و updated_by در هر تغییر
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

-- ۵. شماره‌گذاری ترتیبی و یکتای کد پروژه‌ها (PRJ-1001, PRJ-1002, ...)
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

-- ۶. امنیت سطح سطر (RLS) برای جدول‌های projects و tickets
alter table public.projects enable row level security;
alter table public.tickets enable row level security;

revoke all on public.projects from anon;
revoke all on public.tickets from anon;

-- سیاست‌های جدول projects
drop policy if exists "Active users read projects" on public.projects;
drop policy if exists "Active users insert projects" on public.projects;
drop policy if exists "Active users update projects" on public.projects;
drop policy if exists "QC Managers delete projects" on public.projects;

create policy "Active users read projects"
  on public.projects for select
  to authenticated
  using (public.is_active_user());

create policy "Active users insert projects"
  on public.projects for insert
  to authenticated
  with check (public.is_active_user());

create policy "Active users update projects"
  on public.projects for update
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create policy "QC Managers delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_qc_manager());

-- سیاست‌های جدول tickets
drop policy if exists "Active users read tickets" on public.tickets;
drop policy if exists "Active users insert tickets" on public.tickets;
drop policy if exists "Active users update tickets" on public.tickets;
drop policy if exists "QC Managers delete tickets" on public.tickets;

create policy "Active users read tickets"
  on public.tickets for select
  to authenticated
  using (public.is_active_user());

create policy "Active users insert tickets"
  on public.tickets for insert
  to authenticated
  with check (public.is_active_user());

create policy "Active users update tickets"
  on public.tickets for update
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create policy "QC Managers delete tickets"
  on public.tickets for delete
  to authenticated
  using (public.is_qc_manager());

-- ۷. انتقال داده‌های موجود از talaie_sync به جدول‌های جدید (با حفظ ردیف‌های قدیمی در talaie_sync به عنوان بک‌آپ)
insert into public.projects (id, data, updated_at)
select 
  elem->>'id' as id,
  elem as data,
  now() as updated_at
from public.talaie_sync,
     jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
where key = 'projects' and elem->>'id' is not null
on conflict (id) do nothing;

insert into public.tickets (id, data, updated_at)
select 
  elem->>'id' as id,
  elem as data,
  now() as updated_at
from public.talaie_sync,
     jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
where key = 'tickets' and elem->>'id' is not null
on conflict (id) do nothing;

-- تنظیم مقدار شروع sequence بر اساس بزرگترین کد پروژه موجود
do $$
declare
  max_code int := 1000;
  p_row record;
  extracted int;
begin
  for p_row in select data->>'code' as code from public.projects where data->>'code' ~ '^PRJ-\d+$' loop
    extracted := substring(p_row.code from 5)::int;
    if extracted > max_code then
      max_code := extracted;
    end if;
  end loop;

  if max_code >= 1000 then
    perform setval('public.project_code_seq', max_code + 1, false);
  end if;
end $$;

-- ۸. فعال‌سازی Supabase Realtime برای جدول‌های جدید
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;
end $$;

-- ۹. ساخت باکت ذخیره‌سازی تصاویر پرسنل و پروژه‌ها (talaie-photos)
insert into storage.buckets (id, name, public)
values ('talaie-photos', 'talaie-photos', false)
on conflict (id) do nothing;

drop policy if exists "Active users upload photos" on storage.objects;
drop policy if exists "Active users read photos" on storage.objects;
drop policy if exists "QC Managers delete photos" on storage.objects;

create policy "Active users upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'talaie-photos' and public.is_active_user());

create policy "Active users read photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'talaie-photos' and public.is_active_user());

create policy "QC Managers delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'talaie-photos' and public.is_qc_manager());
