-- ==============================================================================
-- گالری طلایی | اسکریپت جامع راه‌اندازی و تثبیت کامل پایگاه داده (Single Source of Truth)
-- این فایل شامل تمام تعاریف و آخرین نسخه‌های ارتقایافته جداول، توابع امنیتی،
-- RLS، باکت ذخیره‌سازی تصاویر و RPCهای پرسنل است و کاملاً Idempotent می‌باشد.
-- ==============================================================================

-- ۰. فعال‌سازی اکستنشن‌های مورد نیاز
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- ۱. جدول پروفایل پرسنل (profiles) و توابع امنیتی وضعیت و نقش کاربر
-- ==============================================================================
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

revoke execute on function public.is_active_user() from anon, public;
grant execute on function public.is_active_user() to authenticated;
revoke execute on function public.is_qc_manager() from anon, public;
grant execute on function public.is_qc_manager() to authenticated;

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
drop policy if exists "Active users insert projects" on public.projects;
drop policy if exists "Active users update projects" on public.projects;
drop policy if exists "QC Managers insert projects" on public.projects;
drop policy if exists "QC Managers update projects" on public.projects;
drop policy if exists "QC Managers delete projects" on public.projects;

create policy "Active users read projects"
  on public.projects for select to authenticated
  using (public.is_active_user());

create policy "QC Managers insert projects"
  on public.projects for insert to authenticated
  with check (public.is_qc_manager());

create policy "QC Managers update projects"
  on public.projects for update to authenticated
  using (public.is_qc_manager())
  with check (public.is_qc_manager());

create policy "QC Managers delete projects"
  on public.projects for delete to authenticated
  using (public.is_qc_manager());

-- سیاست‌های تیکت‌ها: ثبت توسط تکنسین پروژه، حل فقط توسط مدیر QC
drop policy if exists "Active users read tickets" on public.tickets;
drop policy if exists "Active users insert tickets" on public.tickets;
drop policy if exists "Active users update tickets" on public.tickets;
drop policy if exists "Authorized users insert tickets" on public.tickets;
drop policy if exists "Authorized users update tickets" on public.tickets;
drop policy if exists "QC Managers delete tickets" on public.tickets;

create policy "Active users read tickets"
  on public.tickets for select to authenticated
  using (public.is_active_user());

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
-- ۴. توابع عملیاتی پروژه‌ها: patch_project (با گارد کامل نقش‌ها) و append_project_evaluation
-- ==============================================================================
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

  select data into current_data
  from public.projects
  where public.projects.id = patch_project.id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  if not public.is_qc_manager() then
    -- الف) بررسی انتساب پروژه به تکنسین / سرپرست
    if not (
      (current_data->>'leadTechnicianId' is not null and current_data->>'leadTechnicianId' = auth.uid()::text) or
      (current_data->'assignedTechnicianIds' is not null and current_data->'assignedTechnicianIds' ? auth.uid()::text)
    ) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- ب) بررسی کلیدهای مجاز برای تکنسین
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in (
        'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
        'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
        'customerSignature', 'customerSatisfaction', 'customerSurvey', 'stuckIncidents',
        'updatedAt', 'qcStatus'
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
          (curr_st in ('EN_ROUTE', 'IN_PROGRESS') and new_st = 'STUCK')
        ) then
          raise exception 'انتقال وضعیت از «%» به «%» برای تکنسین مجاز نیست.', coalesce(curr_st, 'نامشخص'), new_st;
        end if;
      end;
    end if;

    -- هـ) بررسی گزارش توقف (stuckIncidents):
    -- برای تکنسین تنها الصاق دقیقاً یک رویداد جدید با resolutionStatus = 'OPEN' مجاز است و رویدادهای قبلی نباید تغییر کنند
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

revoke execute on function public.patch_project(text, jsonb) from anon, public;
grant execute on function public.patch_project(text, jsonb) to authenticated;

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
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به ثبت پرسنل جدید است.';
  end if;

  clean_phone := trim(new_phone);
  if clean_phone = '' then
    raise exception 'شماره تلفن الزامی است.';
  end if;

  if new_role not in ('QC_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش انتخاب‌شده معتبر نیست.';
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
    case when new_role = 'QC_MANAGER' then '👔' when new_role = 'LEAD_TECHNICIAN' then '🧢' else '🔧' end,
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
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به ویرایش پرسنل است.';
  end if;

  select role, active into current_role, current_active
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  if target_id = auth.uid() then
    if new_role is not null and new_role != 'QC_MANAGER' then
      raise exception 'امکان تغییر نقش حساب کاربری خودتان وجود ندارد.';
    end if;
    if new_active is not null and new_active = false then
      raise exception 'امکان غیرفعال کردن حساب کاربری خودتان وجود ندارد.';
    end if;
  end if;

  if current_role = 'QC_MANAGER' and current_active = true then
    if (new_active is not null and new_active = false) or (new_role is not null and new_role != 'QC_MANAGER') then
      select count(*) into active_qc_count
      from public.profiles
      where role = 'QC_MANAGER' and active = true;

      if active_qc_count <= 1 then
        raise exception 'حداقل یک مدیر ارشد QC فعال باید در سیستم باقی بماند.';
      end if;
    end if;
  end if;

  if new_role is not null and new_role not in ('QC_MANAGER', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش انتخاب‌شده معتبر نیست.';
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
end $$;
