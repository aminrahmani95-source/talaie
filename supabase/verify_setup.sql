-- ==============================================================================
-- گالری طلایی | اسکریپت آزمون و تأیید سلامت ساختار دیتابیس (verify_setup.sql)
-- این کوئری فقط‌خواندنی است و به ازای هر شیء مورد انتظار یک سطر بازمی‌گرداند.
-- خروجی شامل check_name، ok (boolean) و detail است. تمام سطرها باید ok = true باشند.
-- ==============================================================================

with expected_tables as (
  select unnest(array['profiles', 'projects', 'tickets', 'talaie_sync']) as tbl
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
    ('next_project_code', ''),
    ('patch_project', 'id text, patch jsonb'),
    ('append_project_evaluation', 'id text, item jsonb'),
    ('admin_create_personnel', 'new_name text, new_phone text, new_password text, new_role text'),
    ('admin_update_personnel', 'target_id uuid, new_name text, new_phone text, new_role text, new_active boolean'),
    ('admin_reset_personnel_password', 'target_id uuid, new_password text'),
    ('admin_delete_personnel', 'target_id uuid')
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
    ('public', 'talaie_sync', 'Active users read sync'),
    ('public', 'talaie_sync', 'QC Managers insert settings'),
    ('public', 'talaie_sync', 'QC Managers update settings'),
    ('public', 'talaie_sync', 'QC Managers delete sync'),
    ('public', 'projects', 'Active users read projects'),
    ('public', 'projects', 'QC Managers insert projects'),
    ('public', 'projects', 'QC Managers update projects'),
    ('public', 'projects', 'QC Managers delete projects'),
    ('public', 'tickets', 'Active users read tickets'),
    ('public', 'tickets', 'Authorized users insert tickets'),
    ('public', 'tickets', 'Authorized users update tickets'),
    ('public', 'tickets', 'QC Managers delete tickets'),
    ('storage', 'objects', 'Active users upload photos'),
    ('storage', 'objects', 'Active users read photos'),
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
  select unnest(array['profiles', 'projects', 'tickets', 'talaie_sync']) as tbl
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
order by ok asc, check_name asc;
