-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۴: بازسازی کامل مدیریت پرسنل و اکیپ‌ها
--
-- چرا: مایگریشن‌های ۰۰۹ و ۰۱۶ روی سرور با خطای
--   «cannot remove parameter defaults from existing function»
-- متوقف می‌شدند، پس معلوم نیست کدام نسخه از توابع پرسنل روی سرور است. نتیجه:
--   • ساخت کارشناس فروش (SALES_REP) همیشه رد می‌شد،
--   • بعضی نسخه‌ها ایمیل کاربر را به @talaie.app تغییر می‌دادند (ورود دیگر کار نمی‌کرد)،
--   • کاربرهای ساخته‌شده با SQL ستون‌های توکن NULL داشتند که ورود را خراب می‌کند.
--
-- این فایل مستقل و قابل اجرای چندباره است: همه‌ی نسخه‌های قدیمی توابع را حذف
-- و از نو می‌سازد، و کاربران موجود را ترمیم می‌کند. در Supabase → SQL Editor اجرا کنید.
-- ==============================================================================

-- ۰. پیش‌بررسی: اگر جدول اکیپ‌ها با شناسه‌ی متنی (مثل 'TEAM_1') ساخته شده باشد، این فایل
--    نباید نیمه‌کاره اجرا شود. در آن صورت با یک پیام روشن متوقف می‌شود و هیچ چیزی تغییر نمی‌کند.
do $check$
declare
  bad text;
begin
  select string_agg(table_name || '.' || column_name || ' = ' || data_type, '، ') into bad
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'installation_teams' and column_name = 'id')
      or (table_name = 'team_members' and column_name in ('team_id', 'user_id')))
    and data_type <> 'uuid';
  if bad is not null then
    raise exception 'توقف ۰۲۴: نوع ستون‌های اکیپ uuid نیست (%). این را به Claude گزارش بده؛ چیزی تغییر نکرد.', bad;
  end if;
end;
$check$;

-- ۱. توابع کمکی دسترسی ----------------------------------------------------------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;

create or replace function public.is_qc_or_ceo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('QC_MANAGER', 'CEO') and active = true
  );
$$;

-- ۲. جدول پروفایل: ستون زمان ویرایش + همه‌ی نقش‌ها ------------------------------
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists avatar text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'CEO', 'QC_MANAGER', 'SCHEDULING_COORDINATOR', 'SALES', 'SALES_REP',
  'MEASUREMENT_LEAD', 'WAREHOUSE', 'LEAD_TECHNICIAN', 'TECHNICIAN'
));

grant select on public.profiles to authenticated;

-- همه‌ی کاربران فعال فهرست پرسنل را می‌بینند (برای نام اکیپ‌ها و سرپرست‌ها)
drop policy if exists "Active users or self read profiles" on public.profiles;
create policy "Active users or self read profiles"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_active_user());

-- ۳. حذف همه‌ی نسخه‌های قبلی توابع (با هر امضایی) ------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_create_personnel', 'admin_update_personnel', 'admin_reset_personnel_password',
        'admin_delete_personnel', 'admin_assign_team_member', 'admin_remove_team_member'
      )
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;

