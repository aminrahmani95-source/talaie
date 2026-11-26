-- ==============================================================================
-- گالری طلایی | مایگریشن ۰۲۶: گزارش خودکار خطاهای گوشی‌ها
--
-- چرا: خطای آپلود عکس فقط روی گوشی سرپرست دیده می‌شد و مدیر یا پشتیبانی از آن
-- خبر نداشت. از این به بعد برنامه هر خطای آپلود عکس، ارسال تغییرات و فشرده‌سازی
-- عکس را (با متن خطا، پروژه، نوع گوشی و اندازه‌ی عکس) در این جدول ثبت می‌کند و
-- مدیر QC و هماهنگ‌کننده آن را در «موانع ← خطاهای برنامه» می‌بینند.
--
-- چیزی از داده‌های موجود تغییر نمی‌کند. چندبار اجرا شدنش بی‌ضرر است.
-- در Supabase → SQL Editor کل فایل را یک‌جا اجرا کنید.
-- ==============================================================================

create table if not exists public.client_error_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_at timestamptz,
  user_id uuid not null default auth.uid(),
  user_name text,
  user_role text,
  project_id text,
  context text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  app_version text,
  user_agent text,
  constraint client_error_reports_context_len check (char_length(context) <= 80),
  constraint client_error_reports_message_len check (char_length(message) <= 2000),
  constraint client_error_reports_details_size check (pg_column_size(details) <= 8000),
  constraint client_error_reports_ua_len check (user_agent is null or char_length(user_agent) <= 400)
);

create index if not exists client_error_reports_created_idx
  on public.client_error_reports (created_at desc);

alter table public.client_error_reports enable row level security;

-- هر کاربر فعال فقط به نام خودش گزارش ثبت می‌کند
drop policy if exists "Active users insert own error reports" on public.client_error_reports;
create policy "Active users insert own error reports"
  on public.client_error_reports for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

-- فقط مدیر QC، مدیرعامل و هماهنگ‌کننده گزارش‌ها را می‌بینند
drop policy if exists "Managers read error reports" on public.client_error_reports;
create policy "Managers read error reports"
  on public.client_error_reports for select to authenticated
  using (public.is_coordinator_or_manager());

-- پاک کردن گزارش‌های قدیمی فقط برای مدیر QC
drop policy if exists "QC manager deletes error reports" on public.client_error_reports;
create policy "QC manager deletes error reports"
  on public.client_error_reports for delete to authenticated
  using (public.is_qc_manager());

grant select, insert, delete on public.client_error_reports to authenticated;
