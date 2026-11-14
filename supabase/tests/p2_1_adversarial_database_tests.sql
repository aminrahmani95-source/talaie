-- ==============================================================================
-- گالری طلایی | مجموعه آزمون‌های نفوذ و اعتبارسنجی امنیتی پایگاه داده (P2.1)
-- فایل: supabase/tests/p2_1_adversarial_database_tests.sql
--
-- راهنمای جامع مالکیت فیکسچرها و بازیابی از اجراهای متوقف‌شده (Fixture Lifecycle):
-- ۱. این اسکریپت در ابتدای هر اجرا یک توکن یکتا (v_run_token) و شناسه‌های تصادفی یکتا برای فیکسچرها ایجاد می‌کند.
-- ۲. پیش از ایجاد هر فیکسچر، گارد اعتبارسنجی تصادم (Collision Guard) بررسی می‌کند که هیچ برخوردی با داده‌های
--    از پیش موجود رخ ندهد. در صورت وجود، اجرا به صورت کاملاً Fail-Closed فوراً متوقف می‌شود.
-- ۳. هیچ دستور حذف کورکورانه یا بازنویسی بدون احراز مالکیت وجود ندارد.
-- ۴. در صورت قطعی اتصال یا توقف ناگهانی نشست، رکوردهای احتمالی با برچسب صریح _testRunMarker = 'P2_1_ADVERSARIAL_TEST_OWNED'
--    قابل شناسایی هستند. کوئری پاکسازی دستی برای DBA در انتهای فایل مستند شده است.
--
-- پیش‌نیاز حیاتی ۱ (مدیریت دیتابیس - Canonical Staging Marker Provisioning):
-- این اسکریپت مستقلاً و بدون احراز هویت استیجینگ توسط DBA در هیچ دیتابیسی اجرا نمی‌شود.
-- جدول public.db_environment_identity منحصراً و به صورت کانونیکال توسط complete_setup.sql یا
-- مایگریشن 012 ایجاد شده و فاقد هرگونه رکورد پیش‌فرض است تا از انتساب خودکار استیجینگ جلوگیری شود.
-- پیش از اجرا در محیط ایزوله استیجینگ، مدیر ارشد دیتابیس (DBA) باید با اجرای بلاک امن زیر در کلاستر
-- استیجینگ، هویت آن را مستقلاً ثبت و اعتبارسنجی نماید (با رفتار کاملاً Fail-Closed):
--
--   DO $$
--   DECLARE
--     v_rec record;
--     v_expected_cluster text := 'talaie-isolated-staging-cluster-v1';
--     v_expected_provisioner text := 'DBA_AUTHORIZATION';
--   BEGIN
--     -- ۱. اعتبارسنجی ساختار کانونیکال جدول و RLS فعال
--     IF NOT EXISTS (
--       SELECT 1 FROM pg_tables
--       WHERE schemaname = 'public' AND tablename = 'db_environment_identity' AND rowsecurity = true
--     ) THEN
--       RAISE EXCEPTION 'CANONICAL SCHEMA MISSING / INSECURE: جدول کانونیکال db_environment_identity یا فعال‌سازی RLS آن یافت نشد. ابتدا complete_setup.sql یا مهاجرت 012 را اجرا فرمایید.';
--     END IF;
--
--     -- ۲. بررسی سلب امتیاز نوشتن از کلاینت‌های غیرمجاز
--     IF EXISTS (
--       SELECT 1 FROM information_schema.role_table_grants
--       WHERE table_schema = 'public' AND table_name = 'db_environment_identity'
--         AND grantee IN ('anon', 'authenticated', 'public')
--         AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
--     ) THEN
--       RAISE EXCEPTION 'SECURITY PRIVILEGE VIOLATION: نقش‌های کلاینت دارای دسترسی تغییر در db_environment_identity هستند!';
--     END IF;
--
--     -- ۳. ممانعت از اجرای تصادفی بر روی اسامی مشکوک به پروداکشن
--     IF current_database() ~* '(prod|production|live|primary|talaie_main)' THEN
--       RAISE EXCEPTION 'ABORT: نام پایگاه داده متصل (%) حاوی الگوهای پروداکشن است! انتساب استیجینگ اکیداً مسدود شد.', current_database();
--     END IF;
--
--     -- ۴. مقایسه رکورد موجود یا درج رکورد جدید (Fail-Closed: تطبیق سخت‌گیرانه فیلدها بدون بازنویسی خاموش)
--     SELECT environment, cluster_identity, provisioned_by, safety_lock
--     INTO v_rec
--     FROM public.db_environment_identity
--     WHERE environment = 'staging';
--
--     IF FOUND THEN
--       IF v_rec.cluster_identity IS DISTINCT FROM v_expected_cluster OR
--          v_rec.provisioned_by IS DISTINCT FROM v_expected_provisioner OR
--          v_rec.safety_lock IS NOT TRUE THEN
--         RAISE EXCEPTION 'STAGING IDENTITY CONFLICT (Fail-Closed): رکورد استیجینگ از پیش موجود با مقادیر مجاز DBA مطابقت ندارد (کلاستر: %, انتظار: % | ثبت‌کننده: %, انتظار: % | قفل: %). بازنویسی خاموش مسدود شد.',
--           coalesce(v_rec.cluster_identity, 'NULL'), v_expected_cluster,
--           coalesce(v_rec.provisioned_by, 'NULL'), v_expected_provisioner,
--           coalesce(v_rec.safety_lock::text, 'NULL');
--       ELSE
--         RAISE NOTICE '>> هویت استیجینگ از پیش موجود با موفقیت اعتبارسنجی شد (بدون تغییر): %', v_rec.cluster_identity;
--       END IF;
--     ELSE
--       INSERT INTO public.db_environment_identity (environment, cluster_identity, provisioned_by, safety_lock)
--       VALUES ('staging', v_expected_cluster, v_expected_provisioner, true);
--       RAISE NOTICE '>> هویت استیجینگ کانونیکال با موفقیت ثبت شد: %', v_expected_cluster;
--     END IF;
--   END;
--   $$;
--
-- توجه امنیتی: این مکانیزم یک گواه اداری DBA و مانع جلوگیری از خطای انسانی است و ادعای اثبات رمزنگارانه سخت‌افزاری ندارد.
--
-- پیش‌نیاز حیاتی ۲ (پارامترهای اپراتور - Fail-Closed Operator Parameters):
--   psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
--     -v app_environment=test \
--     -v expected_target_db=<test-db> \
--     -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING \
--     -f supabase/tests/p2_1_adversarial_database_tests.sql
-- ==============================================================================

\set ON_ERROR_STOP on
set client_min_messages to warning;

-- ۱. اعتبارسنجی متغیرهای کلاینت psql به شیوه Fail-Closed (خروج فوری در صورت فقدان)
\if :{?app_environment}
\else
  \echo '======================================================================'
  \echo 'PREFLIGHT ERROR: Variable app_environment is not set. Execution aborted (Fail-Closed).'
  \echo 'Required usage: -v app_environment=test (or staging)'
  \echo '======================================================================'
  \q
\endif

