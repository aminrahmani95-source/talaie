-- ==============================================================================
-- گالری طلایی | توابع مدیریت امن پرسنل و تکنسین‌ها از داخل اپلیکیشن
-- این توابع به مدیر ارشد QC اجازه می‌دهند پرسنل جدید ثبت کند، اطلاعات یا نقش
-- آن‌ها را ویرایش کند، رمز عبور را بازنشانی نماید یا کاربری را حذف کند.
-- تمامی عملیات به‌صورت اتمیک، امن (security definer) و بدون افشای کلید سرویس انجام می‌شوند.
-- ==============================================================================

-- ۱. تابع ثبت تکنسین / سرپرست جدید از داخل برنامه
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
  -- بررسی دسترسی: فقط مدیر QC فعال مجاز است
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

  -- بررسی تکراری نبودن شماره موبایل در auth.users و public.profiles
  if exists (
    select 1 from auth.users where email in (email_addr, clean_phone || '@talaie.local')
  ) or exists (
    select 1 from public.profiles where phone = clean_phone
  ) then
    raise exception 'این شماره قبلاً ثبت شده است.';
  end if;

  user_uid := gen_random_uuid();

  -- ایجاد حساب کاربری در auth.users
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

  -- درج در auth.identities جهت اتصال رسمی به هسته ورود Supabase GoTrue
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
    user_uid::text,
    user_uid,
    jsonb_build_object('sub', user_uid::text, 'email', email_addr),
    'email',
    user_uid::text,
    now(),
    now(),
    now()
  );

  -- درج پروفایل سازمانی پرسنل در جدول public.profiles
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

-- ۲. تابع تغییر رمز عبور پرسنل توسط مدیر QC
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
    raise exception 'فقط مدیر QC مجاز به تغییر رمز عبور است.';
  end if;

  if length(trim(new_password)) < 8 then
    raise exception 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  end if;

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر در سیستم احراز هویت یافت نشد.';
  end if;

  -- باطل کردن تمام نشست‌های فعال کاربر پس از تغییر رمز عبور
  delete from auth.sessions where user_id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۳. تابع به‌روزرسانی اطلاعات پرسنل
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

  -- مدیر نباید بتواند نقش یا وضعیت فعال حساب خودش را تغییر دهد
  if target_id = auth.uid() then
    if new_role is not null and new_role != 'QC_MANAGER' then
      raise exception 'امکان تغییر نقش حساب کاربری خودتان وجود ندارد.';
    end if;
    if new_active is not null and new_active = false then
      raise exception 'امکان غیرفعال کردن حساب کاربری خودتان وجود ندارد.';
    end if;
  end if;

  -- آخرین مدیر ارشد QC فعال قابل غیرفعال‌سازی یا تغییر نقش نیست
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

  -- اعتبارسنجی شماره تلفن در صورت ارسال
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
      raise exception 'این شماره قبلاً برای کاربر دیگری ثبت شده است.';
    end if;

    update auth.users
    set email = email_addr,
        updated_at = now()
    where id = target_id;

    update auth.identities
    set identity_data = jsonb_build_object('sub', target_id::text, 'email', email_addr),
        updated_at = now()
    where user_id = target_id;
  end if;

  -- به‌روزرسانی تنها فیلدهایی که مقدار غیر NULL دارند
  update public.profiles
  set name = coalesce(new_name, name),
      phone = coalesce(clean_phone, phone),
      role = coalesce(new_role, role),
      avatar = case
        when new_role is not null and new_role = 'QC_MANAGER' then '👔'
        when new_role is not null and new_role = 'LEAD_TECHNICIAN' then '🧢'
        when new_role is not null and new_role = 'TECHNICIAN' then '🔧'
        else avatar
      end,
      active = coalesce(new_active, active),
      updated_at = now()
  where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ۴. تابع حذف پرسنل
create or replace function public.admin_delete_personnel(
  target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_role text;
  current_active boolean;
  active_qc_count int;
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به حذف پرسنل است.';
  end if;

  if target_id = auth.uid() then
    raise exception 'مدیر QC نمی‌تواند حساب کاربری خودش را حذف کند.';
  end if;

  select role, active into current_role, current_active
  from public.profiles
  where id = target_id;

  -- بررسی عدم حذف آخرین مدیر ارشد QC فعال
  if current_role = 'QC_MANAGER' and current_active = true then
    select count(*) into active_qc_count
    from public.profiles
    where role = 'QC_MANAGER' and active = true;

    if active_qc_count <= 1 then
      raise exception 'حداقل یک مدیر ارشد QC فعال باید در سیستم باقی بماند.';
    end if;
  end if;

  delete from auth.sessions where user_id = target_id;
  delete from auth.identities where user_id = target_id;
  delete from auth.users where id = target_id;
  delete from public.profiles where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- سلب کامل اجازه اجرا از anon و public
revoke execute on function public.admin_create_personnel(text, text, text, text) from anon, public;
revoke execute on function public.admin_reset_personnel_password(uuid, text) from anon, public;
revoke execute on function public.admin_update_personnel(uuid, text, text, text, boolean) from anon, public;
revoke execute on function public.admin_delete_personnel(uuid) from anon, public;

-- اعطای دسترسی انحصاری اجرا به کاربران لاگین‌شده (authenticated)
grant execute on function public.admin_create_personnel(text, text, text, text) to authenticated;
grant execute on function public.admin_reset_personnel_password(uuid, text) to authenticated;
grant execute on function public.admin_update_personnel(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_personnel(uuid) to authenticated;
