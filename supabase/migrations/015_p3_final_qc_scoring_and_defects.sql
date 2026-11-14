-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۵: کنترل کیفیت نهایی، مدیریت عیوب و امضای تحویل (P3)
-- فایل: supabase/migrations/015_p3_final_qc_scoring_and_defects.sql
-- فاز: P3 Final Quality Control & Sign-off
-- ==============================================================================

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
  v_defect jsonb;
  v_defects jsonb;
  v_curr_defects jsonb;
  v_has_critical_defect boolean := false;
  v_inspections_count int;
  v_curr_inspections_count int;
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

  -- ممانعت از جعل دستی پرچم سوابق تاریخی
  if patch ? 'technicalHandover' and (patch->'technicalHandover' ? 'isHistoricalMigration') then
    raise exception 'دسترسی غیرمجاز: امکان تغییر یا انتساب دستی پرچم سوابق تاریخی وجود ندارد.';
  end if;

  select role, team_id into v_user_role, v_user_team_id
  from public.profiles
  where public.profiles.id = auth.uid();

  v_current_status := current_data->>'status';
  v_new_status := coalesce(patch->>'status', v_current_status);

  -- ============================================================================
  -- ۱. گیت مسدودسازی انتقال اکیپ (P2.2 Execution Gate)
  -- ============================================================================
  if current_data ? 'teamTransfers' and jsonb_array_length(current_data->'teamTransfers') > 0 then
    v_transfers_count := jsonb_array_length(current_data->'teamTransfers');
    v_latest_transfer := current_data->'teamTransfers'->(v_transfers_count - 1);

    if not (
      coalesce((v_latest_transfer->>'receivingLeadConfirmed')::boolean, false) = true or
      (
        coalesce((v_latest_transfer->>'isManagerOverride')::boolean, false) = true and
        coalesce(v_latest_transfer->>'managerOverrideRole', '') = 'QC_MANAGER' and
        coalesce(v_latest_transfer->>'managerOverrideByUserId', '') != '' and
        coalesce(trim(v_latest_transfer->>'managerOverrideReason'), '') != ''
      )
    ) then
      if v_new_status in ('EN_ROUTE', 'IN_PROGRESS') and v_new_status is distinct from v_current_status then
        raise exception 'شروع یا ادامه کار مسدود است: پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ جدید یا رفع انسداد توسط مدیر QC است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ۲. محافظت از عدم انطباق‌های بحرانی و گیت تایید نهایی QC (P3 Approval Gate)
  -- ============================================================================
  if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
    if not public.is_qc_manager() then
      if v_user_role in ('TECHNICIAN', 'LEAD_TECHNICIAN') then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.';
      else
        raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
      end if;
    end if;

    -- بررسی عیوب بحرانی
    v_defects := coalesce(patch->'qcDefects', current_data->'qcDefects', '[]'::jsonb);
    for v_defect in select * from jsonb_array_elements(v_defects) loop
      if v_defect->>'severity' = 'CRITICAL' and v_defect->>'status' not in ('RESOLVED', 'VERIFIED') then
        v_has_critical_defect := true;
        exit;
      end if;
    end loop;

    if v_has_critical_defect then
      raise exception 'امکان صدور تأیید نهایی QC وجود ندارد: پروژه دارای عدم‌انطباق یا نقص بحرانی (CRITICAL) حل‌نشده است.';
    end if;
  end if;

  -- ============================================================================
  -- ۳. حفاظت از تغییرناپذیری تاریخچه بازرسی‌ها (Immutability of qcInspections)
  -- ============================================================================
  if patch ? 'qcInspections' then
    v_curr_inspections_count := coalesce(jsonb_array_length(current_data->'qcInspections'), 0);
    v_inspections_count := jsonb_array_length(patch->'qcInspections');
    if v_inspections_count < v_curr_inspections_count then
      raise exception 'دسترسی غیرمجاز: حذف یا کاهش سوابق بازرسی‌های کیفی مجاز نیست.';
    end if;
  end if;

  -- ============================================================================
  -- ۴. محدودیت‌های تکنسین‌ها و سرپرستان اکیپ
  -- ============================================================================
  if not public.is_coordinator_or_manager() then
    if not public.can_access_project(current_data) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- کلیدهای مجاز پچ برای تکنسین
    for patch_key in select jsonb_object_keys(patch) loop
      if patch_key not in (
        'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
        'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
        'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
        'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
        'workSessions', 'dailyLogs', 'siteReadiness', 'planAmendments',
        'isExceptionalCompletion', 'exceptionalCompletionDetails',
        'teamTransfers', 'qcDefects', 'customerAcceptance',
        'handoverSigneeType', 'representativeName', 'representativeRole',
        'representativePhone', 'unavailabilityReason', 'unavailabilityPhotos'
      ) then
        raise exception 'دسترسی غیرمجاز: تکنسین اجازه تغییر فیلد «%» را ندارد.', patch_key;
      end if;
    end loop;

    -- حفاظت از وضعیت عیوب کیفی
    if patch ? 'qcDefects' then
      v_curr_defects := coalesce(current_data->'qcDefects', '[]'::jsonb);
      v_defects := patch->'qcDefects';

      if jsonb_array_length(v_defects) < jsonb_array_length(v_curr_defects) then
        raise exception 'دسترسی غیرمجاز: حذف عیوب کیفی ثبت‌شده مجاز نیست.';
      end if;

      for v_defect in select * from jsonb_array_elements(v_defects) loop
        if v_defect->>'status' = 'VERIFIED' then
          raise exception 'دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.';
        end if;
      end loop;
    end if;

    -- پذیرش کارفرما
    if patch ? 'customerAcceptance' then
      if patch->'customerAcceptance'->>'status' = 'UNAVAILABLE' and
         coalesce(trim(patch->'customerAcceptance'->>'unavailabilityReason'), '') = '' then
        raise exception 'در صورت عدم حضور کارفرما، ثبت دلیل مستند عدم امکان اخذ امضا الزامی است.';
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
