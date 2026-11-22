-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۱۸: پشتیبانی از نقش کارشناس فروش (SALES_REP) و جدول رزرو ظرفیت لت‌ها
-- ۱. اصلاح محدودیت نقش‌های profiles برای پذیرش 'SALES_REP' و 'SALES'
-- ۲. ایجاد جدول sales_bookings برای ثبت پروژه‌های فروش و تخصیص شناور لت‌ها
-- ۳. اعمال سیاست‌های امنیتی RLS (سطح ردیف)
-- ==============================================================================

-- ۱. اصلاح چک رول جدول profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'CEO',
    'QC_MANAGER',
    'SCHEDULING_COORDINATOR',
    'SALES',
    'SALES_REP',
    'MEASUREMENT_LEAD',
    'WAREHOUSE',
    'LEAD_TECHNICIAN',
    'TECHNICIAN'
  ));

-- ۲. ساخت جدول رزروهای فروش و تخصیص لت
create table if not exists public.sales_bookings (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  laths_count integer not null check (laths_count > 0 and laths_count <= 60),
  is_smart boolean not null default true,
  notes text default '',
  requested_date text not null, -- YYYY-MM-DD
  jalali_date text not null,
  allocation_mode text not null check (allocation_mode in ('SPREAD_DAILY', 'CONSECUTIVE_DAYS')),
  allocated_teams jsonb not null default '[]'::jsonb,
  allocated_days_count integer not null default 1,
  sales_rep_id text not null,
  sales_rep_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ایندکس‌گذاری برای جستجوی سریع روزانه و بر اساس کارشناس
create index if not exists idx_sales_bookings_date on public.sales_bookings (requested_date);
create index if not exists idx_sales_bookings_rep on public.sales_bookings (sales_rep_id);

-- ۳. فعال‌سازی امنیت سطح ردیف (RLS)
alter table public.sales_bookings enable row level security;

-- سیاست مشاهده: همه کاربران احرازهویت‌شده می‌توانند رزروها را ببینند
drop policy if exists "sales_bookings_select_policy" on public.sales_bookings;
create policy "sales_bookings_select_policy"
  on public.sales_bookings
  for select
  to authenticated
  using (true);

-- سیاست ثبت و ایجاد: کارشناسان فروش، مدیران و هماهنگ‌کننده مجاز به ثبت هستند
drop policy if exists "sales_bookings_insert_policy" on public.sales_bookings;
create policy "sales_bookings_insert_policy"
  on public.sales_bookings
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('SALES_REP', 'SALES', 'QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
        and active = true
    )
  );

-- سیاست به‌روزرسانی: مدیران ارشد و ثبت‌کننده
drop policy if exists "sales_bookings_update_policy" on public.sales_bookings;
create policy "sales_bookings_update_policy"
  on public.sales_bookings
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and (
          role in ('QC_MANAGER', 'CEO', 'SCHEDULING_COORDINATOR')
          or (role in ('SALES_REP', 'SALES') and id::text = sales_bookings.sales_rep_id)
        )
        and active = true
    )
  );

-- اعطای دسترسی به نقش authenticated
grant select, insert, update on public.sales_bookings to authenticated;
