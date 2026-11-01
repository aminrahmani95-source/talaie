-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۰۸: پروژه‌های چندروزه + کنترل کامل مدیر + تاریخچه‌ی تغییرات
-- این فایل را می‌توان چند بار اجرا کرد (idempotent). همین محتوا در complete_setup.sql هم هست.
-- ۱. جدول تاریخچه‌ی تغییرات (project_audit) + تریگرها
-- ۲. ارتقای patch_project (وضعیت PAUSED، workSessions، dailyLogs، دلیل تغییر)
-- ۳. تابع admin_delete_project (حذف کامل با دلیل و حذف اختیاری تیکت‌ها)
-- ==============================================================================

-- ۱. جدول تاریخچه‌ی تغییرات
create table if not exists public.project_audit (
  id bigserial primary key,
  project_id text not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  reason text
);

-- اگر جدول قبلاً با کلید خارجی بدون on delete set null ساخته شده، اصلاحش کن (تا حذف پرسنل خطا ندهد)
do $$
declare fk record;
begin
  for fk in
    select conname from pg_constraint
    where conrelid = 'public.project_audit'::regclass and contype = 'f' and confdeltype <> 'n'
  loop
    execute format('alter table public.project_audit drop constraint %I', fk.conname);
  end loop;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.project_audit'::regclass and contype = 'f'
  ) then
    alter table public.project_audit
      add constraint project_audit_changed_by_fkey
      foreign key (changed_by) references auth.users(id) on delete set null;
  end if;
end $$;

create index if not exists idx_project_audit_project_id on public.project_audit(project_id);
create index if not exists idx_project_audit_changed_at on public.project_audit(changed_at desc);

alter table public.project_audit enable row level security;
revoke all on public.project_audit from anon;
revoke insert, update, delete on public.project_audit from authenticated;
grant select on public.project_audit to authenticated;

drop policy if exists "QC Managers read audit" on public.project_audit;
create policy "QC Managers read audit"
  on public.project_audit for select to authenticated
  using (public.is_qc_manager());

-- تریگر BEFORE: کلید موقت _auditReason را از داده جدا می‌کند و تغییر را ثبت می‌کند
-- (نام با zz شروع می‌شود تا بعد از تریگر updated_at اجرا شود)
create or replace function public.projects_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_user_id uuid := auth.uid();
  audit_user_name text := null;
  audit_reason text := nullif(current_setting('talaie.audit_reason', true), '');
begin
  if audit_user_id is not null then
    select name into audit_user_name from public.profiles where id = audit_user_id;
  end if;

  if TG_OP = 'DELETE' then
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (OLD.id, 'DELETE', audit_user_id, audit_user_name, OLD.data, null, audit_reason);
    return OLD;
  end if;

  if NEW.data ? '_auditReason' then
    audit_reason := coalesce(audit_reason, nullif(NEW.data->>'_auditReason', ''));
    NEW.data := NEW.data - '_auditReason';
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.data is not distinct from NEW.data then
      return NEW; -- تغییری در داده نیست؛ ثبت نکن
    end if;
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (NEW.id, 'UPDATE', audit_user_id, audit_user_name, OLD.data, NEW.data, audit_reason);
  else
    insert into public.project_audit(project_id, action, changed_by, changed_by_name, old_data, new_data, reason)
    values (NEW.id, 'INSERT', audit_user_id, audit_user_name, null, NEW.data, audit_reason);
  end if;
  return NEW;
end;
$$;

revoke execute on function public.projects_audit_trigger() from anon, public;

drop trigger if exists trg_projects_audit on public.projects;
drop trigger if exists zz_projects_audit_write on public.projects;
drop trigger if exists zz_projects_audit_delete on public.projects;
create trigger zz_projects_audit_write
  before insert or update on public.projects
  for each row execute function public.projects_audit_trigger();
create trigger zz_projects_audit_delete
  after delete on public.projects
  for each row execute function public.projects_audit_trigger();

