-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۵: کنترل کیفیت نهایی، مدیریت عیوب، امضای تحویل و تابع یکپارچه پچ پروژه (P3 Final Unified)
-- فایل: supabase/migrations/015_p3_final_qc_scoring_and_defects.sql
-- فاز: P3 Final Quality Control & Sign-off + Unified Enterprise Safeguards
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
  merged_data jsonb;
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
  prod_confirmed boolean;
  wh_confirmed boolean;
  is_scheduling boolean := false;
  v_team_id uuid;
  v_sched_date text;
  v_end_date text;
  v_sched_time text;
  v_duration numeric;
begin
  -- ۱. بررسی فعال بودن کاربر
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'Patch must be a valid JSON object';
  end if;

  -- ممانعت از ارسال تصاویر خام base64 در پچ
  if patch::text like '%"data:image/%' then
    raise exception 'Patch cannot contain base64 data URLs';
  end if;

  -- ذخیره دلیل ممیزی در تنظیمات محلی تراکنش
  if patch ? '_auditReason' then
    perform set_config('talaie.audit_reason', patch->>'_auditReason', true);
    patch := patch - '_auditReason';
  end if;

  -- قفل ردیف با FOR UPDATE
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
  merged_data := current_data || patch;

  -- ============================================================================
  -- ۲. محافظت از طرح اولیه نصب (P2.1 Original Plan Immutability Guard)
  -- ============================================================================
  if patch ? 'originalPlan' then
    if (current_data ? 'originalPlan' and (
         (current_data->'originalPlan' ? 'lockedAt' and current_data->'originalPlan'->>'lockedAt' is not null) or
         (current_data->>'status') != 'MEASUREMENT_PENDING'
       )) then
      raise exception 'دسترسی غیرمجاز: طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است. برای هرگونه اصلاح در مقادیر، باید از فرآیند رسمی بازنگری طرح (Plan Amendment) استفاده شود.';
    end if;
    if not public.is_qc_manager() then
      raise exception 'دسترسی غیرمجاز: تعریف طرح اولیه فقط در صلاحیت مدیر QC است.';
    end if;
  end if;

  -- ============================================================================
  -- ۳. محافظت از بازنگری‌های طرح (P2.1 Plan Amendments Lifecycle & Stale Concurrency)
  -- ============================================================================
  if patch ? 'planAmendments' then
    if jsonb_typeof(patch->'planAmendments') is distinct from 'array' then
      raise exception 'دسترسی غیرمجاز: لیست بازنگری‌های طرح باید آرایه معتبر باشد.';
    end if;

    declare
      existing_amends jsonb := coalesce(current_data->'planAmendments', '[]'::jsonb);
      new_amends jsonb := patch->'planAmendments';
      old_item jsonb;
      matched_new_item jsonb;
      new_item jsonb;
      j int;
      k int;
      found_in_new boolean;
      found_in_old boolean;
      old_status text;
      new_status text;
    begin
      -- الف) صیانت از تاریخچه: هیچ اصلاحیه نهایی‌شده‌ای قابل حذف نیست
      for j in 0 .. (jsonb_array_length(existing_amends) - 1) loop
        old_item := existing_amends->j;
        old_status := old_item->>'status';

        found_in_new := false;
        for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
          matched_new_item := new_amends->k;
          if matched_new_item->>'id' = old_item->>'id' then
            found_in_new := true;
            exit;
          end if;
        end loop;

        if not found_in_new and old_status in ('APPROVED', 'REJECTED') then
          raise exception 'دسترسی غیرمجاز: حذف سوابق اصلاحیه‌های نهایی‌شده طرح امکان‌پذیر نیست.';
        end if;

        -- ب) صیانت از تغییرناپذیری مقادیر اصلاحیه‌های تاییدشده قبلی
        if found_in_new and old_status = 'APPROVED' then
          if (matched_new_item->>'status') != 'APPROVED' then
            raise exception 'دسترسی غیرمجاز: وضعیت اصلاحیه تاییدشده قابل بازگشت نیست.';
          end if;
          if (matched_new_item->>'activityId') is distinct from (old_item->>'activityId') or
             ((matched_new_item->>'previousQuantity')::numeric) is distinct from ((old_item->>'previousQuantity')::numeric) or
             ((matched_new_item->>'newQuantity')::numeric) is distinct from ((old_item->>'newQuantity')::numeric) or
             (matched_new_item->>'reason') is distinct from (old_item->>'reason') or
             (matched_new_item->>'requestedByUserId') is distinct from (old_item->>'requestedByUserId') or
             (matched_new_item->>'requestedAt') is distinct from (old_item->>'requestedAt') or
             (matched_new_item->>'reviewedByUserId') is distinct from (old_item->>'reviewedByUserId') or
             (matched_new_item->>'reviewedAt') is distinct from (old_item->>'reviewedAt') then
            raise exception 'دسترسی غیرمجاز: اصلاحیه تاییدشده قبلی غیرقابل تغییر است. برای هرگونه تغییر در مقادیر، اصلاحیه جدید ثبت کنید.';
          end if;
        end if;

        -- ج) اصلاحیه ردشده نیز نمی‌تواند دستخوش تغییر یا بازگشت وضعیت شود
        if found_in_new and old_status = 'REJECTED' then
          if (matched_new_item->>'status') != 'REJECTED' then
            raise exception 'دسترسی غیرمجاز: اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست. برای بازنگری باید اصلاحیه جدید ثبت شود.';
          end if;
        end if;
      end loop;

      -- د) فقط مدیر QC مجاز به تایید بازنگری است (تغییر وضعیت به APPROVED)
      for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
        new_item := new_amends->k;
        new_status := new_item->>'status';

        if new_status = 'APPROVED' then
          found_in_old := false;
          for j in 0 .. (jsonb_array_length(existing_amends) - 1) loop
            old_item := existing_amends->j;
            if old_item->>'id' = new_item->>'id' and old_item->>'status' = 'APPROVED' then
              found_in_old := true;
              exit;
            end if;
          end loop;

          if not found_in_old then
            if not public.is_qc_manager() then
              raise exception 'دسترسی غیرمجاز: تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است.';
            end if;

            -- اعتبارسنجی همزمانی و عدم تایید اصلاحیه منقضی‌شده (Stale Concurrency Check)
            declare
              v_act_id text := new_item->>'activityId';
              v_current_effective numeric := null;
              v_cand_amend jsonb;
              m int;
              v_plan_acts jsonb := current_data->'originalPlan'->'activities';
              v_act_item jsonb;
            begin
              for m in 0 .. (jsonb_array_length(existing_amends) - 1) loop
                v_cand_amend := existing_amends->m;
                if v_cand_amend->>'activityId' = v_act_id and v_cand_amend->>'status' = 'APPROVED' then
                  v_current_effective := (v_cand_amend->>'newQuantity')::numeric;
                end if;
              end loop;

              if v_current_effective is null and v_plan_acts is not null and jsonb_typeof(v_plan_acts) = 'array' then
                for m in 0 .. (jsonb_array_length(v_plan_acts) - 1) loop
                  v_act_item := v_plan_acts->m;
                  if v_act_item->>'id' = v_act_id then
                    v_current_effective := (v_act_item->>'plannedQuantity')::numeric;
                    exit;
                  end if;
                end loop;
              end if;

              if v_current_effective is not null and ((new_item->>'previousQuantity')::numeric) is distinct from v_current_effective then
                raise exception 'خطای همزمانی اصلاحیه: مقدار قبلی (% لت) با آخرین سقف مصوب جاری (% لت) مطابقت ندارد. این درخواست بر مبنای مقادیر منقضی‌شده ثبت گردیده است.',
                  new_item->>'previousQuantity', v_current_effective;
              end if;
            end;
          end if;
        end if;
      end loop;
    end;
  end if;

  -- ============================================================================
  -- ۴. اعتبارسنجی زمان‌بندی و ظرفیت اکیپ (P1 Capacity & Pre-requisite Validation)
  -- ============================================================================
  if patch ? 'status' and (patch->>'status') in ('SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'PAUSED') then
    is_scheduling := true;
  end if;
  if patch ? 'scheduledDate' and patch->>'scheduledDate' is not null and patch->>'scheduledDate' != '' then
    is_scheduling := true;
  end if;
  if patch ? 'assignedTeamId' and patch->>'assignedTeamId' is not null and patch->>'assignedTeamId' != '' then
    is_scheduling := true;
  end if;
  if patch ? 'requiredDurationHours' then
    is_scheduling := true;
  end if;

  if is_scheduling then
    -- پیش‌نیاز اتمام تولید و تحویل به انبار
    if not (current_data->'technicalHandover'->>'isHistoricalMigration' = 'true') then
      prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
      wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

      if not (prod_confirmed and wh_confirmed) then
        raise exception 'دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.';
      end if;
    end if;

    -- اعتبارسنجی ظرفیت و تداخلات همزمانی
    if merged_data->>'assignedTeamId' is not null and merged_data->>'assignedTeamId' <> '' then
      v_team_id := (merged_data->>'assignedTeamId')::uuid;
      v_sched_date := merged_data->>'scheduledDate';
      v_end_date := merged_data->>'endDate';
      v_sched_time := merged_data->>'scheduledTime';
      v_duration := coalesce((merged_data->>'requiredDurationHours')::numeric, 0);

      perform public.validate_schedule_capacity(
        patch_project.id,
        v_team_id,
        v_sched_date,
        v_end_date,
        v_sched_time,
        v_duration
      );
    end if;
  end if;

  -- ============================================================================
  -- ۵. گیت مسدودسازی انتقال اکیپ (P2.2 Team Transfer Execution Gate)
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
        coalesce(trim(v_latest_transfer->>'managerOverrideReason'), '') != '' and
        coalesce((v_latest_transfer->>'receivingLeadConfirmed')::boolean, false) = false
      )
    ) then
      if v_new_status in ('EN_ROUTE', 'IN_PROGRESS') and v_new_status is distinct from v_current_status then
        raise exception 'شروع یا ادامه کار مسدود است: پروژه در انتظار تایید رسمی تحویل‌گیری توسط سرپرست اکیپ جدید یا رفع انسداد توسط مدیر QC است.';
      end if;
    end if;
  end if;

  -- اعتبارسنجی تغییرات در آرایه teamTransfers
  if patch ? 'teamTransfers' then
    v_curr_transfers_count := coalesce(jsonb_array_length(current_data->'teamTransfers'), 0);
    v_transfers_count := jsonb_array_length(patch->'teamTransfers');

    if v_transfers_count < v_curr_transfers_count then
      raise exception 'دسترسی غیرمجاز: حذف سوابق انتقال اکیپ مجاز نیست.';
    end if;

    if not public.is_qc_manager() then
      if v_transfers_count > v_curr_transfers_count then
        raise exception 'دسترسی غیرمجاز: ثبت انتقال جدید فقط در صلاحیت مدیر QC است.';
      end if;

      v_latest_transfer := patch->'teamTransfers'->(v_transfers_count - 1);

      if (v_latest_transfer->>'receivingLeadConfirmed')::boolean = true and
         coalesce((current_data->'teamTransfers'->(v_curr_transfers_count - 1)->>'receivingLeadConfirmed')::boolean, false) = false then
        
        if auth.uid()::text != current_data->>'leadTechnicianId' or
           v_user_role != 'LEAD_TECHNICIAN' or
           v_user_team_id is distinct from (v_latest_transfer->>'toTeamId') then
          raise exception 'دسترسی غیرمجاز: تایید صورت‌جلسه تحویل کار منحصراً در صلاحیت سرپرست رسمی اکیپ مقصد است.';
        end if;
      end if;

      if (v_latest_transfer->>'isManagerOverride')::boolean = true then
        raise exception 'دسترسی غیرمجاز: ثبت رفع انسداد مدیریتی منحصراً در صلاحیت مدیر QC است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ۶. گیت تایید نهایی QC و عیوب بحرانی (P3 Final QC Approval & Critical Defects)
  -- ============================================================================
  if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
    if not public.is_qc_manager() then
      if v_user_role in ('TECHNICIAN', 'LEAD_TECHNICIAN') then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط می‌تواند وضعیت QC را روی PENDING تنظیم کند.';
      else
        raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
      end if;
    end if;

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

  -- صیانت از تغییرناپذیری تاریخچه بازرسی‌های کیفی
  if patch ? 'qcInspections' then
    if not public.is_qc_manager() then
      raise exception 'دسترسی غیرمجاز: ثبت رسمی برگه بازرسی کنترل کیفی منحصراً در صلاحیت مدیر ارشد QC است.';
    end if;
    v_curr_inspections_count := coalesce(jsonb_array_length(current_data->'qcInspections'), 0);
    v_inspections_count := jsonb_array_length(patch->'qcInspections');
    if v_inspections_count < v_curr_inspections_count then
      raise exception 'دسترسی غیرمجاز: حذف یا کاهش سوابق بازرسی‌های کیفی مجاز نیست.';
    end if;
  end if;

  -- ============================================================================
  -- ۷. محدودیت‌های نقش هماهنگ‌کننده زمان‌بندی (SCHEDULING_COORDINATOR)
  -- ============================================================================
  if public.is_scheduling_coordinator() then
    if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
      raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
    end if;
    if patch ? 'qcScore' and patch->>'qcScore' is not null then
      raise exception 'دسترسی غیرمجاز: ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است.';
    end if;
  end if;

  -- ============================================================================
  -- ۸. محدودیت‌های تکنسین‌ها و سرپرستان اکیپ (TECHNICIAN / LEAD_TECHNICIAN)
  -- ============================================================================
  if not public.is_coordinator_or_manager() then
    if not public.can_access_project(current_data) then
      raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
    end if;

    -- الف) کلیدهای مجاز پچ برای تکنسین
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

    -- ب) وضعیت QC برای تکنسین
    if patch ? 'qcStatus' then
      if patch->>'qcStatus' != 'PENDING' then
        raise exception 'دسترسی غیرمجاز: تکنسین فقط مجاز به ارسال وضعیت QC به حالت در انتظار بررسی (PENDING) است.';
      end if;
      if coalesce(patch->>'status', current_data->>'status') != 'COMPLETED' then
        raise exception 'دسترسی غیرمجاز: تنظیم وضعیت QC روی PENDING فقط همراه با اتمام کار (COMPLETED) مجاز است.';
      end if;
    end if;

    -- ج) ماشین وضعیت مجاز برای تکنسین (شامل PAUSED)
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

    -- د) بررسی گزارش توقف (stuckIncidents - فقط الحاق حادثه باز جدید)
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

    -- هـ) بررسی dailyLogs (فقط الحاق مجاز است، تاییدیه فقط توسط سرپرست)
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
          null;
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

          if (new_logs->(new_len - 1)->>'supervisorConfirmed')::boolean = true then
            declare
              v_caller_is_lead boolean := false;
            begin
              if public.is_qc_manager() then
                v_caller_is_lead := true;
              elsif current_data->>'leadTechnicianId' = auth.uid()::text then
                v_caller_is_lead := true;
              elsif current_data->>'assignedTeamId' is not null and exists (
                select 1 from public.team_members tm
                where tm.user_id = auth.uid()
                  and tm.team_id::text = current_data->>'assignedTeamId'
                  and tm.role_in_team = 'LEAD'
              ) then
                v_caller_is_lead := true;
              end if;

              if not v_caller_is_lead then
                raise exception 'دسترسی غیرمجاز: تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.';
              end if;
            end;
          end if;
        end if;
      end;
    end if;

    -- و) بررسی workSessions (الحاق یا بستن جلسه جاری خود تکنسین)
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
          null;
        elsif new_len = curr_len and curr_len > 0 then
          for i in 0 .. (curr_len - 2) loop
            if (curr_sess->i) is distinct from (new_sess->i) then
              raise exception 'دسترسی غیرمجاز: جلسات کاری قبلی قابل تغییر نیستند.';
            end if;
          end loop;
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

    -- ز) حفاظت سخت‌گیرانه از عیوب کیفی (qcDefects) بر مبنای شناسه‌های یکتا
    if patch ? 'qcDefects' then
      declare
        v_old_defects jsonb := coalesce(current_data->'qcDefects', '[]'::jsonb);
        v_new_defects jsonb := patch->'qcDefects';
        v_old_d jsonb;
        v_matched_d jsonb;
        p int;
        q int;
        v_defect_found boolean;
      begin
        if jsonb_typeof(v_new_defects) is distinct from 'array' then
          raise exception 'دسترسی غیرمجاز: لیست عیوب کیفی باید آرایه معتبر باشد.';
        end if;

        -- تکنسین اجازه ثبت عیب جدید ندارد (عیب‌گذاری رسمی منحصراً وظیفه مدیر QC حین بازرسی است)
        if jsonb_array_length(v_new_defects) > jsonb_array_length(v_old_defects) then
          raise exception 'دسترسی غیرمجاز: ثبت رسمی نقص کیفی منحصراً در صلاحیت مدیر ارشد QC است.';
        end if;

        -- بررسی تک‌تک عیوب ثبت‌شده قبلی با شناسه یکتا (ممانعت از حذف، تعویض یا تغییر مشخصات پایه)
        for p in 0 .. (jsonb_array_length(v_old_defects) - 1) loop
          v_old_d := v_old_defects->p;
          v_defect_found := false;

          for q in 0 .. (jsonb_array_length(v_new_defects) - 1) loop
            v_matched_d := v_new_defects->q;
            if v_matched_d->>'id' = v_old_d->>'id' then
              v_defect_found := true;

              -- مشخصات پایه عیب به هیچ وجه نباید تغییر کند
              if (v_matched_d->>'severity') is distinct from (v_old_d->>'severity') or
                 (v_matched_d->>'category') is distinct from (v_old_d->>'category') or
                 (v_matched_d->>'description') is distinct from (v_old_d->>'description') or
                 (v_matched_d->>'createdByUserId') is distinct from (v_old_d->>'createdByUserId') or
                 (v_matched_d->>'createdAt') is distinct from (v_old_d->>'createdAt') then
                raise exception 'دسترسی غیرمجاز: مشخصات و شدت نقص کیفی ثبت‌شده توسط تکنسین قابل تغییر نیست.';
              end if;

              -- اگر نقص قبلاً تایید نهایی شده، کل شیء عیب کاملاً فریز و غیرقابل تغییر است (Freeze Every Field)
              if (v_old_d->>'status') = 'VERIFIED' then
                if v_matched_d is distinct from v_old_d then
                  raise exception 'دسترسی غیرمجاز: سوابق نقص راستی‌آزمایی‌شده قبلی کاملاً قفل بوده و هرگونه ویرایش آن ممنوع است.';
                end if;
              else
                -- اگر نقص هنوز VERIFIED نشده: تکنسین هرگز حق ارتقای آن به VERIFIED را ندارد
                if (v_matched_d->>'status') = 'VERIFIED' then
                  raise exception 'دسترسی غیرمجاز: تایید راستی‌آزمایی رفع نقص منحصراً در صلاحیت مدیر ارشد QC است.';
                end if;

                -- اگر تکنسین وضعیت را به RESOLVED تغییر می‌دهد، ثبت توضیحات الزامی است
                if (v_matched_d->>'status') = 'RESOLVED' and
                   coalesce(trim(v_matched_d->>'resolutionNotes'), '') = '' then
                  raise exception 'در صورت رفع نقص، ثبت مستند اقدام انجام‌شده الزامی است.';
                end if;
              end if;

              exit;
            end if;
          end loop;

          if not v_defect_found then
            raise exception 'دسترسی غیرمجاز: حذف یا تعویض عیوب کیفی ثبت‌شده مجاز نیست.';
          end if;
        end loop;
      end;
    end if;

    -- ح) پذیرش کارفرما (customerAcceptance)
    if patch ? 'customerAcceptance' then
      if patch->'customerAcceptance'->>'status' = 'UNAVAILABLE' and
         coalesce(trim(patch->'customerAcceptance'->>'unavailabilityReason'), '') = '' then
        raise exception 'در صورت عدم حضور کارفرما، ثبت دلیل مستند عدم امکان اخذ امضا الزامی است.';
      end if;
    end if;
  end if;

  -- ============================================================================
  -- ۹. اعمال نهایی به‌روزرسانی پروژه
  -- ============================================================================
  update public.projects
  set data = current_data || patch,
      updated_at = now(),
      updated_by = auth.uid()
  where public.projects.id = patch_project.id
  returning data into updated_data;

  return updated_data;
end;
$$;

revoke execute on function public.patch_project(text, jsonb) from anon, public;
grant execute on function public.patch_project(text, jsonb) to authenticated;
