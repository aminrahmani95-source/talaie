-- ==============================================================================
-- گالری طلایی | توابع مدیریت آسان پرسنل و تکنسین‌ها از داخل اپلیکیشن
-- این توابع به مدیر QC اجازه می‌دهند بدون نیاز به پنل Supabase، مستقیماً
-- از داخل اپلیکیشن تکنسین جدید بسازد، رمز آن‌ها را تغییر دهد یا حذف کند.
-- ==============================================================================

-- ۱. تابع ایجاد تکنسین / سرپرست جدید از داخل برنامه
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

  email_addr := clean_phone || '@talaie.ir';

  -- جستجوی کاربر در صورت وجود قبلی در auth.users
  select id into user_uid
  from auth.users
  where email in (email_addr, clean_phone || '@talaie.local')
  limit 1;

  if user_uid is not null then
    -- کاربر وجود دارد؛ به‌روزرسانی رمز و فعال‌سازی
    update auth.users
    set encrypted_password = crypt(new_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at = now()
    where id = user_uid;
  else
    user_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      user_uid,
      'authenticated',
      'authenticated',
      email_addr,
      crypt(new_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      now(),
      now()
    );
  end if;

  -- ثبت یا به‌روزرسانی در جدول profiles
  insert into public.profiles (id, name, phone, role, avatar, active)
  values (
    user_uid,
    new_name,
    clean_phone,
    new_role,
    case when new_role = 'QC_MANAGER' then '👔' when new_role = 'LEAD_TECHNICIAN' then '🧢' else '🔧' end,
    true
  )
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    role = excluded.role,
    active = true;

  update public.profiles
  set name = new_name,
      role = new_role,
      active = true
  where phone = clean_phone;

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

  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_id;

  if not found then
    raise exception 'کاربر مورد نظر در سیستم احراز هویت یافت نشد.';
  end if;

  return jsonb_build_object('success', true);
end;
$$;

-- ۳. تابع به‌روزرسانی اطلاعات پرسنل
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
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به ویرایش پرسنل است.';
  end if;

  clean_phone := trim(new_phone);

  update auth.users
  set email = clean_phone || '@talaie.ir',
      updated_at = now()
  where id = target_id;

  update public.profiles
  set name = new_name,
      phone = clean_phone,
      role = new_role,
      active = new_active,
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
begin
  if not public.is_qc_manager() then
    raise exception 'فقط مدیر QC مجاز به حذف پرسنل است.';
  end if;

  if target_id = auth.uid() then
    raise exception 'مدیر QC نمی‌تواند حساب کاربری خودش را حذف کند.';
  end if;

  delete from auth.users where id = target_id;
  delete from public.profiles where id = target_id;

  return jsonb_build_object('success', true);
end;
$$;

-- دسترسی به توابع برای کاربران لاگین‌شده
revoke all on function public.admin_create_personnel(text, text, text, text) from public, anon;
revoke all on function public.admin_reset_personnel_password(uuid, text) from public, anon;
revoke all on function public.admin_update_personnel(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_personnel(uuid) from public, anon;

grant execute on function public.admin_create_personnel(text, text, text, text) to authenticated;
grant execute on function public.admin_reset_personnel_password(uuid, text) to authenticated;
grant execute on function public.admin_update_personnel(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_personnel(uuid) to authenticated;
