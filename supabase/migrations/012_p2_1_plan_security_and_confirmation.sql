-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۲: صیانت از طرح اولیه نصب، امنیت تایید سرپرست و اتمام استثنایی
-- ۱. ارتقای تابع patch_project با گاردهای سخت‌گیرانه سمت سرور:
--    الف) طرح اولیه (originalPlan) منحصراً توسط مدیر QC قابل ویرایش است.
--    ب) تایید بازنگری طرح (planAmendments.status = 'APPROVED') منحصراً در صلاحیت مدیر QC است.
--    ج) تایید لاگ روزانه (dailyLogs.supervisorConfirmed = true) منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.
--    د) اضافه شدن کلیدهای مجاز عملیاتی: planAmendments, isExceptionalCompletion, exceptionalCompletionDetails
-- ۲. ایجاد تابع امنیتی کنترل‌شده confirm_daily_log جهت تایید گزارش‌های روزانه توسط سرپرست اکیپ
-- ==============================================================================

-- ۱. بازنویسی ارتقایافته تابع patch_project
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

  -- گارد امنیتی طرح اولیه نصب: طرح اولیه تغییرناپذیر است
  -- پس از قفل شدن یا پس از گذر از مرحله بازدید دوم/پیش‌نویس (MEASUREMENT_PENDING)، هیچ کاربری (حتی مدیر QC)
  -- اجازه اصلاح مستقیم originalPlan را ندارد و هرگونه تغییر در مقادیر باید صرفاً از طریق فرآیند رسمی بازنگری طرح (planAmendments) انجام شود.
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

  -- گارد امنیتی بازنگری‌های طرح (planAmendments):
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
      -- الف) صیانت از تاریخچه: هیچ اصلاحیه نهایی‌شده‌ای (APPROVED یا REJECTED) قابل حذف نیست (حتی توسط مدیر QC)
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

        -- ب) صیانت از تغییرناپذیری مقادیر اصلاحیه‌های تاییدشده قبلی (برای همه کاربران از جمله مدیر QC)
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

  declare
    merged_data jsonb := current_data || patch;
    prod_confirmed boolean;
    wh_confirmed boolean;
    is_scheduling boolean := false;
    v_team_id uuid;
    v_sched_date text;
    v_end_date text;
    v_sched_time text;
    v_duration numeric;
  begin
    -- تشخیص تغییرات مربوط به زمان‌بندی و انتساب اکیپ
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
      -- الف) بررسی گیت تحویل رسمی واحد فنی
      if not (current_data->'technicalHandover'->>'isHistoricalMigration' = 'true') then
        prod_confirmed := coalesce((merged_data->'technicalHandover'->'productionConfirmation'->>'confirmed')::boolean, false);
        wh_confirmed := coalesce((merged_data->'technicalHandover'->'warehouseConfirmation'->>'confirmed')::boolean, false);

        if not (prod_confirmed and wh_confirmed) then
          raise exception 'دسترسی غیرمجاز: پروژه تا زمان ثبت و تأیید هر دو پیش‌نیاز اتمام تولید و تحویل به انبار، قابل زمان‌بندی و اعزام اکیپ نیست.';
        end if;
      end if;

      -- ب) اعتبارسنجی سرور سقف ظرفیت، تداخلات همزمانی و قفل ترنزکشن اکیپ
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

    -- محدودیت‌های نقش هماهنگ‌کننده زمان‌بندی (SCHEDULING_COORDINATOR)
    if public.is_scheduling_coordinator() then
      if patch ? 'qcStatus' and patch->>'qcStatus' = 'APPROVED' then
        raise exception 'دسترسی غیرمجاز: تأیید نهایی کنترل کیفی (QC) فقط در صلاحیت مدیر QC است.';
      end if;
      if patch ? 'qcScore' and patch->>'qcScore' is not null then
        raise exception 'دسترسی غیرمجاز: ثبت امتیاز کیفی فقط در صلاحیت مدیر QC است.';
      end if;
    end if;

    -- اگر کاربر مدیر QC یا هماهنگ‌کننده زمان‌بندی نباشد، محدودیت‌های تکنسین اعمال می‌شود
    if not public.is_coordinator_or_manager() then

      -- الف) بررسی تخصیص پروژه به کاربر یا اکیپ او
      if not public.can_access_project(current_data) then
        raise exception 'دسترسی غیرمجاز: شما مسئول یا تکنسین تخصیص‌یافته به این پروژه نیستید.';
      end if;

      -- ب) بررسی کلیدهای مجاز برای تکنسین
      for patch_key in select jsonb_object_keys(patch) loop
        if patch_key not in (
          'status', 'startedAt', 'completedAt', 'reworkStartedAt', 'completionNotes',
          'beforePhotos', 'afterPhotos', 'completionPhotos', 'handoverChecklist',
          'handoverChecklistNotes', 'customerSignature', 'customerSatisfaction',
          'customerSurvey', 'stuckIncidents', 'updatedAt', 'qcStatus',
          'workSessions', 'dailyLogs', 'siteReadiness', 'planAmendments',
          'isExceptionalCompletion', 'exceptionalCompletionDetails'
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

      -- و) بررسی dailyLogs (فقط الحاق مجاز است، با کنترل امنیتی عدم جعل تاییدیه سرپرست)
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

            -- ممانعت از جعل تاییدیه سرپرست توسط تکنسین‌های عادی
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

  end;

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

