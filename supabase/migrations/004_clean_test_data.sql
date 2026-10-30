-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 004: Clean up test/mock projects and tickets from production database
-- ==============================================================================

-- ۱. حذف پروژه‌های تستی از جدول اختصاصی projects
delete from public.projects
where id in ('p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6');

-- ۲. حذف تیکت‌های تستی از جدول اختصاصی tickets
delete from public.tickets
where id in ('t-1');

-- ۳. پاک‌سازی ردیف‌های تستی در talaie_sync (در صورت باقی ماندن از نسخه‌های قبل)
update public.talaie_sync
set value = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
  where elem->>'id' not in ('p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6')
)
where key = 'projects';

update public.talaie_sync
set value = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
  where elem->>'id' != 't-1'
)
where key = 'tickets';
