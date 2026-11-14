-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۴: جدول و توابع امنیتی درخواست متریال و لجستیک (P2.3)
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

-- ۳. تابع کنترل‌شده پچ درخواست متریال (patch_material_request)
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
  v_user_role text;
  v_project jsonb;
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

  select role into v_user_role
  from public.profiles
  where public.profiles.id = auth.uid();

  -- دریافت پروژه مرتبط جهت کنترل دسترسی تکنسین
  select data into v_project
  from public.projects
  where public.projects.id = v_current.project_id;

  -- اعتبارسنجی دسترسی تکنسین
  if not public.is_coordinator_or_manager() then
    if v_project is null or not public.can_access_project(v_project) then
      raise exception 'دسترسی غیرمجاز: شما به این پروژه دسترسی ندارید.';
    end if;

    -- تکنسین فقط مجاز به تایید دریافت فیزیکی اقلام دیسپچ‌شده است
    if patch ? 'status' and patch->>'status' in ('REJECTED', 'CANCELLED', 'IN_PROCUREMENT') then
      raise exception 'دسترسی غیرمجاز: تکنسین امکان تغییر وضعیت به «%» را ندارد.', patch->>'status';
    end if;
  end if;

  -- ادغام داده‌ها
  v_updated_data := v_current.data || patch;
  v_new_status := coalesce(v_updated_data->>'status', v_current.status);

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
