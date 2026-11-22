-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۳: همگام‌سازی سروری رزروهای فروش
-- ۱. افزودن ستون‌های تکمیلی (تبدیل به پروژه نصب + نسخه کامل JSON) به sales_bookings
-- ۲. اصلاح باگ سیاست UPDATE مایگریشن ۰۱۸ (مقایسه uuid با text باعث خطا در ساخت policy می‌شد)
-- ۳. جلوگیری از جعل شناسه کارشناس فروش در INSERT/UPDATE (هر کارشناس فقط با شناسه خودش)
-- ۴. حذف رزرو: منحصراً مدیر اپ و QC (تصمیم صاحب پروژه، مطابق رابط کاربری)
-- ۵. فعال‌سازی Realtime برای به‌روزرسانی لحظه‌ای تقویم ظرفیت روی همه دستگاه‌ها
-- این اسکریپت idempotent است و اجرای چندباره آن بی‌خطر است.
-- ==============================================================================

-- ۰. پیش‌نیازها (اگر مایگریشن ۰۱۸ به‌خاطر باگ uuid=text کامل اجرا نشده باشد)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'CEO', 'QC_MANAGER', 'SCHEDULING_COORDINATOR', 'SALES', 'SALES_REP',
    'MEASUREMENT_LEAD', 'WAREHOUSE', 'LEAD_TECHNICIAN', 'TECHNICIAN'
  ));

create table if not exists public.sales_bookings (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  laths_count integer not null check (laths_count > 0),
  is_smart boolean not null default true,
  notes text default '',
  requested_date text not null,
  jalali_date text not null,
  allocation_mode text not null check (allocation_mode in ('SPREAD_DAILY', 'CONSECUTIVE_DAYS')),
  allocated_teams jsonb not null default '[]'::jsonb,
  allocated_days_count integer not null default 1,
  sales_rep_id text not null,
  sales_rep_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_bookings_date on public.sales_bookings (requested_date);
create index if not exists idx_sales_bookings_rep on public.sales_bookings (sales_rep_id);
alter table public.sales_bookings enable row level security;

drop policy if exists "sales_bookings_select_policy" on public.sales_bookings;
create policy "sales_bookings_select_policy"
  on public.sales_bookings for select to authenticated using (true);

-- سقف ۶۰ لت حذف شده است (مایگریشن ۰۲۰)
alter table public.sales_bookings drop constraint if exists sales_bookings_laths_count_check;
alter table public.sales_bookings add constraint sales_bookings_laths_count_check check (laths_count > 0);

-- ۱. ستون‌های تکمیلی
alter table public.sales_bookings add column if not exists converted_to_project_id text;
alter table public.sales_bookings add column if not exists scheduled_installation_date text;
alter table public.sales_bookings add column if not exists assigned_installation_team_id text;
alter table public.sales_bookings add column if not exists data jsonb;

-- ۲ و ۳. سیاست INSERT (با جلوگیری از جعل شناسه)
drop policy if exists "sales_bookings_insert_policy" on public.sales_bookings;
create policy "sales_bookings_insert_policy"
  on public.sales_bookings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and (
          p.role in ('QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
          or (p.role in ('SALES_REP', 'SALES') and p.id::text = sales_bookings.sales_rep_id)
        )
    )
  );

-- سیاست UPDATE (اصلاح‌شده: p.id::text)
drop policy if exists "sales_bookings_update_policy" on public.sales_bookings;
create policy "sales_bookings_update_policy"
  on public.sales_bookings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and (
          p.role in ('QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
          or (p.role in ('SALES_REP', 'SALES') and p.id::text = sales_bookings.sales_rep_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and (
          p.role in ('QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
          or (p.role in ('SALES_REP', 'SALES') and p.id::text = sales_bookings.sales_rep_id)
        )
    )
  );

-- ۴. سیاست DELETE
drop policy if exists "sales_bookings_delete_policy" on public.sales_bookings;
create policy "sales_bookings_delete_policy"
  on public.sales_bookings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role = 'QC_MANAGER'
    )
  );

grant select, insert, update, delete on public.sales_bookings to authenticated;

-- ۵. Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_bookings'
     ) then
    alter publication supabase_realtime add table public.sales_bookings;
  end if;
end $$;
