-- ==============================================================================
-- گالری طلایی | اسکریپت آزمون و تأیید سلامت ساختار دیتابیس (verify_setup.sql)
-- این کوئری فقط‌خواندنی است و به ازای هر شیء مورد انتظار یک سطر بازمی‌گرداند.
-- خروجی شامل check_name، ok (boolean) و detail است. تمام سطرها باید ok = true باشند.
-- در صورت وجود هرگونه شکست، اسکریپت با کد خطای غیرصفر متوقف (Fail-Closed) می‌شود.
-- ==============================================================================

\set ON_ERROR_STOP on
set client_min_messages to warning;

drop table if exists _verify_results;
create temp table _verify_results on commit drop as
with expected_tables as (
  select unnest(array['profiles', 'projects', 'tickets', 'talaie_sync', 'project_audit', 'installation_teams', 'team_members', 'schedule_change_requests', 'db_environment_identity', 'material_requests']) as tbl
),
table_checks as (
  select
    'table:public.' || e.tbl as check_name,
    (t.table_name is not null) as ok,
    case when t.table_name is not null then 'Table exists in public schema' else 'Missing table' end as detail
  from expected_tables e
  left join information_schema.tables t
    on t.table_schema = 'public' and t.table_name = e.tbl
),

expected_functions as (
  select * from (values
    ('is_active_user', ''),
    ('is_qc_manager', ''),
    ('is_qc_or_ceo', ''),
    ('is_scheduling_coordinator', ''),
    ('is_coordinator_or_manager', ''),
    ('next_project_code', ''),
    ('patch_project', 'id text, patch jsonb'),
    ('append_project_evaluation', 'id text, item jsonb'),
    ('admin_create_personnel', 'new_name text, new_phone text, new_password text, new_role text'),
    ('admin_update_personnel', 'target_id uuid, new_name text, new_phone text, new_role text, new_active boolean'),
    ('admin_reset_personnel_password', 'target_id uuid, new_password text'),
    ('admin_delete_personnel', 'target_id uuid'),
    ('admin_delete_project', 'p_id text, p_reason text, p_delete_tickets boolean'),
    ('user_team_id', 'uid uuid'),
    ('admin_assign_team_member', 'p_team_id uuid, p_user_id uuid, p_role_in_team text'),
    ('admin_remove_team_member', 'p_user_id uuid'),
    ('can_access_project', 'project_data jsonb'),
    ('can_access_project_id', 'pid text'),
    ('validate_schedule_capacity', 'p_project_id text, p_team_id uuid, p_scheduled_date text, p_end_date text, p_scheduled_time text, p_duration_hours numeric'),
    ('propose_schedule_change', 'p_project_id text, p_proposed_date text, p_proposed_end_date text, p_proposed_team_id uuid, p_reason text'),
    ('review_schedule_change', 'p_request_id uuid, p_decision text, p_review_notes text'),
    ('confirm_daily_log', 'p_project_id text, p_log_id text, p_notes text'),
    ('create_material_request', 'id text, request_data jsonb'),
    ('patch_material_request', 'id text, patch jsonb')
  ) as t(func_name, func_args)
),
function_checks as (
  select
    'function:public.' || ef.func_name || '(' || ef.func_args || ')' as check_name,
    (p.oid is not null) as ok,
    case
      when p.oid is not null then 'Function exists with exact signature'
      else 'Missing function or signature mismatch'
    end as detail
  from expected_functions ef
  left join lateral (
    select proc.oid
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = ef.func_name
      and (
        ef.func_args = '' and proc.pronargs = 0
        or pg_get_function_identity_arguments(proc.oid) = ef.func_args
      )
  ) p on true
),

