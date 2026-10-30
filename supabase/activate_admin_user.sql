-- ==============================================================================
-- فعال‌سازی قطعی حساب مدیر QC برای ورود با شماره 09124339038 و رمز 91243390380
-- این کد را در SQL Editor داشبورد Supabase کپی کرده و دکمه Run را بزنید.
-- ==============================================================================

do $$
declare
  target_uid uuid;
begin
  -- ۱. یافتن یا تایید کاربر در auth.users
  select id into target_uid
  from auth.users
  where email in ('09124339038@talaie.ir', '09124339038@talaie.local')
  limit 1;

  if target_uid is not null then
    -- کاربر وجود دارد؛ تایید ایمیل و اعمال هش رمز عبور درخواستی
    update auth.users
    set encrypted_password = crypt('91243390380', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        confirmed_at = coalesce(confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        updated_at = now()
    where id = target_uid;
  else
    -- در صورت عدم وجود، ایجاد مستقیم کاربر در auth.users
    target_uid := gen_random_uuid();
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      target_uid,
      'authenticated',
      'authenticated',
      '09124339038@talaie.ir',
      crypt('91243390380', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      now(),
      now()
    );
  end if;

  -- ۲. ایجاد یا به‌روزرسانی پروفایل مدیریتی در public.profiles
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

  -- در صورت مغایرت شناسه بر اساس شماره، پروفایل قدیمی هم به‌روز شود
  update public.profiles
  set role = 'QC_MANAGER',
      active = true
  where phone = '09124339038';

  raise notice 'حساب کاربری مدیر QC با موفقیت فعال شد: %', target_uid;
end $$;
