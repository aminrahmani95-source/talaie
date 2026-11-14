-- ==============================================================================
-- گالری طلایی | آزمون همزمانی واقعی دو نشست مجزا (True Two-Session Concurrency Test)
-- فایل: supabase/tests/p2_1_concurrency_two_session_test.sql
-- فاز: P2.1 - آزمون همزمانی تایید اصلاحیه‌های طرح (Concurrent Plan Amendment Approvals)
--
-- سناریوی مسئله:
-- سقف مصوب اولیه: ۱۰ لت
-- نشست ۱ (Session A): تصویب اصلاحیه الف (۱۰ -> ۱۲)
-- نشست ۲ (Session B): تصویب اصلاحیه ب (۱۰ -> ۸ بر مبنای مقدار اولیه ۱۰)
--
-- پیش‌نیاز ۱ (مدیریت دیتابیس - Authoritative DBA Staging Marker):
-- وجود رکورد معتبر در جدول public.db_environment_identity که توسط DBA درج شده است.
--
-- پیش‌نیاز ۲ (پارامترهای اپراتور - Fail-Closed Operator Parameters):
--   psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
--     -v app_environment=test \
--     -v expected_target_db=<test-db> \
--     -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING \
--     -f supabase/tests/p2_1_concurrency_two_session_test.sql
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

-- ۳. ارزیابی گارد اصالت DBA و گاردهای پیش‌پرواز اپراتور
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
-- بخش ۱: محافظت در برابر تداخل فیکسچرها و آماده‌سازی فیکسچر اولیه (Collision Guard & Setup)
-- ==============================================================================

do $$
declare
  v_run_token text := 'CNC_' || to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
  v_qc_uid uuid := 'd1111111-1111-4111-8111-111111111111'::uuid;
  v_qc_email text := 'qc-concurrency-' || v_run_token || '@talaie.test';
  v_qc_phone text := '09129990099';
begin
  -- الف) بررسی عدم وجود قبلی شناسه پروژه
  if exists (select 1 from public.projects where id = 'PRJ-CONCURRENCY-TEST') then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): پروژه تستی PRJ-CONCURRENCY-TEST از قبل در جدول projects موجود است. جهت ممانعت از بازنویسی یا حذف ناخواسته داده‌ها، اجرا فوراً متوقف شد. در صورتی که این رکورد از اجرای قبلی باقی مانده، DBA باید آن را پس از بررسی دستی طبق دستورالعمل راهنما پاکسازی کند.'
      using errcode = 'P0001';
  end if;

  -- ب) بررسی عدم وجود قبلی پروفایل تستی
  if exists (
    select 1 from public.profiles
    where id = v_qc_uid
       or phone = v_qc_phone
  ) then
    raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا شماره تلفن تستی مدیر کیفی همزمانی (%) از قبل در جدول profiles موجود است. اجرا متوقف گردید.', v_qc_phone
      using errcode = 'P0001';
  end if;

  -- ج) بررسی عدم وجود قبلی در auth.users
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    if exists (
      select 1 from auth.users
      where id = v_qc_uid
         or email = v_qc_email
    ) then
      raise exception 'FIXTURE COLLISION DETECTED (Fail-Closed): کاربر یا ایمیل تستی (%) از قبل در auth.users موجود است. اجرا متوقف گردید.', v_qc_email
        using errcode = 'P0001';
    end if;
  end if;

  -- د) درج فیکسچرها با انتساب توکن اختصاصی و پایدار این اجرا (_testRunToken) و فراداده‌های مالکیتی
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, aud, role, email) values
      (v_qc_uid, 'authenticated', 'authenticated', v_qc_email);
  end if;

  insert into public.profiles (id, phone, name, role, active) values
    (v_qc_uid, v_qc_phone, 'مدیر کیفی آزمون همزمانی P2.1', 'QC_MANAGER', true);

  insert into public.projects (id, data) values (
    'PRJ-CONCURRENCY-TEST',
    jsonb_build_object(
      'id', 'PRJ-CONCURRENCY-TEST',
      'code', 'T-CNC',
      'title', 'پروژه آزمون همزمانی اصلاحیه',
      'status', 'IN_PROGRESS',
      'qcStatus', 'NOT_STARTED',
      '_testRunMarker', 'P2_1_CONCURRENCY_TEST_OWNED',
      '_testRunToken', v_run_token,
      '_testQcUserId', v_qc_uid::text,
      '_testQcEmail', v_qc_email,
      '_testQcPhone', v_qc_phone,
      'originalPlan', jsonb_build_object(
        'lockedAt', now()::text,
        'lockedByUserId', v_qc_uid::text,
        'activities', jsonb_build_array(
          jsonb_build_object(
            'id', 'act-shade-1',
            'title', 'شید رول سالن',
            'plannedQuantity', 10,
            'unit', 'لت'
          )
        )
      ),
      'planAmendments', '[]'::jsonb
    )
  );

  raise notice '>> فیکسچر PRJ-CONCURRENCY-TEST با موفقیت ایجاد شد (سقف اولیه: ۱۰ لت).';
  raise notice '>> توکن اجرای یکتا (Run Token): %', v_run_token;
  raise notice '>> ایمیل مدیر کیفی این اجرا: %', v_qc_email;
  raise notice '>> این توکن و مشخصات هویتی به صورت پایدار در فیلد data پروژه ذخیره گردید و در صورت توقف ناخواسته آزمون، برای پاکسازی انحصاری الزامی است.';