-- شماره را به رقم‌های لاتین و بدون فاصله/خط تیره تبدیل می‌کند
create or replace function public.normalize_phone(raw text)
returns text language sql immutable as $$
  select regexp_replace(
    translate(coalesce(raw, ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'),
    '[^0-9]', '', 'g'
  );
$$;

-- ۴. ساخت پرسنل ------------------------------------------------------------------
create function public.admin_create_personnel(
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
  clean_phone text := public.normalize_phone(new_phone);
  email_addr text;
  user_uid uuid := gen_random_uuid();
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند پرسنل جدید ثبت کند.';
  end if;
  if coalesce(trim(new_name), '') = '' then
    raise exception 'نام الزامی است.';
  end if;
  if length(clean_phone) < 10 then
    raise exception 'شماره موبایل معتبر نیست.';
  end if;
  if new_role not in ('CEO', 'QC_MANAGER', 'SCHEDULING_COORDINATOR', 'SALES', 'SALES_REP',
                      'MEASUREMENT_LEAD', 'WAREHOUSE', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش انتخاب‌شده معتبر نیست: %', new_role;
  end if;
  if length(trim(coalesce(new_password, ''))) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  email_addr := clean_phone || '@talaie.ir';

  if exists (select 1 from public.profiles where public.normalize_phone(phone) = clean_phone) then
    raise exception 'این شماره موبایل قبلاً برای یکی از پرسنل ثبت شده است.';
  end if;
  if exists (
    select 1 from auth.users
    where email in (email_addr, clean_phone || '@talaie.local', clean_phone || '@talaie.app')
  ) then
    raise exception 'برای این شماره قبلاً حساب ورود ساخته شده است (پروفایلش حذف شده). با پشتیبانی فنی تماس بگیرید.';
  end if;

  -- ستون‌های توکن باید رشته‌ی خالی باشند، نه NULL؛ وگرنه ورود با خطای سرور مواجه می‌شود
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    user_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    email_addr, crypt(trim(new_password), gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('name', trim(new_name), 'phone', clean_phone, 'role', new_role),
    now(), now(), '', '', '', ''
  );

  begin
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (
      gen_random_uuid(), user_uid, user_uid::text,
      jsonb_build_object('sub', user_uid::text, 'email', email_addr, 'email_verified', true),
      'email', now(), now(), now()
    );
  exception when others then
    -- older auth schema without provider_id: login still works through auth.users
    null;
  end;

  insert into public.profiles (id, name, phone, role, active, created_at, updated_at)
  values (user_uid, trim(new_name), clean_phone, new_role, true, now(), now());

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object('id', user_uid, 'name', trim(new_name), 'phone', clean_phone, 'role', new_role, 'active', true)
  );
end;
$$;

-- ۵. ویرایش پرسنل ---------------------------------------------------------------
create function public.admin_update_personnel(
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
  cur public.profiles%rowtype;
  final_phone text;
  final_role text;
  final_active boolean;
  email_addr text;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند مشخصات پرسنل را ویرایش کند.';
  end if;

  select * into cur from public.profiles where id = target_id;
  if not found then
    raise exception 'این فرد روی سرور پیدا نشد.';
  end if;

  final_phone := coalesce(nullif(public.normalize_phone(new_phone), ''), public.normalize_phone(cur.phone));
  final_role := coalesce(new_role, cur.role);
  final_active := coalesce(new_active, cur.active, true);

  if final_role not in ('CEO', 'QC_MANAGER', 'SCHEDULING_COORDINATOR', 'SALES', 'SALES_REP',
                        'MEASUREMENT_LEAD', 'WAREHOUSE', 'LEAD_TECHNICIAN', 'TECHNICIAN') then
    raise exception 'نقش نامعتبر است: %', final_role;
  end if;
  if length(final_phone) < 10 then
    raise exception 'شماره موبایل معتبر نیست.';
  end if;
  if exists (
    select 1 from public.profiles where id <> target_id and public.normalize_phone(phone) = final_phone
  ) then
    raise exception 'این شماره موبایل برای فرد دیگری ثبت شده است.';
  end if;

  if cur.role in ('QC_MANAGER', 'CEO') and (final_role not in ('QC_MANAGER', 'CEO') or final_active = false) then
    if not exists (
      select 1 from public.profiles
      where role in ('QC_MANAGER', 'CEO') and active = true and id <> target_id
    ) then
      raise exception 'حداقل یک مدیر فعال باید در سامانه باقی بماند.';
    end if;
  end if;

  update public.profiles
  set name = coalesce(nullif(trim(new_name), ''), cur.name),
      phone = final_phone,
      role = final_role,
      active = final_active,
      updated_at = now()
  where id = target_id;

  -- نقش اداری عضو اکیپ نصب نیست؛ تکنسین ساده سرپرست نیست (همان کاری که برنامه روی صفحه می‌کند)
  if final_role not in ('LEAD_TECHNICIAN', 'TECHNICIAN') then
    delete from public.team_members where user_id = target_id;
    update public.installation_teams set supervisor_id = null, updated_at = now() where supervisor_id = target_id;
  elsif final_role = 'TECHNICIAN' then
    update public.installation_teams set supervisor_id = null, updated_at = now() where supervisor_id = target_id;
    update public.team_members set role_in_team = 'TECHNICIAN' where user_id = target_id and role_in_team = 'LEAD';
  end if;

  -- ایمیل ورود فقط وقتی عوض می‌شود که شماره عوض شده باشد؛ همیشه با دامنه‌ای که صفحه‌ی ورود می‌شناسد
  if final_phone <> public.normalize_phone(cur.phone) then
    email_addr := final_phone || '@talaie.ir';
    update auth.users set email = email_addr, updated_at = now() where id = target_id;
    begin
      update auth.identities
      set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', email_addr),
          updated_at = now()
      where user_id = target_id and provider = 'email';
    exception when others then null;
    end;
  end if;

  update auth.users
  set raw_user_meta_data = jsonb_build_object(
        'name', coalesce(nullif(trim(new_name), ''), cur.name), 'phone', final_phone, 'role', final_role),
      banned_until = case when final_active then null else 'infinity'::timestamptz end,
      updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۶. تغییر رمز ------------------------------------------------------------------
create function public.admin_reset_personnel_password(target_id uuid, new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند رمز پرسنل را تغییر دهد.';
  end if;
  if length(trim(coalesce(new_password, ''))) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;
  if not exists (select 1 from auth.users where id = target_id) then
    raise exception 'حساب ورود این فرد روی سرور پیدا نشد.';
  end if;

  update auth.users
  set encrypted_password = crypt(trim(new_password), gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۷. حذف پرسنل ------------------------------------------------------------------
create function public.admin_delete_personnel(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  target_role text;
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند پرسنل را حذف کند.';
  end if;
  if target_id = auth.uid() then
    raise exception 'نمی‌توانید حساب خودتان را حذف کنید.';
  end if;

  select role into target_role from public.profiles where id = target_id;
  if found and target_role in ('QC_MANAGER', 'CEO') and not exists (
    select 1 from public.profiles
    where role in ('QC_MANAGER', 'CEO') and active = true and id <> target_id
  ) then
    raise exception 'آخرین مدیر فعال سامانه را نمی‌توان حذف کرد.';
  end if;

  if to_regclass('public.team_members') is not null then
    execute 'delete from public.team_members where user_id = $1' using target_id;
  end if;
  if to_regclass('public.installation_teams') is not null then
    execute 'update public.installation_teams set supervisor_id = null where supervisor_id = $1' using target_id;
  end if;
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۸. اکیپ‌ها -------------------------------------------------------------------
create table if not exists public.installation_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  supervisor_id uuid references auth.users(id) on delete set null,
  daily_capacity_hours numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.installation_teams add column if not exists daily_capacity_hours numeric;

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
create policy "Active users read teams" on public.installation_teams
  for select to authenticated using (public.is_active_user());
-- ساخت/حذف اکیپ از صفحه‌ی «پرسنل و اکیپ‌ها»
drop policy if exists "Managers modify teams" on public.installation_teams;
create policy "Managers modify teams" on public.installation_teams
  for all to authenticated using (public.is_qc_or_ceo()) with check (public.is_qc_or_ceo());

-- سیاست‌هایی که یک تلاش قبلی (فایل 024_teams_and_roles_sync) ساخته بود و به «هر» کاربر
-- واردشده اجازه‌ی تغییر اکیپ‌ها و اعضا را می‌داد
drop policy if exists "Managers modify members" on public.team_members;
drop policy if exists "Anyone authenticated read members" on public.team_members;
drop policy if exists "Anyone authenticated read teams" on public.installation_teams;
drop policy if exists "Active users read team members" on public.team_members;
create policy "Active users read team members" on public.team_members
  for select to authenticated using (public.is_active_user());

grant select, insert, update, delete on public.installation_teams to authenticated;
grant select on public.team_members to authenticated;

create function public.admin_assign_team_member(p_team_id uuid, p_user_id uuid, p_role_in_team text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند ترکیب اکیپ‌ها را تغییر دهد.';
  end if;
  if p_role_in_team not in ('LEAD', 'TECHNICIAN') then
    raise exception 'نقش در اکیپ نامعتبر است.';
  end if;
  if not exists (select 1 from public.installation_teams where id = p_team_id) then
    raise exception 'این اکیپ روی سرور پیدا نشد.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'این فرد روی سرور پیدا نشد.';
  end if;
  if p_role_in_team = 'LEAD' and exists (
    select 1 from public.team_members where team_id = p_team_id and role_in_team = 'LEAD' and user_id <> p_user_id
  ) then
    raise exception 'هر اکیپ فقط یک سرپرست دارد.';
  end if;
  if p_role_in_team = 'TECHNICIAN' and (
    select count(*) from public.team_members
    where team_id = p_team_id and role_in_team = 'TECHNICIAN' and user_id <> p_user_id
  ) >= 2 then
    raise exception 'هر اکیپ حداکثر ۲ تکنسین دارد.';
  end if;

  -- اگر قبلاً سرپرست اکیپ دیگری بوده، آن اکیپ بی‌سرپرست می‌شود
  update public.installation_teams set supervisor_id = null, updated_at = now()
  where supervisor_id = p_user_id and id <> p_team_id;
  delete from public.team_members where user_id = p_user_id;
  insert into public.team_members (team_id, user_id, role_in_team, joined_at)
  values (p_team_id, p_user_id, p_role_in_team, now());

  if p_role_in_team = 'LEAD' then
    update public.installation_teams set supervisor_id = p_user_id, updated_at = now() where id = p_team_id;
    update public.profiles set role = 'LEAD_TECHNICIAN', updated_at = now()
    where id = p_user_id and role = 'TECHNICIAN';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

create function public.admin_remove_team_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_qc_or_ceo() then
    raise exception 'فقط مدیر QC یا مدیرعامل می‌تواند ترکیب اکیپ‌ها را تغییر دهد.';
  end if;
  update public.installation_teams set supervisor_id = null, updated_at = now() where supervisor_id = p_user_id;
  delete from public.team_members where user_id = p_user_id;
  return jsonb_build_object('success', true);
end;
$$;

-- ۸.۵ ستون team_id در پروفایل‌ها --------------------------------------------------
-- تابع patch_project (مایگریشن‌های ۰۱۳/۰۱۵) تیم کاربر را از profiles.team_id می‌خواند،
-- ولی این ستون هیچ‌وقت ساخته نشده بود: هر تغییر پروژه روی سرور با خطای
-- «column team_id does not exist» رد می‌شد و تغییرات فقط روی همان دستگاه می‌ماند.
-- ستون ساخته می‌شود و با یک trigger همیشه با team_members یکی می‌ماند.
alter table public.profiles add column if not exists team_id uuid;

create or replace function public.sync_profile_team_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.profiles set team_id = null
    where id = old.user_id
      and not exists (select 1 from public.team_members m where m.user_id = old.user_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles set team_id = new.team_id where id = new.user_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_profile_team_id on public.team_members;
create trigger trg_sync_profile_team_id
  after insert or update or delete on public.team_members
  for each row execute function public.sync_profile_team_id();

update public.profiles p
set team_id = m.team_id
from public.team_members m
where m.user_id = p.id and p.team_id is distinct from m.team_id;

update public.profiles p
set team_id = null
where p.team_id is not null and not exists (select 1 from public.team_members m where m.user_id = p.id);

-- ۸.۶ هماهنگی قوانین سرور با برنامه -----------------------------------------------
-- برنامه به هر نقش اجازه‌هایی می‌دهد که نسخه‌های قبلی سرور نمی‌داد. نتیجه این بود که
-- کار روی همان دستگاه «ثبت‌شده» دیده می‌شد ولی سرور آن را رد می‌کرد و بقیه هرگز نمی‌دیدند:
--   - انباردار: تایید ورود کالا، ارسال متریال و رسیدگی تیکت روی سرور رد می‌شد.
--   - زمان‌بندی: سرور «تایید تولید» را هم می‌خواست که دیگر در برنامه وجود ندارد.
--   - ظرفیت اکیپ: سرور ستون اشتباه (data به جای value) را می‌خواند و همه‌ی زمان‌بندی‌ها خطا می‌داد؛
--     و برنامه تداخل ظرفیت را «هشدار» نشان می‌دهد ولی سرور آن را رد می‌کرد.
--   - مدیرعامل، انبار، اندازه‌گیری و فروش پروژه‌ها را نمی‌دیدند.
--   - سرپرست اکیپی که از طریق اکیپ (نه نام خودش) به پروژه وصل بود نمی‌توانست تیکت ثبت کند.

-- (الف) نقش‌ها
create or replace function public.talaie_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true;
$$;

create or replace function public.is_qc_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('QC_MANAGER', 'CEO') and active = true
  );
$$;

create or replace function public.is_coordinator_or_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('QC_MANAGER', 'SCHEDULING_COORDINATOR') and active = true
  );
$$;

-- (ب) آیا این پروژه به خود کاربر یا اکیپ او سپرده شده؟
create or replace function public.talaie_is_assigned(project_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(project_data is not null and (
    coalesce(project_data->>'leadTechnicianId' = auth.uid()::text, false)
    or (jsonb_typeof(project_data->'assignedTechnicianIds') = 'array' and project_data->'assignedTechnicianIds' ? auth.uid()::text)
    or exists (
      select 1 from public.team_members m
      where m.user_id = auth.uid()
        and project_data->>'assignedTeamId' is not null
        and m.team_id::text = project_data->>'assignedTeamId'
    )
  ), false);
$$;

-- (ج) دیدن پروژه: مثل برنامه (مدیران، انبار، اندازه‌گیری و فروش همه را می‌بینند؛ اکیپ‌ها کار خودشان را)
create or replace function public.can_access_project(project_data jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_user() then
    return false;
  end if;
  if coalesce(public.talaie_my_role(), '') in ('CEO', 'QC_MANAGER', 'SCHEDULING_COORDINATOR', 'WAREHOUSE', 'MEASUREMENT_LEAD', 'SALES_REP', 'SALES') then
    return true;
  end if;
  return public.talaie_is_assigned(project_data);
end;
$$;

create or replace function public.can_access_project_id(pid text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (select 1 from public.projects p where p.id = pid and public.can_access_project(p.data));
end;
$$;

-- (د) تغییرات مجاز نقش‌های غیرفنی روی پروژه (همان فهرست برنامه)
create or replace function public.talaie_role_patch_ok(patch jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := public.talaie_my_role();
  k text;
begin
  if v_role = 'WAREHOUSE' then
    for k in select jsonb_object_keys(patch) loop
      if k not in ('warehousePrep', 'technicalHandover', 'updatedAt') then
        raise exception 'دسترسی غیرمجاز: مسئول انبار اجازه تغییر فیلد «%» را ندارد.', k;
      end if;
    end loop;
    return true;
  end if;
  if v_role = 'MEASUREMENT_LEAD' then
    for k in select jsonb_object_keys(patch) loop
      if k not in ('secondMeasurementDetails', 'siteReadiness', 'notes', 'updatedAt') then
        raise exception 'دسترسی غیرمجاز: مسئول اندازه‌گیری اجازه تغییر فیلد «%» را ندارد.', k;
      end if;
    end loop;
    return true;
  end if;
  return false;
end;
$$;

-- (ه) ظرفیت اکیپ: مثل برنامه فقط ترتیب تاریخ‌ها اجباری است؛ پر بودن ظرفیت و تداخل ساعت
-- در برنامه‌ریز ماهانه به صورت هشدار دیده می‌شود و ثبت را متوقف نمی‌کند.
create or replace function public.validate_schedule_capacity(
  p_project_id text,
  p_team_id uuid,
  p_scheduled_date text,
  p_end_date text,
  p_scheduled_time text,
  p_duration_hours numeric
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_scheduled_date is null or trim(p_scheduled_date) = '' then
    return;
  end if;
  if p_end_date is not null and p_end_date <> '' and p_end_date < p_scheduled_date then
    raise exception 'خطای زمان‌بندی: تاریخ پایان پروژه (%) نمی‌تواند قبل از تاریخ شروع (%) باشد.', p_end_date, p_scheduled_date;
  end if;
end;
$$;

-- (و) اصلاح تابع patch_project موجود (بقیه‌ی منطق و محافظت‌ها دست نمی‌خورد)
do $fix$
declare
  fn regprocedure := to_regprocedure('public.patch_project(text, jsonb)');
  def text;
  before text;
begin
  if fn is null then
    raise notice 'patch_project پیدا نشد؛ از این مرحله گذشتیم.';
    return;
  end if;
  def := pg_get_functiondef(fn);
  before := def;

  -- ۱. گیت تحویل: فقط تایید ورود کالا به انبار، و فقط هنگام اعزام/شروع کار (مثل برنامه)
  def := replace(def,
    'if not (prod_confirmed and wh_confirmed) then',
    'if not coalesce(wh_confirmed, false) and coalesce(patch->>''status'', '''') in (''EN_ROUTE'', ''IN_PROGRESS'') and (current_data ? ''technicalHandover'' or patch ? ''technicalHandover'' or coalesce(current_data->>''status'', '''') = ''MEASUREMENT_PENDING'') then');
  def := replace(def,
    'پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.',
    'پروژه تا زمان تأیید ورود کالا به انبار، قابل اعزام اکیپ و شروع کار نیست.');

  -- ۲. فیلدهایی که برنامه به تکنسین اجازه می‌دهد ولی سرور نمی‌شناخت
  if position('''warehousePrep''' in def) = 0 then
    def := replace(def,
      '''unavailabilityReason'', ''unavailabilityPhotos''',
      '''unavailabilityReason'', ''unavailabilityPhotos'', ''interTeamHandover'', ''customerDisclaimerAgreed'', ''preInstallPhotosConfirmed'', ''secondMeasurementDetails'', ''warehousePrep''');
  end if;

  -- گیت قبلی فقط وقتی اجرا می‌شد که isHistoricalMigration دقیقاً false بود (عملاً هیچ‌وقت)
  def := replace(def,
    'if not (current_data->''technicalHandover''->>''isHistoricalMigration'' = ''true'') then',
    'if coalesce(current_data->''technicalHandover''->>''isHistoricalMigration'', ''false'') <> ''true'' then');

  -- ۳. انبار و اندازه‌گیری: به جای قوانین تکنسین، فهرست مخصوص خودشان؛
  --    و برای تکنسین «سپرده‌شده بودن» شرط تغییر است، نه فقط «دیدن» پروژه
  if position('talaie_role_patch_ok' in def) = 0 then
    def := regexp_replace(def,
      'if not public\.is_coordinator_or_manager\(\) then(\s+)if not public\.can_access_project\(current_data\) then',
      'if not public.is_coordinator_or_manager() and not public.talaie_role_patch_ok(patch) then\1if not public.talaie_is_assigned(current_data) then');
  end if;
  def := replace(def,
    'if not public.is_coordinator_or_manager() and not public.talaie_role_patch_ok(patch) then' || chr(10) || '    if not public.can_access_project(current_data) then',
    'if not public.is_coordinator_or_manager() and not public.talaie_role_patch_ok(patch) then' || chr(10) || '    if not public.talaie_is_assigned(current_data) then');

  if def <> before then
    execute def;
  end if;
end;
$fix$;

-- (ز) درخواست متریال: انباردار (و مدیرعامل) ارسال و وضعیت را ثبت می‌کنند
do $fix$
declare
  fn regprocedure := to_regprocedure('public.patch_material_request(text, jsonb)');
  def text;
begin
  if fn is null then
    return;
  end if;
  def := pg_get_functiondef(fn);
  if position('talaie_my_role' in def) = 0 then
    def := regexp_replace(def,
      'if not public\.is_coordinator_or_manager\(\) then(\s+)if v_project is null',
      'if not public.is_coordinator_or_manager() and coalesce(public.talaie_my_role(), '''') not in (''WAREHOUSE'', ''CEO'') then\1if v_project is null');
  end if;
  def := replace(def, 'not public.can_access_project(v_project)', 'not public.talaie_is_assigned(v_project)');
  execute def;
end;
$fix$;

-- ثبت درخواست متریال: تکنسین فقط برای پروژه‌ی سپرده‌شده به خودش یا اکیپش
do $fix$
declare
  fn regprocedure := to_regprocedure('public.create_material_request(text, jsonb)');
  def text;
begin
  if fn is null then
    return;
  end if;
  def := pg_get_functiondef(fn);
  if position('not public.can_access_project(v_project)' in def) > 0 then
    execute replace(def, 'not public.can_access_project(v_project)', 'not public.talaie_is_assigned(v_project)');
  end if;
end;
$fix$;

-- (ح) تیکت‌ها: مثل برنامه
--   مدیر QC و انباردار: همه‌کار. هماهنگ‌کننده: همه‌ی تیکت‌ها جز «حل‌شده».
--   سرپرست/تکنسین: فقط برای پروژه‌ی خودش یا اکیپش، و بدون «حل‌شده».
do $fix$
begin
  if to_regclass('public.tickets') is null then
    return;
  end if;

  drop policy if exists "Authorized users read tickets" on public.tickets;
  create policy "Authorized users read tickets" on public.tickets for select to authenticated
    using (
      public.is_coordinator_or_manager()
      or coalesce(public.talaie_my_role(), '') in ('CEO', 'WAREHOUSE')
      or public.can_access_project_id(data->>'projectId')
    );

  drop policy if exists "Authorized users insert tickets" on public.tickets;
  create policy "Authorized users insert tickets" on public.tickets for insert to authenticated
    with check (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') = 'WAREHOUSE'
      or (
        public.is_active_user()
        and (data->>'status') is distinct from 'RESOLVED'
        and (
          coalesce(public.talaie_my_role(), '') = 'SCHEDULING_COORDINATOR'
          or exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
        )
      )
    );

  drop policy if exists "Authorized users update tickets" on public.tickets;
  create policy "Authorized users update tickets" on public.tickets for update to authenticated
    using (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') in ('WAREHOUSE', 'SCHEDULING_COORDINATOR')
      or (
        public.is_active_user()
        and exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
      )
    )
    with check (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') = 'WAREHOUSE'
      or (
        public.is_active_user()
        and (data->>'status') is distinct from 'RESOLVED'
        and (
          coalesce(public.talaie_my_role(), '') = 'SCHEDULING_COORDINATOR'
          or exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
        )
      )
    );
end;
$fix$;

revoke execute on function public.talaie_my_role() from anon, public;
revoke execute on function public.talaie_is_assigned(jsonb) from anon, public;
revoke execute on function public.talaie_role_patch_ok(jsonb) from anon, public;
grant execute on function public.talaie_my_role() to authenticated;
grant execute on function public.talaie_is_assigned(jsonb) to authenticated;
grant execute on function public.talaie_role_patch_ok(jsonb) to authenticated;
grant execute on function public.is_qc_manager() to authenticated;
grant execute on function public.is_coordinator_or_manager() to authenticated;
grant execute on function public.can_access_project(jsonb) to authenticated;
grant execute on function public.can_access_project_id(text) to authenticated;

-- ۹. دسترسی اجرای توابع ----------------------------------------------------------
revoke execute on function public.admin_create_personnel(text, text, text, text) from public, anon;
revoke execute on function public.admin_update_personnel(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_reset_personnel_password(uuid, text) from public, anon;
revoke execute on function public.admin_delete_personnel(uuid) from public, anon;
revoke execute on function public.admin_assign_team_member(uuid, uuid, text) from public, anon;
revoke execute on function public.admin_remove_team_member(uuid) from public, anon;
grant execute on function public.admin_create_personnel(text, text, text, text) to authenticated;
grant execute on function public.admin_update_personnel(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_personnel_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_personnel(uuid) to authenticated;
grant execute on function public.admin_assign_team_member(uuid, uuid, text) to authenticated;
grant execute on function public.admin_remove_team_member(uuid) to authenticated;

-- ۱۰. ترمیم کاربران موجود --------------------------------------------------------
-- (الف) توکن‌های NULL که ورود را خراب می‌کنند
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
where confirmation_token is null or recovery_token is null
   or email_change_token_new is null or email_change is null;

-- (ب) ایمیل‌هایی که نسخه‌ی قدیمی به @talaie.app تغییر داده بود
update auth.users u
set email = split_part(u.email, '@', 1) || '@talaie.ir', updated_at = now()
where u.email like '%@talaie.app'
  and not exists (select 1 from auth.users x where x.email = split_part(u.email, '@', 1) || '@talaie.ir');

-- (ج) کاربرانی که identity ندارند (ساخته‌شده با SQL)
do $$
begin
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), u.id, u.id::text,
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         'email', now(), now(), now()
  from auth.users u
  join public.profiles p on p.id = u.id
  where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
exception when others then
  raise notice 'identities repair skipped: %', sqlerrm;
end $$;

-- (د) شماره‌های پروفایل یکدست (فقط رقم لاتین) تا تکراری‌ها درست تشخیص داده شوند
update public.profiles p
set phone = public.normalize_phone(p.phone)
where p.phone <> public.normalize_phone(p.phone)
  and not exists (
    select 1 from public.profiles x where x.id <> p.id and x.phone = public.normalize_phone(p.phone)
  );

-- ۱۱. اعلام لحظه‌ای تغییرات پرسنل و اکیپ‌ها به همه‌ی دستگاه‌ها -------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'installation_teams', 'team_members', 'projects', 'tickets',
                           'talaie_sync', 'material_requests', 'schedule_change_requests', 'sales_bookings'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when others then
  raise notice 'realtime publication not updated: %', sqlerrm;
end $$;

-- ۱۲. نسخه‌ی پایگاه‌داده: برنامه با این تابع می‌فهمد این فایل اجرا شده یا نه
--     (اگر نه، به مدیر QC هشدار «سرور به‌روز نیست» نشان می‌دهد)
create or replace function public.talaie_schema_version()
returns int language sql stable as $$ select 25 $$;
grant execute on function public.talaie_schema_version() to authenticated;