expected_policies as (
  select * from (values
    ('public', 'profiles', 'Active users or self read profiles'),
    ('public', 'profiles', 'QC Managers insert profiles'),
    ('public', 'profiles', 'QC Managers update profiles'),
    ('public', 'profiles', 'QC Managers delete profiles'),
    ('public', 'installation_teams', 'Active users read teams'),
    ('public', 'installation_teams', 'QC Managers insert teams'),
    ('public', 'installation_teams', 'QC Managers update teams'),
    ('public', 'installation_teams', 'QC Managers delete teams'),
    ('public', 'team_members', 'Active users read team members'),
    ('public', 'team_members', 'QC Managers insert team members'),
    ('public', 'team_members', 'QC Managers update team members'),
    ('public', 'team_members', 'QC Managers delete team members'),
    ('public', 'schedule_change_requests', 'Active users read schedule changes'),
    ('public', 'schedule_change_requests', 'Managers and Coordinators insert schedule changes'),
    ('public', 'schedule_change_requests', 'QC Managers update schedule changes'),
    ('public', 'schedule_change_requests', 'QC Managers delete schedule changes'),
    ('public', 'talaie_sync', 'Active users read sync'),
    ('public', 'talaie_sync', 'QC Managers insert settings'),
    ('public', 'talaie_sync', 'QC Managers update settings'),
    ('public', 'talaie_sync', 'QC Managers delete sync'),
    ('public', 'projects', 'Authorized users read projects'),
    ('public', 'projects', 'Managers and Coordinators insert projects'),
    ('public', 'projects', 'QC Managers update projects'),
    ('public', 'projects', 'QC Managers delete projects'),
    ('public', 'tickets', 'Authorized users read tickets'),
    ('public', 'tickets', 'Authorized users insert tickets'),
    ('public', 'tickets', 'Authorized users update tickets'),
    ('public', 'tickets', 'QC Managers delete tickets'),
    ('public', 'material_requests', 'Authenticated active users can read material requests'),
    ('public', 'material_requests', 'Authenticated users can insert material requests'),
    ('public', 'material_requests', 'QC Managers delete material requests'),
    ('public', 'project_audit', 'QC Managers read audit'),
    ('storage', 'objects', 'Authorized users upload photos'),
    ('storage', 'objects', 'Authorized users read photos'),
    ('storage', 'objects', 'QC Managers delete photos')
  ) as t(pol_schema, pol_table, pol_name)
),
policy_checks as (
  select
    'policy:' || ep.pol_schema || '.' || ep.pol_table || ':' || ep.pol_name as check_name,
    (pol.policyname is not null) as ok,
    case when pol.policyname is not null then 'Policy active' else 'Missing policy' end as detail
  from expected_policies ep
  left join pg_policies pol
    on pol.schemaname = ep.pol_schema
   and pol.tablename = ep.pol_table
   and pol.policyname = ep.pol_name
),

bucket_check as (
  select
    'bucket:talaie-photos' as check_name,
    (b.id is not null) as ok,
    case when b.id is not null then 'Storage bucket exists' else 'Bucket not found' end as detail
  from (select 1) dummy
  left join storage.buckets b on b.id = 'talaie-photos'
),

expected_realtime as (
  select unnest(array['profiles', 'projects', 'tickets', 'talaie_sync', 'installation_teams', 'team_members', 'schedule_change_requests', 'material_requests']) as tbl
),
realtime_checks as (
  select
    'realtime:supabase_realtime:' || er.tbl as check_name,
    (pub.tablename is not null) as ok,
    case when pub.tablename is not null then 'Table in supabase_realtime publication' else 'Missing from realtime publication' end as detail
  from expected_realtime er
  left join pg_publication_tables pub
    on pub.pubname = 'supabase_realtime'
   and pub.schemaname = 'public'
   and pub.tablename = er.tbl
),

sync_cleanup_check as (
  select
    'talaie_sync:no_legacy_demo_or_password_rows' as check_name,
    (coalesce(count(*), 0) = 0 and exists(select 1 from public.talaie_sync where key = 'settings')) as ok,
    case
      when count(*) = 0 and exists(select 1 from public.talaie_sync where key = 'settings')
        then 'Only settings row exists (legacy rows removed)'
      when count(*) > 0
        then 'Legacy rows still present: ' || count(*)::text || ' unexpected key(s)'
      else 'Settings row is missing'
    end as detail
  from public.talaie_sync
  where key <> 'settings'
),