end;
$$;

\echo '----------------------------------------------------------------------'
\echo 'فیکسچر PRJ-CONCURRENCY-TEST با موفقیت ایجاد شد (سقف اولیه: ۱۰ لت).'
\echo 'اکنون دو ترمینال مجزا باز کرده و مراحل زیر را به ترتیب اجرا نمایید:'
\echo '----------------------------------------------------------------------'

-- ==============================================================================
-- بخش ۲: راهنمای عملیاتی اجرای دو نشست در دو پنجره ترمینال مجزا
-- ==============================================================================
/*
================================================================================
گام اول: ورود و اجرای تراکنش نشست شماره ۱ (Session A)
================================================================================
در پنجره ترمینال ۱ دستور اتصال را اجرا کنید:

psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
  -v app_environment=test \
  -v expected_target_db=<test-db> \
  -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING

سپس فرامین زیر را در ترمینال ۱ وارد نمایید (توجه به تغییر نقش به authenticated):

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

-- بررسی کانتکست هویتی و نقشی:
SELECT current_user, auth.uid(); -- خروجی باید باشد: authenticated و d1111111-1111-4111-8111-111111111111

-- اجرای پچ تایید اصلاحیه الف (۱۰ به ۱۲):
SELECT public.patch_project(
  'PRJ-CONCURRENCY-TEST',
  jsonb_build_object(
    'planAmendments', jsonb_build_array(
      jsonb_build_object(
        'id', 'amend-A',
        'activityId', 'act-shade-1',
        'previousQuantity', 10,
        'newQuantity', 12,
        'reason', 'درخواست افزایش ۲ لت در نشست ۱',
        'requestedByUserId', 'd1111111-1111-4111-8111-111111111111',
        'requestedAt', now()::text,
        'status', 'APPROVED',
        'reviewedByUserId', 'd1111111-1111-4111-8111-111111111111',
        'reviewedAt', now()::text
      )
    )
  )
);

-- مهم: در این مرحله در ترمینال ۱ دستور COMMIT نزنید!
-- پروژه دارای قفل ردیفی انحصاری (FOR UPDATE) توسط نشست ۱ است.

================================================================================
گام دوم: ورود و اجرای همزمان نشست شماره ۲ (Session B)
================================================================================
در پنجره ترمینال ۲ دستور اتصال را اجرا کنید:

psql -X -v ON_ERROR_STOP=1 -h <staging-host> -U postgres -d <test-db> \
  -v app_environment=test \
  -v expected_target_db=<test-db> \
  -v staging_allowlist_token=CONFIRMED_NON_PRODUCTION_STAGING

سپس فرامین زیر را در ترمینال ۲ وارد نمایید:

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

SELECT current_user, auth.uid();

-- تلاش برای تصویب اصلاحیه ب بر مبنای سقف منقضی ۱۰ (۱۰ به ۸):
SELECT public.patch_project(
  'PRJ-CONCURRENCY-TEST',
  jsonb_build_object(
    'planAmendments', jsonb_build_array(
      jsonb_build_object(
        'id', 'amend-B',
        'activityId', 'act-shade-1',
        'previousQuantity', 10,
        'newQuantity', 8,
        'reason', 'درخواست کاهش ۲ لت در نشست ۲ بر مبنای سقف قدیمی ۱۰',
        'requestedByUserId', 'd1111111-1111-4111-8111-111111111111',
        'requestedAt', now()::text,
        'status', 'APPROVED',
        'reviewedByUserId', 'd1111111-1111-4111-8111-111111111111',
        'reviewedAt', now()::text
      )
    )
  )
);

-- مشاهده تجربی:
-- نشست ۲ بلافاصله متوقف و معلق می‌شود (Blocked on Row Lock).

================================================================================
مشاهده دقیق و مطمئن صف قفل با pg_stat_activity و pg_blocking_pids
================================================================================
در حالی که نشست ۲ در حالت انتظار معلق است، در پنجره ترمینال دیگر کوئری زیر را اجرا فرمایید:

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
  AND blocked.query LIKE '%patch_project%';

-- مشخصات خروجی مورد انتظار:
-- ۱. session_b_pid: شناسه پردازه نشست ۲ که در حالت توقف است.
-- ۲. wait_event_type: نوع رخداد انتظار که برابر با "Lock" خواهد بود.
-- ۳. wait_event: نام رویداد قفل که برابر با "tuple" یا "transactionid" (قفل ردیف) است.
-- ۴. blocking_pids: آرایه شناسه‌های پردازه‌های مسدودکننده که شامل PID نشست ۱ می‌باشد.
-- ۵. session_a_state: وضعیت نشست ۱ که "idle in transaction" (در انتظار تعهد یا انصراف) است.
-- ۶. session_b_waiting_query: دستور دقیق پچ نشست ۲ که پشت قفل ردیفی معلق شده است.

================================================================================
گام سوم: تعهد تراکنش نشست ۱ (Commit Session A)
================================================================================
در ترمینال ۱ دستور زیر را اجرا کنید:

COMMIT;

-- نتیجه: تراکنش نشست ۱ با موفقیت تعهد گردیده و قفل آزاد می‌شود.

================================================================================
گام چهارم: مشاهده بیدار شدن و خطای همزمانی در نشست ۲ (Session B)
================================================================================
بلافاصله در ترمینال ۲ خطای زیر ظاهر می‌شود:

ERROR:  خطای همزمانی اصلاحیه: مقدار قبلی (10 لت) با آخرین سقف مصوب جاری (12 لت) مطابقت ندارد. این درخواست بر مبنای مقادیر منقضی‌شده ثبت گردیده است.

سپس در ترمینال ۲ دستور خروج از تراکنش را اجرا کنید:
ROLLBACK;
*/