\if :{?expected_target_db}
\else
  \echo '======================================================================'
  \echo 'PREFLIGHT ERROR: Variable expected_target_db is not set. Execution aborted (Fail-Closed).'
  \echo 'Operator must explicitly pass the target DB name: -v expected_target_db=<db_name>'
  \echo '======================================================================'
  \q
\endif

\if :{?staging_allowlist_token}
\else
  \echo '======================================================================'
  \echo 'PREFLIGHT ERROR: Variable staging_allowlist_token is not set. Execution aborted (Fail-Closed).'
  \echo 'Required confirmation token: -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING'
  \echo '======================================================================'
  \q
\endif

-- ۲. انتقال صریح و امن مقادیر کلاینت psql به تنظیمات نشست سرور (Session Settings)
select set_config('app.environment', :'app_environment', false);
select set_config('app.expected_target_db', :'expected_target_db', false);
select set_config('app.staging_allowlist_token', :'staging_allowlist_token', false);

do $$
declare
  v_test_count int := 0;
  v_pass_count int := 0;
  v_fail_count int := 0;

  -- توکن یکتا و نشانگر صریح مالکیت برای این اجرای آزمون
  v_run_token text := 'ADV_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  v_run_marker text := 'P2_1_ADVERSARIAL_TEST_OWNED';

  -- شناسه‌ها و کدهای یکتا و تصادفی اختصاصی این اجرا جهت ممانعت قطعی از تداخل با رکوردهای واقعی یا آزمون‌های دیگر
  v_qc_uid uuid := gen_random_uuid();
  v_coord_uid uuid := gen_random_uuid();
  v_lead_uid uuid := gen_random_uuid();
  v_other_lead_uid uuid := gen_random_uuid();
  v_tech_uid uuid := gen_random_uuid();

  v_team_a_id uuid := gen_random_uuid();
  v_team_b_id uuid := gen_random_uuid();
  v_team_a_code text := 'TEAM_A_' || substr(md5(random()::text), 1, 6);
  v_team_b_code text := 'TEAM_B_' || substr(md5(random()::text), 1, 6);
  v_proj_id text := 'PRJ-TEST-P2-1-' || v_run_token;
  v_proj_unconfirmed_id text := 'PRJ-TEST-P2-UNCONFIRMED-' || v_run_token;

  v_phone_seed text := lpad((floor(random() * 900000 + 100000))::text, 6, '0');
  v_qc_phone text := '09991' || v_phone_seed;
  v_coord_phone text := '09992' || v_phone_seed;
  v_lead_phone text := '09993' || v_phone_seed;
  v_other_lead_phone text := '09994' || v_phone_seed;
  v_tech_phone text := '09995' || v_phone_seed;

  v_qc_email text := 'qc-' || v_run_token || '@talaie.test';
  v_coord_email text := 'coord-' || v_run_token || '@talaie.test';
  v_lead_email text := 'lead-' || v_run_token || '@talaie.test';
  v_other_lead_email text := 'otherlead-' || v_run_token || '@talaie.test';
  v_tech_email text := 'tech-' || v_run_token || '@talaie.test';

  v_res jsonb;
  v_err text;

  -- متغیرهای ارزیابی اصالت استیجینگ
  v_db_env text;
  v_cluster_id text;
