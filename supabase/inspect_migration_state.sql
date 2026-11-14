-- ==============================================================================
-- گالری طلایی | اسکریپت جامع بازرسی خط مبنا، سازگاری ساختاری، سیاست‌های RLS و دفترکل
-- فایل: supabase/inspect_migration_state.sql
-- فاز: P2.1
--
-- اهداف:
--   ۱. تفکیک قطعی سازگاری ساختاری از تاریخچه ثبت‌شده مهاجرت‌ها
--   ۲. ارزیابی دقیق سیاست‌های RLS (نام، نقش، فرمان، عبارات USING و WITH CHECK و عدم وجود سیاست‌های باز ناخواسته)
--   ۳. تفکیک پس‌شرط پاک‌سازی داده‌ای مایگریشن ۰۰۷ به عنوان یک شاخص کاملاً مستقل از ساختار
--   ۴. بررسی اصالت، مالکیت و آسیب‌پذیری دستکاری در دفترکل مهاجرت سوپابیس
--
-- طبقه‌بندی‌های خروجی:
--   - EMPTY_DATABASE
--   - MIGRATION_HISTORY_VERIFIED_011
--   - STRUCTURALLY_COMPATIBLE_WITH_011
--   - MIGRATION_HISTORY_VERIFIED_P2_1
--   - STRUCTURALLY_COMPATIBLE_WITH_P2_1
--   - UNKNOWN_OR_INCONSISTENT_STATE
--
-- نحوه اجرا:
--   psql -X -v ON_ERROR_STOP=1 -h <host> -U postgres -d <target-db> \
--     -f supabase/inspect_migration_state.sql
-- ==============================================================================

\set ON_ERROR_STOP on
set client_min_messages to warning;

drop table if exists _migration_inspection;
create temp table _migration_inspection (
  id serial primary key,
  category text not null,
  target_object text not null,
  baseline_phase text not null,
  status text not null check (status in ('PASS', 'FAIL', 'UNKNOWN')),
  detail text not null
) on commit drop;

do $$
declare
  v_rec record;
  v_exists boolean;
  v_count int;
  v_total_profiles int;
  v_secdef boolean;
  v_fdef text;
  v_del_type char;
  v_tg_enabled char;

  -- متغیرهای ارزیابی دفترکل سوپابیس
  v_has_ledger boolean := false;
  v_ledger_has_011 boolean := false;
  v_ledger_has_p21 boolean := false;
  v_ledger_client_write_protected boolean := true;
  v_ledger_owner text := 'none';
  v_ledger_tamper_reasons text := '';

  -- متغیرهای پس‌شرط داده‌ای مایگریشن ۰۰۷ (مستقل از ساختار)
  v_data_postcondition_007 text := 'UNKNOWN';
  v_data_postcondition_detail text := '';

  -- متغیرهای سنتز ساختاری
  v_is_empty boolean := false;
  v_struct_011_pass boolean := true;
  v_struct_p21_pass boolean := true;
  v_unknown_count int := 0;
  v_fail_count int := 0;

  v_final_classification text := 'UNKNOWN_OR_INCONSISTENT_STATE';
  v_final_recommendation text := '';