-- ۲. ارتقای تابع patch_project
create or replace function public.patch_project(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_data jsonb;
  current_data jsonb;
  patch_key text;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  -- ذخیره دلیل ممیزی در تنظیمات محلی تراکنش
  if patch ? '_auditReason' then
    perform set_config('talaie.audit_reason', patch->>'_auditReason', true);
    patch := patch - '_auditReason';
  end if;

  select data into current_data
  from public.projects
  where public.projects.id = patch_project.id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- اگر کاربر مدیر QC نباشد، محدودیت‌های تکنسین اعمال می‌شود
  if not public.is_qc_manager() then

    -- الف) بررسی تخصیص پروژه به کاربر
    if not (
      (current_data->>'leadTechnicianId' is not null and current_data->>'leadTechnicianId' = auth.uid()::text) or
      (current_data->'assignedTechnicianIds' is not null and current_data->'assignedTechnicianIds' ? auth.uid()::text)
    ) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- ب) بررسی کلیدهای مجاز برای تکنسین
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in (
        'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
        'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
        'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
        'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
        'workSessions', 'dailyLogs'
      ) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
      end if;
    end loop;

    -- ج) بررسی وضعیت QC
    if patch ? 'qcStatus' then
      if patch->>'qcStatus' != 'PENDING' then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
      end if;
      if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
        raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
      end if;
    end if;

    -- د) بررسی ماشین وضعیت مجاز (شامل وضعیت نیمه‌کاره PAUSED برای پروژه‌های چندروزه)
    if patch ? 'status' and patch->>'status' is distinct from current_data->>'status' then
      declare
        curr_st text := current_data->>'status';
        new_st text := patch->>'status';
      begin
        if not (
          (curr_st = 'SCHEDULED' and new_st = 'EN_ROUTE') or
          (curr_st = 'EN_ROUTE' and new_st = 'IN_PROGRESS') or
          (curr_st = 'IN_PROGRESS' and new_st = 'COMPLETED') or
          (curr_st in ('EN_ROUTE', 'IN_PROGRESS') and new_st = 'STUCK') or
          (curr_st = 'IN_PROGRESS' and new_st = 'PAUSED') or
          (curr_st = 'PAUSED' and new_st = 'EN_ROUTE') or
          (curr_st = 'PAUSED' and new_st = 'IN_PROGRESS') or
          (curr_st = 'PAUSED' and new_st = 'STUCK')
        ) then
          raise exception 'انتقال وضعیت از «%» به «%» برای تکنسین مجاز نیست.', coalesce(curr_st, 'نامشخص'), new_st;
        end if;
      end;
    end if;

    -- هـ) بررسی گزارش توقف (stuckIncidents)
    if patch ? 'stuckIncidents' then
      declare
        curr_incidents jsonb := coalesce(
          case
            when current_data ? 'stuckIncidents' and jsonb_typeof(current_data->'stuckIncidents') = 'array'
              then current_data->'stuckIncidents'
            when current_data ? 'stuckIncident' and current_data->'stuckIncident' is not null and jsonb_typeof(current_data->'stuckIncident') = 'object'
              then jsonb_build_array(current_data->'stuckIncident')
            else '[]'::jsonb
          end,
          '[]'::jsonb
        );
        new_incidents jsonb := patch->'stuckIncidents';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_incidents) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;

        curr_len := jsonb_array_length(curr_incidents);
        new_len := jsonb_array_length(new_incidents);

        if new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;

        for i in 0 .. (curr_len - 1) loop
          if (curr_incidents->i) is distinct from (new_incidents->i) then
            raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
          end if;
        end loop;

        if (new_incidents->(new_len - 1)->>'resolutionStatus') is distinct from 'OPEN' then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط میتواند گزارش استاک جدید ثبت کند.';
        end if;
      end;
    end if;

    -- و) بررسی dailyLogs (فقط الحاق مجاز است)
    if patch ? 'dailyLogs' then
      declare
        curr_logs jsonb := coalesce(current_data->'dailyLogs', '[]'::jsonb);
        new_logs jsonb := patch->'dailyLogs';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_logs) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: لاگ روزانه باید آرایه باشد.';
        end if;
        curr_len := jsonb_array_length(curr_logs);
        new_len := jsonb_array_length(new_logs);
        if new_logs = curr_logs then
          null; -- بدون تغییر
        elsif new_len != curr_len + 1 then
          raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند لاگ روزانه جدید الصاق کند.';
        else
          for i in 0 .. (curr_len - 1) loop
            if (curr_logs->i) is distinct from (new_logs->i) then
              raise exception 'دسترسی غیرمجاز: ویرایش لاگ‌های روزانه قبلی مجاز نیست.';
            end if;
          end loop;
          if (new_logs->(new_len - 1)->>'byUserId') is distinct from auth.uid()::text then
            raise exception 'دسترسی غیرمجاز: ثبت لاگ روزانه فقط با هویت خودتان مجاز است.';
          end if;
        end if;
      end;
    end if;

    -- ز) بررسی workSessions (الحاق جلسه جدید یا بستن جلسه باز جاری خود تکنسین)
    if patch ? 'workSessions' then
      declare
        curr_sess jsonb := coalesce(current_data->'workSessions', '[]'::jsonb);
        new_sess jsonb := patch->'workSessions';
        curr_len int;
        new_len int;
        i int;
      begin
        if jsonb_typeof(new_sess) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: جلسات کاری باید آرایه باشد.';
        end if;
        curr_len := jsonb_array_length(curr_sess);
        new_len := jsonb_array_length(new_sess);

        if new_sess = curr_sess then
          null; -- بدون تغییر
        elsif new_len = curr_len and curr_len > 0 then
          for i in 0 .. (curr_len - 2) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
          -- هر عضو تخصیص‌یافته‌ی اکیپ می‌تواند جلسه‌ی باز را ببندد، ولی مشخصات جلسه نباید عوض شود
          if (curr_sess->(curr_len - 1)) - 'endedAt' is distinct from (new_sess->(new_len - 1)) - 'endedAt' then
            raise exception 'دسترسی غیرمجاز: فقط زمان پایان جلسه‌ی کاری باز قابل ثبت است.';
          end if;
          if curr_sess->(curr_len - 1)->>'endedAt' is not null then
            raise exception 'دسترسی غیرمجاز: این جلسه کاری قبلاً بسته شده است.';
          end if;
          if new_sess->(new_len - 1)->>'endedAt' is null then
            raise exception 'دسترسی غیرمجاز: زمان پایان کار جلسه مشخص نشده است.';
          end if;
        elsif new_len = curr_len + 1 then
          for i in 0 .. (curr_len - 1) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
          if (new_sess->(new_len - 1)->>'byUserId') is distinct from auth.uid()::text then
            raise exception 'دسترسی غیرمجاز: ثبت جلسه کاری جدید فقط با هویت خودتان مجاز است.';
          end if;
        else
          raise exception 'دسترسی غیرمجاز: تعداد یا ترتیب جلسات کاری نامعتبر است.';
        end if;
      end;
    end if;

  end if;

  update public.projects
  set data = data || patch,
      updated_at = now(),
      updated_by = auth.uid()
  where public.projects.id = patch_project.id
  returning data into updated_data;

  return updated_data;
end;
$$;

revoke execute on function public.patch_project(text, jsonb) from anon, public;
grant execute on function public.patch_project(text, jsonb) to authenticated;

-- ۳. حذف کامل پروژه توسط مدیر QC (با دلیل و حذف اختیاری تیکت‌ها)
create or replace function public.admin_delete_project(p_id text, p_reason text default null, p_delete_tickets boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_qc_manager() then
    raise exception 'دسترسی غیرمجاز: فقط مدیر QC می‌تواند پروژه را حذف کند.';
  end if;

  perform set_config('talaie.audit_reason', coalesce(p_reason, ''), true);

  if p_delete_tickets then
    delete from public.tickets where data->>'projectId' = p_id;
  end if;

  delete from public.projects where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_project(text, text, boolean) from anon, public;
grant execute on function public.admin_delete_project(text, text, boolean) to authenticated;

-- ۴. حذف تیکت‌ها و عکس‌ها توسط مدیر QC
drop policy if exists "QC Managers delete tickets" on public.tickets;
create policy "QC Managers delete tickets"
  on public.tickets for delete to authenticated
  using (public.is_qc_manager());

drop policy if exists "QC Managers delete photos" on storage.objects;
create policy "QC Managers delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'talaie-photos' and public.is_qc_manager());