-- ==============================================================================
-- بخش ۳: کوئری اعتبارسنجی نهایی وضعیت پس از آزمون
-- ==============================================================================
select
  id,
  data->'originalPlan'->'activities'->0->>'plannedQuantity' as original_baseline,
  jsonb_array_length(data->'planAmendments') as total_approved_amendments,
  data->'planAmendments'->0->>'id' as approved_amendment_id,
  data->'planAmendments'->0->>'newQuantity' as final_effective_quantity
from public.projects
where id = 'PRJ-CONCURRENCY-TEST';

-- ==============================================================================
-- بخش ۴: پاکسازی کامل فیکسچرهای آزمون همزمانی با احراز دقیق مالکیت (Safe Run-Specific Cleanup)
-- ==============================================================================
/*
================================================================================
گام پنجم: پاکسازی ایمن فیکسچرها پس از پایان آزمون یا در صورت وقوع اجرای متوقف‌شده (Interrupted Run)
================================================================================
توجه مهم امنیتی: این اسکریپت هیچ‌گاه رکوردهای موجود را به صورت خودکار یا کورکورانه حذف نمی‌کند.
در صورت قطع اتصال، بستن ترمینال قبل از اتمام، یا پایان موفقیت‌آمیز آزمون، رکوردهای فیکسچر
(پروژه PRJ-CONCURRENCY-TEST با برچسب P2_1_CONCURRENCY_TEST_OWNED و توکن یکتای CNC_...)
در دیتابیس باقی می‌مانند. گارد تصادم در ابتدای اسکریپت (Collision Guard) در اجرای بعدی مانع
از رونویسی یا تغییر آنها خواهد شد.

رویه ۳ مرحله‌ای پاکسازی ایمن توسط DBA:

مرحله ۱: استعلام پیش‌نمایش و بازیابی توکن یکتای اجرای جاری و فراداده‌های هویتی (SELECT Preview):
SELECT
  id,
  data->>'title' AS title,
  data->>'_testRunToken' AS run_token,
  data->>'_testQcUserId' AS qc_user_id,
  data->>'_testQcEmail' AS qc_email,
  data->>'_testQcPhone' AS qc_phone,
  data->'originalPlan'->>'lockedByUserId' AS locked_by_user_id
FROM public.projects
WHERE id = 'PRJ-CONCURRENCY-TEST'
  AND data->>'_testRunMarker' = 'P2_1_CONCURRENCY_TEST_OWNED';

مرحله ۲: پیش‌نمایش رکوردهای وابسته بر اساس شناسه‌ها و مقادیر استخراج‌شده از پروژه:
-- فرض: مقدار run_token بازیابی‌شده برابر با '<TARGET_RUN_TOKEN>' است:
SELECT p.id, p.name, p.phone, p.role
FROM public.profiles p
WHERE p.id = (
  SELECT (data->>'_testQcUserId')::uuid
  FROM public.projects
  WHERE id = 'PRJ-CONCURRENCY-TEST' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

SELECT u.id, u.email
FROM auth.users u
WHERE u.id = (
  SELECT (data->>'_testQcUserId')::uuid
  FROM public.projects
  WHERE id = 'PRJ-CONCURRENCY-TEST' AND data->>'_testRunToken' = '<TARGET_RUN_TOKEN>'
);

مرحله ۳: اجرای تراکنش پاکسازی با اعتبارسنجی صفات و تعداد سطرهای متاثر (Transactional Cleanup):
DO $$
DECLARE
  v_target_token text := '<TARGET_RUN_TOKEN>'; -- جایگزینی توکن دقیق توسط DBA
  v_extracted_qc_id uuid;
  v_extracted_qc_email text;
  v_extracted_qc_phone text;
  v_del_projects int := 0;
  v_del_profiles int := 0;
  v_del_users int := 0;
BEGIN
  -- ۱. اعتبارسنجی دقیق پیشوند توکن (Exact Prefix Check)
  IF v_target_token IS NULL OR left(v_target_token, 4) != 'CNC_' THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: قالب توکن نامعتبر است. پیشوند باید دقیقاً CNC_ باشد (مقدار: %).', v_target_token;
  END IF;

  -- ۲. استخراج فراداده‌های هویتی از رکورد پروژه دارای این توکن و نشانگر اختصاصی
  SELECT
    (data->>'_testQcUserId')::uuid,
    data->>'_testQcEmail',
    data->>'_testQcPhone'
  INTO
    v_extracted_qc_id,
    v_extracted_qc_email,
    v_extracted_qc_phone
  FROM public.projects
  WHERE id = 'PRJ-CONCURRENCY-TEST'
    AND data->>'_testRunToken' = v_target_token
    AND data->>'_testRunMarker' = 'P2_1_CONCURRENCY_TEST_OWNED';

  IF v_extracted_qc_id IS NULL OR v_extracted_qc_email IS NULL OR v_extracted_qc_phone IS NULL THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: پروژه PRJ-CONCURRENCY-TEST با توکن اعلام‌شده (%) یافت نشد یا فاقد فراداده‌های کامل هویتی است. توقف اضطراری جهت بازرسی دستی DBA.', v_target_token;
  END IF;

  -- ۳. اعتبارسنجی انطباق ایمیل استخراج‌شده با فرمت دقیق توکن
  IF v_extracted_qc_email != ('qc-concurrency-' || v_target_token || '@talaie.test') THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: عدم تطابق ایمیل استخراج‌شده (%) با فرمت مورد انتظار توکن (qc-concurrency-%@talaie.test). بازرسی دستی DBA الزامی است.',
      v_extracted_qc_email, v_target_token;
  END IF;

  -- ۴. اعتبارسنجی صفات پروفایل وابسته قبل از حذف
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_extracted_qc_id
      AND phone = v_extracted_qc_phone
      AND role = 'QC_MANAGER'
      AND name = 'مدیر کیفی آزمون همزمانی P2.1'
  ) THEN
    RAISE EXCEPTION 'CLEANUP ABORTED: مشخصات پروفایل وابسته (%) با مقادیر مورد انتظار فیکسچر این اجرا همخوانی ندارد. توقف جهت بازرسی دستی DBA.', v_extracted_qc_id;
  END IF;

  -- ۵. اعتبارسنجی auth.users قبل از حذف (در صورت وجود جدول)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' and table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_extracted_qc_id
        AND email = v_extracted_qc_email
    ) THEN
      RAISE EXCEPTION 'CLEANUP ABORTED: رکورد auth.users وابسته (%) با ایمیل استخراج‌شده (%) تطابق ندارد. توقف جهت بازرسی دستی DBA.', v_extracted_qc_id, v_extracted_qc_email;
    END IF;
  END IF;

  -- ۶. اجرای حذف به ترتیب وابستگی
  DELETE FROM public.projects
  WHERE id = 'PRJ-CONCURRENCY-TEST'
    AND data->>'_testRunToken' = v_target_token
    AND data->>'_testRunMarker' = 'P2_1_CONCURRENCY_TEST_OWNED';
  GET DIAGNOSTICS v_del_projects = ROW_COUNT;

  DELETE FROM public.profiles
  WHERE id = v_extracted_qc_id
    AND phone = v_extracted_qc_phone
    AND role = 'QC_MANAGER'
    AND name = 'مدیر کیفی آزمون همزمانی P2.1';
  GET DIAGNOSTICS v_del_profiles = ROW_COUNT;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' and table_name = 'users') THEN
    DELETE FROM auth.users
    WHERE id = v_extracted_qc_id
      AND email = v_extracted_qc_email;
    GET DIAGNOSTICS v_del_users = ROW_COUNT;
  END IF;

  -- ۷. کنترل سخت‌گیرانه تعداد ردیف‌های حذف شده
  IF v_del_projects != 1 OR v_del_profiles != 1 THEN
    RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد سطرهای حذف‌شده با انتظار مطابقت ندارد (پروژه: %، پروفایل: %). تراکنش لغو شد.',
      v_del_projects, v_del_profiles;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' and table_name = 'users') THEN
    IF v_del_users != 1 THEN
      RAISE EXCEPTION 'CLEANUP INCONSISTENCY: تعداد کاربران حذف‌شده در auth.users (%) با مقدار ۱ مطابقت ندارد. تراکنش لغو شد.', v_del_users;
    END IF;
  END IF;

  RAISE NOTICE 'پاکسازی آزمون همزمانی P2.1 با موفقیت تایید شد: پروژه: % | پروفایل: % | کاربر: %',
    v_del_projects, v_del_profiles, v_del_users;
END;
$$;

قانون عدم احراز مالکیت (Strict Ownership Rule):
اگر رکوردی در دیتابیس با شناسه‌های مورد نظر یافت شود اما فراداده‌های _testRunToken یا صفات وابسته آن با مقادیر مورد انتظار فیکسچر این اجرا انطباق قطعی نداشته باشد، این تراکنش بلافاصله خطا صادر کرده و Rollback می‌شود. در چنین شرایطی DBA به هیچ عنوان نباید اقدام به حذف دستی کورکورانه نماید و بازرسی سوابق الزامی است.
*/
