-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۸: هماهنگ‌کننده فقط با اکیپ‌های خودش
--
-- قاعده (درخواست مدیر QC):
--   کاربر «هماهنگ‌کننده» (SCHEDULING_COORDINATOR) اکیپ‌های خودش را دارد و کارش از مدیران QC جداست.
--   فقط پروژه‌های اکیپ‌های خودش را می‌بیند و برنامه‌ریزی می‌کند (تاریخ و اکیپ را مستقیم عوض می‌کند)،
--   QC آن‌ها را تأیید یا رد می‌کند، توقف و تیکت‌های آن‌ها را رسیدگی می‌کند، رزروهای فروش را می‌بیند
--   و برای اکیپ خودش برمی‌دارد، و وضعیت انبار را فقط می‌بیند.
--   حذف پروژه، تنظیمات، پرسنل، اکیپ‌ها و ثبت یا تغییر درخواست متریال برای او بسته است.
--
-- اینکه کدام اکیپ مال کدام هماهنگ‌کننده است را مدیر QC در «تنظیمات ← اکیپ‌ها و مسئول برنامه‌ریزی»
-- تعیین می‌کند (ستون coordinator_id). اکیپ بدون مسئول = اکیپ مدیران QC.
-- همان‌جا اکیپ را فعال یا غیرفعال می‌کند (ستون active؛ اکیپ غیرفعال در برنامه‌ریزی پیشنهاد نمی‌شود).
--
-- کل فایل یک‌جا اجرا می‌شود؛ اگر هر بخشی خطا بدهد هیچ تغییری اعمال نمی‌شود.
-- چیزی از داده‌های موجود پاک نمی‌شود. چندبار اجرا شدنش بی‌ضرر است.
-- در Supabase → SQL Editor کل فایل را یک‌جا اجرا کنید.
-- ==============================================================================

-- ۱. اکیپ‌ها: مسئول برنامه‌ریزی و فعال/غیرفعال ---------------------------------
alter table public.installation_teams
  add column if not exists coordinator_id uuid references public.profiles(id) on delete set null;
alter table public.installation_teams
  add column if not exists active boolean not null default true;
create index if not exists idx_installation_teams_coordinator on public.installation_teams (coordinator_id);

-- ۲. توابع کمکی ------------------------------------------------------------------
-- آیا این پروژه به یکی از اکیپ‌های هماهنگ‌کننده‌ی واردشده سپرده شده است؟
create or replace function public.talaie_coordinator_owns(project_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    public.talaie_my_role() = 'SCHEDULING_COORDINATOR'
    and project_data is not null
    and exists (
      select 1 from public.installation_teams t
      where t.coordinator_id = auth.uid()
        and t.id::text = project_data->>'assignedTeamId'
    ),
    false
  );
$$;