begin
  raise notice '======================================================================';
  raise notice 'شروع اجرای آزمون‌های امنیتی پایگاه داده فاز P2.1 گالری طلایی';
  raise notice '======================================================================';

  -- ---------------------------------------------------------------------------
  -- ممیزی اصالت پایگاه داده استیجینگ و صحت کامل ساختار کانونیکال و دسترسی‌ها (Canonical Schema & ACL Verification)
  -- ---------------------------------------------------------------------------
  declare
    v_rls_enabled boolean;
    v_col_count int;
    v_pk_exists boolean;
    v_chk_env boolean;
    v_chk_lock boolean;
  begin
    -- ۱. اعتبارسنجی وجود جدول و فعال‌سازی RLS
    select c.relrowsecurity into v_rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'db_environment_identity';

    if v_rls_enabled is not true then
      raise exception 'AUTHORITATIVE STAGING CHECK FAILED: جدول db_environment_identity وجود ندارد یا RLS روی آن فعال نیست.'
        using errcode = 'P0001';
    end if;

    -- ۲. انطباق ۵ ستون کانونیکال، نوع داده، NOT NULL و پیش‌فرض‌ها
    select count(*) into v_col_count
    from information_schema.columns
    where table_schema = 'public' and table_name = 'db_environment_identity'
      and (
        (column_name = 'environment' and data_type = 'text' and is_nullable = 'NO') or
        (column_name = 'cluster_identity' and data_type = 'text' and is_nullable = 'NO') or
        (column_name = 'provisioned_by' and data_type = 'text' and is_nullable = 'NO') or
        (column_name = 'provisioned_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO' and column_default like '%now()%') or
        (column_name = 'safety_lock' and data_type = 'boolean' and is_nullable = 'NO' and column_default like '%true%')
      );

    if v_col_count != 5 then
      raise exception 'AUTHORITATIVE STAGING CHECK FAILED: ساختار، ستون‌ها، نوع داده‌ها یا پیش‌فرض‌های db_environment_identity با تعریف کانونیکال مطابقت ندارد (تطابق % از ۵).' , v_col_count
        using errcode = 'P0001';
    end if;

    -- ۳. اعتبارسنجی کلید اصلی Primary Key
    select exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'db_environment_identity' and con.contype = 'p'
    ) into v_pk_exists;

    if not v_pk_exists then
      raise exception 'AUTHORITATIVE STAGING CHECK FAILED: کلید اصلی Primary Key روی db_environment_identity یافت نشد.'
        using errcode = 'P0001';
    end if;

    -- ۴. اعتبارسنجی قیود CHECK کانونیکال
    select exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'db_environment_identity' and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%staging%'
    ) into v_chk_env;

    select exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'db_environment_identity' and con.contype = 'c'
        and pg_get_constraintdef(con.oid) like '%safety_lock%'
    ) into v_chk_lock;

    if not (v_chk_env and v_chk_lock) then
      raise exception 'AUTHORITATIVE STAGING CHECK FAILED: قیود CHECK کانونیکال روی جدول db_environment_identity ناقص است.'
        using errcode = 'P0001';
    end if;

    -- ۵. اعتبارسنجی دسترسی‌های موثر با تابع has_table_privilege و role_table_grants
    if exists (select 1 from pg_roles where rolname = 'anon') then
      if has_table_privilege('anon', 'public.db_environment_identity', 'insert') or
         has_table_privilege('anon', 'public.db_environment_identity', 'update') or
         has_table_privilege('anon', 'public.db_environment_identity', 'delete') or
         has_table_privilege('anon', 'public.db_environment_identity', 'select') then
        raise exception 'AUTHORITATIVE STAGING CHECK FAILED: دسترسی‌های غیرمجاز نقش anon روی db_environment_identity سلب نشده است.'
          using errcode = 'P0001';
      end if;
    end if;

    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      if has_table_privilege('authenticated', 'public.db_environment_identity', 'insert') or
         has_table_privilege('authenticated', 'public.db_environment_identity', 'update') or
         has_table_privilege('authenticated', 'public.db_environment_identity', 'delete') or
         has_table_privilege('authenticated', 'public.db_environment_identity', 'select') then
        raise exception 'AUTHORITATIVE STAGING CHECK FAILED: دسترسی‌های غیرمجاز نقش authenticated روی db_environment_identity سلب نشده است.'
          using errcode = 'P0001';
      end if;
    end if;

    if not has_table_privilege('postgres', 'public.db_environment_identity', 'select') then
      raise exception 'AUTHORITATIVE STAGING CHECK FAILED: نقش postgres دسترسی SELECT به db_environment_identity ندارد.'
        using errcode = 'P0001';
    end if;

    if exists (select 1 from pg_roles where rolname = 'service_role') then
      if not has_table_privilege('service_role', 'public.db_environment_identity', 'select') then
        raise exception 'AUTHORITATIVE STAGING CHECK FAILED: نقش service_role دسترسی SELECT به db_environment_identity ندارد.'
          using errcode = 'P0001';
      end if;
    end if;
  end;

  select environment, cluster_identity
  into v_db_env, v_cluster_id
  from public.db_environment_identity
  where safety_lock = true
  limit 1;

  if v_db_env is null or v_db_env not in ('staging', 'test', 'local') or v_cluster_id is null or trim(v_cluster_id) = '' then
    raise exception 'AUTHORITATIVE STAGING CHECK FAILED: رکورد معتبر شناسایی محیط در db_environment_identity یافت نشد (محیط: %، کلاستر: %). اجرا متوقف گردید.',
      coalesce(v_db_env, 'NULL'), coalesce(v_cluster_id, 'NULL')
      using errcode = 'P0001';
  end if;

  raise notice '>> گارد اصالت استیجینگ DBA با موفقیت تایید شد: محیط=%، کلاستر=% (توجه: این بررسی مانع اداری و خطای انسانی است، نه اثبات رمزنگارانه)', v_db_env, v_cluster_id;

  -- ---------------------------------------------------------------------------
  -- ممیزی پیش‌پرواز اپراتور (Operator Accidental Execution Safeguards)
  -- ---------------------------------------------------------------------------
  if current_database() is distinct from current_setting('app.expected_target_db', true) then
    raise exception 'PREFLIGHT BLOCKED: نام دیتابیس متصل (%) با دیتابیس مجاز اعلام‌شده توسط اپراتور (%) مطابقت ندارد. اجرا متوقف گردید.',
      current_database(), current_setting('app.expected_target_db', true);
  end if;

  if current_setting('app.staging_allowlist_token', true) is distinct from 'CONFIRMED_NON_PRODUCTION_STAGING' then
    raise exception 'PREFLIGHT BLOCKED: توکن تاییدیه محیط استیجینگ نامعتبر است. مقدار ارسالی: %',
      current_setting('app.staging_allowlist_token', true);
  end if;

  if current_setting('app.environment', true) not in ('test', 'staging') then
    raise exception 'PREFLIGHT BLOCKED: مقدار app.environment (%) نامعتبر است. مقادیر مجاز: test یا staging.',
      current_setting('app.environment', true);
  end if;

  if current_database() ~* '(prod|production|live|talaie_main|primary)' then
    raise exception 'PREFLIGHT CRITICAL: نام دیتابیس متصل (%) حاوی الگوهای پروداکشن است. اجرا در پروداکشن اکیداً ممنوع است!',
      current_database();
  end if;

  -- ---------------------------------------------------------------------------
  -- اعتبارسنجی عدم تداخل فیکسچرها پیش از هرگونه تغییر در دیتابیس (Fail-Closed Collision Guard)
  -- ---------------------------------------------------------------------------
  if exists (select 1 from public.projects where id in (v_proj_id, v_proj_unconfirmed_id)) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): شناسه پروژه‌های تستی از قبل در جدول projects موجود است. جهت ممانعت از بازنویسی یا حذف ناخواسته داده‌ها، اجرا فوراً متوقف شد.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.installation_teams
    where id in (v_team_a_id, v_team_b_id) or code in (v_team_a_code, v_team_b_code)
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): اکیپ‌های تستی با شناسه یا کد مشابه از قبل در جدول installation_teams موجود است. اجرا متوقف گردید.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.team_members
    where team_id in (v_team_a_id, v_team_b_id)
       or user_id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid)
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): اعضای اکیپ تستی از قبل در جدول team_members موجود هستند. اجرا متوقف گردید.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.profiles
    where id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid)
       or phone in (v_qc_phone, v_coord_phone, v_lead_phone, v_other_lead_phone, v_tech_phone)
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا شماره تلفن تستی از قبل در جدول profiles موجود است. اجرا متوقف گردید.'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    if exists (
      select 1 from auth.users
      where id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid)
         or email in (v_qc_email, v_coord_email, v_lead_email, v_other_lead_email, v_tech_email)
    ) then
      raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا ایمیل تستی از قبل در auth.users موجود است. اجرا متوقف گردید.'
        using errcode = 'P0001';
    end if;
  end if;

  -- ---------------------------------------------------------------------------
  -- آماده‌سازی فیکسچرهای تست با دسترسی ادمین دیتابیس (Privileged Setup as postgres)
  -- ---------------------------------------------------------------------------
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, aud, role, email) values
      (v_qc_uid, 'authenticated', 'authenticated', v_qc_email),
      (v_coord_uid, 'authenticated', 'authenticated', v_coord_email),
      (v_lead_uid, 'authenticated', 'authenticated', v_lead_email),
      (v_other_lead_uid, 'authenticated', 'authenticated', v_other_lead_email),
      (v_tech_uid, 'authenticated', 'authenticated', v_tech_email);
  end if;

  insert into public.profiles (id, phone, name, role, active) values
    (v_qc_uid, v_qc_phone, 'مدیر کیفی تست امنیتی', 'QC_MANAGER', true),
    (v_coord_uid, v_coord_phone, 'هماهنگ‌کننده تست امنیتی', 'SCHEDULING_COORDINATOR', true),
    (v_lead_uid, v_lead_phone, 'سرپرست اکیپ الف تست امنیتی', 'LEAD_TECHNICIAN', true),
    (v_other_lead_uid, v_other_lead_phone, 'سرپرست اکیپ ب تست امنیتی', 'LEAD_TECHNICIAN', true),
    (v_tech_uid, v_tech_phone, 'تکنسین تست امنیتی', 'TECHNICIAN', true);

  insert into public.installation_teams (id, name, code, supervisor_id) values
    (v_team_a_id, 'اکیپ نصب الف تست امنیتی', v_team_a_code, v_lead_uid),
    (v_team_b_id, 'اکیپ نصب ب تست امنیتی', v_team_b_code, v_other_lead_uid);

  insert into public.team_members (team_id, user_id, role_in_team) values
    (v_team_a_id, v_lead_uid, 'LEAD'),
    (v_team_a_id, v_tech_uid, 'TECHNICIAN'),
    (v_team_b_id, v_other_lead_uid, 'LEAD');

  insert into public.projects (id, data) values (
    v_proj_id,
    jsonb_build_object(
      'id', v_proj_id,
      'code', 'T-101',
      'title', 'پروژه تست P2.1',
      'status', 'MEASUREMENT_PENDING',
      'qcStatus', 'NOT_STARTED',
      '_testRunMarker', v_run_marker,
      '_testRunToken', v_run_token,
      '_testTeamAId', v_team_a_id::text,
      '_testTeamBId', v_team_b_id::text,
      '_testTeamACode', v_team_a_code,
      '_testTeamBCode', v_team_b_code,
      '_testQcUserId', v_qc_uid::text,
      '_testCoordUserId', v_coord_uid::text,
      '_testLeadUserId', v_lead_uid::text,
      '_testOtherLeadUserId', v_other_lead_uid::text,
      '_testTechUserId', v_tech_uid::text,
      'assignedTeamId', v_team_a_id::text,
      'leadTechnicianId', v_lead_uid::text,
      'assignedTechnicianIds', jsonb_build_array(v_lead_uid::text, v_tech_uid::text),
      'technicalHandover', jsonb_build_object(
        'productionConfirmation', jsonb_build_object('confirmed', true),
        'warehouseConfirmation', jsonb_build_object('confirmed', true)
      )
    )
  );

  -- ---------------------------------------------------------------------------
  -- آزمون ۱: مدیر QC طرح اولیه را قبل از قفل شدن در وضعیت پیش‌نویس تعریف می‌کند (باید مجاز باشد)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_qc_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    v_res := public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'originalPlan', jsonb_build_object(
          'lockedAt', now()::text,
          'lockedByUserId', v_qc_uid::text,
          'version', 1,
          'activities', jsonb_build_array(
            jsonb_build_object(
              'id', 'act-shade-1',
              'title', 'شید رول برقی سالن',
              'category', 'SHADE',
              'plannedQuantity', 10,
              'unit', 'لت'
            )
          )
        )
      )
    );

    if (v_res->'originalPlan'->>'lockedAt') is not null then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱: تعریف اولیه طرح نصب توسط QC_MANAGER در فاز پیش‌نویس تایید شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱: فیلد lockedAt ثبت نشد.';
    end if;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱ با خطا مواجه شد: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۲: مدیر QC تلاش می‌کند خط مبنای originalPlan قفل‌شده را مستقیماً تغییر دهد (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_qc_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'originalPlan', jsonb_build_object(
          'lockedAt', now()::text,
          'activities', jsonb_build_array(
            jsonb_build_object('id', 'act-shade-1', 'plannedQuantity', 20)
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۲: تغییر مستقیم طرح اولیه قفل‌شده توسط مدیر QC مسدود نشد!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۲: تلاش مدیر QC برای بازنویسی طرح اولیه قفل‌شده با موفقیت مسدود شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۲ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۳: تکنسین تلاش می‌کند originalPlan را تغییر دهد (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_tech_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tech_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_tech_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'originalPlan', jsonb_build_object(
          'version', 2,
          'activities', jsonb_build_array(
            jsonb_build_object('id', 'act-shade-1', 'plannedQuantity', 99)
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۳: تکنسین توانست طرح اولیه را تغییر دهد!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است%' or
       sqlerrm like '%تعریف طرح اولیه فقط در صلاحیت مدیر QC است%' or
       sqlerrm like '%تکنسین اجازه تغییر فیلد «originalPlan» را ندارد%' or
       sqlerrm like '%دسترسی غیرمجاز%' then
      declare
        v_chk_plan jsonb;
      begin
        select data->'originalPlan' into v_chk_plan from public.projects where id = v_proj_id;
        if (v_chk_plan->>'version')::int = 1 and (v_chk_plan->'activities'->0->>'plannedQuantity')::numeric = 10 then
          v_pass_count := v_pass_count + 1;
          raise notice '  [PASS] آزمون ۳: تغییر طرح اولیه توسط تکنسین با خطای امنیتی مسدود و یکپارچگی خط مبنا حفظ گردید.';
        else
          v_fail_count := v_fail_count + 1;
          raise notice '  [FAIL] آزمون ۳: خطای امنیتی دریافت شد اما داده طرح اولیه در دیتابیس مخدوش شد!';
        end if;
      end;
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۳ با خطای غیرمنتظره متوقف شد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۴: تلاش برای UPDATE مستقیم جدول با دور زدن patch_project (آزمون تریگر trg_enforce_plan_integrity تحت نقش authenticated)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_qc_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    update public.projects
    set data = jsonb_set(data, '{originalPlan,activities,0,plannedQuantity}', '99'::jsonb)
    where id = v_proj_id;

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۴: تریگر لایه دیتابیس نتوانست مانع از UPDATE مستقیم طرح شود!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۴: تریگر trg_enforce_plan_integrity مستقیماً UPDATE غیرمجاز جدول را تحت نقش authenticated خنثی کرد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۴ خطای غیرمنتظره داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۵: ایجاد یک اصلاحیه معتبر و تایید آن توسط QC_MANAGER
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    v_res := public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'planAmendments', jsonb_build_array(
          jsonb_build_object(
            'id', 'amend-1',
            'activityId', 'act-shade-1',
            'previousQuantity', 10,
            'newQuantity', 12,
            'reason', 'افزایش ۲ لت کارفرما',
            'requestedByUserId', v_lead_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED',
            'reviewedByUserId', v_qc_uid::text,
            'reviewedAt', now()::text
          )
        )
      )
    );

    if (v_res->'planAmendments'->0->>'status') = 'APPROVED' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۵: تایید اصلاحیه معتبر توسط مدیر QC با موفقیت ثبت شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۵: وضعیت اصلاحیه APPROVED ثبت نشد.';
    end if;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۵ با خطا مواجه شد: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۶: تلاش برای حذف اصلاحیه تاییدشده (حتی توسط مدیر QC - باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object('planAmendments', '[]'::jsonb)
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۶: حذف اصلاحیه تاییدشده مسدود نشد!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%حذف سوابق اصلاحیه‌های نهایی‌شده طرح%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۶: حذف اصلاحیه تاییدشده با موفقیت مسدود شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۶ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۷: تلاش برای دستکاری مقادیر فیلدهای کلیدی اصلاحیه تاییدشده (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'planAmendments', jsonb_build_array(
          jsonb_build_object(
            'id', 'amend-1',
            'activityId', 'act-shade-1',
            'previousQuantity', 10,
            'newQuantity', 18,
            'reason', 'دلیل تحریف‌شده',
            'requestedByUserId', v_lead_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED',
            'reviewedByUserId', v_qc_uid::text,
            'reviewedAt', now()::text
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۷: دستکاری در مقادیر اصلاحیه تاییدشده مسدود نشد!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%اصلاحیه تاییدشده قبلی غیرقابل تغییر است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۷: دستکاری در مقادیر اصلاحیه تاییدشده با موفقیت مسدود شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۷ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۸: تلاش تکنسین برای تایید خودسرانه یک اصلاحیه در وضعیت PENDING (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_tech_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tech_uid::text, 'role', 'authenticated')::text, true);

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'planAmendments', jsonb_build_array(
          jsonb_build_object(
            'id', 'amend-1',
            'activityId', 'act-shade-1',
            'previousQuantity', 10,
            'newQuantity', 12,
            'reason', 'افزایش ۲ لت کارفرما',
            'requestedByUserId', v_lead_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED',
            'reviewedByUserId', v_qc_uid::text,
            'reviewedAt', now()::text
          ),
          jsonb_build_object(
            'id', 'amend-2',
            'activityId', 'act-shade-1',
            'previousQuantity', 12,
            'newQuantity', 14,
            'reason', 'تایید خودسرانه تکنسین',
            'requestedByUserId', v_tech_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED'
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۸: تکنسین توانست اصلاحیه را تایید کند!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۸: ممانعت از تایید اصلاحیه توسط تکنسین تایید شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۸ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۹: آزمون همزمانی و تایید اصلاحیه منقضی‌شده (Stale Concurrency Check)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_qc_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_qc_uid::text, 'role', 'authenticated')::text, true);

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'planAmendments', jsonb_build_array(
          jsonb_build_object(
            'id', 'amend-1',
            'activityId', 'act-shade-1',
            'previousQuantity', 10,
            'newQuantity', 12,
            'reason', 'افزایش ۲ لت کارفرما',
            'requestedByUserId', v_lead_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED',
            'reviewedByUserId', v_qc_uid::text,
            'reviewedAt', now()::text
          ),
          jsonb_build_object(
            'id', 'amend-stale-2',
            'activityId', 'act-shade-1',
            'previousQuantity', 10, -- منقضی! سقف جاری ۱۲ است نه ۱۰
            'newQuantity', 8,
            'reason', 'درخواست منقضی قدیمی همزمان',
            'requestedByUserId', v_lead_uid::text,
            'requestedAt', now()::text,
            'status', 'APPROVED',
            'reviewedByUserId', v_qc_uid::text,
            'reviewedAt', now()::text
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۹: اصلاحیه منقضی‌شده همزمان تایید شد!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%خطای همزمانی اصلاحیه: مقدار قبلی%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۹: گارد همزمانی با موفقیت مانع از تایید اصلاحیه منقضی‌شده شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۹ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- درج لاگ روزانه تستی با دسترسی ادمین
  update public.projects
  set data = jsonb_set(
    data,
    '{dailyLogs}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'log-day-1',
        'date', '1405-02-20',
        'byUserId', v_tech_uid::text,
        'completedQuantity', 5,
        'supervisorConfirmed', false
      )
    )
  )
  where id = v_proj_id;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۰: سرپرست یک اکیپ دیگر (تیم ب) تلاش می‌کند لاگ روزانه این پروژه را تایید کند (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_other_lead_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_other_lead_uid::text, 'role', 'authenticated')::text, true);

    perform public.confirm_daily_log(v_proj_id, 'log-day-1', 'تایید غیرمجاز تیم دیگر');

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۰: سرپرست متفرقه توانست لاگ روزانه را تایید کند!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱۰: ممانعت از تایید لاگ روزانه توسط سرپرست متفرقه تایید شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۰ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۱: سرپرست قانونی منتسب به پروژه (اکیپ الف) لاگ روزانه را تایید می‌کند (باید مجاز باشد)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_lead_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead_uid::text, 'role', 'authenticated')::text, true);

    v_res := public.confirm_daily_log(v_proj_id, 'log-day-1', 'تایید شد، کیفیت عالی است');

    if (v_res->'dailyLogs'->0->>'supervisorConfirmed')::boolean = true then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱۱: تایید موفقیت‌آمیز لاگ توسط سرپرست قانونی پروژه ثبت شد.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۱: پرچم supervisorConfirmed تنظیم نشد.';
    end if;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۱ با خطا مواجه شد: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۲: عملیات عادی مجاز پروژه (ثبت توضیحات، امضای مشتری، چک‌لیست) بدون مانع اعمال می‌شود
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_lead_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead_uid::text, 'role', 'authenticated')::text, true);

    v_res := public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'completionNotes', 'کار نصب به طور کامل انجام شد.',
        'customerSatisfaction', 5,
        'handoverChecklist', jsonb_build_object('cleaned', true, 'leveled', true)
      )
    );

    if (v_res->>'completionNotes') = 'کار نصب به طور کامل انجام شد.' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱۲: پچ عملیاتی متعارف پروژه بدون مانع اعمال گردید.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۲: فیلدهای متعارف پروژه اعمال نشد.';
    end if;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۲ با خطا مواجه شد: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۳: تلاش برای UPDATE مستقیم طرح اولیه در بستر نقش دیتابیسی service_role
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role service_role';
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

    if current_user != 'service_role' then
      raise exception 'نقض کانتکست امنیتی: نقش=% (انتظار: service_role)', current_user;
    end if;

    update public.projects
    set data = jsonb_set(data, '{originalPlan,activities,0,plannedQuantity}', '777'::jsonb)
    where id = v_proj_id;

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۳: تریگر نتوانست مانع از UPDATE مستقیم توسط service_role شود!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱۳: تریگر با موفقیت مانع از دستکاری طرح اولیه در بستر واقعی نقش دیتابیسی service_role گردید.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۳ خطای متفاوتی داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۴: فراخوانی تحت نقش دیتابیسی anon (کاربر ناشناس بدون احراز هویت)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role anon';
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

    if current_user != 'anon' then
      raise exception 'نقض کانتکست امنیتی: نقش=% (انتظار: anon)', current_user;
    end if;

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object('completionNotes', 'تلاش ناشناس')
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۴: نقش anon توانست patch_project را اجرا کند!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%permission denied for function patch_project%' or sqlerrm like '%Unauthorized: user is not active%' then
      v_pass_count := v_pass_count + 1;
      raise notice '  [PASS] آزمون ۱۴: فراخوانی توسط نقش ناشناس anon با موفقیت در لایه مجوز/گیت امنیتی مسدود گردید.';
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۴ خطای غیرمنتظره داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۵: تکنسین تلاش می‌کند گزارش روزانه را با تاییدیه جعلی سرپرست ثبت کند (باید مسدود شود)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_tech_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tech_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_tech_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    perform public.patch_project(
      v_proj_id,
      jsonb_build_object(
        'dailyLogs', jsonb_build_array(
          jsonb_build_object(
            'id', 'log-forged-1',
            'date', '1405-02-20',
            'byUserId', v_tech_uid::text,
            'summary', 'تلاش تکنسین برای ثبت گزارش روزانه با تاییدیه جعلی سرپرست',
            'supervisorConfirmed', true
          )
        )
      )
    );

    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۵: تکنسین توانست تاییدیه سرپرست را جعل کند!';
  exception when others then
    execute 'reset role';
    if sqlerrm like '%تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است%' then
      declare
        v_chk_logs jsonb;
      begin
        select data->'dailyLogs' into v_chk_logs from public.projects where id = v_proj_id;
        if v_chk_logs is null or jsonb_array_length(v_chk_logs) = 0 then
          v_pass_count := v_pass_count + 1;
          raise notice '  [PASS] آزمون ۱۵: جعل تاییدیه سرپرست در لاگ روزانه توسط تکنسین مسدود و عدم تغییر داده‌ها تایید شد.';
        else
          v_fail_count := v_fail_count + 1;
          raise notice '  [FAIL] آزمون ۱۵: خطای امنیتی رخ داد اما لاگ جعلی ذخیره شد!';
        end if;
      end;
    else
      v_fail_count := v_fail_count + 1;
      raise notice '  [FAIL] آزمون ۱۵ خطای غیرمنتظره داد: %', sqlerrm;
    end if;
  end;

  -- ---------------------------------------------------------------------------
  -- آزمون ۱۶: تلاش تکنسین برای دور زدن گیت ورود فنی (پیش‌نیاز تاییدیه انبار و تولید)
  -- ---------------------------------------------------------------------------
  v_test_count := v_test_count + 1;
  begin
    -- ۱. درج پروژه تستی فاقد تاییدیه فنی با دسترسی ادمین
    insert into public.projects (id, data) values (
      v_proj_unconfirmed_id,
      jsonb_build_object(
        'id', v_proj_unconfirmed_id,
        'code', 'T-UNCONF',
        'title', 'پروژه فاقد تاییدیه فنی',
        'status', 'MEASUREMENT_PENDING',
        '_testRunMarker', v_run_marker,
        '_testRunToken', v_run_token,
        '_testTeamAId', v_team_a_id::text,
        '_testTeamBId', v_team_b_id::text,
        '_testTeamACode', v_team_a_code,
        '_testTeamBCode', v_team_b_code,
        '_testQcUserId', v_qc_uid::text,
        '_testCoordUserId', v_coord_uid::text,
        '_testLeadUserId', v_lead_uid::text,
        '_testOtherLeadUserId', v_other_lead_uid::text,
        '_testTechUserId', v_tech_uid::text,
        'assignedTeamId', v_team_a_id::text,
        'leadTechnicianId', v_lead_uid::text,
        'assignedTechnicianIds', jsonb_build_array(v_lead_uid::text, v_tech_uid::text),
        'technicalHandover', jsonb_build_object(
          'productionConfirmation', jsonb_build_object('confirmed', false),
          'warehouseConfirmation', jsonb_build_object('confirmed', false)
        )
      )
    );

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_tech_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tech_uid::text, 'role', 'authenticated')::text, true);

    if current_user != 'authenticated' or auth.uid() is distinct from v_tech_uid then
      raise exception 'نقض کانتکست امنیتی: نقش=%، auth.uid=%', current_user, auth.uid();
    end if;

    -- ۲. تلاش تکنسین برای دستکاری technicalHandover از طریق patch_project
    declare
      v_rpc_blocked boolean := false;
    begin
      perform public.patch_project(
        v_proj_unconfirmed_id,
        jsonb_build_object(
          'technicalHandover', jsonb_build_object(
            'productionConfirmation', jsonb_build_object('confirmed', true),
            'warehouseConfirmation', jsonb_build_object('confirmed', true)
          )
        )
      );
    exception when others then
      if sqlerrm like '%تکنسین اجازه تغییر فیلد «technicalHandover» را ندارد%' or
         sqlerrm like '%دسترسی غیرمجاز%' then
        v_rpc_blocked := true;
      else
        raise exception 'خطای غیرمنتظره در تلاش پچ تکنسین: %', sqlerrm;
      end if;
    end;

    if not v_rpc_blocked then
      raise exception 'SECURITY_BREACH: تکنسین توانست technicalHandover را از طریق patch_project پچ کند!';
    end if;

    -- ۳. تلاش تکنسین برای دور زدن RPC با UPDATE مستقیم جدول و انتقال به SCHEDULED
    -- سیاست RLS جدول: «QC Managers update projects» منحصراً به مدیر QC اجازه آپدیت می‌دهد.
    declare
      v_direct_blocked boolean := false;
      v_rows_affected int := 0;
    begin
      update public.projects
      set data = jsonb_set(
        jsonb_set(data, '{status}', '"SCHEDULED"'),
        '{technicalHandover,productionConfirmation,confirmed}', 'true'::jsonb
      )
      where id = v_proj_unconfirmed_id;

      get diagnostics v_rows_affected = row_count;

      if v_rows_affected = 0 then
        -- سیاست RLS مانع از دیده شدن و دستکاری سطر برای UPDATE توسط تکنسین شده است (سلوک استاندارد فیلترینگ RLS)
        v_direct_blocked := true;
      else
        raise exception 'SECURITY_BREACH: سیاست RLS نقض شد! تکنسین موفق شد % سطر جدول projects را مستقیماً آپدیت کند.', v_rows_affected;
      end if;
    exception when others then
      -- منحصراً خطاهای معتبر نقض دسترسی یا RLS پذیرفته می‌شوند؛ سایر خطاهای نامربوط دیتابیس مردودند
      if sqlstate in ('42501', '44000') or
         sqlerrm like '%row-level security%' or
         sqlerrm like '%permission denied%' or
         sqlerrm like '%دسترسی غیرمجاز%' then
        v_direct_blocked := true;
      else
        raise exception 'خطای غیرمنتظره در ارزیابی RLS تکنسین (کد=%): %', sqlstate, sqlerrm;
      end if;
    end;

    if not v_direct_blocked then
      raise exception 'SECURITY_BREACH: دستور UPDATE مستقیم تکنسین مسدود نگردید!';
    end if;

    execute 'reset role';

    -- ۴. ارزیابی نهایی در کانتکست ادمین: اطمینان از دست‌نخورده ماندن پروژه
    declare
      v_final_data jsonb;
    begin
      select data into v_final_data from public.projects where id = v_proj_unconfirmed_id;
      if (v_final_data->>'status') = 'MEASUREMENT_PENDING' and
         coalesce((v_final_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false) = false and
         coalesce((v_final_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false) = false then
        v_pass_count := v_pass_count + 1;
        raise notice '  [PASS] آزمون ۱۶: گیت ورود فنی در برابر نفوذ RPC و UPDATE مستقیم تکنسین با موفقیت محافظت شد.';
      else
        v_fail_count := v_fail_count + 1;
        raise notice '  [FAIL] آزمون ۱۶: گیت ورود فنی نقض شد و وضعیت/تاییدیه‌های پروژه دستکاری گردید!';
      end if;
    end;
  exception when others then
    execute 'reset role';
    v_fail_count := v_fail_count + 1;
    raise notice '  [FAIL] آزمون ۱۶ با خطای غیرمنتظره متوقف شد: %', sqlerrm;
  end;

  -- ---------------------------------------------------------------------------
  -- پاکسازی انحصاری فیکسچرهای ایجاد شده توسط همین اجرای آزمون با احراز دقیق مالکیت (Safe Ownership-Checked Cleanup)
  -- ---------------------------------------------------------------------------
  execute 'reset role';

  declare
    v_clean_projects int := 0;
    v_clean_members int := 0;
    v_clean_teams int := 0;
    v_clean_profiles int := 0;
    v_clean_users int := 0;
  begin
    delete from public.projects
    where id in (v_proj_id, v_proj_unconfirmed_id)
      and (data->>'_testRunMarker') = v_run_marker
      and (data->>'_testRunToken') = v_run_token;
    get diagnostics v_clean_projects = row_count;

    delete from public.team_members
    where team_id in (v_team_a_id, v_team_b_id)
      and user_id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid);
    get diagnostics v_clean_members = row_count;

    delete from public.installation_teams
    where id in (v_team_a_id, v_team_b_id)
      and code in (v_team_a_code, v_team_b_code);
    get diagnostics v_clean_teams = row_count;

    delete from public.profiles
    where id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid)
      and phone in (v_qc_phone, v_coord_phone, v_lead_phone, v_other_lead_phone, v_tech_phone);
    get diagnostics v_clean_profiles = row_count;

    if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
      delete from auth.users
      where id in (v_qc_uid, v_coord_uid, v_lead_uid, v_other_lead_uid, v_tech_uid)
        and email in (v_qc_email, v_coord_email, v_lead_email, v_other_lead_email, v_tech_email);
      get diagnostics v_clean_users = row_count;
    end if;

    if v_clean_projects != 2 or v_clean_members != 3 or v_clean_teams != 2 or v_clean_profiles != 5 then
      raise exception 'CLEANUP INCONSISTENCY: تعداد سطرهای حذف‌شده در پاکسازی عادی با انتظار مطابقت ندارد (پروژه‌ها: %، اعضا: %، اکیپ‌ها: %، پروفایل‌ها: %).',
        v_clean_projects, v_clean_members, v_clean_teams, v_clean_profiles;
    end if;
  end;

  raise notice '>> پاکسازی فیکسچرهای این اجرا با موفقیت انجام شد (توکن: %)', v_run_token;

  raise notice '======================================================================';
  raise notice 'خلاصه نتایج آزمون پایگاه داده: کل: % | موفق: % | ناموفق: %', v_test_count, v_pass_count, v_fail_count;
  raise notice '======================================================================';

  if v_fail_count > 0 then
    raise exception 'آزمون‌های امنیتی پایگاه داده با % مورد شکست مواجه شدند.', v_fail_count;
  end if;