anon_func_permissions as (
  select
    'anon_no_execute:' || ef.func_name as check_name,
    coalesce(bool_and(not has_function_privilege('anon', proc.oid, 'EXECUTE')), true) as ok,
    case
      when bool_and(not has_function_privilege('anon', proc.oid, 'EXECUTE')) then 'Anon has NO EXECUTE (revoked)'
      else 'Security issue: Anon has EXECUTE privilege!'
    end as detail
  from expected_functions ef
  left join pg_proc proc on proc.proname = ef.func_name
  left join pg_namespace ns on ns.oid = proc.pronamespace and ns.nspname = 'public'
  group by ef.func_name
),

trigger_checks as (
  select
    'trigger:public.projects:' || et.trg_name as check_name,
    (trg.tgname is not null and trg.tgenabled = 'O' and (trg.tgtype & 2) != 0 and (trg.tgtype & 16) != 0) as ok,
    case
      when trg.tgname is null then 'Missing trigger on public.projects'
      when trg.tgenabled != 'O' then 'Trigger disabled (tgenabled=' || trg.tgenabled || ')'
      when (trg.tgtype & 2) = 0 or (trg.tgtype & 16) = 0 then 'Trigger event mismatch (expected BEFORE UPDATE)'
      else 'Trigger active BEFORE UPDATE on public.projects'
    end as detail
  from (values ('trg_enforce_plan_integrity')) as et(trg_name)
  left join pg_trigger trg
    on trg.tgname = et.trg_name
   and trg.tgrelid = 'public.projects'::regclass
   and not trg.tgisinternal
),

function_security_checks as (
  select
    'function_security:' || ef.func_name as check_name,
    (proc.oid is not null and proc.prosecdef and array_to_string(proc.proconfig, ',') like '%search_path=%') as ok,
    case
      when proc.oid is null then 'Function missing'
      when not proc.prosecdef then 'Security vulnerability: function is not SECURITY DEFINER'
      when array_to_string(proc.proconfig, ',') not like '%search_path=%' then 'Security issue: missing explicit search_path'
      else 'Function properly configured as SECURITY DEFINER with safe search_path'
    end as detail
  from (values
    ('patch_project'),
    ('create_material_request'),
    ('patch_material_request'),
    ('confirm_daily_log'),
    ('trg_enforce_project_plan_integrity'),
    ('is_qc_manager'),
    ('is_active_user')
  ) as ef(func_name)
  left join pg_proc proc on proc.proname = ef.func_name
  left join pg_namespace ns on ns.oid = proc.pronamespace and ns.nspname = 'public'
),

trigger_func_checks as (
  select
    'trigger_function:public.trg_enforce_project_plan_integrity' as check_name,
    (proc.oid is not null
      and proc.prosecdef
      and pg_get_functiondef(proc.oid) like '%lockedAt%'
      and pg_get_functiondef(proc.oid) like '%MEASUREMENT_PENDING%'
      and pg_get_functiondef(proc.oid) like '%previousQuantity%'
    ) as ok,
    case
      when proc.oid is null then 'Trigger function missing'
      when not proc.prosecdef then 'Trigger function missing SECURITY DEFINER'
      when pg_get_functiondef(proc.oid) not like '%lockedAt%' then 'Trigger function body missing lockedAt check'
      when pg_get_functiondef(proc.oid) not like '%previousQuantity%' then 'Trigger function body missing stale concurrency check'
      else 'Trigger function exists with lockedAt, status, and stale amendment concurrency enforcement'
    end as detail
  from (select 1) dummy
  left join pg_proc proc on proc.proname = 'trg_enforce_project_plan_integrity'
  left join pg_namespace ns on ns.oid = proc.pronamespace and ns.nspname = 'public'
),

