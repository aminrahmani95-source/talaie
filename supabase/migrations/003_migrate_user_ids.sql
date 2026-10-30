-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 003: Migrate Legacy User IDs to Profiles UUIDs
-- تبدیل شناسه‌های رشته‌ای قدیمی به UUIDهای واقعی جدول profiles بر اساس شماره موبایل
-- ==============================================================================

-- نکته مهم: این مایگریشن باید پس از ایجاد حساب‌های پرسنل در Supabase Auth / profiles
-- اجرا شود تا بتواند شناسه UUID معادل هر شماره موبایل را بیابد.

do $$
declare
  mapping record;
  p record;
  target_uuid uuid;
  new_assigned jsonb;
  found_count int := 0;
  missing_count int := 0;
begin
  -- ۱. ساخت جدول موقت نگاشت شناسه‌های قدیمی به شماره‌های همراه پرسنل
  create temp table temp_user_map (
    old_id text primary key,
    phone text not null
  ) on commit drop;

  insert into temp_user_map (old_id, phone) values
    ('u-admin-1', '09124339038'),
    ('u-admin',   '09124339038'),
    ('u-admin-2', '09120000002'),
    ('u-planner', '09120000003'),
    ('u-lead-1',  '09122222221'),
    ('u-lead-2',  '09122222222'),
    ('u-lead-3',  '09122222223'),
    ('u-lead-4',  '09122222224'),
    ('u-tech-1',  '09123333331'),
    ('u-tech-2',  '09123333332'),
    ('u-tech-3',  '09123333333'),
    ('u-tech-4',  '09123333334'),
    ('u-tech-5',  '09123333335'),
    ('u-tech-6',  '09123333336'),
    ('u-tech-7',  '09123333337'),
    ('u-tech-8',  '09124444441'),
    ('u-tech-9',  '09124444442');

  -- ۲. پیمایش نگاشت‌ها و تبدیل در جدول projects
  for mapping in select * from temp_user_map loop
    -- یافتن UUID متناظر با شماره تلفن از جدول profiles
    select id into target_uuid from public.profiles where phone = mapping.phone limit 1;

    if target_uuid is null then
      raise notice 'هشدار: پروفایل پرسنل با شناسه قدیمی % و شماره موبایل % در جدول profiles یافت نشد. این شناسه دست‌نخورده باقی ماند.', mapping.old_id, mapping.phone;
      missing_count := missing_count + 1;
    else
      found_count := found_count + 1;

      -- الف) به‌روزرسانی سرپرست اکیپ در data->'leadTechnicianId'
      update public.projects
      set data = jsonb_set(data, '{leadTechnicianId}', to_jsonb(target_uuid::text))
      where data->>'leadTechnicianId' = mapping.old_id;

      -- ب) به‌روزرسانی تکنسین‌های منتسب در آرایه data->'assignedTechnicianIds'
      for p in 
        select id, data 
        from public.projects 
        where jsonb_typeof(data->'assignedTechnicianIds') = 'array'
          and data->'assignedTechnicianIds' @> to_jsonb(mapping.old_id)
      loop
        select jsonb_agg(
          case 
            when elem = to_jsonb(mapping.old_id) then to_jsonb(target_uuid::text)
            else elem
          end
        )
        into new_assigned
        from jsonb_array_elements(p.data->'assignedTechnicianIds') as elem;

        update public.projects
        set data = jsonb_set(data, '{assignedTechnicianIds}', coalesce(new_assigned, '[]'::jsonb))
        where id = p.id;
      end loop;
    end if;
  end loop;

  raise notice 'اتمام عملیات مهاجرت شناسه‌ها: % پرسنل معادل‌سازی و جایگزین شدند، % پرسنل یافت نشدند.', found_count, missing_count;
end $$;