end;
$$;

-- ==============================================================================
-- راهنمای DBA: رویه بازیابی و پاکسازی اجراهای متوقف‌شده (Safe Run-Specific Cleanup)
-- ==============================================================================
-- در صورتی که اتصال شبکه قطع شود یا پردازه قبل از رسیدن به بلاک پاکسازی کشته شود،
-- هیچ رکوردی به صورت خودکار یا کورکورانه حذف نمی‌شود و گارد تصادم در اجرای بعدی مانع از بازنویسی خواهد شد.
-- مدیر ارشد دیتابیس (DBA) باید از رویه ۳ مرحله‌ای زیر با استفاده از توکن دقیق اجرای متوقف‌شده استفاده کند:
--
-- مرحله ۱: استعلام پیش‌نمایش و بازیابی توکن دقیق اجرای متوقف‌شده و فراداده‌های هویتی (SELECT Preview):
--   SELECT
--     id,
--     data->>'title' AS title,
--     data->>'_testRunToken' AS run_token,
--     data->>'_testTeamAId' AS team_a_id,
--     data->>'_testTeamBId' AS team_b_id,
--     data->>'_testTeamACode' AS team_a_code,
--     data->>'_testTeamBCode' AS team_b_code,
--     data->>'_testQcUserId' AS qc_user_id,
--     data->>'_testLeadUserId' AS lead_user_id
--   FROM public.projects
--   WHERE data->>'_testRunMarker' = 'P2_1_ADVERSARIAL_TEST_OWNED';
--
-- مرحله ۲: پیش‌نمایش رکوردهای وابسته بر مبنای توکن دقیق بازیابی‌شده (<TARGET_RUN_TOKEN>):
--   -- الف) کاربران auth.users بر مبنای ۵ ایمیل دقیق این توکن (بدون هیچ‌گونه استفاده از LIKE یا Wildcard):
--   SELECT id, email FROM auth.users
--   WHERE email IN (
--     'qc-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'coord-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'lead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'otherlead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'tech-' || '<TARGET_RUN_TOKEN>' || '@talaie.test'
--   );
--
--   -- ب) پروفایل‌های وابسته به کاربران همین توکن:
--   SELECT p.id, p.name, p.phone, p.role FROM public.profiles p
--   JOIN auth.users u ON u.id = p.id
--   WHERE u.email IN (
--     'qc-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'coord-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'lead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'otherlead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--     'tech-' || '<TARGET_RUN_TOKEN>' || '@talaie.test'
--   );
--
--   -- ج) اکیپ‌های وابسته به کاربران همین توکن:
--   SELECT t.id, t.name, t.code, t.supervisor_id FROM public.installation_teams t
--   WHERE t.supervisor_id IN (
--     SELECT u.id FROM auth.users u
--     WHERE u.email IN (
--       'qc-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--       'coord-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--       'lead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--       'otherlead-' || '<TARGET_RUN_TOKEN>' || '@talaie.test',
--       'tech-' || '<TARGET_RUN_TOKEN>' || '@talaie.test'
--     )
--   );
--
-- مرحله ۳: پاکسازی در تراکنش مجزا با اعتبارسنجی صفات و کنترل سخت‌گیرانه تعداد سطرهای متاثر (Transactional Cleanup):
--   DO $$
--   DECLARE
--     v_target_token text := '<TARGET_RUN_TOKEN>'; -- جایگزینی توکن دقیق توسط DBA
--     v_proj_count int := 0;
--     v_team_a_id uuid;
--     v_team_b_id uuid;
--     v_team_a_code text;
--     v_team_b_code text;
--     v_target_uids uuid[];
--     v_target_emails text[];
--     v_del_projects int := 0;
--     v_del_members int := 0;
--     v_del_teams int := 0;
--     v_del_profiles int := 0;
--     v_del_users int := 0;
--   BEGIN
--     -- ۱. اعتبارسنجی دقیق پیشوند توکن (Exact Prefix Check)
--     IF v_target_token IS NULL OR left(v_target_token, 4) != 'ADV_' THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: قالب توکن نامعتبر است. پیشوند باید دقیقاً ADV_ باشد (مقدار: %).', v_target_token;
--     END IF;
--
--     -- ۲. اعتبارسنجی تعداد پروژه‌های متعلق به توکن (دقیقاً ۱ یا ۲ پروژه بسته به نقطه توقف)
--     SELECT count(*) INTO v_proj_count
--     FROM public.projects
--     WHERE data->>'_testRunToken' = v_target_token
--       AND data->>'_testRunMarker' = 'P2_1_ADVERSARIAL_TEST_OWNED';
--
--     IF v_proj_count NOT IN (1, 2) THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: تعداد پروژه‌های یافت‌شده با توکن % برابر با % است (انتظار: ۱ یا ۲ پروژه). توقف اضطراری جهت بازرسی دستی DBA.',
--         v_target_token, v_proj_count;
--     END IF;
--
--     -- ۳. استخراج فراداده‌های اکیپ و شناسه‌ها از پروژه معتبر این توکن
--     SELECT
--       (data->>'_testTeamAId')::uuid,
--       (data->>'_testTeamBId')::uuid,
--       data->>'_testTeamACode',
--       data->>'_testTeamBCode'
--     INTO
--       v_team_a_id,
--       v_team_b_id,
--       v_team_a_code,
--       v_team_b_code
--     FROM public.projects
--     WHERE data->>'_testRunToken' = v_target_token
--       AND data->>'_testRunMarker' = 'P2_1_ADVERSARIAL_TEST_OWNED'
--     LIMIT 1;
--
--     IF v_team_a_id IS NULL OR v_team_b_id IS NULL OR v_team_a_code IS NULL OR v_team_b_code IS NULL THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: فراداده‌های هویتی اکیپ‌ها در پروژه ناقص است. بررسی دستی DBA الزامی است.';
--     END IF;
--
--     -- تعریف دقیق لیست ۵ ایمیل مجاز
--     v_target_emails := ARRAY[
--       'qc-' || v_target_token || '@talaie.test',
--       'coord-' || v_target_token || '@talaie.test',
--       'lead-' || v_target_token || '@talaie.test',
--       'otherlead-' || v_target_token || '@talaie.test',
--       'tech-' || v_target_token || '@talaie.test'
--     ];
--
--     -- ۴. بازیابی شناسه‌های ۵ کاربر بر اساس برابری دقیق ایمیل‌ها
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
--       SELECT coalesce(array_agg(id), '{}') INTO v_target_uids
--       FROM auth.users
--       WHERE email = ANY(v_target_emails);
--
--       IF coalesce(cardinality(v_target_uids), 0) != 5 THEN
--         RAISE EXCEPTION 'CLEANUP ABORTED: تعداد کاربران یافت‌شده با ۵ ایمیل دقیق این توکن برابر با % است (انتظار: ۵). توقف جهت بازرسی دستی DBA.',
--           coalesce(cardinality(v_target_uids), 0);
--       END IF;
--     ELSE
--       -- در غیاب auth.users، شناسه‌ها از پروفایل‌ها با پیش‌شماره تلفن اختصاصی بازیابی می‌شوند
--       SELECT coalesce(array_agg(id), '{}') INTO v_target_uids
--       FROM public.profiles
--       WHERE id IN (
--         SELECT (data->>'_testQcUserId')::uuid FROM public.projects WHERE data->>'_testRunToken' = v_target_token
--         UNION
--         SELECT (data->>'_testCoordUserId')::uuid FROM public.projects WHERE data->>'_testRunToken' = v_target_token
--         UNION
--         SELECT (data->>'_testLeadUserId')::uuid FROM public.projects WHERE data->>'_testRunToken' = v_target_token
--         UNION
--         SELECT (data->>'_testOtherLeadUserId')::uuid FROM public.projects WHERE data->>'_testRunToken' = v_target_token
--         UNION
--         SELECT (data->>'_testTechUserId')::uuid FROM public.projects WHERE data->>'_testRunToken' = v_target_token
--       );
--     END IF;
--
--     -- ۵. اعتبارسنجی تعداد رکوردهای وابسته قبل از هرگونه حذف
--     IF (SELECT count(*) FROM public.team_members WHERE team_id IN (v_team_a_id, v_team_b_id) AND user_id = ANY(v_target_uids)) != 3 THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: تعداد اعضای اکیپ وابسته با مقدار مورد انتظار (۳) مطابقت ندارد. بررسی دستی الزامی است.';
--     END IF;
--
--     IF (SELECT count(*) FROM public.installation_teams WHERE id IN (v_team_a_id, v_team_b_id) AND code IN (v_team_a_code, v_team_b_code)) != 2 THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: تعداد اکیپ‌های وابسته با مقدار مورد انتظار (۲) مطابقت ندارد. بررسی دستی الزامی است.';
--     END IF;
--
--     IF (SELECT count(*) FROM public.profiles WHERE id = ANY(v_target_uids)) != 5 THEN
--       RAISE EXCEPTION 'CLEANUP ABORTED: تعداد پروفایل‌های وابسته با مقدار مورد انتظار (۵) مطابقت ندارد. بررسی دستی الزامی است.';
--     END IF;
--
--     -- ۶. اجرای حذف به ترتیب وابستگی
--     -- حذف پروژه‌ها ابتدا انجام می‌شود تا وابستگی کلید خارجی projects.updated_by روی auth.users پیش از حذف کاربران آزاد گردد
--     DELETE FROM public.projects
--     WHERE data->>'_testRunToken' = v_target_token
--       AND data->>'_testRunMarker' = 'P2_1_ADVERSARIAL_TEST_OWNED';
--     GET DIAGNOSTICS v_del_projects = ROW_COUNT;
--
--     DELETE FROM public.team_members
--     WHERE team_id IN (v_team_a_id, v_team_b_id)
--       AND user_id = ANY(v_target_uids);
--     GET DIAGNOSTICS v_del_members = ROW_COUNT;
--
--     DELETE FROM public.installation_teams
--     WHERE id IN (v_team_a_id, v_team_b_id)
--       AND code IN (v_team_a_code, v_team_b_code);
--     GET DIAGNOSTICS v_del_teams = ROW_COUNT;
--
--     DELETE FROM public.profiles
--     WHERE id = ANY(v_target_uids);
--     GET DIAGNOSTICS v_del_profiles = ROW_COUNT;
--
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
--       DELETE FROM auth.users WHERE email = ANY(v_target_emails);
--       GET DIAGNOSTICS v_del_users = ROW_COUNT;
--     END IF;
--
--     -- ۷. اعتبارسنجی سخت‌گیرانه تعداد سطرهای حذف‌شده
--     IF v_del_projects NOT IN (1, 2) OR v_del_teams != 2 OR v_del_members != 3 OR v_del_profiles != 5 THEN
--       RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد سطرهای حذف‌شده با مقادیر مورد انتظار مطابقت ندارد (پروژه‌ها: %، اکیپ‌ها: %، اعضا: %، پروفایل‌ها: %). تراکنش لغو شد.',
--         v_del_projects, v_del_teams, v_del_members, v_del_profiles;
--     END IF;
--
--     IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
--       IF v_del_users != 5 THEN
--         RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد کاربران حذف‌شده در auth.users (%) با مقدار ۵ مطابقت ندارد. تراکنش لغو شد.', v_del_users;
--       END IF;
--     END IF;
--
--     RAISE NOTICE 'پاکسازی آزمون امنیتی با موفقیت تایید شد: پروژه‌ها: % | اعضا: % | اکیپ‌ها: % | پروفایل‌ها: % | کاربران: %',
--       v_del_projects, v_del_members, v_del_teams, v_del_profiles, v_del_users;
--   END;
--   $$;
--
-- قانون عدم احراز مالکیت (Strict Ownership Rule):
-- اگر رکوردی در دیتابیس یافت شود که فاقد توکن معتبر باشد یا ارتباط آن با پروژه دارای توکن احراز نگردد،
-- DBA هرگز نباید آن را حذف کند. این رکوردها باید جهت بررسی دستی و تعیین منشا گزارش شوند.
-- ==============================================================================
