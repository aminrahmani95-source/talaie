-- ==============================================================================
-- گالری طلایی | آزمون همزمانی واقعی دو نشست مجزا - مدیریت ظرفیت اکیپ‌ها (P1)
-- فایل: supabase/tests/p1_capacity_concurrency_two_session_test.sql
-- فاز: P1 - اعتبارسنجی همزمانی سقف ظرفیت روزانه اکیپ‌های نصب (Team Capacity Concurrency)
--
-- سناریوی مسئله:
-- سقف ظرفیت روزانه اکیپ الف: ۸ ساعت
-- پروژه الف: ۵ ساعت کار در تاریخ 2026-11-25 (۴ آذر ۱۴۰۵ - روز کاری چهارشنبه)
-- پروژه ب: ۵ ساعت کار در همان تاریخ 2026-11-25
-- مجموع بار کاری در صورت تخصیص همزمان: ۱۰ ساعت (تجاوز از سقف ۸ ساعت)
--
-- مکانیزم صیانت همزمانی در تابع validate_schedule_capacity:
-- اجرای `SELECT * FROM public.installation_teams WHERE id = p_team_id FOR UPDATE;`
-- این دستور نشست دوم را در صف انتظار نگه می‌دارد تا نشست اول کامیت شود. پس از کامیت
-- نشست اول، نشست دوم مجدداً بار کاری جاری را محاسبه کرده و به علت پر شدن سقف خطا می‌دهد.
--
-- پیش‌نیاز ۱ (مدیریت دیتابیس - Authoritative DBA Staging Marker):
-- وجود رکورد معتبر در جدول public.db_environment_identity که توسط DBA درج شده است.
--
-- پیش‌نیاز ۲ (پارامترهای اپراتور - Fail-Closed Operator Parameters):
--   psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
--     -v app_environment=test \
--     -v expected_target_db=<test-db> \
--     -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING \
--     -f supabase/tests/p1_capacity_concurrency_two_session_test.sql
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

-- ۳. ارزیابی گارد اصالت DBA، انطباق کامل اسکیما و دسترسی‌های موثر (Canonical Schema & ACL Verification)
do $$
declare
  v_db_env text;
  v_cluster_id text;
  v_rls_enabled boolean;
  v_col_count int;
  v_pk_exists boolean;
  v_chk_env boolean;
  v_chk_lock boolean;
begin
  -- ۱. اعتبارسنجی وجود جدول و فعال بودن RLS در pg_class
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
    raise exception 'AUTHORITATIVE STAGING CHECK FAILED: ساختار یا نوع داده‌های db_environment_identity با اسکریپت کانونیکال مطابقت ندارد (تطابق % از ۵).' , v_col_count
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

  -- ۵. اعتبارسنجی دسترسی‌های موثر (Effective Privileges) با تابع has_table_privilege
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

  select environment, cluster_identity into v_db_env, v_cluster_id
  from public.db_environment_identity
  where safety_lock = true limit 1;

  if v_db_env is null or v_db_env not in ('staging', 'test', 'local') or v_cluster_id is null or trim(v_cluster_id) = '' then
    raise exception 'AUTHORITATIVE STAGING CHECK FAILED: رکورد شناسایی محیط نامعتبر است (محیط: %، کلاستر: %).' ,
      coalesce(v_db_env, 'NULL'), coalesce(v_cluster_id, 'NULL')
      using errcode = 'P0001';
  end if;

  if current_database() is distinct from current_setting('app.expected_target_db', true) then
    raise exception 'PREFLIGHT BLOCKED: نام دیتابیس متصل با مقدار اعلام‌شده مطابقت ندارد.';
  end if;

  if current_setting('app.staging_allowlist_token', true) is distinct from 'CONFIRMED_NON_PRODUCTION_STAGING' then
    raise exception 'PREFLIGHT BLOCKED: توکن تاییدیه محیط استیجینگ نامعتبر است.';
  end if;

  if current_database() ~* '(prod|production|live|talaie_main|primary)' then
    raise exception 'PREFLIGHT CRITICAL: نام دیتابیس متصل حاوی الگوهای پروداکشن است!';
  end if;

  raise notice '>> گارد اصالت استیجینگ DBA با موفقیت تایید شد: محیط=%، کلاستر=% (توجه: این بررسی مانع اداری و خطای انسانی است، نه اثبات رمزنگارانه)', v_db_env, v_cluster_id;
