-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۴: جدول و توابع امنیتی درخواست متریال و لجستیک (P2.3 Hardened)
-- فایل: supabase/migrations/014_p2_3_material_requests.sql
-- فاز: P2.3 Material Operations
-- ==============================================================================

-- ۱. ایجاد جدول درخواست‌های متریال
create table if not exists public.material_requests (
  id text primary key,
  project_id text not null,
  data jsonb not null,
  status text not null default 'SUBMITTED',
  urgency text not null default 'NORMAL',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.material_requests enable row level security;

-- ایندکس‌ها جهت تسریع جستجو و مانیتورینگ
create index if not exists idx_material_requests_project_id on public.material_requests(project_id);
create index if not exists idx_material_requests_status on public.material_requests(status);
create index if not exists idx_material_requests_created_by on public.material_requests(created_by);
create index if not exists idx_material_requests_updated_at on public.material_requests(updated_at desc);

-- ۲. سیاست‌های RLS
revoke all on public.material_requests from anon;

drop policy if exists "Authenticated active users can read material requests" on public.material_requests;
create policy "Authenticated active users can read material requests"
  on public.material_requests for select to authenticated
  using (public.is_active_user());

drop policy if exists "Authenticated users can insert material requests" on public.material_requests;
create policy "Authenticated users can insert material requests"
  on public.material_requests for insert to authenticated
  with check (
    public.is_active_user() and (
      public.is_coordinator_or_manager() or
      created_by = auth.uid()
    )
  );

drop policy if exists "QC Managers can delete material requests" on public.material_requests;
create policy "QC Managers can delete material requests"
  on public.material_requests for delete to authenticated
  using (public.is_qc_manager());

-- ۳. تابع کنترل‌شده ایجاد درخواست متریال (create_material_request) - اتمیک، ایمن در برابر همزمانی و تعارض شناسه
create or replace function public.create_material_request(id text, request_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing record;
  v_project jsonb;
  v_req_project_id text := request_data->>'projectId';
begin
  -- الف) احراز هویت و فعال بودن کاربر
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(request_data) is distinct from 'object' then
    raise exception 'Request data must be a valid JSON object';
  end if;

  if v_req_project_id is null or trim(v_req_project_id) = '' then
    raise exception 'شناسه پروژه در درخواست متریال الزامی است.';
  end if;

  -- ب) دریافت پروژه و بررسی دسترسی کاربر
  select data into v_project
  from public.projects
  where public.projects.id = v_req_project_id;

  if v_project is null then
    raise exception 'پروژه مرتبط با این درخواست یافت نشد: %', v_req_project_id;
  end if;

  if not public.is_coordinator_or_manager() then
    if not public.can_access_project(v_project) then
      raise exception 'دسترسی غیرمجاز: شما به این پروژه دسترسی ندارید.';
    end if;

    if coalesce(request_data->>'status', 'SUBMITTED') != 'SUBMITTED' then
      raise exception 'دسترسی غیرمجاز: درخواست جدید توسط تکنسین فقط با وضعیت SUBMITTED قابل ثبت است.';
    end if;

    if request_data ? 'dispatches' and jsonb_array_length(request_data->'dispatches') > 0 then
      raise exception 'دسترسی غیرمجاز: ثبت مشخصات ارسال در زمان ایجاد درخواست در صلاحیت تکنسین نیست.';
    end if;

    if (request_data->>'requestedByUserId') is distinct from auth.uid()::text then
      raise exception 'دسترسی غیرمجاز: ثبت درخواست متریال فقط با هویت خودتان مجاز است.';
    end if;
  end if;

  -- ج) درج اتمیک در جدول؛ در صورت تکرار یا همزمانی شناسه، خطای 23505 با رفتار ایدمپوتنت مدیریت می‌شود
  begin
    insert into public.material_requests (
      id,
      project_id,
      data,
      status,
      urgency,
      created_by,
      created_at,
      updated_at
    ) values (
      create_material_request.id,
      v_req_project_id,
      request_data,
      coalesce(request_data->>'status', 'SUBMITTED'),
      coalesce(request_data->>'urgency', 'NORMAL'),
      auth.uid(),
      coalesce((request_data->>'requestedAt')::timestamptz, now()),
      now()
    );

    return request_data;
  exception
    when unique_violation then
      -- در صورت برخورد همزمانی یا تکرار مجاز شناسه در صف آفلاین
      select * into v_existing
      from public.material_requests
      where public.material_requests.id = create_material_request.id;

      if not found then
        raise exception 'خطای غیرمنتظره در ثبت همزمان درخواست متریال.';
      end if;

      -- ممانعت از افشا یا استفاده از شناسه پروژه/کاربر دیگر (Conflicting ID Reuse Prevention)
      if v_existing.project_id is distinct from v_req_project_id then
        raise exception 'تعارض شناسه: این شناسه درخواست قبلاً برای پروژه دیگری ثبت گردیده است.';
      end if;

      if not public.is_coordinator_or_manager() and v_existing.created_by is distinct from auth.uid() then
        raise exception 'تعارض شناسه: این شناسه متعلق به درخواست کاربر دیگری است.';
      end if;

      return v_existing.data;
  end;
