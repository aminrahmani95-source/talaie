-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۳: امنیت انتقال اکیپ و گیت اجرایی سرپرست تحویل‌گیرنده
-- فایل: supabase/migrations/013_p2_2_team_transfers.sql
-- فاز: P2.2 Hardening
-- ==============================================================================

-- ۱. به‌روزرسانی تابع اصلی patch_project با اعمال قوانین دسترسی انتقال اکیپ
create or replace function public.patch_project(id text, patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_data jsonb;
  current_data jsonb;
  patch_key text;
  v_user_role text;
  v_user_team_id text;
  v_current_status text;
  v_new_status text;
  v_latest_transfer jsonb;
  v_transfers_count int;
  v_curr_transfers_count int;
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
  where public.projects.id = patch_project.id
  for update;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد: %', patch_project.id;
  end if;

  -- ممانعت از جعل یا دستکاری دستی پرچم سوابق تاریخی
  if patch ? 'technicalHandover' and (patch->'technicalHandover' ? 'isHistoricalMigration') then
    raise exception 'دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.';
  end if;

  -- دریافت مشخصات کاربر جاری
  select role, team_id into v_user_role, v_user_team_id
  from public.profiles
  where public.profiles.id = auth.uid();

  v_current_status := current_data->>'status';
  v_new_status := coalesce(patch->>'status', v_current_status);

  -- ============================================================================
  -- الف) گیت مسدودسازی اجرای پروژه در صورت انتقال حل‌نشده (P2.2 Execution Gate)
  -- ============================================================================
  if current_data ? 'teamTransfers' and jsonb_array_length(current_data->'teamTransfers') > 0 then
    v_transfers_count := jsonb_array_length(current_data->'teamTransfers');
    v_latest_transfer := current_data->'teamTransfers'->(v_transfers_count - 1);

    -- بررسی اینکه آیا آخرین انتقال حل شده است یا خیر
    -- (حل شده = تایید رسمی سرپرست جدید یا رفع انسداد قانونی با امضای مدیر QC)
    if not (
      coalesce((v_latest_transfer->>'receivingLeadConfirmed')::boolean, false) = true or
      (
        coalesce((v_latest_transfer->>'isManagerOverride')::boolean, false) = true and
        coalesce(v_latest_transfer->>'managerOverrideRole', '') = 'QC_MANAGER' and
        coalesce(v_latest_transfer->>'managerOverrideByUserId', '') != '' and
        coalesce(trim(v_latest_transfer->>'managerOverrideReason'), '') != ''
      )
    ) then
      -- در صورت انتقال باز و حل‌نشده، شروع یا ادامه کار ممنوع است
      if v_new_status in ('EN_ROUTE', 'IN_PROGRESS') and v_new_status is distinct from v_current_status then
        raise exception 'شروع یا ادامه کار مسدود است: پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ جدید یا رفع انسداد توسط مدیر QC است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ب) اعتبارسنجی تغییرات در آرایه teamTransfers
  -- ============================================================================
  if patch ? 'teamTransfers' then
    v_curr_transfers_count := coalesce(jsonb_array_length(current_data->'teamTransfers'), 0);
    v_transfers_count := jsonb_array_length(patch->'teamTransfers');

    -- تاریخچه انتقال هرگز نباید کاهش یافته یا حذف شود
    if v_transfers_count < v_curr_transfers_count then
      raise exception 'دسترسی غیرمجاز: حذف سوابق انتقال اکیپ مجاز نیست.';
    end if;

    -- اگر کاربر تکنسین است، بررسی صلاحیت تایید تحویل
    if not public.is_qc_manager() then
      if v_transfers_count > v_curr_transfers_count then
        raise exception 'دسترسی غیرمجاز: ثبت انتقال جدید فقط در صلاحیت مدیر QC است.';
      end if;

      v_latest_transfer := patch->'teamTransfers'->(v_transfers_count - 1);

      -- اگر فیلد تایید سرپرست تغییر کرده است:
      if (v_latest_transfer->>'receivingLeadConfirmed')::boolean = true and
         coalesce((current_data->'teamTransfers'->(v_curr_transfers_count - 1)->>'receivingLeadConfirmed')::boolean, false) = false then
        
        -- بررسی دقیق هویت سرپرست تحویل‌گیرنده
        if auth.uid()::text != current_data->>'leadTechnicianId' or
           v_user_role != 'LEAD_TECHNICIAN' or
           v_user_team_id is distinct from (v_latest_transfer->>'toTeamId') then
          raise exception 'دسترسی غیرمجاز: تایید صورت‌جلسه تحویل کار منحصراً در صلاحیت سرپرست رسمی اکیپ مقصد است.';
        end if;
      end if;

      -- تکنسین هرگز حق ثبت manager override ندارد
      if (v_latest_transfer->>'isManagerOverride')::boolean = true then
        raise exception 'دسترسی غیرمجاز: ثبت رفع انسداد مدیریتی منحصراً در صلاحیت مدیر QC است.';
      end if;
    end if;
  end if;

  -- اعمال ادغام پچ
  updated_data := current_data || patch;

  update public.projects
  set
    data = updated_data,
    updated_at = now()
  where public.projects.id = patch_project.id;

  return updated_data;
end;
$$;