end;
$$;

-- ==============================================================================
-- بخش ۱: محافظت در برابر تداخل فیکسچرها و اعتبارسنجی مالکیت رکوردها (Collision Guard & Setup)
-- ==============================================================================

do $$
declare
  v_run_token text := 'CAP_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  v_coord_uid uuid := 'c2222222-2222-4222-8222-222222222222'::uuid;
  v_lead_uid uuid := 'c3333333-3333-4333-8333-333333333333'::uuid;
  v_team_id uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid;
begin
  -- الف) بررسی عدم وجود قبلی شناسه‌های پروژه در جدول projects
  if exists (
    select 1 from public.projects
    where id in ('PRJ-CAP-CONCUR-A', 'PRJ-CAP-CONCUR-B')
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): شناسه پروژه‌های تستی (PRJ-CAP-CONCUR-A یا B) از قبل در جدول projects موجود است. جهت ممانعت از بازنویسی یا حذف داده‌های دیگر، اجرا فوراً متوقف شد.';
  end if;

  -- ب) بررسی عدم وجود قبلی شناسه یا کد اکیپ در جدول installation_teams
  if exists (
    select 1 from public.installation_teams
    where id = v_team_id or code = 'CAP_CONCUR_TEAM'
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): اکیپ تستی با شناسه یا کد CAP_CONCUR_TEAM از قبل در جدول installation_teams موجود است. اجرا متوقف شد.';
  end if;

  -- ج) بررسی عدم وجود قبلی پروفایل‌های تستی بر اساس UUID یا شماره تلفن
  if exists (
    select 1 from public.profiles
    where id in (v_coord_uid, v_lead_uid)
       or phone in ('09129990022', '09129990033')
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا شماره تلفن تستی از قبل در جدول profiles موجود است. اجرا متوقف شد.';
  end if;

  -- د) بررسی عدم وجود قبلی در auth.users
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    if exists (
      select 1 from auth.users
      where id in (v_coord_uid, v_lead_uid)
         or email in ('cap-coord@talaie.test', 'cap-lead@talaie.test', 'cap-coord-' || v_run_token || '@talaie.test', 'cap-lead-' || v_run_token || '@talaie.test')
    ) then
      raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا ایمیل تستی از قبل در auth.users موجود است. اجرا متوقف شد.';
    end if;
  end if;

  -- آماده‌سازی فیکسچرهای تست با نشانگر و توکن اختصاصی مالکیت آزمون
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, aud, role, email) values
      (v_coord_uid, 'authenticated', 'authenticated', 'cap-coord-' || v_run_token || '@talaie.test'),
      (v_lead_uid, 'authenticated', 'authenticated', 'cap-lead-' || v_run_token || '@talaie.test');
  end if;

  insert into public.profiles (id, phone, name, role, active) values
    (v_coord_uid, '09129990022', 'هماهنگ‌کننده تست ظرفیت P1', 'SCHEDULING_COORDINATOR', true),
    (v_lead_uid, '09129990033', 'سرپرست اکیپ ظرفیت P1', 'LEAD_TECHNICIAN', true);

  -- تنظیم اکیپ با ظرفیت روزانه مشخص (۸ ساعت)
  insert into public.installation_teams (id, name, code, supervisor_id, daily_capacity_hours) values
    (v_team_id, 'اکیپ تست ظرفیت همزمان', 'CAP_CONCUR_TEAM', v_lead_uid, 8.0);

  insert into public.team_members (team_id, user_id, role_in_team) values
    (v_team_id, v_lead_uid, 'LEAD');

  -- درج دو پروژه با نشانگر صریح، توکن یکتا و ارجاعات پدری احراز هویت‌شده
  insert into public.projects (id, data) values
  (
    'PRJ-CAP-CONCUR-A',
    jsonb_build_object(
      'id', 'PRJ-CAP-CONCUR-A',
      'code', 'CAP-101',
      'title', 'پروژه ظرفیت الف',
      'status', 'MEASUREMENT_PENDING',
      'qcStatus', 'NOT_STARTED',
      '_testRunMarker', 'P1_CONCURRENCY_TEST_OWNED',
      '_testRunToken', v_run_token,
      '_testTeamId', v_team_id::text,
      '_testCoordinatorId', v_coord_uid::text,
      '_testLeadId', v_lead_uid::text,
      '_testCoordinatorEmail', 'cap-coord-' || v_run_token || '@talaie.test',
      '_testLeadEmail', 'cap-lead-' || v_run_token || '@talaie.test',
      'technicalHandover', jsonb_build_object(
        'productionConfirmation', jsonb_build_object('confirmed', true),
        'warehouseConfirmation', jsonb_build_object('confirmed', true)
      )
    )
  ),
  (
    'PRJ-CAP-CONCUR-B',
    jsonb_build_object(
      'id', 'PRJ-CAP-CONCUR-B',
      'code', 'CAP-102',
      'title', 'پروژه ظرفیت ب',
      'status', 'MEASUREMENT_PENDING',
      'qcStatus', 'NOT_STARTED',
      '_testRunMarker', 'P1_CONCURRENCY_TEST_OWNED',
      '_testRunToken', v_run_token,
      '_testTeamId', v_team_id::text,
      '_testCoordinatorId', v_coord_uid::text,
      '_testLeadId', v_lead_uid::text,
      '_testCoordinatorEmail', 'cap-coord-' || v_run_token || '@talaie.test',
      '_testLeadEmail', 'cap-lead-' || v_run_token || '@talaie.test',
      'technicalHandover', jsonb_build_object(
        'productionConfirmation', jsonb_build_object('confirmed', true),
        'warehouseConfirmation', jsonb_build_object('confirmed', true)
      )
    )
  );

  raise notice '>> فیکسچرهای آزمون ظرفیت P1 با موفقیت ایجاد شدند.';
  raise notice '>> توکن اجرای یکتا (Run Token): %', v_run_token;
  raise notice '>> این توکن به صورت پایدار در فیلد data->_testRunToken هر دو پروژه PRJ-CAP-CONCUR-A و B ذخیره گردید.';
