-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 003: Migrate Legacy User IDs to Profiles UUIDs
-- تبدیل پویای شناسه‌های قدیمی به UUIDهای واقعی جدول profiles بر اساس شماره و نام
-- ==============================================================================

create or replace function public.migrate_legacy_user_ids()
returns table (
  old_id text,
  name text,
  match_method text,
  matched_uuid uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  u_record record;
  found_uuid uuid;
  method text;
  p_row record;
  new_assigned jsonb;
  backup_json jsonb;
begin
  -- دریافت داده‌های پشتیبان کاربران قدیمی از talaie_sync
  select coalesce(
    (select value from public.talaie_sync where key = 'users_backup' limit 1),
    (select value from public.talaie_sync where key = 'users' limit 1),
    '[]'::jsonb
  ) into backup_json;

  if jsonb_typeof(backup_json) != 'array' or jsonb_array_length(backup_json) = 0 then
    raise notice 'هیچ داده پشتیبانی از کاربران در talaie_sync یافت نشد.';
    return;
  end if;

  -- پیمایش تک‌تک پرسنل موجود در نسخه پشتیبان
  for u_record in 
    select 
      elem->>'id' as u_id,
      elem->>'name' as u_name,
      elem->>'phone' as u_phone
    from jsonb_array_elements(backup_json) as elem
    where elem->>'id' is not null
  loop
    found_uuid := null;
    method := null;

    -- ۱. تطبیق اول: بر اساس شماره همراه
    if u_record.u_phone is not null and trim(u_record.u_phone) != '' then
      select id into found_uuid
      from public.profiles
      where phone = trim(u_record.u_phone)
      limit 1;

      if found_uuid is not null then
        method := 'phone';
      end if;
    end if;

    -- ۲. تطبیق دوم: بر اساس نام (بخش قبل از پرانتز، بدون فاصله‌های زائد)
    if found_uuid is null and u_record.u_name is not null and trim(u_record.u_name) != '' then
      select id into found_uuid
      from public.profiles
      where trim(split_part(profiles.name, '(', 1)) = trim(split_part(u_record.u_name, '(', 1))
      limit 1;

      if found_uuid is not null then
        method := 'name';
      end if;
    end if;

    -- ۳. اعمال تغییرات در صورت یافتن UUID معتبر
    if found_uuid is not null then
      -- الف) به‌روزرسانی سرپرست اکیپ در data->'leadTechnicianId'
      update public.projects
      set data = jsonb_set(data, '{leadTechnicianId}', to_jsonb(found_uuid::text))
      where data->>'leadTechnicianId' = u_record.u_id;

      -- ب) به‌روزرسانی تکنسین‌های منتسب در آرایه data->'assignedTechnicianIds'
      for p_row in 
        select id, data 
        from public.projects 
        where jsonb_typeof(data->'assignedTechnicianIds') = 'array'
          and data->'assignedTechnicianIds' @> to_jsonb(u_record.u_id)
      loop
        select jsonb_agg(
          case 
            when elem = to_jsonb(u_record.u_id) then to_jsonb(found_uuid::text)
            else elem
          end
        )
        into new_assigned
        from jsonb_array_elements(p_row.data->'assignedTechnicianIds') as elem;

        update public.projects
        set data = jsonb_set(data, '{assignedTechnicianIds}', coalesce(new_assigned, '[]'::jsonb))
        where id = p_row.id;
      end loop;
    else
      raise notice 'پرسنل % با شناسه % تطبیق داده نشد و دست‌نخورده باقی ماند.', u_record.u_name, u_record.u_id;
    end if;

    -- بازگرداندن سطر در جدول خروجی
    old_id := u_record.u_id;
    name := u_record.u_name;
    match_method := method;
    matched_uuid := found_uuid;
    return next;
  end loop;
end;
$$;

revoke execute on function public.migrate_legacy_user_ids() from anon, public;
grant execute on function public.migrate_legacy_user_ids() to authenticated;

-- اجرای مهاجرت و نمایش جدول نتیجه
select * from public.migrate_legacy_user_ids();
