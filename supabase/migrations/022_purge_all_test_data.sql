-- ==============================================================================
-- گالری طلایی | سامانه عملیات نصب و QC (Talaei Gallery)
-- Migration 022: Complete Purge of All Test & Mock Data (Projects, Tickets, Materials)
-- ==============================================================================

-- ۱. حذف تمام پروژه‌های تستی، پیش‌فرض، دمو و حاصل از رزروهای تستی
delete from public.projects
where id in ('p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6')
   or id like 'p-demo-%'
   or id like 'p-test-%'
   or id like 'p-from-sale-book-seed-%'
   or id like '%seed-%'
   or data->>'customerName' in ('دکتر ستاری', 'مهندس پاشایی (ویلا لواسان)', 'خانم افشار', 'دفتر مرکزی شرکت پترو کیش')
   or data->>'title' like 'رزرو فروش: %';

-- ۲. حذف تیکت‌های تستی و دمو
delete from public.tickets
where id = 't-1'
   or id like 't-demo-%'
   or id like 't-test-%'
   or id like '%seed-%';

-- ۳. حذف درخواست‌های متریال تستی
delete from public.material_requests
where id like 'mat-demo-%'
   or id like 'mat-test-%'
   or id like '%seed-%';

-- ۴. پاک‌سازی ردیف‌های باقیمانده در جدول کلید-مقدار talaie_sync
update public.talaie_sync
set value = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
  where elem->>'id' not in ('p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6')
    and elem->>'id' not like 'p-demo-%'
    and elem->>'id' not like 'p-test-%'
    and elem->>'id' not like 'p-from-sale-book-seed-%'
    and elem->>'id' not like '%seed-%'
    and elem->>'customerName' not in ('دکتر ستاری', 'مهندس پاشایی (ویلا لواسان)', 'خانم افشار', 'دفتر مرکزی شرکت پترو کیش')
)
where key = 'projects';

update public.talaie_sync
set value = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(case jsonb_typeof(value) when 'array' then value else '[]'::jsonb end) as elem
  where elem->>'id' != 't-1'
    and elem->>'id' not like 't-demo-%'
    and elem->>'id' not like 't-test-%'
    and elem->>'id' not like '%seed-%'
)
where key = 'tickets';

-- ۵. حذف اعضای تستی اکیپ‌ها و پاک‌سازی سرپرست‌های ساختگی
delete from public.team_members
where user_id in (
  select id from public.profiles
  where phone in (
    '09121111115', '09124444441', '09125555551', '09127777771', '09127777772', '09127777773',
    '09122222221', '09123333331', '09123333332', '09122222222', '09123333333', '09123333334',
    '09122222223', '09123333335', '09122222224', '09123333336'
  )
);

update public.installation_teams
set supervisor_id = null;

-- ۶. حذف پروفایل‌های پرسنل تستی (نگهداری انحصاری مدیرعامل و مدیر اپ/QC)
delete from public.profiles
where phone in (
  '09121111115', '09124444441', '09125555551', '09127777771', '09127777772', '09127777773',
  '09122222221', '09123333331', '09123333332', '09122222222', '09123333333', '09123333334',
  '09122222223', '09123333335', '09122222224', '09123333336'
);