end;
$$;

\echo '================================================================================'
\echo 'آماده‌سازی فیکسچرهای آزمون ظرفیت با موفقیت انجام شد (همراه با گارد تداخل).'
\echo 'ظرفیت روزانه اکیپ: ۸.۰ ساعت'
\echo 'پروژه الف: ۵.۰ ساعت در تاریخ 2026-11-25 (روز کاری چهارشنبه - ۴ آذر ۱۴۰۵)'
\echo 'پروژه ب: ۵.۰ ساعت در تاریخ 2026-11-25'
\echo 'مجموع بار کاری: ۱۰.۰ ساعت > ۸.۰ ساعت (باید مانع همزمانی شود)'
\echo '================================================================================'

-- ==============================================================================
-- بخش ۲: دستورالعمل اجرایی دو نشست مجزا برای اپراتور DBA
-- ==============================================================================
/*
================================================================================
گام اول: ورود و اجرای نشست شماره ۱ (Session A)
================================================================================
در پنجره ترمینال ۱ دستور اتصال را با گاردهای پیش‌پرواز اجرا کنید:

psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
  -v app_environment=test \
  -v expected_target_db=<test-db> \
  -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING

سپس فرامین زیر را در ترمینال ۱ وارد نمایید (تنظیم کانتکست هماهنگ‌کننده زمان‌بندی):

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

SELECT current_user, auth.uid(); -- خروجی باید باشد: authenticated و c2222222-2222-4222-8222-222222222222

-- زمان‌بندی پروژه الف برای ۵ ساعت در تاریخ 2026-11-25 (روز کاری چهارشنبه - ۴ آذر ۱۴۰۵):
SELECT public.patch_project(
  'PRJ-CAP-CONCUR-A',
  jsonb_build_object(
    'status', 'SCHEDULED',
    'assignedTeamId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'scheduledDate', '2026-11-25',
    'requiredDurationHours', 5.0
  )
);

-- توجه حیاتی: در این لحظه در ترمینال ۱ دستور COMMIT را اجرا نکنید!
-- تراکنش باز مانده و قفل ردیف اکیپ (FOR UPDATE روی installation_teams) در اختیار نشست ۱ است.

================================================================================
گام دوم: ورود و اجرای همزمان نشست شماره ۲ (Session B)
================================================================================
در پنجره ترمینال ۲ دستور اتصال را اجرا فرمایید:

psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
  -v app_environment=test \
  -v expected_target_db=<test-db> \
  -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING

سپس فرامین زیر را در ترمینال ۲ وارد نمایید:

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

SELECT current_user, auth.uid();

-- تلاش برای زمان‌بندی همزمان پروژه ب برای ۵ ساعت دیگر در همان تاریخ (2026-11-25):
SELECT public.patch_project(
  'PRJ-CAP-CONCUR-B',
  jsonb_build_object(
    'status', 'SCHEDULED',
    'assignedTeamId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'scheduledDate', '2026-11-25',
    'requiredDurationHours', 5.0
  )
);

-- مشاهده تجربی:
-- نشست ۲ بلافاصله در انتظار قفل ردیف اکیپ معلق (Blocked) می‌شود!

================================================================================
گام سوم: مشاهده قفل همزمانی با pg_stat_activity و pg_blocking_pids
================================================================================
در حالی که نشست ۲ در حالت تعلیق است، در یک ترمینال سوم کوئری زیر را اجرا فرمایید:

SELECT
  blocked.pid AS session_b_pid,
  blocked.usename AS session_b_user,
  blocked.wait_event_type,
  blocked.wait_event,
  pg_blocking_pids(blocked.pid) AS blocking_pids,
  blocker.usename AS session_a_user,
  blocker.state AS session_a_state,
  blocked.query AS session_b_waiting_query
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocker
  ON blocker.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0
  AND blocked.query LIKE '%PRJ-CAP-CONCUR-B%';

-- انتظار خروجی:
-- wait_event_type: Lock
-- wait_event: tuple یا transactionid
-- blocking_pids: حاوی PID نشست ۱ (Session A)

================================================================================
گام چهارم: کامیت نشست ۱ و فعال‌سازی مجدد نشست ۲
================================================================================
در پنجره ترمینال ۱ دستور زیر را اجرا فرمایید:

COMMIT;

-- بلافاصله در پنجره ترمینال ۲ مشاهده خواهید کرد که نشست ۲ از تعلیق خارج شده
-- و به علت تجاوز از سقف ظرفیت روزانه با خطای زیر متوقف می‌شود:
--
-- ERROR: سقف ظرفیت روزانه اکیپ «اکیپ تست ظرفیت همزمان» در تاریخ 2026-11-25 تکمیل است.
-- مجموع ساعات مورد نیاز (10.0) از سقف مجاز (8.0) فراتر می‌رود.
--
در ترمینال ۲ تراکنش شکست خورده را رول‌بک نمایید:

ROLLBACK;

================================================================================
گام پنجم: بررسی صحت نهایی داده‌ها در پایگاه داده (Final Concurrency Assertions)
================================================================================
کوئری ۱: بررسی وضعیت و ساعات دو پروژه:

SELECT
  p.id,
  p.data->>'status' AS status,
  p.data->>'scheduledDate' AS sched_date,
  (p.data->>'requiredDurationHours')::numeric AS hours
FROM public.projects p
WHERE p.id IN ('PRJ-CAP-CONCUR-A', 'PRJ-CAP-CONCUR-B')
ORDER BY p.id;

-- نتیجه مورد انتظار:
-- PRJ-CAP-CONCUR-A: وضعیت SCHEDULED با ۵.۰ ساعت در تاریخ 2026-11-25
-- PRJ-CAP-CONCUR-B: وضعیت MEASUREMENT_PENDING بدون تخصیص تاریخ یا اکیپ

کوئری ۲: محاسبه سرور سقف ظرفیت روزانه اکیپ در تاریخ آزمون:

SELECT
  t.id AS team_id,
  t.name AS team_name,
  t.daily_capacity_hours AS max_capacity,
  COALESCE(SUM((p.data->>'requiredDurationHours')::numeric), 0) AS total_persisted_hours,
  CASE
    WHEN COALESCE(SUM((p.data->>'requiredDurationHours')::numeric), 0) <= t.daily_capacity_hours
      THEN 'PASS: سقف مجاز روزانه رعایت شد (بدون اضافه بار)'
    ELSE 'FAIL: نقض همزمانی! اضافه بار بیش از ظرفیت در دیتابیس ثبت شده است'
  END AS capacity_verdict
FROM public.installation_teams t
LEFT JOIN public.projects p
  ON (p.data->>'assignedTeamId')::uuid = t.id
  AND p.data->>'scheduledDate' = '2026-11-25'
  AND (p.data->>'status') IN ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED')
WHERE t.id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid
GROUP BY t.id, t.name, t.daily_capacity_hours;

-- انتظار خروجی کوئری ۲:
-- total_persisted_hours: 5.0
-- capacity_verdict: PASS: سقف مجاز روزانه رعایت شد (بدون اضافه بار)

================================================================================
گام ششم: پاکسازی کامل فیکسچرهای آزمون ظرفیت با احراز دقیق مالکیت (Safe Run-Specific Cleanup)
================================================================================
رویه ۳ مرحله‌ای پاکسازی ایمن توسط DBA:

مرحله ۱: استعلام پیش‌نمایش و بازیابی توکن یکتای اجرای جاری (SELECT Preview):
SELECT
  id,
  data->>'title' AS title,
  data->>'_testRunToken' AS run_token,
  data->>'_testTeamId' AS team_id,
  data->>'_testCoordinatorId' AS coordinator_id,
  data->>'_testLeadId' AS lead_id,
  data->>'_testCoordinatorEmail' AS coordinator_email,
  data->>'_testLeadEmail' AS lead_email
FROM public.projects
WHERE id IN ('PRJ-CAP-CONCUR-A', 'PRJ-CAP-CONCUR-B')
  AND data->>'_testRunMarker' = 'P1_CONCURRENCY_TEST_OWNED';

مرحله ۲: پیش‌نمایش رکوردهای وابسته بر اساس شناسه‌های استخراج‌شده از پروژه دارای توکن (<TARGET_RUN_TOKEN>):
-- بررسی اکیپ وابسته استخراج‌شده از پروژه:
SELECT t.id, t.name, t.code, t.supervisor_id, t.daily_capacity_hours
FROM public.installation_teams t
WHERE t.id = (
  SELECT (data->>'_testTeamId')::uuid
  FROM public.projects
  WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

-- بررسی اعضای اکیپ وابسته استخراج‌شده:
SELECT m.id, m.team_id, m.user_id, m.role_in_team
FROM public.team_members m
WHERE m.team_id = (
  SELECT (data->>'_testTeamId')::uuid
  FROM public.projects
  WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

-- بررسی پروفایل‌های وابسته استخراج‌شده:
SELECT p.id, p.name, p.phone, p.role
FROM public.profiles p
WHERE p.id IN (
  SELECT (data->>'_testCoordinatorId')::uuid FROM public.projects WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
  UNION
  SELECT (data->>'_testLeadId')::uuid FROM public.projects WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

-- بررسی کاربران auth.users وابسته استخراج‌شده:
SELECT u.id, u.email
FROM auth.users u
WHERE u.email IN (
  SELECT data->>'_testCoordinatorEmail' FROM public.projects WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
  UNION
  SELECT data->>'_testLeadEmail' FROM public.projects WHERE id = 'PRJ-CAP-CONCUR-A' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

مرحله ۳: اجرای تراکنش پاکسازی با اعتبارسنجی صفات و تعداد سطرهای متاثر (Transactional Cleanup):
DO $$
DECLARE
  v_target_token text := '<TARGET_RUN_TOKEN>'; -- جایگزینی توکن دقیق بازیابی‌شده
  v_rec_a record;
  v_rec_b record;
  v_extracted_team_id uuid;
  v_extracted_coord_id uuid;
  v_extracted_lead_id uuid;
  v_extracted_coord_email text;
  v_extracted_lead_email text;
  v_team_rec record;
  v_member_rec record;
  v_coord_prof record;
  v_lead_prof record;
  v_del_projects int := 0;
  v_del_members int := 0;
  v_del_teams int := 0;
  v_del_profiles int := 0;
  v_del_users int := 0;
BEGIN
  -- ۱. اعتبارسنجی پیشوند دقیق توکن (Exact Prefix Check)
  IF left(v_target_token, 4) != 'CAP_' THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: قالب توکن نامعتبر است. پیشوند باید دقیقاً CAP_ باشد (مقدار: %).', v_target_token;
  END IF;

  -- ۲. استخراج پروژه‌های الف و ب و اثبات انطباق توکن و نشانگر
  SELECT id, data INTO v_rec_a
  FROM public.projects
  WHERE id = 'PRJ-CAP-CONCUR-A'
    AND data->>'_testRunToken' = v_target_token
    AND data->>'_testRunMarker' = 'P1_CONCURRENCY_TEST_OWNED';

  SELECT id, data INTO v_rec_b
  FROM public.projects
  WHERE id = 'PRJ-CAP-CONCUR-B'
    AND data->>'_testRunToken' = v_target_token
    AND data->>'_testRunMarker' = 'P1_CONCURRENCY_TEST_OWNED';

  IF v_rec_a.id IS NULL OR v_rec_b.id IS NULL THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: هر دو پروژه الف و ب با توکن یکتای % یافت نشدند.', v_target_token;
  END IF;

  -- ۳. انطباق فراداده‌های رکوردهای وابسته استخراج‌شده بین هر دو پروژه
  IF (v_rec_a.data->>'_testTeamId') IS DISTINCT FROM (v_rec_b.data->>'_testTeamId') OR
     (v_rec_a.data->>'_testCoordinatorId') IS DISTINCT FROM (v_rec_b.data->>'_testCoordinatorId') OR
     (v_rec_a.data->>'_testLeadId') IS DISTINCT FROM (v_rec_b.data->>'_testLeadId') OR
     (v_rec_a.data->>'_testCoordinatorEmail') IS DISTINCT FROM (v_rec_b.data->>'_testCoordinatorEmail') OR
     (v_rec_a.data->>'_testLeadEmail') IS DISTINCT FROM (v_rec_b.data->>'_testLeadEmail') THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: فراداده‌های فیکسچر بین پروژه‌های الف و ب متناقض است. عملیات حذف لغو شد.';
  END IF;

  v_extracted_team_id := (v_rec_a.data->>'_testTeamId')::uuid;
  v_extracted_coord_id := (v_rec_a.data->>'_testCoordinatorId')::uuid;
  v_extracted_lead_id := (v_rec_a.data->>'_testLeadId')::uuid;
  v_extracted_coord_email := v_rec_a.data->>'_testCoordinatorEmail';
  v_extracted_lead_email := v_rec_a.data->>'_testLeadEmail';

  IF v_extracted_team_id IS NULL OR v_extracted_coord_id IS NULL OR v_extracted_lead_id IS NULL OR
     v_extracted_coord_email IS NULL OR v_extracted_lead_email IS NULL THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: شناسه‌های رکوردهای وابسته از پروژه استخراج نشد.';
  END IF;

  -- ۴. اعتبارسنجی مستقل صفات فیکسچرهای وابسته پیش از هرگونه حذف
  SELECT * INTO v_team_rec FROM public.installation_teams WHERE id = v_extracted_team_id;
  IF v_team_rec.id IS NULL OR v_team_rec.code != 'CAP_CONCUR_TEAM' OR v_team_rec.supervisor_id != v_extracted_lead_id OR v_team_rec.daily_capacity_hours != 8.0 THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: صفات اکیپ با شناسه % با فیکسچر همزمانی مطابقت ندارد. حذف لغو شد.', v_extracted_team_id;
  END IF;

  SELECT * INTO v_member_rec FROM public.team_members WHERE team_id = v_extracted_team_id AND user_id = v_extracted_lead_id;
  IF v_member_rec.id IS NULL OR v_member_rec.role_in_team != 'LEAD' THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: عضویت سرپرست در اکیپ با شناسه % مطابقت ندارد. حذف لغو شد.', v_extracted_team_id;
  END IF;

  SELECT * INTO v_coord_prof FROM public.profiles WHERE id = v_extracted_coord_id;
  IF v_coord_prof.id IS NULL OR v_coord_prof.role != 'SCHEDULING_COORDINATOR' OR v_coord_prof.phone != '09129990022' THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: صفات پروفایل هماهنگ‌کننده (%) با فیکسچر مطابقت ندارد. حذف لغو شد.', v_extracted_coord_id;
  END IF;

  SELECT * INTO v_lead_prof FROM public.profiles WHERE id = v_extracted_lead_id;
  IF v_lead_prof.id IS NULL OR v_lead_prof.role != 'LEAD_TECHNICIAN' OR v_lead_prof.phone != '09129990033' THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: صفات پروفایل سرپرست (%) با فیکسچر مطابقت ندارد. حذف لغو شد.', v_extracted_lead_id;
  END IF;

  -- ۵. اجرای حذف به ترتیب وابستگی با شروط استخراج‌شده از پروژه و صفات تاییدشده
  -- حذف پروژه‌ها ابتدا انجام می‌شود تا وابستگی کلید خارجی projects.updated_by روی auth.users پیش از حذف کاربران آزاد گردد
  DELETE FROM public.projects
  WHERE id IN ('PRJ-CAP-CONCUR-A', 'PRJ-CAP-CONCUR-B')
    AND data->>'_testRunToken' = v_target_token
    AND data->>'_testRunMarker' = 'P1_CONCURRENCY_TEST_OWNED';
  GET DIAGNOSTICS v_del_projects = ROW_COUNT;

  DELETE FROM public.team_members
  WHERE team_id = v_extracted_team_id AND user_id = v_extracted_lead_id AND role_in_team = 'LEAD';
  GET DIAGNOSTICS v_del_members = ROW_COUNT;

  DELETE FROM public.installation_teams
  WHERE id = v_extracted_team_id AND code = 'CAP_CONCUR_TEAM';
  GET DIAGNOSTICS v_del_teams = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = v_extracted_coord_id AND phone = '09129990022' AND role = 'SCHEDULING_COORDINATOR';
  GET DIAGNOSTICS v_del_profiles = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = v_extracted_lead_id AND phone = '09129990033' AND role = 'LEAD_TECHNICIAN';
  v_del_profiles := v_del_profiles + ROW_COUNT;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DELETE FROM auth.users
    WHERE id = v_extracted_coord_id AND email = v_extracted_coord_email;
    GET DIAGNOSTICS v_del_users = ROW_COUNT;

    DELETE FROM auth.users
    WHERE id = v_extracted_lead_id AND email = v_extracted_lead_email;
    v_del_users := v_del_users + ROW_COUNT;
  END IF;

  -- ۶. اعتبارسنجی سخت‌گیرانه تعداد ردیف‌های حذف‌شده
  IF v_del_projects != 2 OR v_del_teams != 1 OR v_del_members != 1 OR v_del_profiles != 2 THEN
    RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد سطرهای حذف‌شده با مقادیر مورد انتظار مطابقت ندارد (پروژه‌ها: %، اکیپ: %، اعضا: %، پروفایل‌ها: %). کل عملیات لغو شد.',
      v_del_projects, v_del_teams, v_del_members, v_del_profiles;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    IF v_del_users != 2 THEN
      RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد کاربران حذف‌شده در auth.users (%) با مقدار ۲ مطابقت ندارد. کل عملیات لغو شد.', v_del_users;
    END IF;
  END IF;

  RAISE NOTICE 'پاکسازی آزمون ظرفیت P1 با موفقیت تایید شد: پروژه‌ها: % | اعضا: % | اکیپ: % | پروفایل‌ها: % | کاربران: %',
    v_del_projects, v_del_members, v_del_teams, v_del_profiles, v_del_users;
END;
$$;
*/

\echo '================================================================================'
\echo 'راهنمای آزمون همزمانی دو نشست برای ظرفیت P1 آماده بهره‌برداری DBA است.'
\echo 'برای اجرای آزمون تعاملی، دستورالعمل‌های گام‌های ۱ تا ۶ را دنبال فرمایید.'
\echo '================================================================================'
