-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۰۶: لایه امنیت و گارد نقش‌ها (Role Guards)
-- این مایگریشن محدودیت‌های سطح دسترسی نقش‌های QC_MANAGER و TECHNICIAN/LEAD_TECHNICIAN
-- را روی جدول‌های پروژه‌ها (projects)، تابع به‌روزرسانی (patch_project) و تیکت‌ها (tickets) اعمال می‌کند.
-- ==============================================================================

-- ۱. بازنویسی و ارتقای تابع امنیتی patch_project با گاردهای سخت‌گیرانه نقش‌ها
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
  -- بررسی کاربر فعال
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  -- دریافت وضعیت فعلی پروژه
  select data into current_data
  from public.projects
  where public.projects.id = patch_project.id;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- بررسی نقش کاربر: در صورتی که کاربر مدیر QC نباشد، اعمال محدودیت‌های سخت‌گیرانه
  if not public.is_qc_manager() then

    -- الف) بررسی تخصیص پروژه به تکنسین / سرپرست
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
        'customerSignature', 'customerSatisfaction', 'customerSurvey', 'stuckIncidents',
        'updatedAt', 'qcStatus'
      ) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
      end if;
    end loop;

    -- ج) بررسی وضعیت QC: تکنسین فقط می‌تواند qcStatus را PENDING کند و آن هم فقط همراه با status = COMPLETED
    if patch ? 'qcStatus' then
      if patch->>'qcStatus' != 'PENDING' then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
      end if;
      if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
        raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
      end if;
    end if;

    -- د) بررسی مسیرهای مجاز انتقال وضعیت (State Machine Transitions)
    if patch ? 'status' and patch->>'status' is distinct from current_data->>'status' then
      declare
        curr_st text := current_data->>'status';
        new_st text := patch->>'status';
      begin
        if not (
          (curr_st = 'SCHEDULED' and new_st = 'EN_ROUTE') or
          (curr_st = 'EN_ROUTE' and new_st = 'IN_PROGRESS') or
          (curr_st = 'IN_PROGRESS' and new_st = 'COMPLETED') or
          (curr_st in ('EN_ROUTE', 'IN_PROGRESS') and new_st = 'STUCK')
        ) then
          raise exception 'انتقال وضعیت از «%» به «%» برای تکنسین مجاز نیست.', coalesce(curr_st, 'نامشخص'), new_st;
        end if;
      end;
    end if;

  end if;

  -- به‌روزرسانی نهایی پروژه
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

-- ۲. محدود کردن سیاست‌های مستقیم جدول پروژه‌ها (projects)
-- خواندن: تمامی پرسنل فعال
-- ایجاد، به‌روزرسانی مستقیم و حذف: منحصراً مدیر QC (تکنسین‌ها تنها از طریق patch_project تغییر می‌دهند)
drop policy if exists "Active users insert projects" on public.projects;
drop policy if exists "Active users update projects" on public.projects;
drop policy if exists "QC Managers insert projects" on public.projects;
drop policy if exists "QC Managers update projects" on public.projects;
drop policy if exists "QC Managers delete projects" on public.projects;

create policy "QC Managers insert projects"
  on public.projects for insert
  to authenticated
  with check (public.is_qc_manager());

create policy "QC Managers update projects"
  on public.projects for update
  to authenticated
  using (public.is_qc_manager())
  with check (public.is_qc_manager());

create policy "QC Managers delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_qc_manager());

-- ۳. سیاست‌های جدول تیکت‌ها (tickets)
-- تکنسین فقط روی پروژه خودش می‌تواند تیکت باز کند و اجازه تغییر وضعیت تیکت به RESOLVED را ندارد
drop policy if exists "Active users insert tickets" on public.tickets;
drop policy if exists "Active users update tickets" on public.tickets;
drop policy if exists "Authorized users insert tickets" on public.tickets;
drop policy if exists "Authorized users update tickets" on public.tickets;

create policy "Authorized users insert tickets"
  on public.tickets for insert
  to authenticated
  with check (
    public.is_qc_manager() or (
      public.is_active_user() and
      (data->>'status' is distinct from 'RESOLVED') and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  );

create policy "Authorized users update tickets"
  on public.tickets for update
  to authenticated
  using (
    public.is_qc_manager() or (
      public.is_active_user() and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  )
  with check (
    public.is_qc_manager() or (
      public.is_active_user() and
      (data->>'status' is distinct from 'RESOLVED') and
      exists (
        select 1 from public.projects p
        where p.id = tickets.data->>'projectId'
          and (
            p.data->>'leadTechnicianId' = auth.uid()::text or
            p.data->'assignedTechnicianIds' ? auth.uid()::text
          )
      )
    )
  );