security_function_body_checks as (
  select
    'security_def:patch_project:enforces_original_plan_and_amendments' as check_name,
    (proc.oid is not null
      and proc.prosecdef
      and pg_get_functiondef(proc.oid) like '%for update%'
      and pg_get_functiondef(proc.oid) like '%lockedAt%'
      and pg_get_functiondef(proc.oid) like '%MEASUREMENT_PENDING%'
      and pg_get_functiondef(proc.oid) like '%planAmendments%'
      and pg_get_functiondef(proc.oid) like '%previousQuantity%'
      and pg_get_functiondef(proc.oid) like '%receivingLeadConfirmed%'
      and pg_get_functiondef(proc.oid) like '%isManagerOverride%'
      and pg_get_functiondef(proc.oid) like '%qcStatus%'
      and pg_get_functiondef(proc.oid) like '%qcDefects%'
    ) as ok,
    case
      when proc.oid is null then 'patch_project missing'
      when not proc.prosecdef then 'patch_project is not SECURITY DEFINER'
      when pg_get_functiondef(proc.oid) not like '%for update%' then 'patch_project missing row-level locking (FOR UPDATE)'
      when pg_get_functiondef(proc.oid) not like '%lockedAt%' then 'patch_project missing lockedAt guard'
      when pg_get_functiondef(proc.oid) not like '%planAmendments%' then 'patch_project missing planAmendments guard'
      when pg_get_functiondef(proc.oid) not like '%previousQuantity%' then 'patch_project missing stale concurrency guard'
      when pg_get_functiondef(proc.oid) not like '%receivingLeadConfirmed%' then 'patch_project missing transfer acknowledgment guard'
      when pg_get_functiondef(proc.oid) not like '%qcStatus%' then 'patch_project missing QC status approval gate'
      else 'patch_project contains FOR UPDATE row locking, lockedAt, plan amendments, team transfer execution gate, and QC approval guards'
    end as detail
  from (select 1) dummy
  left join pg_proc proc on proc.proname = 'patch_project'
  left join pg_namespace ns on ns.oid = proc.pronamespace and ns.nspname = 'public'
),

schema_privilege_checks as (
  select
    'schema_security:public:no_untrusted_create' as check_name,
    (
      not has_schema_privilege('anon', 'public', 'CREATE') and
      not has_schema_privilege('authenticated', 'public', 'CREATE') and
      not has_schema_privilege('public', 'public', 'CREATE')
    ) as ok,
    case
      when not has_schema_privilege('anon', 'public', 'CREATE') and
           not has_schema_privilege('authenticated', 'public', 'CREATE') and
           not has_schema_privilege('public', 'public', 'CREATE')
        then 'Schema public is secured: CREATE revoked from anon, authenticated, and public'
      else 'Security issue: Schema public allows CREATE to untrusted roles!'
    end as detail
)

select check_name, ok, detail from table_checks
union all
select check_name, ok, detail from function_checks
union all
select check_name, ok, detail from policy_checks
union all
select check_name, ok, detail from bucket_check
union all
select check_name, ok, detail from realtime_checks
union all
select check_name, ok, detail from sync_cleanup_check
union all
select check_name, ok, detail from anon_func_permissions
union all
select check_name, ok, detail from trigger_checks
union all
select check_name, ok, detail from function_security_checks
union all
select check_name, ok, detail from trigger_func_checks
union all
select check_name, ok, detail from security_function_body_checks
union all
select check_name, ok, detail from schema_privilege_checks;

-- ۱. نمایش گزارش کامل نتایج به اپراتور
select check_name, ok, detail from _verify_results order by ok asc, check_name asc;

-- ۲. ارزیابی شکست قطعی (Fail-Closed): در صورت وجود هرگونه خطا، اسکریپت با کد غیرصفر خاتمه می‌یابد
do $$
declare
  v_failed_count int;
  v_failed_details text;
  v_total_count int;
begin
  select count(*) into v_total_count from _verify_results;

  select count(*), string_agg(check_name || ': ' || detail, E'\n  - ')
  into v_failed_count, v_failed_details
  from _verify_results
  where not ok;

  if v_failed_count > 0 then
    raise exception E'\n======================================================================\nVERIFICATION FAILED: تعداد % بررسی امنیتی از کل % مورد با شکست مواجه شدند:\n  - %\n======================================================================',
      v_failed_count, v_total_count, v_failed_details
      using errcode = 'P0001';
  else
    raise notice E'\n======================================================================\nALL VERIFICATION CHECKS PASSED: تمام % مورد بررسی ساختار و امنیت با موفقیت تایید شدند.\n======================================================================',
      v_total_count;
  end if;
end;
$$;
