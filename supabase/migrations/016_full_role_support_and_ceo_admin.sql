-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۶: پشتیبانی کامل از کلیه نقش‌های سازمانی و اختیارات مدیریت عامل
-- ۱. اصلاح محدودیت نقش‌های profiles به تمام ۸ نقش سازمانی معتبر
-- ۲. تعریف و به‌روزرسانی توابع احراز هویت مدیریت (QC Manager و CEO)
-- ۳. به‌روزرسانی توابع ادمین: admin_update_personnel, admin_create_personnel, admin_delete_personnel
-- ۴. اعطای دسترسی مدیریت اکیپ‌های نصب به مدیرعامل در کنار مدیر QC
-- ۵. اطمینان از وجود جداول ساختار اکیپ‌ها و درخواست‌ها
-- ==============================================================================

-- ۱. اصلاح چک رول جدول profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  ));

-- ۲. تابع احراز مدیریت ارشد (مدیر QC یا مدیرعامل)
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

create or replace function public.is_qc_manager()
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

revoke execute on function public.is_qc_or_ceo() from anon, public;
grant execute on function public.is_qc_or_ceo() to authenticated;
revoke execute on function public.is_qc_manager() from anon, public;
grant execute on function public.is_qc_manager() to authenticated;

-- ۳. به‌روزرسانی admin_create_personnel جهت پشتیبانی از کلیه نقش‌ها و دسترسی CEO
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
    select 1 from auth.users where email in (email_addr, clean_phone || '@talaie.local', clean_phone || '@talaie.app')
  ) or exists (
    select 1 from public.profiles where phone = clean_phone
  ) then
    raise exception 'شماره موبایل وارد شده قبلاً در سیستم ثبت شده است.';
  end if;

  user_uid := gen_random_uuid();

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token
  ) values (
    user_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email_addr,
    crypt(trim(new_password), gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', trim(new_name), 'phone', clean_phone, 'role', new_role),
    now(),
    now(),
    encode(gen_random_bytes(32), 'hex')
  );

  insert into public.profiles (id, name, phone, role, active, created_at, updated_at)
  values (user_uid, trim(new_name), clean_phone, new_role, true, now(), now())
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    active = excluded.active,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', user_uid,
      'name', trim(new_name),
      'phone', clean_phone,
      'role', new_role,
      'active', true
    )
  );
end;
$$;

revoke execute on function public.admin_create_personnel(text, text, text, text) from anon, public;
grant execute on function public.admin_create_personnel(text, text, text, text) to authenticated;

-- ۴. به‌روزرسانی admin_update_personnel جهت پشتیبانی از کلیه نقش‌ها و دسترسی CEO
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
  clean_phone text;
  email_addr text;
  current_role text;
  current_active boolean;
  active_admin_count int;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به ویرایش مشخصات پرسنل است.';
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
    raise exception 'نقش نامعتبر است: %', new_role;
  end if;

  select role, active into current_role, current_active
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  -- بررسی حفظ حداقل یک مدیر فعال در سیستم
  if current_role in ('QC_MANAGER', 'CEO') and (new_role not in ('QC_MANAGER', 'CEO') or new_active = false) then
    select count(*) into active_admin_count
    from public.profiles
    where role in ('QC_MANAGER', 'CEO') and active = true and id != target_id;

    if active_admin_count < 1 then
      raise exception 'حداقل یک مدیر ارشد فعال باید در سیستم باقی بماند.';
    end if;
  end if;

  clean_phone := trim(new_phone);
  email_addr := clean_phone || '@talaie.ir';

  update public.profiles
  set
    name = trim(new_name),
    phone = clean_phone,
    role = new_role,
    active = coalesce(new_active, true),
    updated_at = now()
  where id = target_id;

  update auth.users
  set
    raw_user_meta_data = jsonb_build_object('name', trim(new_name), 'phone', clean_phone, 'role', new_role),
    email = email_addr,
    updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_update_personnel(uuid, text, text, text, boolean) from anon, public;