-- تأیید یا رد QC: مدیر QC همه‌ی پروژه‌ها، هماهنگ‌کننده فقط پروژه‌های اکیپ‌های خودش
create or replace function public.talaie_can_qc(project_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_qc_manager() or public.talaie_coordinator_owns(project_data);
$$;

revoke execute on function public.talaie_coordinator_owns(jsonb) from anon, public;
revoke execute on function public.talaie_can_qc(jsonb) from anon, public;
grant execute on function public.talaie_coordinator_owns(jsonb) to authenticated;
grant execute on function public.talaie_can_qc(jsonb) to authenticated;

-- ۳. ثبت تغییر پروژه (patch_project): هماهنگ‌کننده QC پروژه‌های خودش را تأیید می‌کند -------
do $fix$
declare
  fn regprocedure := to_regprocedure('public.patch_project(text, jsonb)');
  def text;
  before_def text;
begin
  if fn is null then
    raise exception 'تابع patch_project روی سرور نیست؛ اول مایگریشن ۰۲۵ باید اجرا شده باشد.';
  end if;
  def := pg_get_functiondef(fn);
  before_def := def;

  if position('talaie_can_qc' in def) = 0 then
    -- تأیید نهایی QC
    def := regexp_replace(def,
      '(patch->>''qcStatus'' = ''APPROVED'' then\s+if not )public\.is_qc_manager\(\)',
      '\1public.talaie_can_qc(current_data)');
    -- برگه‌ی بازرسی QC
    def := regexp_replace(def,
      '(if patch \? ''qcInspections'' then\s+if not )public\.is_qc_manager\(\)',
      '\1public.talaie_can_qc(current_data)');
    -- محدودیت قبلی هماهنگ‌کننده (تأیید QC و امتیاز) فقط برای پروژه‌هایی که مال خودش نیست
    def := regexp_replace(def,
      'if public\.is_scheduling_coordinator\(\) then(\s+if patch \? ''qcStatus'')',
      'if public.is_scheduling_coordinator() and not public.talaie_coordinator_owns(current_data) then\1');

    if (length(def) - length(replace(def, 'talaie_can_qc(current_data)', ''))) / length('talaie_can_qc(current_data)') < 2
       or position('talaie_coordinator_owns(current_data)' in def) = 0 then
      raise exception 'به‌روزرسانی patch_project انجام نشد (متن تابع روی سرور با نسخه‌ی مورد انتظار فرق دارد). هیچ تغییری اعمال نشد؛ این پیام را برای پشتیبانی بفرستید.';
    end if;
    execute def;
  end if;
end;
$fix$;

-- ۴. دیدن پروژه: هماهنگ‌کننده فقط پروژه‌های اکیپ‌های خودش --------------------------
create or replace function public.can_access_project(project_data jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_active_user() then
    return false;
  end if;
  if coalesce(public.talaie_my_role(), '') in ('CEO', 'QC_MANAGER', 'WAREHOUSE', 'MEASUREMENT_LEAD', 'SALES_REP', 'SALES') then
    return true;
  end if;
  if public.talaie_my_role() = 'SCHEDULING_COORDINATOR' then
    return public.talaie_coordinator_owns(project_data);
  end if;
  return public.talaie_is_assigned(project_data);
end;
$$;

-- ۵. ثبت، تغییر و حذف پروژه توسط هماهنگ‌کننده: فقط اکیپ‌های خودش، حذف ممنوع -----------
create or replace function public.talaie_enforce_coordinator_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(public.talaie_my_role(), '') <> 'SCHEDULING_COORDINATOR' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'هماهنگ‌کننده اجازه‌ی حذف پروژه را ندارد.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and not public.talaie_coordinator_owns(old.data) then
    raise exception 'این پروژه به اکیپ‌های شما سپرده نشده است؛ فقط پروژه‌های اکیپ‌های خودتان را می‌توانید تغییر دهید.'
      using errcode = '42501';
  end if;

  if not public.talaie_coordinator_owns(new.data) then
    raise exception 'پروژه باید به یکی از اکیپ‌های خودتان سپرده شود.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.talaie_enforce_coordinator_scope() from public, anon;

drop trigger if exists trg_talaie_coordinator_scope on public.projects;
create trigger trg_talaie_coordinator_scope
  before insert or update or delete on public.projects
  for each row
  execute function public.talaie_enforce_coordinator_scope();

-- ۶. تیکت‌ها: هماهنگ‌کننده فقط تیکت‌های پروژه‌های خودش را می‌بیند و رسیدگی می‌کند -------
do $fix$
begin
  if to_regclass('public.tickets') is null then
    return;
  end if;

  drop policy if exists "Authorized users read tickets" on public.tickets;
  create policy "Authorized users read tickets" on public.tickets for select to authenticated
    using (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') in ('CEO', 'WAREHOUSE')
      or public.can_access_project_id(data->>'projectId')
    );

  drop policy if exists "Authorized users insert tickets" on public.tickets;
  create policy "Authorized users insert tickets" on public.tickets for insert to authenticated
    with check (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') = 'WAREHOUSE'
      or exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_coordinator_owns(p.data))
      or (
        public.is_active_user()
        and (data->>'status') is distinct from 'RESOLVED'
        and exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
      )
    );

  drop policy if exists "Authorized users update tickets" on public.tickets;
  create policy "Authorized users update tickets" on public.tickets for update to authenticated
    using (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') = 'WAREHOUSE'
      or exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_coordinator_owns(p.data))
      or (
        public.is_active_user()
        and exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
      )
    )
    with check (
      public.is_qc_manager()
      or coalesce(public.talaie_my_role(), '') = 'WAREHOUSE'
      or exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_coordinator_owns(p.data))
      or (
        public.is_active_user()
        and (data->>'status') is distinct from 'RESOLVED'
        and exists (select 1 from public.projects p where p.id = tickets.data->>'projectId' and public.talaie_is_assigned(p.data))
      )
    );
end;
$fix$;

-- ۷. درخواست متریال: هماهنگ‌کننده فقط می‌بیند ---------------------------------------
do $fix$
begin
  if to_regclass('public.material_requests') is null then
    return;
  end if;

  create or replace function public.talaie_block_coordinator_material_writes()
  returns trigger language plpgsql security definer set search_path = public as $f$
  begin
    if auth.uid() is not null and coalesce(public.talaie_my_role(), '') = 'SCHEDULING_COORDINATOR' then
      raise exception 'هماهنگ‌کننده فقط وضعیت انبار را می‌بیند و درخواست متریال ثبت یا تغییر نمی‌دهد.' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end;
  $f$;
  revoke execute on function public.talaie_block_coordinator_material_writes() from public, anon;

  drop trigger if exists trg_talaie_coordinator_material_readonly on public.material_requests;
  create trigger trg_talaie_coordinator_material_readonly
    before insert or update or delete on public.material_requests
    for each row execute function public.talaie_block_coordinator_material_writes();
end;
$fix$;

-- ۸. گزارش خطای گوشی‌ها فقط برای مدیر QC ------------------------------------------
do $fix$
begin
  if to_regclass('public.client_error_reports') is null then
    return;
  end if;
  drop policy if exists "Managers read error reports" on public.client_error_reports;
  create policy "Managers read error reports"
    on public.client_error_reports for select to authenticated
    using (public.is_qc_manager());
end;
$fix$;

-- ۹. نسخه‌ی سرور ------------------------------------------------------------------
create or replace function public.talaie_schema_version()
returns int language sql stable as $$ select 28 $$;
grant execute on function public.talaie_schema_version() to authenticated;