-- ۲. تابع کنترل‌شده تایید لاگ روزانه توسط سرپرست اکیپ
create or replace function public.confirm_daily_log(
  p_project_id text,
  p_log_id text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project jsonb;
  v_logs jsonb;
  v_updated_logs jsonb := '[]'::jsonb;
  v_log jsonb;
  v_found boolean := false;
  v_user_name text;
  v_is_lead boolean := false;
  i int;
begin
  if not public.is_active_user() then
    raise exception 'Unauthorized: user is not active';
  end if;

  select data into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'پروژه مورد نظر یافت نشد.';
  end if;

  -- بررسی صلاحیت کاربر: فقط مدیر QC، سرپرست پروژه، یا سرپرست اکیپ منتسب
  if public.is_qc_manager() then
    v_is_lead := true;
  elsif v_project->>'leadTechnicianId' = auth.uid()::text then
    v_is_lead := true;
  elsif v_project->>'assignedTeamId' is not null and exists (
    select 1 from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.team_id::text = v_project->>'assignedTeamId'
      and tm.role_in_team = 'LEAD'
  ) then
    v_is_lead := true;
  end if;

  if not v_is_lead then
    raise exception 'دسترسی غیرمجاز: تایید گزارش روزانه منحصراً در صلاحیت سرپرست اکیپ یا مدیر QC است.';
  end if;

  select name into v_user_name
  from public.profiles
  where id = auth.uid();

  v_logs := coalesce(v_project->'dailyLogs', '[]'::jsonb);

  for i in 0 .. (jsonb_array_length(v_logs) - 1) loop
    v_log := v_logs->i;
    if v_log->>'id' = p_log_id then
      v_found := true;
      if (v_log->>'supervisorConfirmed')::boolean = true then
        raise exception 'این گزارش روزانه قبلاً توسط سرپرست تایید شده است.';
      end if;
      v_log := v_log || jsonb_build_object(
        'supervisorConfirmed', true,
        'supervisorConfirmedBy', coalesce(v_user_name, 'سرپرست اکیپ'),
        'supervisorConfirmedAt', now()::text,
        'supervisorNotes', p_notes
      );
    end if;
    v_updated_logs := v_updated_logs || jsonb_build_array(v_log);
  end loop;

  if not v_found then
    raise exception 'گزارش روزانه مورد نظر یافت نشد.';
  end if;

  update public.projects
  set data = jsonb_set(data, '{dailyLogs}', v_updated_logs),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_project_id
  returning data into v_project;

  return v_project;
end;
$$;

revoke execute on function public.confirm_daily_log(text, text, text) from anon, public;
grant execute on function public.confirm_daily_log(text, text, text) to authenticated;

-- ۳. تریگر محافظت لایه دیتابیس از خط مبنا و اصلاحیه‌ها در برابر هرگونه UPDATE مستقیم جدول
create or replace function public.trg_enforce_project_plan_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_plan jsonb := OLD.data->'originalPlan';
  new_plan jsonb := NEW.data->'originalPlan';
  old_amends jsonb := coalesce(OLD.data->'planAmendments', '[]'::jsonb);
  new_amends jsonb := coalesce(NEW.data->'planAmendments', '[]'::jsonb);
  old_item jsonb;
  matched_new jsonb;
  new_item jsonb;
  j int;
  k int;
  found_match boolean;
begin
  -- الف) ممانعت از بازنویسی یا دستکاری طرح اولیه پس از قفل شدن یا پس از گذر از مرحله پیش‌نویس (MEASUREMENT_PENDING)
  if old_plan is not null and (
       (old_plan ? 'lockedAt' and old_plan->>'lockedAt' is not null) or
       (OLD.data->>'status') != 'MEASUREMENT_PENDING'
     ) then
    if new_plan is distinct from old_plan then
      raise exception 'دسترسی غیرمجاز: طرح اولیه نصب (Original Plan) پس از قفل شدن یا زمان‌بندی تغییرناپذیر است. برای هرگونه اصلاح در مقادیر، باید از فرآیند رسمی بازنگری طرح (Plan Amendment) استفاده شود.';
    end if;
  end if;

  -- ب) صیانت از تاریخچه و عدم حذف یا تغییر مقادیر اصلاحیه‌های نهایی‌شده (APPROVED یا REJECTED)
  if jsonb_typeof(old_amends) = 'array' then
    for j in 0 .. (jsonb_array_length(old_amends) - 1) loop
      old_item := old_amends->j;
      if old_item->>'status' in ('APPROVED', 'REJECTED') then
        found_match := false;
        if jsonb_typeof(new_amends) = 'array' then
          for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
            matched_new := new_amends->k;
            if matched_new->>'id' = old_item->>'id' then
              found_match := true;
              if old_item->>'status' = 'APPROVED' then
                if (matched_new->>'status') != 'APPROVED' then
                  raise exception 'دسترسی غیرمجاز: وضعیت اصلاحیه تاییدشده قابل بازگشت نیست.';
                end if;
                if (matched_new->>'activityId') is distinct from (old_item->>'activityId') or
                   ((matched_new->>'previousQuantity')::numeric) is distinct from ((old_item->>'previousQuantity')::numeric) or
                   ((matched_new->>'newQuantity')::numeric) is distinct from ((old_item->>'newQuantity')::numeric) or
                   (matched_new->>'reason') is distinct from (old_item->>'reason') or
                   (matched_new->>'requestedByUserId') is distinct from (old_item->>'requestedByUserId') or
                   (matched_new->>'requestedAt') is distinct from (old_item->>'requestedAt') or
                   (matched_new->>'reviewedByUserId') is distinct from (old_item->>'reviewedByUserId') or
                   (matched_new->>'reviewedAt') is distinct from (old_item->>'reviewedAt') then
                  raise exception 'دسترسی غیرمجاز: اصلاحیه تاییدشده قبلی غیرقابل تغییر است. برای هرگونه تغییر در مقادیر، اصلاحیه جدید ثبت کنید.';
                end if;
              elsif old_item->>'status' = 'REJECTED' then
                if (matched_new->>'status') != 'REJECTED' then
                  raise exception 'دسترسی غیرمجاز: اصلاحیه ردشده قابل بازگشت یا تغییر وضعیت نیست. برای بازنگری باید اصلاحیه جدید ثبت شود.';
                end if;
              end if;
              exit;
            end if;
          end loop;
        end if;

        if not found_match then
          raise exception 'دسترسی غیرمجاز: حذف سوابق اصلاحیه‌های نهایی‌شده طرح (تاییدشده یا ردشده) امکان‌پذیر نیست.';
        end if;
      end if;
    end loop;
  end if;

  -- ج) تایید اصلاحیه جدید منحصراً توسط مدیر QC مجاز است
  if jsonb_typeof(new_amends) = 'array' then
    for k in 0 .. (jsonb_array_length(new_amends) - 1) loop
      new_item := new_amends->k;
      if new_item->>'status' = 'APPROVED' then
        found_match := false;
        if jsonb_typeof(old_amends) = 'array' then
          for j in 0 .. (jsonb_array_length(old_amends) - 1) loop
            old_item := old_amends->j;
            if old_item->>'id' = new_item->>'id' and old_item->>'status' = 'APPROVED' then
              found_match := true;
              exit;
            end if;
          end loop;
        end if;

        if not found_match then
          if not public.is_qc_manager() then
            raise exception 'دسترسی غیرمجاز: تایید بازنگری و تغییر سقف برنامه فقط در صلاحیت مدیر QC است.';
          end if;

          -- بررسی عدم همزمانی منقضی (Stale Amendment Check)
          declare
            v_act_id text := new_item->>'activityId';
            v_current_effective numeric := null;
            v_cand_amend jsonb;
            m int;
            v_plan_acts jsonb := OLD.data->'originalPlan'->'activities';
            v_act_item jsonb;
          begin
            for m in 0 .. (jsonb_array_length(old_amends) - 1) loop
              v_cand_amend := old_amends->m;
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
  end if;

  return NEW;
end;
$$;

revoke execute on function public.trg_enforce_project_plan_integrity() from anon, public;
grant execute on function public.trg_enforce_project_plan_integrity() to authenticated, service_role;

drop trigger if exists trg_enforce_plan_integrity on public.projects;
create trigger trg_enforce_plan_integrity
  before update on public.projects
  for each row execute function public.trg_enforce_project_plan_integrity();

-- ۴. صیانت از اسکیمای public: سلب دسترسی ایجاد شیء از نقش‌های غیرمجاز جهت ممانعت از حملات سایه‌سازی (Object Shadowing)
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;
grant usage on schema public to authenticated;

-- ۵. جدول محافظت‌شده شناسه محیط دیتابیس (فاقد هرگونه رکورد پیش‌فرض جهت ممانعت از انتساب خودکار استیجینگ)
create table if not exists public.db_environment_identity (
  environment text primary key check (environment in ('staging', 'test', 'local')),
  cluster_identity text not null,
  provisioned_by text not null,
  provisioned_at timestamptz not null default now(),
  safety_lock boolean not null default true check (safety_lock = true)
);
alter table public.db_environment_identity enable row level security;
revoke all on public.db_environment_identity from public, anon, authenticated;
grant select on public.db_environment_identity to postgres, service_role;