grant execute on function public.admin_update_personnel(uuid, text, text, text, boolean) to authenticated;

-- ۵. به‌روزرسانی admin_reset_personnel_password
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
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به تغییر رمز عبور پرسنل است.';
  end if;

  if length(trim(new_password)) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  update auth.users
  set
    encrypted_password = crypt(trim(new_password), gen_salt('bf')),
    updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_reset_personnel_password(uuid, text) from anon, public;
grant execute on function public.admin_reset_personnel_password(uuid, text) to authenticated;

-- ۶. به‌روزرسانی admin_delete_personnel
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
  active_admin_count int;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به حذف پرسنل است.';
  end if;

  if target_id = auth.uid() then
    raise exception 'امکان حذف حساب کاربری خودتان وجود ندارد.';
  end if;

  select role into target_role
  from public.profiles
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر یافت نشد.';
  end if;

  if target_role in ('QC_MANAGER', 'CEO') then
    select count(*) into active_admin_count
    from public.profiles
    where role in ('QC_MANAGER', 'CEO') and active = true and id != target_id;

    if active_admin_count < 1 then
      raise exception 'امکان حذف آخرین مدیر ارشد فعال سامانه وجود ندارد.';
    end if;
  end if;

  delete from public.team_members where user_id = target_id;
  update public.installation_teams set supervisor_id = null where supervisor_id = target_id;
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_delete_personnel(uuid) from anon, public;
grant execute on function public.admin_delete_personnel(uuid) to authenticated;

-- ۷. به‌روزرسانی توابع مدیریت اکیپ‌ها جهت اعطای دسترسی به CEO
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
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به مدیریت ترکیب اکیپ‌های نصب است.';
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

  delete from public.team_members where user_id = p_user_id;

  insert into public.team_members (team_id, user_id, role_in_team, joined_at)
  values (p_team_id, p_user_id, p_role_in_team, now());

  if p_role_in_team = 'LEAD' then
    update public.installation_teams
    set supervisor_id = p_user_id, updated_at = now()
    where id = p_team_id;

    update public.profiles
    set role = 'LEAD_TECHNICIAN', updated_at = now()
    where id = p_user_id;
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
declare
  t_id uuid;
  r_team text;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیریت ارشد مجاز به مدیریت ترکیب اکیپ‌های نصب است.';
  end if;

  select team_id, role_in_team into t_id, r_team
  from public.team_members
  where user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', true, 'message', 'عضو در اکیپی یافت نشد.');
  end if;

  delete from public.team_members where user_id = p_user_id;

  if r_team = 'LEAD' then
    update public.installation_teams
    set supervisor_id = null, updated_at = now()
    where id = t_id and supervisor_id = p_user_id;
  end if;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.admin_assign_team_member(uuid, uuid, text) from anon, public;
grant execute on function public.admin_assign_team_member(uuid, uuid, text) to authenticated;
revoke execute on function public.admin_remove_team_member(uuid) from anon, public;
grant execute on function public.admin_remove_team_member(uuid) to authenticated;

-- ۸. اطمینان از وجود جداول اکیپ‌ها و درخواست‌ها
create table if not exists public.installation_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  supervisor_id uuid references auth.users(id),
  daily_capacity_hours numeric check (daily_capacity_hours is null or daily_capacity_hours > 0),
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

alter table public.installation_teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Active users read teams" on public.installation_teams;
create policy "Active users read teams"
  on public.installation_teams for select to authenticated
  using (public.is_active_user());

drop policy if exists "Managers modify teams" on public.installation_teams;
create policy "Managers modify teams"
  on public.installation_teams for all to authenticated
  using (public.is_qc_or_ceo());

drop policy if exists "Active users read team members" on public.team_members;
create policy "Active users read team members"
  on public.team_members for select to authenticated
  using (public.is_active_user());

drop policy if exists "Managers modify team members" on public.team_members;
create policy "Managers modify team members"
  on public.team_members for all to authenticated
  using (public.is_qc_or_ceo());