begin
  -- ============================================================================
  -- بخش ۱: بررسی وضعیت خام بودن پایگاه داده (EMPTY_DATABASE check)
  -- ============================================================================
  begin
    select not exists(
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'profiles', 'projects', 'tickets', 'installation_teams',
          'team_members', 'schedule_change_requests', 'talaie_sync',
          'project_audit', 'db_environment_identity'
        )
    ) into v_is_empty;

    if v_is_empty then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('DATABASE_STATE', 'public schema', 'ALL', 'PASS', 'پایگاه داده خام و فاقد هرگونه جداول اختصاصی گالری طلایی است.');
    else
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('DATABASE_STATE', 'public schema', 'ALL', 'PASS', 'جداول اختصاصی گالری طلایی در اسکیمای public یافت شدند.');
    end if;
  exception when others then
    insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
    values ('DATABASE_STATE', 'public schema', 'ALL', 'UNKNOWN', 'خطا در ارزیابی وضعیت خالی بودن دیتابیس: ' || sqlerrm);
  end;

  -- ============================================================================
  -- بخش ۲: بازرسی اعتبار، اصالت و دسترسی‌های دفترکل مهاجرت (Ledger Trust & CLI)
  -- ============================================================================
  begin
    if to_regclass('supabase_migrations.schema_migrations') is not null then
      v_has_ledger := true;

      -- استخراج مالک جدول
      select tableowner into v_ledger_owner
      from pg_tables
      where schemaname = 'supabase_migrations' and tablename = 'schema_migrations';

      -- ارزیابی امنیت و ممانعت از دستکاری توسط نقش‌های کلاینت (anon / authenticated)
      -- نکته: این بررسی صرفاً حفاظت در برابر نقش‌های کاربری کلاینت را اثبات می‌کند، نه مصونیت در برابر مالک یا مدیر ارشد دیتابیس.
      if has_table_privilege('anon', 'supabase_migrations.schema_migrations', 'INSERT')
         or has_table_privilege('authenticated', 'supabase_migrations.schema_migrations', 'INSERT')
         or has_table_privilege('anon', 'supabase_migrations.schema_migrations', 'UPDATE')
         or has_table_privilege('authenticated', 'supabase_migrations.schema_migrations', 'UPDATE')
         or has_table_privilege('anon', 'supabase_migrations.schema_migrations', 'DELETE')
         or has_table_privilege('authenticated', 'supabase_migrations.schema_migrations', 'DELETE') then
        v_ledger_client_write_protected := false;
        v_ledger_tamper_reasons := 'نقش‌های غیرمجاز کلاینت (anon/authenticated) دارای دسترسی تغییر در جدول تاریخچه هستند!';
      end if;

      -- بررسی نسخه‌های ثبت‌شده
      execute 'select count(*) from supabase_migrations.schema_migrations where version in (''001'', ''002'', ''005'', ''006'', ''007'', ''008'', ''009'', ''010'', ''011'')'
        into v_count;
      if v_count >= 9 then
        v_ledger_has_011 := true;
      end if;

      execute 'select exists(select 1 from supabase_migrations.schema_migrations where version in (''012'', ''012_p2_1_plan_security_and_confirmation''))'
        into v_ledger_has_p21;

      if v_ledger_client_write_protected then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('LEDGER_SECURITY', 'supabase_migrations.schema_migrations', 'AUDITABLE_LEDGER', 'PASS',
          format('دفترکل سوپابیس موجود و در برابر نوشتن کلاینت محافظت‌شده است (مالک: %s). ثبت ۰۱۱: %s | ثبت ۰۱۲: %s (توجه: تغییرناپذیری مطلق در برابر سوپریوزر/DBA ادعا نمی‌شود).', v_ledger_owner, v_ledger_has_011, v_ledger_has_p21));
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('LEDGER_SECURITY', 'supabase_migrations.schema_migrations', 'AUDITABLE_LEDGER', 'FAIL',
          format('دفترکل فاقد حفاظت در برابر کلاینت است: %s سوابق ثبت‌شده فاقد اعتبار اثباتی (Untrusted Recorded History) است.', v_ledger_tamper_reasons));
      end if;
    else
      v_has_ledger := false;
      v_ledger_has_011 := false;
      v_ledger_has_p21 := false;
      v_ledger_client_write_protected := false;
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('LEDGER_SECURITY', 'supabase_migrations.schema_migrations', 'AUDITABLE_LEDGER', 'PASS',
        'جدول دفترکل خودکار سوپابیس یافت نشد (استقرار بر مبنای فرامین مستقیم psql -f). عدم وجود دفترکل به منزله شکست ساختار نیست.');
    end if;
  exception when others then
    insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
    values ('LEDGER_SECURITY', 'supabase_migrations.schema_migrations', 'AUDITABLE_LEDGER', 'UNKNOWN',
      'خطا در دسترسی به ساختار یا مجوزهای دفترکل: ' || sqlerrm);
  end;

  -- ============================================================================
  -- بخش ۳: بازرسی مستقل پس‌شرط داده‌ای مایگریشن ۰۰۷ (کاملاً جدا از سازگاری ساختاری)
  -- ============================================================================
  begin
    if to_regclass('public.profiles') is not null then
      execute 'select count(*) from public.profiles' into v_total_profiles;

      if v_total_profiles = 0 then
        -- جدول خالی است: عدم وجود سطر به هیچ وجه به معنای اجرای قطعی مایگریشن ۰۰۷ نیست!
        v_data_postcondition_007 := 'UNKNOWN';
        v_data_postcondition_detail := 'جدول profiles دارای ۰ سطر است؛ خالی بودن جدول نمی‌تواند اجرای مایگریشن پاک‌سازی داده‌ای ۰۰۷ را اثبات کند (غیرقطعی).';
      else
        execute 'select count(*) from public.profiles where name ~ ''\((سرپرست اکیپ|تکنسین نصب|مسئول QC|مسئول فنی و QC)\)\s*$'''
          into v_count;

        if v_count = 0 then
          v_data_postcondition_007 := 'PASS';
          v_data_postcondition_detail := format('تمام %s سطر موجود در جدول profiles عاری از پسوند پرانتزی نقش هستند.', v_total_profiles);
        else
          v_data_postcondition_007 := 'FAIL';
          v_data_postcondition_detail := format('تعداد %s سطر از %s سطر دارای پسوند تکراری نقش هستند؛ پاک‌سازی داده‌ای مایگریشن ۰۰۷ الزامی است.', v_count, v_total_profiles);
        end if;
      end if;
    else
      v_data_postcondition_007 := 'UNKNOWN';
      v_data_postcondition_detail := 'جدول profiles در پایگاه داده وجود ندارد.';
    end if;

    insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
    values ('DATA_POSTCONDITION', 'public.profiles.name (Migration 007)', 'DATA_POSTCONDITION_INDEPENDENT',
      v_data_postcondition_007, v_data_postcondition_detail);
  exception when others then
    v_data_postcondition_007 := 'UNKNOWN';
    v_data_postcondition_detail := 'خطا در خواندن داده‌های جدول profiles (احتمال فقدان مجوز خواندن): ' || sqlerrm;
    insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
    values ('DATA_POSTCONDITION', 'public.profiles.name (Migration 007)', 'DATA_POSTCONDITION_INDEPENDENT',
      'UNKNOWN', v_data_postcondition_detail);
  end;

  -- در صورت خالی بودن دیتابیس، ارزیابی اشیاء عبور داده می‌شود
  if not v_is_empty then

    -- ============================================================================
    -- بخش ۴: بازرسی ساختاری جامع خط مبنای ۰۱۱ (PRE_012_BASELINE_011)
    -- ============================================================================

    -- ۴.۱. جداول پایه و وضعیت دقیق RLS و FORCE RLS
    for v_rec in (
      select unnest(array[
        'profiles', 'projects', 'tickets', 'talaie_sync',
        'project_audit', 'installation_teams', 'team_members', 'schedule_change_requests'
      ]) as tbl
    ) loop
      begin
        select (
          to_regclass('public.' || v_rec.tbl) is not null
          and exists(
            select 1 from pg_tables
            where schemaname = 'public' and tablename = v_rec.tbl and rowsecurity = true
          )
        ) into v_exists;

        if v_exists then
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('TABLE_RLS', 'public.' || v_rec.tbl, 'PRE_012_BASELINE_011', 'PASS', 'جدول موجود و تفکیک دسترسی ردیفی (rowsecurity = true) فعال است.');
        else
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('TABLE_RLS', 'public.' || v_rec.tbl, 'PRE_012_BASELINE_011', 'FAIL', 'جدول مفقود است یا RLS آن فعال نیست.');
        end if;
      exception when others then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TABLE_RLS', 'public.' || v_rec.tbl, 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا در ارزیابی RLS جدول: ' || sqlerrm);
      end;
    end loop;

    -- ۴.۲. بازرسی دقیق سیاست‌های RLS (نام، نقش‌ها، فرمان و عبارات شرطی)
    for v_rec in (
      select * from (values
        ('profiles', 'Active users or self read profiles', 'SELECT', 'authenticated', 'is_active_user'),
        ('profiles', 'QC Managers insert profiles', 'INSERT', 'authenticated', 'is_qc_manager'),
        ('profiles', 'QC Managers update profiles', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('profiles', 'QC Managers delete profiles', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('installation_teams', 'Active users read teams', 'SELECT', 'authenticated', 'is_active_user'),
        ('installation_teams', 'QC Managers insert teams', 'INSERT', 'authenticated', 'is_qc_manager'),
        ('installation_teams', 'QC Managers update teams', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('installation_teams', 'QC Managers delete teams', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('team_members', 'Active users read team members', 'SELECT', 'authenticated', 'is_active_user'),
        ('team_members', 'QC Managers insert team members', 'INSERT', 'authenticated', 'is_qc_manager'),
        ('team_members', 'QC Managers update team members', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('team_members', 'QC Managers delete team members', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('projects', 'Authorized users read projects', 'SELECT', 'authenticated', 'can_access_project'),
        ('projects', 'Managers and Coordinators insert projects', 'INSERT', 'authenticated', 'is_coordinator_or_manager'),
        ('projects', 'QC Managers update projects', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('projects', 'QC Managers delete projects', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('tickets', 'Authorized users read tickets', 'SELECT', 'authenticated', 'can_access_project_id'),
        ('tickets', 'Authorized users insert tickets', 'INSERT', 'authenticated', 'is_active_user'),
        ('tickets', 'Authorized users update tickets', 'UPDATE', 'authenticated', null),
        ('tickets', 'QC Managers delete tickets', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('schedule_change_requests', 'Active users read schedule changes', 'SELECT', 'authenticated', 'is_active_user'),
        ('schedule_change_requests', 'Managers and Coordinators insert schedule changes', 'INSERT', 'authenticated', 'is_coordinator_or_manager'),
        ('schedule_change_requests', 'QC Managers update schedule changes', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('schedule_change_requests', 'QC Managers delete schedule changes', 'DELETE', 'authenticated', 'is_qc_manager'),
        ('project_audit', 'QC Managers read audit', 'SELECT', 'authenticated', 'is_qc_manager'),
        ('talaie_sync', 'Active users read sync', 'SELECT', 'authenticated', 'is_active_user'),
        ('talaie_sync', 'QC Managers insert settings', 'INSERT', 'authenticated', 'is_qc_manager'),
        ('talaie_sync', 'QC Managers update settings', 'UPDATE', 'authenticated', 'is_qc_manager'),
        ('talaie_sync', 'QC Managers delete sync', 'DELETE', 'authenticated', 'is_qc_manager')
      ) as p(tbl, pol_name, expected_cmd, expected_role, expected_expr_snippet)
    ) loop
      begin
        select (
          pol.policyname is not null
          and pol.cmd = v_rec.expected_cmd
          and (v_rec.expected_role = any(pol.roles) or pol.roles = '{public}')
          and (
            v_rec.expected_expr_snippet is null
            or coalesce(pol.qual, '') like '%' || v_rec.expected_expr_snippet || '%'
            or coalesce(pol.with_check, '') like '%' || v_rec.expected_expr_snippet || '%'
          )
        ) into v_exists
        from (select 1) dummy
        left join pg_policies pol
          on pol.schemaname = 'public'
         and pol.tablename = v_rec.tbl
         and pol.policyname = v_rec.pol_name;

        if v_exists then
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('POLICY_DEFINITION', format('public.%s: "%s"', v_rec.tbl, v_rec.pol_name), 'PRE_012_BASELINE_011', 'PASS',
            format('سیاست RLS با فرمان %s و نقش %s و عبارات شرطی تایید شد.', v_rec.expected_cmd, v_rec.expected_role));
        else
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('POLICY_DEFINITION', format('public.%s: "%s"', v_rec.tbl, v_rec.pol_name), 'PRE_012_BASELINE_011', 'FAIL',
            format('سیاست RLS مفقود است یا با نقش/فرمان/شرط %s مطابقت ندارد.', v_rec.expected_cmd));
        end if;
      exception when others then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('POLICY_DEFINITION', format('public.%s: "%s"', v_rec.tbl, v_rec.pol_name), 'PRE_012_BASELINE_011', 'UNKNOWN',
          'خطا در ارزیابی کاتالوگ pg_policies: ' || sqlerrm);
      end;
    end loop;

    -- ۴.۳. ارزیابی عدم وجود سیاست‌های باز ناخواسته (Permissive Leakage Check)
    begin
      select count(*) into v_count
      from pg_policies
      where schemaname = 'public'
        and tablename in ('profiles', 'projects', 'tickets', 'installation_teams', 'team_members', 'schedule_change_requests', 'project_audit')
        and ('anon' = any(roles) or 'public' = any(roles));

      if v_count = 0 then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('POLICY_PERMISSIVENESS', 'public tables (no untrusted access)', 'PRE_012_BASELINE_011', 'PASS',
          'هیچ سیاست دسترسی باز برای نقش‌های ناشناس (anon یا public) روی جداول اصلی یافت نشد.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('POLICY_PERMISSIVENESS', 'public tables (no untrusted access)', 'PRE_012_BASELINE_011', 'FAIL',
          format('تعداد %s سیاست غیرمجاز دسترسی به نقش‌های anon/public شناسایی شد!', v_count));
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('POLICY_PERMISSIVENESS', 'public tables', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۴.۴. ستون‌ها و انواع داده فازهای P0 و P1
    begin
      select exists(
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'installation_teams'
          and column_name = 'daily_capacity_hours' and data_type = 'numeric'
      ) into v_exists;

      if v_exists then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('COLUMN_TYPE', 'public.installation_teams.daily_capacity_hours', 'PRE_012_BASELINE_011', 'PASS', 'ستون عددی با نوع numeric موجود است.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('COLUMN_TYPE', 'public.installation_teams.daily_capacity_hours', 'PRE_012_BASELINE_011', 'FAIL', 'ستون daily_capacity_hours با نوع numeric یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('COLUMN_TYPE', 'public.installation_teams.daily_capacity_hours', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    begin
      select (
        exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schedule_change_requests' and column_name = 'customer_name' and data_type = 'text')
        and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schedule_change_requests' and column_name = 'duration_hours' and data_type = 'numeric')
      ) into v_exists;

      if v_exists then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('COLUMN_TYPE', 'public.schedule_change_requests (customer_name, duration_hours)', 'PRE_012_BASELINE_011', 'PASS', 'ستون‌های اسنپ‌شات با انواع صحیح موجودند.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('COLUMN_TYPE', 'public.schedule_change_requests (customer_name, duration_hours)', 'PRE_012_BASELINE_011', 'FAIL', 'ستون‌های اسنپ‌شات مفقودند یا نوع داده اشتباه است.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('COLUMN_TYPE', 'public.schedule_change_requests', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۴.۵. قید کلید خارجی fk_schedule_change_project با رفتار ON DELETE SET NULL
    begin
      select c.confdeltype into v_del_type
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public' and t.relname = 'schedule_change_requests'
        and c.conname = 'fk_schedule_change_project' and c.contype = 'f';

      if v_del_type = 'n' then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('CONSTRAINT', 'public.schedule_change_requests.fk_schedule_change_project', 'PRE_012_BASELINE_011', 'PASS', 'کلید خارجی با رفتار ON DELETE SET NULL تایید شد.');
      elsif v_del_type is not null then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('CONSTRAINT', 'public.schedule_change_requests.fk_schedule_change_project', 'PRE_012_BASELINE_011', 'FAIL', format('کلید خارجی رفتار دیگری دارد (confdeltype = %s). رفتار SET NULL الزامی است.', v_del_type));
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('CONSTRAINT', 'public.schedule_change_requests.fk_schedule_change_project', 'PRE_012_BASELINE_011', 'FAIL', 'قید کلید خارجی fk_schedule_change_project یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('CONSTRAINT', 'public.schedule_change_requests.fk_schedule_change_project', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا در ارزیابی قید: ' || sqlerrm);
    end;

    -- ۴.۶. تریگرهای فعال خط مبنای ۰۱۱
    begin
      select tg.tgenabled into v_tg_enabled
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'team_members' and tg.tgname = 'trg_check_team_capacity';

      if v_tg_enabled = 'O' then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.team_members.trg_check_team_capacity', 'PRE_012_BASELINE_011', 'PASS', 'تریگر فعال (tgenabled = O) و متصل است.');
      elsif v_tg_enabled is not null then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.team_members.trg_check_team_capacity', 'PRE_012_BASELINE_011', 'FAIL', 'تریگر غیرفعال است (tgenabled != O).');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.team_members.trg_check_team_capacity', 'PRE_012_BASELINE_011', 'FAIL', 'تریگر trg_check_team_capacity یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('TRIGGER', 'public.team_members.trg_check_team_capacity', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا در بازرسی تریگر: ' || sqlerrm);
    end;

    begin
      select count(*) into v_count
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'projects'
        and tg.tgname in ('zz_projects_audit_write', 'zz_projects_audit_delete')
        and tg.tgenabled = 'O';

      if v_count = 2 then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.projects (audit triggers)', 'PRE_012_BASELINE_011', 'PASS', 'هر دو تریگر ممیزی ثبت و حذف فعال هستند.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.projects (audit triggers)', 'PRE_012_BASELINE_011', 'FAIL', format('تریگرهای ممیزی ناقص هستند (تعداد فعال: %s از ۲).', v_count));
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('TRIGGER', 'public.projects (audit triggers)', 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۴.۷. توابع امنیتی و RPC فازهای P0 و P1
    for v_rec in (
      select * from (values
        ('is_qc_manager', 'bool'::regtype, true),
        ('is_active_user', 'bool'::regtype, true),
        ('is_scheduling_coordinator', 'bool'::regtype, true),
        ('is_coordinator_or_manager', 'bool'::regtype, true),
        ('user_team_id', 'uuid'::regtype, true),
        ('user_team_role', 'text'::regtype, true),
        ('admin_create_personnel', 'jsonb'::regtype, true),
        ('admin_update_personnel', 'jsonb'::regtype, true),
        ('admin_delete_project', 'jsonb'::regtype, true),
        ('admin_assign_team_member', 'jsonb'::regtype, true),
        ('admin_remove_team_member', 'jsonb'::regtype, true),
        ('propose_schedule_change', 'jsonb'::regtype, true),
        ('review_schedule_change', 'jsonb'::regtype, true),
        ('validate_schedule_capacity', 'void'::regtype, true),
        ('patch_project', 'jsonb'::regtype, true)
      ) as f(func_name, ret_type, req_secdef)
    ) loop
      begin
        select p.prosecdef into v_secdef
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = v_rec.func_name
          and p.prorettype = v_rec.ret_type;

        if v_secdef is null then
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('FUNCTION_SECURITY', 'public.' || v_rec.func_name, 'PRE_012_BASELINE_011', 'FAIL', 'تابع یافت نشد یا نوع بازگشتی آن مطابقت ندارد.');
        elsif v_rec.req_secdef and not v_secdef then
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('FUNCTION_SECURITY', 'public.' || v_rec.func_name, 'PRE_012_BASELINE_011', 'FAIL', 'تابع فاقد صفت SECURITY DEFINER است.');
        else
          insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
          values ('FUNCTION_SECURITY', 'public.' || v_rec.func_name, 'PRE_012_BASELINE_011', 'PASS', 'تابع با امضا و امنیت صحیح موجود است.');
        end if;
      exception when others then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_SECURITY', 'public.' || v_rec.func_name, 'PRE_012_BASELINE_011', 'UNKNOWN', 'خطا در ارزیابی تابع: ' || sqlerrm);
      end;
    end loop;

    -- ============================================================================
    -- بخش ۵: بازرسی ساختاری جامع فاز P2.1 (مایگریشن ۰۱۲)
    -- ============================================================================

    -- ۵.۱. جدول هویت محیط دیتابیس (db_environment_identity)
    begin
      select (
        to_regclass('public.db_environment_identity') is not null
        and exists(select 1 from pg_tables where schemaname = 'public' and tablename = 'db_environment_identity' and rowsecurity = true)
        and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'db_environment_identity' and column_name = 'cluster_identity')
      ) into v_exists;

      if v_exists then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TABLE_RLS', 'public.db_environment_identity', 'P2_1_MIGRATION_012', 'PASS', 'جدول با ستون‌ها و RLS فعال موجود است.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TABLE_RLS', 'public.db_environment_identity', 'P2_1_MIGRATION_012', 'FAIL', 'جدول db_environment_identity یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('TABLE_RLS', 'public.db_environment_identity', 'P2_1_MIGRATION_012', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۵.۲. تابع تایید لاگ روزانه (confirm_daily_log)
    begin
      select p.prosecdef into v_secdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'confirm_daily_log'
        and p.prorettype = 'jsonb'::regtype;

      if v_secdef = true then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_SECURITY', 'public.confirm_daily_log', 'P2_1_MIGRATION_012', 'PASS', 'تابع تایید لاگ روزانه با امنیت SECURITY DEFINER تایید شد.');
      elsif v_secdef is not null then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_SECURITY', 'public.confirm_daily_log', 'P2_1_MIGRATION_012', 'FAIL', 'تابع confirm_daily_log صفت SECURITY DEFINER ندارد.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_SECURITY', 'public.confirm_daily_log', 'P2_1_MIGRATION_012', 'FAIL', 'تابع confirm_daily_log یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('FUNCTION_SECURITY', 'public.confirm_daily_log', 'P2_1_MIGRATION_012', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۵.۳. تریگر صیانت از خط مبنا (trg_enforce_plan_integrity)
    begin
      select tg.tgenabled into v_tg_enabled
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'projects' and tg.tgname = 'trg_enforce_plan_integrity';

      if v_tg_enabled = 'O' then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.projects.trg_enforce_plan_integrity', 'P2_1_MIGRATION_012', 'PASS', 'تریگر صیانت از خط مبنا فعال است.');
      elsif v_tg_enabled is not null then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.projects.trg_enforce_plan_integrity', 'P2_1_MIGRATION_012', 'FAIL', 'تریگر صیانت غیرفعال است.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('TRIGGER', 'public.projects.trg_enforce_plan_integrity', 'P2_1_MIGRATION_012', 'FAIL', 'تریگر trg_enforce_plan_integrity یافت نشد.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('TRIGGER', 'public.projects.trg_enforce_plan_integrity', 'P2_1_MIGRATION_012', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۵.۴. بدنه تابع patch_project شامل قفل ردیفی FOR UPDATE و کنترل همزمانی
    begin
      select pg_get_functiondef(p.oid) into v_fdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'patch_project';

      if v_fdef like '%for update%' and v_fdef like '%lockedAt%' and v_fdef like '%planAmendments%' and v_fdef like '%previousQuantity%' then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_BODY', 'public.patch_project', 'P2_1_MIGRATION_012', 'PASS', 'بدنه تابع شامل قفل ردیفی FOR UPDATE و گارد همزمانی اصلاحیه است.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('FUNCTION_BODY', 'public.patch_project', 'P2_1_MIGRATION_012', 'FAIL', 'بدنه patch_project فاقد قفل FOR UPDATE یا گارد اصلاحیه P2.1 است.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('FUNCTION_BODY', 'public.patch_project', 'P2_1_MIGRATION_012', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

    -- ۵.۵. صیانت از اسکیمای public: سلب دسترسی CREATE از نقش‌های عمومی و احراز هویت شده
    begin
      select (
        not has_schema_privilege('public', 'public', 'CREATE')
        and not has_schema_privilege('authenticated', 'public', 'CREATE')
      ) into v_exists;

      if v_exists then
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('PRIVILEGE', 'schema public (CREATE privilege)', 'P2_1_MIGRATION_012', 'PASS', 'دسترسی CREATE روی public از نقش‌های غیرمجاز سلب شده است.');
      else
        insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
        values ('PRIVILEGE', 'schema public (CREATE privilege)', 'P2_1_MIGRATION_012', 'FAIL', 'دسترسی ایجاد شیء روی public هنوز سلب نشده است.');
      end if;
    exception when others then
      insert into _migration_inspection (category, target_object, baseline_phase, status, detail)
      values ('PRIVILEGE', 'schema public (CREATE privilege)', 'P2_1_MIGRATION_012', 'UNKNOWN', 'خطا: ' || sqlerrm);
    end;

  end if; -- پایان بررسی اشیاء در صورت غیرخالی بودن دیتابیس

  -- ============================================================================
  -- بخش ۶: سنتز نهایی و طبقه‌بندی قطعی وضعیت
  -- ============================================================================
  select count(*) into v_unknown_count
  from _migration_inspection
  where status = 'UNKNOWN' and baseline_phase != 'DATA_POSTCONDITION_INDEPENDENT';

  select count(*) into v_fail_count
  from _migration_inspection
  where status = 'FAIL' and baseline_phase = 'PRE_012_BASELINE_011';

  select not exists(
    select 1 from _migration_inspection
    where baseline_phase = 'PRE_012_BASELINE_011' and status != 'PASS'
  ) into v_struct_011_pass;

  select not exists(
    select 1 from _migration_inspection
    where baseline_phase = 'P2_1_MIGRATION_012' and status != 'PASS'
  ) into v_struct_p21_pass;

  -- اعمال منطق تصمیم‌گیری تفکیک‌شده:
  if v_is_empty then
    v_final_classification := 'EMPTY_DATABASE';
    v_final_recommendation := 'اجرای سناریوی الف: نصب کامل و یکپارچه با supabase/complete_setup.sql. هرگز مایگریشن‌های تاریخی ۰۰۱ تا ۰۱۲ را پس از آن اجرا نکنید.';
  elsif v_unknown_count > 0 or not v_struct_011_pass then
    v_final_classification := 'UNKNOWN_OR_INCONSISTENT_STATE';
    v_final_recommendation := 'توقف فوری فرایند ارتقا! پایگاه داده دارای مغایرت، شکست بررسی ساختاری یا وضعیت نامشخص است. رویه ایمن اصلاح (Remediation) توسط DBA الزامی است.';
  elsif v_struct_p21_pass then
    if v_ledger_has_p21 and v_ledger_client_write_protected then
      v_final_classification := 'MIGRATION_HISTORY_VERIFIED_P2_1';
      v_final_recommendation := 'پایگاه داده با تاریخچه ثبتی رسمی و ساختار تاییدشده در فاز P2.1 قرار دارد. نیازی به اعمال مجدد مایگریشن ۰۱۲ نیست.';
    else
      -- ساختار کاملاً مطابق P2.1 است اما دفترکل فاقد رکورد است یا حفاظت کلاینت احراز نشده است
      v_final_classification := 'STRUCTURALLY_COMPATIBLE_WITH_P2_1';
      v_final_recommendation := 'پایگاه داده از نظر ساختاری منطبق بر P2.1 است اما تاریخچه مهاجرت ثبت‌نشده یا فاقد حفاظت لازم است. از اجرای مجدد خودداری فرمایید.';
    end if;
  elsif v_struct_011_pass and not v_struct_p21_pass then
    if v_ledger_has_011 and v_ledger_client_write_protected then
      v_final_classification := 'MIGRATION_HISTORY_VERIFIED_011';
      v_final_recommendation := 'خط مبنای ۰۱۱ با دفترکل مهاجرت و ساختار تایید گردید. پایگاه داده آماده اعمال مایگریشن ۰۱۲ است.';
    else
      -- ساختار کاملاً مطابق ۰۱۱ است اما تاریخچه معتبر با حفاظت کلاینت ثبت نشده است
      v_final_classification := 'STRUCTURALLY_COMPATIBLE_WITH_011';
      v_final_recommendation := 'پایگاه داده از نظر ساختاری با خط مبنای ۰۱۱ سازگار است (بدون تاریخچه ثبتی محافظت‌شده). اعمال مایگریشن ۰۱۲ بر روی کلون توصیه می‌شود.';
    end if;
  else
    v_final_classification := 'UNKNOWN_OR_INCONSISTENT_STATE';
    v_final_recommendation := 'پایگاه داده در وضعیت ناشناخته قرار دارد. تطبیق دستی الزامی است.';
  end if;

  -- چاپ گزارش در کنسول psql
  raise notice '======================================================================';
  raise notice 'نتیجه ارزیابی خط مبنای پایگاه داده (Baseline Assessment):';
  raise notice 'طبقه‌بندی وضعیت: [%]', v_final_classification;
  raise notice 'دستورالعمل: %', v_final_recommendation;
  raise notice '----------------------------------------------------------------------';
  raise notice 'وضعیت پس‌شرط داده‌ای مایگریشن ۰۰۷ (DATA_POSTCONDITION_007): [%]', v_data_postcondition_007;
  raise notice 'توضیحات داده: %', v_data_postcondition_detail;
  raise notice 'تذکر: سازگاری ساختاری و تاریخچه مهاجرت از این پس‌شرط داده‌ای کاملاً مستقل هستند.';
  raise notice '----------------------------------------------------------------------';
  raise notice 'تعداد کل بررسی‌ها: % | موفق (PASS): % | ناموفق (FAIL): % | نامشخص (UNKNOWN): %',
    (select count(*) from _migration_inspection),
    (select count(*) from _migration_inspection where status = 'PASS'),
    (select count(*) from _migration_inspection where status = 'FAIL'),
    v_unknown_count;
  raise notice '======================================================================';
end;
$$;

-- نمایش جدول تفصیلی بررسی‌های ساختاری به اپراتور
select
  category,
  target_object,
  baseline_phase,
  status,
  detail
from _migration_inspection
order by id asc;