end;
$$;

revoke execute on function public.create_material_request(text, jsonb) from anon, public;
grant execute on function public.create_material_request(text, jsonb) to authenticated;

-- ۴. تابع کنترل‌شده پچ درخواست متریال (patch_material_request) - لیست سفید سخت‌گیرانه برای تکنسین
create or replace function public.patch_material_request(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current record;
  v_updated_data jsonb;
  v_new_status text;
  v_project jsonb;
  patch_key text;
  v_old_dispatches jsonb;
  v_new_dispatches jsonb;
  v_old_d jsonb;
  v_new_d jsonb;
  i int;
  j int;
  d_found boolean;
  v_all_dispatches_confirmed boolean := true;
  v_history jsonb;
  v_receipt_event jsonb;
  v_user_name text;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  select * into v_current
  from public.material_requests
  where public.material_requests.id = patch_material_request.id
  for update;

  if not found then
    raise exception 'درخواست متریال مورد نظر یافت نشد: %', patch_material_request.id;
  end if;

  -- دریافت پروژه مرتبط جهت کنترل دسترسی تکنسین
  select data into v_project
  from public.projects
  where public.projects.id = v_current.project_id;

  -- اعتبارسنجی سطح دسترسی و لیست سفید تکنسین
  if not public.is_coordinator_or_manager() then
    if v_project is null or not public.can_access_project(v_project) then
      raise exception 'دسترسی غیرمجاز: شما به این پروژه دسترسی ندارید.';
    end if;

    -- الف) لیست سفید سخت‌گیرانه فیلدهای مجاز تکنسین (Strict Key Whitelist)
    -- تکنسین به هیچ وجه اجازه تغییر اقلام درخواستی (items)، پروژه، متادیتا، تاریخچه (history) یا فوریت را ندارد
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in ('status', 'dispatches', 'updatedAt') then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه ویرایش فیلد «%» را در درخواست متریال ندارد.', patch_key;
      end if;
    end loop;

    -- ب) حفاظت از سوابق ارسال (dispatches): تکنسین فقط می‌تواند فیلد تایید دریافت کارگاه را علامت بزند
    if patch ? 'dispatches' then
      if jsonb_typeof(patch->'dispatches') is distinct from 'array' then
        raise exception 'دسترسی غیرمجاز: مشخصات ارسال باید آرایه معتبر باشد.';
      end if;

      v_old_dispatches := coalesce(v_current.data->'dispatches', '[]'::jsonb);
      v_new_dispatches := patch->'dispatches';

      -- تعداد محموله‌های ارسالی نباید توسط تکنسین کم یا زیاد شود
      if jsonb_array_length(v_new_dispatches) != jsonb_array_length(v_old_dispatches) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه افزودن یا حذف محموله‌های ارسالی را ندارد.';
      end if;

      -- بررسی تک‌تک محموله‌ها
      for i in 0 .. (jsonb_array_length(v_old_dispatches) - 1) loop
        v_old_d := v_old_dispatches->i;
        d_found := false;

        for j in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
          v_new_d := v_new_dispatches->j;
          if v_new_d->>'id' = v_old_d->>'id' then
            d_found := true;

            -- مشخصات بارنامه، پیک، اقلام ارسالی و فرستنده نباید تغییر کند
            if (v_new_d->>'courierInfo') is distinct from (v_old_d->>'courierInfo') or
               (v_new_d->>'trackingCode') is distinct from (v_old_d->>'trackingCode') or
               (v_new_d->>'dispatchedByUserId') is distinct from (v_old_d->>'dispatchedByUserId') or
               (v_new_d->>'dispatchedAt') is distinct from (v_old_d->>'dispatchedAt') or
               (v_new_d->'items') is distinct from (v_old_d->'items') then
              raise exception 'دسترسی غیرمجاز: مشخصات محموله ارسالی توسط تکنسین قابل تغییر نیست.';
            end if;

            -- تکنسین اجازه ثبت manager override در محموله را ندارد
            if (v_new_d->>'isManagementOverride')::boolean = true then
              raise exception 'دسترسی غیرمجاز: ثبت مجوز مدیریتی منحصراً در صلاحیت مدیر ارشد است.';
            end if;

            -- اگر محموله قبلاً تایید شده، نباید تغییر وضعیت دهد
            if (v_old_d->>'receivedAtSiteConfirmed')::boolean = true and
               (v_new_d->>'receivedAtSiteConfirmed')::boolean != true then
              raise exception 'دسترسی غیرمجاز: وضعیت تحویل تاییدشده قبلی قابل بازگشت نیست.';
            end if;

            -- اگر تایید تحویل در این پچ اضافه شده است، هویت ثبت‌کننده باید مطابق با خود تکنسین باشد
            if (v_new_d->>'receivedAtSiteConfirmed')::boolean = true and
               coalesce((v_old_d->>'receivedAtSiteConfirmed')::boolean, false) = false then
              if (v_new_d->>'receivedAtSiteConfirmedByUserId') is distinct from auth.uid()::text then
                raise exception 'دسترسی غیرمجاز: تایید تحویل فقط با هویت خودتان مجاز است.';
              end if;
            end if;

            exit;
          end if;
        end loop;

        if not d_found then
          raise exception 'دسترسی غیرمجاز: دستکاری یا جایگزینی شناسه‌های محموله مجاز نیست.';
        end if;
      end loop;
    end if;

    -- ج) اعتبارسنجی تغییر وضعیت (status): تکنسین فقط مجاز به تایید تحویل کامل است
    if patch ? 'status' then
      if patch->>'status' in ('DISPATCHED', 'PARTIALLY_DISPATCHED', 'IN_PROCUREMENT', 'REJECTED', 'CANCELLED', 'SUBMITTED') then
        raise exception 'دسترسی غیرمجاز: تکنسین امکان تغییر وضعیت به «%» را ندارد.', patch->>'status';
      end if;

      if patch->>'status' = 'DELIVERED_CONFIRMED' then
        if v_current.status not in ('DISPATCHED', 'PARTIALLY_DISPATCHED') then
          raise exception 'دسترسی غیرمجاز: تایید تحویل فقط برای درخواست‌هایی که حداقل بخشی از اقلام آن‌ها ارسال شده است مجاز می‌باشد.';
        end if;

        -- بررسی اینکه آیا تمام محموله‌ها تایید دریافت شده‌اند یا خیر
        v_new_dispatches := coalesce(patch->'dispatches', v_current.data->'dispatches', '[]'::jsonb);
        if jsonb_array_length(v_new_dispatches) = 0 then
          raise exception 'دسترسی غیرمجاز: این درخواست فاقد محموله ارسالی است.';
        end if;

        for i in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
          if coalesce((v_new_dispatches->i->>'receivedAtSiteConfirmed')::boolean, false) != true then
            v_all_dispatches_confirmed := false;
            exit;
          end if;
        end loop;

        if not v_all_dispatches_confirmed then
          raise exception 'امکان ثبت تحویل قطعی وجود ندارد: هنوز برخی محموله‌های ارسالی سر کارگاه تایید دریافت نشده‌اند.';
        end if;
      else
        raise exception 'دسترسی غیرمجاز: تغییر وضعیت درخواستی برای تکنسین مجاز نیست.';
      end if;
    end if;
  end if;

  -- اعمال ادغام داده‌ها
  v_updated_data := v_current.data || patch;
  v_new_status := coalesce(v_updated_data->>'status', v_current.status);

  -- د) ثبت ماندگار رویداد تایید تحویل در تاریخچه توسط سرور (Durable Server-Side Receipt History)
  -- تکنسین اجازه ارسال یا بازنویسی history را ندارد؛ سرور رویداد را بر اساس هویت احرازشده تولید و ضمیمه می‌کند
  if patch ? 'dispatches' then
    v_old_dispatches := coalesce(v_current.data->'dispatches', '[]'::jsonb);
    v_new_dispatches := patch->'dispatches';
    v_history := coalesce(v_updated_data->'history', '[]'::jsonb);

    if jsonb_typeof(v_new_dispatches) = 'array' then
      for j in 0 .. (jsonb_array_length(v_new_dispatches) - 1) loop
        v_new_d := v_new_dispatches->j;
        v_old_d := null;

        for i in 0 .. (jsonb_array_length(v_old_dispatches) - 1) loop
          if v_old_dispatches->i->>'id' = v_new_d->>'id' then
            v_old_d := v_old_dispatches->i;
            exit;
          end if;
        end loop;

        -- اگر وضعیت این محموله در پچ جاری به «تایید شده» تغییر یافته است
        if (v_new_d->>'receivedAtSiteConfirmed')::boolean = true and
           coalesce((v_old_d->>'receivedAtSiteConfirmed')::boolean, false) = false then

          -- دریافت نام کاربر احرازشده از جدول profiles (بدون اتکا به فیلدهای کلاینت)
          select full_name into v_user_name
          from public.profiles
          where public.profiles.id = auth.uid();

          v_receipt_event := jsonb_build_object(
            'id', 'mat-act-' || (v_new_d->>'id') || '-recv',
            'timestamp', coalesce(v_new_d->>'receivedAtSiteConfirmedAt', now()::text),
            'serverRecordedAt', now()::text,
            'action', 'CONFIRMED_RECEIPT',
            'byUserId', auth.uid()::text,
            'byUserName', coalesce(nullif(trim(v_user_name), ''), 'کاربر احرازشده'),
            'note', 'تایید دریافت محموله پیک «' || coalesce(v_new_d->>'courierInfo', v_old_d->>'courierInfo', '') || '» سر کارگاه توسط ' || coalesce(nullif(trim(v_user_name), ''), 'کاربر احرازشده')
          );

          -- اطمینان از ایدمپوتنت بودن و عدم ایجاد لاگ تکراری در صورت Replay یا Retry صف آفلاین
          if not exists (
            select 1
            from jsonb_array_elements(v_history) elem
            where elem->>'id' = ('mat-act-' || (v_new_d->>'id') || '-recv')
          ) then
            v_history := v_history || jsonb_build_array(v_receipt_event);
          end if;
        end if;
      end loop;

      v_updated_data := jsonb_set(v_updated_data, '{history}', v_history);
    end if;
  end if;

  update public.material_requests
  set
    data = v_updated_data,
    status = v_new_status,
    urgency = coalesce(v_updated_data->>'urgency', v_current.urgency),
    updated_at = now()
  where public.material_requests.id = patch_material_request.id;

  return v_updated_data;
end;
$$;

revoke execute on function public.patch_material_request(text, jsonb) from anon, public;
grant execute on function public.patch_material_request(text, jsonb) to authenticated;
